import type { Position, ScoringSettings, StatLine } from '@/data/types';

export const DEFAULT_SCORING: ScoringSettings = { ppr: 0.5, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 };

/** Fantasy points for a stat line under league scoring. */
export function fantasyPoints(s: StatLine, pos: Position, sc: ScoringSettings): number {
  if (pos === 'K') return s.kPts ?? 0;
  if (pos === 'DST') return s.dstPts ?? 0;
  const recPts = sc.ppr + (pos === 'TE' ? sc.tePremium : 0);
  return (
    s.passYds * sc.passYd +
    s.passTd * sc.passTd +
    s.int * sc.int +
    s.rushYds * 0.1 +
    s.rushTd * 6 +
    s.rec * recPts +
    s.recYds * 0.1 +
    s.recTd * 6 -
    s.fumLost * 2
  );
}

export function scoringLabel(sc: ScoringSettings) {
  const base = sc.ppr === 1 ? 'PPR' : sc.ppr === 0.5 ? 'Half PPR' : 'Standard';
  const extras = [sc.tePremium > 0 ? `TE+${sc.tePremium}` : '', sc.passTd !== 4 ? `${sc.passTd}pt PaTD` : ''].filter(Boolean);
  return [base, ...extras].join(' · ');
}
