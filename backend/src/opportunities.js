// Oportunidades (licitações abertas) → CRM: lista o "inbox" de abertas não
// convertidas e converte uma em deal (negociação) ao confirmar participação —
// cria/usa o contato do órgão, grava infos em campos personalizados e COPIA os
// documentos (edital/ata/anexos) para a aba Arquivos do deal.

const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const marketDocs = require('./marketDocs');

const MASTER = '00000000-0000-0000-0000-000000000001';
const fmtBRL = (n) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Inbox: licitações ABERTAS (recebendo propostas) e ainda NÃO convertidas, 1 por edital. */
async function listOpportunities(companyId) {
  const [rows] = await db.query(
    `SELECT mi.pncp_controle AS controle, MIN(mi.id) AS miId,
            MAX(mi.licitador) AS licitador, MAX(mi.uf) AS uf, MAX(mi.municipio) AS municipio,
            MAX(mi.modalidade) AS modalidade, MAX(mi.n_edital) AS nEdital, MAX(mi.n_processo) AS nProcesso,
            MAX(mi.data_hora_certame) AS dataHoraCertame, MAX(mi.prazo_edital) AS prazoEdital,
            MAX(mi.url_site) AS urlSite, MAX(mi.nome_site) AS nomeSite,
            GROUP_CONCAT(DISTINCT COALESCE(mi.produto_candidato, mi.produto) SEPARATOR ', ') AS produtos,
            SUM(mi.preco_estimado_total) AS valorEstimado, COUNT(*) AS itens
       FROM market_intelligence mi
      WHERE mi.company_id = ? AND mi.encerramento = 'Recebendo propostas' AND mi.pncp_controle IS NOT NULL
        AND mi.pncp_controle COLLATE utf8mb4_unicode_ci NOT IN (
          SELECT mi_controle FROM deals WHERE mi_controle IS NOT NULL AND deleted_at IS NULL AND company_id = ?
        )
      GROUP BY mi.pncp_controle
      ORDER BY MAX(mi.data_hora_certame) DESC
      LIMIT 500`,
    [companyId, companyId]
  );
  return rows.map((r) => ({
    controle: r.controle, miId: r.miId, licitador: r.licitador, uf: r.uf, municipio: r.municipio,
    modalidade: r.modalidade, nEdital: r.nEdital, nProcesso: r.nProcesso,
    dataHoraCertame: r.dataHoraCertame, prazoEdital: r.prazoEdital, urlSite: r.urlSite, nomeSite: r.nomeSite,
    produtos: r.produtos, valorEstimado: r.valorEstimado == null ? null : Number(r.valorEstimado), itens: Number(r.itens),
  }));
}

/** Garante (idempotente) os campos personalizados da licitação e grava os valores no deal. */
async function ensureAndSaveCustomFields(companyId, dealId, values) {
  const [existing] = await db.query("SELECT id, name FROM custom_fields WHERE company_id = ? AND entity_type = 'deal' AND is_active = 1", [companyId]);
  const byName = new Map(existing.map((f) => [f.name, f.id]));
  let order = existing.length;
  for (const name of Object.keys(values)) {
    if (!byName.has(name)) {
      const id = uuidv4();
      await db.query(
        'INSERT INTO custom_fields (id, company_id, entity_type, name, field_type, options, field_order, is_required) VALUES (?,?,?,?,?,?,?,?)',
        [id, companyId, 'deal', name, 'text', null, order++, 0]
      );
      byName.set(name, id);
    }
  }
  for (const [name, val] of Object.entries(values)) {
    if (val == null || val === '') continue;
    await db.query(
      'INSERT INTO deal_custom_values (id, deal_id, field_id, value) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [uuidv4(), dealId, byName.get(name), String(val)]
    );
  }
}

