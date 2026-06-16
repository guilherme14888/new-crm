/**
 * Worker de ingestão — processo ISOLADO (container separado no Swarm), usando a
 * MESMA imagem do sistema (command override: `node src/jobs/worker.js`).
 *
 * Roda só o agendador interno (catch-up no boot + diário às 9h BRT). Sobe apenas
 * um mini servidor HTTP de /health (a varredura do PNCP não disputa o web/API).
 *
 * Mantenha SEMPRE 1 réplica deste serviço (o agendador é in-process; 2+ réplicas
 * rodariam a ingestão em duplicidade — a dedupe evita dados duplicados, mas é
 * trabalho desperdiçado).
 */
require('dotenv').config();
const http = require('http');
const { startDailyIngest } = require('../ingest/scheduler');

// Servidor mínimo de healthcheck: a imagem tem HEALTHCHECK em GET /health; sem
// isto o Swarm marcaria o worker como unhealthy e o mataria (SIGTERM) em loop,
// interrompendo a ingestão. Responde 200 e fica de pé.
const PORT = process.env.PORT || 3001;
http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"role":"ingest-worker"}'); }
  else { res.writeHead(404); res.end(); }
}).listen(PORT, () => console.log(`[worker] health em :${PORT}`));

console.log('[worker] iniciando worker de ingestão (processo isolado)…');
startDailyIngest();

// Encerramento limpo no swarm (docker service update / rollback envia SIGTERM).
const shutdown = (sig) => () => {
  console.log(`[worker] ${sig} recebido — encerrando.`);
  process.exit(0);
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
