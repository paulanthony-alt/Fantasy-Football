/**
 * The single façade the UI talks to. Each method tries the configured live source,
 * falls back to the mock source on any failure, and tags the result with provenance.
 */
import type { GameLog, GameOdds, NewsItem, PlayerProp, Sourced, TrendingPlayer } from './types';
import type { CoreData, DataSource } from './sources/types';
import { mockSource } from './sources/mock';
import { enrichWithSleeper, sleeperSource } from './sources/sleeper';
import { espnSource } from './sources/espn';
import { nflverseSource } from './sources/nflverse';

export interface DataSettings {
  live: boolean;
  nflverseStats: boolean;
}

let settings: DataSettings = { live: true, nflverseStats: false };
export function configureRepository(s: Partial<DataSettings>) {
  settings = { ...settings, ...s };
}
export function repositorySettings() {
  return settings;
}

async function withFallback<T>(live: (() => Promise<T>) | null, liveSource: DataSource | null, fallback: () => Promise<T>): Promise<Sourced<T>> {
  if (live && liveSource && settings.live) {
    try {
      const data = await live();
      return { data, source: liveSource.label, fetchedAt: Date.now(), stale: false };
    } catch (e) {
      if (import.meta.env.DEV) console.info(`[data] ${liveSource.label} unavailable, using model data:`, (e as Error).message);
    }
  }
  const data = await fallback();
  return { data, source: mockSource.label, fetchedAt: Date.now(), stale: false };
}

export const repository = {
  async core(): Promise<Sourced<CoreData>> {
    const base = await mockSource.getCore();
    if (!settings.live) return { data: base, source: mockSource.label, fetchedAt: Date.now(), stale: false };
    try {
      const enriched = await enrichWithSleeper(base);
      return { data: enriched, source: `${mockSource.label} + Sleeper`, fetchedAt: Date.now(), stale: false };
    } catch {
      return { data: base, source: mockSource.label, fetchedAt: Date.now(), stale: false };
    }
  },
  gameLogs(playerId: string, core: CoreData): Promise<Sourced<GameLog[]>> {
    return withFallback(settings.nflverseStats ? () => nflverseSource.getGameLogs!(playerId, core) : null, nflverseSource, () => mockSource.getGameLogs(playerId));
  },
  odds(week: number): Promise<Sourced<GameOdds[]>> {
    // No free odds feed — plug a provider (e.g. The Odds API) in here.
    return withFallback(null, null, () => mockSource.getOdds(week));
  },
  props(week: number): Promise<Sourced<PlayerProp[]>> {
    return withFallback(null, null, () => mockSource.getProps(week));
  },
  news(core: CoreData): Promise<Sourced<NewsItem[]>> {
    return withFallback(() => espnSource.getNews!(core), espnSource, () => mockSource.getNews());
  },
  trending(core: CoreData): Promise<Sourced<TrendingPlayer[]>> {
    return withFallback(() => sleeperSource.getTrending!(core), sleeperSource, () => mockSource.getTrending());
  },
  allLogs(): Promise<Record<string, GameLog[]>> {
    return import('./mock/generate').then((m) => m.getMockDataset().logs);
  },
};
