// Normalização compartilhada: região por UF, status, datas, números e a CHAVE
// CANÔNICA de deduplicação (precisa bater 1:1 com a fórmula SQL da migration 021).

const REGIAO_UF = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro Oeste', GO: 'Centro Oeste', MT: 'Centro Oeste', MS: 'Centro Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
};
/** Região (Norte/Nordeste/...) a partir da UF. */
const regiaoOf = (uf) => REGIAO_UF[(uf || '').toUpperCase()] || null;

/** Mantém só dígitos (ex.: CNPJ "12.345/0001-90" → "12345000190"). */
const digits = (s) => String(s == null ? '' : s).replace(/[^0-9]/g, '');
/** Converte para número ou null (vazio/NaN → null). */
const numOrNull = (v) =>
  v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v);

/** Status do processo (Novo/Em Andamento/Encerrado) a partir de situação, data e resultado. */
function mapStatus(situacao, dataIni, temResultado) {
  const s = (situacao || '').toLowerCase();
  if (temResultado || /homolog|encerr|conclu|adjudic|deserto|fracass|revogad|cancelad/.test(s)) return 'Encerrado';
  if (dataIni && new Date(dataIni).getTime() > Date.now()) return 'Novo';
  return 'Em Andamento';
}

// ISO/Date → "YYYY-MM-DD HH:MM:SS" (DATETIME do MySQL, em UTC)
function toDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/**
 * Chave canônica da licitação — IGUAL em qualquer portal.
 * Espelha exatamente o CONCAT_WS('|', ...) da migration 021.
 *   cnpjÓrgão | processo(ou edital/processoKey/id, sem espaços, minúsculo) | lote | item | cnpjConcorrente
 */
function dedupeKey(rec) {
  const proc = String(
    (rec.nProcesso && rec.nProcesso.trim()) ||
    (rec.nEdital && rec.nEdital.trim()) ||
    rec.processoKey || rec.id || ''
  ).toLowerCase().split(' ').join('');
  const conc = digits(rec.cnpjConcorrente) || '-';
  return [digits(rec.cnpj), proc, rec.lote ?? 0, rec.item ?? 0, conc].join('|');
}

module.exports = { regiaoOf, digits, numOrNull, mapStatus, toDateTime, dedupeKey, REGIAO_UF };
