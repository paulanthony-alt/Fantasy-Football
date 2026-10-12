import type { GameLog, Player } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card } from '@/components/ui/card';
import { CardSkeleton, EmptyState } from '@/components/common/states';
import { logPoints } from '@/lib/stats';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CalendarX } from 'lucide-react';

type Col = [label: string, get: (l: GameLog) => string | number];

export function GameLogTab({ u, p, logs, loading }: { u: UniverseState; p: Player; logs: GameLog[]; loading: boolean }) {
  if (loading) return <Card><CardSkeleton rows={6} /></Card>;
  if (!logs.length) return <Card><EmptyState icon={<CalendarX />} title="No games logged" description="This player hasn't appeared in a game this season." /></Card>;
  const cols: Col[] =
    p.position === 'QB'
      ? [['Cmp/Att', (l) => `${l.stats.passCmp}/${l.stats.passAtt}`], ['Pass yds', (l) => l.stats.passYds], ['TD', (l) => l.stats.passTd], ['INT', (l) => l.stats.int], ['Rush', (l) => `${l.stats.rushAtt}-${l.stats.rushYds}`], ['Rush TD', (l) => l.stats.rushTd]]
      : p.position === 'K' || p.position === 'DST'
        ? []
        : [['Snap %', (l) => fmt.pct(l.snapPct)], ['Att', (l) => l.stats.rushAtt], ['Rush yds', (l) => l.stats.rushYds], ['Tgt', (l) => l.stats.targets], ['Rec', (l) => l.stats.rec], ['Rec yds', (l) => l.stats.recYds], ['Air yds', (l) => l.airYards], ['RZ', (l) => l.redZoneTouches], ['TD', (l) => l.stats.rushTd + l.stats.recTd]];
  const v = u.universe.byId.get(p.id)!;
  const rows = [...logs].reverse();
  return (
    <Card className="overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr className="text-2xs uppercase tracking-[0.06em] text-fg-subtle">
              <th className="sticky left-0 bg-surface-2 px-4 py-2.5 text-left font-semibold">Week</th>
              <th className="px-3 py-2.5 text-left font-semibold">Opp</th>
              <th className="px-3 py-2.5 text-left font-semibold">Result</th>
              {cols.map(([c]) => <th key={c} className="px-3 py-2.5 text-right font-semibold">{c}</th>)}
              <th className="px-3 py-2.5 text-right font-semibold">Proj</th>
              <th className="px-4 py-2.5 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const pts = logPoints(l, p.position, u.league.scoring);
              const proj = v.ppg * l.projectedFactor;
              const won = l.teamScore > l.oppScore;
              return (
                <tr key={l.week} className="border-t border-border/70 hover:bg-surface-2/60">
                  <td className="num sticky left-0 bg-surface-1 px-4 py-2.5 font-semibold">{l.week}</td>
                  <td className="px-3 py-2.5 text-xs"><span className="text-fg-subtle">{l.home ? 'vs' : '@'}</span> <span className="font-semibold">{l.opponent}</span> <span className={cn('ml-1', l.oppRankVsPos >= 22 ? 'text-pos' : l.oppRankVsPos <= 10 ? 'text-neg' : 'text-fg-subtle')}>({l.oppRankVsPos})</span></td>
                  <td className="num px-3 py-2.5 text-xs">{l.teamScore || l.oppScore ? <><span className={won ? 'text-pos' : 'text-neg'}>{won ? 'W' : 'L'}</span> {l.teamScore}–{l.oppScore}</> : '—'}</td>
                  {cols.map(([c, f]) => <td key={c} className="num px-3 py-2.5 text-right">{f(l)}</td>)}
                  <td className="num px-3 py-2.5 text-right text-fg-subtle">{fmt.num(proj)}</td>
                  <td className="num px-4 py-2.5 text-right"><span className={cn('inline-block min-w-12 rounded px-1.5 py-0.5 font-semibold', pts >= proj * 1.2 ? 'bg-pos/12 text-pos' : pts <= proj * 0.7 ? 'bg-neg/12 text-neg' : 'text-fg')}>{fmt.num(pts)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
