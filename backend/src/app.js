require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

/** Instância principal do app Express que monta middlewares globais, rotas da API e inicia o servidor HTTP. */
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Trust proxy for accurate IP in audit logs
app.set('trust proxy', 1);

// Monta os roteadores de cada módulo da API sob seus respectivos prefixos de caminho.
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/contacts',         require('./routes/contacts'));
app.use('/api/deals',            require('./routes/deals'));
app.use('/api/funnels',          require('./routes/funnels'));
app.use('/api/users',            require('./routes/users'));
app.use('/api/win-loss-reasons', require('./routes/winLossReasons'));
app.use('/api/activities',       require('./routes/activities'));
app.use('/api/tasks',            require('./routes/tasks'));
app.use('/api/custom-fields',    require('./routes/customFields'));
app.use('/api/products',         require('./routes/products'));
app.use('/api/settings',         require('./routes/appSettings'));
app.use('/api/teams',            require('./routes/teams'));
app.use('/api/companies',        require('./routes/companies'));
app.use('/api/company-attrs',    require('./routes/companyAttributes'));
app.use('/api/locations',        require('./routes/locations'));
app.use('/api/admin/finance',    require('./routes/finance'));
app.use('/api/payment-webhooks', require('./routes/paymentWebhooks'));
app.use('/api/acl-profiles',     require('./routes/aclProfiles'));
app.use('/api/market-intelligence', require('./routes/marketIntelligence'));
app.use('/api/audit',            require('./routes/auditLogs'));

// GET /health — endpoint de verificação de saúde do servidor.
app.get('/health', (_, res) => res.json({ ok: true }));

// ── Frontend web (SPA) ────────────────────────────────────────────────────────
// Em produção (imagem única) o Node serve o build web do Expo e a API no MESMO
// domínio. WEB_DIR aponta para o `dist` exportado (ver Dockerfile). Em dev a
// pasta não existe e este bloco é ignorado (o front roda no Metro à parte).
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  app.use(express.static(WEB_DIR));
  // Fallback de SPA: qualquer GET que não seja /api ou /health devolve o index.html
  // (roteamento client-side do expo-router).
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(WEB_DIR, 'index.html'));
  });
  console.log(`[web] servindo frontend estático de ${WEB_DIR}`);
}

const PORT = process.env.PORT || 3001;
// Inicia o servidor HTTP na porta configurada e agenda a ingestão automática diária de licitações.
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  // Ingestão automática de licitações (diária às 9h BRT). Pode rodar:
  //  - in-process aqui (padrão, setups simples de 1 container); OU
  //  - num WORKER isolado (serviço `ingest-worker` do stack), e aí o web sobe
  //    com RUN_SCHEDULER=false para NÃO competir CPU/conexões com a API.
  if (process.env.RUN_SCHEDULER === 'false') {
    console.log('[scheduler] desativado neste container (RUN_SCHEDULER=false) — ingestão roda no worker isolado.');
    return;
  }
  try {
    require('./ingest/scheduler').startDailyIngest();
  } catch (e) {
    console.error('[scheduler] falha ao iniciar ingestão automática:', e.message);
  }
});
