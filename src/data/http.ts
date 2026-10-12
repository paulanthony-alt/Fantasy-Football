/**
 * Networking primitives for live sources:
 *  - TTL cache (memory + localStorage for small payloads)
 *  - token-bucket rate limiting per host
 *  - retry with exponential backoff on 429/5xx (honors Retry-After)
 *  - request timeout
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<CacheEntry<unknown>>>();
const LS_PREFIX = 'ge:cache:';
const LS_MAX_BYTES = 250_000;

function readLs<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}
function writeLs(key: string, entry: CacheEntry<unknown>) {
  try {
    const raw = JSON.stringify(entry);
    if (raw.length <= LS_MAX_BYTES) localStorage.setItem(LS_PREFIX + key, raw);
  } catch {
    /* quota or private mode — memory cache still works */
  }
}

export function clearHttpCache() {
  memory.clear();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/* ───── Rate limiting ───── */
class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private capacity: number, private refillPerSec: number) {
    this.tokens = capacity;
  }
  async take(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await sleep(((1 - this.tokens) / this.refillPerSec) * 1000);
    }
  }
}
const buckets = new Map<string, TokenBucket>();
// Sleeper asks clients to stay under 1000 req/min; ESPN is undocumented — be polite.
const LIMITS: Record<string, [number, number]> = {
  'api.sleeper.app': [20, 10],
  'site.api.espn.com': [5, 2],
  'github.com': [3, 1],
};
function bucketFor(url: string) {
  const host = new URL(url).host;
  let b = buckets.get(host);
  if (!b) {
    const [cap, rate] = LIMITS[host] ?? [5, 2];
    b = new TokenBucket(cap, rate);
    buckets.set(host, b);
  }
  return b;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3, timeoutMs = 12_000): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await bucketFor(url).take();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const ra = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * 2 ** attempt);
        continue;
      }
      throw new HttpError(res.status, `${res.status} ${res.statusText} — ${url}`);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (attempt >= retries) throw e;
      await sleep(400 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface CachedOptions {
  ttlMs: number;
  /** Persist small payloads across reloads. */
  persist?: boolean;
  parse?: 'json' | 'text';
  force?: boolean;
}

/** GET with caching; returns data and the time it was fetched. */
export async function cachedGet<T>(url: string, opts: CachedOptions): Promise<CacheEntry<T>> {
  const key = url;
  const now = Date.now();
  if (!opts.force) {
    const hit = (memory.get(key) as CacheEntry<T> | undefined) ?? (opts.persist ? readLs<T>(key) : null);
    if (hit && now - hit.fetchedAt < opts.ttlMs) {
      memory.set(key, hit);
      return hit;
    }
  }
  const running = inflight.get(key) as Promise<CacheEntry<T>> | undefined;
  if (running) return running;
  const p = (async () => {
    const res = await fetchWithRetry(url);
    const data = (opts.parse === 'text' ? await res.text() : await res.json()) as T;
    const entry = { data, fetchedAt: Date.now() };
    memory.set(key, entry);
    if (opts.persist) writeLs(key, entry);
    return entry;
  })();
  inflight.set(key, p as Promise<CacheEntry<unknown>>);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
