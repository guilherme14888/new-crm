import { create } from 'zustand';
import { Platform } from 'react-native';
import { Funnel, FunnelStage, WinLossReason } from '../types/models';
import { useUIStore } from './uiStore';
import { DEFAULT_FUNNEL_ID } from '../db/schema';
import {
  apiGetFunnels, apiCreateFunnel, apiUpdateFunnel, apiDeleteFunnel, apiSetDefaultFunnel,
  apiCreateStage, apiUpdateStage, apiDeleteStage, apiReorderStages,
  apiGetWinLossReasons, apiCreateWinLossReason, apiUpdateWinLossReason, apiDeleteWinLossReason,
} from '../services/apiDataService';

interface FunnelState {
  funnels: Funnel[];
  activeFunnelId: string;
  winLossReasons: WinLossReason[];
  isLoading: boolean;

  activeFunnel: () => Funnel | null;
  activeStages: () => FunnelStage[];
  wonStage: () => FunnelStage | null;
  lostStage: () => FunnelStage | null;

  loadFunnels: () => Promise<void>;
  loadWinLossReasons: () => Promise<void>;
  setActiveFunnel: (id: string) => void;

  createFunnel: (data: { name: string; description?: string }) => Promise<Funnel>;
  updateFunnel: (id: string, patch: Partial<Pick<Funnel, 'name' | 'description' | 'isActive'>>) => Promise<void>;
  deleteFunnel: (id: string) => Promise<void>;
  setDefaultFunnel: (id: string) => Promise<void>;

