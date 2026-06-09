import { create } from 'zustand';
import { Platform } from 'react-native';
import { Deal, DealStage, DashboardMetrics } from '../types/models';
import * as dealRepo from '../db/dealRepo';
import * as activityRepo from '../db/activityRepo';
import {
  apiGetDeals, apiCreateDeal, apiUpdateDeal, apiMoveDeal, apiDeleteDeal,
} from '../services/apiDataService';
import { now, startOfMonth } from '../utils/date';
import { useUIStore } from './uiStore';
import { PIPELINE_STAGES } from '../constants/pipeline';
import { DEFAULT_FUNNEL_ID } from '../db/schema';

interface DealState {
  deals: Deal[];
  isLoading: boolean;
  activeFunnelId: string;

  setActiveFunnelId: (id: string) => void;
  dealsByStage: () => Record<DealStage, Deal[]>;
  dealsByStageId: () => Record<string, Deal[]>;
  dealsForFunnel: (funnelId: string) => Deal[];
  metrics: () => DashboardMetrics;

  loadDeals: () => Promise<void>;
  createDeal: (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt' | 'stageOrder' | 'stageChangedAt'>) => Promise<Deal>;
  updateDeal: (id: string, patch: Partial<Deal>) => Promise<void>;
  moveDeal: (id: string, newStage: DealStage, newOrder: number, contactId: string, newStageId?: string) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
}

/**
 * Store Zustand para gerenciamento de deals (oportunidades).
 * Sincroniza com API (web) ou SQLite (mobile) e fornece métodos de filtro e cálculo de métricas.
 */
export const useDealStore = create<DealState>((set, get) => ({
  deals: [],
  isLoading: false,
  activeFunnelId: DEFAULT_FUNNEL_ID,

  /** Altera o funnel ativo para filtrar deals */
  setActiveFunnelId: (id) => set({ activeFunnelId: id }),

  /** Retorna deals do funnel ativo, excluindo deletados logicamente */
  dealsForFunnel: (funnelId) =>
    get().deals.filter((d) => !d.deletedAt && (d.funnelId === funnelId || (!d.funnelId && funnelId === DEFAULT_FUNNEL_ID))),

  /** Agrupa deals por stageId (para kanban com estágios customizados) e ordena por stageOrder */
  dealsByStageId: () => {
    const result: Record<string, Deal[]> = {};
    const funnelDeals = get().dealsForFunnel(get().activeFunnelId);
    for (const deal of funnelDeals) {
      const key = deal.stageId || deal.stage;
      if (!result[key]) result[key] = [];
      result[key].push(deal);
    }
    for (const key of Object.keys(result)) {
      result[key].sort((a, b) => a.stageOrder - b.stageOrder);
    }
    return result;
  },

  /** Agrupa deals por stage (legacy DealStage) e ordena por stageOrder */
  dealsByStage: () => {
    const result = {} as Record<DealStage, Deal[]>;
    PIPELINE_STAGES.forEach((s) => { result[s.key] = []; });
    for (const deal of get().deals) {
      if (!result[deal.stage]) result[deal.stage] = [];
      result[deal.stage].push(deal);
    }
    for (const stage of Object.keys(result) as DealStage[]) {
      result[stage].sort((a, b) => a.stageOrder - b.stageOrder);
    }
    return result;
  },

  /**
   * Calcula métricas do dashboard: total de leads, deals, valor do pipeline,
   * ganhos/perdidos no mês, taxa de conversão e breakdown por estágio.
   */
  metrics: () => {
    const { deals } = get();
    const monthStart = startOfMonth();
    const active = deals.filter((d) => !d.deletedAt);
    const byStage: DashboardMetrics['dealsByStage'] = {};
    PIPELINE_STAGES.forEach((s) => { byStage[s.key] = { count: 0, value: 0 }; });
    for (const d of active) {
      if (!byStage[d.stage]) byStage[d.stage] = { count: 0, value: 0 };
      byStage[d.stage]!.count++;
      byStage[d.stage]!.value += d.value;
    }
    const totalPipelineValue = active
      .filter((d) => d.stage !== 'closed_lost')
      .reduce((sum, d) => sum + d.value, 0);
    const wonThisMonth = active
      .filter((d) => d.stage === 'closed_won' && d.updatedAt >= monthStart)
      .reduce((sum, d) => sum + d.value, 0);
    const lostThisMonth = active
      .filter((d) => d.stage === 'closed_lost' && d.updatedAt >= monthStart)
      .reduce((sum, d) => sum + d.value, 0);
    const closed = active.filter(
      (d) => d.stage === 'closed_won' || d.stage === 'closed_lost'
    ).length;
    const conversionRate = closed > 0
      ? (active.filter((d) => d.stage === 'closed_won').length / closed) * 100
      : 0;
    return {
      totalLeads: active.length,
      totalDeals: active.filter((d) => d.stage !== 'qualification').length,
      totalPipelineValue,
      wonThisMonth,
      lostThisMonth,
      conversionRate,
      dealsByStage: byStage,
    };
  },

  /** Carrega todos os deals da API (web) ou SQLite (mobile) */
  loadDeals: async () => {
    set({ isLoading: true });
    try {
      if (Platform.OS === 'web') {
        const deals = await apiGetDeals();
        set({ deals });
      } else {
        const deals = await dealRepo.getAllDeals();
        set({ deals });
      }
    } catch {
      useUIStore.getState().showToast('Failed to load deals');
    } finally {
      set({ isLoading: false });
    }
  },

  /** Cria um novo deal via API/banco e o adiciona ao estado */
  createDeal: async (data) => {
    try {
      if (Platform.OS === 'web') {
        const deal = await apiCreateDeal(data);
        set((s) => ({ deals: [...s.deals, deal] }));
        return deal;
      }
      const deal = await dealRepo.createDeal(data);
      set((s) => ({ deals: [...s.deals, deal] }));
      return deal;
    } catch {
      useUIStore.getState().showToast('Failed to create deal');
      throw new Error('Failed to create deal');
    }
  },

  /** Atualiza campos de um deal existente e marca como pendente de sincronização */
  updateDeal: async (id, patch) => {
    try {
      if (Platform.OS === 'web') {
        await apiUpdateDeal(id, patch);
      } else {
        await dealRepo.updateDeal(id, patch);
      }
      set((s) => ({
        deals: s.deals.map((d) =>
          d.id === id ? { ...d, ...patch, syncStatus: 'pending_push' as const } : d
        ),
      }));
    } catch {
      useUIStore.getState().showToast('Failed to update deal');
    }
  },

  /**
   * Move um deal para um novo estágio com nova ordem de visualização.
   * Cria atividade de mudança de estágio no mobile.
   */
  moveDeal: async (id, newStage, newOrder, contactId, newStageId) => {
    const deal = get().deals.find((d) => d.id === id);
    if (!deal) return;
    try {
      if (Platform.OS === 'web') {
        await apiMoveDeal(id, newStage, newStageId ?? newStage, newOrder);
      } else {
        await dealRepo.moveDeal(id, newStage, newOrder, newStageId);
        await activityRepo.createActivity({
          dealId: id,
          contactId,
          type: 'stage_change',
          title: `Moved to ${newStage}`,
          description: null,
          occurredAt: now(),
          metadata: { fromStage: deal.stage, toStage: newStage },
        });
      }
      set((s) => ({
        deals: s.deals.map((d) =>
          d.id === id
            ? { ...d, stage: newStage, stageId: newStageId ?? d.stageId, stageOrder: newOrder, syncStatus: 'pending_push' as const }
            : d
        ),
      }));
    } catch {
      useUIStore.getState().showToast('Failed to move deal');
    }
  },

  /** Remove um deal (soft delete) via API/banco */
  deleteDeal: async (id) => {
    try {
      if (Platform.OS === 'web') {
        await apiDeleteDeal(id);
      } else {
        await dealRepo.deleteDeal(id);
      }
      set((s) => ({ deals: s.deals.filter((d) => d.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Failed to delete deal');
    }
  },
}));
