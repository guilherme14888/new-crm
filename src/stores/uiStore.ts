import { create } from 'zustand';

type SyncIndicator = 'synced' | 'pending' | 'offline' | 'error';

interface UIState {
  isDragging: boolean;
  dragDealId: string | null;
  activeFunnelStageIndex: number;
  toastMessage: string | null;
  syncIndicator: SyncIndicator;
  openDealId: string | null;

  // Sidebar
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;

  setDragging: (dealId: string | null) => void;
  setActiveFunnelStage: (index: number) => void;
  showToast: (msg: string) => void;
  dismissToast: () => void;
  setSyncIndicator: (status: SyncIndicator) => void;
  openDeal: (id: string) => void;
  closeDeal: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>((set) => ({
  isDragging: false,
  dragDealId: null,
  activeFunnelStageIndex: 0,
  toastMessage: null,
  syncIndicator: 'synced',
  openDealId: null,
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

  setDragging: (dealId) => set({ isDragging: dealId !== null, dragDealId: dealId }),
  setActiveFunnelStage: (index) => set({ activeFunnelStageIndex: index }),
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => { set({ toastMessage: null }); toastTimer = null; }, 3000);
  },
  dismissToast: () => {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    set({ toastMessage: null });
  },
  setSyncIndicator: (status) => set({ syncIndicator: status }),
  openDeal: (id) => set({ openDealId: id }),
  closeDeal: () => set({ openDealId: null }),
}));
