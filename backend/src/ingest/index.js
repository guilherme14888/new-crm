// Registro central de conectores. Para adicionar um portal novo, basta criar o
// módulo em ./connectors e incluí-lo aqui — todos seguem a mesma interface:
//   { name, enabled, search(keyword, opts) → Promise<record[]> }

module.exports = {
  connectors: [
    require('./connectors/pncp'),
    require('./connectors/pncp-sweep'),
    require('./connectors/effecti'),
    require('./connectors/conlicitacao'),
    require('./connectors/licitaja'),
    require('./connectors/forseti'),
    require('./connectors/comprasbr'),
    require('./connectors/bll'),
  ],
};
