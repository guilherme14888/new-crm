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

/** Métricas de uma varredura (saúde da coleta). */
export interface CoverageRun {
  runDate: string | null;
  source: string;
  enumerated: number;
  preFiltered: number;
  matched: number;
  records: number;
  inserted: number;
  updated: number;
  enumErrors: number;
  byUf: Record<string, number>;
  modalidades: string | null;
  finishedAt: string | null;
}
export interface CoverageAlert { level: 'ok' | 'info' | 'warn' | 'error'; code: string; message: string }
export interface CoverageData {
  last: CoverageRun | null;
  history: CoverageRun[];
  baselineByUf: Record<string, number>;
  lastRunDate: string | null;
  today: string;
  alerts: CoverageAlert[];
}

/** Provedor de IA disponível na lista suspensa. */
export interface AiProviderOpt { key: string; label: string; defaultModel: string }
/** Estado público da config de IA do tenant (a chave nunca trafega). */
export interface AiConfig {
  provider: string;
  model: string;
  hasKey: boolean;
  source: 'tenant' | 'env' | 'none';
  updatedAt?: string | null;
  providers: AiProviderOpt[];
}

interface MarketIntelState {
  rows: MarketIntelRow[];
  isLoading: boolean;
  loaded: boolean;
  loadedCompanyId: string | null;
  loadRows: (companyId?: string | null, force?: boolean) => Promise<void>;
  coverage: CoverageData | null;
  coverageLoading: boolean;
  loadCoverage: () => Promise<void>;
  aiConfig: AiConfig | null;
  aiConfigLoading: boolean;
  loadAiConfig: () => Promise<void>;
  saveAiConfig: (patch: { provider?: string; apiKey?: string; model?: string }) => Promise<void>;
  testAiConfig: () => Promise<{ ok: boolean; provider?: string; model?: string; source?: string; reply?: string; error?: string }>;
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
  suggestKeywordContext: (input: { termo: string; produtoCandidato?: string | null; negocio?: string }) => Promise<{ contexto: string; negativos: string }>;
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

  aiConfig: null,
  aiConfigLoading: false,

  // Provedor de IA do tenant (Configurações → Inteligência Artificial).
  loadAiConfig: async () => {
    set({ aiConfigLoading: true });
    try {
      const aiConfig = await apiFetch<AiConfig>('/api/market-intelligence/ai');
      set({ aiConfig });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar a configuração de IA');
    } finally {
      set({ aiConfigLoading: false });
    }
  },
  saveAiConfig: async (patch) => {
    try {
      const aiConfig = await apiFetch<AiConfig>('/api/market-intelligence/ai', { method: 'PATCH', body: JSON.stringify(patch) });
      set({ aiConfig });
      useUIStore.getState().showToast('Configuração de IA salva');
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Erro ao salvar a IA');
      throw e;
    }
  },
  testAiConfig: async () => {
    try {
      return await apiFetch<{ ok: boolean }>('/api/market-intelligence/ai/test', { method: 'POST' });
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Falha no teste de conexão' };
    }
  },

  coverage: null,
  coverageLoading: false,

  // Carrega a saúde da coleta (varredura PNCP) do tenant logado.
  loadCoverage: async () => {
    set({ coverageLoading: true });
    try {
      const coverage = await apiFetch<CoverageData>('/api/market-intelligence/coverage');
      set({ coverage });
    } catch {
      useUIStore.getState().showToast('Erro ao carregar a saúde da coleta');
    } finally {
      set({ coverageLoading: false });
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
      throw e; // propaga p/ o formulário não fechar quando o cadastro é bloqueado
    }
  },

  // Atualiza campos/ativo de uma palavra-chave (estado local após sucesso).
  updateKeyword: async (id, patch) => {
    try {
      await apiFetch(`/api/market-intelligence/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ keywords: s.keywords.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
    } catch (e: any) {
      useUIStore.getState().showToast(e?.message ?? 'Erro ao atualizar');
      throw e; // propaga (ex.: tentar ativar sem contexto → bloqueado)
    }
  },

  // Pede à IA um contexto + lista de negativos para uma palavra-chave.
  suggestKeywordContext: async (input) => {
    return apiFetch<{ contexto: string; negativos: string }>('/api/market-intelligence/keywords/suggest', {
      method: 'POST', body: JSON.stringify(input),
    });
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
