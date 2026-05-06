import { Platform } from 'react-native';
import { ALL_SCHEMA_STATEMENTS, ALL_SEED_STATEMENTS } from './schema';

let db: import('expo-sqlite').SQLiteDatabase | null = null;

export async function getDatabase(): Promise<import('expo-sqlite').SQLiteDatabase> {
  if (db) return db;
  if (Platform.OS === 'web') throw new Error('SQLite not available on web');
  const SQLite = await import('expo-sqlite');
  db = await SQLite.openDatabaseAsync('crmbr4.db');
  await runMigrations(db);
  return db;
}

async function runMigrations(database: import('expo-sqlite').SQLiteDatabase): Promise<void> {
  await database.execAsync(`PRAGMA journal_mode = WAL;`);
  for (const statement of ALL_SCHEMA_STATEMENTS) {
    await database.execAsync(statement);
  }
  // Add columns to existing deals table if upgrading from older schema
  try {
    await database.execAsync(`ALTER TABLE deals ADD COLUMN funnel_id TEXT NOT NULL DEFAULT 'default-funnel';`);
  } catch { /* column already exists */ }
  try {
    await database.execAsync(`ALTER TABLE deals ADD COLUMN stage_id TEXT NOT NULL DEFAULT '';`);
  } catch { /* column already exists */ }
  try {
    await database.execAsync(`ALTER TABLE deals ADD COLUMN owner_id TEXT;`);
  } catch { /* column already exists */ }
  try {
    await database.execAsync(`ALTER TABLE deals ADD COLUMN closing_reason TEXT;`);
  } catch { /* column already exists */ }
  // Seed default data
  for (const statement of ALL_SEED_STATEMENTS) {
    await database.execAsync(statement);
  }
}
