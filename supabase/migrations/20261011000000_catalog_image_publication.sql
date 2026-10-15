-- Valid authenticated stored reference images publish automatically: no moderator gate.
-- Publication is separate from ownership and contribution review status.
-- Historical identity keys, Holdings, media, placements and tags are untouched.
alter table public.collectible_templates add column publication_state text not null default 'draft'
  check (publication_state in ('draft','needs-media','published'));
update public.collectible_templates t set publication_state = case when exists (
 select 1 from public.catalog_reference_images r join storage.objects o on o.bucket_id=r.storage_bucket and o.name=r.storage_path
 where r.collectible_template_id=t.id and r.status='active' and r.storage_bucket='catalog-reference-images'
) then 'published' else 'needs-media' end;

create function public.guard_catalog_publication() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.publication_state='published' and not exists (
  select 1 from public.catalog_reference_images r join storage.objects o on o.bucket_id=r.storage_bucket and o.name=r.storage_path
  where r.collectible_template_id=new.id and r.status='active' and r.storage_bucket='catalog-reference-images'
    and r.mime_type in ('image/jpeg','image/png','image/webp') and r.byte_size>0
 ) then raise exception 'catalog_reference_required' using errcode='23514'; end if;
 return new;
end; $$;
create trigger collectible_templates_publication_guard before insert or update on public.collectible_templates
 for each row execute function public.guard_catalog_publication();

create function public.refresh_catalog_publication() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid;
begin
 for target in select distinct id from unnest(array[case when tg_op<>'INSERT' then old.collectible_template_id end, case when tg_op<>'DELETE' then new.collectible_template_id end]) id where id is not null loop
  update public.collectible_templates t set publication_state=case when exists (
   select 1 from public.catalog_reference_images r join storage.objects o on o.bucket_id=r.storage_bucket and o.name=r.storage_path
   where r.collectible_template_id=target and r.status='active' and r.storage_bucket='catalog-reference-images'
  ) then 'published' when t.publication_state='draft' then 'draft' else 'needs-media' end where t.id=target;
 end loop;
 return null;
end; $$;
create trigger catalog_reference_publication after insert or update or delete on public.catalog_reference_images
 for each row execute function public.refresh_catalog_publication();
-- Removing the underlying Storage object cannot leave an image-less item published.
create function public.refresh_removed_catalog_object() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.bucket_id='catalog-reference-images' then
  update public.collectible_templates t set publication_state=case when t.publication_state='draft' then 'draft' else 'needs-media' end
  where exists(select 1 from public.catalog_reference_images r where r.collectible_template_id=t.id and r.storage_bucket=old.bucket_id and r.storage_path=old.name)
  and not exists(select 1 from public.catalog_reference_images r join storage.objects o on o.bucket_id=r.storage_bucket and o.name=r.storage_path where r.collectible_template_id=t.id and r.status='active');
 end if;
 return null;
end; $$;
create trigger removed_catalog_object_publication after delete on storage.objects for each row execute function public.refresh_removed_catalog_object();
revoke all on function public.guard_catalog_publication(), public.refresh_catalog_publication(), public.refresh_removed_catalog_object() from public,anon,authenticated;

-- Conservative typographic equivalence only. Editions/variant descriptors remain distinct.
create function public.catalog_identity_name(value text) returns text language sql immutable set search_path=pg_catalog as $$
 select regexp_replace(regexp_replace(lower(trim(translate(coalesce(value,''),'‘’“”–—',chr(39)||chr(39)||chr(34)||chr(34)||'--'))),'\s+',' ','g'),'\s*-\s*','-','g');
