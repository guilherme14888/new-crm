import { create } from 'zustand';
import { Platform } from 'react-native';
import { Activity } from '../types/models';
import * as activityRepo from '../db/activityRepo';
import { apiFetch } from '../services/api';

interface ActivityState {
  recent: Activity[];
  isLoading: boolean;

  loadRecent: () => Promise<void>;
  getByContact: (contactId: string) => Promise<Activity[]>;
  getByDeal: (dealId: string) => Promise<Activity[]>;
  createActivity: (data: Omit<Activity, 'id' | 'createdAt' | 'syncStatus'>) => Promise<Activity>;
}

export const useActivityStore = create<ActivityState>((set) => ({
  recent: [],
  isLoading: false,

  loadRecent: async () => {
    if (Platform.OS === 'web') { set({ isLoading: false }); return; }
    set({ isLoading: true });
    const recent = await activityRepo.getRecentActivities(20);
    set({ recent, isLoading: false });
  },

  getByContact: (contactId) => {
    if (Platform.OS === 'web') return Promise.resolve([]);
    return activityRepo.getActivitiesByContact(contactId);
  },

  getByDeal: async (dealId) => {
    if (Platform.OS === 'web') {
      return apiFetch<Activity[]>(`/api/activities?dealId=${dealId}`).catch(() => []);
    }
    return activityRepo.getActivitiesByDeal(dealId);
  },

  createActivity: async (data) => {
    if (Platform.OS === 'web') {
      const activity = await apiFetch<Activity>('/api/activities', { method: 'POST', body: JSON.stringify(data) });
      set((s) => ({ recent: [activity, ...s.recent].slice(0, 20) }));
      return activity;
    }
    const activity = await activityRepo.createActivity(data);
    set((s) => ({ recent: [activity, ...s.recent].slice(0, 20) }));
    return activity;
  },
}));
