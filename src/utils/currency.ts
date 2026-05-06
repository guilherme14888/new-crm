/**
 * Formata um valor em centavos para string de moeda localizada.
 * @param cents - Valor em centavos (ex: 1000 = R$ 10,00)
 * @param currency - Código ISO da moeda (padrão: 'BRL')
 * @returns String formatada com símbolo de moeda
 */
export function formatCurrency(cents: number, currency = 'BRL'): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

/**
 * Extrai dígitos de uma entrada de moeda e retorna centavos.
 * Remove caracteres especiais e retorna um inteiro em centavos.
 * @param input - String de entrada (ex: "R$ 10,50" ou "1050")
 * @returns Valor em centavos como inteiro
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^0-9]/g, '');
  return parseInt(cleaned || '0', 10);
}

/**
 * Converte centavos para formato de decimal com 2 casas.
 * @param cents - Valor em centavos
 * @returns String com 2 casas decimais (ex: "10.50")
 */
export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}
