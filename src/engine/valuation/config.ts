/**
 * Every tunable number in the valuation engine lives here.
 * Change a value, run `npm test`, and the whole app re-prices.
 */
import type { InjuryStatus, SkillPosition, Strategy } from '@/data/types';

export const VALUE_SCALE_MAX = 10_000;

export const valuationConfig = {
  /** Share of each FLEX slot typically filled by a position. */
  flexShare: { QB: 0, RB: 0.42, WR: 0.48, TE: 0.1 } as Record<SkillPosition, number>,
  /** Share of each SUPERFLEX slot typically filled by a position. */
  superflexShare: { QB: 0.9, RB: 0.04, WR: 0.05, TE: 0.01 } as Record<SkillPosition, number>,
  /** Bench depth adds a fraction of a starter's worth of demand per team per position. */
  benchDemand: { QB: 0.35, RB: 1.0, WR: 1.1, TE: 0.3, K: 0, DST: 0 } as Record<string, number>,

  matchup: { toughest: 0.84, softest: 1.16 },
  fantasyPlayoffWeeks: [15, 16, 17],
  lastFantasyWeek: 17,
  gamesPerSeason: 17,

  /** Expected availability this week by designation. */
  availabilityThisWeek: { HEALTHY: 1, Q: 0.82, D: 0.25, O: 0, IR: 0, PUP: 0, SUS: 0 } as Record<InjuryStatus, number>,
  /** Weeks assumed missed when no return week is given. */
  defaultWeeksOut: { HEALTHY: 0, Q: 0, D: 1, O: 1, IR: 4, PUP: 4, SUS: 2 } as Record<InjuryStatus, number>,
  /** Value haircut per unit of ongoing injury risk (volatility, not missed games). */
  riskHaircut: 0.35,

  /** Week-level standard deviation as a fraction of the mean, by position. */
  weeklySd: { QB: 0.3, RB: 0.46, WR: 0.5, TE: 0.56, K: 0.38, DST: 0.6 } as Record<string, number>,

  /** Market-scale curve: value = floor·e^(v/(soft·ref)) for v ≤ 0, else floor + (max−floor)(v/ref)^exp */
  scale: { exponent: 0.8, floor: 120, softness: 0.15 },

  redraft: {
    playoffBoost: { 'win-now': 0.25, balanced: 0.5, rebuild: 0.9 } as Record<Strategy, number>,
    nearTermBoost: { 'win-now': 0.3, balanced: 0.1, rebuild: 0 } as Record<Strategy, number>,
    nearTermWeeks: 3,
  },

  dynasty: {
    years: 5,
    /** Weight of the (partial) current season inside the dynasty sum. */
    currentSeasonWeight: 0.7,
    discount: { 'win-now': 0.55, balanced: 0.75, rebuild: 0.9 } as Record<Strategy, number>,
    /** Haircut once a player's contract expires (relocation / role risk). */
    postContractFactor: 0.94,
    /** Backup → starter role growth per year for players under the youth age. */
    roleGrowthPerYear: 0.22,
    youthAge: 26,
    backupStarterMultiplier: 1.6,
    /** Draft-capital premium for players in their first two seasons. */
    draftCapitalPremium: { 1: 0.1, 2: 0.05, 3: 0.02 } as Record<number, number>,
  },

  keeper: { nextSeasonWeight: 0.6 },

  picks: {
    /** slotValue(n) = top·e^(−decay·(n−1)) + floor, n = overall pick number. */
    top: 7600,
    decay: 0.055,
    floor: 150,
    futureDiscount: 0.88,
    superflexFirstRoundBoost: 1.1,
    projectedSlotFraction: { early: 0.2, mid: 0.5, late: 0.83 },
    keeperFactor: 0.45,
  },

  trade: {
    /** |fairness| at or below this is a fair trade. */
    fairBand: 0.06,
    /** Value weight by asset rank within a side (consolidation premium). */
    consolidation: [1, 0.88, 0.78, 0.7, 0.64, 0.6, 0.56, 0.53],
    /** Dynasty trade value = w·redraft + (1−w)·dynasty. */
    dynastyRedraftBlend: { 'win-now': 0.45, balanced: 0.25, rebuild: 0.1 } as Record<Strategy, number>,
  },

  tiers: [8000, 6200, 4600, 3200, 2000, 1000, 400],
};

export type ValuationConfig = typeof valuationConfig;

/* ───── Positional aging curves: [age, multiplier-of-peak] knots, linear in between ───── */
export const agingCurves: Record<SkillPosition | 'K' | 'DST', [number, number][]> = {
  RB: [[20, 0.82], [21, 0.88], [22, 0.95], [23, 1], [26, 1], [27, 0.93], [28, 0.85], [29, 0.76], [30, 0.66], [31, 0.55], [32, 0.45], [33, 0.35], [35, 0.2]],
  WR: [[20, 0.76], [21, 0.82], [22, 0.88], [23, 0.93], [24, 0.97], [25, 1], [28, 1], [29, 0.95], [30, 0.89], [31, 0.82], [32, 0.74], [33, 0.65], [34, 0.55], [35, 0.45], [37, 0.3]],
  TE: [[21, 0.66], [22, 0.72], [23, 0.8], [24, 0.87], [25, 0.94], [26, 1], [29, 1], [30, 0.95], [31, 0.89], [32, 0.82], [33, 0.74], [34, 0.65], [35, 0.55], [36, 0.46], [37, 0.38], [39, 0.25]],
  QB: [[21, 0.74], [22, 0.78], [23, 0.83], [24, 0.88], [25, 0.93], [26, 0.97], [27, 1], [33, 1], [34, 0.96], [35, 0.92], [36, 0.87], [37, 0.8], [38, 0.72], [39, 0.63], [40, 0.53], [41, 0.43], [42, 0.34], [44, 0.2]],
  K: [[20, 1], [38, 1], [42, 0.8], [45, 0.5]],
  DST: [[0, 1], [100, 1]],
};

/** Peak window for UI indicators. */
export const peakWindow: Record<string, [number, number]> = {
  QB: [27, 33], RB: [23, 26], WR: [25, 28], TE: [26, 29], K: [24, 38], DST: [0, 100],
};
