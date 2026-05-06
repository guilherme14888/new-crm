/**
 * API data service — used by web/mobile stores to talk to the MariaDB REST API.
 * Drop-in replacement for supabaseDataService.
 */
import { apiFetch } from './api';
import {
  Contact, ContactType,
  Deal, DealStage,
  Funnel, FunnelStage,
  WinLossReason,
  CRMUser,
} from '../types/models';
import { generateId } from '../utils/id';

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function apiGetContacts(): Promise<Contact[]> {
  return apiFetch<Contact[]>('/api/contacts');
}

export async function apiCreateContact(
  data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'>
): Promise<Contact> {
  return apiFetch<Contact>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ id: generateId(), ...data }),
  });
}

export async function apiUpdateContact(id: string, patch: Partial<Contact>): Promise<void> {
  await apiFetch(`/api/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiDeleteContact(id: string): Promise<void> {
  await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' });
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function apiGetDeals(): Promise<Deal[]> {
  return apiFetch<Deal[]>('/api/deals');
}

export async function apiCreateDeal(
  data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt' | 'stageOrder'>
): Promise<Deal> {
  return apiFetch<Deal>('/api/deals', {
    method: 'POST',
    body: JSON.stringify({ id: generateId(), ...data }),
  });
}

export async function apiUpdateDeal(id: string, patch: Partial<Deal>): Promise<void> {
  await apiFetch(`/api/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiMoveDeal(
  id: string, newStage: DealStage, newStageId: string, newOrder: number
): Promise<void> {
  await apiFetch(`/api/deals/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ newStage, newStageId, newOrder }),
  });
}

export async function apiDeleteDeal(id: string): Promise<void> {
  await apiFetch(`/api/deals/${id}`, { method: 'DELETE' });
}

// ─── Funnels ──────────────────────────────────────────────────────────────────

type ApiFunnelStage = {
  id: string; funnelId: string; name: string; order: number;
  color: string | null; probability: number;
  type?: string;
  createdAt: string; updatedAt: string;
};

type ApiFunnel = {
  id: string; name: string; companyId?: string | null; isDefault: boolean;
  createdAt: string; updatedAt: string;
  stages: ApiFunnelStage[];
};

function mapStage(s: ApiFunnelStage): FunnelStage {
  return {
    id: s.id, funnelId: s.funnelId, name: s.name,
    color: s.color ?? '#6366f1',
    order: s.order,
    probability: s.probability,
    type: (s.type as 'active' | 'won' | 'lost') ?? 'active',
    rottenDays: null,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}

function mapFunnel(f: ApiFunnel): Funnel {
  return {
    id: f.id, name: f.name,
    companyId: f.companyId ?? null,
    description: null,
    isDefault: f.isDefault,
    isActive: true,
    stages: f.stages.map(mapStage).sort((a, b) => a.order - b.order),
    createdAt: f.createdAt, updatedAt: f.updatedAt,
  };
}

export async function apiGetFunnels(): Promise<Funnel[]> {
  const data = await apiFetch<ApiFunnel[]>('/api/funnels');
  return data.map(mapFunnel);
}

export async function apiCreateFunnel(data: { name: string; description?: string }): Promise<Funnel> {
  const result = await apiFetch<ApiFunnel>('/api/funnels', {
    method: 'POST',
    body: JSON.stringify({ id: generateId(), name: data.name, isDefault: false, stages: [] }),
  });
  return mapFunnel(result);
}

export async function apiUpdateFunnel(
  id: string, patch: Partial<Pick<Funnel, 'name' | 'description' | 'isActive'>>
): Promise<void> {
  await apiFetch(`/api/funnels/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function apiDeleteFunnel(id: string): Promise<void> {
  await apiFetch(`/api/funnels/${id}`, { method: 'DELETE' });
}

export async function apiSetDefaultFunnel(id: string): Promise<void> {
  await apiFetch(`/api/funnels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isDefault: true }),
  });
}

export async function apiCreateStage(
  data: Omit<FunnelStage, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FunnelStage> {
  const result = await apiFetch<ApiFunnelStage>(`/api/funnels/${data.funnelId}/stages`, {
    method: 'POST',
    body: JSON.stringify({
      id: generateId(), name: data.name, order: data.order,
      color: data.color, probability: data.probability,
    }),
  });
  return mapStage(result);
}

export async function apiUpdateStage(
  stageId: string,
  patch: Partial<Omit<FunnelStage, 'id' | 'funnelId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  // funnelId needed in URL — we use a placeholder since the backend only filters by stageId
  await apiFetch(`/api/funnels/_/stages/${stageId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiDeleteStage(funnelId: string, stageId: string): Promise<void> {
  await apiFetch(`/api/funnels/${funnelId}/stages/${stageId}`, { method: 'DELETE' });
}

export async function apiReorderStages(funnelId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      apiFetch(`/api/funnels/${funnelId}/stages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ order: i }),
      })
    )
  );
}

// ─── Win / Loss Reasons ───────────────────────────────────────────────────────

export async function apiGetWinLossReasons(): Promise<WinLossReason[]> {
  return apiFetch<WinLossReason[]>('/api/win-loss-reasons');
}

export async function apiCreateWinLossReason(
  data: { type: 'won' | 'lost'; label: string }
): Promise<WinLossReason> {
  return apiFetch<WinLossReason>('/api/win-loss-reasons', {
    method: 'POST',
    body: JSON.stringify({ id: generateId(), ...data }),
  });
}

export async function apiUpdateWinLossReason(id: string, label: string): Promise<WinLossReason> {
  return apiFetch<WinLossReason>(`/api/win-loss-reasons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  });
}

export async function apiDeleteWinLossReason(id: string): Promise<void> {
  await apiFetch(`/api/win-loss-reasons/${id}`, { method: 'DELETE' });
}

// ─── CRM Users ────────────────────────────────────────────────────────────────

export async function apiGetCRMUsers(): Promise<CRMUser[]> {
  const data = await apiFetch<Array<{
    id: string; email: string; displayName: string; avatarUrl: string | null;
    role: CRMUser['role']; isActive: boolean; companyId: string; teamId: string | null;
    createdAt: string; updatedAt: string;
  }>>('/api/users');
  return data.map((u) => ({
    id: u.id, email: u.email, displayName: u.displayName,
    avatarUrl: u.avatarUrl, role: u.role, isActive: u.isActive,
    companyId: u.companyId, companyName: null, teamId: u.teamId ?? null,
    createdAt: u.createdAt, lastLoginAt: null,
  }));
}

export async function apiUpdateCRMUser(
  id: string,
  patch: Partial<Pick<CRMUser, 'displayName' | 'role' | 'isActive' | 'avatarUrl'> & { companyId?: string; teamId?: string }>
): Promise<void> {
  await apiFetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function apiCreateCRMUser(
  data: Pick<CRMUser, 'email' | 'displayName' | 'role' | 'avatarUrl'> & { password?: string; companyId?: string; teamId?: string }
): Promise<CRMUser> {
  const result = await apiFetch<{
    id: string; email: string; displayName: string; avatarUrl: string | null;
    role: CRMUser['role']; isActive: boolean; companyId: string; teamId: string | null; createdAt: string;
  }>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ id: generateId(), ...data, password: data.password ?? generateId() }),
  });
  return { ...result, companyName: null, lastLoginAt: null };
}
