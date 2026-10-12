-- Profile identity prerequisites only. No existing identity/catalog/media rewrite.
alter table public.profiles add column avatar_id uuid;
grant select (avatar_id) on public.profiles to anon, authenticated;
grant update (avatar_id) on public.profiles to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',false,5242880,array['image/jpeg']);
create policy profile_avatar_owner_read on storage.objects for select to authenticated
using (bucket_id='profile-avatars' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and (storage.foldername(name))[1]=(select public.current_seoully_user_id())::text);
create policy profile_avatar_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and (storage.foldername(name))[1]=(select public.current_seoully_user_id())::text);
-- Immutable operation paths: replacing a photo uploads a new UUID, never overwrites.
create policy profile_avatar_published_read on storage.objects for select to anon, authenticated
using (bucket_id='profile-avatars' and exists (
  select 1 from public.profiles p
  where p.avatar_id is not null and name=p.user_id::text||'/'||p.avatar_id::text||'.jpg'
));

create table public.catalog_identity_contributions (
  id uuid primary key default gen_random_uuid(),
  contributor_user_id uuid not null references public.users(id) on delete restrict,
  submission_id uuid not null,
  kind text not null check (kind in ('group','member')),
  submitted_name text not null check (char_length(submitted_name) between 1 and 120),
  request jsonb not null,
  group_id uuid not null references public.catalog_groups(id) on delete restrict,
  member_id uuid references public.catalog_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (contributor_user_id,submission_id),
  check ((kind='group' and member_id is null) or (kind='member' and member_id is not null))
);
alter table public.catalog_identity_contributions enable row level security;
revoke all on public.catalog_identity_contributions from public, anon, authenticated;
grant select on public.catalog_identity_contributions to authenticated;
create policy catalog_identity_contributions_read_own on public.catalog_identity_contributions
for select to authenticated using (contributor_user_id=(select public.current_seoully_user_id()));

create function public.contribute_catalog_identity(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public.current_seoully_user_id();
  v_key uuid;
  v_group uuid;
  v_member uuid;
  v_kind text := p_payload->>'kind';
  v_name text := p_payload->>'name';
  v_normalized text;
  v_slug text;
  v_request jsonb;
  v_existing public.catalog_identity_contributions%rowtype;
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null or v_user is null or not exists(select 1 from public.users where id=v_user and status='active') then
    raise exception 'unauthenticated' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('submissionId','kind','name','groupId'))
    or jsonb_typeof(p_payload->'name') is distinct from 'string' or v_kind is null or v_kind not in ('group','member')
    or char_length(v_name) not between 1 and 120 or trim(v_name)='' then
    raise exception 'invalid identity contribution' using errcode='22023';
  end if;
  begin
    v_key := (p_payload->>'submissionId')::uuid;
    if v_kind='member' then v_group := (p_payload->>'groupId')::uuid; end if;
  exception when invalid_text_representation then raise exception 'invalid submission identity' using errcode='22023'; end;
  if v_key is null or (v_kind='member' and v_group is null) or (v_kind='group' and p_payload ? 'groupId') then
    raise exception 'submission identity required' using errcode='22023';
  end if;
  v_request := jsonb_build_object('kind',v_kind,'name',v_name,'groupId',v_group);
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':'||v_key::text,0));
  select * into v_existing from public.catalog_identity_contributions where contributor_user_id=v_user and submission_id=v_key;
  if found then
    if v_existing.request<>v_request then raise exception 'submission details changed' using errcode='22023'; end if;
    return jsonb_build_object('id',v_existing.id,'groupId',v_existing.group_id,'memberId',v_existing.member_id,'submittedName',v_existing.submitted_name);
  end if;
  v_normalized := public.catalog_normalize(normalize(v_name,NFKC));
  if v_kind='group' then
    v_slug := trim(both '-' from regexp_replace(v_normalized,'[^a-z0-9_-]+','-','g'));
    if v_slug='' or char_length(v_slug)>64 then v_slug:='artist-'||md5(v_normalized); end if;
    if char_length(v_slug)<2 then v_slug:='artist-'||v_slug; end if;
    insert into public.catalog_groups(slug,name,status) values(v_slug,v_name,'community') on conflict(slug) do nothing;
    select id,status into v_group,v_status from public.catalog_groups where slug=v_slug;
    if v_status='restricted' then raise exception 'group unavailable' using errcode='42501'; end if;
  else
    select status into v_status from public.catalog_groups where id=v_group;
    if v_status is null or v_status='restricted' then raise exception 'group unavailable' using errcode='42501'; end if;
    insert into public.catalog_members(group_id,stage_name,normalized_name,status)
      values(v_group,v_name,v_normalized,'community') on conflict(group_id,normalized_name) do nothing;
    select id,status into v_member,v_status from public.catalog_members where group_id=v_group and normalized_name=v_normalized;
    if v_status='restricted' then raise exception 'member unavailable' using errcode='42501'; end if;
  end if;
  insert into public.catalog_identity_contributions(contributor_user_id,submission_id,kind,submitted_name,request,group_id,member_id)
    values(v_user,v_key,v_kind,v_name,v_request,v_group,v_member) returning id into v_id;
  return jsonb_build_object('id',v_id,'groupId',v_group,'memberId',v_member,'submittedName',v_name);
end;
$$;
revoke all on function public.contribute_catalog_identity(jsonb) from public, anon, service_role;
grant execute on function public.contribute_catalog_identity(jsonb) to authenticated;

create function public.profile_identity_capabilities() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('profileAvatar',true,'catalogIdentityContributions',true);
$$;
revoke all on function public.profile_identity_capabilities() from public, anon, service_role;
grant execute on function public.profile_identity_capabilities() to authenticated;
