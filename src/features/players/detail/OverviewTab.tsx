import { useMemo } from 'react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BarChart3, Crosshair, Radar as RadarIcon, Sigma } from 'lucide-react';
import type { GameLog, Player } from '@/data/types';
import type { PlayerValuation } from '@/engine/valuation';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CardSkeleton, EmptyState } from '@/components/common/states';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { logPoints, totals } from '@/lib/stats';
import { fmt } from '@/lib/format';
import { clamp, normCdf } from '@/lib/utils';

export function OverviewTab({ u, p, v, logs, loading }: { u: UniverseState; p: Player; v: PlayerValuation; logs: GameLog[]; loading: boolean }) {
  const t = useChartTheme();
  const sc = u.league.scoring;
  const weekly = useMemo(() => logs.map((l) => ({ week: `W${l.week}`, Actual: logPoints(l, p.position, sc), Projected: v.ppg * l.projectedFactor, opp: l.opponent })), [logs, p.position, sc, v.ppg]);
  const usage = useMemo(() => logs.map((l) => ({ week: `W${l.week}`, 'Snap %': l.snapPct * 100, 'Target share': (l.stats.targets / 34) * 100 })), [logs]);
  const beat = weekly.filter((w) => w.Actual >= w.Projected).length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader icon={<BarChart3 />} title="Production vs projection" subtitle={logs.length ? `Beat projection in ${beat} of ${logs.length} games` : 'No games played yet'} />
        <CardBody>
          {loading ? <CardSkeleton rows={4} /> : logs.length === 0 ? <EmptyState title="No game logs yet" description="Logs appear after this player's first game." /> : (
            <div className="h-[260px]">
              <ResponsiveContainer>
                <ComposedChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} strokeDasharray="0" />
                  <XAxis dataKey="week" {...axisProps(t)} />
                  <YAxis {...axisProps(t)} axisLine={false} />
                  <Tooltip content={<ChartTooltip labelFormat={(l) => `${l} · ${weekly.find((w) => w.week === l)?.opp ?? ''}`} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.textMuted }} />
                  <Bar dataKey="Actual" fill={t.accent} radius={[4, 4, 0, 0]} maxBarSize={34} animationDuration={600} />
                  <Line dataKey="Projected" stroke={t.textMuted} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: t.surface, strokeWidth: 2 }} animationDuration={600} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <Distribution v={v} week={u.core.week} />

      {p.position !== 'K' && p.position !== 'DST' && (
        <>
          <Card className="lg:col-span-2">
            <CardHeader icon={<Activity />} title="Usage trend" subtitle="Snap share and target share by week" />
            <CardBody>
              {logs.length === 0 ? <EmptyState title="No usage data yet" /> : (
                <div className="h-[220px]">
                  <ResponsiveContainer>
                    <LineChart data={usage} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="week" {...axisProps(t)} />
                      <YAxis {...axisProps(t)} axisLine={false} domain={[0, 100]} tickFormatter={(x) => `${x}%`} />
                      <Tooltip content={<ChartTooltip format={(x) => `${x.toFixed(0)}%`} />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Line dataKey="Snap %" stroke={t.series[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: t.series[0] }} animationDuration={600} />
                      <Line dataKey="Target share" stroke={t.series[1]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: t.series[1] }} animationDuration={600} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>
          <ProfileRadar u={u} p={p} />
          <Efficiency p={p} logs={logs} className="lg:col-span-3" />
        </>
      )}
    </div>
  );
}

