// Orquestrador multi-tenant: para cada empresa, roda os portais habilitados por
// ELA usando as palavras-chave DELA, aplica o filtro de relevância (contexto) e
// grava com company_id. A deduplicação é por (company_id, dedupe_key).

const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { connectors } = require('./index');
const { upsertRecord } = require('./upsert');
const { sleep } = require('./http');
const { loadAll } = require('./sources');
const { filterRelevant } = require('./relevance');

let running = false; // trava anti-sobreposição (scheduler + chamada manual)

// ── Datas (horário de Brasília, UTC-3) ────────────────────────────────────────
/** Data de hoje em Brasília no formato "AAAA-MM-DD". */
function todayBRT() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Lista as últimas `n` datas (AAAA-MM-DD) terminando em `endDate` (inclusive). */
function lastNDates(endDate, n) {
  const out = [];
  const base = new Date(`${endDate}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ── Log de execução por (empresa, dia) ────────────────────────────────────────
/** Datas (AAAA-MM-DD) já executadas de uma empresa nos últimos `n` dias. */
async function loggedDates(companyId, n) {
  const since = lastNDates(todayBRT(), n).slice(-1)[0];
  const [rows] = await db.query(
    'SELECT DATE_FORMAT(run_date, "%Y-%m-%d") d FROM market_intelligence_run_log WHERE company_id = ? AND run_date >= ?',
    [companyId, since]
  );
  return rows.map((r) => r.d);
}
/** Registra (ou atualiza) que a mineração rodou para uma empresa em um dia. */
async function logRun(companyId, runDate, status, inserted, updated) {
  await db.query(
    `INSERT INTO market_intelligence_run_log (id, company_id, run_date, status, inserted, updated, finished_at)
     VALUES (?,?,?,?,?,?, NOW())
     ON DUPLICATE KEY UPDATE status=VALUES(status), inserted=inserted+VALUES(inserted), updated=updated+VALUES(updated), finished_at=NOW()`,
    [uuidv4(), companyId, runDate, status, inserted || 0, updated || 0]
  );
}

async function loadKeywords(companyId) {
  const [rows] = await db.query(
    `SELECT termo, produto_candidato AS produtoCandidato, contexto, negativos
       FROM market_intelligence_keywords
      WHERE ativo = 1 AND company_id = ? ORDER BY termo`,
    [companyId]
  );
  return rows;
}

// Empresas que têm ao menos uma palavra-chave ativa.
async function tenantsWithKeywords() {
  const [rows] = await db.query(
    'SELECT DISTINCT company_id FROM market_intelligence_keywords WHERE ativo = 1 AND company_id IS NOT NULL'
  );
  return rows.map((r) => r.company_id);
}

/**
 * @param {object} opts
 *   companyId : roda só este tenant (default: todos com keywords)
 *   portals   : string[] nomes/keys a rodar; vazio = todos habilitados
 *   pages, size, delay, term
 */
async function runIngest(opts = {}) {
  if (running) { console.log('[ingest] já em execução — ignorando chamada.'); return { skipped: true }; }
  running = true;
  const started = Date.now();
  const runDate = opts.runDate || todayBRT();   // dia-alvo da execução
  try {
    const wanted = (opts.portals || []).map((p) => p.toLowerCase());
    const companies = opts.companyId ? [opts.companyId] : await tenantsWithKeywords();
    console.log(`[ingest] início — ${companies.length} tenant(s) — dia ${runDate}`);

    const grand = { inserted: 0, updated: 0, errors: 0, skippedNeg: 0, skippedAI: 0, cacheHits: 0, semanticHits: 0, aiCalls: 0, embedCalls: 0 };
    const perTenant = {};

    for (const companyId of companies) {
      const keywords = opts.term
        ? [{ termo: opts.term, produtoCandidato: null, contexto: null, negativos: null }]
        : await loadKeywords(companyId);
      if (!keywords.length) continue;

      const sources = await loadAll(companyId);
      const matchPortal = (c) => !wanted.length || wanted.includes(c.name.toLowerCase()) || wanted.includes(c.key);
      const isOn = (c) => !!(sources[c.key] && sources[c.key].enabled) && c.implemented;
      const cfgOf = (c) => (sources[c.key] || { config: {} }).config;
      const enabled = connectors.filter((c) => isOn(c) && matchPortal(c));

      const st = { inserted: 0, updated: 0, errors: 0, skippedNeg: 0, skippedAI: 0, cacheHits: 0, semanticHits: 0, aiCalls: 0, embedCalls: 0 };
      console.log(`[ingest] tenant ${companyId} — portais: ${enabled.map((c) => c.name).join(', ') || '(nenhum)'}, ${keywords.length} keyword(s)`);

      const upsertAll = async (records) => {
        for (const rec of records) {
          try { st[await upsertRecord({ ...rec, companyId, firstSeenDate: runDate })]++; } catch { st.errors++; }
        }
      };

      for (const c of enabled) {
        const config = cfgOf(c);
        if (typeof c.search === 'function') {
          for (const kw of keywords) {
            try {
              const records = await c.search(kw, { pages: opts.pages, size: opts.size, delay: opts.delay, config });
              // filtro de relevância EM LOTE (T0 negativos → T1 cache → T2 vetorial → T3 LLM)
              const relevant = await filterRelevant(records, kw, companyId, st);
              await upsertAll(relevant);
            } catch (e) {
              st.errors++;
              console.error(`[ingest] ${c.name} · "${kw.termo}" falhou: ${e.message}`);
            }
            await sleep(opts.delay || 200);
          }
        }
        if (typeof c.collect === 'function') {
          try {
            const records = await c.collect({ pages: opts.pages, size: opts.size, delay: opts.delay, config });
            await upsertAll(records); // collect (BLL) já classifica; sem filtro por keyword
          } catch (e) {
            st.errors++;
            console.error(`[ingest] ${c.name} · collect falhou: ${e.message}`);
          }
        }
        if (typeof c.sweep === 'function') {
          // Varredura completa: enumera tudo e devolve registros já agrupados por
          // keyword; cada grupo passa pelo mesmo filtro de relevância (T0–T3).
          try {
            const sweepStats = {};
            const groups = await c.sweep(keywords, { delay: opts.delay, config, runDate, stats: sweepStats });
            for (const g of groups) {
              const relevant = await filterRelevant(g.records, g.kw, companyId, st);
              await upsertAll(relevant);
            }
            st.swept = (st.swept || 0) + (sweepStats.preFiltrados || 0);
          } catch (e) {
            st.errors++;
            console.error(`[ingest] ${c.name} · sweep falhou: ${e.message}`);
          }
        }
      }

      // registra a execução do dia para este tenant (para o catch-up reconhecer)
      try { await logRun(companyId, runDate, opts.logStatus || 'ok', st.inserted, st.updated); } catch { /* não bloqueia */ }

      perTenant[companyId] = st;
      for (const k of Object.keys(grand)) if (st[k] !== undefined) grand[k] += st[k];
      const fora = st.skippedNeg + st.skippedAI;
      console.log(`[ingest] tenant ${companyId} → novas ${st.inserted}, atualizadas ${st.updated}, fora de contexto ${fora} (neg ${st.skippedNeg}/IA ${st.skippedAI}), cache ${st.cacheHits}+sem ${st.semanticHits}, chamadas IA ${st.aiCalls}, emb ${st.embedCalls}, erros ${st.errors}`);
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[ingest] fim em ${secs}s — novas ${grand.inserted}, atualizadas ${grand.updated}, fora de contexto ${grand.skippedNeg + grand.skippedAI}, chamadas IA ${grand.aiCalls}, erros ${grand.errors}`);
    return { perTenant, totals: grand };
  } finally {
    running = false;
  }
}

