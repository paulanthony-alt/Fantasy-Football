import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CalendarClock, GripVertical, Plus, Search } from 'lucide-react';
import type { AssetRef, LeagueTeam } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/common/PlayerAvatar';
import { PositionBadge } from '@/components/common/badges';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { assetId } from './useTradeDesk';

export interface RailItem {
  ref: AssetRef;
  label: string;
  value: number;
  pos: string;
  sub: string;
}

function DraggableRow({ item, teamId, u, inTrade, onAdd }: { item: RailItem; teamId: string; u: UniverseState; inTrade: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${teamId}::${assetId(item.ref)}`, data: { ref: item.ref, teamId, label: item.label }, disabled: inTrade });
  const p = item.ref.kind === 'player' ? u.players.get(item.ref.playerId) : undefined;
  return (
    <div
      ref={setNodeRef}
      className={cn('group flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors', inTrade ? 'opacity-40' : 'hover:bg-surface-2', isDragging && 'opacity-30')}
    >
      <button {...listeners} {...attributes} className={cn('cursor-grab touch-none text-fg-subtle active:cursor-grabbing', inTrade && 'cursor-not-allowed')} aria-label={`Drag ${item.label}`}>
        <GripVertical className="size-3.5" />
      </button>
      {p ? <PlayerAvatar player={p} team={u.teams.get(p.team)} size="xs" /> : <div className="grid size-6 place-items-center rounded-full bg-accent/12 text-accent"><CalendarClock className="size-3" /></div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{item.label}</div>
        <div className="truncate text-2xs text-fg-subtle">{item.sub}</div>
      </div>
      <PositionBadge pos={item.pos as 'QB'} className="h-4 min-w-0 px-1 text-[10px]" />
      <span className="num w-11 text-right text-xs font-semibold">{fmt.value(item.value)}</span>
      <button onClick={onAdd} disabled={inTrade} className="grid size-6 place-items-center rounded text-fg-subtle transition-colors hover:bg-accent/12 hover:text-accent disabled:pointer-events-none" aria-label={`Add ${item.label}`}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Searchable, draggable list of a team's players and picks. */
export function RosterRail({ team, u, items, inTrade, onAdd, className }: { team: LeagueTeam; u: UniverseState; items: RailItem[]; inTrade: Set<string>; onAdd: (ref: AssetRef) => void; className?: string }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => items.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase())), [items, q]);
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${team.name}…`} className="mb-2" aria-label={`Search ${team.name} roster`} />
      <div className="scrollbar-thin -mx-1 max-h-[300px] overflow-y-auto px-1">
        {shown.map((i) => (
          <DraggableRow key={assetId(i.ref)} item={i} teamId={team.id} u={u} inTrade={inTrade.has(assetId(i.ref))} onAdd={() => onAdd(i.ref)} />
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-xs text-fg-subtle">No matching assets</p>}
      </div>
    </div>
  );
}
