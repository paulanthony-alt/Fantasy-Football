import { Check, ChevronsUpDown, Download, Plus, Settings2, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLeagues, useActiveLeague } from '@/store/leagues';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MODE_LABEL, leagueFormat } from '@/lib/league';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function ModeChips({ mode, superflex, className }: { mode: keyof typeof MODE_LABEL; superflex: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Badge tone={mode === 'dynasty' ? 'accent' : mode === 'keeper' ? 'warn' : 'neutral'}>{MODE_LABEL[mode]}</Badge>
      {superflex && <Badge tone="outline">SF</Badge>}
    </span>
  );
}

export function LeagueSwitcher() {
  const leagues = useLeagues((s) => s.leagues);
  const setActive = useLeagues((s) => s.setActive);
  const active = useActiveLeague();
  const nav = useNavigate();
  if (!active) return <Skeleton className="h-9 w-56" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="group flex h-10 min-w-0 max-w-[340px] items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2.5 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Switch league">
          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-accent/12 text-accent">
            <Trophy className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{active.name}</span>
              <ModeChips mode={active.mode} superflex={active.superflex} className="hidden sm:inline-flex" />
            </div>
            <div className="hidden truncate text-2xs text-fg-subtle sm:block">{leagueFormat(active)}</div>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel>Your leagues</DropdownMenuLabel>
        {leagues.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => setActive(l.id)} className="items-start py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{l.name}</span>
                <ModeChips mode={l.mode} superflex={l.superflex} />
              </div>
              <div className="truncate text-2xs text-fg-subtle">{leagueFormat(l)} · {l.platform === 'sleeper' ? 'Sleeper' : l.platform === 'demo' ? 'Demo' : 'Manual'}</div>
            </div>
            {l.id === active.id && <Check className="mt-0.5 size-4 !text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => nav('/leagues?import=sleeper')}>
          <Download /> Import from Sleeper
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => nav('/leagues?new=1')}>
          <Plus /> Create league manually
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => nav('/leagues')}>
          <Settings2 /> Manage leagues
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
