import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, CircleMinus, ClipboardList, Lock, LockOpen, Pencil, Scale, Shuffle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useUniverse, type UniverseState } from '@/hooks/useUniverse';
import { buildLineup, type LineupPlayer } from '@/hooks/useLineup';
import { useAllLogs, useOdds } from '@/data/queries';
import type { Slot } from '@/data/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSkeleton, EmptyState } from '@/components/common/states';
import { PlayerCell } from '@/components/common/PlayerCell';
import { ConfidenceMeter, KpiTile } from '@/components/common/metrics';
import { fmt, lastName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { reasonsFor, impliedFor } from './reasons';
import { RosterEditor } from './RosterEditor';
import { ComparePanel } from './ComparePanel';

export default function LineupPage() {
  const { data: u, isLoading } = useUniverse();
  if (isLoading || !u) return <PageSkeleton />;
  return <LineupScreen u={u} key={u.league.id} />;
}

function LineupScreen({ u }: { u: UniverseState }) {
  const [params] = useSearchParams();
  const [teamId, setTeamId] = useState(u.league.myTeamId);
  const [locked, setLocked] = useState<Partial<Record<string, Slot>>>({});
  const [editing, setEditing] = useState(false);
  const logs = useAllLogs();
  const odds = useOdds(u.core.week);
  const team = u.league.rosters.find((t) => t.id === teamId)!;
  const lineup = useMemo(() => buildLineup(u, team.playerIds, locked), [u, team.playerIds, locked]);
  const optimal = useMemo(() => buildLineup(u, team.playerIds), [u, team.playerIds]);
  const closeCalls = lineup.rows.filter((r) => r.entry && r.alt && r.confidence < 70).sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lineup Optimizer"
        subtitle={`Week ${u.core.week} start/sit with confidence scores · ${u.league.name}`}
        actions={
          <>
            <Select className="w-56" value={teamId} onValueChange={(v) => { setTeamId(v); setLocked({}); }} options={u.league.rosters.map((t) => ({ value: t.id, label: t.id === u.league.myTeamId ? `${t.name} (you)` : t.name }))} aria-label="Team" />
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil /> Edit roster</Button>
            {Object.keys(locked).length > 0 && <Button variant="ghost" onClick={() => setLocked({})}><Shuffle /> Reset locks</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Projected" icon={<ClipboardList />} value={`${fmt.num(lineup.total)} pts`} sub={Object.keys(locked).length ? `${fmt.signed(lineup.total - optimal.total)} vs optimal` : 'Optimal lineup'} />
        <KpiTile label="Floor" value={fmt.num(lineup.floor)} sub="10th percentile outcome" />
        <KpiTile label="Ceiling" value={fmt.num(lineup.ceiling)} sub="90th percentile outcome" />
        <KpiTile label="Close calls" icon={<Scale />} value={closeCalls.length} sub={closeCalls[0]?.entry ? `${lastName(closeCalls[0].entry.player.name)} vs ${lastName(closeCalls[0].alt!.player.name)}` : 'No toss-ups this week'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader icon={<ClipboardList />} title="Starting lineup" subtitle="Click a row for the reasoning · lock to force a start" />
          <div className="hidden grid-cols-[52px_minmax(0,1fr)_96px_120px_150px_32px] gap-3 border-b border-border bg-surface-2/60 px-4 py-2 text-2xs font-semibold uppercase tracking-[0.06em] text-fg-subtle md:grid">
            <span>Slot</span><span>Player</span><span className="text-right">Proj</span><span>Range</span><span>Confidence</span><span />
          </div>
          <div className="divide-y divide-border/70">
            {lineup.rows.map((r, i) => (
              <StarterRow key={`${r.slot}-${i}`} u={u} slot={r.slot} entry={r.entry} alt={r.alt} confidence={r.confidence} locked={!!(r.entry && locked[r.entry.id])} logs={r.entry ? logs.data?.[r.entry.id] : undefined} odds={odds.data?.data}
                onLock={() => r.entry && setLocked((l) => { const n = { ...l }; if (n[r.entry!.id]) delete n[r.entry!.id]; else n[r.entry!.id] = r.slot; return n; })} />
            ))}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <CardHeader icon={<Scale />} title="Toughest calls" subtitle="Lowest-confidence starts vs best bench option" />
            {closeCalls.length === 0 ? <EmptyState icon={<CheckCircle2 />} title="Clear-cut lineup" description="Every starter beats the bench option with 70%+ confidence." /> : (
              <div className="divide-y divide-border/70">
                {closeCalls.slice(0, 4).map((r) => (
                  <div key={r.entry!.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-center justify-between text-xs"><Badge tone="outline">{r.slot}</Badge><ConfidenceMeter value={r.confidence} compact /></div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                      <div className="min-w-0"><div className="truncate font-semibold">{r.entry!.player.name}</div><div className="num text-xs text-pos">Start · {fmt.num(r.entry!.mean)}</div></div>
                      <span className="text-2xs text-fg-subtle">vs</span>
                      <div className="min-w-0 text-right"><div className="truncate font-medium text-fg-muted">{r.alt!.player.name}</div><div className="num text-xs text-fg-subtle">Sit · {fmt.num(r.alt!.mean)}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Bench" subtitle={`${lineup.bench.length} players`} />
            <div className="scrollbar-thin max-h-[420px] divide-y divide-border/70 overflow-y-auto">
              {lineup.bench.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2">
                  <PlayerCell player={b.player} team={u.teams.get(b.player.team)} posRank={b.val.posRank} size="xs" className="flex-1" sub={b.val.week.bye ? 'BYE' : `${b.val.week.home ? 'vs' : '@'} ${b.val.week.opp}`} />
                  <span className="num text-sm text-fg-muted">{fmt.num(b.mean)}</span>
                </div>
              ))}
              {lineup.bench.length === 0 && <p className="p-4 text-sm text-fg-subtle">No bench players.</p>}
            </div>
          </Card>
        </div>
      </div>

      <ComparePanel u={u} initial={params.get('compare') ?? undefined} defaults={lineup.rows.filter((r) => r.entry && r.alt).sort((a, b) => a.confidence - b.confidence)[0]} />
      <RosterEditor u={u} teamId={teamId} open={editing} onOpenChange={setEditing} onSaved={() => toast.success('Roster updated', { description: 'Lineup re-optimized.' })} />
    </div>
  );
}

function StarterRow({ u, slot, entry, alt, confidence, locked, onLock, logs, odds }: { u: UniverseState; slot: Slot; entry: LineupPlayer | null; alt: LineupPlayer | null; confidence: number; locked: boolean; onLock: () => void; logs?: import('@/data/types').GameLog[]; odds?: import('@/data/types').GameOdds[] }) {
  const [open, setOpen] = useState(false);
  if (!entry) return <div className="flex items-center gap-3 px-4 py-3 text-sm"><span className="w-[52px] text-2xs font-bold text-fg-subtle">{slot}</span><span className="text-fg-subtle">Empty — add an eligible player to your roster</span></div>;
  const w = entry.val.week;
  const max = 45;
  const reasons = open ? reasonsFor(u, entry, logs, odds) : [];
  const it = impliedFor(u, entry.player.team, odds);
  return (
    <div>
      <div role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)} className="grid cursor-pointer grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60 md:grid-cols-[52px_minmax(0,1fr)_96px_120px_150px_32px]">
        <span className="text-2xs font-bold uppercase text-fg-subtle">{slot === 'SUPERFLEX' ? 'SF' : slot}</span>
        <PlayerCell player={entry.player} team={u.teams.get(entry.player.team)} posRank={entry.val.posRank} sub={w.bye ? 'BYE' : `${w.home ? 'vs' : '@'} ${w.opp}${w.matchupRank ? ` (${w.matchupRank})` : ''}${it ? ` · ${fmt.num(it.total)} imp` : ''}`} />
        <div className="text-right"><span className="num text-md font-semibold">{fmt.num(entry.mean)}</span></div>
        <div className="hidden md:block">
          <div className="relative h-1.5 rounded-full bg-surface-3">
            <div className="absolute inset-y-0 rounded-full bg-accent/40" style={{ left: `${(w.floor / max) * 100}%`, width: `${Math.max(2, ((w.ceiling - w.floor) / max) * 100)}%` }} />
            <div className="absolute -top-0.5 size-2.5 -translate-x-1/2 rounded-full bg-accent ring-2 ring-surface-1" style={{ left: `${Math.min(100, (entry.mean / max) * 100)}%` }} />
          </div>
          <div className="num mt-1 flex justify-between text-2xs text-fg-subtle"><span>{fmt.num(w.floor, 0)}</span><span>{fmt.num(w.ceiling, 0)}</span></div>
        </div>
        <div className="hidden md:block"><Tooltip content={alt ? `vs ${alt.player.name} (${fmt.num(alt.mean)})` : 'No eligible bench alternative'}><span><ConfidenceMeter value={confidence} /></span></Tooltip></div>
        <div className="hidden items-center gap-1 md:flex">
          <Tooltip content={locked ? 'Unlock' : 'Lock in this slot'}>
            <button onClick={(e) => { e.stopPropagation(); onLock(); }} className={cn('grid size-7 place-items-center rounded-md transition-colors hover:bg-surface-3', locked ? 'text-accent' : 'text-fg-subtle')} aria-label={locked ? 'Unlock player' : 'Lock player'} aria-pressed={locked}>
              {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          </Tooltip>
        </div>
        <ChevronDown className={cn('size-4 text-fg-subtle transition-transform md:hidden', open && 'rotate-180')} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mx-4 mb-3 rounded-lg border border-border bg-surface-2/50 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-fg-subtle md:hidden"><ConfidenceMeter value={confidence} /> <span>Range {fmt.num(w.floor, 0)}–{fmt.num(w.ceiling, 0)}</span></div>
              <ul className="space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    {r.tone === 'pos' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pos" /> : r.tone === 'neg' ? <XCircle className="mt-0.5 size-4 shrink-0 text-neg" /> : <CircleMinus className="mt-0.5 size-4 shrink-0 text-fg-subtle" />}
                    <span className="text-fg-muted">{r.text}</span>
                  </li>
                ))}
                {alt && <li className="flex gap-2 text-sm"><Scale className="mt-0.5 size-4 shrink-0 text-accent" /><span className="text-fg-muted">Starts over {alt.player.name} ({fmt.num(alt.mean)} proj) with {confidence}% confidence.</span></li>}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
