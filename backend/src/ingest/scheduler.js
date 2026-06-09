// Agendador interno: roda a ingestão (com recuperação de dias perdidos) todo dia
// às 09h (horário de Brasília), ENQUANTO o servidor estiver no ar. Também roda no
// boot — assim, se o servidor ficou desligado em dias anteriores, ao voltar ele
// reconhece e recupera os dias faltantes. Não depende de cron do SO.
//
// Controle por .env:
//   INGEST_ENABLED          = 'true' (padrão) | 'false'
//   INGEST_HOUR_BRT         = 9 (padrão)
//   INGEST_PAGES            = 10 (padrão no agendamento)
//   INGEST_CATCHUP_ON_BOOT  = 'true' (padrão) — recupera dias perdidos ao subir
//   INGEST_MAX_BACKFILL_DAYS= 14 (janela de recuperação)
//
// Brasília é UTC-3 fixo (sem horário de verão desde 2019), então 09h BRT = 12h UTC.

const { runCatchup } = require('./run');

const BRT_OFFSET = 3; // horas atrás do UTC

/** ms até a próxima ocorrência de `hourBrt`h (horário de Brasília). */
function msUntilNext(hourBrt) {
  const now = Date.now();
  const target = new Date(now);
  target.setUTCHours((hourBrt + BRT_OFFSET) % 24, 0, 0, 0);
  if (target.getTime() <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now;
}

/** Inicia o agendamento diário + recuperação de dias não executados. */
function startDailyIngest() {
  if (String(process.env.INGEST_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[scheduler] ingestão automática desabilitada (INGEST_ENABLED=false).');
    return;
  }
  const hour = parseInt(process.env.INGEST_HOUR_BRT || '9', 10);
  const pages = parseInt(process.env.INGEST_PAGES || '10', 10);

  // dispara a rotina de recuperação (processa hoje + dias faltantes; é auto-gated).
  const fire = (motivo) => {
    console.log(`[scheduler] disparando catch-up (${motivo}) — ${new Date().toISOString()}`);
    runCatchup({ pages }).catch((e) => console.error('[scheduler] erro no catch-up:', e.message));
  };

  // No boot: recupera dias perdidos enquanto o servidor esteve fora.
  if (String(process.env.INGEST_CATCHUP_ON_BOOT || 'true').toLowerCase() === 'true') {
    setTimeout(() => fire('boot'), 5000);
  }

  const schedule = () => {
    const wait = msUntilNext(hour);
    const at = new Date(Date.now() + wait).toISOString();
    console.log(`[scheduler] próxima execução às ${String(hour).padStart(2, '0')}h BRT (${at}).`);
    setTimeout(() => {
      fire('diário');
      setInterval(() => fire('diário'), 24 * 60 * 60 * 1000); // a cada 24h
    }, wait);
  };
  schedule();
}

module.exports = { startDailyIngest, msUntilNext };
