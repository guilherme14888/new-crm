import { useDealStore } from '../stores/dealStore';
import { DealStage } from '../types/models';

/** Hook que expõe os deals e os agrupados por estágio, além das actions do dealStore (carregar, criar, atualizar, mover, excluir) */
export function useDeals() {
  const store = useDealStore();
  return {
    deals: store.deals,
    dealsByStage: store.dealsByStage(),
    isLoading: store.isLoading,
    loadDeals: store.loadDeals,
    createDeal: store.createDeal,
    updateDeal: store.updateDeal,
    moveDeal: store.moveDeal,
    deleteDeal: store.deleteDeal,
  };
}

/** Hook que retorna apenas os deals de um estágio específico do pipeline */
export function useStageDeals(stage: DealStage) {
  const dealsByStage = useDealStore((s) => s.dealsByStage());
  return dealsByStage[stage] ?? [];
}
