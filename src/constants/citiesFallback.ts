/**
 * Lista de fallback com as principais cidades brasileiras.
 * Usada quando IBGE e o proxy do backend falham (ex: rede sem internet).
 * Inclui 27 capitais + maiores cidades não-capitais por região.
 */
export const FALLBACK_CITIES_BR: { name: string; uf: string }[] = [
  // ─── Capitais (27)
  { name: 'Aracaju', uf: 'SE' }, { name: 'Belém', uf: 'PA' }, { name: 'Belo Horizonte', uf: 'MG' },
  { name: 'Boa Vista', uf: 'RR' }, { name: 'Brasília', uf: 'DF' }, { name: 'Campo Grande', uf: 'MS' },
  { name: 'Cuiabá', uf: 'MT' }, { name: 'Curitiba', uf: 'PR' }, { name: 'Florianópolis', uf: 'SC' },
  { name: 'Fortaleza', uf: 'CE' }, { name: 'Goiânia', uf: 'GO' }, { name: 'João Pessoa', uf: 'PB' },
  { name: 'Macapá', uf: 'AP' }, { name: 'Maceió', uf: 'AL' }, { name: 'Manaus', uf: 'AM' },
  { name: 'Natal', uf: 'RN' }, { name: 'Palmas', uf: 'TO' }, { name: 'Porto Alegre', uf: 'RS' },
  { name: 'Porto Velho', uf: 'RO' }, { name: 'Recife', uf: 'PE' }, { name: 'Rio Branco', uf: 'AC' },
  { name: 'Rio de Janeiro', uf: 'RJ' }, { name: 'Salvador', uf: 'BA' }, { name: 'São Luís', uf: 'MA' },
  { name: 'São Paulo', uf: 'SP' }, { name: 'Teresina', uf: 'PI' }, { name: 'Vitória', uf: 'ES' },

  // ─── SP — Grande SP e interior
  { name: 'Guarulhos', uf: 'SP' }, { name: 'Campinas', uf: 'SP' }, { name: 'São Bernardo do Campo', uf: 'SP' },
  { name: 'Santo André', uf: 'SP' }, { name: 'Osasco', uf: 'SP' }, { name: 'Ribeirão Preto', uf: 'SP' },
  { name: 'Sorocaba', uf: 'SP' }, { name: 'São José dos Campos', uf: 'SP' }, { name: 'Santos', uf: 'SP' },
  { name: 'Mauá', uf: 'SP' }, { name: 'Diadema', uf: 'SP' }, { name: 'Jundiaí', uf: 'SP' },
  { name: 'Piracicaba', uf: 'SP' }, { name: 'Bauru', uf: 'SP' }, { name: 'Carapicuíba', uf: 'SP' },
  { name: 'São Vicente', uf: 'SP' }, { name: 'Itaquaquecetuba', uf: 'SP' }, { name: 'Taubaté', uf: 'SP' },
  { name: 'Limeira', uf: 'SP' }, { name: 'Praia Grande', uf: 'SP' }, { name: 'Suzano', uf: 'SP' },
  { name: 'Taboão da Serra', uf: 'SP' }, { name: 'Sumaré', uf: 'SP' }, { name: 'Barueri', uf: 'SP' },
  { name: 'Embu das Artes', uf: 'SP' }, { name: 'São José do Rio Preto', uf: 'SP' }, { name: 'Mogi das Cruzes', uf: 'SP' },
  { name: 'Cotia', uf: 'SP' }, { name: 'Indaiatuba', uf: 'SP' }, { name: 'Marília', uf: 'SP' },
  { name: 'Americana', uf: 'SP' }, { name: 'Itu', uf: 'SP' }, { name: 'Araraquara', uf: 'SP' },
  { name: 'Hortolândia', uf: 'SP' }, { name: 'Presidente Prudente', uf: 'SP' }, { name: 'Itapevi', uf: 'SP' },
  { name: 'São Carlos', uf: 'SP' }, { name: 'Rio Claro', uf: 'SP' }, { name: 'Cubatão', uf: 'SP' },

  // ─── RJ
  { name: 'Nova Iguaçu', uf: 'RJ' }, { name: 'Niterói', uf: 'RJ' }, { name: 'Duque de Caxias', uf: 'RJ' },
  { name: 'São Gonçalo', uf: 'RJ' }, { name: 'Belford Roxo', uf: 'RJ' }, { name: 'Campos dos Goytacazes', uf: 'RJ' },
  { name: 'Petrópolis', uf: 'RJ' }, { name: 'Volta Redonda', uf: 'RJ' }, { name: 'Magé', uf: 'RJ' },
  { name: 'Itaboraí', uf: 'RJ' }, { name: 'Macaé', uf: 'RJ' }, { name: 'Cabo Frio', uf: 'RJ' },
  { name: 'Nova Friburgo', uf: 'RJ' }, { name: 'Barra Mansa', uf: 'RJ' }, { name: 'Angra dos Reis', uf: 'RJ' },
  { name: 'Teresópolis', uf: 'RJ' }, { name: 'Resende', uf: 'RJ' }, { name: 'Mesquita', uf: 'RJ' },

  // ─── MG
  { name: 'Contagem', uf: 'MG' }, { name: 'Uberlândia', uf: 'MG' }, { name: 'Juiz de Fora', uf: 'MG' },
  { name: 'Betim', uf: 'MG' }, { name: 'Montes Claros', uf: 'MG' }, { name: 'Ribeirão das Neves', uf: 'MG' },
  { name: 'Uberaba', uf: 'MG' }, { name: 'Governador Valadares', uf: 'MG' }, { name: 'Ipatinga', uf: 'MG' },
  { name: 'Sete Lagoas', uf: 'MG' }, { name: 'Divinópolis', uf: 'MG' }, { name: 'Santa Luzia', uf: 'MG' },
  { name: 'Ibirité', uf: 'MG' }, { name: 'Poços de Caldas', uf: 'MG' }, { name: 'Patos de Minas', uf: 'MG' },
  { name: 'Pouso Alegre', uf: 'MG' }, { name: 'Teófilo Otoni', uf: 'MG' }, { name: 'Barbacena', uf: 'MG' },
  { name: 'Sabará', uf: 'MG' }, { name: 'Varginha', uf: 'MG' }, { name: 'Conselheiro Lafaiete', uf: 'MG' },

  // ─── BA
  { name: 'Feira de Santana', uf: 'BA' }, { name: 'Vitória da Conquista', uf: 'BA' }, { name: 'Camaçari', uf: 'BA' },
  { name: 'Itabuna', uf: 'BA' }, { name: 'Juazeiro', uf: 'BA' }, { name: 'Lauro de Freitas', uf: 'BA' },
  { name: 'Ilhéus', uf: 'BA' }, { name: 'Jequié', uf: 'BA' }, { name: 'Teixeira de Freitas', uf: 'BA' },
  { name: 'Barreiras', uf: 'BA' }, { name: 'Alagoinhas', uf: 'BA' }, { name: 'Porto Seguro', uf: 'BA' },

  // ─── CE
  { name: 'Caucaia', uf: 'CE' }, { name: 'Juazeiro do Norte', uf: 'CE' }, { name: 'Maracanaú', uf: 'CE' },
  { name: 'Sobral', uf: 'CE' }, { name: 'Crato', uf: 'CE' }, { name: 'Itapipoca', uf: 'CE' },
  { name: 'Maranguape', uf: 'CE' },

  // ─── PE
  { name: 'Jaboatão dos Guararapes', uf: 'PE' }, { name: 'Olinda', uf: 'PE' }, { name: 'Caruaru', uf: 'PE' },
  { name: 'Petrolina', uf: 'PE' }, { name: 'Paulista', uf: 'PE' }, { name: 'Cabo de Santo Agostinho', uf: 'PE' },
  { name: 'Camaragibe', uf: 'PE' }, { name: 'Garanhuns', uf: 'PE' }, { name: 'Vitória de Santo Antão', uf: 'PE' },

  // ─── RS
  { name: 'Caxias do Sul', uf: 'RS' }, { name: 'Pelotas', uf: 'RS' }, { name: 'Canoas', uf: 'RS' },
  { name: 'Santa Maria', uf: 'RS' }, { name: 'Gravataí', uf: 'RS' }, { name: 'Viamão', uf: 'RS' },
  { name: 'Novo Hamburgo', uf: 'RS' }, { name: 'São Leopoldo', uf: 'RS' }, { name: 'Rio Grande', uf: 'RS' },
  { name: 'Alvorada', uf: 'RS' }, { name: 'Passo Fundo', uf: 'RS' }, { name: 'Sapucaia do Sul', uf: 'RS' },
  { name: 'Bagé', uf: 'RS' }, { name: 'Bento Gonçalves', uf: 'RS' }, { name: 'Erechim', uf: 'RS' },
  { name: 'Uruguaiana', uf: 'RS' }, { name: 'Santa Cruz do Sul', uf: 'RS' },

  // ─── PR
  { name: 'Londrina', uf: 'PR' }, { name: 'Maringá', uf: 'PR' }, { name: 'Ponta Grossa', uf: 'PR' },
  { name: 'Cascavel', uf: 'PR' }, { name: 'Foz do Iguaçu', uf: 'PR' }, { name: 'São José dos Pinhais', uf: 'PR' },
  { name: 'Colombo', uf: 'PR' }, { name: 'Guarapuava', uf: 'PR' }, { name: 'Paranaguá', uf: 'PR' },
  { name: 'Araucária', uf: 'PR' }, { name: 'Toledo', uf: 'PR' }, { name: 'Apucarana', uf: 'PR' },
  { name: 'Pinhais', uf: 'PR' }, { name: 'Campo Largo', uf: 'PR' }, { name: 'Arapongas', uf: 'PR' },

  // ─── SC
  { name: 'Joinville', uf: 'SC' }, { name: 'Blumenau', uf: 'SC' }, { name: 'São José', uf: 'SC' },
  { name: 'Chapecó', uf: 'SC' }, { name: 'Itajaí', uf: 'SC' }, { name: 'Criciúma', uf: 'SC' },
  { name: 'Jaraguá do Sul', uf: 'SC' }, { name: 'Lages', uf: 'SC' }, { name: 'Palhoça', uf: 'SC' },
  { name: 'Balneário Camboriú', uf: 'SC' }, { name: 'Brusque', uf: 'SC' }, { name: 'Tubarão', uf: 'SC' },

  // ─── GO
  { name: 'Aparecida de Goiânia', uf: 'GO' }, { name: 'Anápolis', uf: 'GO' }, { name: 'Rio Verde', uf: 'GO' },
  { name: 'Luziânia', uf: 'GO' }, { name: 'Águas Lindas de Goiás', uf: 'GO' }, { name: 'Valparaíso de Goiás', uf: 'GO' },
  { name: 'Trindade', uf: 'GO' }, { name: 'Formosa', uf: 'GO' }, { name: 'Itumbiara', uf: 'GO' },
  { name: 'Senador Canedo', uf: 'GO' }, { name: 'Catalão', uf: 'GO' },

  // ─── MT / MS
  { name: 'Várzea Grande', uf: 'MT' }, { name: 'Rondonópolis', uf: 'MT' }, { name: 'Sinop', uf: 'MT' },
  { name: 'Tangará da Serra', uf: 'MT' }, { name: 'Cáceres', uf: 'MT' },
  { name: 'Dourados', uf: 'MS' }, { name: 'Três Lagoas', uf: 'MS' }, { name: 'Corumbá', uf: 'MS' },
  { name: 'Ponta Porã', uf: 'MS' }, { name: 'Naviraí', uf: 'MS' },

  // ─── ES
  { name: 'Vila Velha', uf: 'ES' }, { name: 'Serra', uf: 'ES' }, { name: 'Cariacica', uf: 'ES' },
  { name: 'Cachoeiro de Itapemirim', uf: 'ES' }, { name: 'Linhares', uf: 'ES' }, { name: 'São Mateus', uf: 'ES' },
  { name: 'Colatina', uf: 'ES' }, { name: 'Guarapari', uf: 'ES' },

  // ─── PA / Norte
  { name: 'Ananindeua', uf: 'PA' }, { name: 'Santarém', uf: 'PA' }, { name: 'Marabá', uf: 'PA' },
  { name: 'Castanhal', uf: 'PA' }, { name: 'Parauapebas', uf: 'PA' }, { name: 'Abaetetuba', uf: 'PA' },
  { name: 'Cametá', uf: 'PA' },
  { name: 'Parintins', uf: 'AM' }, { name: 'Itacoatiara', uf: 'AM' }, { name: 'Manacapuru', uf: 'AM' },
  { name: 'Ji-Paraná', uf: 'RO' }, { name: 'Ariquemes', uf: 'RO' }, { name: 'Cacoal', uf: 'RO' },
  { name: 'Vilhena', uf: 'RO' },
  { name: 'Cruzeiro do Sul', uf: 'AC' },
  { name: 'Santana', uf: 'AP' },
  { name: 'Araguaína', uf: 'TO' }, { name: 'Gurupi', uf: 'TO' }, { name: 'Porto Nacional', uf: 'TO' },

  // ─── PB / RN / AL / SE / PI / MA
  { name: 'Campina Grande', uf: 'PB' }, { name: 'Santa Rita', uf: 'PB' }, { name: 'Patos', uf: 'PB' },
  { name: 'Bayeux', uf: 'PB' }, { name: 'Sousa', uf: 'PB' },
  { name: 'Mossoró', uf: 'RN' }, { name: 'Parnamirim', uf: 'RN' }, { name: 'São Gonçalo do Amarante', uf: 'RN' },
  { name: 'Macaíba', uf: 'RN' }, { name: 'Ceará-Mirim', uf: 'RN' },
  { name: 'Arapiraca', uf: 'AL' }, { name: 'Palmeira dos Índios', uf: 'AL' }, { name: 'Rio Largo', uf: 'AL' },
  { name: 'União dos Palmares', uf: 'AL' },
  { name: 'Nossa Senhora do Socorro', uf: 'SE' }, { name: 'Lagarto', uf: 'SE' }, { name: 'Itabaiana', uf: 'SE' },
  { name: 'São Cristóvão', uf: 'SE' },
  { name: 'Parnaíba', uf: 'PI' }, { name: 'Picos', uf: 'PI' }, { name: 'Floriano', uf: 'PI' },
  { name: 'Imperatriz', uf: 'MA' }, { name: 'São José de Ribamar', uf: 'MA' }, { name: 'Timon', uf: 'MA' },
  { name: 'Caxias', uf: 'MA' }, { name: 'Codó', uf: 'MA' }, { name: 'Paço do Lumiar', uf: 'MA' },
  { name: 'Açailândia', uf: 'MA' }, { name: 'Bacabal', uf: 'MA' },
];
