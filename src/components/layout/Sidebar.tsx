import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { Tooltip } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { FOOTER_NAV, NAV_GROUPS, type NavItem } from './nav';
import { Logo } from './Logo';
import { useActiveLeague } from '@/store/leagues';

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-accent/10 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r bg-accent" aria-hidden />}
          <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-accent' : 'text-fg-subtle group-hover:text-fg-muted')} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link;
}

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const league = useActiveLeague();
  const myTeam = league?.rosters.find((t) => t.id === league.myTeamId);
  return (
    <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface-1 transition-[width] duration-200 ease-out md:flex', collapsed ? 'w-[68px]' : 'w-sidebar')}>
      <div className={cn('flex h-14 items-center border-b border-border px-4', collapsed && 'justify-center px-0')}>
        <Logo collapsed={collapsed} />
      </div>
      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Primary">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            {!collapsed && <div className="label-caps mb-1.5 px-2.5">{g.label}</div>}
            <div className="space-y-0.5">{g.items.map((i) => <Item key={i.to} item={i} collapsed={collapsed} />)}</div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border px-3 py-3">
        {FOOTER_NAV.map((i) => <Item key={i.to} item={i} collapsed={collapsed} />)}
        {!collapsed && myTeam && (
          <div className="mt-2 rounded-md border border-border bg-surface-2/60 px-3 py-2">
            <div className="truncate text-xs font-semibold">{myTeam.name}</div>
            <div className="num text-2xs text-fg-subtle">{myTeam.record ? `${myTeam.record.w}–${myTeam.record.l}` : 'No record'} · {league?.name}</div>
          </div>
        )}
        <button onClick={toggle} className={cn('mt-1 flex h-8 w-full items-center gap-3 rounded-md px-2.5 text-xs text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && (
            <>
              Collapse <Kbd className="ml-auto">[</Kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
