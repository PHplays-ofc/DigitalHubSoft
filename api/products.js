import { db, json } from './_shared.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const rows = await db('products?select=id,name,short_description,description,price_cents,category,image,stock&active=eq.true&order=name.asc');
    return json(res, 200, { products: rows.map(p => ({ id:p.id, name:p.name, shortDescription:p.short_description || '', description:p.description || '', price:p.price_cents / 100, category:p.category || '', image:p.image || '', stock:p.stock })) });
  } catch { return json(res, 503, { error: 'Catálogo compartilhado indisponível.' }); }
}
