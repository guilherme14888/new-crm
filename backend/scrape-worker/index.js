// Entry do scrape-worker (serviço isolado). Roda a coleta por navegador a cada N
// horas. Mantenha 1 réplica (ou particione os adapters entre réplicas por hash) —
// o upsert é idempotente, mas browsers em paralelo no mesmo portal multiplicam carga.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { run } = require('./runner');

const HOURS = Math.max(1, parseInt(process.env.SCRAPE_INTERVAL_HOURS || '12', 10));

async function tick() {
  try { await run({}); } catch (e) { console.error('[scrape-worker] erro no ciclo:', e.message || e); }
}

console.log(`[scrape-worker] iniciando — intervalo ${HOURS}h`);
tick();
setInterval(tick, HOURS * 3600 * 1000);
