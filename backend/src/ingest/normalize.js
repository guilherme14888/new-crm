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

// ── Casamento descrição × palavra-chave (scraping objetivo) ───────────────────
// Stopwords (conectivos/preposições) que não devem contar no casamento.
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem', 'e', 'em', 'no', 'na', 'por', 'um', 'uma']);

/** minúsculo, sem acentos, só [a-z0-9] separados por espaço. */
function normTxt(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Tokens "úteis" de um termo (≥3 letras, sem stopwords). */
function termTokens(term) {
  return normTxt(term).split(' ').filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Decide se a DESCRIÇÃO do item de fato corresponde à palavra-chave buscada —
 * usado para gravar APENAS os itens pertinentes (sem a sujeira dos demais itens
 * do mesmo edital). Regra:
 *   1) a descrição contém o termo inteiro como substring; OU
 *   2) contém o TOKEN MAIS DISTINTIVO do termo — o mais longo, que para
 *      medicamentos é o princípio ativo ("tezepelumabe", "ciclossilicato",
 *      "glicemia"). Usar só o token distintivo evita falsos-negativos quando a
 *      keyword é verbosa ("tezepelumabe 210 mg/1,91 ml (110 mg/ml)") e a
 *      descrição traz outra apresentação ("Tezepelumabe 210MG Caneta 1,91ML").
 *      Itens de OUTROS produtos do mesmo edital não contêm esse token → caem.
 */
function matchesTerm(description, term) {
  const nd = normTxt(description);
  if (!nd) return false;
  const nt = normTxt(term);
  if (!nt) return true;                 // sem termo → não filtra
  if (nd.includes(nt)) return true;     // substring direto (melhor caso)
  const toks = termTokens(term);
  if (!toks.length) return true;
  const main = toks.slice().sort((a, b) => b.length - a.length)[0]; // mais longo
  const stem = main.endsWith('s') ? main.slice(0, -1) : main;        // plural cru
  return nd.includes(stem);
}
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

module.exports = { regiaoOf, digits, numOrNull, mapStatus, toDateTime, dedupeKey, REGIAO_UF, normTxt, termTokens, matchesTerm };
