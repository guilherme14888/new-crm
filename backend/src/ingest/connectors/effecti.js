// Effecti (https://app.effecti.com.br) — portal autenticado.
// Config (API Externa): username / password. Implementar login → busca → mapeamento.
const { makePending } = require('./_pending');
module.exports = makePending({ name: 'EFFECTI', key: 'effecti', note: 'Agregador autenticado.' });
