import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeftRight, GripVertical, Inbox, Lightbulb, Plus, Save, Scale, Trophy, Users, X } from 'lucide-react';
import type { AssetRef, LeagueMode } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { AnimatedNumber } from '@/components/common/metrics';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { STRATEGY_LABEL } from '@/lib/league';
import { tradeValue } from '@/engine/trade/evaluate';
import { valuePick } from '@/engine/valuation/picks';
import { FairnessGauge } from './FairnessGauge';
import { AssetCard } from './AssetCard';
import { RosterRail, type RailItem } from './AssetPicker';
import { assetId, type useTradeDesk } from './useTradeDesk';

type Desk = ReturnType<typeof useTradeDesk>;

export function TradeDesk({ u, desk, mode, onSave, onSuggest }: { u: UniverseState; desk: Desk; mode: LeagueMode; onSave: () => void; onSuggest: () => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }), useSensor(KeyboardSensor));
  const ev = desk.evaluation;
  const three = desk.teamIds.length === 3;

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as { label: string })?.label ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const data = e.active.data.current as { ref: AssetRef; teamId: string } | undefined;
    const over = e.over?.id ? String(e.over.id) : null;
    if (!data || !over?.startsWith('side-')) return;
    desk.add(data.ref, over.slice(5));
  };

  const mine = ev.mine;
  const sideCols = desk.teamIds.map((teamId, index) => <SideColumn key={teamId} u={u} desk={desk} teamId={teamId} index={index} mode={mode} />);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <VerdictBanner u={u} desk={desk} onSave={onSave} onSuggest={onSuggest} />
      {three ? (
        <div className="mt-4 space-y-4">
          <Card className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:justify-center sm:gap-10">
            <div className="w-56"><FairnessGauge fairness={ev.fairness} verdict={ev.verdict} empty={ev.empty} /></div>
            <CenterNumbers ev={ev} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">{sideCols}</div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
          {sideCols[0]}
          <Card className="flex flex-col items-center justify-start gap-4 p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="label-caps">Fairness</div>
            <FairnessGauge fairness={ev.fairness} verdict={ev.verdict} empty={ev.empty} />
            <CenterNumbers ev={ev} />
            {mine.lineup && (
              <div className="w-full rounded-md border border-border bg-surface-2/60 p-3 text-center">
                <div className="text-2xs text-fg-subtle">Your starting lineup</div>
                <div className={cn('num text-lg font-semibold', mine.lineup.delta > 0.2 ? 'text-pos' : mine.lineup.delta < -0.2 ? 'text-neg' : 'text-fg')}>{fmt.signed(mine.lineup.delta)} <span className="text-xs font-normal text-fg-subtle">pts/wk</span></div>
              </div>
            )}
            <div className="hidden items-center gap-1.5 text-2xs text-fg-subtle lg:flex"><GripVertical className="size-3" /> Drag from a roster onto its side</div>
          </Card>
          {sideCols[1]}
        </div>
      )}
      <DragOverlay dropAnimation={{ duration: 160 }}>
        {dragging && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/60 bg-surface-1 px-3 py-2 text-sm font-semibold shadow-glow">
            <GripVertical className="size-4 text-accent" /> {dragging}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function CenterNumbers({ ev }: { ev: Desk['evaluation'] }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 text-center">
      <div className="rounded-md bg-surface-2 p-2.5">
        <div className="text-2xs text-fg-subtle">You receive</div>
        <AnimatedNumber value={ev.mine.receivedValue} className="text-md font-semibold" />
      </div>
      <div className="rounded-md bg-surface-2 p-2.5">
        <div className="text-2xs text-fg-subtle">You send</div>
        <AnimatedNumber value={ev.mine.sentValue} className="text-md font-semibold" />
      </div>
    </div>
  );
}

