import type { GameLog, Position, ScoringSettings } from '@/data/types';
import { fantasyPoints } from '@/engine/valuation/scoring';
import { mean } from './utils';

export function logPoints(log: GameLog, pos: Position, sc: ScoringSettings) {
  return fantasyPoints(log.stats, pos, sc);
}

export function recentTrend(logs: GameLog[], pos: Position, sc: ScoringSettings, n = 3) {
  const pts = logs.map((l) => logPoints(l, pos, sc));
  const season = mean(pts);
  const recent = mean(pts.slice(-n));
  return { season, recent, delta: logs.length >= 2 ? recent - season : 0, series: pts };
}

export function totals(logs: GameLog[]) {
  const t = { games: logs.length, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, int: 0, rushAtt: 0, rushYds: 0, rushTd: 0, targets: 0, rec: 0, recYds: 0, recTd: 0, airYards: 0, routes: 0, rz: 0, snaps: 0 };
  for (const l of logs) {
    const s = l.stats;
    t.passAtt += s.passAtt; t.passCmp += s.passCmp; t.passYds += s.passYds; t.passTd += s.passTd; t.int += s.int;
    t.rushAtt += s.rushAtt; t.rushYds += s.rushYds; t.rushTd += s.rushTd;
    t.targets += s.targets; t.rec += s.rec; t.recYds += s.recYds; t.recTd += s.recTd;
    t.airYards += l.airYards; t.routes += l.routes; t.rz += l.redZoneTouches; t.snaps += l.snapPct;
  }
  return t;
}

export const kickoffLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

export function impliedTotals(spread: number, total: number) {
  // spread is home line; home implied = total/2 − spread/2
  return { home: total / 2 - spread / 2, away: total / 2 + spread / 2 };
}
