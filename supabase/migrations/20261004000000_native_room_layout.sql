-- Slice 7D Repair 04: basic Room object instances + first-room-edit completion.
-- Empty {} is legacy furnished Room with first Room edit already complete.
-- New rooms insert an authored starter document (Shelf + Lamp only).
-- Owner RLS is unchanged. Public visitors receive only visual layout.

alter table public.rooms
  add column if not exists layout jsonb not null default '{}'::jsonb;

comment on column public.rooms.layout is
  'Placed Room objects and first-room-edit completion. Empty {} means a legacy furnished Room whose first edit is already complete. Owner write via existing rooms_update_own RLS. Public read only through get_public_room_by_handle.';

-- Repair 08: amended BEFORE application. No ownership or media is stored here.
create or replace function public.room_layout_is_valid(p jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare obj jsonb; config jsonb; slots jsonb; slot jsonb; ids text[];
begin
  if jsonb_typeof(p) is distinct from 'object' then return false; end if;
  if p = '{}'::jsonb then return true; end if;
  if p->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p->'objects') is distinct from 'array'
    or coalesce(p->>'firstRoomEditCompleted', 'false') not in ('true', 'false')
    or p ?| array['price','sku','currency','purchase'] then return false; end if;
  if jsonb_array_length(p->'objects') not between 1 and 24 then return false; end if;
  for obj in select value from jsonb_array_elements(p->'objects') loop
    if jsonb_typeof(obj) is distinct from 'object'
      or coalesce(obj->>'id', '') = ''
      or coalesce(obj->>'kind', '') not in ('shelf', 'desk', 'case', 'chair', 'lamp', 'plant', 'rug', 'archive', 'wall-frame', 'photo-string')
      or coalesce(obj->>'rotateY', '0') not in ('0','90','180','270') then return false; end if;
    if obj ? 'photoString' then
      if obj->>'kind' <> 'photo-string' then return false; end if;
      config := obj->'photoString';
      if jsonb_typeof(config) is distinct from 'object' then return false; end if;
      if (select count(*) from jsonb_object_keys(config)) <> 1
        or jsonb_typeof(config->'slots') is distinct from 'array' then return false; end if;
      slots := config->'slots';
      if jsonb_array_length(slots) <> 5 then return false; end if;
      ids := array[]::text[];
      for slot in select value from jsonb_array_elements(slots) loop
        if slot = 'null'::jsonb then continue; end if;
        if jsonb_typeof(slot) <> 'string' or (slot #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or lower(slot #>> '{}') = any(ids) then return false; end if;
        ids := array_append(ids, lower(slot #>> '{}'));
      end loop;
    end if;
  end loop;
  return true;
end;
$$;

-- Existing owner RLS remains authoritative. Also guards direct REST layout writes.
create or replace function public.validate_room_photo_string_holdings()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
declare obj jsonb; slot jsonb;
begin
  if not public.room_layout_is_valid(new.layout) then
    raise exception 'room_layout_invalid' using errcode = '23514';
  end if;
  for obj in select value from jsonb_array_elements(coalesce(new.layout->'objects', '[]'::jsonb)) loop
    for slot in select value from jsonb_array_elements(coalesce(obj->'photoString'->'slots', '[]'::jsonb)) loop
      if slot = 'null'::jsonb then continue; end if;
      if not exists (
        select 1 from public.holdings h join public.collectible_templates ct on ct.id = h.template_id
        where h.id = (slot #>> '{}')::uuid and h.owner_user_id = new.owner_user_id
          and ct.kind = 'photocard' and ct.status <> 'restricted'
      ) then raise exception 'photo_string_holding_ineligible' using errcode = '23514'; end if;
    end loop;
  end loop;
  return new;
end;
$$;
drop trigger if exists rooms_validate_photo_string on public.rooms;
create trigger rooms_validate_photo_string before insert or update of layout, owner_user_id on public.rooms
for each row execute function public.validate_room_photo_string_holdings();

-- Public geometry allowlist. Never return owner Holding IDs/configuration wholesale.
create or replace function public.public_room_visual_layout(p jsonb)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select case when p = '{}'::jsonb then p else jsonb_build_object(
    'version', 1, 'firstRoomEditCompleted', true,
    'objects', coalesce((select jsonb_agg(jsonb_build_object(
      'id', obj->'id', 'kind', obj->'kind', 'x', obj->'x', 'y', obj->'y', 'z', obj->'z', 'rotateY', obj->'rotateY'
    )) from jsonb_array_elements(coalesce(p->'objects', '[]'::jsonb)) obj), '[]'::jsonb)
  ) end;
$$;

alter table public.rooms drop constraint if exists rooms_layout_valid;
alter table public.rooms add constraint rooms_layout_valid check (public.room_layout_is_valid(layout));

create or replace function public.get_public_room_by_handle(p_handle text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when p.user_id is null then null else jsonb_build_object(
    'owner', jsonb_build_object(
      'userId', p.user_id,
      'handle', p.handle,
      'displayName', p.display_name
    ),
    'room', case when p.collection_public then jsonb_build_object(
      'id', r.id,
      'style', coalesce(r.style, '{"wall":"plum","floor":"walnut","furniture":"walnut","rug":"rose","light":"warm","brightness":"normal"}'::jsonb),
       'layout', public.public_room_visual_layout(coalesce(r.layout, '{}'::jsonb)),
      -- Safe catalog identity only. Personal crops/storage paths are intentionally absent.
      'photoStringCards', coalesce((
        select jsonb_agg(jsonb_build_object(
          'objectId', obj->>'id', 'slot', chosen.ordinality - 1,
          'templateId', ct.id,
          'template', jsonb_build_object('id', ct.id, 'kind', ct.kind, 'name', ct.name,
            'descriptor', ct.descriptor, 'status', ct.status, 'groupId', ct.group_id,
            'memberId', ct.member_id, 'releaseId', ct.release_id)
        ))
        from jsonb_array_elements(coalesce(r.layout->'objects', '[]'::jsonb)) obj
        cross join lateral jsonb_array_elements(coalesce(obj->'photoString'->'slots', '[]'::jsonb)) with ordinality chosen(value, ordinality)
        join public.holdings h on h.id::text = (chosen.value #>> '{}') and h.owner_user_id = p.user_id
        join public.collectible_templates ct on ct.id = h.template_id and ct.kind = 'photocard' and ct.status <> 'restricted'
        where obj->>'kind' = 'photo-string'
      ), '[]'::jsonb),
      'placements', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', rp.id,
          'zoneId', rp.zone_id,
          'slot', rp.slot,
          'offset', rp.spatial_offset,
          'transform', rp.transform,
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
            'mediaPath', ma.storage_path,
            'mediaBucket', ma.storage_bucket
          )
        ) order by rp.updated_at desc, rp.id)
        from public.room_placements rp
        join public.holdings h on h.id = rp.holding_id and h.owner_user_id = p.user_id
        join public.collectible_templates ct on ct.id = h.template_id and ct.status <> 'restricted'
        left join public.catalog_groups cg on cg.id = ct.group_id
        left join public.catalog_members cm on cm.id = ct.member_id
        left join public.catalog_releases cr on cr.id = ct.release_id
        left join public.media_assets ma on ma.holding_id = h.id
        where rp.room_id = r.id
        limit 500
      ), '[]'::jsonb)
    ) else null end,
    'private', not p.collection_public
  ) end
  from public.profiles p
  left join public.rooms r on r.owner_user_id = p.user_id
  where p.handle = lower(trim(both '@' from p_handle))
  limit 1;
$$;
