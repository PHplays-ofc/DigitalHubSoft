-- Execute no SQL Editor do Supabase. Não exponha a service_role key no navegador.
create table if not exists public.products (
 id text primary key check (id ~ '^[a-zA-Z0-9_-]{1,64}$'),
 name text not null check (length(name) between 1 and 100),
 short_description text not null default '', description text not null default '',
 price_cents integer not null check (price_cents >= 100),
 category text not null default '', image text not null default '',
 stock integer not null default 0 check (stock >= 0), max_installments integer not null default 1 check (max_installments between 1 and 12), active boolean not null default true
);
create table if not exists public.shop_orders (
 id uuid primary key, items jsonb not null, total_cents bigint not null,
 checkout_id text, status text not null default 'CREATED', created_at timestamptz not null default now()
);
alter table public.products enable row level security;
alter table public.shop_orders enable row level security;
-- Nenhuma política pública: apenas o backend com service_role acessa essas tabelas.
-- Exemplo de produto de teste (substitua por seus produtos reais):
-- insert into public.products(id,name,price_cents,stock,category) values ('sku001','Produto de teste',4990,10,'Teste');

-- Para projetos Supabase que já têm a tabela products:
alter table public.products add column if not exists max_installments integer not null default 1 check (max_installments between 1 and 12);
