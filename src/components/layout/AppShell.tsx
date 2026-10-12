import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileTabBar } from './MobileTabBar';
import { CommandPalette } from './CommandPalette';
import { useUi } from '@/store/ui';
import { useLeagues } from '@/store/leagues';
import { useBets } from '@/store/bets';
import { useCore } from '@/data/queries';
import { buildDemoLeagues, demoBets } from '@/data/demo';
import { configureRepository } from '@/data/repository';

export function AppShell() {
  const theme = useUi((s) => s.theme);
  const liveData = useUi((s) => s.liveData);
  const nflverseStats = useUi((s) => s.nflverseStats);
  const core = useCore();
  const seedLeagues = useLeagues((s) => s.seed);
  const seedBets = useBets((s) => s.seed);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f6f7f9');
  }, [theme]);

  useEffect(() => configureRepository({ live: liveData, nflverseStats }), [liveData, nflverseStats]);

  useEffect(() => {
    if (core.data) seedLeagues(buildDemoLeagues(core.data.data));
    seedBets(demoBets());
  }, [core.data, seedLeagues, seedBets]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">Skip to content</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname.split('/').slice(0, 2).join('/') + (location.pathname.split('/')[2] ?? '')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileTabBar />
      <CommandPalette />
    </div>
  );
}
