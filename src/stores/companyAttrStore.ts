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

const sortByName = (a: CompanyAttr, b: CompanyAttr) => a.name.localeCompare(b.name);

export const useCompanyAttrStore = create<CompanyAttrState>((set, get) => ({
  portes: [], fornecimentos: [], eixos: [], segmentos: [], produtos: [],

  load: async (key) => {
    try {
      const list = await apiFetch<CompanyAttr[]>(`/api/company-attrs/${key}`);
      set({ [key]: list.sort(sortByName) } as any);
    } catch { /* admin-only — fail silently for non-admins */ }
  },

  loadAll: async () => {
    await Promise.all((['portes','fornecimentos','eixos','segmentos','produtos'] as AttrKey[]).map((k) => get().load(k)));
  },

  create: async (key, name) => {
    const created = await apiFetch<CompanyAttr>(`/api/company-attrs/${key}`, {
      method: 'POST', body: JSON.stringify({ name }),
    });
    set((s) => ({ [key]: [...s[key], created].sort(sortByName) } as any));
    return created;
  },

  update: async (key, id, name) => {
    const updated = await apiFetch<CompanyAttr>(`/api/company-attrs/${key}/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
    });
    set((s) => ({ [key]: s[key].map((it) => it.id === id ? updated : it).sort(sortByName) } as any));
  },

  remove: async (key, id) => {
    await apiFetch(`/api/company-attrs/${key}/${id}`, { method: 'DELETE' });
    set((s) => ({ [key]: s[key].filter((it) => it.id !== id) } as any));
  },
}));
