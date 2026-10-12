import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bet } from '@/data/types';

interface BetState {
  bets: Bet[];
  seeded: boolean;
  add: (b: Bet) => void;
  update: (id: string, p: Partial<Bet>) => void;
  remove: (id: string) => void;
  seed: (bs: Bet[]) => void;
}

export const useBets = create<BetState>()(
  persist(
    (set, get) => ({
      bets: [],
      seeded: false,
      add: (b) => set({ bets: [b, ...get().bets] }),
      update: (id, p) => set({ bets: get().bets.map((b) => (b.id === id ? { ...b, ...p } : b)) }),
      remove: (id) => set({ bets: get().bets.filter((b) => b.id !== id) }),
      seed: (bs) => {
        if (get().seeded) return;
        set({ bets: bs, seeded: true });
      },
    }),
    { name: 'ge:bets', version: 1 },
  ),
);
