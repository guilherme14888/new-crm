// Documentos da licitação (edital/ata) do PNCP, trazidos para DENTRO do CRM:
// baixa do PNCP, extrai TODOS os PDFs (inclusive de zips aninhados, ex.: ComprasGov),
// cacheia cada PDF em market_intelligence_docs (LONGBLOB) e serve para o leitor embutido.

const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const db = require('./db');
const { request, getJson } = require('./ingest/http');

/**
 * Decodifica o nome de uma entrada de zip respeitando a codificação:
 *  - bit 0x800 do flag ligado → UTF-8;
 *  - senão, acentos vêm em CP850 (codepage OEM dos zips Windows no Brasil, ex.:
 *    0xC7 = "Ã"). latin1/utf8 produziriam "Ç"/"�".
 */
function decodeEntryName(entry) {
  const raw = entry.rawEntryName;
  if (!Buffer.isBuffer(raw) || !raw.length) return entry.entryName || '';
  if (entry.header && (entry.header.flags & 0x800)) return raw.toString('utf8');
  if (raw.every((b) => b < 0x80)) return raw.toString('latin1');   // ASCII puro
  return iconv.decode(raw, 'cp850');
}

const BASE = 'https://pncp.gov.br';
const API = `${BASE}/api/pncp/v1`;
const MAX_CACHE = 12 * 1024 * 1024;   // 12MB (max_allowed_packet = 16MB)
const ZIP_SIG = '504b0304';
const isPdfBuf = (b) => b.slice(0, 5).toString('latin1') === '%PDF-';
const isZipBuf = (b) => b.slice(0, 4).toString('hex') === ZIP_SIG;

let seq = 0;
const docId = () => `doc-${Date.now().toString(36)}-${++seq}`;

// Tipo "Ata de Registro de Preço" (regex preciso p/ NÃO casar "Contr-ATA-ção").
const isAtaTipo = (t) => /ata de registro|^\s*ata\b/i.test(String(t || ''));
const isEditalTipo = (t) => /edital|aviso/i.test(String(t || ''));

/** Extrai cnpj/ano/seq da url_site (.../app/editais/{cnpj}/{ano}/{seq}). */
function parseControle(urlSite) {
  const m = String(urlSite || '').match(/editais\/(\d+)\/(\d+)\/(\d+)/);
  return m ? { cnpj: m[1], ano: m[2], seq: m[3] } : null;
}

/** Extrai recursivamente todos os PDFs de um buffer (zip, zip aninhado ou PDF puro). */
function extractPdfs(buf, baseName, depth = 0) {
  const out = [];
  if (isZipBuf(buf) && depth < 4) {
    try {
      for (const e of new AdmZip(buf).getEntries()) {
        if (e.isDirectory) continue;
        const data = e.getData();
        const name = decodeEntryName(e).split(/[/\\]/).pop();
        if (/\.pdf$/i.test(name) && isPdfBuf(data)) out.push({ name, data });
        else if (isZipBuf(data)) out.push(...extractPdfs(data, name, depth + 1));
      }
    } catch { /* zip inválido */ }
  } else if (isPdfBuf(buf)) {
    const nm = /\.pdf$/i.test(baseName || '') ? baseName : `${baseName || 'documento'}.pdf`;
    out.push({ name: nm, data: buf });
  }
  return out;
}

/** Disponibilidade barata: há edital? há ata? (uma chamada a /arquivos + fallback /atas). */
async function availability(cnpj, ano, seq) {
  const out = { edital: false, ata: false };
  try {
    const arq = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`);
    if (Array.isArray(arq) && arq.length) {
      out.edital = true;
      out.ata = arq.some((a) => isAtaTipo(a.tipoDocumentoNome));
    }
  } catch { /* ignora */ }
  if (!out.ata) {
    try { const t = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/atas`); out.ata = Array.isArray(t) && t.length > 0; } catch { /* ignora */ }
  }
  return out;
}