  createStage: (data: Omit<FunnelStage, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FunnelStage>;
  updateStage: (funnelId: string, stageId: string, patch: Partial<Omit<FunnelStage, 'id' | 'funnelId' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteStage: (funnelId: string, stageId: string) => Promise<void>;
  reorderStages: (funnelId: string, orderedIds: string[]) => Promise<void>;

  createWinLossReason: (data: { type: 'won' | 'lost'; label: string }) => Promise<void>;
  updateWinLossReason: (id: string, label: string) => Promise<void>;
  deleteWinLossReason: (id: string) => Promise<void>;
}

/**
 * Store Zustand para gerenciamento de funnels de vendas e estágios.
 * Carrega do backend (web) ou SQLite (mobile) e gerencia o funnel ativo.
 */
export const useFunnelStore = create<FunnelState>((set, get) => ({
  funnels: [],
  activeFunnelId: DEFAULT_FUNNEL_ID,
  winLossReasons: [],
  isLoading: false,

  /** Retorna o funnel atualmente ativo */
  activeFunnel: () => get().funnels.find((f) => f.id === get().activeFunnelId) ?? null,

  /** Retorna os estágios do funnel ativo */
  activeStages: () => get().activeFunnel()?.stages ?? [],

  /** Retorna o estágio de ganho (type='won') do funnel ativo */
  wonStage: () => get().activeStages().find((s) => s.type === 'won') ?? null,

  /** Retorna o estágio de perda (type='lost') do funnel ativo */
  lostStage: () => get().activeStages().find((s) => s.type === 'lost') ?? null,

  /** Carrega todos os funnels da API/banco e define o funnel padrão como ativo */
  loadFunnels: async () => {
    set({ isLoading: true });
    try {
      if (Platform.OS === 'web') {
        const funnels = await apiGetFunnels();
        const defaultFunnel = funnels.find((f) => f.isDefault) ?? funnels[0];
        set({ funnels, activeFunnelId: defaultFunnel?.id ?? DEFAULT_FUNNEL_ID });
      } else {
        const { getAllFunnels } = await import('../db/funnelRepo');
        const funnels = await getAllFunnels();
        const defaultFunnel = funnels.find((f) => f.isDefault) ?? funnels[0];
        set({ funnels, activeFunnelId: defaultFunnel?.id ?? DEFAULT_FUNNEL_ID });
      }
    } catch {
      useUIStore.getState().showToast('Failed to load funnels');
    } finally {
      set({ isLoading: false });
    }
  },

  /** Carrega motivos de ganho/perda do servidor ou banco local */
  loadWinLossReasons: async () => {
    try {
      if (Platform.OS === 'web') {
        const winLossReasons = await apiGetWinLossReasons();
        set({ winLossReasons });
      } else {
        const { getWinLossReasons } = await import('../db/funnelRepo');
        set({ winLossReasons: await getWinLossReasons() });
      }
    } catch {
      useUIStore.getState().showToast('Failed to load reasons');
    }
  },

  /** Define qual funnel está ativo para exibição no kanban e listagens */
  setActiveFunnel: (id) => set({ activeFunnelId: id }),

  /** Cria um novo funnel via API/banco */
  createFunnel: async (data) => {
    if (Platform.OS === 'web') {
      const funnel = await apiCreateFunnel(data);
      set((s) => ({ funnels: [...s.funnels, funnel] }));
      return funnel;
    }
    const { createFunnel: repo } = await import('../db/funnelRepo');
    const funnel = await repo(data);
    set((s) => ({ funnels: [...s.funnels, funnel] }));
    return funnel;
  },

  /** Atualiza propriedades de um funnel existente (nome, descrição, ativo) */
  updateFunnel: async (id, patch) => {
    if (Platform.OS === 'web') {
      await apiUpdateFunnel(id, patch);
    } else {
      const { updateFunnel: repo } = await import('../db/funnelRepo');
      await repo(id, patch);
    }
    set((s) => ({ funnels: s.funnels.map((f) => f.id === id ? { ...f, ...patch } : f) }));
  },

  /** Deleta um funnel e alterna para o funnel padrão se era o ativo */
  deleteFunnel: async (id) => {
    if (Platform.OS === 'web') {
      await apiDeleteFunnel(id);
    } else {
      const { deleteFunnel: repo } = await import('../db/funnelRepo');
      await repo(id);
    }
    set((s) => ({
      funnels: s.funnels.filter((f) => f.id !== id),
      activeFunnelId: s.activeFunnelId === id
        ? (s.funnels.find((f) => f.isDefault && f.id !== id)?.id ?? DEFAULT_FUNNEL_ID)
        : s.activeFunnelId,
    }));
  },

  /** Define um funnel como padrão e marca todos os outros como não-padrão */
  setDefaultFunnel: async (id) => {
    if (Platform.OS === 'web') {
      await apiSetDefaultFunnel(id);
    } else {
      const { setDefaultFunnel: repo } = await import('../db/funnelRepo');
      await repo(id);
    }
    set((s) => ({ funnels: s.funnels.map((f) => ({ ...f, isDefault: f.id === id })) }));
  },

  /** Cria um novo estágio dentro de um funnel */
  createStage: async (data) => {
    if (Platform.OS === 'web') {
      const stage = await apiCreateStage(data);
      set((s) => ({
        funnels: s.funnels.map((f) =>
          f.id === data.funnelId ? { ...f, stages: [...f.stages, stage] } : f
        ),
      }));
      return stage;
    }
    const { createStage: repo } = await import('../db/funnelRepo');
    const stage = await repo(data);
    set((s) => ({
      funnels: s.funnels.map((f) =>
        f.id === data.funnelId ? { ...f, stages: [...f.stages, stage] } : f
      ),
    }));
    return stage;
  },

  /** Atualiza propriedades de um estágio (nome, cor, probabilidade, tipo, etc.) */
  updateStage: async (funnelId, stageId, patch) => {
    if (Platform.OS === 'web') {
      await apiUpdateStage(stageId, patch);
    } else {
      const { updateStage: repo } = await import('../db/funnelRepo');
      await repo(stageId, patch);
    }
    set((s) => ({
      funnels: s.funnels.map((f) =>
        f.id === funnelId
          ? { ...f, stages: f.stages.map((st) => st.id === stageId ? { ...st, ...patch } : st) }
          : f
      ),
    }));
  },

  /** Remove um estágio de um funnel */
  deleteStage: async (funnelId, stageId) => {
    if (Platform.OS === 'web') {
      await apiDeleteStage(funnelId, stageId);
    } else {
      const { deleteStage: repo } = await import('../db/funnelRepo');
      await repo(stageId);
    }
    set((s) => ({
      funnels: s.funnels.map((f) =>
        f.id === funnelId ? { ...f, stages: f.stages.filter((st) => st.id !== stageId) } : f
      ),
    }));
  },

  /** Reordena os estágios de um funnel de acordo com a ordem passada */
  reorderStages: async (funnelId, orderedIds) => {
    if (Platform.OS === 'web') {
      await apiReorderStages(funnelId, orderedIds);
    } else {
      const { reorderStages: repo } = await import('../db/funnelRepo');
      await repo(funnelId, orderedIds);
    }
    set((s) => ({
      funnels: s.funnels.map((f) => {
        if (f.id !== funnelId) return f;
        const stageMap = Object.fromEntries(f.stages.map((st) => [st.id, st]));
        const reordered = orderedIds.map((id, i) => ({ ...stageMap[id], order: i })).filter(Boolean);
        return { ...f, stages: reordered };
      }),
    }));
  },

  /** Cria um novo motivo de ganho ou perda */
  createWinLossReason: async (data) => {
    if (Platform.OS === 'web') {
      const reason = await apiCreateWinLossReason(data);
      set((s) => ({ winLossReasons: [...s.winLossReasons, reason] }));
      return;
    }
    const { createWinLossReason: repo } = await import('../db/funnelRepo');
    const reason = await repo(data);
    set((s) => ({ winLossReasons: [...s.winLossReasons, reason] }));
  },

  /** Atualiza o rótulo de um motivo de ganho/perda existente */
  updateWinLossReason: async (id, label) => {
    if (Platform.OS === 'web') {
      const updated = await apiUpdateWinLossReason(id, label);
      set((s) => ({ winLossReasons: s.winLossReasons.map((r) => r.id === id ? updated : r) }));
    } else {
      set((s) => ({ winLossReasons: s.winLossReasons.map((r) => r.id === id ? { ...r, label } : r) }));
    }
  },

  /** Remove um motivo de ganho ou perda */
  deleteWinLossReason: async (id) => {
    if (Platform.OS === 'web') {
      await apiDeleteWinLossReason(id);
    } else {
      const { deleteWinLossReason: repo } = await import('../db/funnelRepo');
      await repo(id);
    }
    set((s) => ({ winLossReasons: s.winLossReasons.filter((r) => r.id !== id) }));
  },
}));
