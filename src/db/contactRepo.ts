import { getDatabase } from './migrations';
import { Contact, ContactType } from '../types/models';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    type: row.type as ContactType,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string | null,
    phone: row.phone as string | null,
    company: row.company as string | null,
    jobTitle: row.job_title as string | null,
    avatarUrl: row.avatar_url as string | null,
    tags: JSON.parse((row.tags as string) || '[]'),
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncStatus: row.sync_status as Contact['syncStatus'],
    deletedAt: row.deleted_at as string | null,
  };
}

export async function getAllContacts(): Promise<Contact[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY first_name, last_name`
  );
  return rows.map(rowToContact);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM contacts WHERE id = ?`, [id]
  );
  return row ? rowToContact(row) : null;
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const db = await getDatabase();
  const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const q = `%${escaped}%`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM contacts WHERE deleted_at IS NULL AND (
      first_name LIKE ? ESCAPE '\\' OR last_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\'
    ) ORDER BY first_name, last_name`,
    [q, q, q, q]
  );
  return rows.map(rowToContact);
}

export async function createContact(
  data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'>
): Promise<Contact> {
  const db = await getDatabase();
  const contact: Contact = {
    ...data,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
    syncStatus: 'pending_push',
    deletedAt: null,
  };
  await db.runAsync(
    `INSERT INTO contacts (id, type, first_name, last_name, email, phone, company, job_title, avatar_url, tags, notes, created_at, updated_at, sync_status, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contact.id, contact.type, contact.firstName, contact.lastName, contact.email, contact.phone,
     contact.company, contact.jobTitle, contact.avatarUrl, JSON.stringify(contact.tags),
     contact.notes, contact.createdAt, contact.updatedAt, contact.syncStatus, contact.deletedAt]
  );
  return contact;
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<void> {
  const db = await getDatabase();
  const updated = now();
  await db.runAsync(
    `UPDATE contacts SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name),
     email=COALESCE(?,email), phone=COALESCE(?,phone), company=COALESCE(?,company),
     job_title=COALESCE(?,job_title), notes=COALESCE(?,notes), type=COALESCE(?,type),
     updated_at=?, sync_status='pending_push' WHERE id=?`,
    [patch.firstName ?? null, patch.lastName ?? null, patch.email ?? null, patch.phone ?? null,
     patch.company ?? null, patch.jobTitle ?? null, patch.notes ?? null, patch.type ?? null,
     updated, id]
  );
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE contacts SET deleted_at=?, sync_status='pending_push' WHERE id=?`,
    [now(), id]
  );
}
