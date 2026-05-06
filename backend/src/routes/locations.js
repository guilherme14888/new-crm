/**
 * Brazilian-cities lookup, proxied (and cached) from the IBGE public API.
 * Frontend uses this to power the searchable Localidade field in Empresas.
 *
 * On startup we kick off a fetch in the background and cache the result for
 * 24h. If IBGE is unreachable we fall back to a curated list of major
 * cities so the autocomplete still produces sensible suggestions.
 */
const router = require('express').Router();
const auth   = require('../middleware/auth');

const FALLBACK_CITIES = [
  // 27 capitais
  { name: 'Aracaju', uf: 'SE' }, { name: 'Belém', uf: 'PA' }, { name: 'Belo Horizonte', uf: 'MG' },
  { name: 'Boa Vista', uf: 'RR' }, { name: 'Brasília', uf: 'DF' }, { name: 'Campo Grande', uf: 'MS' },
  { name: 'Cuiabá', uf: 'MT' }, { name: 'Curitiba', uf: 'PR' }, { name: 'Florianópolis', uf: 'SC' },
  { name: 'Fortaleza', uf: 'CE' }, { name: 'Goiânia', uf: 'GO' }, { name: 'João Pessoa', uf: 'PB' },
  { name: 'Macapá', uf: 'AP' }, { name: 'Maceió', uf: 'AL' }, { name: 'Manaus', uf: 'AM' },
  { name: 'Natal', uf: 'RN' }, { name: 'Palmas', uf: 'TO' }, { name: 'Porto Alegre', uf: 'RS' },
  { name: 'Porto Velho', uf: 'RO' }, { name: 'Recife', uf: 'PE' }, { name: 'Rio Branco', uf: 'AC' },
  { name: 'Rio de Janeiro', uf: 'RJ' }, { name: 'Salvador', uf: 'BA' }, { name: 'São Luís', uf: 'MA' },
  { name: 'São Paulo', uf: 'SP' }, { name: 'Teresina', uf: 'PI' }, { name: 'Vitória', uf: 'ES' },
  // Grandes cidades fora das capitais
  { name: 'Guarulhos', uf: 'SP' }, { name: 'Campinas', uf: 'SP' }, { name: 'São Bernardo do Campo', uf: 'SP' },
  { name: 'Santo André', uf: 'SP' }, { name: 'Osasco', uf: 'SP' }, { name: 'Ribeirão Preto', uf: 'SP' },
  { name: 'Sorocaba', uf: 'SP' }, { name: 'São José dos Campos', uf: 'SP' }, { name: 'Santos', uf: 'SP' },
  { name: 'Mauá', uf: 'SP' }, { name: 'Diadema', uf: 'SP' }, { name: 'Jundiaí', uf: 'SP' },
  { name: 'Piracicaba', uf: 'SP' }, { name: 'Bauru', uf: 'SP' }, { name: 'Carapicuíba', uf: 'SP' },
  { name: 'São Vicente', uf: 'SP' }, { name: 'Itaquaquecetuba', uf: 'SP' },
  { name: 'Nova Iguaçu', uf: 'RJ' }, { name: 'Niterói', uf: 'RJ' }, { name: 'Duque de Caxias', uf: 'RJ' },
  { name: 'São Gonçalo', uf: 'RJ' }, { name: 'Belford Roxo', uf: 'RJ' }, { name: 'Campos dos Goytacazes', uf: 'RJ' },
  { name: 'Petrópolis', uf: 'RJ' }, { name: 'Volta Redonda', uf: 'RJ' },
  { name: 'Contagem', uf: 'MG' }, { name: 'Uberlândia', uf: 'MG' }, { name: 'Juiz de Fora', uf: 'MG' },
  { name: 'Betim', uf: 'MG' }, { name: 'Montes Claros', uf: 'MG' }, { name: 'Ribeirão das Neves', uf: 'MG' },
  { name: 'Uberaba', uf: 'MG' }, { name: 'Governador Valadares', uf: 'MG' }, { name: 'Ipatinga', uf: 'MG' },
  { name: 'Sete Lagoas', uf: 'MG' }, { name: 'Divinópolis', uf: 'MG' },
  { name: 'Feira de Santana', uf: 'BA' }, { name: 'Vitória da Conquista', uf: 'BA' }, { name: 'Camaçari', uf: 'BA' },
  { name: 'Itabuna', uf: 'BA' }, { name: 'Juazeiro', uf: 'BA' }, { name: 'Lauro de Freitas', uf: 'BA' },
  { name: 'Caucaia', uf: 'CE' }, { name: 'Juazeiro do Norte', uf: 'CE' }, { name: 'Maracanaú', uf: 'CE' },
  { name: 'Sobral', uf: 'CE' },
  { name: 'Jaboatão dos Guararapes', uf: 'PE' }, { name: 'Olinda', uf: 'PE' }, { name: 'Caruaru', uf: 'PE' },
  { name: 'Petrolina', uf: 'PE' }, { name: 'Paulista', uf: 'PE' },
  { name: 'Caxias do Sul', uf: 'RS' }, { name: 'Pelotas', uf: 'RS' }, { name: 'Canoas', uf: 'RS' },
  { name: 'Santa Maria', uf: 'RS' }, { name: 'Gravataí', uf: 'RS' }, { name: 'Viamão', uf: 'RS' },
  { name: 'Novo Hamburgo', uf: 'RS' },
  { name: 'Londrina', uf: 'PR' }, { name: 'Maringá', uf: 'PR' }, { name: 'Ponta Grossa', uf: 'PR' },
  { name: 'Cascavel', uf: 'PR' }, { name: 'Foz do Iguaçu', uf: 'PR' }, { name: 'São José dos Pinhais', uf: 'PR' },
  { name: 'Joinville', uf: 'SC' }, { name: 'Blumenau', uf: 'SC' }, { name: 'São José', uf: 'SC' },
  { name: 'Chapecó', uf: 'SC' }, { name: 'Itajaí', uf: 'SC' }, { name: 'Criciúma', uf: 'SC' },
  { name: 'Aparecida de Goiânia', uf: 'GO' }, { name: 'Anápolis', uf: 'GO' }, { name: 'Rio Verde', uf: 'GO' },
  { name: 'Várzea Grande', uf: 'MT' }, { name: 'Rondonópolis', uf: 'MT' }, { name: 'Sinop', uf: 'MT' },
  { name: 'Dourados', uf: 'MS' }, { name: 'Três Lagoas', uf: 'MS' },
  { name: 'Vila Velha', uf: 'ES' }, { name: 'Serra', uf: 'ES' }, { name: 'Cariacica', uf: 'ES' },
  { name: 'Ananindeua', uf: 'PA' }, { name: 'Santarém', uf: 'PA' }, { name: 'Marabá', uf: 'PA' },
];