/** Resolve a URL do documento (edital ou ata) no PNCP. */
async function resolveDocUrl(tipo, cnpj, ano, seq) {
  const arq = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`);
  const list = Array.isArray(arq) ? arq : [];
  if (tipo === 'edital') {
    const pick = list.find((a) => isEditalTipo(a.tipoDocumentoNome) && !isAtaTipo(a.tipoDocumentoNome))
      || list.find((a) => !isAtaTipo(a.tipoDocumentoNome)) || list[0];
    return pick ? { url: pick.url || pick.uri, label: pick.titulo || 'edital' } : null;
  }
  const ataDoc = list.find((a) => isAtaTipo(a.tipoDocumentoNome));
  if (ataDoc) return { url: ataDoc.url || ataDoc.uri, label: ataDoc.titulo || 'ata' };
  // fallback: recurso /atas
  try {
    const atas = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/atas`);
    if (Array.isArray(atas) && atas.length) {
      const ata = atas[0];
      if (ata.url || ata.uri) return { url: ata.url || ata.uri, label: ata.titulo || 'ata' };
      const seqAta = ata.sequencialAta ?? ata.sequencial ?? 1;
      const aarq = await getJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/atas/${seqAta}/arquivos`);
      if (Array.isArray(aarq) && aarq.length) { const d = aarq[0]; return { url: d.url || d.uri, label: d.titulo || 'ata' }; }
    }
  } catch { /* ignora */ }
  return null;
}

/** Linhas em cache de um documento (tipo) de uma licitação. */
async function cachedRows(companyId, pncpControle, tipo) {
  const [rows] = await db.query(
    'SELECT idx, filename, mime, viewable, size_bytes FROM market_intelligence_docs WHERE company_id <=> ? AND pncp_controle = ? AND tipo = ? ORDER BY idx',
    [companyId ?? null, pncpControle, tipo]
  );
  return rows;
}

/**
 * Lista os arquivos (PDFs) do documento — do cache ou baixando+extraindo do PNCP.
 * Retorna [{ idx, name, size, mime, viewable }].
 */
async function listFiles(companyId, pncpControle, tipo, ctrl) {
  const cached = await cachedRows(companyId, pncpControle, tipo);
  if (cached.length) return cached.map((c) => ({ idx: c.idx, name: c.filename, size: c.size_bytes, mime: c.mime, viewable: !!c.viewable }));

  const ref = await resolveDocUrl(tipo, ctrl.cnpj, ctrl.ano, ctrl.seq);
  if (!ref || !ref.url) return [];
  const res = await request(ref.url, { headers: { Accept: '*/*' }, timeout: 60000 });
  if (!res.ok) return [];
  const buf = Buffer.from(await res.arrayBuffer());

  let files = extractPdfs(buf, ref.label);
  let pdf = true;
  if (!files.length) { // sem PDF → guarda o arquivo bruto (zip/doc) como download
    pdf = false;
    let nm = ref.label || 'documento';
    if (!/\.[a-z0-9]{2,4}$/i.test(nm)) nm += isZipBuf(buf) ? '.zip' : '.bin';
    files = [{ name: nm, data: buf }];
  }

  const result = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const viewable = pdf && isPdfBuf(f.data) ? 1 : 0;
    const mime = viewable ? 'application/pdf' : 'application/octet-stream';
    if (f.data.length <= MAX_CACHE) {
      try {
        await db.query(
          `INSERT INTO market_intelligence_docs
             (id, company_id, pncp_controle, tipo, idx, filename, mime, viewable, size_bytes, source_url, conteudo, fetched_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())
           ON DUPLICATE KEY UPDATE filename=VALUES(filename), mime=VALUES(mime), viewable=VALUES(viewable),
             size_bytes=VALUES(size_bytes), source_url=VALUES(source_url), conteudo=VALUES(conteudo), fetched_at=NOW()`,
          [docId(), companyId ?? null, pncpControle, tipo, i, f.name, mime, viewable, f.data.length, ref.url, f.data]
        );
      } catch { /* cache complementar */ }
    }
    result.push({ idx: i, name: f.name, size: f.data.length, mime, viewable: !!viewable });
  }
  return result;
}

/** Bytes de um arquivo específico (idx) — do cache (baixa+extrai se ainda não houver). */
async function getFile(companyId, pncpControle, tipo, idx, ctrl) {
  const sel = async () => {
    const [rows] = await db.query(
      'SELECT filename, mime, viewable, conteudo FROM market_intelligence_docs WHERE company_id <=> ? AND pncp_controle = ? AND tipo = ? AND idx = ? LIMIT 1',
      [companyId ?? null, pncpControle, tipo, idx]
    );
    return rows[0] || null;
  };
  let r = await sel();
  if (!r) { await listFiles(companyId, pncpControle, tipo, ctrl); r = await sel(); }
  if (!r || !r.conteudo) return null;
  return { buf: r.conteudo, filename: r.filename, mime: r.mime, viewable: !!r.viewable };
}

module.exports = { parseControle, availability, listFiles, getFile };
