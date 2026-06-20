// Orquestrador do scrape-worker: para cada tenant com keywords, roda cada adapter,
// normaliza e grava REUSANDO o mesmo upsert/dedup do backend (fonte + dedupe_key +
// histórico). Não duplica: a dedupe_key funde registros entre fontes.
//
//   node runner.js            → roda tudo e grava
//   node runner.js --dry      → não grava (valida o framework / parsing)
//   node runner.js --only bec_sp

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../src/db');
const { upsertRecords } = require('../src/ingest/upsert');
const { closeBrowser } = require('./lib/browser');

const ADAPTERS = [
  require('./adapters/exemplo'),
  require('./adapters/bec-sp'),
];

const todayBRT = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

async function tenantsWithKeywords() {
  const [r] = await db.query(
    "SELECT DISTINCT company_id FROM market_intelligence_keywords WHERE ativo = 1 AND company_id IS NOT NULL"
  );
  return r.map((x) => x.company_id);
}
async function loadKeywords(companyId) {
  const [r] = await db.query(
    "SELECT termo, produto_candidato AS produtoCandidato, contexto, negativos FROM market_intelligence_keywords WHERE company_id = ? AND ativo = 1",
    [companyId]
  );
  return r;
}

async function run({ dry = false, only = null } = {}) {
  const runDate = todayBRT();
  const adapters = ADAPTERS.filter((a) => !only || a.key === only);
  const tenants = await tenantsWithKeywords();
  console.log(`[scrape] início — ${tenants.length} tenant(s), adapters: ${adapters.map((a) => a.key).join(', ')}${dry ? ' (DRY)' : ''}`);

  for (const companyId of tenants) {
    const keywords = await loadKeywords(companyId);
    if (!keywords.length) continue;
    for (const a of adapters) {
      try {
        const groups = await a.sweep(keywords, { runDate });
        const recs = groups.flatMap((g) => g.records).map((r) => ({ ...r, companyId, firstSeenDate: runDate }));
        if (dry) { console.log(`[scrape] ${a.key} · tenant ${companyId.slice(0, 8)} → ${recs.length} registro(s) (dry)`); continue; }
        if (!recs.length) { console.log(`[scrape] ${a.key} · tenant ${companyId.slice(0, 8)} → 0`); continue; }
        const res = await upsertRecords(recs);
        console.log(`[scrape] ${a.key} · tenant ${companyId.slice(0, 8)} → novas ${res.inserted}, atualizadas ${res.updated}, erros ${res.errors}`);
      } catch (e) {
        console.error(`[scrape] ${a.key} · tenant ${companyId.slice(0, 8)} FALHOU: ${e.message}`);
      }
    }
  }
  await closeBrowser();
  console.log('[scrape] fim.');
}

if (require.main === module) {
  const dry = process.argv.includes('--dry');
  const i = process.argv.indexOf('--only');
  const only = i >= 0 ? process.argv[i + 1] : null;
  run({ dry, only }).then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
}

module.exports = { run, ADAPTERS };
