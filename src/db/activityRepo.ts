import { getDatabase } from './migrations';
import { Activity, ActivityType } from '../types/models';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

function rowToActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    dealId: row.deal_id as string | null,
    contactId: row.contact_id as string,
    type: row.type as ActivityType,
    title: row.title as string,
    description: row.description as string | null,
    occurredAt: row.occurred_at as string,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    createdAt: row.created_at as string,
    syncStatus: row.sync_status as Activity['syncStatus'],
  };
}

export async function getActivitiesByContact(contactId: string, limit = 50): Promise<Activity[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM activities WHERE contact_id=? ORDER BY occurred_at DESC LIMIT ?`,
    [contactId, limit]
  );
  return rows.map(rowToActivity);
}

export async function getActivitiesByDeal(dealId: string): Promise<Activity[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM activities WHERE deal_id=? ORDER BY occurred_at DESC`,
    [dealId]
  );
  return rows.map(rowToActivity);
}

export async function getRecentActivities(limit = 20): Promise<Activity[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM activities ORDER BY occurred_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToActivity);
}

export async function createActivity(
  data: Omit<Activity, 'id' | 'createdAt' | 'syncStatus'>
): Promise<Activity> {
  const db = await getDatabase();
  const activity: Activity = {
    ...data,
    id: generateId(),
    createdAt: now(),
    syncStatus: 'pending_push',
  };
  await db.runAsync(
    `INSERT INTO activities (id, deal_id, contact_id, type, title, description, occurred_at, metadata, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activity.id, activity.dealId, activity.contactId, activity.type, activity.title,
     activity.description, activity.occurredAt, activity.metadata ? JSON.stringify(activity.metadata) : null,
     activity.createdAt, activity.syncStatus]
  );
  return activity;
}
