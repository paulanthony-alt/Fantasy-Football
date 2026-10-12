import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Moon, Plus, Search, Sun, Trophy } from 'lucide-react';
import { useUi } from '@/store/ui';
import { useLeagues } from '@/store/leagues';
import { useUniverse } from '@/hooks/useUniverse';
import { NAV_GROUPS, FOOTER_NAV } from './nav';
import { PlayerAvatar } from '@/components/common/PlayerAvatar';
import { PositionBadge } from '@/components/common/badges';
import { Kbd } from '@/components/ui/kbd';
import { fmt } from '@/lib/format';

const itemCls = 'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm text-fg-muted aria-selected:bg-surface-2 aria-selected:text-fg [&_svg]:size-4';
const groupCls = '[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3';

export function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const leagues = useLeagues((s) => s.leagues);
  const setActive = useLeagues((s) => s.setActive);
  const nav = useNavigate();
  const { data } = useUniverse();
  const [q, setQ] = useState('');

  useEffect(() => {
    let lastG = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().commandOpen);
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '[') toggleSidebar();
      else if (e.key.toLowerCase() === 'g') lastG = Date.now();
      else if (Date.now() - lastG < 900) {
        const map: Record<string, string> = { d: '/', p: '/players', m: '/matchups', n: '/news', l: '/lineup', t: '/trade', w: '/waivers', b: '/betting' };
        const to = map[e.key.toLowerCase()];
        if (to) nav(to);
        lastG = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, setOpen, toggleSidebar]);

  const players = useMemo(() => {
    if (!data) return [];
    return data.universe.ranked.slice(0, 400).map((v) => ({ v, p: data.players.get(v.playerId)! }));
  }, [data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return players.slice(0, 8);
    return players.filter(({ p }) => p.name.toLowerCase().includes(s) || p.team.toLowerCase() === s || p.position.toLowerCase() === s).slice(0, 12);
  }, [players, q]);

  const go = (to: string) => {
    setOpen(false);
    setQ('');
    nav(to);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(''); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-surface-1 shadow-e3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search players, switch leagues and jump to tools</DialogPrimitive.Description>
          <Command shouldFilter={false} loop className="flex max-h-[70vh] flex-col">
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 text-fg-subtle" />
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Search players, teams, pages…" className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle" />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="scrollbar-thin overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-fg-subtle">No results for “{q}”.</Command.Empty>
              {filtered.length > 0 && (
                <Command.Group heading="Players" className={groupCls}>
                  {filtered.map(({ p, v }) => (
                    <Command.Item key={p.id} value={`player-${p.id}`} onSelect={() => go(`/players/${p.id}`)} className={itemCls}>
                      <PlayerAvatar player={p} team={data?.teams.get(p.team)} size="xs" />
                      <span className="flex-1 truncate font-medium text-fg">{p.name}</span>
                      <PositionBadge pos={p.position} rank={v.posRank} />
                      <span className="w-8 text-xs text-fg-subtle">{p.team}</span>
                      <span className="num w-12 text-right text-xs font-semibold text-fg">{fmt.value(v.value)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {[...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV]
                .filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()))
                .length > 0 && (
                <Command.Group heading="Go to" className={groupCls}>
                  {[...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV]
                    .filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()))
                    .map((i) => (
                      <Command.Item key={i.to} value={`nav-${i.to}`} onSelect={() => go(i.to)} className={itemCls}>
                        <i.icon className="text-fg-subtle" />
                        <span className="flex-1">{i.label}</span>
                        {i.shortcut && <span className="flex gap-0.5">{i.shortcut.split(' ').map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                      </Command.Item>
                    ))}
                </Command.Group>
              )}
              {(() => {
                const ql = q.toLowerCase();
                const ls = leagues.filter((l) => !q || l.name.toLowerCase().includes(ql) || 'league'.includes(ql));
                const actions = [
                  { id: 'trade', label: 'New trade', icon: <Plus className="text-fg-subtle" />, run: () => go('/trade') },
                  { id: 'bet', label: 'Log a bet', icon: <Plus className="text-fg-subtle" />, run: () => go('/betting?tab=tracker') },
                  { id: 'theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`, icon: theme === 'dark' ? <Sun className="text-fg-subtle" /> : <Moon className="text-fg-subtle" />, run: () => { toggleTheme(); setOpen(false); } },
                ].filter((a) => !q || a.label.toLowerCase().includes(ql));
                return (
                  <>
                    {ls.length > 0 && (
                      <Command.Group heading="Leagues" className={groupCls}>
                        {ls.map((l) => (
                          <Command.Item key={l.id} value={`league-${l.id}`} onSelect={() => { setActive(l.id); setOpen(false); setQ(''); }} className={itemCls}>
                            <Trophy className="text-fg-subtle" />
                            <span className="flex-1">Switch to {l.name}</span>
                            <ArrowRight className="text-fg-subtle" />
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {actions.length > 0 && (
                      <Command.Group heading="Actions" className={groupCls}>
                        {actions.map((a) => <Command.Item key={a.id} value={`action-${a.id}`} onSelect={a.run} className={itemCls}>{a.icon} {a.label}</Command.Item>)}
                      </Command.Group>
                    )}
                  </>
                );
              })()}
            </Command.List>
            <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-2xs text-fg-subtle">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
              <span className="ml-auto flex items-center gap-1"><Kbd>G</Kbd> then a letter jumps to a page</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
