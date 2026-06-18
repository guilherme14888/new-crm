import { create } from 'zustand';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

export interface ACLPermissions {
  leads_delete: boolean;
  leads_reopen_won: boolean;
  leads_view_all: boolean;
  custom_fields_manage: boolean;
  products_manage: boolean;
  users_manage: boolean;
  companies_manage: boolean;
  teams_manage: boolean;
  funnels_manage: boolean;
  roles_manage: boolean;
  settings_access: boolean;
  // Inteligência de Mercado / Licitações
  market_intelligence_access: boolean;
  keywords_manage: boolean;
  portals_manage: boolean;
  ai_config_manage: boolean;
  coverage_view: boolean;
  ingestion_trigger: boolean;
  // Financeiro
  billing_manage: boolean;
  trial_manage: boolean;
  // Visibilidade dos menus da barra lateral (true = visível)
  menu_dashboard: boolean;
  menu_contacts: boolean;
  menu_boletim: boolean;
  menu_negotiations: boolean;
  menu_reports: boolean;
  menu_market_intelligence: boolean;
  menu_settings: boolean;
  menu_finance: boolean;
}

/** Chaves de visibilidade de menu (renderizadas como toggles, default visível). */
export const MENU_PERMISSION_KEYS: (keyof ACLPermissions)[] = [
  'menu_dashboard', 'menu_contacts', 'menu_boletim', 'menu_negotiations',
  'menu_reports', 'menu_market_intelligence', 'menu_settings', 'menu_finance',
];

export const DEFAULT_PERMISSIONS: ACLPermissions = {
  leads_delete: false,
  leads_reopen_won: false,
  leads_view_all: false,
  custom_fields_manage: false,
  products_manage: false,
  users_manage: false,
  companies_manage: false,
  teams_manage: false,
  funnels_manage: false,
  roles_manage: false,
  settings_access: false,
  market_intelligence_access: false,
  keywords_manage: false,
  portals_manage: false,
  ai_config_manage: false,
  coverage_view: false,
  ingestion_trigger: false,
  billing_manage: false,
  trial_manage: false,
  menu_dashboard: true,
  menu_contacts: true,
  menu_boletim: true,
  menu_negotiations: true,
  menu_reports: true,
  menu_market_intelligence: true,
  menu_settings: true,
  menu_finance: true,
};

export const PERMISSION_LABELS: Record<keyof ACLPermissions, string> = {
  leads_delete: 'Excluir leads/negociações',
  leads_reopen_won: 'Mover negociações ganhas para em andamento',
  leads_view_all: 'Visualizar leads de todas as equipes',
  custom_fields_manage: 'Gerenciar campos personalizados',
  products_manage: 'Gerenciar catálogo de produtos',
  users_manage: 'Gerenciar usuários',
  companies_manage: 'Gerenciar empresas',
  teams_manage: 'Gerenciar equipes',
  funnels_manage: 'Gerenciar funis de venda',
  roles_manage: 'Gerenciar níveis de acesso (ACL)',
  settings_access: 'Acessar configurações',
  market_intelligence_access: 'Acessar Inteligência de Mercado',
  keywords_manage: 'Gerenciar palavras-chave (busca de licitações)',
  portals_manage: 'Gerenciar portais / API Externa',
  ai_config_manage: 'Gerenciar Inteligência Artificial',
  coverage_view: 'Ver cobertura / saúde da coleta',
  ingestion_trigger: 'Disparar coleta de licitações',
  billing_manage: 'Gerenciar Financeiro',
  trial_manage: 'Gerenciar período de teste',
  menu_dashboard: 'Dashboard',
  menu_contacts: 'Órgãos',
  menu_boletim: 'Boletim',
  menu_negotiations: 'Licitações',
  menu_reports: 'Relatórios',
  menu_market_intelligence: 'Inteligência de Mercado',
  menu_settings: 'Configurações',
  menu_finance: 'Financeiro',
};

export interface ACLProfile {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  level: number;
  color: string;
  permissions: ACLPermissions;
  funnelIds: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ACLProfileState {
  profiles: ACLProfile[];
  isLoading: boolean;

  loadProfiles: () => Promise<void>;
  createProfile: (data: { name: string; description?: string; level?: number; color?: string; permissions: ACLPermissions; funnelIds?: string[] }) => Promise<ACLProfile | null>;
  updateProfile: (id: string, data: { name?: string; description?: string; level?: number; color?: string; permissions?: ACLPermissions; funnelIds?: string[] }) => Promise<ACLProfile | null>;
  deleteProfile: (id: string) => Promise<void>;
}

export const useACLProfileStore = create<ACLProfileState>((set) => ({
  profiles: [],
  isLoading: false,

  /** Carrega os perfis de acesso (ACL) da API. */
  loadProfiles: async () => {
    set({ isLoading: true });
    try {
      const profiles = await apiFetch<ACLProfile[]>('/api/acl-profiles');
      set({ profiles });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar perfis de acesso');
    } finally {
      set({ isLoading: false });
    }
  },

  /** Cria um perfil de acesso e o adiciona ao estado; retorna o perfil ou null em erro. */
  createProfile: async (data) => {
    try {
      const profile = await apiFetch<ACLProfile>('/api/acl-profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      set((s) => ({ profiles: [...s.profiles, profile] }));
      return profile;
    } catch {
      useUIStore.getState().showToast('Erro ao criar perfil de acesso');
      return null;
    }
  },

  /** Atualiza um perfil de acesso e o substitui no estado; retorna o perfil ou null em erro. */
  updateProfile: async (id, data) => {
    try {
      const profile = await apiFetch<ACLProfile>(`/api/acl-profiles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      set((s) => ({ profiles: s.profiles.map((p) => p.id === id ? profile : p) }));
      return profile;
    } catch {
      useUIStore.getState().showToast('Erro ao atualizar perfil de acesso');
      return null;
    }
  },

  /** Exclui um perfil de acesso e o remove do estado. */
  deleteProfile: async (id) => {
    try {
      await apiFetch(`/api/acl-profiles/${id}`, { method: 'DELETE' });
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Erro ao excluir perfil de acesso');
    }
  },
}));
