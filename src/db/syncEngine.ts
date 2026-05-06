import { getDatabase } from './migrations';
import { apiFetch, tokenStorage } from '../services/api';
import { Contact, Deal } from '../types/models';

async function getLastPulledAt(table: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    `SELECT last_pulled_at FROM sync_meta WHERE table_name=?`, [table]
  );
  return row?.last_pulled_at ?? null;
}

async function setLastPulledAt(table: string, ts: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_meta (table_name, last_pulled_at) VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_pulled_at=excluded.last_pulled_at`,
    [table, ts]
  );
}

// ─── Push pending local rows → API ───────────────────────────────────────────

async function pushContacts(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM contacts WHERE sync_status='pending_push'`
  );
  for (const row of rows) {
    if (row.deleted_at) {
      await apiFetch(`/api/contacts/${row.id}`, { method: 'DELETE' }).catch(() => null);
    } else {
      await apiFetch(`/api/contacts/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type: row.type, firstName: row.first_name, lastName: row.last_name,
          email: row.email, phone: row.phone, company: row.company,
          jobTitle: row.job_title, avatarUrl: row.avatar_url,
          tags: JSON.parse((row.tags as string) || '[]'), notes: row.notes,
        }),
      }).catch(() => null);
    }
    await db.runAsync(`UPDATE contacts SET sync_status='synced' WHERE id=?`, [row.id as string]);
  }
}

async function pushDeals(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM deals WHERE sync_status='pending_push'`
  );
  for (const row of rows) {
    if (row.deleted_at) {
      await apiFetch(`/api/deals/${row.id}`, { method: 'DELETE' }).catch(() => null);
    } else {
      await apiFetch(`/api/deals/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: row.title, value: row.value, stage: row.stage,
          stageId: row.stage_id, funnelId: row.funnel_id, ownerId: row.owner_id,
          probability: row.probability, expectedCloseDate: row.expected_close_date,
          closingReason: row.closing_reason, notes: row.notes,
        }),
      }).catch(() => null);
    }
    await db.runAsync(`UPDATE deals SET sync_status='synced' WHERE id=?`, [row.id as string]);
  }
}

async function pushActivities(): Promise<void> {
  const db = await getDatabase();
  // Activities are append-only — no PATCH needed, skip for now
  await db.runAsync(`UPDATE activities SET sync_status='synced' WHERE sync_status='pending_push'`);
}

// ─── Pull remote rows → local SQLite ─────────────────────────────────────────

async function pullContacts(): Promise<void> {
  const db = await getDatabase();
  const syncNow = new Date().toISOString();
  const contacts = await apiFetch<Contact[]>('/api/contacts');
  for (const row of contacts) {
    await db.runAsync(
      `INSERT INTO contacts
         (id,type,first_name,last_name,email,phone,company,job_title,avatar_url,tags,notes,created_at,updated_at,sync_status,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?)
       ON CONFLICT(id) DO UPDATE SET
         type=excluded.type, first_name=excluded.first_name, last_name=excluded.last_name,
         email=excluded.email, phone=excluded.phone, company=excluded.company,
         job_title=excluded.job_title, avatar_url=excluded.avatar_url, tags=excluded.tags,
         notes=excluded.notes, updated_at=excluded.updated_at, sync_status='synced',
         deleted_at=excluded.deleted_at
       WHERE excluded.updated_at > contacts.updated_at`,
      [row.id, row.type, row.firstName, row.lastName, row.email, row.phone,
       row.company, row.jobTitle, row.avatarUrl,
       JSON.stringify(row.tags ?? []),
       row.notes, row.createdAt, row.updatedAt, row.deletedAt ?? null]
    );
  }
  await setLastPulledAt('contacts', syncNow);
}

async function pullDeals(): Promise<void> {
  const db = await getDatabase();
  const syncNow = new Date().toISOString();
  const deals = await apiFetch<Deal[]>('/api/deals');
  for (const row of deals) {
    await db.runAsync(
      `INSERT INTO deals
         (id,contact_id,funnel_id,stage_id,owner_id,title,value,currency,stage,stage_order,
          probability,expected_close_date,closing_reason,notes,created_at,updated_at,sync_status,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?)
       ON CONFLICT(id) DO UPDATE SET
         contact_id=excluded.contact_id, funnel_id=excluded.funnel_id,
         stage_id=excluded.stage_id, owner_id=excluded.owner_id,
         title=excluded.title, value=excluded.value, stage=excluded.stage,
         stage_order=excluded.stage_order, probability=excluded.probability,
         expected_close_date=excluded.expected_close_date,
         closing_reason=excluded.closing_reason, notes=excluded.notes,
         updated_at=excluded.updated_at, sync_status='synced',
         deleted_at=excluded.deleted_at
       WHERE excluded.updated_at > deals.updated_at`,
      [row.id, row.contactId, row.funnelId ?? 'default-funnel', row.stageId ?? '',
       row.ownerId ?? null, row.title, row.value, row.currency ?? 'BRL',
       row.stage, row.stageOrder, row.probability,
       row.expectedCloseDate ?? null, row.closingReason ?? null, row.notes ?? null,
       row.createdAt, row.updatedAt, row.deletedAt ?? null]
    );
  }
  await setLastPulledAt('deals', syncNow);
}

async function pullFunnels(): Promise<void> {
  const db = await getDatabase();
  const syncNow = new Date().toISOString();

  const funnels = await apiFetch<Array<{
    id: string; name: string; isDefault: boolean; isActive: boolean;
    createdAt: string; updatedAt: string;
    stages: Array<{
      id: string; funnelId: string; name: string; order: number;
      color: string | null; probability: number; createdAt: string; updatedAt: string;
    }>;
  }>>('/api/funnels');

  for (const f of funnels) {
    await db.runAsync(
      `INSERT INTO funnels (id,name,description,is_default,is_active,created_at,updated_at)
       VALUES (?,?,NULL,?,1,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, is_default=excluded.is_default, updated_at=excluded.updated_at
       WHERE excluded.updated_at > funnels.updated_at`,
      [f.id, f.name, f.isDefault ? 1 : 0, f.createdAt, f.updatedAt]
    );
    for (const s of f.stages) {
      await db.runAsync(
        `INSERT INTO funnel_stages
           (id,funnel_id,name,color,stage_order,probability,type,rotten_days,created_at,updated_at)
         VALUES (?,?,?,?,?,?,'active',NULL,?,?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, color=excluded.color, stage_order=excluded.stage_order,
           probability=excluded.probability, updated_at=excluded.updated_at
         WHERE excluded.updated_at > funnel_stages.updated_at`,
        [s.id, s.funnelId, s.name, s.color ?? '#6366f1', s.order,
         s.probability, s.createdAt, s.updatedAt]
      );
    }
  }
  await setLastPulledAt('funnels', syncNow);
}

async function pullWinLossReasons(): Promise<void> {
  const db = await getDatabase();
  const reasons = await apiFetch<Array<{
    id: string; type: string; label: string; isActive: boolean; createdAt: string;
  }>>('/api/win-loss-reasons');
  for (const row of reasons) {
    await db.runAsync(
      `INSERT INTO win_loss_reasons (id,type,label,is_active,created_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET label=excluded.label, is_active=excluded.is_active`,
      [row.id, row.type, row.label, row.isActive ? 1 : 0, row.createdAt]
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function syncAll(): Promise<void> {
  await tokenStorage.init();
  if (!tokenStorage.get()) return;

  await Promise.all([
    pushContacts(),
    pushDeals(),
    pushActivities(),
  ]);
  await Promise.all([
    pullContacts(),
    pullDeals(),
    pullFunnels(),
    pullWinLossReasons(),
  ]);
}
