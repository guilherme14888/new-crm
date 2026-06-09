# Ingestão de licitações — Inteligência de Mercado (multi-portal)

Popula `market_intelligence` com licitações reais (futuras, em andamento e
encerradas), buscadas por **palavras-chave** (geridas pela UI, por tenant), em
**vários portais**, com **dedup por empresa** e **atualização diária às 09h**
enquanto o servidor estiver no ar.

## Multi-tenant (por empresa)

Keywords, configuração de portais e dados são **por tenant** (`company_id`). Cada
empresa vê só as suas licitações; o *master* vê todas. Dedup por
`(company_id, dedupe_key)`. A ingestão roda para cada empresa com keywords ativas.

## Palavras-chave + filtro de contexto

Geridas em **Configurações → Palavras-Chave**. Cada palavra tem `termo`,
`produto_candidato` (rótulo), `ativo`, `contexto` (descrição do negócio) e
`negativos` (termos que EXCLUEM um achado). No scan, os achados de cada keyword
passam por `filterRelevant()` em LOTE, em camadas (da mais barata p/ a mais cara):

| Camada | O que faz | Custo |
|---|---|---|
| **T0 Negativos** | descarta fora do contexto ("pneu de carrinho de obra") | grátis |
| **T1 Cache exato** | reaproveita veredito por (empresa,termo,descrição) | grátis após 1ª vez |
| **T2 Cache semântico** | item parecido reaproveita veredito (VECTOR no MariaDB, cosine) | 1 embedding |
| **T3 LLM em lote** | Claude Haiku decide o que sobrou (25/chamada, prompt caching) | $ |

Liga a IA: `INGEST_AI_RELEVANCE=true` + `ANTHROPIC_API_KEY`. O cache semântico (T2)
liga sozinho se houver `VOYAGE_API_KEY` (ou `OPENAI_API_KEY`). Como a varredura
diária repete muitos itens, do 2º dia em diante quase tudo cai no T1 (custo ~0).
Log por tenant: `cache N+sem M, chamadas IA X, emb Y`.

## Arquitetura

```
src/ingest/
  http.js                 # fetch com User-Agent de navegador, timeout, retry
  normalize.js            # região/UF, status, datas, dedupeKey canônico
  upsert.js               # grava 1 registro (UPSERT por dedupe_key, merge de fontes)
  index.js                # registro dos conectores
  run.js                  # orquestrador (roda conectores x keywords)
  scheduler.js            # agendador interno diário (09h BRT)
  connectors/
    pncp.js               # ATIVO
    effecti.js, conlicitacao.js, licitaja.js,
    forseti.js, comprasbr.js, bll.js   # pendentes (aguardando credenciais/impl.)
src/jobs/ingest.js        # CLI
```

Todo conector implementa a **mesma interface**:

```js
module.exports = {
  name: 'PNCP',
  enabled: true,
  async search(keyword, { pages, size, delay }) {
    // ... busca no portal e retorna registros NORMALIZADOS (camelCase)
    return records; // [{ fonte, cnpj, licitador, uf, nProcesso, lote, item,
                    //    produtoCandidato, produtoLicitado, quantidade,
                    //    precoEstimadoUnit, concorrente, cnpjConcorrente, ... }]
  },
};
```

O orquestrador chama `upsertRecord(rec)` para cada registro — então **adicionar
um portal novo é só criar o módulo e registrá-lo em `index.js`**; coleta, dedupe
e gravação já são padronizadas.

## Deduplicação global (zero duplicidade)

Cada linha recebe uma **chave canônica** independente do portal:

```
dedupe_key = cnpjÓrgão | nºProcesso(ou edital) | lote | item | cnpjConcorrente
```

A coluna `dedupe_key` tem índice **ÚNICO**; a gravação é
`INSERT ... ON DUPLICATE KEY UPDATE`. Logo:

- a mesma licitação vista em **PNCP e Effecti** vira **uma linha só** — a coluna
  `fontes` acumula os portais (`PNCP,EFFECTI`);
- rodar de novo **atualiza** (preço, status, resultado homologado) e **nunca
  duplica**.

> A chave em `normalize.js` (JS) é idêntica à fórmula SQL da migration
> `021_market_intelligence_dedupe.sql` — manter as duas em sincronia ao alterar.

## Atualização diária + recuperação de dias perdidos (catch-up)

