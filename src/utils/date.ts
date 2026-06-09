/** Retorna a data/hora atual como string no formato ISO 8601 */
export function now(): string {
  return new Date().toISOString();
}

/** Formata uma data ISO para o formato de data local pt-BR (dd/mm/aaaa) */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Formata uma data ISO para data e hora local pt-BR */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

/** Calcula quantos dias inteiros se passaram desde a data ISO informada até agora */
export function daysAgo(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Retorna o início do mês atual (dia 1, 00:00:00) como string ISO */
export function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
