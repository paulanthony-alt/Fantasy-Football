import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/common/states';
import { useUi } from '@/store/ui';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const Players = lazy(() => import('@/features/players/PlayersPage'));
const PlayerDetail = lazy(() => import('@/features/players/PlayerDetailPage'));
const Matchups = lazy(() => import('@/features/matchups/MatchupsPage'));
const Lineup = lazy(() => import('@/features/lineup/LineupPage'));
const Trade = lazy(() => import('@/features/trade/TradePage'));
const Betting = lazy(() => import('@/features/betting/BettingPage'));
const Waivers = lazy(() => import('@/features/waivers/WaiversPage'));
const News = lazy(() => import('@/features/news/NewsPage'));
const Leagues = lazy(() => import('@/features/leagues/LeaguesPage'));
const Settings = lazy(() => import('@/features/settings/SettingsPage'));
const NotFound = lazy(() => import('@/features/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export function App() {
  const theme = useUi((s) => s.theme);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250} skipDelayDuration={100}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<AppShell />}>
              {[
                ['/', Dashboard],
                ['/players', Players],
                ['/players/:id', PlayerDetail],
                ['/matchups', Matchups],
                ['/lineup', Lineup],
                ['/trade', Trade],
                ['/betting', Betting],
                ['/waivers', Waivers],
                ['/news', News],
                ['/leagues', Leagues],
                ['/settings', Settings],
                ['*', NotFound],
              ].map(([path, C]) => {
                const Page = C as React.ComponentType;
                return (
                  <Route
                    key={path as string}
                    path={path as string}
                    element={
                      <Suspense fallback={<PageSkeleton />}>
                        <Page />
                      </Suspense>
                    }
                  />
                );
              })}
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          theme={theme}
          position="bottom-right"
          toastOptions={{ classNames: { toast: '!bg-surface-1 !border-border-strong !text-fg !shadow-e3 !rounded-lg', description: '!text-fg-subtle' } }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
