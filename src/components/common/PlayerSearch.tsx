import { useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Plus, Search } from 'lucide-react';
import type { UniverseState } from '@/hooks/useUniverse';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from './PlayerAvatar';
import { PositionBadge } from './badges';
import { fmt } from '@/lib/format';

/** Popover combobox to pick any player in the universe. */
export function PlayerSearch({ u, onPick, exclude = [], label = 'Add player', filter, align = 'start' }: { u: UniverseState; onPick: (id: string) => void; exclude?: string[]; label?: string; filter?: (id: string) => boolean; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return u.universe.ranked
      .filter((v) => !exclude.includes(v.playerId) && (!filter || filter(v.playerId)))
      .map((v) => ({ v, p: u.players.get(v.playerId)! }))
      .filter(({ p }) => !s || p.name.toLowerCase().includes(s) || p.team.toLowerCase() === s)
      .slice(0, 40);
  }, [u, q, exclude, filter]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm"><Plus /> {label}</Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-fg-subtle" />
            <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search players…" className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle" />
          </div>
          <Command.List className="scrollbar-thin max-h-[300px] overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-fg-subtle">No players found</Command.Empty>
            {list.map(({ v, p }) => {
              const owner = u.rosteredBy.get(p.id);
              return (
                <Command.Item key={p.id} value={p.id} onSelect={() => { onPick(p.id); setOpen(false); setQ(''); }} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm aria-selected:bg-surface-2">
                  <PlayerAvatar player={p} team={u.teams.get(p.team)} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-2xs text-fg-subtle">{p.team} · {owner ? (owner === u.league.myTeamId ? 'Your team' : u.league.rosters.find((t) => t.id === owner)?.name) : 'Free agent'}</div>
                  </div>
                  <PositionBadge pos={p.position} rank={v.posRank} />
                  <span className="num w-10 text-right text-xs">{fmt.num(v.week.mean)}</span>
                </Command.Item>
              );
            })}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
