import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchState {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

export const useWatchlist = create<WatchState>()(
  persist(
    (set, get) => ({
      ids: ['malik-nabers', 'jeremiyah-love', 'tetairoa-mcmillan', 'colston-loveland'],
      toggle: (id) => set({ ids: get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [id, ...get().ids] }),
      has: (id) => get().ids.includes(id),
    }),
    { name: 'ge:watchlist', version: 1 },
  ),
);
