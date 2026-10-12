import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Density = 'compact' | 'comfortable';

interface UiState {
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
  liveData: boolean;
  nflverseStats: boolean;
  commandOpen: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setDensity: (d: Density) => void;
  toggleSidebar: () => void;
  setLiveData: (v: boolean) => void;
  setNflverseStats: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      density: 'compact',
      sidebarCollapsed: false,
      liveData: import.meta.env.MODE !== 'artifact',
      nflverseStats: false,
      commandOpen: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setDensity: (density) => set({ density }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setLiveData: (liveData) => set({ liveData }),
      setNflverseStats: (nflverseStats) => set({ nflverseStats }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    { name: 'ge:ui', partialize: ({ commandOpen, ...rest }) => { void commandOpen; return rest; } },
  ),
);
