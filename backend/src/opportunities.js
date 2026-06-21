// Oportunidades (licitações abertas) → CRM como deals BLOQUEADOS na etapa
// "Oportunidade". O botão "Participar" desbloqueia o deal (locked=0), move para a
// próxima etapa e COPIA os documentos (edital/ata/anexos) para a aba Arquivos.

const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const marketDocs = require('./marketDocs');

const MASTER = '00000000-0000-0000-0000-000000000001';
const OPP_STAGE = 'Oportunidade';
const fmtBRL = (n) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Garante a etapa "Oportunidade" (1ª) no funil default e devolve ids úteis. */
async function ensureOpportunityStage() {
  const [f] = await db.query("SELECT id FROM funnels WHERE company_id = ? AND is_default = 1 ORDER BY name LIMIT 1", [MASTER]);
  if (!f.length) return null;
  const funnelId = f[0].id;
  let [s] = await db.query('SELECT id FROM funnel_stages WHERE funnel_id = ? AND name = ? LIMIT 1', [funnelId, OPP_STAGE]);
  let oppStageId;
  if (s.length) oppStageId = s[0].id;
  else {
    oppStageId = uuidv4();
    await db.query(
      'INSERT INTO funnel_stages (id, funnel_id, company_id, name, color, order_index, probability, type) VALUES (?,?,?,?,?,?,?,?)',
      [oppStageId, funnelId, MASTER, OPP_STAGE, '#64748b', 0, 5, 'active']
    );
  }
  const [n] = await db.query(
    "SELECT id FROM funnel_stages WHERE funnel_id = ? AND type = 'active' AND name <> ? ORDER BY order_index, name LIMIT 1",
    [funnelId, OPP_STAGE]
  );
  return { funnelId, oppStageId, nextStageId: n[0]?.id || oppStageId };
}

/** Garante (idempotente) os campos personalizados da licitação e grava os valores. */
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

/** Contato (órgão) — find-or-create. */
async function ensureOrgaoContact(companyId, licitador, cnpj) {
  const orgName = (licitador || 'Órgão licitante').slice(0, 200);
  const [c] = await db.query(
    'SELECT id FROM contacts WHERE company_id = ? AND deleted_at IS NULL AND (first_name = ? OR company = ?) LIMIT 1',
    [companyId, orgName, orgName]
  );
  if (c.length) return c[0].id;
  const id = uuidv4();
  await db.query(
    `INSERT INTO contacts (id,company_id,type,first_name,last_name,email,phone,company,job_title,avatar_url,tags,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, companyId, 'company', orgName, '', null, null, orgName, 'Órgão licitante', null, JSON.stringify([]), `CNPJ: ${cnpj || '—'}`]
  );
  return id;
}

/** Cria um deal BLOQUEADO na etapa Oportunidade a partir de um agregado de licitação. */
async function createLockedDeal(scope, stage, o) {
  const companyId = scope.companyId;
  const contactId = await ensureOrgaoContact(companyId, o.licitador, o.cnpj);
  const dealId = uuidv4();
  const valueCent = o.valor == null ? 0 : Math.round(Number(o.valor) * 100);
  const title = `${o.licitador || 'Licitação'} — ${o.nEdital || o.nProcesso || o.controle}`.slice(0, 250);
  const notes = [
    `Licitação ${o.controle}`,
    `Órgão: ${o.licitador || '—'}`,
    `Local: ${o.municipio || ''}${o.uf ? `/${o.uf}` : ''}`,
    `Modalidade: ${o.modalidade || '—'}`,
    `Produtos: ${o.produtos || '—'}`,
    `Valor estimado: R$ ${fmtBRL(o.valor)}`,
    `PNCP: ${o.urlSite || '—'}`,
  ].join('\n');
  const [maxRow] = await db.query('SELECT MAX(stage_order) m FROM deals WHERE stage_id = ? AND deleted_at IS NULL', [stage.oppStageId]);
  const stageOrder = (maxRow[0].m ?? 0) + 1;
  await db.query(
    `INSERT INTO deals (id,company_id,contact_id,funnel_id,stage_id,owner_id,title,value,currency,stage,stage_order,probability,expected_close_date,closing_reason,notes,mi_controle,locked)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
    [dealId, companyId, contactId, stage.funnelId, stage.oppStageId, scope.userId, title, valueCent, 'BRL', 'qualification', stageOrder, 5, o.prazoEdital || null, null, notes, o.controle]
  );
  await ensureAndSaveCustomFields(companyId, dealId, {
    'Órgão': o.licitador, 'Nº Processo': o.nProcesso, 'Nº Edital': o.nEdital, 'UF': o.uf, 'Município': o.municipio,
    'Modalidade': o.modalidade, 'Produto': o.produtos,
    'Valor estimado': o.valor != null ? `R$ ${fmtBRL(o.valor)}` : '', 'Portal': o.nomeSite,
    'Link PNCP': o.urlSite, 'Prazo': (o.prazoEdital || '').toString().slice(0, 10),
  });
  return dealId;
}

