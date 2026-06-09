// ComprasBR — agregador. Config (API Externa): username / password.
const { makePending } = require('./_pending');
module.exports = makePending({ name: 'COMPRASBR', key: 'comprasbr', note: 'Definir mecanismo de busca (API ou scraping autenticado).' });
