-- Catalog Reference Images V1: explicit community-shared visual knowledge.

create table if not exists public.catalog_reference_images (
  id uuid primary key default gen_random_uuid(),
  collectible_template_id uuid not null references public.collectible_templates(id) on delete restrict,
  storage_bucket text not null default 'catalog-reference-images',
  storage_path text not null unique,
  contributed_by_user_id uuid not null references public.users(id) on delete restrict,
  source_type text not null default 'community_contribution' check (source_type in ('community_contribution')),
  status text not null default 'active' check (status in ('active', 'pending', 'rejected', 'removed')),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collectible_template_id, contributed_by_user_id, source_key)
);

create index if not exists catalog_reference_images_template_idx
  on public.catalog_reference_images (collectible_template_id, status, created_at desc);
create index if not exists catalog_reference_images_contributor_idx
  on public.catalog_reference_images (contributed_by_user_id, created_at desc);

create or replace function public.touch_catalog_reference_images_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists catalog_reference_images_touch_updated_at on public.catalog_reference_images;
create trigger catalog_reference_images_touch_updated_at before update on public.catalog_reference_images
for each row execute function public.touch_catalog_reference_images_updated_at();

alter table public.catalog_reference_images enable row level security;
revoke all on public.catalog_reference_images from anon, authenticated;
grant select, insert on public.catalog_reference_images to authenticated;

drop policy if exists catalog_reference_images_select_active on public.catalog_reference_images;
create policy catalog_reference_images_select_active on public.catalog_reference_images for select to authenticated
using (status = 'active');

drop policy if exists catalog_reference_images_insert_contributor on public.catalog_reference_images;
create policy catalog_reference_images_insert_contributor on public.catalog_reference_images for insert to authenticated
with check (
  contributed_by_user_id = (select public.current_seoully_user_id())
  and storage_bucket = 'catalog-reference-images'
  and (storage_path like ((select public.current_seoully_user_id())::text || '/%'))
  and exists (
    select 1 from public.catalog_contributions c
    where c.template_id = catalog_reference_images.collectible_template_id
      and c.contributor_user_id = contributed_by_user_id
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-reference-images', 'catalog-reference-images', false, 10485760, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists catalog_reference_images_storage_insert_own on storage.objects;
create policy catalog_reference_images_storage_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'catalog-reference-images'
  and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text
);

drop policy if exists catalog_reference_images_storage_select_active on storage.objects;
create policy catalog_reference_images_storage_select_active on storage.objects for select to authenticated
using (
  bucket_id = 'catalog-reference-images'
  and exists (
    select 1 from public.catalog_reference_images r
    where r.storage_bucket = storage.objects.bucket_id
      and r.storage_path = storage.objects.name
      and r.status = 'active'
  )
);

drop policy if exists catalog_reference_images_storage_delete_own on storage.objects;
create policy catalog_reference_images_storage_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'catalog-reference-images'
  and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text
);
