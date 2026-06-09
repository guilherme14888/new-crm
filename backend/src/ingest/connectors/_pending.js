// Fábrica de conector "pendente": mesma interface, mas sem a implementação de
// login/busca do portal. Fica `implemented: false` → o orquestrador o lista como
// pendente e não tenta executá-lo, mesmo que esteja habilitado na UI.

function makePending({ name, key, note = '' }) {
  return {
    name,
    key,
    implemented: false,
    note,
    async search() {
      throw new Error(`Conector ${name} ainda não implementado`);
    },
  };
}

module.exports = { makePending };
