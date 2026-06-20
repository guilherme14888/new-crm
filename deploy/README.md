# Deploy separado — 4 serviços (nada pesa um no outro)

Substitui a imagem única por **4 serviços isolados**, cada um com seus limites de
CPU/memória, para que tráfego de usuários, ingestão e scraping não disputem recursos.

| Serviço | Imagem | Papel | Recursos | Traefik |
|---|---|---|---|---|
| **web** | `crm-web` (nginx) | SPA estática (frontend) | leve (0.5 CPU / 256M) | `/` |
| **api** | `crm-api` (Node) | API do CRM (sem agendador, sem browser) | 1 CPU / 512M, 2 réplicas | `/api`, `/health` |
| **ingest-worker** | `crm-api` (mesmo, outro comando) | varredura PNCP (isolada) | 1 CPU / 512M, **1 réplica** | — (interno) |
| **scrape-worker** | `crm-scrape-worker` (Playwright) | coleta por navegador | 1.5 CPU / 1.5G (Chromium) | — (interno) |

**Mesma origem preservada:** o Traefik roteia `/api` e `/health` para a **api**
(prioridade 10) e todo o resto para a **web** (prioridade 1), no mesmo domínio. O
front continua chamando `/api` sem CORS.

## 1. Configurar

```bash
cp deploy/.env.example deploy/.env   # preencha REGISTRY, DOMAIN, DB_*, JWT_SECRET, AI_KEY_SECRET…
```

> ⚠️ `JWT_SECRET` e `AI_KEY_SECRET` devem ser **os mesmos** já usados em produção —
> senão os tokens existentes e as chaves cifradas (IA, 2Captcha) param de funcionar.

## 2. Build + push das imagens

```bash
cd deploy
set -a; source .env; set +a            # exporta as variáveis p/ o compose
docker compose -f docker-compose.build.yml build
docker login
docker compose -f docker-compose.build.yml push
```

(São 3 imagens: `crm-web`, `crm-api`, `crm-scrape-worker`. A **api** e o
**ingest-worker** usam a mesma `crm-api`.)

## 3. Deploy no Swarm

```bash
# a rede traefik-public e o Traefik já devem existir no cluster
set -a; source deploy/.env; set +a
docker stack deploy -c deploy/docker-stack.yml crm
docker service ls            # confere crm_web, crm_api, crm_ingest-worker, crm_scrape-worker
docker service logs -f crm_scrape-worker
```

## Deploy via Portainer (recomendado p/ este projeto)

O Portainer/Swarm **não builda** imagem — só roda imagem já publicada. As 3 imagens
(`crm-web`, `crm-api`, `crm-scrape-worker`) são publicadas **automaticamente pelo CI**
(GitHub Actions `release.yml`) a cada release, no DockerHub `guilherme1488/...`. Então
no Portainer você só sobe/atualiza a stack:

1. **Rede**: em *Networks*, confirme que existe a overlay `traefik-public` (a mesma do
   Traefik). Se não, crie (Driver: overlay, Attachable).
2. **Stacks → Add stack** → nome `crm`.
3. **Build method = Repository** (ideal): aponte para este repositório Git e o caminho
   `deploy/docker-stack.yml`. (Ou **Web editor** e cole o conteúdo do arquivo.)
4. **Environment variables** (seção abaixo do editor) — adicione:
   `REGISTRY=guilherme1488`, `TAG=latest` (ou a versão), `DOMAIN=sistema.br4licitacoes.com`,
   `CERT_RESOLVER=<seu resolver>`, `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`,
   `JWT_SECRET`, `AI_KEY_SECRET` (os MESMOS de hoje), `SCRAPE_INTERVAL_HOURS=12`,
   `CAPTCHA_API_KEY` (opcional).
5. **Deploy the stack**. O Portainer cria `crm_web`, `crm_api`, `crm_ingest-worker`,
   `crm_scrape-worker`.
6. **Atualizar versão**: edite a stack, troque `TAG` (ou marque *Re-pull image* se usar
   `latest`) e **Update the stack** — o Swarm faz rolling update.

> Multi-node: como as imagens vêm do DockerHub, qualquer nó do cluster as baixa. Não
> precisa buildar nos nós.

## Notas

- **Migrations** não rodam sozinhas — aplique os `.sql` de `backend/src/migrations`
  no banco antes/depois do deploy (inclui 031–036).
- **ingest-worker**: mantenha **1 réplica** (o agendador é in-process; 2+ duplicariam
  trabalho). O circuit breaker por host evita penalidade no PNCP.
- **scrape-worker**: pesado (Chromium). Só processa portais com adapter habilitado;
  CAPTCHA via 2Captcha (chave na UI ou `CAPTCHA_API_KEY`).
- **api**: pode escalar réplicas livremente (stateless; sessão é JWT).
- A imagem única antiga (`Dockerfile` na raiz) continua funcionando — este `deploy/`
  é a configuração separada que você passa a usar.
