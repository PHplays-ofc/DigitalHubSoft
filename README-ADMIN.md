# DigitalHubSoft — painel Supabase

1. No Supabase, execute `supabase-storage.sql` no SQL Editor (as tabelas `products` e `admin_users` e o usuário administrador devem existir).
2. Na raiz do projeto crie `.env.local` com:
   `VITE_SUPABASE_URL=https://REFERENCIA.supabase.co`
   `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
   Não use `service_role` nem secret keys no frontend.
3. `npm install` e `npm run dev`. Acesse `http://localhost:5173/#admin` e entre com o usuário criado no Supabase Auth.
4. O painel cadastra, edita, exclui, ativa/desativa produtos e envia fotos para o bucket `product-images`. Produtos ativos são públicos; inativos só aparecem para administradores autenticados.
5. A exportação Excel agora usa ExcelJS. O carrinho continua salvo no navegador do cliente.
6. O botão de pagamento depende das funções `/api/checkout` da Vercel e NÃO funciona em `vite dev` sozinho. Ainda faltam integração/testes de pagamento, webhook autenticado, baixa segura de estoque e revisão da configuração de produção. Não aceite pagamentos reais até concluir essas etapas.
7. **Não há migração automática** dos produtos que estavam em localStorage. Cadastre-os novamente pelo painel ou migre-os com cuidado.
8. Execute `npm audit` e `npm run build` para verificar sua instalação.
