// Agendador interno: roda a ingestão (com recuperação de dias perdidos) todo dia
// às 09h (horário de Brasília), ENQUANTO o processo estiver no ar. Roda no boot
// (recupera dias em que ficou fora) e tem uma REDE DE SEGURANÇA: a cada 30 min,
// se já passou da hora e o dia ainda não rodou, dispara — assim um timer perdido,
// drift ou reboot não fazem o agendamento "sumir". Não depende de cron do SO.
//
// Controle por .env:
//   INGEST_ENABLED          = 'true' (padrão) | 'false'
//   INGEST_HOUR_BRT         = 9 (padrão)
//   INGEST_PAGES            = 10 (padrão no agendamento)
//   INGEST_CATCHUP_ON_BOOT  = 'true' (padrão) — recupera dias perdidos ao subir
//   INGEST_MAX_BACKFILL_DAYS= 14 (janela de recuperação)
//
// Brasília é UTC-3 fixo (sem horário de verão desde 2019), então 09h BRT = 12h UTC.

const db = require('../db');
const { runCatchup, todayBRT } = require('./run');

const BRT_OFFSET = 3; // horas atrás do UTC

/** ms até a próxima ocorrência de `hourBrt`h (horário de Brasília). */
function msUntilNext(hourBrt) {
  const now = Date.now();
  const target = new Date(now);
  target.setUTCHours((hourBrt + BRT_OFFSET) % 24, 0, 0, 0);
  if (target.getTime() <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now;
}

/** Hora atual em Brasília (0-23). */
function brtHourNow() {
  return (new Date().getUTCHours() - BRT_OFFSET + 24) % 24;
}

/** Inicia o agendamento diário + recuperação de dias não executados. */
function startDailyIngest() {
  if (String(process.env.INGEST_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[scheduler] ingestão automática desabilitada (INGEST_ENABLED=false).');
    return;
  }
  const hour = parseInt(process.env.INGEST_HOUR_BRT || '9', 10);
  const pages = parseInt(process.env.INGEST_PAGES || '10', 10);

  let running = false; // evita sobreposição entre o timer diário e a rede de segurança
  const fire = async (motivo) => {
    if (running) return;
    running = true;
    console.log(`[scheduler] disparando catch-up (${motivo}) — ${new Date().toISOString()}`);
    try { await runCatchup({ pages }); }
    catch (e) { console.error('[scheduler] erro no catch-up:', e.message); }
    finally { running = false; }
  };

  // No boot: recupera dias perdidos enquanto o processo esteve fora.
  if (String(process.env.INGEST_CATCHUP_ON_BOOT || 'true').toLowerCase() === 'true') {
    setTimeout(() => fire('boot'), 5000);
  }

  // Timer diário preciso: dispara exatamente às `hour`h BRT e repete a cada 24h.
  const schedule = () => {
    const wait = msUntilNext(hour);
    const at = new Date(Date.now() + wait).toISOString();
    console.log(`[scheduler] próxima execução às ${String(hour).padStart(2, '0')}h BRT (${at}).`);
    setTimeout(() => {
      fire('diário');
      setInterval(() => fire('diário'), 24 * 60 * 60 * 1000);
    }, wait);
  };
  schedule();

  // Rede de segurança: a cada 30 min, se já passou da hora e HOJE ainda não rodou,
  // dispara. runCatchup é idempotente (não reprocessa dia já marcado 'ok'), então
  // isto só faz trabalho real quando o dia está realmente faltando.
  const TICK_MS = 30 * 60 * 1000;
  setInterval(async () => {
    try {
      if (running || brtHourNow() < hour) return;
      const [r] = await db.query(
        "SELECT 1 FROM market_intelligence_run_log WHERE run_date = ? AND status = 'ok' LIMIT 1",
        [todayBRT()]
      );
      if (r.length) return; // hoje já rodou
      console.log('[scheduler] rede de segurança: hoje ainda não rodou — disparando.');
      fire('rede-de-seguranca');
    } catch (e) { console.error('[scheduler] erro na rede de segurança:', e.message); }
  }, TICK_MS);
  console.log(`[scheduler] ativo: diário às ${hour}h BRT + rede de segurança a cada 30min.`);
}

module.exports = { startDailyIngest, msUntilNext };
