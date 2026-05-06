import { useDealStore } from '../stores/dealStore';
import { DealStage } from '../types/models';

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

export function useStageDeals(stage: DealStage) {
  const dealsByStage = useDealStore((s) => s.dealsByStage());
  return dealsByStage[stage] ?? [];
}
