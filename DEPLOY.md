# Deploy — Sistema BR4 Licitações

Imagem **única** (`guilherme1488/br4licitacoes`) onde o Node serve o **frontend web** (Expo)
e a **API** (`/api`) no mesmo domínio, atrás do **Traefik** no **Docker Swarm**.
URL de produção: **https://sistema.br4licitacoes.com**

---

## 1. Arquitetura

```
Internet → Traefik (websecure/TLS) → serviço "sistema" (porta 3001)
                                         ├── /            → SPA web (expo export)
                                         ├── /api/*       → API Express
                                         └── /health      → healthcheck
                                                 │
                                                 └── MariaDB EXTERNO (DB_HOST)
```

O front foi configurado em modo **same-origin** (`API_URL=""` no build): ele chama
`/api/...` na mesma origem que o serviu — nada de porta 3001 exposta publicamente.

---

## 2. Versionamento automático (Conventional Commits → SemVer)

A cada `push` na branch principal, o GitHub Actions roda o **semantic-release**, que
decide a versão pela **mensagem do commit**:

| Prefixo do commit                         | Efeito              | Exemplo de versão |
|-------------------------------------------|---------------------|-------------------|
| `fix:` , `style:` , `perf:` , `refactor:` | **patch** (correção/layout) | v1.0.0 → v1.0.**1** |
| `feat:`                                   | **minor** (nova implementação) | v1.0.1 → v1.**1**.0 |
| `feat!:` ou rodapé `BREAKING CHANGE:`     | **major** (quebra)  | v1.1.0 → **2**.0.0 |
| `chore:` , `docs:` , `test:` , `ci:`      | (sem release)       | —                 |

O **primeiro** release qualificado sai como **v1.0.0**.

Exemplos:
```bash
git commit -m "feat: tela de listagem de licitações com filtros"     # → minor
git commit -m "fix: corrige alinhamento do drawer de filtros"         # → patch (layout)
git commit -m "feat!: nova API de autenticação

BREAKING CHANGE: tokens antigos deixam de ser aceitos"                # → major
```

Cada release cria: **tag git** `vX.Y.Z`, **GitHub Release**, entrada no `CHANGELOG.md`
e publica no DockerHub `guilherme1488/br4licitacoes:vX.Y.Z` **e** `:latest`.

---

## 3. Configuração inicial (uma vez)

### 3.1 GitHub
1. Crie o repositório e faça o push (ver §4).
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `DOCKERHUB_USERNAME` — usuário/organização do DockerHub.
   - `DOCKERHUB_TOKEN` — *access token* (DockerHub → Account Settings → **Security** → New Access Token, escopo Read/Write).
3. Confirme que **Settings → Actions → General → Workflow permissions** está em
   **Read and write permissions** (necessário p/ o semantic-release criar tag e commit do changelog).

### 3.2 DockerHub
- Crie o repositório **`guilherme1488/br4licitacoes`** (pode ser privado; nesse caso o swarm
  precisa de credencial para puxar a imagem).

### 3.3 DNS
- Crie um registro **A** `sistema` → IP do seu swarm (mesmo IP do `n8n.br4licitacoes.com`).
  O Traefik + Let's Encrypt emitem o certificado no primeiro acesso.

---

## 4. Primeiro commit / push

```bash
git checkout -b main                 # caso ainda não esteja
git add .
git commit -m "feat: dockerização, CI de release e deploy no swarm"
git remote add origin git@github.com:<org>/<repo>.git   # se ainda não houver
git push -u origin main
```

> O `backend/.env` e `.env` **não** vão para o repositório (já estão no `.gitignore`)
> nem para a imagem (estão no `.dockerignore`). Configure os segredos de produção
> via variáveis de ambiente no `stack.yml` / Portainer.

Ao concluir o push, o workflow **Release & Publish** roda e publica `guilherme1488/br4licitacoes:v1.0.0`.

---

## 5. Deploy no Portainer (Swarm)

1. **Stacks → Add stack** → cole o conteúdo de [`stack.yml`](./stack.yml).
2. Ajuste no stack:
   - `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` → seu **MariaDB externo**.
   - `JWT_SECRET` → um segredo longo e aleatório.
   - `network_public` → o nome real da rede overlay do seu Traefik
     (`docker network ls`). É a **mesma rede** onde o n8n está publicado.
3. **Deploy the stack**.

O MariaDB precisa estar acessível pelo serviço (mesma rede overlay ou host alcançável).
O banco **já está populado** (empresas, usuários, 6.900+ licitações) — nenhuma migração
roda automaticamente no boot.

---

## 6. Atualizações (CI contínuo)

```bash
git commit -m "fix: ajuste no cabeçalho da listagem"
git push
```
1. O Actions publica a nova `vX.Y.Z` + `:latest` no DockerHub.
2. No Portainer, **atualize o serviço** (ou `docker service update --image
   guilherme1488/br4licitacoes:vX.Y.Z br4-sistema_sistema`). O `update_config: start-first`
   sobe a nova versão antes de derrubar a antiga (sem downtime).

> Dica: para reprodutibilidade, **fixe a versão** no stack (`:v1.2.3`) em vez de `:latest`.

---

## 7. Build/teste local (opcional)

```bash
# build da imagem
docker build -t guilherme1488/br4licitacoes:dev .

# roda apontando para um MariaDB acessível
docker run --rm -p 3001:3001 \
  -e DB_HOST=host.docker.internal -e DB_USER=crm -e DB_PASSWORD=... -e DB_NAME=crmbr4 \
  -e JWT_SECRET=dev-secret \
  guilherme1488/br4licitacoes:dev
# abra http://localhost:3001
```
