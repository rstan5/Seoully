-- Ordered once-only migration; apply via the Supabase transactional migration runner.
-- No explicit transaction control: preserve atomic statement/history batching.
-- Slice 7D: curated Room style (wall/floor/furniture/rug/light/brightness/binder).
-- Replaces the unapplied 20261002 theme_id preset. Owner RLS is unchanged.
-- Public visitors receive only this style object via the existing public Room RPC.

alter table public.rooms
  add column if not exists style jsonb not null default '{"wall":"plum","floor":"walnut","furniture":"walnut","rug":"rose","light":"warm","brightness":"normal","binder":"cream"}'::jsonb;

comment on column public.rooms.style is
  'Curated collector Room style. Owner write via existing rooms_update_own RLS. Public read only through get_public_room_by_handle.';

create or replace function public.room_style_is_valid(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path = pg_catalog as $$
declare k text;
begin
  if jsonb_typeof(p) is distinct from 'object' then return false; end if;
  if not (p ?& array['wall','floor','furniture','rug','light','brightness'])
    or p - array['wall','floor','furniture','rug','light','brightness','binder'] <> '{}'::jsonb then return false; end if;
  for k in select jsonb_object_keys(p) loop
    if jsonb_typeof(p->k) is distinct from 'string' then return false; end if;
  end loop;
  return p->>'wall' in ('plum','cream','ink','blush','sage')
    and p->>'floor' in ('walnut','oak','charcoal','blush-wood')
    and p->>'furniture' in ('walnut','oak','ink','blush')
    and p->>'rug' in ('rose','cream','ink','sage')
    and p->>'light' in ('warm','day','soft','night')
    and p->>'brightness' in ('dim','normal','bright')
    and (not (p ? 'binder') or p->>'binder' in ('cream','blush','lavender','sage','sky','cocoa','charcoal'));
end;
$$;

-- Pure allowlists: no table access and no privilege elevation.
create or replace function public.public_room_visual_style(p jsonb)
returns jsonb language sql immutable security invoker set search_path = pg_catalog as $$
  select case when public.room_style_is_valid(p) then jsonb_build_object(
    'wall', p->'wall', 'floor', p->'floor', 'furniture', p->'furniture',
    'rug', p->'rug', 'light', p->'light', 'brightness', p->'brightness',
    'binder', coalesce(p->'binder', '"cream"'::jsonb)
  ) else '{"wall":"plum","floor":"walnut","furniture":"walnut","rug":"rose","light":"warm","brightness":"normal","binder":"cream"}'::jsonb end;
$$;

create or replace function public.public_room_visual_transform(p jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = pg_catalog as $$
declare k text; result jsonb := '{}'::jsonb; v numeric;
begin
  if jsonb_typeof(p) is distinct from 'object' then return null; end if;
  foreach k in array array['x','y','z','rotateX','rotateY','rotateZ','scale'] loop
    if jsonb_typeof(p->k) = 'number' then
      v := (p->>k)::numeric;
      if (k in ('x','y','z') and v between -5000 and 5000)
        or (k in ('rotateX','rotateY','rotateZ') and v between -360 and 360)
        or (k = 'scale' and v between 0.05 and 10) then
        result := result || jsonb_build_object(k, p->k);
      end if;
    end if;
  end loop;
  return result;
end;
$$;

revoke all on function public.room_style_is_valid(jsonb), public.public_room_visual_style(jsonb), public.public_room_visual_transform(jsonb) from public, anon, authenticated;
grant execute on function public.room_style_is_valid(jsonb), public.public_room_visual_style(jsonb), public.public_room_visual_transform(jsonb) to authenticated, service_role;

alter table public.rooms drop constraint if exists rooms_style_valid;
alter table public.rooms add constraint rooms_style_valid check (public.room_style_is_valid(style));

-- Storage SELECT/signing still needs a definer boundary: viewer RLS intentionally
-- hides another collector's Holdings/MediaAssets. Return only an eligibility bit;
-- never use the server locator's service client for Storage signing.
-- Replace in 03 so projection, locator and signing authorization change atomically.
create or replace function public.can_view_public_collectible_media(p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(auth.uid() is not null
    and p_bucket = 'collectible-media'
    and p_path <> '' and p_path = btrim(p_path)
    and p_path !~ '(^/|//|/$|(^|/)\.{1,2}(/|$)|[[:cntrl:]])'
    and exists (
      select 1 from public.media_assets ma
      join public.holdings h on h.id = ma.holding_id and h.owner_user_id = ma.owner_user_id
      join public.rooms r on r.owner_user_id = h.owner_user_id
      join public.profiles p on p.user_id = r.owner_user_id and p.collection_public
      join public.collectible_templates ct on ct.id = h.template_id and ct.status <> 'restricted'
      where ma.storage_bucket = p_bucket and ma.storage_path = p_path
        and split_part(p_path, '/', 1) = ma.owner_user_id::text
        and exists (
          select 1 from (
            select placed.holding_id from public.room_placements placed
            join public.holdings owned on owned.id = placed.holding_id and owned.owner_user_id = r.owner_user_id
            join public.collectible_templates visible on visible.id = owned.template_id and visible.status <> 'restricted'
            where placed.room_id = r.id
            order by placed.updated_at desc, placed.id limit 500
          ) displayed where displayed.holding_id = h.id
        )
    ), false);
$$;
revoke all on function public.can_view_public_collectible_media(text, text) from public, anon, authenticated, service_role;
grant execute on function public.can_view_public_collectible_media(text, text) to authenticated;


-- Server-only locator. SECURITY INVOKER: no definer/RLS escape hatch for clients.
-- service_role is already privileged; SQL still limits it to currently public,
-- displayed, eligible media. The server signs with the VIEWER client/storage RLS.
create or replace function public.get_public_room_media_locations(p_room_id uuid, p_placement_ids uuid[])
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('placementId', rp.id,
    'bucket', ma.storage_bucket, 'path', ma.storage_path) order by rp.updated_at desc, rp.id), '[]'::jsonb)
  from (
    select rp.* from public.room_placements rp
    join public.rooms r on r.id = rp.room_id
    join public.profiles p on p.user_id = r.owner_user_id and p.collection_public
    join public.holdings h on h.id = rp.holding_id and h.owner_user_id = r.owner_user_id
    join public.collectible_templates ct on ct.id = h.template_id and ct.status <> 'restricted'
    where r.id = p_room_id and cardinality(p_placement_ids) between 1 and 500
    order by rp.updated_at desc, rp.id limit 500
  ) rp
  join public.rooms r on r.id = rp.room_id
  join public.media_assets ma on ma.holding_id = rp.holding_id and ma.owner_user_id = r.owner_user_id
    and ma.storage_bucket = 'collectible-media'
  where rp.id = any(p_placement_ids);
$$;
revoke all on function public.get_public_room_media_locations(uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.get_public_room_media_locations(uuid, uuid[]) to service_role;

create or replace function public.get_public_room_by_handle(p_handle text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select case when p.user_id is null then null else jsonb_build_object(
    'owner', jsonb_build_object(
      'userId', p.user_id,
      'handle', p.handle,
      'displayName', p.display_name
    ),
    'room', case when p.collection_public and r.id is not null then jsonb_build_object(
      'id', r.id,
      'style', public.public_room_visual_style(r.style),
      'placements', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', rp.id,
          'zoneId', rp.zone_id,
          'slot', rp.slot,
          'offset', public.public_room_visual_transform(rp.spatial_offset),
          'transform', public.public_room_visual_transform(rp.transform),
          'surfaceId', rp.surface_id,
          'holding', jsonb_build_object(
            'templateId', h.template_id,
            'tradeStatus', h.trade_status,
            'template', jsonb_build_object(
              'id', ct.id,
              'name', ct.name,
              'kind', ct.kind,
              'descriptor', ct.descriptor,
              'groupId', ct.group_id,
              'groupName', cg.name,
              'memberId', ct.member_id,
              'memberName', cm.stage_name,
              'releaseId', ct.release_id,
              'releaseName', cr.title
            ),
            'hasPersonalMedia', ma.id is not null
          )
        ) order by rp.updated_at desc, rp.id)
        from (
          select placed.* from public.room_placements placed
          join public.holdings owned on owned.id = placed.holding_id and owned.owner_user_id = p.user_id
          join public.collectible_templates visible on visible.id = owned.template_id and visible.status <> 'restricted'
          where placed.room_id = r.id
          order by placed.updated_at desc, placed.id limit 500
        ) rp
        join public.holdings h on h.id = rp.holding_id and h.owner_user_id = p.user_id
        join public.collectible_templates ct on ct.id = h.template_id and ct.status <> 'restricted'
        left join public.catalog_groups cg on cg.id = ct.group_id and cg.status <> 'restricted'
        left join public.catalog_members cm on cm.id = ct.member_id and cm.status <> 'restricted'
        left join public.catalog_releases cr on cr.id = ct.release_id and cr.status <> 'restricted'
        left join public.media_assets ma on ma.holding_id = h.id and ma.owner_user_id = p.user_id and ma.storage_bucket = 'collectible-media'
        where rp.room_id = r.id
      ), '[]'::jsonb)
    ) else null end,
    'private', not p.collection_public
  ) end
  from public.profiles p
  left join public.rooms r on r.owner_user_id = p.user_id
  where p.handle = lower(trim(both '@' from p_handle)) and auth.uid() is not null
  limit 1;
$$;

revoke all on function public.get_public_room_by_handle(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_room_by_handle(text) to authenticated;
