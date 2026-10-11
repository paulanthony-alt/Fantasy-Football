import type { Bet } from '@/data/types';
import { payout } from './odds';

export function betProfit(b: Bet) {
  if (b.result === 'win') return b.units * payout(b.odds);
  if (b.result === 'loss') return -b.units;
  return 0;
}

export interface TrackerStats {
  settled: number;
  pending: number;
  wins: number;
  losses: number;
  pushes: number;
  risked: number;
  profit: number;
  roi: number;
  winRate: number;
  avgOdds: number;
  series: { i: number; t: number; profit: number; label: string }[];
  byType: { type: string; profit: number; count: number }[];
  streak: { kind: 'W' | 'L' | '-'; len: number };
}

export function trackerStats(bets: Bet[]): TrackerStats {
  const sorted = [...bets].sort((a, b) => a.placedAt - b.placedAt);
  const settledBets = sorted.filter((b) => b.result !== 'pending');
  let running = 0;
  const series = [{ i: 0, t: settledBets[0]?.placedAt ?? Date.now(), profit: 0, label: 'Start' }];
  settledBets.forEach((b, i) => {
    running += betProfit(b);
    series.push({ i: i + 1, t: b.placedAt, profit: running, label: b.description });
  });
  const wins = settledBets.filter((b) => b.result === 'win').length;
  const losses = settledBets.filter((b) => b.result === 'loss').length;
  const pushes = settledBets.filter((b) => b.result === 'push').length;
  const risked = settledBets.reduce((a, b) => a + b.units, 0);
  const types = new Map<string, { profit: number; count: number }>();
  settledBets.forEach((b) => {
    const t = types.get(b.type) ?? { profit: 0, count: 0 };
    t.profit += betProfit(b);
    t.count++;
    types.set(b.type, t);
  });
  let streak: TrackerStats['streak'] = { kind: '-', len: 0 };
  for (let i = settledBets.length - 1; i >= 0; i--) {
    const r = settledBets[i].result;
    if (r === 'push') continue;
    const k = r === 'win' ? 'W' : 'L';
    if (streak.kind === '-' || streak.kind === k) streak = { kind: k, len: streak.len + 1 };
    else break;
  }
  return {
    settled: settledBets.length,
    pending: sorted.length - settledBets.length,
    wins, losses, pushes, risked,
    profit: running,
    roi: risked ? running / risked : 0,
    winRate: wins + losses ? wins / (wins + losses) : 0,
    avgOdds: settledBets.length ? Math.round(settledBets.reduce((a, b) => a + b.odds, 0) / settledBets.length) : 0,
    series,
    byType: [...types.entries()].map(([type, v]) => ({ type, ...v })),
    streak,
  };
}