$$;
revoke all on function public.catalog_identity_name(text) from public,anon,authenticated;
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
  v_group_slug text := regexp_replace(public.catalog_normalize(p_payload ->> 'groupName'), '[^a-z0-9_-]+', '-', 'g');
  v_member_name text := trim(coalesce(p_payload ->> 'memberName', ''));
  v_release_name text := trim(coalesce(p_payload ->> 'releaseName', ''));
  v_kind text := public.catalog_normalize(p_payload ->> 'kind');
  v_name text := trim(coalesce(p_payload ->> 'name', ''));
  v_descriptor text := trim(coalesce(p_payload ->> 'descriptor', ''));
  v_normalized_name text := public.catalog_normalize(p_payload ->> 'name');
  v_identity_key text;
  v_key uuid;
  v_existing public.catalog_contributions%rowtype;
  v_payload jsonb := p_payload - 'submissionKey';
  v_result jsonb;
  v_created boolean := false;
begin
  if v_contributor is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid catalog payload' using errcode = '22023';
  end if;
  if p_payload ? 'submissionKey' then
    if jsonb_typeof(p_payload -> 'submissionKey') is distinct from 'string'
       or (p_payload ->> 'submissionKey') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid submission key' using errcode = '22023';
    end if;
    v_key := (p_payload ->> 'submissionKey')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_contributor::text || ':' || v_key::text, 0));
    select * into v_existing from public.catalog_contributions
      where contributor_user_id = v_contributor and submission_key = v_key;
    if found then
      if v_existing.source_metadata is distinct from v_payload then
        raise exception 'submission key reused with different details' using errcode = '22023';
      end if;
      return v_existing.submission_result;
    end if;
  end if;
  if v_group_name = '' or v_group_slug = '' or v_name = '' or v_normalized_name = '' then raise exception 'catalog details required' using errcode = '22023'; end if;
  if v_kind not in ('photocard', 'album', 'vinyl', 'poster', 'lightstick', 'plushie', 'figure', 'book', 'apparel', 'memorabilia') then raise exception 'invalid collectible type' using errcode = '22023'; end if;
  if char_length(v_group_name) > 120 or char_length(v_name) > 200 or char_length(v_descriptor) > 300 then raise exception 'catalog text too long' using errcode = '22023'; end if;
  insert into public.catalog_groups (slug, name) values (v_group_slug, v_group_name)
    on conflict (slug) do update set updated_at = now() returning id into v_group_id;
  if v_member_name <> '' then
    insert into public.catalog_members (group_id, stage_name, normalized_name) values (v_group_id, v_member_name, public.catalog_normalize(v_member_name))
      on conflict (group_id, normalized_name) do update set updated_at = now() returning id into v_member_id;
  end if;
  if v_release_name <> '' then
    insert into public.catalog_releases (group_id, title, normalized_title) values (v_group_id, v_release_name, public.catalog_normalize(v_release_name))
      on conflict (group_id, normalized_title) do update set updated_at = now() returning id into v_release_id;
  end if;
  v_identity_key := concat(v_group_id, '|', coalesce(v_member_id::text, ''), '|', coalesce(v_release_id::text, ''), '|', v_kind, '|', v_normalized_name, '|', public.catalog_normalize(v_descriptor));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(concat(v_group_id,'|',v_member_id,'|',v_release_id,'|',v_kind,'|',public.catalog_identity_name(v_name),'|',public.catalog_identity_name(v_descriptor)),0));
  if (select count(*) from public.collectible_templates t where t.group_id=v_group_id and t.member_id is not distinct from v_member_id and t.release_id is not distinct from v_release_id and t.kind=v_kind and public.catalog_identity_name(t.name)=public.catalog_identity_name(v_name) and public.catalog_identity_name(t.descriptor)=public.catalog_identity_name(v_descriptor)) > 1 then
    raise exception 'catalog_identity_ambiguous' using errcode='22023';
  end if;
  select * into v_template from public.collectible_templates t where t.group_id=v_group_id and t.member_id is not distinct from v_member_id and t.release_id is not distinct from v_release_id and t.kind=v_kind and public.catalog_identity_name(t.name)=public.catalog_identity_name(v_name) and public.catalog_identity_name(t.descriptor)=public.catalog_identity_name(v_descriptor);
  if not found then
  v_created := true;
  insert into public.collectible_templates (group_id, member_id, release_id, kind, name, normalized_name, descriptor, identity_key, search_text)
    values (v_group_id, v_member_id, v_release_id, v_kind, v_name, v_normalized_name, v_descriptor, v_identity_key, concat_ws(' ', v_group_name, v_member_name, v_release_name, v_name, v_descriptor, v_kind))
    on conflict (identity_key) do update set updated_at = now() returning * into v_template;
  end if;
  v_result := jsonb_build_object('template', to_jsonb(v_template), 'contributor_user_id', v_contributor, 'created', v_created);
  insert into public.catalog_contributions (template_id, contributor_user_id, source_metadata, submission_key, submission_result)
    values (v_template.id, v_contributor, v_payload, v_key, case when v_key is not null then v_result end);
  return v_result;
