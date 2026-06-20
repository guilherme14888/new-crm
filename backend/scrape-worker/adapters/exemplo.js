// Adapter de EXEMPLO (sem navegador) — serve para validar o framework fim-a-fim
// (runner → normalização → upsert/dedup) sem depender de um portal real.
//
// Interface de TODO adapter (igual aos connectors/ do backend):
//   { key, name, kind: 'browser' | 'http', async sweep(keywords, opts) }
//   → devolve [{ kw, records }]  (records no shape normalizado do pipeline)

async function sweep(keywords, opts = {}) {
  const out = [];
  for (const kw of keywords.slice(0, 1)) { // só 1, é demonstração
    out.push({
      kw,
      records: [{
        fonte: 'EXEMPLO',
        termoBusca: kw.termo,
        produto: kw.termo,
        produtoCandidato: kw.produtoCandidato ?? null,
        licitador: 'Órgão de Exemplo',
        uf: 'SP', regiao: 'Sudeste',
        nProcesso: `EXEMPLO-${kw.termo}`,
        processoKey: `EXEMPLO-${kw.termo}`,
        externalKey: `EXEMPLO-${kw.termo}`,
        produtoLicitado: `Aquisição de ${kw.termo} (registro de exemplo)`,
        lote: 1, item: 1,
        encerramento: 'Recebendo propostas',
        nomeSite: 'Exemplo', urlSite: 'https://example.com',
      }],
    });
  }
  return out;
}

module.exports = { key: 'exemplo', name: 'Exemplo (mock)', kind: 'http', sweep };
