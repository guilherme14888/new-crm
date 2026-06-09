import { create } from 'zustand';
import { apiFetch } from '../services/api';

export interface CompanyAttr {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type AttrKey = 'portes' | 'fornecimentos' | 'eixos' | 'segmentos' | 'produtos';

interface CompanyAttrState {
  portes: CompanyAttr[];
  fornecimentos: CompanyAttr[];
  eixos: CompanyAttr[];
  segmentos: CompanyAttr[];
  produtos: CompanyAttr[];
  loadAll: () => Promise<void>;
  load: (key: AttrKey) => Promise<void>;
  create: (key: AttrKey, name: string) => Promise<CompanyAttr>;
  update: (key: AttrKey, id: string, name: string) => Promise<void>;
  remove: (key: AttrKey, id: string) => Promise<void>;
}

// Comparador para ordenar atributos alfabeticamente pelo nome.
const sortByName = (a: CompanyAttr, b: CompanyAttr) => a.name.localeCompare(b.name);

export const useCompanyAttrStore = create<CompanyAttrState>((set, get) => ({
  portes: [], fornecimentos: [], eixos: [], segmentos: [], produtos: [],

  /** Carrega e ordena os atributos de um tipo (key); admin-only, falha em silêncio para não-admins. */
  load: async (key) => {
    try {
      const list = await apiFetch<CompanyAttr[]>(`/api/company-attrs/${key}`);
      set({ [key]: list.sort(sortByName) } as any);
    } catch { /* admin-only — fail silently for non-admins */ }
  },

  /** Carrega em paralelo todos os tipos de atributos de empresa. */
  loadAll: async () => {
    await Promise.all((['portes','fornecimentos','eixos','segmentos','produtos'] as AttrKey[]).map((k) => get().load(k)));
  },

  /** Cria um atributo do tipo informado e o insere ordenado no estado. */
  create: async (key, name) => {
    const created = await apiFetch<CompanyAttr>(`/api/company-attrs/${key}`, {
      method: 'POST', body: JSON.stringify({ name }),
    });
    set((s) => ({ [key]: [...s[key], created].sort(sortByName) } as any));
    return created;
  },

  /** Renomeia um atributo e reordena a lista do tipo correspondente. */
  update: async (key, id, name) => {
    const updated = await apiFetch<CompanyAttr>(`/api/company-attrs/${key}/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
    });
    set((s) => ({ [key]: s[key].map((it) => it.id === id ? updated : it).sort(sortByName) } as any));
  },

  /** Exclui um atributo do tipo informado e o remove do estado. */
  remove: async (key, id) => {
    await apiFetch(`/api/company-attrs/${key}/${id}`, { method: 'DELETE' });
    set((s) => ({ [key]: s[key].filter((it) => it.id !== id) } as any));
  },
}));