function VerdictBanner({ u, desk, onSave, onSuggest }: { u: UniverseState; desk: Desk; onSave: () => void; onSuggest: () => void }) {
  const ev = desk.evaluation;
  const cfg = ev.empty
    ? { tone: 'border-border bg-surface-1', icon: <ArrowLeftRight />, iconCls: 'bg-surface-3 text-fg-subtle', title: 'Build a trade', text: 'Add players or picks to each side — drag from the rosters below or use the + buttons.' }
    : ev.verdict === 'win'
      ? { tone: 'border-pos/40 bg-pos/[0.07]', icon: <Trophy />, iconCls: 'bg-pos/15 text-pos', title: 'You win this trade', text: `You gain ${fmt.signedInt(ev.delta)} value (${fmt.signedPct(ev.fairness)})` }
      : ev.verdict === 'lose'
        ? { tone: 'border-neg/40 bg-neg/[0.07]', icon: <AlertTriangle />, iconCls: 'bg-neg/15 text-neg', title: 'You lose this trade', text: `You give up ${fmt.int(Math.abs(ev.delta))} more value than you get (${fmt.signedPct(ev.fairness)})` }
        : { tone: 'border-accent/40 bg-accent/[0.06]', icon: <Scale />, iconCls: 'bg-accent/15 text-accent', title: 'Fair trade', text: `Within the ±${Math.round(6)}% fair band (${fmt.signedPct(ev.fairness)})` };
  return (
    <motion.div layout className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center', cfg.tone)} aria-live="polite">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cn('grid size-11 shrink-0 place-items-center rounded-lg [&_svg]:size-5', cfg.iconCls)}>{cfg.icon}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{cfg.title}</h2>
            {!ev.empty && <Badge tone="outline">{STRATEGY_LABEL[u.league.strategy]} weighting</Badge>}
          </div>
          <p className="text-sm text-fg-muted">{cfg.text}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!ev.empty && ev.verdict !== 'fair' && <Button variant="secondary" onClick={onSuggest}><Lightbulb /> What would make this fair?</Button>}
        {!ev.empty && <Button variant="ghost" onClick={desk.clear}><X /> Clear</Button>}
        <Button variant="primary" onClick={onSave} disabled={ev.empty}><Save /> Save</Button>
      </div>
    </motion.div>
  );
}

