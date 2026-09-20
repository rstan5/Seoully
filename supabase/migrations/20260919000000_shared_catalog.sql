-- Phase 11C: shared community catalog. Ownership/Holdings remain local until 11D.

create table if not exists public.catalog_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null check (char_length(name) between 1 and 120),
  native_name text,
  status text not null default 'community' check (status in ('community', 'verified', 'restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.catalog_groups(id) on delete restrict,
  stage_name text not null check (char_length(stage_name) between 1 and 120),
  normalized_name text not null check (normalized_name <> ''),
  status text not null default 'community' check (status in ('community', 'verified', 'restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, normalized_name)
);

create table if not exists public.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.catalog_groups(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  normalized_title text not null check (normalized_title <> ''),
  status text not null default 'community' check (status in ('community', 'verified', 'restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, normalized_title)
);

create table if not exists public.collectible_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.catalog_groups(id) on delete restrict,
  member_id uuid references public.catalog_members(id) on delete restrict,
  release_id uuid references public.catalog_releases(id) on delete restrict,
  kind text not null check (kind in ('photocard', 'album', 'vinyl', 'poster', 'lightstick', 'plushie', 'figure', 'book', 'apparel', 'memorabilia')),
  name text not null check (char_length(name) between 1 and 200),
  normalized_name text not null check (normalized_name <> ''),
  descriptor text not null default '' check (char_length(descriptor) <= 300),
  identity_key text not null unique,
  status text not null default 'community' check (status in ('community', 'verified', 'restricted')),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collectible_member_group_check check (member_id is null or group_id is not null)
);

create table if not exists public.catalog_contributions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.collectible_templates(id) on delete restrict,
  contributor_user_id uuid not null references public.users(id) on delete restrict,
  source_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'accepted' check (status in ('accepted', 'pending', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists catalog_groups_name_idx on public.catalog_groups using gin (to_tsvector('simple', name));
create index if not exists catalog_members_group_name_idx on public.catalog_members (group_id, normalized_name);
create index if not exists catalog_releases_group_title_idx on public.catalog_releases (group_id, normalized_title);
create index if not exists collectible_templates_search_idx on public.collectible_templates using gin (to_tsvector('simple', search_text));
create index if not exists collectible_templates_group_idx on public.collectible_templates (group_id, status, created_at desc);
create index if not exists catalog_contributions_template_idx on public.catalog_contributions (template_id, created_at desc);
create index if not exists catalog_contributions_contributor_idx on public.catalog_contributions (contributor_user_id, created_at desc);

create or replace function public.catalog_normalize(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '\s+', ' ', 'g');
$$;

create or replace function public.create_catalog_contribution(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_contributor uuid := public.current_seoully_user_id();
  v_group_id uuid;
  v_member_id uuid;
  v_release_id uuid;
  v_template public.collectible_templates%rowtype;
  v_group_name text := trim(coalesce(p_payload ->> 'groupName', ''));
  v_group_slug text := public.catalog_normalize(p_payload ->> 'groupName');
  v_member_name text := trim(coalesce(p_payload ->> 'memberName', ''));
  v_release_name text := trim(coalesce(p_payload ->> 'releaseName', ''));
  v_kind text := public.catalog_normalize(p_payload ->> 'kind');
  v_name text := trim(coalesce(p_payload ->> 'name', ''));
  v_descriptor text := trim(coalesce(p_payload ->> 'descriptor', ''));
  v_normalized_name text := public.catalog_normalize(p_payload ->> 'name');
  v_identity_key text;
begin
  if v_contributor is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if v_group_name = '' or v_group_slug = '' or v_name = '' or v_normalized_name = '' then raise exception 'catalog details required' using errcode = '22023'; end if;
  if v_kind not in ('photocard', 'album', 'vinyl', 'poster', 'lightstick', 'plushie', 'figure', 'book', 'apparel', 'memorabilia') then raise exception 'invalid collectible type' using errcode = '22023'; end if;
  if char_length(v_group_name) > 120 or char_length(v_name) > 200 or char_length(v_descriptor) > 300 then raise exception 'catalog text too long' using errcode = '22023'; end if;

  insert into public.catalog_groups (slug, name) values (v_group_slug, v_group_name)
    on conflict (slug) do update set name = excluded.name, updated_at = now()
    returning id into v_group_id;

  if v_member_name <> '' then
    insert into public.catalog_members (group_id, stage_name, normalized_name)
      values (v_group_id, v_member_name, public.catalog_normalize(v_member_name))
      on conflict (group_id, normalized_name) do update set stage_name = excluded.stage_name, updated_at = now()
      returning id into v_member_id;
  end if;

  if v_release_name <> '' then
    insert into public.catalog_releases (group_id, title, normalized_title)
      values (v_group_id, v_release_name, public.catalog_normalize(v_release_name))
      on conflict (group_id, normalized_title) do update set title = excluded.title, updated_at = now()
      returning id into v_release_id;
  end if;

  v_identity_key := concat(v_group_id, '|', coalesce(v_member_id::text, ''), '|', coalesce(v_release_id::text, ''), '|', v_kind, '|', v_normalized_name, '|', public.catalog_normalize(v_descriptor));
  insert into public.collectible_templates (group_id, member_id, release_id, kind, name, normalized_name, descriptor, identity_key, search_text)
    values (v_group_id, v_member_id, v_release_id, v_kind, v_name, v_normalized_name, v_descriptor, v_identity_key,
      concat_ws(' ', v_group_name, v_member_name, v_release_name, v_name, v_descriptor, v_kind))
    on conflict (identity_key) do update set updated_at = now()
    returning * into v_template;

  insert into public.catalog_contributions (template_id, contributor_user_id, source_metadata)
    values (v_template.id, v_contributor, p_payload)
    on conflict do nothing;

  return jsonb_build_object(
    'template', to_jsonb(v_template),
    'contributor_user_id', v_contributor,
    'created', true
  );
end;
$$;

alter table public.catalog_groups enable row level security;
alter table public.catalog_members enable row level security;
alter table public.catalog_releases enable row level security;
alter table public.collectible_templates enable row level security;
alter table public.catalog_contributions enable row level security;

revoke all on public.catalog_groups, public.catalog_members, public.catalog_releases, public.collectible_templates, public.catalog_contributions from anon, authenticated;
grant select on public.catalog_groups, public.catalog_members, public.catalog_releases, public.collectible_templates to anon, authenticated;

drop policy if exists catalog_groups_public_read on public.catalog_groups;
create policy catalog_groups_public_read on public.catalog_groups for select to anon, authenticated using (status <> 'restricted');
drop policy if exists catalog_members_public_read on public.catalog_members;
create policy catalog_members_public_read on public.catalog_members for select to anon, authenticated using (status <> 'restricted');
drop policy if exists catalog_releases_public_read on public.catalog_releases;
create policy catalog_releases_public_read on public.catalog_releases for select to anon, authenticated using (status <> 'restricted');
drop policy if exists collectible_templates_public_read on public.collectible_templates;
create policy collectible_templates_public_read on public.collectible_templates for select to anon, authenticated using (status <> 'restricted');

revoke all on function public.create_catalog_contribution(jsonb) from public, anon, authenticated;
grant execute on function public.create_catalog_contribution(jsonb) to authenticated;
