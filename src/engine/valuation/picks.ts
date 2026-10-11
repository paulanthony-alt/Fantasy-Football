/**
 * Draft pick valuation.
 * value = (top·e^(−decay·(n−1)) + floor) × futureDiscount^(yearsOut) × SF boost
 */
import type { DraftPick, LeagueMode } from '@/data/types';
import { valuationConfig as cfg } from './config';
import { ordinal } from '@/lib/format';

export type PickTier = 'early' | 'mid' | 'late';

export interface PickValuation {
  dynastyValue: number;
  redraftValue: number;
  keeperValue: number;
  projectedSlot: number;
  overall: number;
  tier: PickTier;
  label: string;
  shortLabel: string;
  yearsOut: number;
}

export function slotValue(overall: number) {
  const p = cfg.picks;
  return p.top * Math.exp(-p.decay * (overall - 1)) + p.floor;
}

export function projectedSlot(pick: DraftPick, teams: number, tierHint?: PickTier): { slot: number; tier: PickTier } {
  if (pick.slot) {
    const f = pick.slot / teams;
    return { slot: pick.slot, tier: f <= 0.34 ? 'early' : f <= 0.67 ? 'mid' : 'late' };
  }
  const tier = pick.projected ?? tierHint ?? 'mid';
  return { slot: Math.max(1, Math.round(teams * cfg.picks.projectedSlotFraction[tier])), tier };
}

/**
 * @param nextDraftSeason the season of the upcoming rookie draft (e.g. 2027 during the 2026 season)
 * @param tierHint projected finish of the original owner (applies to the next draft only)
 */
export function valuePick(pick: DraftPick, opts: { teams: number; superflex: boolean; nextDraftSeason: number; tierHint?: PickTier }): PickValuation {
  const yearsOut = Math.max(0, pick.season - opts.nextDraftSeason);
  const hint = yearsOut === 0 ? opts.tierHint : undefined;
  const { slot, tier } = projectedSlot(pick, opts.teams, hint);
  const overall = (pick.round - 1) * opts.teams + slot;
  let v = slotValue(overall) * cfg.picks.futureDiscount ** yearsOut;
  // Future picks regress toward the mid-round value (uncertainty about the slot)
  if (yearsOut > 0 && !pick.slot) {
    const mid = slotValue((pick.round - 1) * opts.teams + Math.round(opts.teams / 2)) * cfg.picks.futureDiscount ** yearsOut;
    v = (v + mid) / 2;
  }
  if (opts.superflex && pick.round === 1) v *= cfg.picks.superflexFirstRoundBoost;
  const roundName = ordinal(pick.round);
  const tierName = tier[0].toUpperCase() + tier.slice(1);
  const label = pick.slot ? `${pick.season} Pick ${pick.round}.${String(pick.slot).padStart(2, '0')}` : `${pick.season} ${tierName} ${roundName}`;
  return {
    dynastyValue: v,
    redraftValue: 0,
    keeperValue: v * cfg.picks.keeperFactor,
    projectedSlot: slot,
    overall,
    tier,
    label,
    shortLabel: pick.slot ? `${pick.round}.${String(pick.slot).padStart(2, '0')}` : `${String(pick.season).slice(2)} ${roundName}`,
    yearsOut,
  };
}

export function pickModeValue(v: PickValuation, mode: LeagueMode) {
  return mode === 'redraft' ? v.redraftValue : mode === 'keeper' ? v.keeperValue : v.dynastyValue;
}
