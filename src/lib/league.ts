import type { League, LeagueMode, Strategy } from '@/data/types';
import { scoringLabel } from '@/engine/valuation/scoring';

export const MODE_LABEL: Record<LeagueMode, string> = { redraft: 'Redraft', dynasty: 'Dynasty', keeper: 'Keeper' };
export const STRATEGY_LABEL: Record<Strategy, string> = { 'win-now': 'Win now', balanced: 'Balanced', rebuild: 'Rebuild' };

export function leagueFormat(l: Pick<League, 'teams' | 'superflex' | 'scoring' | 'slots'>) {
  const qb = l.slots.QB >= 2 ? '2QB' : l.superflex ? 'Superflex' : '1QB';
  return `${l.teams}-team · ${qb} · ${scoringLabel(l.scoring)}`;
}

/** Superflex toggle sets the slot; a 2QB league keeps two QB slots. */
export function applySuperflex<T extends Pick<League, 'slots' | 'superflex'>>(l: T, on: boolean): T {
  const slots = { ...l.slots };
  if (on && slots.SUPERFLEX === 0 && slots.QB < 2) slots.SUPERFLEX = 1;
  if (!on) {
    slots.SUPERFLEX = 0;
    if (slots.QB > 1) slots.QB = 1;
  }
  return { ...l, superflex: on, slots };
}
