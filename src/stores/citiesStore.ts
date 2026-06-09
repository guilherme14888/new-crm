import { create } from 'zustand';
import { ALL_CITIES_BR } from '../constants/citiesBrAll';

export interface City { name: string; uf: string }

interface CitiesState {
  cities: City[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

/**
 * Lista oficial do IBGE com 5571 municípios brasileiros, empacotada
 * estaticamente. Não depende de rede — funciona offline e em qualquer
 * configuração de firewall/proxy. Atualizar essa lista é uma tarefa
 * manual (re-baixar do IBGE) mas a base de municípios é estável.
 */
export const useCitiesStore = create<CitiesState>((set, get) => ({
  cities: [],
  loaded: false,
  loading: false,
  error: null,
  // Carrega a lista estática de municípios no estado uma única vez (idempotente).
  load: async () => {
    if (get().loaded) return;
    set({ cities: ALL_CITIES_BR, loaded: true, loading: false });
  },
}));