/** Copia os PDFs (edital/ata) da licitação para deal_files (identificados). Best-effort. */
async function copyDocs(companyId, controle, urlSite, dealId) {
  const ctrl = marketDocs.parseControle(urlSite);
  if (!ctrl) return 0;
  let n = 0;
  for (const tipo of ['edital', 'ata']) {
    let files = [];
    try { files = await marketDocs.listFiles(companyId, controle, tipo, ctrl); } catch { files = []; }
    for (const f of files) {
      try {
        const got = await marketDocs.getFile(companyId, controle, tipo, f.idx, ctrl);
        if (!got || !got.buf) continue;
        const label = `${tipo === 'edital' ? 'Edital' : 'Ata'} — ${got.filename}`.slice(0, 250);
        await db.query(
          `INSERT INTO deal_files (id, deal_id, file_name, file_url, file_size, mime_type, uploaded_by, kind, viewable, conteudo)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [uuidv4(), dealId, label, '', got.buf.length, got.mime, null, tipo, got.viewable ? 1 : 0, got.buf]
        );
        n++;
      } catch { /* ignora arquivo individual */ }
    }
  }
  return n;
}

/** Confirma participação: cria o deal a partir da licitação aberta. Retorna o deal id. */
async function confirmParticipation(scope, controle) {
  const companyId = scope.companyId;
  if (!controle) { const e = new Error('controle obrigatório'); e.code = 'BAD'; throw e; }

  const [dup] = await db.query('SELECT id FROM deals WHERE company_id = ? AND mi_controle = ? AND deleted_at IS NULL', [companyId, controle]);
  if (dup.length) { const e = new Error('Licitação já confirmada.'); e.code = 'DUP'; e.dealId = dup[0].id; throw e; }

  const [aggR] = await db.query(
    `SELECT MIN(id) miId, MAX(licitador) licitador, MAX(uf) uf, MAX(municipio) municipio, MAX(modalidade) modalidade,
            MAX(n_edital) nEdital, MAX(n_processo) nProcesso, MAX(prazo_edital) prazoEdital, MAX(url_site) urlSite,
            MAX(nome_site) nomeSite, MAX(cnpj) cnpj,
            GROUP_CONCAT(DISTINCT COALESCE(produto_candidato, produto) SEPARATOR ', ') produtos,
            SUM(preco_estimado_total) valor
       FROM market_intelligence WHERE company_id = ? AND pncp_controle = ?`,
    [companyId, controle]
  );
  const o = aggR[0];
  if (!o || !o.miId) { const e = new Error('Oportunidade não encontrada.'); e.code = 'NF'; throw e; }

  // Contato (órgão) — find-or-create
  const orgName = (o.licitador || 'Órgão licitante').slice(0, 200);
  let contactId;
  const [c] = await db.query(
    'SELECT id FROM contacts WHERE company_id = ? AND deleted_at IS NULL AND (first_name = ? OR company = ?) LIMIT 1',
    [companyId, orgName, orgName]
  );
  if (c.length) contactId = c[0].id;
  else {
    contactId = uuidv4();
    await db.query(
      `INSERT INTO contacts (id,company_id,type,first_name,last_name,email,phone,company,job_title,avatar_url,tags,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [contactId, companyId, 'company', orgName, '', null, null, orgName, 'Órgão licitante', null, JSON.stringify([]), `CNPJ: ${o.cnpj || '—'}`]
    );
  }

  // 1ª etapa ativa do funil default (master)
  const [st] = await db.query(
    `SELECT fs.id stageId, fs.funnel_id funnelId, fs.probability prob
       FROM funnel_stages fs JOIN funnels f ON f.id = fs.funnel_id
      WHERE f.company_id = ? AND f.is_default = 1 AND fs.type = 'active'
      ORDER BY fs.order_index ASC LIMIT 1`,
    [MASTER]
  );
  const stage = st[0] || {};
  const funnelId = stage.funnelId || 'default-funnel';
  const stageId = stage.stageId || '';

  const dealId = uuidv4();
  const valueCent = o.valor == null ? 0 : Math.round(Number(o.valor) * 100);
  const title = `${o.licitador || 'Licitação'} — ${o.nEdital || o.nProcesso || controle}`.slice(0, 250);
  const notes = [
    `Licitação ${controle}`,
    `Órgão: ${o.licitador || '—'}`,
    `Local: ${o.municipio || ''}${o.uf ? `/${o.uf}` : ''}`,
    `Modalidade: ${o.modalidade || '—'}`,
    `Produtos: ${o.produtos || '—'}`,
    `Valor estimado: R$ ${fmtBRL(o.valor)}`,
    `PNCP: ${o.urlSite || '—'}`,
  ].join('\n');
  const [maxRow] = await db.query('SELECT MAX(stage_order) m FROM deals WHERE stage_id = ? AND deleted_at IS NULL', [stageId]);
  const stageOrder = (maxRow[0].m ?? 0) + 1;
  await db.query(
    `INSERT INTO deals (id,company_id,contact_id,funnel_id,stage_id,owner_id,title,value,currency,stage,stage_order,probability,expected_close_date,closing_reason,notes,mi_controle)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [dealId, companyId, contactId, funnelId, stageId, scope.userId, title, valueCent, 'BRL', 'qualification', stageOrder, stage.prob ?? 10, o.prazoEdital || null, null, notes, controle]
  );

  await ensureAndSaveCustomFields(companyId, dealId, {
    'Órgão': o.licitador, 'Nº Processo': o.nProcesso, 'Nº Edital': o.nEdital, 'UF': o.uf, 'Município': o.municipio,
    'Modalidade': o.modalidade, 'Produto': o.produtos,
    'Valor estimado': o.valor != null ? `R$ ${fmtBRL(o.valor)}` : '', 'Portal': o.nomeSite,
    'Link PNCP': o.urlSite, 'Prazo': (o.prazoEdital || '').toString().slice(0, 10),
  });

  await copyDocs(companyId, controle, o.urlSite, dealId).catch(() => {});

  return dealId;
}

module.exports = { listOpportunities, confirmParticipation };
