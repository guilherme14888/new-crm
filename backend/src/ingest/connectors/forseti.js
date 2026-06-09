// Forseti — agregador. Config (API Externa): username / password.
const { makePending } = require('./_pending');
module.exports = makePending({ name: 'FORSETI', key: 'forseti', note: 'Definir mecanismo de busca (API ou scraping autenticado).' });
