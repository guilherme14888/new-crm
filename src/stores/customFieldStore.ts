import { create } from 'zustand';
import { CustomField, DealCustomValue } from '../types/models';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

interface CustomFieldState {
  fields: CustomField[];
  dealValues: Record<string, string>;  // fieldId -> value
  isLoading: boolean;
  loadFields: () => Promise<void>;
  loadDealValues: (dealId: string) => Promise<void>;
  saveDealValues: (dealId: string, values: { fieldId: string; value: string }[]) => Promise<void>;
  createField: (data: { name: string; fieldType?: string; options?: string[]; isRequired?: boolean }) => Promise<void>;
  updateField: (id: string, patch: Partial<CustomField>) => Promise<void>;
  deleteField: (id: string) => Promise<void>;
}

export const useCustomFieldStore = create<CustomFieldState>((set, get) => ({
  fields: [],
  dealValues: {},
  isLoading: false,

  /** Carrega as definições de campos personalizados da API. */
  loadFields: async () => {
    set({ isLoading: true });
    try {
      const fields = await apiFetch<CustomField[]>('/api/custom-fields');
      set({ fields });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar campos personalizados');
    } finally {
      set({ isLoading: false });
    }
  },

  /** Carrega os valores dos campos personalizados de uma negociação como mapa fieldId -> valor. */
  loadDealValues: async (dealId) => {
    try {
      const values = await apiFetch<DealCustomValue[]>(`/api/custom-fields/values/${dealId}`);
      const map: Record<string, string> = {};
      for (const v of values) { if (v.value) map[v.fieldId] = v.value; }
      set({ dealValues: map });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar valores dos campos');
    }
  },

  /** Persiste os valores de campos personalizados de uma negociação e atualiza o mapa local. */
  saveDealValues: async (dealId, values) => {
    try {
      await apiFetch(`/api/custom-fields/values/${dealId}`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      const map = { ...get().dealValues };
      for (const { fieldId, value } of values) { map[fieldId] = value; }
      set({ dealValues: map });
    } catch {
      useUIStore.getState().showToast('Erro ao salvar campos');
    }
  },

  /** Cria uma nova definição de campo personalizado e a adiciona ao estado. */
  createField: async (data) => {
    try {
      const field = await apiFetch<CustomField>('/api/custom-fields', { method: 'POST', body: JSON.stringify(data) });
      set((s) => ({ fields: [...s.fields, field] }));
    } catch {
      useUIStore.getState().showToast('Erro ao criar campo');
    }
  },

  /** Atualiza uma definição de campo personalizado e aplica o patch ao estado. */
  updateField: async (id, patch) => {
    try {
      await apiFetch(`/api/custom-fields/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ fields: s.fields.map((f) => f.id === id ? { ...f, ...patch } : f) }));
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar campo');
    }
  },

  /** Exclui uma definição de campo personalizado e a remove do estado. */
  deleteField: async (id) => {
    try {
      await apiFetch(`/api/custom-fields/${id}`, { method: 'DELETE' });
      set((s) => ({ fields: s.fields.filter((f) => f.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Erro ao excluir campo');
    }
  },
}));
