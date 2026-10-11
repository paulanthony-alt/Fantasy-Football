import { describe, expect, it } from 'vitest';
import { bestAlternative, optimizeLineup, startConfidence, type LineupCandidate } from '../lineup/optimizer';
import { americanFromProb, impliedProb, kellyUnits, noVig, payout } from '../betting/odds';
import { trackerStats } from '../betting/tracker';
import { STD_SLOTS } from './fixtures';

const c = (id: string, position: LineupCandidate['position'], mean: number, sd = 5): LineupCandidate => ({ id, position, mean, sd });

describe('lineup optimizer', () => {
  const pool = [c('qb1', 'QB', 22), c('qb2', 'QB', 18), c('rb1', 'RB', 16), c('rb2', 'RB', 12), c('rb3', 'RB', 11), c('wr1', 'WR', 15), c('wr2', 'WR', 13), c('wr3', 'WR', 10.5), c('te1', 'TE', 9), c('k', 'K', 8), c('d', 'DST', 7)];
  it('fills dedicated slots then flex with the best remaining', () => {
    const r = optimizeLineup(pool, STD_SLOTS);
    const flex = r.starters.find((s) => s.slot === 'FLEX')!;
    expect(flex.player!.id).toBe('rb3');
    expect(r.bench.map((b) => b.id)).toEqual(['qb2', 'wr3']);
  });
  it('starts a second QB in superflex', () => {
    const r = optimizeLineup(pool, { ...STD_SLOTS, SUPERFLEX: 1 });
    expect(r.starters.find((s) => s.slot === 'SUPERFLEX')!.player!.id).toBe('qb2');
  });
  it('leaves empty slots when the roster is short', () => {
    const r = optimizeLineup([c('qb1', 'QB', 20)], STD_SLOTS);
    expect(r.starters.filter((s) => !s.player)).toHaveLength(8);
    expect(r.total).toBe(20);
  });
  it('produces 50–99 confidence and finds alternatives', () => {
    const alt = bestAlternative('WR', [c('wr3', 'WR', 10.5), c('qb2', 'QB', 18)]);
    expect(alt!.id).toBe('wr3');
    expect(startConfidence(c('a', 'WR', 15), alt)).toBeGreaterThan(50);
    expect(startConfidence(c('a', 'WR', 10.5), c('b', 'WR', 10.5))).toBe(50);
    expect(startConfidence(c('a', 'WR', 30, 1), c('b', 'WR', 1, 1))).toBe(99);
  });
});

describe('odds math', () => {
  it('converts American odds', () => {
    expect(impliedProb(-110)).toBeCloseTo(0.5238, 3);
    expect(impliedProb(150)).toBeCloseTo(0.4);
    expect(payout(-110)).toBeCloseTo(0.909, 2);
    expect(payout(200)).toBe(2);
  });
  it('removes the vig', () => {
    const [a, b] = noVig(-110, -110);
    expect(a + b).toBeCloseTo(1);
    expect(a).toBeCloseTo(0.5);
  });
  it('round-trips probability to odds', () => {
    expect(impliedProb(americanFromProb(0.6))).toBeCloseTo(0.6, 1);
  });
  it('only stakes positive-EV bets', () => {
    expect(kellyUnits(0.5, -110)).toBe(0);
    expect(kellyUnits(0.58, -110)).toBeGreaterThan(0);
  });
});

describe('bet tracker', () => {
  it('computes ROI, win rate and streaks', () => {
    const s = trackerStats([
      { id: '1', placedAt: 1, type: 'spread', description: 'a', odds: -110, units: 1, result: 'win', book: 'x' },
      { id: '2', placedAt: 2, type: 'spread', description: 'b', odds: -110, units: 1, result: 'loss', book: 'x' },
      { id: '3', placedAt: 3, type: 'prop', description: 'c', odds: 150, units: 2, result: 'win', book: 'x' },
      { id: '4', placedAt: 4, type: 'total', description: 'd', odds: -110, units: 1, result: 'pending', book: 'x' },
    ]);
    expect(s.settled).toBe(3);
    expect(s.pending).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.profit).toBeCloseTo(0.909 - 1 + 3, 2);
    expect(s.roi).toBeCloseTo(s.profit / 4);
    expect(s.streak).toEqual({ kind: 'W', len: 1 });
  });
});
