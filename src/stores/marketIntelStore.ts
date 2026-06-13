import { create } from 'zustand';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

/** Uma linha da base de Inteligência de Mercado (um item de um processo licitatório). */
export interface MarketIntelRow {
  id: string;
  companyId: string | null;
  companyName: string | null;
  status: string | null;
  etapaItem: string | null;
  dataUltimaAtual: string | null;
  regiao: string | null;
  cnpj: string | null;
  licitador: string | null;
  uf: string | null;
  municipio: string | null;
  nEdital: string | null;
  nEditalOriginal: string | null;
  nProcesso: string | null;
  tipoContratacao: string | null;
  modalidade: string | null;
  nomeSite: string | null;
  urlSite: string | null;
  idSite: string | null;
  prazoEdital: string | null;
  dataHoraCertame: string | null;
  lote: number | null;
  item: number | null;
  produtoCandidato: string | null;
  produto: string | null;
  produtoLicitado: string | null;
  quantidade: number | null;
  unidadeOriginal: string | null;
  mandadoJudicial: string | null;
  meEpp: string | null;
  precoEstimadoUnit: number | null;
  precoEstimadoTotal: number | null;
  posicao: number | null;
  dataPosicao: string | null;
  concorrente: string | null;
  cnpjConcorrente: string | null;
  ufConcorrente: string | null;
  produtoOfertado: string | null;
  precoFinalUnit: number | null;
  precoFinalTotal: number | null;
  etapaSessao: string | null;
  encerramento: string | null;
  processoKey: string | null;
  linkEdital: string | null;
  linkAta: string | null;
  linkDocConcorrente: string | null;
}

/** Definição/estado de um portal (API Externa). */
export interface SourceField { key: string; label?: string; secret?: boolean; type?: string; placeholder?: string }
export interface MarketIntelSource {
  key: string;
  name: string;
  mode: string;
  implemented: boolean;
  note?: string;
  fields: SourceField[];
  enabled: boolean;
  config: Record<string, string>;
  updatedAt?: string | null;
}

/** Palavra-chave do tenant. */
export interface MarketKeyword {
  id: string;
  termo: string;
  produtoCandidato: string | null;
  contexto: string | null;
  negativos: string | null;
  ativo: boolean;
}

/** Oportunidade (licitação aberta) ainda não convertida em negociação. */
export interface Opportunity {
  controle: string; miId: string;
  licitador: string | null; uf: string | null; municipio: string | null;
  modalidade: string | null; nEdital: string | null; nProcesso: string | null;
  dataHoraCertame: string | null; prazoEdital: string | null; urlSite: string | null; nomeSite: string | null;
  produtos: string | null; valorEstimado: number | null; itens: number;
}

interface MarketIntelState {
  rows: MarketIntelRow[];
  isLoading: boolean;
  loaded: boolean;
  loadedCompanyId: string | null;
  loadRows: (companyId?: string | null, force?: boolean) => Promise<void>;
  opportunities: Opportunity[];
  oppLoading: boolean;
  loadOpportunities: () => Promise<void>;
  confirmParticipation: (controle: string) => Promise<string | null>;
  sources: MarketIntelSource[];
  sourcesLoading: boolean;
  loadSources: () => Promise<void>;
  saveSource: (key: string, patch: { enabled?: boolean; config?: Record<string, string> }) => Promise<void>;
  keywords: MarketKeyword[];
  keywordsLoading: boolean;
  loadKeywords: () => Promise<void>;
  createKeyword: (data: Partial<MarketKeyword>) => Promise<void>;
  updateKeyword: (id: string, patch: Partial<MarketKeyword>) => Promise<void>;
  deleteKeyword: (id: string) => Promise<void>;
}

