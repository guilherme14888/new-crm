/**
 * Worker de ingestão — processo ISOLADO (container separado no Swarm), usando a
 * MESMA imagem do sistema (command override: `node src/jobs/worker.js`).
 *
 * Roda só o agendador interno (catch-up no boot + diário às 9h BRT). NÃO sobe
 * servidor HTTP, então a varredura do PNCP não disputa CPU/event-loop nem o pool
 * de conexões do container que serve o web/API.
 *
 * Mantenha SEMPRE 1 réplica deste serviço (o agendador é in-process; 2+ réplicas
 * rodariam a ingestão em duplicidade — a dedupe evita dados duplicados, mas é
 * trabalho desperdiçado).
 */
require('dotenv').config();
const { startDailyIngest } = require('../ingest/scheduler');

console.log('[worker] iniciando worker de ingestão (processo isolado)…');
startDailyIngest();

// Mantém o processo vivo mesmo que o agendador esteja desabilitado
// (INGEST_ENABLED=false não agenda timers; sem isto o Node encerraria).
const keepAlive = setInterval(() => {}, 1 << 30);

// Encerramento limpo no swarm (docker service update / rollback envia SIGTERM).
const shutdown = (sig) => () => {
  console.log(`[worker] ${sig} recebido — encerrando.`);
  clearInterval(keepAlive);
  process.exit(0);
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
