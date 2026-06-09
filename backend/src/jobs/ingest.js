/**
 * CLI de ingestão de licitações (multi-portal).
 *
 *   node src/jobs/ingest.js                       # todos os portais habilitados, todas as keywords
 *   node src/jobs/ingest.js --portal pncp         # só um portal
 *   node src/jobs/ingest.js --portal pncp,bll     # vários
 *   node src/jobs/ingest.js --company medlevensohn # só uma empresa (id OU trecho do nome)
 *   node src/jobs/ingest.js --company 47bedd64-... --portal pncp
 *   node src/jobs/ingest.js --termo osimertinibe --pages 2 --size 20
 *   node src/jobs/ingest.js --pages 40            # backfill amplo
 *   node src/jobs/ingest.js --catchup             # recupera dias não executados
 *   node src/jobs/ingest.js --date 2026-06-01     # executa visando um dia específico
 *
 * Deduplicação é por tenant (company_id, dedupe_key) — rodar de novo nunca duplica.
 */
require('dotenv').config();
const db = require('../db');
const { runIngest, runCatchup } = require('../ingest/run');

/** Lê um argumento de linha de comando `--nome valor` (ou devolve o default). */
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
/** Verifica a presença de uma flag `--nome` (sem valor). */
const flag = (name) => process.argv.includes(`--${name}`);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve o `--company` para um company_id. Aceita o UUID direto ou um trecho do
 * nome (case-insensitive). Erro se nada casar ou se houver ambiguidade.
 */
async function resolveCompanyId(value) {
  if (!value) return null;
  if (UUID_RE.test(value)) {
    const [rows] = await db.query('SELECT id, name FROM companies WHERE id = ?', [value]);
    if (!rows.length) throw new Error(`Empresa com id "${value}" não encontrada.`);
    console.log(`[ingest] empresa: ${rows[0].name} (${rows[0].id})`);
    return rows[0].id;
  }
  const [rows] = await db.query('SELECT id, name FROM companies WHERE name LIKE ? ORDER BY name', [`%${value}%`]);
  if (!rows.length) throw new Error(`Nenhuma empresa casou com "${value}".`);
  if (rows.length > 1) {
    const list = rows.map((r) => `  - ${r.name} (${r.id})`).join('\n');
    throw new Error(`"${value}" casou com ${rows.length} empresas — refine ou use o id:\n${list}`);
  }
  console.log(`[ingest] empresa: ${rows[0].name} (${rows[0].id})`);
  return rows[0].id;
}

(async () => {
  const companyId = await resolveCompanyId(arg('company', null));

  const opts = {
    companyId,                    // null = todas as empresas com keywords
    portals: (arg('portal', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
    pages: parseInt(arg('pages', '5'), 10),
    size: parseInt(arg('size', '50'), 10),
    delay: parseInt(arg('delay', '300'), 10),
    term: arg('termo', null),
    runDate: arg('date', null),   // dia-alvo (AAAA-MM-DD); default = hoje
  };

  await (flag('catchup') ? runCatchup(opts) : runIngest(opts));
  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
