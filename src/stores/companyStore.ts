import { create } from 'zustand';
import { apiFetch } from '../services/api';

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
  cnpj: string | null;
  city: string | null;
  state: string | null;
  porteId: string | null;
  fornecimentoId: string | null;
  eixoId: string | null;
  segmentoId: string | null;
  produtoIds: string[];
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export interface CompanyInput {
  name?: string;
  slug?: string;
  plan?: string;
  cnpj?: string;
  city?: string | null;
  state?: string | null;
  porteId?: string | null;
  fornecimentoId?: string | null;
  eixoId?: string | null;
  segmentoId?: string | null;
  produtoIds?: string[];
  isActive?: boolean;
}

interface CompanyState {
  companies: Company[];
  isLoading: boolean;
  loadCompanies: () => Promise<void>;
  createCompany: (data: CompanyInput & { name: string; slug: string }) => Promise<Company>;
  updateCompany: (id: string, patch: CompanyInput) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  isLoading: false,

  loadCompanies: async () => {
    set({ isLoading: true });
    try {
      const companies = await apiFetch<Company[]>('/api/companies');
      set({ companies });
    } catch { /* silently fail for non-admin users */ }
    finally { set({ isLoading: false }); }
  },

  createCompany: async (data) => {
    const company = await apiFetch<Company>('/api/companies', {
      method: 'POST', body: JSON.stringify(data),
    });
    set((s) => ({ companies: [...s.companies, company].sort((a, b) => a.name.localeCompare(b.name)) }));
    return company;
  },

  updateCompany: async (id, patch) => {
    const updated = await apiFetch<Company>(`/api/companies/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    });
    set((s) => ({ companies: s.companies.map((c) => c.id === id ? updated : c) }));
  },

  deleteCompany: async (id) => {
    await apiFetch(`/api/companies/${id}`, { method: 'DELETE' });
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }));
  },
}));
