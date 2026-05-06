import { create } from 'zustand';
import { Platform } from 'react-native';
import { Contact, ContactType } from '../types/models';
import * as contactRepo from '../db/contactRepo';
import {
  apiGetContacts, apiCreateContact, apiUpdateContact, apiDeleteContact,
} from '../services/apiDataService';
import { useUIStore } from './uiStore';

interface ContactState {
  contacts: Contact[];
  isLoading: boolean;
  searchQuery: string;
  filterType: ContactType | 'all';

  filteredContacts: () => Contact[];
  loadContacts: () => Promise<void>;
  createContact: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'>) => Promise<Contact>;
  updateContact: (id: string, patch: Partial<Contact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  setSearch: (q: string) => void;
  setFilter: (type: ContactType | 'all') => void;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  isLoading: false,
  searchQuery: '',
  filterType: 'all',

  filteredContacts: () => {
    const { contacts, searchQuery, filterType } = get();
    return contacts.filter((c) => {
      const matchesType = filterType === 'all' || c.type === filterType;
      if (!searchQuery) return matchesType;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  },

  loadContacts: async () => {
    set({ isLoading: true });
    try {
      if (Platform.OS === 'web') {
        const contacts = await apiGetContacts();
        set({ contacts });
      } else {
        const contacts = await contactRepo.getAllContacts();
        set({ contacts });
      }
    } catch {
      useUIStore.getState().showToast('Failed to load contacts');
    } finally {
      set({ isLoading: false });
    }
  },

  createContact: async (data) => {
    try {
      if (Platform.OS === 'web') {
        const contact = await apiCreateContact(data);
        set((s) => ({ contacts: [...s.contacts, contact] }));
        return contact;
      }
      const contact = await contactRepo.createContact(data);
      set((s) => ({ contacts: [...s.contacts, contact] }));
      return contact;
    } catch {
      useUIStore.getState().showToast('Failed to create contact');
      throw new Error('Failed to create contact');
    }
  },

  updateContact: async (id, patch) => {
    try {
      if (Platform.OS === 'web') {
        await apiUpdateContact(id, patch);
      } else {
        await contactRepo.updateContact(id, patch);
      }
      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.id === id ? { ...c, ...patch, syncStatus: 'pending_push' as const } : c
        ),
      }));
    } catch {
      useUIStore.getState().showToast('Failed to update contact');
    }
  },

  deleteContact: async (id) => {
    try {
      if (Platform.OS === 'web') {
        await apiDeleteContact(id);
      } else {
        await contactRepo.deleteContact(id);
      }
      set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
    } catch {
      useUIStore.getState().showToast('Failed to delete contact');
    }
  },

  setSearch: (q) => set({ searchQuery: q }),
  setFilter: (type) => set({ filterType: type }),
}));
