import { config, json } from './_shared.js';
// Nunca marcar um pedido como pago apenas porque alguém chamou esta URL.
// A confirmação financeira exige validação da assinatura do PagBank e conciliação com sua API.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    config();
    // Sem validação de assinatura, não persistimos o conteúdo recebido.
    // TODO: implementar verificação conforme o mecanismo de autenticação de webhooks da conta PagBank.
    return json(res, 202, { received: true, verified: false });
  } catch { return json(res, 503, { error: 'Integração não configurada.' }); }
}