function Distribution({ v, week }: { v: PlayerValuation; week: number }) {
  const t = useChartTheme();
  const { mean, sd } = v.week;
  const data = useMemo(() => {
    if (!sd) return [];
    const lo = Math.max(0, mean - 3 * sd);
    const hi = mean + 3 * sd;
    return Array.from({ length: 61 }, (_, i) => {
      const x = lo + ((hi - lo) * i) / 60;
      return { x: Math.round(x * 10) / 10, density: Math.exp(-((x - mean) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI)) };
    });
  }, [mean, sd]);
  const p15 = sd ? 1 - normCdf((15 - mean) / sd) : 0;
  return (
    <Card>
      <CardHeader icon={<Sigma />} title={`Week ${week} distribution`} subtitle={v.week.bye ? 'On bye' : `${v.week.home ? 'vs' : '@'} ${v.week.opp} · matchup rank ${v.week.matchupRank ?? '—'}`} />
      <CardBody>
        {v.week.bye || !sd ? <EmptyState icon={<Crosshair />} title={v.week.bye ? 'Bye week' : 'Not expected to play'} /> : (
          <>
            <div className="h-[170px]">
              <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="dist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={t.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...axisProps(t)} tickCount={6} tickFormatter={(x) => x.toFixed(0)} />
                  <YAxis hide />
                  <ReferenceLine x={v.week.floor} stroke={t.textMuted} strokeDasharray="3 3" label={{ value: 'Floor', fill: t.textMuted, fontSize: 10, position: 'insideTopLeft' }} />
                  <ReferenceLine x={mean} stroke={t.accent} label={{ value: 'Median', fill: t.accent, fontSize: 10, position: 'top' }} />
                  <ReferenceLine x={v.week.ceiling} stroke={t.textMuted} strokeDasharray="3 3" label={{ value: 'Ceiling', fill: t.textMuted, fontSize: 10, position: 'insideTopRight' }} />
                  <Area dataKey="density" type="monotone" stroke={t.accent} strokeWidth={2} fill="url(#dist)" isAnimationActive animationDuration={600} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[['Floor', fmt.num(v.week.floor)], ['Median', fmt.num(mean)], ['Ceiling', fmt.num(v.week.ceiling)], ['P(15+)', fmt.pct(p15)]].map(([l, x]) => (
                <div key={l} className="rounded-md bg-surface-2 py-2">
                  <div className="text-2xs text-fg-subtle">{l}</div>
                  <div className="num text-sm font-semibold">{x}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function percentile(values: number[], x: number) {
  const below = values.filter((v) => v < x).length;
  return Math.round((below / Math.max(1, values.length - 1)) * 100);
}

function ProfileRadar({ u, p }: { u: UniverseState; p: Player }) {
  const t = useChartTheme();
  const data = useMemo(() => {
    const peers = u.core.players.filter((x) => x.position === p.position && x.depth === 1);
    const pr = (x: Player) => x.projection;
    const m = {
      Volume: (x: Player) => pr(x).targets + pr(x).rushAtt + pr(x).passAtt * 0.25,
      Efficiency: (x: Player) => (pr(x).recYds + pr(x).rushYds + pr(x).passYds * 0.2) / Math.max(1, pr(x).targets + pr(x).rushAtt + pr(x).passAtt * 0.25),
      Scoring: (x: Player) => pr(x).recTd + pr(x).rushTd + pr(x).passTd * 0.4,
      Role: (x: Player) => x.usage.snapPct,
      'Big play': (x: Player) => (x.position === 'RB' ? pr(x).rushYds / Math.max(1, pr(x).rushAtt) : x.position === 'QB' ? pr(x).passYds / Math.max(1, pr(x).passAtt) : x.usage.aDot),
      'Red zone': (x: Player) => x.usage.redZoneShare,
    };
    return Object.entries(m).map(([k, f]) => ({ metric: k, pct: clamp(percentile(peers.map(f), f(p)), 0, 100) }));
  }, [u, p]);
  return (
    <Card>
      <CardHeader icon={<RadarIcon />} title="Profile" subtitle={`Percentile vs starting ${p.position}s`} />
      <CardBody className="pt-2">
        <div className="h-[220px]">
          <ResponsiveContainer>
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke={t.grid} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: t.textMuted, fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip content={<ChartTooltip format={(x) => `${x}th pct`} />} />
              <Radar dataKey="pct" name="Percentile" stroke={t.accent} fill={t.accent} fillOpacity={0.22} strokeWidth={2} animationDuration={600} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function Efficiency({ p, logs, className }: { p: Player; logs: GameLog[]; className?: string }) {
  const t = totals(logs);
  const g = Math.max(1, t.games);
  const metrics: [string, string, string][] =
    p.position === 'QB'
      ? [['Pass yds / g', fmt.num(t.passYds / g), 'Volume'], ['Yards / attempt', t.passAtt ? fmt.num(t.passYds / t.passAtt) : '—', 'Efficiency'], ['Completion %', t.passAtt ? fmt.pct(t.passCmp / t.passAtt, 1) : '—', 'Accuracy'], ['TD rate', t.passAtt ? fmt.pct(t.passTd / t.passAtt, 1) : '—', 'Scoring'], ['INT rate', t.passAtt ? fmt.pct(t.int / t.passAtt, 1) : '—', 'Ball security'], ['Rush yds / g', fmt.num(t.rushYds / g), 'Rushing floor']]
      : p.position === 'RB'
        ? [['Carries / g', fmt.num(t.rushAtt / g), 'Volume'], ['Yards / carry', t.rushAtt ? fmt.num(t.rushYds / t.rushAtt) : '—', 'Efficiency'], ['Yards / touch', t.rushAtt + t.rec ? fmt.num((t.rushYds + t.recYds) / (t.rushAtt + t.rec)) : '—', 'Efficiency'], ['Targets / g', fmt.num(t.targets / g), 'Receiving role'], ['RZ touches / g', fmt.num(t.rz / g), 'Scoring access'], ['Snap %', fmt.pct(t.snaps / g), 'Role']]
        : [['Targets / g', fmt.num(t.targets / g), 'Volume'], ['Yards / target', t.targets ? fmt.num(t.recYds / t.targets) : '—', 'Efficiency'], ['Catch rate', t.targets ? fmt.pct(t.rec / t.targets, 1) : '—', 'Reliability'], ['Yards / route', t.routes ? fmt.num(t.recYds / t.routes, 2) : '—', 'YPRR'], ['aDOT', t.targets ? fmt.num(t.airYards / t.targets) : '—', 'Depth'], ['Air yards / g', fmt.num(t.airYards / g, 0), 'Opportunity']];
  return (
    <Card className={className}>
      <CardHeader icon={<Crosshair />} title="Efficiency metrics" subtitle={`Season to date · ${t.games} games`} />
      <div className="grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="border-b border-border p-4 lg:border-b-0">
            <div className="label-caps">{label}</div>
            <div className="num mt-1 text-xl font-semibold">{value}</div>
            <div className="text-2xs text-fg-subtle">{hint}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
