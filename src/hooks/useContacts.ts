import { useContactStore } from '../stores/contactStore';

export function useContacts() {
  const store = useContactStore();
  return {
    contacts: store.filteredContacts(),
    isLoading: store.isLoading,
    searchQuery: store.searchQuery,
    filterType: store.filterType,
    loadContacts: store.loadContacts,
    createContact: store.createContact,
    updateContact: store.updateContact,
    deleteContact: store.deleteContact,
    setSearch: store.setSearch,
    setFilter: store.setFilter,
  };
}
