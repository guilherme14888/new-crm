// Conlicitação — portal autenticado (preferir token/API).
// Config (API Externa): token.
const { makePending } = require('./_pending');
module.exports = makePending({ name: 'CONLICITACAO', key: 'conlicitacao', note: 'Possui API por token para clientes.' });
