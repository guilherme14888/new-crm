import { useContactStore } from '../stores/contactStore';

/** Hook que expõe a lista de contatos filtrada e as actions do contactStore (carregar, criar, atualizar, excluir, buscar e filtrar) */
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
