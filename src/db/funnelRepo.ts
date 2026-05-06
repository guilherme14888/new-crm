import { getDatabase } from './migrations';
import { Funnel, FunnelStage, OpportunityRule, WinLossReason } from '../types/models';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function rowToStage(r: Record<string, unknown>): FunnelStage {
  return {
    id: r.id as string,
    funnelId: r.funnel_id as string,
    name: r.name as string,
    color: r.color as string,
    order: r.stage_order as number,
    probability: r.probability as number,
    type: (r.type as FunnelStage['type']) ?? 'active',
    rottenDays: (r.rotten_days as number | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToFunnel(r: Record<string, unknown>, stages: FunnelStage[]): Funnel {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    isDefault: (r.is_default as number) === 1,
    isActive: (r.is_active as number) === 1,
    stages,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ─── Funnels ───────────────────────────────────────────────────────────────────
export async function getAllFunnels(): Promise<Funnel[]> {
  const db = await getDatabase();
  const funnelRows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM funnels WHERE is_active = 1 ORDER BY is_default DESC, created_at ASC`
  );
  const result: Funnel[] = [];
  for (const row of funnelRows) {
    const stages = await getStagesByFunnel(row.id as string);
    result.push(rowToFunnel(row, stages));
  }
  return result;
}

export async function getFunnelById(id: string): Promise<Funnel | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM funnels WHERE id = ?`, [id]
  );
  if (!row) return null;
  const stages = await getStagesByFunnel(id);
  return rowToFunnel(row, stages);
}

export async function createFunnel(data: { name: string; description?: string }): Promise<Funnel> {
  const db = await getDatabase();
  const id = generateId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO funnels (id, name, description, is_default, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 0, 1, ?, ?)`,
    [id, data.name, data.description ?? null, ts, ts]
  );
  return { id, name: data.name, description: data.description ?? null, isDefault: false, isActive: true, stages: [], createdAt: ts, updatedAt: ts };
}

export async function updateFunnel(id: string, patch: Partial<Pick<Funnel, 'name' | 'description' | 'isActive'>>): Promise<void> {
  const db = await getDatabase();
  const ts = now();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [ts];
  if (patch.name !== undefined)        { sets.push('name = ?');        vals.push(patch.name); }
  if (patch.description !== undefined) { sets.push('description = ?'); vals.push(patch.description); }
  if (patch.isActive !== undefined)    { sets.push('is_active = ?');   vals.push(patch.isActive ? 1 : 0); }
  vals.push(id);
  await db.runAsync(`UPDATE funnels SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteFunnel(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE funnels SET is_active = 0, updated_at = ? WHERE id = ?`, [now(), id]);
}

export async function setDefaultFunnel(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE funnels SET is_default = 0, updated_at = ?`, [now()]);
  await db.runAsync(`UPDATE funnels SET is_default = 1, updated_at = ? WHERE id = ?`, [now(), id]);
}

// ─── Funnel Stages ─────────────────────────────────────────────────────────────
export async function getStagesByFunnel(funnelId: string): Promise<FunnelStage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM funnel_stages WHERE funnel_id = ? ORDER BY stage_order ASC`, [funnelId]
  );
  return rows.map(rowToStage);
}

export async function createStage(data: Omit<FunnelStage, 'id' | 'createdAt' | 'updatedAt'>): Promise<FunnelStage> {
  const db = await getDatabase();
  const id = generateId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, rotten_days, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.funnelId, data.name, data.color, data.order, data.probability, data.type, data.rottenDays ?? null, ts, ts]
  );
  return { ...data, id, createdAt: ts, updatedAt: ts };
}

export async function updateStage(id: string, patch: Partial<Omit<FunnelStage, 'id' | 'funnelId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const db = await getDatabase();
  const ts = now();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [ts];
  if (patch.name !== undefined)        { sets.push('name = ?');        vals.push(patch.name); }
  if (patch.color !== undefined)       { sets.push('color = ?');       vals.push(patch.color); }
  if (patch.order !== undefined)       { sets.push('stage_order = ?'); vals.push(patch.order); }
  if (patch.probability !== undefined) { sets.push('probability = ?'); vals.push(patch.probability); }
  if (patch.type !== undefined)        { sets.push('type = ?');        vals.push(patch.type); }
  if (patch.rottenDays !== undefined)  { sets.push('rotten_days = ?'); vals.push(patch.rottenDays); }
  vals.push(id);
  await db.runAsync(`UPDATE funnel_stages SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteStage(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM funnel_stages WHERE id = ?`, [id]);
}

export async function reorderStages(funnelId: string, orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  const ts = now();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(
      `UPDATE funnel_stages SET stage_order = ?, updated_at = ? WHERE id = ? AND funnel_id = ?`,
      [i, ts, orderedIds[i], funnelId]
    );
  }
}

// ─── Opportunity Rules ─────────────────────────────────────────────────────────
export async function getRulesByFunnel(funnelId: string): Promise<OpportunityRule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM opportunity_rules WHERE funnel_id = ? ORDER BY created_at ASC`, [funnelId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    funnelId: r.funnel_id as string,
    name: r.name as string,
    trigger: r.trigger as OpportunityRule['trigger'],
    triggerConfig: JSON.parse((r.trigger_config as string) || '{}'),
    action: r.action as OpportunityRule['action'],
    actionConfig: JSON.parse((r.action_config as string) || '{}'),
    isActive: (r.is_active as number) === 1,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
}

export async function createRule(data: Omit<OpportunityRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<OpportunityRule> {
  const db = await getDatabase();
  const id = generateId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO opportunity_rules (id, funnel_id, name, trigger, trigger_config, action, action_config, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.funnelId, data.name, data.trigger, JSON.stringify(data.triggerConfig), data.action, JSON.stringify(data.actionConfig), data.isActive ? 1 : 0, ts, ts]
  );
  return { ...data, id, createdAt: ts, updatedAt: ts };
}

export async function updateRule(id: string, patch: Partial<Omit<OpportunityRule, 'id' | 'funnelId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const db = await getDatabase();
  const ts = now();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [ts];
  if (patch.name !== undefined)          { sets.push('name = ?');          vals.push(patch.name); }
  if (patch.trigger !== undefined)       { sets.push('trigger = ?');       vals.push(patch.trigger); }
  if (patch.triggerConfig !== undefined) { sets.push('trigger_config = ?'); vals.push(JSON.stringify(patch.triggerConfig)); }
  if (patch.action !== undefined)        { sets.push('action = ?');        vals.push(patch.action); }
  if (patch.actionConfig !== undefined)  { sets.push('action_config = ?');  vals.push(JSON.stringify(patch.actionConfig)); }
  if (patch.isActive !== undefined)      { sets.push('is_active = ?');     vals.push(patch.isActive ? 1 : 0); }
  vals.push(id);
  await db.runAsync(`UPDATE opportunity_rules SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteRule(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM opportunity_rules WHERE id = ?`, [id]);
}

// ─── Win / Loss Reasons ────────────────────────────────────────────────────────
export async function getWinLossReasons(type?: 'won' | 'lost'): Promise<WinLossReason[]> {
  const db = await getDatabase();
  const rows = type
    ? await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM win_loss_reasons WHERE type = ? AND is_active = 1 ORDER BY label ASC`, [type])
    : await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM win_loss_reasons WHERE is_active = 1 ORDER BY type, label ASC`);
  return rows.map((r) => ({
    id: r.id as string,
    type: r.type as 'won' | 'lost',
    label: r.label as string,
    isActive: (r.is_active as number) === 1,
    createdAt: r.created_at as string,
  }));
}

export async function createWinLossReason(data: { type: 'won' | 'lost'; label: string }): Promise<WinLossReason> {
  const db = await getDatabase();
  const id = generateId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES (?, ?, ?, 1, ?)`,
    [id, data.type, data.label, ts]
  );
  return { id, type: data.type, label: data.label, isActive: true, createdAt: ts };
}

export async function deleteWinLossReason(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE win_loss_reasons SET is_active = 0 WHERE id = ?`, [id]);
}
