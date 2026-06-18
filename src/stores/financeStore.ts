import { create } from 'zustand';
import { apiFetch } from '../services/api';

export interface FinanceCompany {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
  cnpj: string | null;
  isActive: boolean;
  isBlocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  billingDay: number;
  blockGraceDays: number;
  licensePriceCents: number;
  purchasedLicenses: number;
  activeLicenses: number;
  paymentProvider: string | null;
  paymentProviderRef: string | null;
  trialDays: number | null;
  trialStartsAt: string | null;
  onTrial?: boolean;
  trialExpired?: boolean;
  trialDaysLeft?: number | null;
  trialEndsAt?: string | null;
}

export interface CompanyInvoice {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  licensesBilled: number;
  unitPriceCents: number;
  totalCents: number;
  status: 'open' | 'paid' | 'overdue' | 'canceled';
  paidAt: string | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  paymentProviderRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LicensePurchase {
  id: string;
  companyId: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  paidAt: string | null;
  paymentProvider: string | null;
  paymentProviderRef: string | null;
  createdAt: string;
}

interface CompanyDetail {
  company: FinanceCompany;
  invoices: CompanyInvoice[];
  licensePurchases: LicensePurchase[];
}

interface FinanceState {
  companies: FinanceCompany[];
  isLoading: boolean;
  detail: Record<string, CompanyDetail>;

  loadCompanies: () => Promise<void>;
  loadDetail: (companyId: string) => Promise<CompanyDetail | null>;

  updateBilling: (companyId: string, patch: Partial<Pick<FinanceCompany, 'billingDay' | 'blockGraceDays' | 'licensePriceCents' | 'purchasedLicenses'>> & { trialDays?: number | null; trialStart?: boolean }) => Promise<void>;

  block: (companyId: string, reason?: string) => Promise<void>;
  unblock: (companyId: string) => Promise<void>;

  createInvoice: (companyId: string, data: { periodStart: string; periodEnd: string; dueDate: string; licensesBilled?: number; unitPriceCents?: number; notes?: string }) => Promise<CompanyInvoice>;
  updateInvoice: (invoiceId: string, patch: Partial<Pick<CompanyInvoice, 'status' | 'dueDate' | 'paidAt' | 'paymentMethod' | 'paymentProvider' | 'paymentProviderRef' | 'notes'>>) => Promise<void>;
  payInvoice: (invoiceId: string, data?: { paymentMethod?: string; paymentProvider?: string; paymentProviderRef?: string }) => Promise<void>;

  createLicensePurchase: (companyId: string, data: { quantity: number; unitPriceCents: number }) => Promise<LicensePurchase>;
  confirmLicensePurchase: (purchaseId: string, data?: { paymentProvider?: string; paymentProviderRef?: string }) => Promise<void>;

  // Autoatendimento do tenant (empresa não-Default)
  mySummary: { company: FinanceCompany; licensePurchases: LicensePurchase[] } | null;
  loadMySummary: () => Promise<void>;
  contractLicenses: (quantity: number) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  companies: [],
  isLoading: false,
  detail: {},

  /** Carrega as empresas com dados financeiros (admin); ignora erros para não-admins. */
  loadCompanies: async () => {
    set({ isLoading: true });
    try {
      const list = await apiFetch<FinanceCompany[]>('/api/admin/finance/companies');
      set({ companies: list });
    } catch { /* admin-only — ignore for non-admins */ }
    finally { set({ isLoading: false }); }
  },

  /** Carrega o detalhe financeiro de uma empresa (faturas e compras de licença); retorna null em erro. */
  loadDetail: async (companyId) => {
    try {
      const d = await apiFetch<CompanyDetail>(`/api/admin/finance/companies/${companyId}`);
      set((s) => ({ detail: { ...s.detail, [companyId]: d } }));
      return d;
    } catch { return null; }
  },

  /** Atualiza parâmetros de cobrança da empresa e recarrega lista e detalhe. */
  updateBilling: async (companyId, patch) => {
    await apiFetch(`/api/admin/finance/companies/${companyId}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    });
    await get().loadCompanies();
    await get().loadDetail(companyId);
  },

  /** Bloqueia o acesso de uma empresa (com motivo opcional) e recarrega a lista. */
  block: async (companyId, reason) => {
    await apiFetch(`/api/admin/finance/companies/${companyId}/block`, {
      method: 'POST', body: JSON.stringify({ reason: reason ?? 'manual' }),
    });
    await get().loadCompanies();
  },

  /** Desbloqueia o acesso de uma empresa e recarrega a lista. */
  unblock: async (companyId) => {
    await apiFetch(`/api/admin/finance/companies/${companyId}/unblock`, { method: 'POST' });
    await get().loadCompanies();
  },

  /** Cria uma fatura para a empresa, recarrega detalhe e lista, e retorna a fatura criada. */
  createInvoice: async (companyId, data) => {
    const inv = await apiFetch<CompanyInvoice>(`/api/admin/finance/companies/${companyId}/invoices`, {
      method: 'POST', body: JSON.stringify(data),
    });
    await get().loadDetail(companyId);
    await get().loadCompanies();
    return inv;
  },

  /** Atualiza uma fatura e recarrega o detalhe da empresa correspondente e a lista. */
  updateInvoice: async (invoiceId, patch) => {
    const updated = await apiFetch<CompanyInvoice>(`/api/admin/finance/invoices/${invoiceId}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    });
    await get().loadDetail(updated.companyId);
    await get().loadCompanies();
  },

  /** Marca uma fatura como paga (com dados de pagamento opcionais) e recarrega detalhe e lista. */
  payInvoice: async (invoiceId, data) => {
    const updated = await apiFetch<CompanyInvoice>(`/api/admin/finance/invoices/${invoiceId}/pay`, {
      method: 'POST', body: JSON.stringify(data ?? {}),
    });
    await get().loadDetail(updated.companyId);
    await get().loadCompanies();
  },

  /** Registra uma compra de licenças para a empresa, recarrega o detalhe e retorna a compra criada. */
  createLicensePurchase: async (companyId, data) => {
    const lp = await apiFetch<LicensePurchase>(`/api/admin/finance/companies/${companyId}/license-purchases`, {
      method: 'POST', body: JSON.stringify(data),
    });
    await get().loadDetail(companyId);
    return lp;
  },

  /** Confirma o pagamento de uma compra de licenças e recarrega detalhe e lista. */
  confirmLicensePurchase: async (purchaseId, data) => {
    const updated = await apiFetch<LicensePurchase>(`/api/admin/finance/license-purchases/${purchaseId}/confirm`, {
      method: 'POST', body: JSON.stringify(data ?? {}),
    });
    await get().loadDetail(updated.companyId);
    await get().loadCompanies();
  },

  // ── Autoatendimento (empresa não-Default) ──
  mySummary: null,

  /** Carrega o resumo de licenças da própria empresa do usuário. */
  loadMySummary: async () => {
    try {
      const d = await apiFetch<{ company: FinanceCompany; licensePurchases: LicensePurchase[] }>('/api/finance/my-summary');
      set({ mySummary: d });
    } catch { /* sem acesso/erro — ignora */ }
  },

  /** Cria um pedido de contratação de N licenças para a própria empresa. */
  contractLicenses: async (quantity) => {
    await apiFetch('/api/finance/my-summary/license-purchases', {
      method: 'POST', body: JSON.stringify({ quantity }),
    });
    await get().loadMySummary();
  },
}));
