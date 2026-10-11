/**
 * Lineup optimizer: fills the most restrictive slots first, then FLEX, then SUPERFLEX.
 * For the standard nested slot structures (dedicated ⊂ FLEX ⊂ SUPERFLEX) this greedy
 * fill is optimal for maximizing total projected points.
 */
import type { Position, Slot } from '@/data/types';
import { normCdf } from '@/lib/utils';

export interface LineupCandidate {
  id: string;
  position: Position;
  mean: number;
  sd: number;
}

export interface LineupSlot<T extends LineupCandidate = LineupCandidate> {
  slot: Slot;
  player: T | null;
}

export interface LineupResult<T extends LineupCandidate = LineupCandidate> {
  starters: LineupSlot<T>[];
  bench: T[];
  total: number;
}

export const SLOT_ELIGIBILITY: Record<Slot, Position[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  K: ['K'],
  DST: ['DST'],
  FLEX: ['RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
};

const FILL_ORDER: Slot[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX', 'SUPERFLEX'];
const DISPLAY_ORDER: Slot[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K', 'DST'];

export function optimizeLineup<T extends LineupCandidate>(pool: T[], slots: Record<Slot, number>, locked: Partial<Record<string, Slot>> = {}): LineupResult<T> {
  const available = [...pool].sort((a, b) => b.mean - a.mean);
  const used = new Set<string>();
  const filled: LineupSlot<T>[] = [];
  const remaining: Record<Slot, number> = { ...slots };

  // Honor locked players first
  for (const [id, slot] of Object.entries(locked)) {
    const p = available.find((x) => x.id === id);
    if (!p || !slot || remaining[slot] <= 0 || !SLOT_ELIGIBILITY[slot].includes(p.position)) continue;
    filled.push({ slot, player: p });
    used.add(id);
    remaining[slot]--;
  }

  for (const slot of FILL_ORDER) {
    for (let i = 0; i < (remaining[slot] ?? 0); i++) {
      const p = available.find((x) => !used.has(x.id) && SLOT_ELIGIBILITY[slot].includes(x.position));
      if (p) used.add(p.id);
      filled.push({ slot, player: p ?? null });
    }
  }
  filled.sort((a, b) => DISPLAY_ORDER.indexOf(a.slot) - DISPLAY_ORDER.indexOf(b.slot));
  const bench = available.filter((x) => !used.has(x.id));
  const total = filled.reduce((acc, s) => acc + (s.player?.mean ?? 0), 0);
  return { starters: filled, bench, total };
}

/** Probability the starter outscores the alternative, mapped to a 50–99 confidence score. */
export function startConfidence(starter: LineupCandidate, alt: LineupCandidate | null | undefined): number {
  if (!alt) return 99;
  const sd = Math.sqrt(starter.sd ** 2 + alt.sd ** 2) || 1;
  const p = normCdf((starter.mean - alt.mean) / sd);
  return Math.round(Math.min(99, Math.max(50, p * 100)));
}

/** Best bench player eligible for a slot. */
export function bestAlternative<T extends LineupCandidate>(slot: Slot, bench: T[]): T | null {
  return bench.filter((b) => SLOT_ELIGIBILITY[slot].includes(b.position)).sort((a, b) => b.mean - a.mean)[0] ?? null;
}

/** Head-to-head probability A outscores B. */
export function headToHead(a: LineupCandidate, b: LineupCandidate) {
  const sd = Math.sqrt(a.sd ** 2 + b.sd ** 2) || 1;
  return normCdf((a.mean - b.mean) / sd);
}
