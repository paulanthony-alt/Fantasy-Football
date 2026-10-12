import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedTrade, TradeAsset } from '@/data/types';

interface TradeState {
  /** Builder state per league so switching leagues keeps each draft. */
  drafts: Record<string, { teamIds: string[]; assets: TradeAsset[] }>;
  history: SavedTrade[];
  setDraft: (leagueId: string, d: { teamIds: string[]; assets: TradeAsset[] }) => void;
  clearDraft: (leagueId: string) => void;
  save: (t: SavedTrade) => void;
  removeSaved: (id: string) => void;
}

export const useTrades = create<TradeState>()(
  persist(
    (set, get) => ({
      drafts: {},
      history: [],
      setDraft: (leagueId, d) => set({ drafts: { ...get().drafts, [leagueId]: d } }),
      clearDraft: (leagueId) => {
        const drafts = { ...get().drafts };
        delete drafts[leagueId];
        set({ drafts });
      },
      save: (t) => set({ history: [t, ...get().history].slice(0, 100) }),
      removeSaved: (id) => set({ history: get().history.filter((h) => h.id !== id) }),
    }),
    { name: 'ge:trades', version: 1 },
  ),
);
