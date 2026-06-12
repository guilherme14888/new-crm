/**
 * Limpeza da base de Inteligência de Mercado — remove a "sujeira": linhas cujo
 * `produto_licitado` NÃO corresponde à palavra-chave buscada (`termo_busca`).
 * Espelha exatamente o filtro do scraping (normalize.matchesTerm).
 *
 *   node src/jobs/clean-noise.js                 # DRY-RUN (só conta + amostras)
 *   node src/jobs/clean-noise.js --apply         # apaga de fato
 *   node src/jobs/clean-noise.js --company <id|nome> [--apply]
 *
 * Linhas SEM termo (termo_busca e produto nulos) são preservadas (não dá p/ avaliar).
 */
require('dotenv').config();
const db = require('../db');
const { matchesTerm } = require('../ingest/normalize');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const apply = process.argv.includes('--apply');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveCompany(value) {
  if (!value) return null;
  if (UUID_RE.test(value)) return value;
  const [rows] = await db.query('SELECT id, name FROM companies WHERE name LIKE ? ORDER BY name', [`%${value}%`]);
  if (rows.length !== 1) throw new Error(`"${value}" casou com ${rows.length} empresas — refine ou use o id.`);
  console.log(`[clean] empresa: ${rows[0].name} (${rows[0].id})`);
  return rows[0].id;
}

(async () => {
  const companyId = await resolveCompany(arg('company', null));
  const where = companyId ? 'WHERE company_id = ?' : '';
  const params = companyId ? [companyId] : [];

  const [rows] = await db.query(
    `SELECT id, termo_busca, produto, produto_licitado FROM market_intelligence ${where}`,
    params
  );
  console.log(`[clean] avaliando ${rows.length} linha(s)…`);

  const toDelete = [];
  let noTerm = 0;
  const samples = [];
  for (const r of rows) {
    const term = (r.termo_busca && r.termo_busca.trim()) || (r.produto && r.produto.trim()) || '';
    if (!term) { noTerm++; continue; }              // sem termo → preserva
    if (!matchesTerm(r.produto_licitado, term)) {
      toDelete.push(r.id);
      if (samples.length < 15) samples.push(`  ["${term}"]  ✗  ${String(r.produto_licitado || '').slice(0, 70)}`);
    }
  }

  const keep = rows.length - toDelete.length - noTerm;
  console.log('──────────────────────────────────────────────');
  console.log(`  manter (casa a keyword) : ${keep}`);
  console.log(`  sem termo (preservadas) : ${noTerm}`);
  console.log(`  REMOVER (sujeira)       : ${toDelete.length}`);
  console.log('──────────────────────────────────────────────');
  if (samples.length) {
    console.log('Amostras do que será removido (termo ✗ produto_licitado):');
    console.log(samples.join('\n'));
  }

  if (!apply) {
    console.log('\n[DRY-RUN] nada apagado. Rode com --apply para remover.');
    process.exit(0);
  }
  if (!toDelete.length) { console.log('\nNada a remover.'); process.exit(0); }

  let removed = 0;
  for (let i = 0; i < toDelete.length; i += 500) {
    const chunk = toDelete.slice(i, i + 500);
    const ph = chunk.map(() => '?').join(',');
    const [res] = await db.query(`DELETE FROM market_intelligence WHERE id IN (${ph})`, chunk);
    removed += res.affectedRows;
  }
  console.log(`\n[clean] removidas ${removed} linha(s) de sujeira.`);
  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