let citiesCache = null;
let lastFetch   = 0;
let inFlight    = null;
const TTL_MS    = 24 * 60 * 60 * 1000; // 24h

async function fetchCitiesFromIBGE() {
  const url = 'https://servicos.ibge.gov.br/api/v1/localidades/municipios';
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`IBGE HTTP ${res.status}`);
    const raw = await res.json();
    const list = raw.map((r) => ({
      name: r.nome,
      uf:   r?.microrregiao?.mesorregiao?.UF?.sigla
         ?? r?.regiao_imediata?.regiao_intermediaria?.UF?.sigla
         ?? '',
    })).filter((c) => c.uf);
    return list;
  } finally { if (t) clearTimeout(t); }
}

async function ensureCities() {
  const now = Date.now();
  if (citiesCache && (now - lastFetch) <= TTL_MS) return citiesCache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const list = await fetchCitiesFromIBGE();
      citiesCache = list;
      lastFetch   = Date.now();
      return list;
    } catch (e) {
      console.error('[locations] IBGE fetch failed, falling back to static list:', e?.message ?? e);
      citiesCache = citiesCache ?? FALLBACK_CITIES;
      lastFetch   = Date.now() - (TTL_MS - 5 * 60 * 1000); // retry sooner — in 5min
      return citiesCache;
    } finally { inFlight = null; }
  })();
  return inFlight;
}

// Pre-warm at module load so the first user doesn't pay the IBGE round-trip
ensureCities().catch(() => {});

router.get('/cities', auth, async (_req, res) => {
  const list = await ensureCities();
  res.json(list);
});

module.exports = router;
