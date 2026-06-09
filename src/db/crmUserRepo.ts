import { getDatabase } from './migrations';
import { CRMUser } from '../types/models';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

/** Converte uma linha do banco em um objeto CRMUser tipado. */
function rowToUser(r: Record<string, unknown>): CRMUser {
  return {
    id: r.id as string,
    email: r.email as string,
    displayName: r.display_name as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    role: (r.role as CRMUser['role']) ?? 'consultant',
    aclProfileId: (r.acl_profile_id as string | null) ?? null,
    companyId:   (r.company_id as string | null) ?? '',
    companyName: null,
    teamId:      (r.team_id as string | null) ?? null,
    isActive: (r.is_active as number) === 1,
    createdAt: r.created_at as string,
    lastLoginAt: (r.last_login_at as string | null) ?? null,
  };
}

/** Retorna todos os usuários do CRM ordenados por nome de exibição. */
export async function getAllCRMUsers(): Promise<CRMUser[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM crm_users ORDER BY display_name ASC`
  );
  return rows.map(rowToUser);
}

/** Busca um usuário do CRM pelo id, retornando null se não existir. */
export async function getCRMUserById(id: string): Promise<CRMUser | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM crm_users WHERE id = ?`, [id]
  );
  return row ? rowToUser(row) : null;
}

/** Cria um novo usuário do CRM ativo, gerando id e timestamp. */
export async function createCRMUser(data: Pick<CRMUser, 'email' | 'displayName' | 'role' | 'avatarUrl'>): Promise<CRMUser> {
  const db = await getDatabase();
  const id = generateId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO crm_users (id, email, display_name, avatar_url, role, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [id, data.email, data.displayName, data.avatarUrl ?? null, data.role, ts]
  );
  return { id, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl, role: data.role, aclProfileId: null, companyId: '', companyName: null, teamId: null, isActive: true, createdAt: ts, lastLoginAt: null };
}

/** Atualiza dinamicamente apenas os campos informados do usuário do CRM. */
export async function updateCRMUser(id: string, patch: Partial<Pick<CRMUser, 'displayName' | 'role' | 'isActive' | 'avatarUrl'>>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (patch.displayName !== undefined) { sets.push('display_name = ?'); vals.push(patch.displayName); }
  if (patch.role !== undefined)        { sets.push('role = ?');         vals.push(patch.role); }
  if (patch.isActive !== undefined)    { sets.push('is_active = ?');    vals.push(patch.isActive ? 1 : 0); }
  if (patch.avatarUrl !== undefined)   { sets.push('avatar_url = ?');   vals.push(patch.avatarUrl); }
  if (!sets.length) return;
  vals.push(id);
  await db.runAsync(`UPDATE crm_users SET ${sets.join(', ')} WHERE id = ?`, vals);
}

/** Desativa o usuário do CRM (exclusão lógica via is_active = 0). */
export async function deleteCRMUser(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE crm_users SET is_active = 0 WHERE id = ?`, [id]);
}
