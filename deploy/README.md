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

O `deploy/docker-stack.yml` já vem com **seus dados** (domínio, `network_public`,
`websecure`, `letsencryptresolver`, imagens `guilherme1488/*`). Você só informa os
segredos — **igual ao stack atual**:

1. **Aguarde o CI** publicar as imagens (`crm-web`, `crm-api`, `crm-scrape-worker`) —
   o GitHub Actions faz isso no release. (Ou builde manual: `docker compose -f
   deploy/docker-compose.build.yml build && push`.)
2. **Networks**: confirme a overlay `network_public` (a do seu Traefik).
3. **Stacks → Add stack** → nome `br4-sistema` (ou edite o existente).
4. **Web editor**: cole o conteúdo de `deploy/docker-stack.yml`.
5. **Environment variables** → crie (os MESMOS de hoje): `DB_HOST`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
6. **Deploy the stack** → cria `br4-sistema_web`, `_api`, `_ingest-worker`, `_scrape-worker`.
7. **Atualizar versão**: edite a stack e marque *Re-pull image* (usa `:latest`) →
   **Update the stack** (rolling update `start-first`, zero-downtime).

> Não precisa setar `AI_KEY_SECRET`: sem ela, a cripto de IA/2Captcha usa o
> `JWT_SECRET` (mesmo comportamento de hoje). Se um dia definir, use o MESMO valor,
> senão as chaves já cifradas param de decifrar.
>
> Multi-node: as imagens vêm do DockerHub — qualquer nó as baixa, sem buildar.

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
