export function config() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAGBANK_TOKEN, PAGBANK_ENV = 'sandbox', SITE_URL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Banco de dados ainda não configurado.');
  return { SUPABASE_URL: SUPABASE_URL.replace(/\/$/, ''), SUPABASE_SERVICE_ROLE_KEY, PAGBANK_TOKEN, PAGBANK_ENV, SITE_URL };
}
export async function db(path, options = {}) {
  const c = config();
  const r = await fetch(`${c.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: c.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${c.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...options.headers } });
  if (!r.ok) throw new Error(`Falha ao consultar banco de dados (${r.status}).`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
export function json(res, status, data) { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(data); }