end;
$$;
revoke all on function public.create_catalog_contribution(jsonb) from public, anon, authenticated;
grant execute on function public.create_catalog_contribution(jsonb) to authenticated;

-- Existing copy owners may explicitly contribute a separate community image.
-- Private Holding photos are never copied or promoted automatically.
drop policy catalog_reference_images_insert_contributor on public.catalog_reference_images;
create policy catalog_reference_images_insert_contributor on public.catalog_reference_images for insert to authenticated with check (
 contributed_by_user_id=(select public.current_seoully_user_id()) and storage_bucket='catalog-reference-images'
 and storage_path like ((select public.current_seoully_user_id())::text || '/%')
 and (exists(select 1 from public.catalog_contributions c where c.template_id=collectible_template_id and c.contributor_user_id=contributed_by_user_id)
  or exists(select 1 from public.holdings h where h.template_id=collectible_template_id and h.owner_user_id=contributed_by_user_id))
);

-- Required by existing reference-image authorization; never expose submission payloads.
grant select (template_id, contributor_user_id) on public.catalog_contributions to authenticated;
create policy catalog_contributions_read_own on public.catalog_contributions for select to authenticated
 using(contributor_user_id=(select public.current_seoully_user_id()));
create index catalog_template_typographic_identity_idx on public.collectible_templates
 (group_id,member_id,release_id,kind,public.catalog_identity_name(name),public.catalog_identity_name(descriptor));

-- Legacy source keys can contain a local file URI. Never expose them in public reference reads.
revoke select on public.catalog_reference_images from authenticated;
grant select (id,collectible_template_id,storage_bucket,storage_path,contributed_by_user_id,source_type,status,mime_type,byte_size,created_at,updated_at) on public.catalog_reference_images to authenticated;
create function public.own_catalog_reference_retry(p_template_id uuid,p_source_key text)
returns table(id uuid,template_id uuid,contributed_by_user_id uuid,source_type text,status text,mime_type text,byte_size bigint,storage_bucket text,storage_path text,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $$
 select r.id,r.collectible_template_id,r.contributed_by_user_id,r.source_type,r.status,r.mime_type,r.byte_size,r.storage_bucket,r.storage_path,r.created_at
 from public.catalog_reference_images r
 where r.contributed_by_user_id=(select public.current_seoully_user_id()) and r.collectible_template_id=p_template_id
 and r.source_key=p_source_key and r.status='active' and char_length(p_source_key) between 1 and 160;
$$;
revoke all on function public.own_catalog_reference_retry(uuid,text) from public,anon,authenticated;
grant execute on function public.own_catalog_reference_retry(uuid,text) to authenticated;

-- New drafts are not public catalog entities, even through direct PostgREST reads.
-- Legacy missing-image templates remain readable so existing copies/tags stay usable.
drop policy collectible_templates_public_read on public.collectible_templates;
create policy collectible_templates_public_read on public.collectible_templates for select to anon,authenticated
 using(status<>'restricted' and publication_state in ('published','needs-media'));
create policy collectible_templates_draft_owner_read on public.collectible_templates for select to authenticated using (
 status<>'restricted' and publication_state='draft' and (
  exists(select 1 from public.catalog_contributions c where c.template_id=collectible_templates.id and c.contributor_user_id=(select public.current_seoully_user_id()))
  or exists(select 1 from public.holdings h where h.template_id=collectible_templates.id and h.owner_user_id=(select public.current_seoully_user_id()))
 )
);
