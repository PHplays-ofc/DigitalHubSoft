-- Execute no SQL Editor depois de criar as tabelas e o administrador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

-- Apenas administradores podem enviar imagens.
drop policy if exists "Admin uploads product images" on storage.objects;
create policy "Admin uploads product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and (select public.is_shop_admin()));
-- O bucket público permite leitura pública de imagens.