export const useMarketIntelStore = create<MarketIntelState>((set, get) => ({
  rows: [],
  isLoading: false,
  loaded: false,
  loadedCompanyId: null,

  // Carrega as licitações do tenant logado (master vê todas).
  // Cacheia por empresa: se já carregou para este tenant, não rebusca (evita
  // baixar milhares de linhas a cada acesso ao Dashboard/Listagem). `force` ignora o cache.
  loadRows: async (companyId = null, force = false) => {
    const st = get();
    if (st.isLoading) return;
    if (!force && st.loaded && st.loadedCompanyId === companyId) return; // já em cache p/ este tenant
    set({ isLoading: true });
    try {
      const rows = await apiFetch<MarketIntelRow[]>('/api/market-intelligence');
      set({ rows, loaded: true, loadedCompanyId: companyId });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar inteligência de mercado');
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Oportunidades (inbox de licitações abertas) ──────────────────────────────
  opportunities: [],
  oppLoading: false,
  loadOpportunities: async () => {
    set({ oppLoading: true });
    try {
      const opportunities = await apiFetch<Opportunity[]>('/api/market-intelligence/opportunities');
      set({ opportunities });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar oportunidades');
    } finally {
      set({ oppLoading: false });
    }
  },
  // Confirma participação → cria o deal; remove a oportunidade do inbox. Retorna dealId.
  confirmParticipation: async (controle) => {
    try {
      const r = await apiFetch<{ ok: boolean; dealId: string }>('/api/market-intelligence/opportunities/confirm', {
        method: 'POST', body: JSON.stringify({ controle }),
      });
      set((s) => ({ opportunities: s.opportunities.filter((o) => o.controle !== controle) }));
      useUIStore.getState().showToast('Participação confirmada — negociação criada');
      return r.dealId;
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Erro ao confirmar participação');
      return null;
    }
  },

  sources: [],
  sourcesLoading: false,

  // Lista os portais (API Externa) do tenant com defs + estado.
  loadSources: async () => {
    set({ sourcesLoading: true });
    try {
      const sources = await apiFetch<MarketIntelSource[]>('/api/market-intelligence/sources');
      set({ sources });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar portais (API Externa)');
    } finally {
      set({ sourcesLoading: false });
    }
  },

  // Salva enabled/config de um portal e atualiza o estado local.
  saveSource: async (key, patch) => {
    try {
      await apiFetch(`/api/market-intelligence/sources/${key}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      set((s) => ({
        sources: s.sources.map((src) =>
          src.key === key
            ? { ...src, ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}), ...(patch.config ? { config: patch.config } : {}) }
            : src
        ),
      }));
      useUIStore.getState().showToast('Configuração salva');
    } catch {
      useUIStore.getState().showToast('Erro ao salvar configuração');
    }
  },

  keywords: [],
  keywordsLoading: false,

  // Lista as palavras-chave do tenant.
  loadKeywords: async () => {
    set({ keywordsLoading: true });
    try {
      const keywords = await apiFetch<MarketKeyword[]>('/api/market-intelligence/keywords');
      set({ keywords });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar palavras-chave');
    } finally {
      set({ keywordsLoading: false });
    }
  },

  // Cadastra uma palavra-chave e a insere ordenada na lista local.
  createKeyword: async (data) => {
    try {
      const kw = await apiFetch<MarketKeyword>('/api/market-intelligence/keywords', {
        method: 'POST', body: JSON.stringify(data),
      });
      set((s) => ({ keywords: [...s.keywords, kw].sort((a, b) => a.termo.localeCompare(b.termo)) }));
      useUIStore.getState().showToast('Palavra-chave cadastrada');
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Erro ao cadastrar');
    }
  },

  // Atualiza campos/ativo de uma palavra-chave (otimista no estado local).
  updateKeyword: async (id, patch) => {
    try {
      await apiFetch(`/api/market-intelligence/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ keywords: s.keywords.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Erro ao atualizar');
    }
  },

  // Exclui uma palavra-chave e a remove da lista local.
  deleteKeyword: async (id) => {
    try {
      await apiFetch(`/api/market-intelligence/keywords/${id}`, { method: 'DELETE' });
      set((s) => ({ keywords: s.keywords.filter((k) => k.id !== id) }));
      useUIStore.getState().showToast('Palavra-chave excluída');
    } catch {
      useUIStore.getState().showToast('Erro ao excluir');
    }
  },
}));
