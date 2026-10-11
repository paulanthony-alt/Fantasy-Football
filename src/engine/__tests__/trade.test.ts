import { describe, expect, it } from 'vitest';
import type { LeagueMode, Strategy, TradeAsset } from '@/data/types';
import { evaluateTrade, consolidate, tradeValue, type TradeEngineInput } from '../trade/evaluate';
import { suggestFairness } from '../trade/suggest';
import { valuationConfig } from '../valuation';
import { STD_SLOTS, data, playersById, rosters, universe } from './fixtures';

const player = (id: string, from: string, to: string): TradeAsset => ({ key: `${from}-${id}`, ref: { kind: 'player', playerId: id }, from, to });

function input(assets: TradeAsset[], mode: LeagueMode = 'redraft', myStrategy: Strategy = 'balanced', superflex = false): TradeEngineInput {
  return {
    mode, superflex, teamsInLeague: 12, slots: STD_SLOTS, season: data.season, myTeamId: 'me', myStrategy,
    teamIds: ['me', 'them'], assets, rosters: rosters(), universe: universe({ mode, superflex, strategy: myStrategy }), players: playersById,
  };
}

describe('trade evaluation', () => {
  it('flags an empty trade as empty/fair', () => {
    const ev = evaluateTrade(input([]));
    expect(ev.empty).toBe(true);
    expect(ev.verdict).toBe('fair');
  });

  it('is zero-sum and symmetric for a 1-for-1', () => {
    const ev = evaluateTrade(input([player('jahmyr-gibbs', 'me', 'them'), player('bijan-robinson', 'them', 'me')]));
    const [a, b] = ev.sides;
    expect(a.net).toBeCloseTo(-b.net, 5);
    expect(['win', 'fair', 'lose']).toContain(ev.verdict);
  });

  it('calls a lopsided trade a loss for the overpaying side', () => {
    const ev = evaluateTrade(input([player('ja-marr-chase', 'me', 'them'), player('tee-higgins', 'them', 'me')]));
    expect(ev.verdict).toBe('lose');
    expect(ev.sides.find((s) => s.teamId === 'them')!.verdict).toBe('win');
    expect(ev.delta).toBeLessThan(0);
  });

  it('applies a consolidation premium in 2-for-1 deals', () => {
    expect(consolidate([5000, 5000])).toBeLessThan(10000);
    expect(consolidate([5000, 5000])).toBeCloseTo(5000 * (1 + valuationConfig.trade.consolidation[1]));
  });

  it('reports starting-lineup impact when rosters are known', () => {
    const ev = evaluateTrade(input([player('derrick-henry', 'me', 'them'), player('puka-nacua', 'them', 'me')]));
    expect(ev.mine.lineup).toBeDefined();
    expect(ev.mine.lineup!.after.total).not.toBeCloseTo(ev.mine.lineup!.before.total, 3);
  });

  it('gives draft picks zero value in redraft but real value in dynasty', () => {
    const pick = rosters()[1].picks[0];
    const assets: TradeAsset[] = [player('chase-brown', 'me', 'them'), { key: 'p', ref: { kind: 'pick', pick }, from: 'them', to: 'me' }];
    const red = evaluateTrade(input(assets, 'redraft'));
    const dyn = evaluateTrade(input(assets, 'dynasty'));
    expect(red.mine.receivedValue).toBe(0);
    expect(dyn.mine.receivedValue).toBeGreaterThan(1000);
  });

  it('rebuilding teams value picks and youth more than contenders', () => {
    const pick = rosters()[1].picks[0];
    const assets: TradeAsset[] = [player('derrick-henry', 'me', 'them'), { key: 'p', ref: { kind: 'pick', pick }, from: 'them', to: 'me' }];
    const rebuild = evaluateTrade(input(assets, 'dynasty', 'rebuild'));
    const winNow = evaluateTrade(input(assets, 'dynasty', 'win-now'));
    expect(rebuild.fairness).toBeGreaterThan(winNow.fairness);
  });

  it('blends redraft and dynasty values by strategy', () => {
    const a = { kind: 'player' as const, redraft: 8000, dynasty: 2000, keeper: 5000 };
    expect(tradeValue(a, 'dynasty', 'win-now')).toBeGreaterThan(tradeValue(a, 'dynasty', 'rebuild'));
    expect(tradeValue(a, 'redraft', 'rebuild')).toBe(8000);
  });

  it('values superflex QBs higher in trades', () => {
    const assets = [player('josh-allen', 'me', 'them'), player('puka-nacua', 'them', 'me')];
    const one = evaluateTrade(input(assets, 'dynasty', 'balanced', false));
    const sf = evaluateTrade(input(assets, 'dynasty', 'balanced', true));
    expect(sf.fairness).toBeLessThan(one.fairness);
  });

  it('builds a timeline with short and long horizons', () => {
    const ev = evaluateTrade(input([player('derrick-henry', 'me', 'them'), player('jeremiyah-love', 'them', 'me')], 'dynasty'));
    expect(ev.timeline.map((t) => t.key)).toEqual(['week', 'month', 'ros', 'y1', 'y2']);
    const mine = ev.timeline.map((t) => t.values.me);
    // Young back gains relative value as the horizon extends
    expect(mine[4]).toBeGreaterThan(mine[0]);
  });

  it('supports three-team trades', () => {
    const rs = [...rosters(), { id: 'third', name: 'Third', owner: 'x', playerIds: ['ceedee-lamb'], picks: [] }];
    const ev = evaluateTrade({
      ...input([player('ja-marr-chase', 'me', 'them'), player('bijan-robinson', 'them', 'third'), player('ceedee-lamb', 'third', 'me')]),
      teamIds: ['me', 'them', 'third'],
      rosters: rs,
    });
    expect(ev.sides).toHaveLength(3);
    expect(ev.sides.reduce((a, s) => a + s.receives.length, 0)).toBe(3);
  });
});

describe('fairness suggester', () => {
  it('proposes assets that bring a lopsided deal into the fair band', () => {
    const i = input([player('ja-marr-chase', 'me', 'them'), player('tee-higgins', 'them', 'me')], 'redraft');
    const ev = evaluateTrade(i);
    const sugg = suggestFairness(i, ev);
    expect(sugg.length).toBeGreaterThan(0);
    for (const s of sugg) expect(Math.abs(s.fairnessAfter)).toBeLessThanOrEqual(valuationConfig.trade.fairBand * 1.5);
    expect(sugg[0].asset.from).toBe('them');
  });
  it('returns nothing for an already-fair trade', () => {
    const i = input([player('ja-marr-chase', 'me', 'them'), player('ja-marr-chase', 'them', 'me')]);
    const ev = evaluateTrade(i);
    expect(ev.verdict).toBe('fair');
    expect(suggestFairness(i, ev)).toEqual([]);
  });
});
