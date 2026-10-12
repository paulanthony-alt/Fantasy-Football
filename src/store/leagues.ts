import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { League, LeagueTeam, Strategy } from '@/data/types';

interface LeagueState {
  leagues: League[];
  activeId: string | null;
  seeded: boolean;
  setActive: (id: string) => void;
  upsert: (l: League) => void;
  remove: (id: string) => void;
  patch: (id: string, p: Partial<League>) => void;
  setStrategy: (id: string, s: Strategy) => void;
  updateTeam: (leagueId: string, teamId: string, p: Partial<LeagueTeam>) => void;
  seed: (ls: League[]) => void;
}

export const useLeagues = create<LeagueState>()(
  persist(
    (set, get) => ({
      leagues: [],
      activeId: null,
      seeded: false,
      setActive: (activeId) => set({ activeId }),
      upsert: (l) => {
        const exists = get().leagues.some((x) => x.id === l.id);
        set({ leagues: exists ? get().leagues.map((x) => (x.id === l.id ? { ...l, updatedAt: Date.now() } : x)) : [...get().leagues, l], activeId: l.id });
      },
      remove: (id) => {
        const leagues = get().leagues.filter((l) => l.id !== id);
        set({ leagues, activeId: get().activeId === id ? leagues[0]?.id ?? null : get().activeId });
      },
      patch: (id, p) => set({ leagues: get().leagues.map((l) => (l.id === id ? { ...l, ...p, updatedAt: Date.now() } : l)) }),
      setStrategy: (id, strategy) => get().patch(id, { strategy }),
      updateTeam: (leagueId, teamId, p) =>
        set({
          leagues: get().leagues.map((l) =>
            l.id === leagueId ? { ...l, updatedAt: Date.now(), rosters: l.rosters.map((t) => (t.id === teamId ? { ...t, ...p } : t)) } : l,
          ),
        }),
      seed: (ls) => {
        if (get().seeded && get().leagues.length) return;
        set({ leagues: ls, activeId: ls[0]?.id ?? null, seeded: true });
      },
    }),
    { name: 'ge:leagues', version: 1 },
  ),
);

export function useActiveLeague(): League | null {
  return useLeagues((s) => s.leagues.find((l) => l.id === s.activeId) ?? s.leagues[0] ?? null);
}
