import { create } from 'zustand';
import { CoolingThresholds } from '../types/models';
import { apiFetch } from '../services/api';
import { useUIStore } from './uiStore';

interface SettingsState {
  coolingThresholds: CoolingThresholds;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateCoolingThresholds: (thresholds: CoolingThresholds) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  coolingThresholds: { warningDays: 15, dangerDays: 30 },
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<{ cooling_thresholds?: CoolingThresholds }>('/api/settings');
      if (data.cooling_thresholds) {
        set({ coolingThresholds: data.cooling_thresholds });
      }
    } catch {
      // Use defaults silently
    } finally {
      set({ isLoading: false });
    }
  },

  updateCoolingThresholds: async (thresholds) => {
    try {
      await apiFetch('/api/settings/cooling_thresholds', {
        method: 'PUT',
        body: JSON.stringify({ value: thresholds }),
      });
      set({ coolingThresholds: thresholds });
      useUIStore.getState().showToast('Configurações salvas');
    } catch {
      useUIStore.getState().showToast('Erro ao salvar configurações');
    }
  },
}));
