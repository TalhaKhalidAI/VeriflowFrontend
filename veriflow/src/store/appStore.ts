import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  isApiOffline: boolean;
  apiOfflineMessage: string | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setApiOffline: (offline: boolean, message?: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileSidebarOpen: false,
      isApiOffline: false,
      apiOfflineMessage: null,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setApiOffline: (offline: boolean, message?: string | null) =>
        set({
          isApiOffline: offline,
          apiOfflineMessage: offline
            ? message || 'Backend API server is unreachable. Check your network or server status.'
            : null,
        }),
    }),
    {
      name: 'veriflow-app-settings',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        mobileSidebarOpen: state.mobileSidebarOpen,
      }),
    }
  )
);
