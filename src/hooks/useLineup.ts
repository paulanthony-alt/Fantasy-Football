import { useMemo } from 'react';
import type { Player, Slot } from '@/data/types';
import { effectiveSlots } from '@/engine/valuation';
import { bestAlternative, optimizeLineup, startConfidence, type LineupCandidate } from '@/engine/lineup/optimizer';
import type { UniverseState } from './useUniverse';
import type { PlayerValuation } from '@/engine/valuation';

export interface LineupPlayer extends LineupCandidate {
  player: Player;
  val: PlayerValuation;
}

export interface LineupRow {
  slot: Slot;
  entry: LineupPlayer | null;
  alt: LineupPlayer | null;
  confidence: number;
}

export function buildLineup(u: UniverseState, ids: string[], locked: Partial<Record<string, Slot>> = {}) {
  const pool: LineupPlayer[] = ids
    .map((id) => {
      const player = u.players.get(id);
      const val = u.universe.byId.get(id);
      if (!player || !val) return null;
      return { id, position: player.position, mean: val.week.mean, sd: val.week.sd || 1, player, val };
    })
    .filter(Boolean) as LineupPlayer[];
  const slots = effectiveSlots(u.league);
  const res = optimizeLineup(pool, slots, locked);
  const rows: LineupRow[] = res.starters.map((s) => {
    const alt = bestAlternative(s.slot, res.bench);
    return { slot: s.slot, entry: s.player, alt, confidence: s.player ? startConfidence(s.player, alt) : 0 };
  });
  return { rows, bench: res.bench, total: res.total, floor: rows.reduce((a, r) => a + (r.entry?.val.week.floor ?? 0), 0), ceiling: rows.reduce((a, r) => a + (r.entry?.val.week.ceiling ?? 0), 0) };
}

export function useMyLineup(u: UniverseState | null) {
  return useMemo(() => (u ? buildLineup(u, u.myRoster) : null), [u]);
}
