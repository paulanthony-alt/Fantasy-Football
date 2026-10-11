import { describe, expect, it } from 'vitest';
import { ageCurve, ageRatio, fantasyPoints, positionDemand, scaleValue, valuationConfig, valuePick } from '../valuation';
import { P, clone, data, league, universe } from './fixtures';
import { emptyStats } from '@/data/mock/generate';

describe('scoring', () => {
  const line = { ...emptyStats(), rec: 6, recYds: 80, recTd: 1 };
  it('applies PPR / half / standard', () => {
    expect(fantasyPoints(line, 'WR', { ppr: 1, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 })).toBeCloseTo(20);
    expect(fantasyPoints(line, 'WR', { ppr: 0.5, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 })).toBeCloseTo(17);
    expect(fantasyPoints(line, 'WR', { ppr: 0, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 })).toBeCloseTo(14);
  });
  it('applies TE premium only to tight ends', () => {
    const sc = { ppr: 1 as const, tePremium: 0.5, passTd: 4 as const, passYd: 0.04, int: -2 };
    expect(fantasyPoints(line, 'TE', sc) - fantasyPoints(line, 'WR', sc)).toBeCloseTo(3);
  });
  it('rewards 6-pt passing TDs', () => {
    const qb = { ...emptyStats(), passYds: 250, passTd: 2 };
    const four = fantasyPoints(qb, 'QB', { ppr: 1, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 });
    const six = fantasyPoints(qb, 'QB', { ppr: 1, tePremium: 0, passTd: 6, passYd: 0.04, int: -2 });
    expect(six - four).toBeCloseTo(4);
  });
});

describe('aging curves', () => {
  it('peaks at 1.0 inside the positional window', () => {
    expect(ageCurve('RB', 24)).toBe(1);
    expect(ageCurve('WR', 27)).toBe(1);
    expect(ageCurve('QB', 30)).toBe(1);
  });
  it('declines faster for RBs than WRs and QBs', () => {
    expect(ageCurve('RB', 30)).toBeLessThan(ageCurve('WR', 30));
    expect(ageCurve('WR', 30)).toBeLessThan(ageCurve('QB', 30));
  });
  it('projects growth for young players and decline for veterans', () => {
    expect(ageRatio('WR', 21.5, 3)).toBeGreaterThan(1);
    expect(ageRatio('RB', 29, 2)).toBeLessThan(0.8);
  });
});

describe('scale', () => {
  it('is monotonic and capped', () => {
    const ref = 100;
    const xs = [-50, -10, 0, 10, 50, 100].map((v) => scaleValue(v, ref));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(scaleValue(100, ref)).toBeCloseTo(10000);
    expect(scaleValue(-1000, ref)).toBeGreaterThanOrEqual(0);
  });
});

describe('redraft vs dynasty', () => {
  const u = universe({ mode: 'dynasty' });
  it('aging RBs keep redraft value but lose dynasty value', () => {
    const henry = u.byId.get('derrick-henry')!;
    expect(P('derrick-henry').age).toBeGreaterThan(31);
    expect(henry.redraftValue).toBeGreaterThan(henry.dynastyValue * 1.8);
  });
  it('young high-upside players are worth more in dynasty than redraft', () => {
    const love = u.byId.get('jeremiyah-love')!;
    expect(love.dynastyValue).toBeGreaterThan(love.redraftValue);
  });
  it('ranks by the league mode', () => {
    const dyn = universe({ mode: 'dynasty' });
    const red = universe({ mode: 'redraft' });
    expect(dyn.byId.get('jeremiyah-love')!.overallRank).toBeLessThan(red.byId.get('jeremiyah-love')!.overallRank);
  });
  it('keeper sits between redraft and dynasty for a rookie', () => {
    const k = universe({ mode: 'keeper' }).byId.get('jeremiyah-love')!;
    expect(k.keeperValue).toBeGreaterThanOrEqual(Math.min(k.redraftValue, k.dynastyValue) * 0.95);
  });
  it('rebuilders discount the future less than contenders', () => {
    const rebuild = universe({ mode: 'dynasty', strategy: 'rebuild' }).byId.get('jeremiyah-love')!;
    const winNow = universe({ mode: 'dynasty', strategy: 'win-now' }).byId.get('jeremiyah-love')!;
    expect(rebuild.dynasty.raw).toBeGreaterThan(winNow.dynasty.raw);
  });
});

