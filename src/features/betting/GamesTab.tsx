import { useMemo, useState } from 'react';
import { Flag, Plus, Wind } from 'lucide-react';
import type { GameOdds } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { analyzeGame, type MarketEdge } from '@/engine/betting/model';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { TeamBadge } from '@/components/common/badges';
import { CardSkeleton, EmptyState } from '@/components/common/states';
import { Sparkline } from '@/components/charts/Sparkline';
import { fmt } from '@/lib/format';
import { kickoffLabel } from '@/lib/stats';
import { cn } from '@/lib/utils';
import { trackBet } from './trackBet';

function EdgeCell({ e, onTrack, type }: { e: MarketEdge; onTrack: () => void; type: string }) {
  return (
    <div className={cn('rounded-md border p-2.5', e.value ? 'border-pos/40 bg-pos/[0.06]' : 'border-border bg-surface-2/50')}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{type}</span>
        {e.value && <Badge tone="pos"><Flag /> Value</Badge>}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{e.label}</span>
        <span className="num text-xs text-fg-subtle">{fmt.odds(e.odds)}</span>
      </div>
      <div className="num mt-1 flex items-center justify-between text-xs">
        <span className="text-fg-subtle">{fmt.pct(e.modelProb)} vs {fmt.pct(e.marketProb)}</span>
        <span className={cn('font-semibold', e.edge > 0 ? 'text-pos' : 'text-neg')}>{fmt.signedPct(e.edge)}</span>
      </div>
      <Button size="xs" variant="ghost" className="mt-1 h-6 w-full" onClick={onTrack}><Plus /> Track</Button>
    </div>
  );
}

export function GamesTab({ u, odds, loading }: { u: UniverseState; odds?: GameOdds[]; loading: boolean }) {
  const [valueOnly, setValueOnly] = useState(false);
  const rows = useMemo(() => (odds ?? [])
    .map((o) => {
      const g = u.core.games.find((x) => x.id === o.gameId);
      if (!g || g.week !== u.core.week) return null;
      return { g, o, a: analyzeGame(g, o, u.teams.get(g.home)!, u.teams.get(g.away)!, u.core.players) };
    })
    .filter(Boolean)
    .sort((a, b) => a!.g.kickoff.localeCompare(b!.g.kickoff)) as { g: import('@/data/types').Game; o: GameOdds; a: ReturnType<typeof analyzeGame> }[], [odds, u]);
  const shown = rows.filter((r) => !valueOnly || r.a.best.value);
  if (loading) return <Card><CardSkeleton rows={6} /></Card>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted"><b className="num text-fg">{rows.filter((r) => r.a.best.value).length}</b> value flags across {rows.length} games (edge ≥ 3%)</span>
        <label className="flex items-center gap-2 text-sm text-fg-muted"><Switch checked={valueOnly} onCheckedChange={setValueOnly} /> Value bets only</label>
      </div>
      {shown.length === 0 && <Card><EmptyState icon={<Flag />} title="No value bets right now" description="The model agrees with the market on every game. Check back after line moves." /></Card>}
      <div className="grid gap-3 xl:grid-cols-2">
        {shown.map(({ g, o, a }) => (
          <Card key={g.id} className="card-hover p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-md font-semibold">
                  <TeamBadge team={u.teams.get(g.away)} className="text-sm" /> <span className="text-fg-subtle">@</span> <TeamBadge team={u.teams.get(g.home)} className="text-sm" />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-subtle">
                  {kickoffLabel(g.kickoff)} · {g.network}
                  {g.weather.condition !== 'Dome' && <Tooltip content={`${g.weather.condition}, ${g.weather.tempF}°F, ${g.weather.windMph} mph`}><span className="inline-flex items-center gap-1"><Wind className="size-3" />{g.weather.tempF}°</span></Tooltip>}
                </div>
              </div>
              <div className="w-28 text-right">
                <div className="h-7"><Sparkline data={o.history.map((h) => -h.spread)} height={28} /></div>
                <div className="num text-2xs text-fg-subtle">Open {g.home} {fmt.spread(o.open.spread)}</div>
              </div>
            </div>
            <div className="num mt-3 grid grid-cols-3 gap-2 rounded-md bg-surface-2/60 p-2.5 text-center text-xs">
              <div><div className="text-fg-subtle">Market</div><div className="font-semibold">{g.home} {fmt.spread(o.spread)} · {o.total}</div></div>
              <div><div className="text-fg-subtle">Model line</div><div className="font-semibold text-accent">{g.home} {fmt.spread(Math.round(-a.model.margin * 2) / 2)} · {fmt.num(a.model.total)}</div></div>
              <div><div className="text-fg-subtle">Model score</div><div className="font-semibold">{g.away} {fmt.num(a.model.awayPts, 0)}–{fmt.num(a.model.homePts, 0)} {g.home}</div></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <EdgeCell type="Spread" e={a.spread} onTrack={() => trackBet('spread', a.spread.label, -110, a.spread.edge, g.id)} />
              <EdgeCell type="Total" e={a.total} onTrack={() => trackBet('total', `${g.away}/${g.home} ${a.total.label}`, -110, a.total.edge, g.id)} />
              <EdgeCell type="Moneyline" e={a.moneyline} onTrack={() => trackBet('moneyline', a.moneyline.label, a.moneyline.odds, a.moneyline.edge, g.id)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
