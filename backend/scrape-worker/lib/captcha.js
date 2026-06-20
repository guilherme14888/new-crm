// Cliente 2Captcha — resolve reCAPTCHA (v2 e v3) para os portais que protegem a
// consulta com anti-bot (ex.: BEC-SP). Requer a chave em CAPTCHA_API_KEY (ou
// TWOCAPTCHA_KEY). Sem chave, hasKey() é false e o adapter deve pular/avisar.
//
// Fluxo 2Captcha: in.php (submete sitekey+url) → res.php (poll até o token).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'https://2captcha.com';

const apiKey = () => process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_KEY || '';
const hasKey = () => !!apiKey();

async function getJson(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  return res.json();
}

/** Submete um captcha e faz poll até o token (ou erro/timeout). */
async function solve(params) {
  const key = apiKey();
  if (!key) throw new Error('CAPTCHA_API_KEY não configurada (2Captcha).');
  const qs = new URLSearchParams({ key, json: '1', ...params }).toString();
  const sub = await getJson(`${API}/in.php?${qs}`);
  if (String(sub.status) !== '1') throw new Error(`2captcha submit: ${sub.request}`);
  const id = sub.request;

  // poll: ~até 180s (reCAPTCHA costuma resolver em 15-60s)
  for (let i = 0; i < 36; i++) {
    await sleep(5000);
    const r = await getJson(`${API}/res.php?key=${key}&action=get&id=${id}&json=1`);
    if (String(r.status) === '1') return r.request;       // token
    if (r.request !== 'CAPCHA_NOT_READY') throw new Error(`2captcha: ${r.request}`);
  }
  throw new Error('2captcha: timeout aguardando o token');
}

/** reCAPTCHA v2 (checkbox/invisible). */
function solveRecaptchaV2({ siteKey, pageUrl, invisible = false }) {
  return solve({ method: 'userrecaptcha', googlekey: siteKey, pageurl: pageUrl, ...(invisible ? { invisible: '1' } : {}) });
}

/** reCAPTCHA v3 (score-based). */
function solveRecaptchaV3({ siteKey, pageUrl, action = 'verify', minScore = 0.3 }) {
  return solve({ method: 'userrecaptcha', version: 'v3', googlekey: siteKey, pageurl: pageUrl, action, min_score: String(minScore) });
}

module.exports = { hasKey, solveRecaptchaV2, solveRecaptchaV3 };
