// Documentos da licitação (edital/ata) do PNCP, trazidos para DENTRO do CRM:
// baixa do PNCP, extrai o PDF se vier .zip, cacheia em market_intelligence_docs
// (LONGBLOB) e devolve os bytes para o leitor de PDF embutido.

const AdmZip = require('adm-zip');
const db = require('./db');
const { request, getJson } = require('./ingest/http');

const BASE = 'https://pncp.gov.br';
const API = `${BASE}/api/pncp/v1`;
const MAX_CACHE = 12 * 1024 * 1024;   // 12MB (max_allowed_packet = 16MB)

let seq = 0;
const docId = () => `doc-${Date.now().toString(36)}-${++seq}`;

/** Extrai cnpj/ano/seq da url_site (.../app/editais/{cnpj}/{ano}/{seq}). */
function parseControle(urlSite) {
  const m = String(urlSite || '').match(/editais\/(\d+)\/(\d+)\/(\d+)/);
  return m ? { cnpj: m[1], ano: m[2], seq: m[3] } : null;
}

/** Disponibilidade barata (sem baixar): há edital? há ata? (consulta metadados PNCP). */
async function availability(cnpj, ano, seq) {
  const out = { edital: false, ata: false };
  try { const a = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`); out.edital = Array.isArray(a) && a.length > 0; } catch { /* ignora */ }
  try { const t = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/atas`);     out.ata    = Array.isArray(t) && t.length > 0; } catch { /* ignora */ }
  return out;
}

/** Resolve a URL do documento (edital ou ata) no PNCP. */
async function resolveDocUrl(tipo, cnpj, ano, seq) {
  if (tipo === 'edital') {
    const arq = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`);
    if (!Array.isArray(arq) || !arq.length) return null;
    const pick = arq.find((a) => /edital/i.test(a.tipoDocumentoNome || '')) || arq[0];
    return { url: pick.url || pick.uri, label: pick.titulo || 'edital' };
  }
  // ata
  const atas = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/atas`);
  if (!Array.isArray(atas) || !atas.length) return null;
  const ata = atas[0];
  // documento direto na ata, se houver
  if (ata.url || ata.uri) return { url: ata.url || ata.uri, label: ata.titulo || 'ata' };
  // senão, arquivos da ata
  const seqAta = ata.sequencialAta ?? ata.sequencial ?? 1;
  try {
    const aarq = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/atas/${seqAta}/arquivos`);
    if (Array.isArray(aarq) && aarq.length) {
      const d = aarq[0];
      return { url: d.url || d.uri, label: d.titulo || 'ata' };
    }
  } catch { /* ignora */ }
  return null;
}

/** Lê do cache (se houver). */
async function getCached(companyId, pncpControle, tipo) {
  const [rows] = await db.query(
    'SELECT filename, mime, viewable, conteudo FROM market_intelligence_docs WHERE company_id <=> ? AND pncp_controle = ? AND tipo = ? LIMIT 1',
    [companyId ?? null, pncpControle, tipo]
  );
  return rows[0] || null;
}

/**
 * Baixa do PNCP, extrai o maior PDF se vier zip, cacheia e devolve
 * { buf, filename, mime, viewable }. Retorna null se não houver documento.
 */
async function fetchDoc(companyId, pncpControle, tipo, ctrl) {
  const ref = await resolveDocUrl(tipo, ctrl.cnpj, ctrl.ano, ctrl.seq);
  if (!ref || !ref.url) return null;

  const res = await request(ref.url, { headers: { Accept: '*/*' }, timeout: 60000 });
  if (!res.ok) return null;
  let buf = Buffer.from(await res.arrayBuffer());
  let filename = ref.label;

  // .zip → extrai o maior PDF interno (o edital costuma ser o principal)
  if (buf.slice(0, 4).toString('hex') === '504b0304') {
    try {
      const pdfs = new AdmZip(buf).getEntries()
        .filter((e) => !e.isDirectory && /\.pdf$/i.test(e.entryName))
        .sort((a, b) => b.header.size - a.header.size);
      if (pdfs.length) { buf = pdfs[0].getData(); filename = pdfs[0].entryName.split('/').pop(); }
    } catch { /* zip inválido → mantém original */ }
  }

  const isPdf = buf.slice(0, 5).toString('latin1') === '%PDF-';
  const mime = isPdf ? 'application/pdf' : 'application/octet-stream';
  const viewable = isPdf ? 1 : 0;
  if (!/\.[a-z0-9]{2,4}$/i.test(filename)) filename += isPdf ? '.pdf' : '.bin';

  if (buf.length <= MAX_CACHE) {
    try {
      await db.query(
        `INSERT INTO market_intelligence_docs
           (id, company_id, pncp_controle, tipo, filename, mime, viewable, size_bytes, source_url, conteudo, fetched_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE filename=VALUES(filename), mime=VALUES(mime), viewable=VALUES(viewable),
           size_bytes=VALUES(size_bytes), source_url=VALUES(source_url), conteudo=VALUES(conteudo), fetched_at=NOW()`,
        [docId(), companyId ?? null, pncpControle, tipo, filename, mime, viewable, buf.length, ref.url, buf]
      );
    } catch { /* cache é complementar; segue servindo mesmo se falhar */ }
  }
  return { buf, filename, mime, viewable: !!viewable };
}

module.exports = { parseControle, availability, getCached, fetchDoc };
