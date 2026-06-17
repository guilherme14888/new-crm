/**
 * Auditoria de cobertura (DRY-RUN) — a "validação" para garantir que nada passa.
 *
 * Roda a VARREDURA COMPLETA do PNCP (pncp-sweep) para uma empresa e reconcilia o
 * que foi varrido contra o que JÁ existe em market_intelligence — SEM gravar nada.
 * Mostra quantas oportunidades a varredura encontra que a ingestão por palavra-chave
 * ainda não tinha (o "gap" real), agrupado por produto e por órgão.
 *
 *   node src/jobs/sweep-audit.js --company astrazeneca
 *   node src/jobs/sweep-audit.js --company astrazeneca --date 2026-06-12 --lookback 7
 *   node src/jobs/sweep-audit.js --company astrazeneca --modalidades 6,8,9,4
 *
 * É seguro rodar em produção: é leitura pura (não chama upsert).
 */
require('dotenv').config();
const db = require('../db');
const { loadKeywords } = require('../ingest/run');
const sweepConn = require('../ingest/connectors/pncp-sweep');
const { dedupeKey } = require('../ingest/normalize');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveCompanyId(value) {
  if (!value) throw new Error('Informe --company (uuid ou trecho do nome).');
  if (UUID_RE.test(value)) {
    const [r] = await db.query('SELECT id, name FROM companies WHERE id = ?', [value]);
    if (!r.length) throw new Error(`Empresa "${value}" não encontrada.`);
    return r[0];
  }
  const [r] = await db.query('SELECT id, name FROM companies WHERE name LIKE ? ORDER BY name', [`%${value}%`]);
  if (!r.length) throw new Error(`Nenhuma empresa casou com "${value}".`);
  if (r.length > 1) throw new Error(`"${value}" ambíguo: ${r.map((x) => x.name).join(' | ')}`);
  return r[0];
}

(async () => {
  const company = await resolveCompanyId(arg('company', null));
  const runDate = arg('date', null) || new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const config = {};
  if (arg('modalidades', null)) config.modalidades = arg('modalidades', null);
  if (arg('lookback', null)) config.lookbackDays = arg('lookback', null);

  console.log(`\n=== AUDITORIA DE COBERTURA (dry-run) — ${company.name} ===`);
  console.log(`dia-alvo ${runDate} | modalidades ${config.modalidades || '(default)'} | lookback ${config.lookbackDays || '(default)'}\n`);

  const keywords = await loadKeywords(company.id);
  if (!keywords.length) throw new Error('Empresa sem palavras-chave ativas.');

  const stats = {};
  const groups = await sweepConn.sweep(keywords, { delay: parseInt(arg('delay', '250'), 10), config, runDate, stats });
  const records = groups.flatMap((g) => g.records);

  // chaves já existentes no banco para este tenant
  const [dbrows] = await db.query('SELECT dedupe_key FROM market_intelligence WHERE company_id = ?', [company.id]);
  const known = new Set(dbrows.map((r) => r.dedupe_key));

  const novos = records.filter((r) => !known.has(dedupeKey(r)));
  const porProduto = {}; const porOrgao = {};
  for (const r of novos) {
    porProduto[r.produtoCandidato || '?'] = (porProduto[r.produtoCandidato || '?'] || 0) + 1;
    const o = `${r.licitador || '?'} (${r.uf || '?'})`;
    porOrgao[o] = (porOrgao[o] || 0) + 1;
  }

  console.log('\n----- RESULTADO -----');
  console.log(`Contratações enumeradas (aprox): ${stats.enumerados}`);
  console.log(`Pós pré-filtro de medicamento:  ${stats.preFiltrados}`);
  console.log(`Contratações com item casado:   ${stats.comItemCasado}`);
  console.log(`Registros (item×concorrente):   ${records.length}`);
  console.log(`JÁ no banco:                     ${records.length - novos.length}`);
  console.log(`NOVOS (gap que a busca não pegou): ${novos.length}`);
  console.log(`Erros de enumeração:             ${stats.enumErros}`);

  console.log('\nNovos por produto:');
  Object.entries(porProduto).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\nNovos por órgão (top 25):');
  Object.entries(porOrgao).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\n(dry-run — nada foi gravado. Para ingerir: node src/jobs/ingest.js --company '
    + `${company.name.split(' ')[0].toLowerCase()} --portal pncp_sweep)`);
  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
