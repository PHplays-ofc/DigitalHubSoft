# DigitalHubSoft — PagBank (integração inicial em Sandbox)

## O que foi implementado
- Botão **Pagar com PagBank** conectado à Vercel Function `/api/checkout`.
- API consulta **preços e estoque no Supabase**, nunca confia em preços enviados pelo navegador.
- Criação de checkout hospedado PagBank com link `PAY` e pedido persistido no Supabase.
- `/api/products` fornece catálogo compartilhado; se estiver indisponível, a interface continua exibindo o catálogo local de demonstração, **mas não é possível cobrar por produtos que não estejam no Supabase**.
- `/api/pagbank-webhook` responde 202 sem marcar pedidos como pagos. **Ainda falta validar a autenticidade das notificações, reconciliar os pagamentos com a API e atualizar status e estoque.** O retorno do cliente à loja **não é prova de pagamento**.

## Configurar
1. Crie projeto em https://supabase.com e execute `supabase-schema.sql` no SQL Editor.
2. Insira seus produtos reais em `public.products`, com IDs compatíveis com os produtos do catálogo (IDs simples com letras, números, `_` ou `-`), preços **em centavos** e estoque. Exemplo: `insert into public.products(id,name,price_cents,stock) values ('sku001','Camiseta',4990,5);`.
3. No PagBank Developers, configure seu ambiente Sandbox e obtenha um token de teste. **Nunca envie o token por chat, nem o coloque em arquivos React.**
4. Na Vercel, cadastre as variáveis listadas em `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` é secreta e deve ficar apenas no servidor. `SITE_URL` deve ser a URL HTTPS publicada da loja, sem barra final.
5. Faça deploy e teste o catálogo em `https://SEU-SITE/api/products`; então teste um checkout Sandbox. A API real só funciona em deploy com funções serverless; `vite dev` sozinho não executa `/api`.
6. Antes de cobrar de verdade, implemente autenticação do administrador e CRUD seguro no banco, verificação dos webhooks e reconciliação com a API do PagBank, controle de estoque transacional e política de frete/entrega. Não altere `PAGBANK_ENV` para `production` sem isso e sem homologação/liberação do PagBank.

## Limitações importantes
- O painel `/#admin` original **não tem login**. Por isso, quando o catálogo online estiver ativo, as alterações locais são bloqueadas, para evitar falsa impressão de que foram publicadas. Gerencie os produtos provisoriamente no painel do Supabase.
- Não há cálculo de frete, endereço de entrega ou reserva de estoque. Use o exemplo apenas para produtos digitais ou casos sem frete até implementar logística.
- A criação do checkout não equivale a pedido pago. A URL de webhook está preparada mas a confirmação automática de pagamento **não está pronta**.
- Se uma chamada ao PagBank for bem-sucedida mas a atualização do banco falhar, o checkout poderá existir sem `checkout_id` registrado. É preciso tratar reconciliação e idempotência antes de produção.

Documentação: https://developer.pagbank.com.br/reference/criar-checkout

## Pix e cartão parcelado (atualização)

- O cliente escolhe Pix ou cartão antes de abrir o checkout PagBank. O servidor limita o checkout ao método escolhido.
- Cada produto possui `max_installments` entre 1 e 12. Em carrinhos mistos, prevalece o menor limite. O servidor consulta esse campo diretamente no Supabase.
- O Checkout PagBank recebe `payment_methods` e `payment_methods_configs` com `INSTALLMENTS_LIMIT`.
- Juros e valores das parcelas são apresentados pelo PagBank; não mostramos parcelas fixas presumindo ausência de juros.
- Execute o SQL atualizado no Supabase. **A edição do painel local ainda não grava no Supabase**: para pagamentos reais, cadastre o limite de parcelas na tabela `products` do Supabase, com acesso seguro. Não use o `localStorage` como fonte de preços ou parcelas para cobranças.
- Antes de produção, configure autenticação administrativa, notificações verificadas e conciliação de pedidos.
