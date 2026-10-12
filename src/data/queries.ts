import { useQuery } from '@tanstack/react-query';
import { repository } from './repository';
import { useUi } from '@/store/ui';
import type { CoreData } from './sources/types';

const MIN = 60_000;

export function useCore() {
  const live = useUi((s) => s.liveData);
  return useQuery({ queryKey: ['core', live], queryFn: () => repository.core(), staleTime: 15 * MIN });
}

export function useGameLogs(playerId: string | undefined, core: CoreData | undefined) {
  const nflverse = useUi((s) => s.nflverseStats);
  return useQuery({
    queryKey: ['logs', playerId, nflverse],
    queryFn: () => repository.gameLogs(playerId!, core!),
    enabled: !!playerId && !!core,
    staleTime: 30 * MIN,
  });
}

export function useAllLogs() {
  return useQuery({ queryKey: ['all-logs'], queryFn: () => repository.allLogs(), staleTime: Infinity });
}

export function useOdds(week: number | undefined) {
  return useQuery({ queryKey: ['odds', week], queryFn: () => repository.odds(week!), enabled: !!week, staleTime: 5 * MIN, refetchInterval: 5 * MIN });
}

export function useProps(week: number | undefined) {
  return useQuery({ queryKey: ['props', week], queryFn: () => repository.props(week!), enabled: !!week, staleTime: 5 * MIN });
}

export function useNews(core: CoreData | undefined) {
  const live = useUi((s) => s.liveData);
  return useQuery({ queryKey: ['news', live], queryFn: () => repository.news(core!), enabled: !!core, staleTime: 10 * MIN, refetchInterval: 10 * MIN });
}

export function useTrending(core: CoreData | undefined) {
  const live = useUi((s) => s.liveData);
  return useQuery({ queryKey: ['trending', live], queryFn: () => repository.trending(core!), enabled: !!core, staleTime: 30 * MIN });
}
