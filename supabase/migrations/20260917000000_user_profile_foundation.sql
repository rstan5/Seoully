-- Phase 11B: the first durable identity/profile slice.
-- No collection, Room, media, or social domain is introduced here.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_subject uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  handle text not null check (handle = lower(handle) and handle ~ '^[a-z][a-z0-9_]{2,15}$'),
  display_name text not null check (char_length(display_name) between 1 and 48),
  tagline text not null default '' check (char_length(tagline) <= 100),
  bio text not null default '' check (char_length(bio) <= 500),
  location text check (location is null or char_length(location) <= 80),
  favorite_group_ids text[] not null default '{}',
  bias_member_ids text[] not null default '{}',
  favorite_era_ids text[] not null default '{}',
  collector_interests text[] not null default '{}'
    check (collector_interests <@ array['albums', 'photocards', 'merch', 'vinyl', 'posters', 'lightsticks', 'everything']::text[]),
  collector_type text not null default 'Collector' check (char_length(collector_type) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_group_ids_size check (cardinality(favorite_group_ids) <= 24),
  constraint profiles_bias_ids_size check (cardinality(bias_member_ids) <= 48),
  constraint profiles_era_ids_size check (cardinality(favorite_era_ids) <= 48)
);

create unique index if not exists profiles_handle_normalized_uidx
  on public.profiles (lower(handle));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
before update on public.users
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Auth metadata is used only during provisioning. A supplied invalid/duplicate
-- handle causes the auth insert to fail atomically; it never leaves an orphan.
create or replace function public.provision_seoully_identity(
  p_auth_subject uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid;
  v_handle text;
  v_display_name text;
begin
  if p_auth_subject is null then
    raise exception 'auth subject required' using errcode = '23502';
  end if;

  insert into public.users (auth_subject)
  values (p_auth_subject)
  on conflict (auth_subject) do nothing;

  select u.id into v_user_id
  from public.users as u
  where u.auth_subject = p_auth_subject;

  if v_user_id is null then
    raise exception 'Seoully user provisioning failed' using errcode = 'P0001';
  end if;

  v_handle := lower(trim(coalesce(p_metadata ->> 'handle', '')));
  if v_handle = '' then
    v_handle := 'collector_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;
  if v_handle !~ '^[a-z][a-z0-9_]{2,15}$' then
    raise exception 'Invalid Seoully handle' using errcode = '23514';
  end if;

  v_display_name := trim(coalesce(p_metadata ->> 'display_name', v_handle));
  if char_length(v_display_name) < 1 or char_length(v_display_name) > 48 then
    raise exception 'Invalid Seoully display name' using errcode = '23514';
  end if;

  insert into public.profiles (user_id, handle, display_name)
  values (v_user_id, v_handle, v_display_name)
  on conflict (user_id) do nothing;

  return v_user_id;
end;
$$;

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.provision_seoully_identity(new.id, new.raw_user_meta_data);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provision_seoully on auth.users;
create trigger on_auth_user_created_provision_seoully
after insert on auth.users
for each row execute function public.on_auth_user_created();

-- Idempotent repair path for accounts created before/while provisioning was
-- repaired. It takes no identity parameter and can only act on auth.uid().
create or replace function public.ensure_current_seoully_identity()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_user auth.users%rowtype;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into v_auth_user from auth.users where id = auth.uid();
  if not found then
    return null;
  end if;
  return public.provision_seoully_identity(v_auth_user.id, v_auth_user.raw_user_meta_data);
end;
$$;

create or replace function public.current_seoully_user_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select u.id from public.users as u where u.auth_subject = auth.uid()
$$;

alter table public.users enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "users_read_own" on public.users;
create policy "users_read_own"
on public.users for select to authenticated
using (auth_subject = (select auth.uid()));

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
on public.profiles for select to anon, authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (user_id = (select public.current_seoully_user_id()))
with check (user_id = (select public.current_seoully_user_id()));

revoke all on public.users from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
grant select on public.users to authenticated;
grant select on public.profiles to anon, authenticated;
grant update (
  handle,
  display_name,
  tagline,
  bio,
  location,
  favorite_group_ids,
  bias_member_ids,
  favorite_era_ids,
  collector_interests,
  collector_type
) on public.profiles to authenticated;

revoke all on function public.provision_seoully_identity(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;
revoke all on function public.ensure_current_seoully_identity() from public, anon;
revoke all on function public.current_seoully_user_id() from public, anon;
grant execute on function public.ensure_current_seoully_identity() to authenticated;
grant execute on function public.current_seoully_user_id() to authenticated;
