-- Phase 11G: private personal collectible media.

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  holding_id uuid not null unique references public.holdings(id) on delete cascade,
  storage_bucket text not null default 'collectible-media',
  storage_path text not null unique,
  media_kind text not null default 'image' check (media_kind = 'image'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_owner_idx on public.media_assets (owner_user_id, created_at desc);
create index if not exists media_assets_holding_idx on public.media_assets (holding_id);

create or replace function public.touch_media_assets_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists media_assets_touch_updated_at on public.media_assets;
create trigger media_assets_touch_updated_at before update on public.media_assets
for each row execute function public.touch_media_assets_updated_at();

alter table public.media_assets enable row level security;
revoke all on public.media_assets from anon, authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;

drop policy if exists media_assets_select_own on public.media_assets;
create policy media_assets_select_own on public.media_assets for select to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists media_assets_insert_own on public.media_assets;
create policy media_assets_insert_own on public.media_assets for insert to authenticated
with check (owner_user_id = (select public.current_seoully_user_id()) and exists (
  select 1 from public.holdings h where h.id = media_assets.holding_id and h.owner_user_id = media_assets.owner_user_id
));

drop policy if exists media_assets_update_own on public.media_assets;
create policy media_assets_update_own on public.media_assets for update to authenticated
using (owner_user_id = (select public.current_seoully_user_id()))
with check (owner_user_id = (select public.current_seoully_user_id()) and exists (
  select 1 from public.holdings h where h.id = media_assets.holding_id and h.owner_user_id = media_assets.owner_user_id
));

drop policy if exists media_assets_delete_own on public.media_assets;
create policy media_assets_delete_own on public.media_assets for delete to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collectible-media', 'collectible-media', false, 10485760, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists collectible_media_insert_own on storage.objects;
create policy collectible_media_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'collectible-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);

drop policy if exists collectible_media_select_own on storage.objects;
create policy collectible_media_select_own on storage.objects for select to authenticated
using (bucket_id = 'collectible-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);

drop policy if exists collectible_media_update_own on storage.objects;
create policy collectible_media_update_own on storage.objects for update to authenticated
using (bucket_id = 'collectible-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text)
with check (bucket_id = 'collectible-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);

drop policy if exists collectible_media_delete_own on storage.objects;
create policy collectible_media_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'collectible-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);
