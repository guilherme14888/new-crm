import { AppState, AppStateStatus } from 'react-native';
import { syncAll } from '../db/syncEngine';
import { useUIStore } from '../stores/uiStore';
import { useContactStore } from '../stores/contactStore';
import { useDealStore } from '../stores/dealStore';
import { useActivityStore } from '../stores/activityStore';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

export async function runSync(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;
  const { setSyncIndicator, showToast } = useUIStore.getState();
  setSyncIndicator('pending');
  try {
    await syncAll();
    await Promise.all([
      useContactStore.getState().loadContacts(),
      useDealStore.getState().loadDeals(),
      useActivityStore.getState().loadRecent(),
    ]);
    setSyncIndicator('synced');
  } catch {
    setSyncIndicator('error');
    showToast('Sync failed. Will retry.');
  } finally {
    isSyncing = false;
  }
}

export function startBackgroundSync(): void {
  stopBackgroundSync();
  syncInterval = setInterval(() => { runSync(); }, 30_000);
  AppState.addEventListener('change', handleAppStateChange);
  runSync();
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') runSync();
}