/**
 * Recuperação (catch-up): garante que TODO dia tenha execução. Reconhece os dias
 * sem registro (servidor desligado, falha etc.) e os processa. Como os portais
 * retornam o estado ATUAL das licitações e a dedupe é por (empresa, dedupe_key),
 * uma execução de recuperação captura tudo o que está disponível sem duplicar o
 * que já foi pego em dias anteriores. Os dias passados sem dados ficam marcados
 * como cobertos ('catchup') para não serem reprocessados.
 *
 * @param {object} opts  companyId?, pages, size, delay, maxDays (janela de recuperação)
 */
async function runCatchup(opts = {}) {
  const today = todayBRT();
  const maxDays = parseInt(opts.maxDays || process.env.INGEST_MAX_BACKFILL_DAYS || '14', 10);
  const companies = opts.companyId ? [opts.companyId] : await tenantsWithKeywords();
  const want = lastNDates(today, maxDays);

  const summary = [];
  for (const companyId of companies) {
    const logged = new Set(await loggedDates(companyId, maxDays));
    const missing = want.filter((d) => !logged.has(d));
    if (missing.length === 0) {
      console.log(`[catchup] ${companyId} — em dia (nada a recuperar).`);
      summary.push({ companyId, missing: 0 });
      continue;
    }
    console.log(`[catchup] ${companyId} — ${missing.length} dia(s) sem execução: ${missing.join(', ')}`);
    // 1 execução (estado atual) cobre o que estiver disponível; dedupe evita repetição.
    await runIngest({ ...opts, companyId, runDate: today });
    // marca os demais dias faltantes (passados) como cobertos pela recuperação.
    for (const d of missing) {
      if (d !== today) { try { await logRun(companyId, d, 'catchup', 0, 0); } catch { /* ignora */ } }
    }
    summary.push({ companyId, missing: missing.length, recovered: missing });
  }
  console.log(`[catchup] concluído — ${companies.length} tenant(s).`);
  return { today, summary };
}

module.exports = { runIngest, runCatchup, loadKeywords, todayBRT };
