import { AppState, AppStateStatus } from 'react-native';
import { syncAll } from '../db/syncEngine';
import { useUIStore } from '../stores/uiStore';
import { useContactStore } from '../stores/contactStore';
import { useDealStore } from '../stores/dealStore';
import { useActivityStore } from '../stores/activityStore';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/** Executa um ciclo de sincronização (evitando concorrência), recarrega as stores e atualiza o indicador de sync na UI. */
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

/** Inicia a sincronização periódica (a cada 30s) e ao voltar o app ao primeiro plano. */
export function startBackgroundSync(): void {
  stopBackgroundSync();
  syncInterval = setInterval(() => { runSync(); }, 30_000);
  AppState.addEventListener('change', handleAppStateChange);
  runSync();
}

/** Interrompe o intervalo de sincronização em segundo plano. */
export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/** Dispara uma sincronização quando o app volta ao estado ativo. */
function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') runSync();
}
