-- Keep catalog group slugs URL/search-safe while preserving display names.
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
begin
  if v_contributor is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if v_group_name = '' or v_group_slug = '' or v_name = '' or v_normalized_name = '' then raise exception 'catalog details required' using errcode = '22023'; end if;
  if v_kind not in ('photocard', 'album', 'vinyl', 'poster', 'lightstick', 'plushie', 'figure', 'book', 'apparel', 'memorabilia') then raise exception 'invalid collectible type' using errcode = '22023'; end if;
  if char_length(v_group_name) > 120 or char_length(v_name) > 200 or char_length(v_descriptor) > 300 then raise exception 'catalog text too long' using errcode = '22023'; end if;
  insert into public.catalog_groups (slug, name) values (v_group_slug, v_group_name)
    on conflict (slug) do update set name = excluded.name, updated_at = now() returning id into v_group_id;
  if v_member_name <> '' then
    insert into public.catalog_members (group_id, stage_name, normalized_name) values (v_group_id, v_member_name, public.catalog_normalize(v_member_name))
      on conflict (group_id, normalized_name) do update set stage_name = excluded.stage_name, updated_at = now() returning id into v_member_id;
  end if;
  if v_release_name <> '' then
    insert into public.catalog_releases (group_id, title, normalized_title) values (v_group_id, v_release_name, public.catalog_normalize(v_release_name))
      on conflict (group_id, normalized_title) do update set title = excluded.title, updated_at = now() returning id into v_release_id;
  end if;
  v_identity_key := concat(v_group_id, '|', coalesce(v_member_id::text, ''), '|', coalesce(v_release_id::text, ''), '|', v_kind, '|', v_normalized_name, '|', public.catalog_normalize(v_descriptor));
  insert into public.collectible_templates (group_id, member_id, release_id, kind, name, normalized_name, descriptor, identity_key, search_text)
    values (v_group_id, v_member_id, v_release_id, v_kind, v_name, v_normalized_name, v_descriptor, v_identity_key, concat_ws(' ', v_group_name, v_member_name, v_release_name, v_name, v_descriptor, v_kind))
    on conflict (identity_key) do update set updated_at = now() returning * into v_template;
  insert into public.catalog_contributions (template_id, contributor_user_id, source_metadata) values (v_template.id, v_contributor, p_payload);
  return jsonb_build_object('template', to_jsonb(v_template), 'contributor_user_id', v_contributor, 'created', true);
end;
$$;
revoke all on function public.create_catalog_contribution(jsonb) from public, anon, authenticated;
grant execute on function public.create_catalog_contribution(jsonb) to authenticated;
