import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, CircleMinus, ClipboardList, Hourglass, Lightbulb, MessageSquareText, Plus, XCircle } from 'lucide-react';
import type { UniverseState } from '@/hooks/useUniverse';
import type { TradeEvaluation, TradeSide } from '@/engine/trade/evaluate';
import type { FairSuggestion } from '@/engine/trade/suggest';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/states';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ReasonsCard({ u, side }: { u: UniverseState; side: TradeSide }) {
  const team = u.league.rosters.find((t) => t.id === side.teamId)!;
  const isMe = side.teamId === u.league.myTeamId;
  const tone = side.verdict === 'win' ? 'pos' : side.verdict === 'lose' ? 'neg' : 'accent';
  return (
    <Card>
      <CardHeader
        icon={<MessageSquareText />}
        title={isMe ? 'Why — your side' : `Why — ${team.name}`}
        subtitle={`Net ${fmt.signedInt(side.net)} value · ${fmt.signedPct(side.fairness)}`}
        actions={<Badge tone={tone} size="md">{side.verdict === 'win' ? 'Wins' : side.verdict === 'lose' ? 'Loses' : 'Fair'}</Badge>}
      />
      <ul className="space-y-2.5 p-4">
        {side.reasons.length === 0 && <li className="text-sm text-fg-subtle">Add assets to see the reasoning.</li>}
        {side.reasons.map((r, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-snug">
            {r.tone === 'pos' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pos" /> : r.tone === 'neg' ? <XCircle className="mt-0.5 size-4 shrink-0 text-neg" /> : <CircleMinus className="mt-0.5 size-4 shrink-0 text-fg-subtle" />}
            <span className="text-fg-muted">{r.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TimelineCard({ u, ev }: { u: UniverseState; ev: TradeEvaluation }) {
  const t = useChartTheme();
  const names = Object.fromEntries(ev.sides.map((s) => [s.teamId, s.teamId === u.league.myTeamId ? 'You' : u.league.rosters.find((r) => r.id === s.teamId)!.name]));
  const data = ev.timeline.map((p) => ({ label: p.label, ...Object.fromEntries(Object.entries(p.values).map(([k, v]) => [names[k], v])) }));
  const mine = ev.timeline.map((p) => p.values[u.league.myTeamId] ?? 0);
  const firstPos = mine.findIndex((x) => x > 0.5);
  const summary = ev.empty
    ? 'Add assets to project value over time.'
    : mine.every((x) => x >= -0.5)
      ? 'You come out ahead at every horizon.'
      : mine.every((x) => x <= 0.5)
        ? 'You trail at every horizon — the partner wins short and long term.'
        : firstPos > 0
          ? `You pay now and win later — you pull ahead by ${ev.timeline[firstPos].label}.`
          : `You win now, but the partner pulls ahead by ${ev.timeline[mine.findIndex((x) => x < -0.5)].label}.`;
  return (
    <Card className="lg:col-span-2">
      <CardHeader icon={<Hourglass />} title="Who wins by when" subtitle="Cumulative fantasy points above replacement gained (net) at each horizon" />
      <CardBody>
        <p className="mb-3 text-sm text-fg-muted">{summary}</p>
        <div className="h-[240px]">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axisProps(t)} />
              <YAxis {...axisProps(t)} axisLine={false} />
              <ReferenceLine y={0} stroke={t.textMuted} strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip format={(v) => `${fmt.signed(v)} pts`} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {ev.sides.map((s, i) => (
                <Line key={s.teamId} dataKey={names[s.teamId]} stroke={s.teamId === u.league.myTeamId ? t.accent : t.series[i === 1 ? 1 : 2]} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0 }} animationDuration={600} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

export function LineupImpactCard({ side, title }: { side: TradeSide; title: string }) {
  const l = side.lineup;
  return (
    <Card>
      <CardHeader icon={<ClipboardList />} title={title} subtitle="Rest-of-season average points per week" actions={l ? <span className={cn('num text-sm font-semibold', l.delta > 0.2 ? 'text-pos' : l.delta < -0.2 ? 'text-neg' : 'text-fg')}>{fmt.signed(l.delta)}</span> : null} />
      {!l ? (
        <EmptyState title="No lineup change yet" description="Add players to see before/after starters." />
      ) : (
        <div className="grid grid-cols-2 divide-x divide-border text-sm">
          {(['before', 'after'] as const).map((k) => (
            <div key={k} className="p-3">
              <div className="label-caps mb-2 flex justify-between"><span>{k === 'before' ? 'Before' : 'After'}</span><span className="num text-fg">{fmt.num(l[k].total)}</span></div>
              <ul className="space-y-1">
                {l[k].starters.map((s, i) => {
                  const changed = k === 'after' && s.player && !l.before.starters.some((b) => b.player?.id === s.player!.id);
                  const lost = k === 'before' && s.player && !l.after.starters.some((b) => b.player?.id === s.player!.id);
                  return (
                    <li key={i} className={cn('flex items-center gap-2 rounded px-1.5 py-0.5', changed && 'bg-pos/10', lost && 'bg-neg/10')}>
                      <span className="w-7 text-2xs font-bold text-fg-subtle">{s.slot === 'SUPERFLEX' ? 'SF' : s.slot}</span>
                      <span className="min-w-0 flex-1 truncate text-xs">{s.player?.name ?? '—'}</span>
                      <span className="num text-xs text-fg-muted">{s.player ? fmt.num(s.player.mean) : ''}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function SuggestionsCard({ suggestions, onApply, open }: { suggestions: FairSuggestion[]; onApply: (s: FairSuggestion) => void; open: boolean }) {
  if (!open) return null;
  return (
    <Card id="fair-suggestions" className="lg:col-span-2">
      <CardHeader icon={<Lightbulb />} title="What would make this fair?" subtitle="Single-asset changes that bring the deal inside the fair band" />
      {suggestions.length === 0 ? (
        <EmptyState title="No single change gets this to fair" description="Try a bigger restructure — swap the headline asset or add a third team." />
      ) : (
        <div className="divide-y divide-border/70">
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Badge tone={s.action === 'add' ? 'accent' : 'warn'}>{s.action === 'add' ? 'Add' : 'Remove'}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{s.description}</span>
              <span className="num text-xs text-fg-subtle">→ {fmt.signedPct(s.fairnessAfter)}</span>
              <Button size="xs" variant="secondary" onClick={() => onApply(s)}><Plus /> Apply</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