O agendador é **interno ao servidor** (`scheduler.js`, iniciado no `app.js`):
roda todo dia às 09h BRT **e no boot** — sem cron do SO.

Cada execução **visa um dia** (`run_date`, padrão = hoje BRT) e é registrada em
`market_intelligence_run_log` por `(empresa, dia)`. A rotina `runCatchup()`:

1. calcula os últimos `INGEST_MAX_BACKFILL_DAYS` dias;
2. **reconhece os dias sem registro** (servidor desligado, falha, etc.);
3. roda a mineração (estado atual dos portais) e marca os dias faltantes como
   recuperados (`status = 'catchup'`).

Como a dedupe é por `(company_id, dedupe_key)`, a **mesma licitação capturada em
dias diferentes não é duplicada**. A coluna `first_seen_date` (insert-only) guarda
o dia da **primeira** captura de cada oportunidade — é consultável e nunca muda.

> Limite do PNCP/portais: a busca retorna o estado **atual**. O catch-up captura
> tudo o que estiver disponível no momento (sem perder o que segue publicado),
> mas não recupera editais que surgiram **e** sumiram durante a indisponibilidade.

```
INGEST_ENABLED=true            # liga/desliga
INGEST_HOUR_BRT=9              # hora (horário de Brasília, UTC-3)
INGEST_PAGES=10               # páginas por termo no agendamento
INGEST_CATCHUP_ON_BOOT=true   # recupera dias perdidos ao subir o servidor
INGEST_MAX_BACKFILL_DAYS=14   # janela de recuperação
```

CLI: `npm run ingest:catchup` · `node src/jobs/ingest.js --date 2026-06-01`

## Uso manual (CLI)

```bash
cd backend
npm run ingest                                   # todos os portais ativos
npm run ingest:pncp                              # só PNCP
node src/jobs/ingest.js --portal pncp,bll        # portais específicos
node src/jobs/ingest.js --pages 40               # backfill amplo
node src/jobs/ingest.js --termo osimertinibe --pages 2 --size 20
```

## Portais e credenciais

| Portal | Status | Modo | Credencial (.env) |
|---|---|---|---|
| **PNCP** | ✅ ativo | busca por keyword | — (API pública) |
| **Licitaja** | ✅ pronto (ativa com a key) | busca por keyword | `LICITAJA_API_KEY` |
| **BLL** | ✅ pronto (ativa com orgKey) | lista de processos (`collect`) | `BLL_ORG_KEY`, `BLL_PROCESSES` |
| Effecti | pendente | busca por keyword | `EFFECTI_USER`, `EFFECTI_PASS` |
| Conlicitação | pendente | busca por keyword | `CONLICITACAO_TOKEN` |
| Forseti | pendente | busca por keyword | `FORSETI_USER`, `FORSETI_PASS` |
| ComprasBR | pendente | busca por keyword | `COMPRASBR_USER`, `COMPRASBR_PASS` |

### Licitaja (API REST oficial)

`GET /api/v1/tender/search?keyword=...` com header `X-API-KEY`. Gere a chave na
sua conta e ponha em `LICITAJA_API_KEY` — o conector **ativa sozinho**. Sem a
chave a API responde resultados parciais (sem `tenderId`/`process`/`value`); por
isso, hoje, geramos **1 linha por licitação** (chave de dedupe pela URL única).
Com a key, dá para expandir para item-level lendo o array `lots`.

### BLL (SOAP — só processos conhecidos)

O web service do BLLCompras (`ProcessResult.svc`) é a integração do **órgão
promotor** e **não tem busca por palavra-chave**. Ele puxa lotes/itens/
classificação/valores finais de um processo cujo **número você já sabe**, usando
a `orgKey` (gerada logando como Autoridade de Promotor). Configure
`BLL_ORG_KEY` + `BLL_PROCESSES` (lista JSON de `{number, modalityId, ...}`) e o
conector entra via `collect()` na execução diária. Para *descobrir* licitações
do BLL por nome de remédio, seria preciso a busca pública do site (scraping),
que é um caminho à parte.

> **Nunca** comite o `.env` real nem cole senhas em código. Os conectores
> pendentes leem as credenciais do `.env`; cada um será implementado (login +
> busca + mapeamento) assim que as credenciais estiverem disponíveis. Portais
> sem API aberta exigem scraping autenticado (Playwright) — mais frágil; quando
> houver API/token oficial (ex.: Conlicitação), preferir sempre a API.
