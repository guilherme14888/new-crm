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

/**
 * Store Zustand para estado de UI transitório.
 * Gerencia drag-and-drop do kanban, toasts, indicador de sincronização e estado da sidebar.
 */
export const useUIStore = create<UIState>((set) => ({
  isDragging: false,
  dragDealId: null,
  activeFunnelStageIndex: 0,
  toastMessage: null,
  syncIndicator: 'synced',
  openDealId: null,
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  /** Alterna o estado recolhido/expandido da sidebar */
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  /** Abre ou fecha a sidebar no layout mobile */
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

  /** Inicia/encerra o arraste de um deal no kanban (null = sem arraste) */
  setDragging: (dealId) => set({ isDragging: dealId !== null, dragDealId: dealId }),
  /** Define o índice do estágio de funnel ativo na visualização */
  setActiveFunnelStage: (index) => set({ activeFunnelStageIndex: index }),
  /** Exibe um toast por 3 segundos, reiniciando o timer se já houver um ativo */
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => { set({ toastMessage: null }); toastTimer = null; }, 3000);
  },
  /** Oculta o toast imediatamente e cancela o timer pendente */
  dismissToast: () => {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    set({ toastMessage: null });
  },
  /** Atualiza o indicador de status de sincronização (synced/pending/offline/error) */
  setSyncIndicator: (status) => set({ syncIndicator: status }),
  /** Abre o painel de detalhes do deal informado */
  openDeal: (id) => set({ openDealId: id }),
  /** Fecha o painel de detalhes do deal */
  closeDeal: () => set({ openDealId: null }),
}));
