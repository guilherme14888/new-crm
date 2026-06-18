// Estado do período de teste (trial) de uma empresa, derivado das colunas
// `trial_starts_at` e `trial_days` da tabela companies. Compartilhado entre o
// login (bloqueio ao expirar) e a API financeira / sessão (contador no app).

/**
 * @param {object} c  linha de companies (com trial_starts_at, trial_days)
 * @returns {{onTrial:boolean, trialExpired:boolean, trialDaysLeft:number|null, trialEndsAt:string|null}}
 */
function trialStatus(c) {
  const days = c && c.trial_days != null ? Number(c.trial_days) : null;
  const startRaw = c && c.trial_starts_at ? c.trial_starts_at : null;
  if (!days || days <= 0 || !startRaw) {
    return { onTrial: false, trialExpired: false, trialDaysLeft: null, trialEndsAt: null };
  }
  const start = new Date(startRaw).getTime();
  if (isNaN(start)) return { onTrial: false, trialExpired: false, trialDaysLeft: null, trialEndsAt: null };
  const end = start + days * 86400000;
  const msLeft = end - Date.now();
  return {
    onTrial: msLeft > 0,
    trialExpired: msLeft <= 0,
    trialDaysLeft: msLeft > 0 ? Math.ceil(msLeft / 86400000) : 0,
    trialEndsAt: new Date(end).toISOString(),
  };
}

module.exports = { trialStatus };
