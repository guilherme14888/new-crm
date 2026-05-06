import { create } from 'zustand';
import { Product, DealProduct } from '../types/models';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

interface ProductState {
  catalog: Product[];
  dealProducts: DealProduct[];
  isLoading: boolean;
  loadCatalog: () => Promise<void>;
  loadDealProducts: (dealId: string) => Promise<void>;
  createProduct: (data: { name: string; unitPrice: number; description?: string | null }) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addProductToDeal: (dealId: string, data: { productId: string; quantity?: number; unitPrice?: number; discount?: number }) => Promise<void>;
  removeProductFromDeal: (dealId: string, dealProductId: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set) => ({
  catalog: [],
  dealProducts: [],
  isLoading: false,

  loadCatalog: async () => {
    set({ isLoading: true });
    try {
      const catalog = await apiFetch<Product[]>('/api/products');
      set({ catalog });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar produtos');
    } finally {
      set({ isLoading: false });
    }
  },

  loadDealProducts: async (dealId) => {
    try {
      const dealProducts = await apiFetch<DealProduct[]>(`/api/products/deal/${dealId}`);
      set({ dealProducts });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar produtos da negociação');
    }
  },

  createProduct: async (data) => {
    try {
      const product = await apiFetch<Product>('/api/products', { method: 'POST', body: JSON.stringify(data) });
      set((s) => ({ catalog: [...s.catalog, product] }));
    } catch {
      useUIStore.getState().showToast('Erro ao criar produto');
    }
  },

  updateProduct: async (id, patch) => {
    try {
      await apiFetch(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ catalog: s.catalog.map((p) => p.id === id ? { ...p, ...patch } : p) }));
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar produto');
    }
  },

  deleteProduct: async (id) => {
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      set((s) => ({ catalog: s.catalog.filter((p) => p.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Erro ao excluir produto');
    }
  },

  addProductToDeal: async (dealId, data) => {
    try {
      const dp = await apiFetch<DealProduct>(`/api/products/deal/${dealId}`, { method: 'POST', body: JSON.stringify(data) });
      set((s) => ({ dealProducts: [...s.dealProducts, dp] }));
    } catch {
      useUIStore.getState().showToast('Erro ao adicionar produto');
    }
  },

  removeProductFromDeal: async (dealId, dealProductId) => {
    try {
      await apiFetch(`/api/products/deal/${dealId}/${dealProductId}`, { method: 'DELETE' });
      set((s) => ({ dealProducts: s.dealProducts.filter((p) => p.id !== dealProductId) }));
    } catch {
      useUIStore.getState().showToast('Erro ao remover produto');
    }
  },
}));
