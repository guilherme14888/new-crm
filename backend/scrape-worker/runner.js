// Orquestrador do scrape-worker: PERCORRE TODOS OS PORTAIS-ALVO (os de mode 'login'
// do catálogo) e, para cada um, grava o resultado do dia em `scrape_run_log`:
//   ok | fail (com o motivo) | sem_conector (ainda sem adapter) | sem_keywords.
// Nunca para por causa de uma falha — registra e segue para o próximo portal.
// Normaliza e grava via o mesmo upsert/dedup do backend (fonte + history).
//
//   node runner.js            → roda tudo e grava
//   node runner.js --dry      → não grava (valida sem tocar no banco)
//   node runner.js --only bec_sp

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../src/db');
const { upsertRecords } = require('../src/ingest/upsert');
const { SOURCE_DEFS } = require('../src/ingest/sources');
const { closeBrowser } = require('./lib/browser');

// Adapters de scraping POR CHAVE de portal. Adicione novos aqui conforme implementar.
// (O mock `exemplo` foi removido da produção — gravava dado de teste no banco.)
const ADAPTERS = {
  bec_sp: require('./adapters/bec-sp'),
};
const { genericSweep } = require('./adapters/generic');

const todayBRT = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

// Portais-alvo do scraping = os portais SEM API (mode 'login') do catálogo.
const scrapeTargets = () => SOURCE_DEFS.filter((s) => s.mode === 'login').map((s) => ({ key: s.key, name: s.name, url: s.url }));

async function tenantsWithKeywords() {
  const [r] = await db.query("SELECT DISTINCT company_id FROM market_intelligence_keywords WHERE ativo = 1 AND company_id IS NOT NULL");
  return r.map((x) => x.company_id);
}
async function loadKeywords(companyId) {
  const [r] = await db.query(
    "SELECT termo, produto_candidato AS produtoCandidato, contexto, negativos FROM market_intelligence_keywords WHERE company_id = ? AND ativo = 1",
    [companyId]
  );
  return r;
}

// Grava (upsert) uma linha no log de execução por dia/portal/tenant.
async function logScrape(runDate, companyId, portal, nome, status, detail, counts = {}) {
  try {
    await db.query(
      `INSERT INTO scrape_run_log (run_date, company_id, portal, portal_nome, status, detail, inserted, updated, errors, finished_at)
       VALUES (?,?,?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE status=VALUES(status), detail=VALUES(detail), portal_nome=VALUES(portal_nome),
         inserted=VALUES(inserted), updated=VALUES(updated), errors=VALUES(errors), finished_at=NOW()`,
      [runDate, companyId || '', portal, nome, status, String(detail || '').slice(0, 1000), counts.inserted || 0, counts.updated || 0, counts.errors || 0]
    );
  } catch (e) { console.error('[scrape] logScrape falhou:', e.message); }
}

async function run({ dry = false, only = null } = {}) {
  const runDate = todayBRT();
  const tenants = await tenantsWithKeywords();
  let targets = scrapeTargets();
  if (only) targets = targets.filter((t) => t.key === only);
  console.log(`[scrape] início — ${tenants.length} tenant(s), ${targets.length} portal(is)${dry ? ' (DRY)' : ''}`);

  for (const portal of targets) {
    const specific = ADAPTERS[portal.key];   // adapter dedicado, se houver; senão o robô genérico

    for (const companyId of tenants) {
      const keywords = await loadKeywords(companyId);
      if (!keywords.length) {
        if (!dry) await logScrape(runDate, companyId, portal.key, portal.name, 'sem_keywords', 'Tenant sem palavras-chave ativas.');
        continue;
      }
      try {
        const groups = specific
          ? await specific.sweep(keywords, { runDate })
          : await genericSweep(portal, keywords, { runDate });   // ENTRA no portal via robô de tela
        const recs = groups.flatMap((g) => g.records).map((r) => ({ ...r, companyId, firstSeenDate: runDate }));
        let res = { inserted: 0, updated: 0, errors: 0 };
        if (!dry && recs.length) res = await upsertRecords(recs);
        if (!dry) await logScrape(runDate, companyId, portal.key, portal.name, 'ok', `${recs.length} registro(s) coletado(s)${specific ? '' : ' (genérico)'}`, res);
        console.log(`[scrape] ${portal.key} · ${companyId.slice(0, 8)} → ${recs.length} (ok)`);
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        if (!dry) await logScrape(runDate, companyId, portal.key, portal.name, 'fail', msg);
        console.error(`[scrape] ${portal.key} · ${companyId.slice(0, 8)} FALHOU: ${msg}`);
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

module.exports = { run };
