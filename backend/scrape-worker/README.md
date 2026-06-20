# scrape-worker — coleta por navegador (Playwright) dos portais sem API

Serviço **isolado** (não roda no processo da API) que coleta licitações de portais
que **não têm API**, usando navegador headless (Playwright). Os registros caem na
MESMA base `market_intelligence`, com `fonte`/`fontes` e a **dedup por `dedupe_key`**
do backend — então nunca duplicam e você sempre sabe a origem. Ver a arquitetura em
[../../docs/coleta-portais-sem-api.md](../../docs/coleta-portais-sem-api.md).

## Como rodar

```bash
cd backend/scrape-worker
npm install                 # instala playwright (browsers vêm na imagem Docker)
npx playwright install chromium   # só em dev local

node runner.js --dry              # valida o framework sem gravar
node runner.js --only exemplo     # roda só um adapter
node runner.js                    # roda tudo e grava
node index.js                     # modo serviço (agenda a cada SCRAPE_INTERVAL_HOURS)
```

`--dry` usa o adapter `exemplo` (sem browser) para validar runner → normalização →
upsert sem tocar no portal nem no banco.

## Interface de um adapter

Cada portal é um módulo em `adapters/` com a MESMA interface dos `connectors/` do
backend:

```js
module.exports = {
  key: 'bec_sp',
  name: 'BEC-SP',
  kind: 'browser',            // 'browser' (Playwright) ou 'http'
  async sweep(keywords, opts) {
    // → devolve [{ kw, records }] com records no shape normalizado
  },
};
```

O `runner` cuida do resto: itera tenants × keywords, chama `sweep`, e grava via
`upsertRecords` (dedup + `fonte` + histórico `market_intelligence_history`).

### Campos mínimos do record
`fonte` (ex.: `'BEC-SP'`), `termoBusca`, `produto`, `licitador`, `uf`, `nProcesso`,
`processoKey` (único e estável → evita duplicar), `produtoLicitado`, `encerramento`,
`nomeSite`, `urlSite`. Para o **histórico** (abertura → vencedor → encerramento),
preencha quando o portal expuser: `status`, `encerramento`, `posicao`, `concorrente`
(vencedor), `precoFinalUnit/Total`, datas. Re-coletar ao longo do tempo monta a
linha do tempo automaticamente.

## Adicionar um portal novo

1. Crie `adapters/<portal>.js` implementando `sweep`.
2. Para portais `browser`, use `newPage()` de `lib/browser.js` e ajuste os seletores
   olhando o DOM real (DevTools) — o `adapters/bec-sp.js` é o template comentado.
3. Registre o módulo em `runner.js` (`ADAPTERS`).
4. Valide com `node runner.js --only <key> --dry`.

## Deploy (Swarm)

Imagem própria (`Dockerfile`, base Playwright). Suba como serviço separado do stack,
com as mesmas envs de banco do backend. Mantenha **1 réplica** por portal (ou
particione adapters entre réplicas) — browsers paralelos no mesmo portal multiplicam
carga e risco de bloqueio.

## Conformidade

Respeite `robots.txt` e os Termos de Uso de cada portal. Portais comerciais (BLL,
Licitanet, Petronect…) exigem **credencial contratada** e/ou proíbem scraping — use
a API/exportação oficial deles, não burle login/CAPTCHA.
