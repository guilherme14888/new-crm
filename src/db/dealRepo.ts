import { getDatabase } from './migrations';
import { Deal, DealStage } from '../types/models';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

/** Converte uma linha do banco em um objeto Deal tipado, aplicando padrões. */
function rowToDeal(row: Record<string, unknown>): Deal {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    funnelId: (row.funnel_id as string) ?? 'default-funnel',
    stageId: (row.stage_id as string) ?? '',
    ownerId: (row.owner_id as string | null) ?? null,
    title: row.title as string,
    value: row.value as number,
    currency: (row.currency as string) ?? 'BRL',
    stage: row.stage as DealStage,
    stageOrder: row.stage_order as number,
    stageChangedAt: (row.stage_changed_at as string | null) ?? null,
    probability: row.probability as number,
    expectedCloseDate: (row.expected_close_date as string | null) ?? null,
    closingReason: (row.closing_reason as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncStatus: row.sync_status as Deal['syncStatus'],
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

/** Retorna todos os negócios não excluídos, ordenados por estágio e ordem. */
export async function getAllDeals(): Promise<Deal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM deals WHERE deleted_at IS NULL ORDER BY stage, stage_order`
  );
  return rows.map(rowToDeal);
}

/** Busca um negócio pelo id, retornando null se não existir. */
export async function getDealById(id: string): Promise<Deal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM deals WHERE id = ?`, [id]
  );
  return row ? rowToDeal(row) : null;
}

/** Retorna os negócios não excluídos de um contato, mais recentes primeiro. */
export async function getDealsByContact(contactId: string): Promise<Deal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM deals WHERE contact_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [contactId]
  );
  return rows.map(rowToDeal);
}

/** Cria um negócio calculando a próxima ordem no estágio e marcando para sincronização. */
export async function createDeal(
  data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt' | 'stageOrder' | 'stageChangedAt'>
): Promise<Deal> {
  const db = await getDatabase();
  const stageKey = data.stageId || data.stage;
  const maxRow = await db.getFirstAsync<{ max_order: number | null }>(
    `SELECT MAX(stage_order) as max_order FROM deals WHERE stage_id=? AND deleted_at IS NULL`,
    [stageKey]
  );
  const stageOrder = (maxRow?.max_order ?? 0) + 1;
  const deal: Deal = {
    ...data,
    id: generateId(),
    stageOrder,
    stageChangedAt: null,
    createdAt: now(),
    updatedAt: now(),
    syncStatus: 'pending_push',
    deletedAt: null,
  };
  await db.runAsync(
    `INSERT INTO deals
       (id, contact_id, funnel_id, stage_id, owner_id, title, value, currency,
        stage, stage_order, probability, expected_close_date, closing_reason, notes,
        created_at, updated_at, sync_status, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deal.id, deal.contactId, deal.funnelId ?? 'default-funnel', deal.stageId ?? '',
      deal.ownerId ?? null, deal.title, deal.value, deal.currency,
      deal.stage, deal.stageOrder, deal.probability,
      deal.expectedCloseDate ?? null, deal.closingReason ?? null, deal.notes ?? null,
      deal.createdAt, deal.updatedAt, deal.syncStatus, deal.deletedAt,
    ]
  );
  return deal;
}

/** Atualiza campos do negócio (apenas os informados) e marca para sincronização. */
export async function updateDeal(id: string, patch: Partial<Deal>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE deals SET
       title=COALESCE(?,title), value=COALESCE(?,value),
       stage=COALESCE(?,stage), stage_id=COALESCE(?,stage_id),
       funnel_id=COALESCE(?,funnel_id), owner_id=COALESCE(?,owner_id),
       probability=COALESCE(?,probability),
       expected_close_date=COALESCE(?,expected_close_date),
       closing_reason=COALESCE(?,closing_reason),
       notes=COALESCE(?,notes),
       updated_at=?, sync_status='pending_push'
     WHERE id=?`,
    [
      patch.title ?? null, patch.value ?? null,
      patch.stage ?? null, patch.stageId ?? null,
      patch.funnelId ?? null, patch.ownerId ?? null,
      patch.probability ?? null,
      patch.expectedCloseDate ?? null,
      patch.closingReason ?? null,
      patch.notes ?? null,
      now(), id,
    ]
  );
}

/** Move o negócio para outro estágio/ordem (drag-and-drop) e marca para sincronização. */
export async function moveDeal(id: string, newStage: DealStage, newOrder: number, newStageId?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE deals SET stage=?, stage_id=COALESCE(?,stage_id), stage_order=?, updated_at=?, sync_status='pending_push' WHERE id=?`,
    [newStage, newStageId ?? null, newOrder, now(), id]
  );
}

/** Exclusão lógica do negócio (define deleted_at) e marca para sincronização. */
export async function deleteDeal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE deals SET deleted_at=?, sync_status='pending_push' WHERE id=?`,
    [now(), id]
  );
}

/** Renumera sequencialmente a ordem dos negócios de um estágio (1, 2, 3...). */
export async function rebalanceStageOrder(stageId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM deals WHERE stage_id=? AND deleted_at IS NULL ORDER BY stage_order`,
    [stageId]
  );
  for (let i = 0; i < rows.length; i++) {
    await db.runAsync(`UPDATE deals SET stage_order=? WHERE id=?`, [i + 1, rows[i].id]);
  }
}
