import { Moon, Search, Sun } from 'lucide-react';
import { useUi } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip } from '@/components/ui/tooltip';
import { LeagueSwitcher } from './LeagueSwitcher';
import { LeagueSettingsPopover } from './LeagueSettingsPopover';
import { useCore } from '@/data/queries';
import { Logo } from './Logo';

export function TopBar() {
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const open = useUi((s) => s.setCommandOpen);
  const core = useCore();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
      <Logo collapsed className="md:hidden" />
      <LeagueSwitcher />
      <button
        onClick={() => open(true)}
        className="ml-auto hidden h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted lg:flex"
      >
        <Search className="size-4" />
        Search players, teams, tools…
        <span className="ml-auto flex gap-0.5"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
      </button>
      <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
        {core.data && (
          <span className="num hidden h-9 items-center rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold text-fg-muted xl:inline-flex">
            Week {core.data.data.week} <span className="mx-1.5 text-fg-subtle">·</span> {core.data.data.season}
          </span>
        )}
        <Button variant="secondary" size="icon" className="lg:hidden" onClick={() => open(true)} aria-label="Search">
          <Search />
        </Button>
        <LeagueSettingsPopover />
        <Tooltip content={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          <Button variant="secondary" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
