import { randomUUID } from 'node:crypto';
import { config, db, json } from './_shared.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const c = config();
    if (!c.PAGBANK_TOKEN || !c.SITE_URL || !['sandbox','production'].includes(c.PAGBANK_ENV)) return json(res, 503, { error: 'PagBank ainda não configurado no servidor.' });
    const items = req.body?.items;
    const paymentMethod = req.body?.paymentMethod;
    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) return json(res, 400, { error: 'Escolha Pix ou cartão de crédito.' });
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) return json(res, 400, { error: 'Carrinho inválido.' });
    const ids = new Set();
    for (const i of items) {
      if (!i || typeof i.productId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(i.productId) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999 || ids.has(i.productId)) return json(res, 400, { error: 'Itens ou quantidades inválidos.' });
      ids.add(i.productId);
    }
    const rows = await db(`products?select=id,name,price_cents,stock,active,max_installments&id=in.(${[...ids].join(',')})`);
    const byId = new Map(rows.map(p => [p.id, p]));
    let total = 0;
    let maxInstallments = 12;
    const verified = items.map(i => {
      const p = byId.get(i.productId);
      if (!p || !p.active || !Number.isInteger(p.price_cents) || p.price_cents < 100 || !Number.isInteger(p.stock) || i.quantity > p.stock) throw new Error('Produto indisponível, preço inválido ou estoque insuficiente. Atualize o carrinho.');
      if (!Number.isInteger(p.max_installments) || p.max_installments < 1 || p.max_installments > 12) throw new Error('Limite de parcelas inválido no catálogo.');
      maxInstallments = Math.min(maxInstallments, p.max_installments);
      total += p.price_cents * i.quantity;
      return { reference_id: p.id, name: p.name.slice(0, 100), quantity: i.quantity, unit_amount: p.price_cents };
    });
    if (!Number.isSafeInteger(total) || total > 999999900) return json(res, 400, { error: 'Valor do pedido excede o limite.' });
    const reference = randomUUID();
    await db('shop_orders', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ id:reference, items:verified, total_cents:total, status:'CREATED' }) });
    const base = c.PAGBANK_ENV === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
    const site = new URL(c.SITE_URL);
    if (site.protocol !== 'https:') throw new Error('SITE_URL precisa ser HTTPS.');
    const hook = `${site.origin}/api/pagbank-webhook`;
    const payload = { payment_methods:[{type:paymentMethod}], ...(paymentMethod === 'CREDIT_CARD' ? {payment_methods_configs:[{type:'CREDIT_CARD',config_options:[{option:'INSTALLMENTS_LIMIT',value:String(maxInstallments)}]}]} : {}), reference_id: reference, customer_modifiable:true, items:verified, redirect_url:`${site.origin}/?checkout=retorno`, return_url:site.origin, notification_urls:[hook], payment_notification_urls:[hook] };
    const response = await fetch(`${base}/checkouts`, { method:'POST', headers:{ Authorization:`Bearer ${c.PAGBANK_TOKEN}`, 'Content-Type':'application/json', Accept:'application/json', 'x-idempotency-key':reference }, body:JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { console.error('PagBank checkout status', response.status); return json(res, 502, { error:'PagBank não aceitou a criação do checkout. Verifique token, homologação e ambiente.' }); }
    const paymentUrl = result.links?.find(l => l.rel === 'PAY')?.href;
    if (typeof paymentUrl !== 'string' || !paymentUrl.startsWith('https://')) return json(res, 502, { error:'PagBank não retornou link de pagamento.' });
    await db(`shop_orders?id=eq.${reference}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ checkout_id:result.id, status:'CHECKOUT_CREATED' }) });
    return json(res, 200, { paymentUrl, orderId:reference });
  } catch (err) { console.error('Checkout error:', err); return json(res, 400, { error: err instanceof Error && err.message.startsWith('Produto') ? err.message : 'Não foi possível criar o checkout. Verifique a configuração do servidor.' }); }
}