function SideColumn({ u, desk, teamId, index, mode }: { u: UniverseState; desk: Desk; teamId: string; index: number; mode: LeagueMode }) {
  const team = u.league.rosters.find((t) => t.id === teamId)!;
  const isMe = teamId === u.league.myTeamId;
  const { setNodeRef, isOver, active } = useDroppable({ id: `side-${teamId}` });
  const dragFromHere = (active?.data.current as { teamId?: string } | undefined)?.teamId === teamId;
  const side = desk.evaluation.sides.find((s) => s.teamId === teamId);
  const sends = side?.sends ?? [];
  const three = desk.teamIds.length === 3;
  const strategy = isMe ? u.league.strategy : 'balanced';
  const inTrade = useMemo(() => new Set(desk.assets.map((a) => assetId(a.ref))), [desk.assets]);

  const rail: RailItem[] = useMemo(() => {
    const players = team.playerIds
      .map((id) => {
        const p = u.players.get(id);
        const v = desk.quickValue({ kind: 'player', playerId: id }, teamId);
        if (!p || !v) return null;
        return { ref: { kind: 'player', playerId: id } as AssetRef, label: p.name, value: v.value, pos: p.position, sub: `${p.team} · ${p.position === 'DST' ? 'Defense' : `${p.age.toFixed(0)} yrs`}` };
      })
      .filter(Boolean) as RailItem[];
    const picks = team.picks.map((pk) => {
      const pv = valuePick(pk, { teams: u.league.teams, superflex: u.league.superflex, nextDraftSeason: u.core.season + 1, tierHint: u.pickTierHints[pk.originalTeamId] });
      const own = pk.originalTeamId === teamId ? '' : ` · via ${u.league.rosters.find((t) => t.id === pk.originalTeamId)?.name ?? 'trade'}`;
      return { ref: { kind: 'pick', pick: pk } as AssetRef, label: pv.label, value: tradeValue({ ...pv, redraft: pv.redraftValue, dynasty: pv.dynastyValue, keeper: pv.keeperValue, kind: 'pick' }, mode, strategy), pos: 'PICK', sub: `Proj. pick #${pv.overall}${own}` };
    });
    return [...players.sort((a, b) => b.value - a.value), ...picks.sort((a, b) => b.value - a.value)];
  }, [team, u, desk, teamId, mode, strategy]);

  const others = u.league.rosters.filter((t) => t.id === teamId || !desk.teamIds.includes(t.id));
  const recipients = desk.teamIds.filter((t) => t !== teamId).map((id) => ({ id, name: u.league.rosters.find((t) => t.id === id)!.name }));

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className={cn('grid size-8 shrink-0 place-items-center rounded-md', isMe ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-fg-muted')}>
          <Users className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {isMe ? (
            <div className="truncate text-sm font-semibold">{team.name} <span className="font-normal text-fg-subtle">(you)</span></div>
          ) : (
            <Select size="sm" value={teamId} onValueChange={(v) => desk.setPartner(index, v)} options={others.map((t) => ({ value: t.id, label: t.name, hint: t.record ? `${t.record.w}–${t.record.l}` : undefined }))} aria-label="Trade partner" className="h-8 border-transparent bg-transparent px-0 font-semibold hover:border-transparent" />
          )}
          <div className="text-2xs text-fg-subtle">{team.owner} · {team.record ? `${team.record.w}–${team.record.l}` : 'no record'} · {STRATEGY_LABEL[strategy]}{isMe ? '' : ' (assumed)'}</div>
        </div>
        {index === 2 && (
          <Tooltip content="Remove third team">
            <Button variant="ghost" size="icon-sm" onClick={desk.removeThirdTeam} aria-label="Remove third team"><X /></Button>
          </Tooltip>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'm-3 min-h-[148px] flex-1 space-y-2 rounded-lg border border-dashed p-2 transition-colors',
          isOver ? (dragFromHere ? 'border-accent bg-accent/[0.06]' : 'border-neg/60 bg-neg/[0.05]') : active ? 'border-border-strong bg-surface-2/40' : 'border-border',
        )}
      >
        <div className="flex items-center justify-between px-1 pt-0.5">
          <span className="label-caps">{isMe ? 'You send' : `${team.name.split(' ')[0]} sends`}</span>
          <span className="num text-xs text-fg-subtle">{sends.length} asset{sends.length === 1 ? '' : 's'}</span>
        </div>
        <AnimatePresence initial={false}>
          {sends.map((a) => (
            <AssetCard
              key={a.key}
              asset={a}
              u={u}
              value={a.value}
              onRemove={() => desk.remove(a.key)}
              recipients={three ? recipients : undefined}
              onRecipient={three ? (to) => desk.setRecipient(a.key, to) : undefined}
            />
          ))}
        </AnimatePresence>
        {sends.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-center text-xs text-fg-subtle">
            <Inbox className="size-5" />
            Drag players or picks here
          </div>
        )}
      </div>

      <div className="mx-3 mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-surface-2 px-3 py-2">
          <div className="text-fg-subtle">Sends (adj.)</div>
          <AnimatedNumber value={side?.sentValue ?? 0} className="text-sm font-semibold" />
        </div>
        <div className="rounded-md bg-surface-2 px-3 py-2">
          <div className="text-fg-subtle">Receives (adj.)</div>
          <AnimatedNumber value={side?.receivedValue ?? 0} className="text-sm font-semibold" />
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="label-caps">Roster &amp; picks</span>
          {index === 1 && desk.teamIds.length === 2 && u.league.rosters.length > 2 && (
            <Button variant="ghost" size="xs" onClick={desk.addThirdTeam}><Plus /> 3rd team</Button>
          )}
        </div>
        <RosterRail team={team} u={u} items={rail} inTrade={inTrade} onAdd={(ref) => desk.add(ref, teamId)} />
      </div>
    </Card>
  );
}
