import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, Hourglass, TrendingUp } from 'lucide-react';
import type { Player } from '@/data/types';
import type { PlayerValuation } from '@/engine/valuation';
import { ageCurve, valuationConfig } from '@/engine/valuation';
import { peakWindow } from '@/engine/valuation/config';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Tooltip as UiTooltip } from '@/components/ui/tooltip';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

export function OutlookTab({ u, p, v }: { u: UniverseState; p: Player; v: PlayerValuation }) {
  const t = useChartTheme();
  const repl = u.universe.replacement.season[p.position] ?? 0;
  const years = useMemo(() => v.dynasty.seasonPoints.map((pts, y) => ({ season: String(u.core.season + y), 'Projected points': y === 0 ? v.dynasty.ppgByYear[0] * valuationConfig.gamesPerSeason * v.dynasty.survival[0] : pts })), [v, u.core.season]);
  const curve = useMemo(() => Array.from({ length: 19 }, (_, i) => ({ age: 21 + i, Curve: ageCurve(p.position, 21 + i) * 100 })), [p.position]);
  const [lo, hi] = peakWindow[p.position];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader icon={<CalendarRange />} title="Rest-of-season schedule" subtitle={`Matchup heat by week · playoff weeks ${valuationConfig.fantasyPlayoffWeeks.join(', ')} highlighted`} />
        <CardBody>
          <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {v.ros.weeks.map((w) => {
              const rank = w.matchupRank;
              const heat = rank == null ? 'bg-surface-2 text-fg-subtle' : rank >= 25 ? 'bg-pos/25 text-fg' : rank >= 19 ? 'bg-pos/12 text-fg' : rank >= 14 ? 'bg-surface-3 text-fg' : rank >= 8 ? 'bg-neg/12 text-fg' : 'bg-neg/25 text-fg';
              const playoff = valuationConfig.fantasyPlayoffWeeks.includes(w.week);
              return (
                <UiTooltip key={w.week} content={w.opp ? `Week ${w.week}: ${w.home ? 'vs' : '@'} ${w.opp} · rank ${rank ?? '—'} vs ${p.position} · ${fmt.num(w.points)} proj` : `Week ${w.week}: bye`}>
                  <div className={cn('flex w-[68px] shrink-0 flex-col items-center rounded-md py-2 text-center', heat, playoff && 'ring-1 ring-accent')}>
                    <span className="text-2xs text-fg-subtle">Wk {w.week}</span>
                    <span className="text-sm font-semibold">{w.opp ? `${w.home ? '' : '@'}${w.opp}` : 'BYE'}</span>
                    <span className="num text-2xs text-fg-muted">{w.opp ? fmt.num(w.points) : '—'}</span>
                  </div>
                </UiTooltip>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-2xs text-fg-subtle">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-neg/25" /> Tough</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-surface-3" /> Neutral</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-pos/25" /> Soft</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm ring-1 ring-accent" /> Fantasy playoffs</span>
            <span className="ml-auto num">Playoff projection: <b className="text-fg">{fmt.num(v.ros.playoffPoints)} pts</b></span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<TrendingUp />} title="Dynasty outlook" subtitle="Projected full-season points, next five seasons" />
        <CardBody>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <AreaChart data={years} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="dyn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.accent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={t.accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="season" {...axisProps(t)} />
                <YAxis {...axisProps(t)} axisLine={false} />
                <ReferenceLine y={repl} stroke={t.textMuted} strokeDasharray="4 4" label={{ value: 'Replacement', position: 'insideBottomRight', fill: t.textMuted, fontSize: 10 }} />
                <Tooltip content={<ChartTooltip format={(x) => `${x.toFixed(0)} pts`} />} />
                <Area dataKey="Projected points" stroke={t.accent} strokeWidth={2} fill="url(#dyn)" dot={{ r: 3, fill: t.accent, strokeWidth: 0 }} animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<Hourglass />} title="Aging curve" subtitle={`${p.position} production vs peak · prime ${lo}–${hi}`} />
        <CardBody>
          {p.position === 'DST' ? <p className="text-sm text-fg-subtle">Team defenses don't age.</p> : (
            <div className="h-[220px]">
              <ResponsiveContainer>
                <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} />
                  <ReferenceArea x1={lo} x2={hi} fill={t.accent} fillOpacity={0.08} />
                  <XAxis dataKey="age" type="number" domain={[21, 39]} {...axisProps(t)} tickCount={10} />
                  <YAxis {...axisProps(t)} axisLine={false} domain={[0, 105]} tickFormatter={(x) => `${x}%`} />
                  <Tooltip content={<ChartTooltip labelFormat={(l) => `Age ${l}`} format={(x) => `${x.toFixed(0)}% of peak`} />} />
                  <Line dataKey="Curve" stroke={t.textMuted} strokeWidth={2} dot={false} animationDuration={600} />
                  <ReferenceDot x={Math.min(39, p.age)} y={ageCurve(p.position, p.age) * 100} r={6} fill={t.accent} stroke={t.surface} strokeWidth={2} label={{ value: p.name.split(' ').slice(-1)[0], position: 'top', fill: t.text, fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