/** Sincroniza: cria deals bloqueados (etapa Oportunidade) para as licitações ABERTAS ainda não convertidas. */
async function syncOpportunities(scope) {
  const companyId = scope.companyId;
  const stage = await ensureOpportunityStage();
  if (!stage) return { created: 0 };
  const [opps] = await db.query(
    `SELECT mi.pncp_controle AS controle,
            MAX(mi.licitador) AS licitador, MAX(mi.uf) AS uf, MAX(mi.municipio) AS municipio,
            MAX(mi.modalidade) AS modalidade, MAX(mi.n_edital) AS nEdital, MAX(mi.n_processo) AS nProcesso,
            MAX(mi.prazo_edital) AS prazoEdital, MAX(mi.url_site) AS urlSite, MAX(mi.nome_site) AS nomeSite, MAX(mi.cnpj) AS cnpj,
            GROUP_CONCAT(DISTINCT COALESCE(mi.produto_candidato, mi.produto) SEPARATOR ', ') AS produtos,
            SUM(mi.preco_estimado_total) AS valor
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
  let created = 0;
  for (const o of opps) {
    try { await createLockedDeal(scope, stage, o); created++; } catch { /* ignora 1 */ }
  }
  return { created };
}

/** Garante a etapa "Perdido" (type='lost') no funil default e devolve o id. */
async function ensureLostStage() {
  const [f] = await db.query("SELECT id FROM funnels WHERE company_id = ? AND is_default = 1 ORDER BY name LIMIT 1", [MASTER]);
  if (!f.length) return null;
  const funnelId = f[0].id;
  const [s] = await db.query("SELECT id FROM funnel_stages WHERE funnel_id = ? AND (type = 'lost' OR name = 'Perdido') LIMIT 1", [funnelId]);
  if (s.length) return { funnelId, stageId: s[0].id };
  const id = uuidv4();
  await db.query(
    'INSERT INTO funnel_stages (id, funnel_id, company_id, name, color, order_index, probability, type) VALUES (?,?,?,?,?,?,?,?)',
    [id, funnelId, MASTER, 'Perdido', '#ef4444', 1000, 0, 'lost']
  );
  return { funnelId, stageId: id };
}

/** Desfecho da licitação (vencedor/valor/situação) agregado por controle, lido do MI. */
async function computeOutcome(companyId, controle) {
  const [rows] = await db.query(
    `SELECT encerramento, posicao, concorrente, cnpj_concorrente, preco_final_total, preco_estimado_total
       FROM market_intelligence
      WHERE company_id = ? AND pncp_controle COLLATE utf8mb4_unicode_ci = ?`,
    [companyId, controle]
  );
  let estimated = 0, finalVal = 0, cancelled = false, hasWinner = false, anyOpen = false;
  const winners = new Map();
  for (const r of rows) {
    estimated += Number(r.preco_estimado_total) || 0;
    const enc = r.encerramento || '';
    if (/cancelad|revogad|anulad|fracassad|desert/i.test(enc)) cancelled = true;
    if (/recebendo/i.test(enc)) anyOpen = true;
    if (Number(r.posicao) === 1 && r.concorrente) {
      hasWinner = true;
      const v = Number(r.preco_final_total) || 0;
      finalVal += v;
      const key = r.cnpj_concorrente || r.concorrente;
      const cur = winners.get(key) || { nome: r.concorrente, cnpj: r.cnpj_concorrente, valor: 0 };
      cur.valor += v; winners.set(key, cur);
    }
  }
  let situacao;
  if (hasWinner) situacao = 'Encerrada com vencedor';
  else if (cancelled) situacao = 'Cancelada';
  else if (anyOpen) situacao = 'Recebendo propostas';
  else situacao = 'Encerrada sem vencedor (ou aguardando resultado)';
  return { situacao, hasWinner, cancelled, finalVal, estimated, winners: [...winners.values()] };
}

/** Atualiza o deal com o desfecho (valor fechado, vencedor, situação) + grava no
 *  histórico (1 atividade por deal, atualizada). Idempotente. Best-effort. */
async function enrichDealOutcome(companyId, deal) {
  const o = await computeOutcome(companyId, deal.mi_controle);
  const winnerTxt = o.winners.map((w) => `${w.nome}${w.cnpj ? ` (${w.cnpj})` : ''} — R$ ${fmtBRL(w.valor)}`).join('; ');
  const valueCent = o.hasWinner ? Math.round(o.finalVal * 100) : Math.round((o.estimated || 0) * 100);
  const reason = (o.hasWinner ? `${o.situacao}: ${winnerTxt}` : o.situacao).slice(0, 250);
  try {
    await db.query('UPDATE deals SET value = ?, closing_reason = ? WHERE id = ?', [valueCent, reason, deal.id]);
    await ensureAndSaveCustomFields(companyId, deal.id, {
      'Situação final': o.situacao,
      'Vencedor': o.hasWinner ? winnerTxt : (o.cancelled ? '—' : ''),
      'CNPJ vencedor': o.winners.map((w) => w.cnpj).filter(Boolean).join(', '),
      'Valor fechado': o.hasWinner ? `R$ ${fmtBRL(o.finalVal)}` : '',
      'Valor estimado': `R$ ${fmtBRL(o.estimated)}`,
    });
    const desc = [
      `Situação: ${o.situacao}`,
      o.hasWinner ? `Vencedor(es): ${winnerTxt}` : null,
      o.hasWinner ? `Valor fechado: R$ ${fmtBRL(o.finalVal)}` : null,
      `Valor estimado: R$ ${fmtBRL(o.estimated)}`,
    ].filter(Boolean).join('\n');
    // 1 atividade "Resultado da licitação" por deal (substitui a anterior).
    if (deal.contact_id) {
      await db.query("DELETE FROM activities WHERE deal_id = ? AND title = 'Resultado da licitação'", [deal.id]);
      await db.query(
        'INSERT INTO activities (id, deal_id, contact_id, type, title, description, occurred_at) VALUES (?,?,?,?,?,?,NOW())',
        [uuidv4(), deal.id, deal.contact_id, 'note', 'Resultado da licitação', desc.slice(0, 2000)]
      );
    }
  } catch { /* best-effort */ }
  return o;
}

/**
 * (1) Move para "Perdido" as oportunidades AINDA travadas (locked=1, não participadas)
 *     cuja licitação saiu de "Recebendo propostas" (encerrou sem participação).
 * (2) ENRIQUECE as oportunidades em Perdido ainda não finalizadas com o desfecho da
 *     licitação (vencedor, valor fechado, situação) + histórico — o resultado pode
 *     chegar depois (homologação), então re-checamos a cada ingestão até finalizar.
 * Chamado automaticamente após cada ingestão. Idempotente.
 */
async function closeStaleOpportunities(scope) {
  const companyId = scope.companyId;
  const lost = await ensureLostStage();
  if (!lost) return { closed: 0, enriched: 0 };

  // (1) move as travadas que encerraram
  const [stale] = await db.query(
    `SELECT d.id FROM deals d
      WHERE d.company_id = ? AND d.locked = 1 AND d.deleted_at IS NULL AND d.mi_controle IS NOT NULL
        AND d.mi_controle COLLATE utf8mb4_unicode_ci NOT IN (
          SELECT pncp_controle FROM market_intelligence
           WHERE company_id = ? AND encerramento = 'Recebendo propostas' AND pncp_controle IS NOT NULL
        )`,
    [companyId, companyId]
  );
  let closed = 0;
  for (const d of stale) {
    try {
      const [maxRow] = await db.query('SELECT MAX(stage_order) m FROM deals WHERE stage_id = ? AND deleted_at IS NULL', [lost.stageId]);
      const order = (maxRow[0].m ?? 0) + 1;
      await db.query('UPDATE deals SET stage_id = ?, stage_order = ?, locked = 0, stage_changed_at = NOW() WHERE id = ?', [lost.stageId, order, d.id]);
      closed++;
    } catch { /* ignora */ }
  }

  // (2) enriquece as em Perdido ainda NÃO finalizadas (sem vencedor e não cancelada)
  const [perd] = await db.query(
    `SELECT id, mi_controle, contact_id FROM deals
      WHERE company_id = ? AND stage_id = ? AND deleted_at IS NULL AND mi_controle IS NOT NULL
        AND (closing_reason IS NULL OR (closing_reason NOT LIKE 'Encerrada com vencedor%' AND closing_reason NOT LIKE 'Cancelada%'))`,
    [companyId, lost.stageId]
  );
  let enriched = 0;
  for (const d of perd) { await enrichDealOutcome(companyId, d); enriched++; }
  return { closed, enriched };
}

/** Participar: desbloqueia o deal, move p/ a próxima etapa e copia os documentos. */
async function participate(scope, dealId) {
  const [d] = await db.query('SELECT * FROM deals WHERE id = ? AND company_id = ? AND deleted_at IS NULL', [dealId, scope.companyId]);
  if (!d.length) { const e = new Error('Negociação não encontrada.'); e.code = 'NF'; throw e; }
  const deal = d[0];
  if (!deal.locked) return { ok: true, alreadyUnlocked: true };

  const stage = await ensureOpportunityStage();
  const nextStageId = (stage && stage.nextStageId) || deal.stage_id;
  const [maxRow] = await db.query('SELECT MAX(stage_order) m FROM deals WHERE stage_id = ? AND deleted_at IS NULL', [nextStageId]);
  const order = (maxRow[0].m ?? 0) + 1;
  await db.query('UPDATE deals SET locked = 0, stage_id = ?, stage_order = ?, stage_changed_at = NOW() WHERE id = ?', [nextStageId, order, dealId]);

  let docs = 0;
  if (deal.mi_controle) {
    const [mi] = await db.query('SELECT MAX(url_site) urlSite FROM market_intelligence WHERE company_id = ? AND pncp_controle = ?', [scope.companyId, deal.mi_controle]);
    docs = await copyDocs(scope.companyId, deal.mi_controle, mi[0]?.urlSite, dealId).catch(() => 0);
  }
  return { ok: true, stageId: nextStageId, docs };
}

module.exports = { ensureOpportunityStage, syncOpportunities, closeStaleOpportunities, participate };