describe('superflex', () => {
  it('raises QB demand', () => {
    expect(positionDemand(league({ superflex: true })).QB).toBeGreaterThan(positionDemand(league()).QB * 1.8);
  });
  it('lifts QB values relative to other positions', () => {
    const one = universe({ superflex: false });
    const sf = universe({ superflex: true });
    const ratio = (u: typeof one) => u.byId.get('jared-goff')!.redraftValue / u.byId.get('ja-marr-chase')!.redraftValue;
    expect(ratio(sf)).toBeGreaterThan(ratio(one) * 1.5);
    expect(sf.byId.get('jared-goff')!.overallRank).toBeLessThan(one.byId.get('jared-goff')!.overallRank);
  });
  it('treats a second QB slot like superflex', () => {
    const twoQb = positionDemand(league({ slots: { QB: 2, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1 } }));
    expect(twoQb.QB).toBe(24);
  });
});

describe('injured stars', () => {
  const star = P('ja-marr-chase');
  const onIR = clone(star, { id: 'chase-ir', injury: { status: 'IR', risk: 0.2, returnWeek: data.week + 6, detail: 'Hamstring' } });
  const outWeek = clone(star, { id: 'chase-out', injury: { status: 'O', risk: 0.05 } });
  const u = universe({ mode: 'dynasty' }, [...data.players, onIR, outWeek]);
  const healthy = u.byId.get(star.id)!;
  const ir = u.byId.get('chase-ir')!;
  it('loses redraft value proportional to missed time', () => {
    expect(ir.redraftValue).toBeLessThan(healthy.redraftValue * 0.8);
    expect(ir.ros.games).toBeLessThan(healthy.ros.games - 4);
  });
  it('keeps most of its dynasty value', () => {
    expect(ir.dynastyValue / healthy.dynastyValue).toBeGreaterThan(ir.redraftValue / healthy.redraftValue);
    expect(ir.dynastyValue).toBeGreaterThan(healthy.dynastyValue * 0.7);
  });
  it('projects zero this week when ruled out', () => {
    expect(u.byId.get('chase-out')!.week.mean).toBe(0);
  });
  it('handles players with no projection without NaN', () => {
    const ghost = clone(star, { id: 'ghost', projection: emptyStats(), depth: 3 });
    const g = universe({}, [...data.players, ghost]).byId.get('ghost')!;
    expect(Number.isFinite(g.redraftValue)).toBe(true);
    expect(g.redraftValue).toBeLessThan(200);
  });
});

describe('draft picks', () => {
  const base = { teams: 12, superflex: false, nextDraftSeason: 2027 };
  const pick = (round: number, season = 2027, slot?: number) => ({ id: 'x', season, round, originalTeamId: 't', slot });
  it('earlier slots are worth more', () => {
    expect(valuePick(pick(1, 2027, 1), base).dynastyValue).toBeGreaterThan(valuePick(pick(1, 2027, 12), base).dynastyValue);
    expect(valuePick(pick(1, 2027, 12), base).dynastyValue).toBeGreaterThan(valuePick(pick(2, 2027, 1), base).dynastyValue);
  });
  it('uses projected tier when slot is unknown', () => {
    const early = valuePick(pick(1), { ...base, tierHint: 'early' });
    const late = valuePick(pick(1), { ...base, tierHint: 'late' });
    expect(early.dynastyValue).toBeGreaterThan(late.dynastyValue);
    expect(early.label).toContain('Early');
  });
  it('discounts future years', () => {
    expect(valuePick(pick(1, 2028), base).dynastyValue).toBeLessThan(valuePick(pick(1, 2027), base).dynastyValue);
  });
  it('boosts first-rounders in superflex only', () => {
    const r1 = valuePick(pick(1), { ...base, superflex: true }).dynastyValue / valuePick(pick(1), base).dynastyValue;
    const r2 = valuePick(pick(2), { ...base, superflex: true }).dynastyValue / valuePick(pick(2), base).dynastyValue;
    expect(r1).toBeCloseTo(valuationConfig.picks.superflexFirstRoundBoost);
    expect(r2).toBeCloseTo(1);
  });
  it('has no redraft value', () => {
    expect(valuePick(pick(1, 2027, 1), base).redraftValue).toBe(0);
  });
});
