-- Slice 7D Repair 04: basic Room object instances + first-room-edit completion.
-- Empty {} is legacy furnished Room with first Room edit already complete.
-- New rooms insert an authored starter document (Shelf + Lamp only).
-- Owner RLS is unchanged. Public visitors receive only visual layout.

alter table public.rooms
  add column if not exists layout jsonb not null default '{}'::jsonb;

comment on column public.rooms.layout is
  'Placed Room objects and first-room-edit completion. Empty {} means a legacy furnished Room whose first edit is already complete. Owner write via existing rooms_update_own RLS. Public read only through get_public_room_by_handle.';

create or replace function public.room_layout_is_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    jsonb_typeof(p) = 'object'
    and (
      p = '{}'::jsonb
      or (
        coalesce((p->>'version')::int, 0) = 1
        and jsonb_typeof(coalesce(p->'objects', '[]'::jsonb)) = 'array'
        and jsonb_array_length(coalesce(p->'objects', '[]'::jsonb)) between 1 and 24
        and coalesce(p->>'firstRoomEditCompleted', 'false') in ('true', 'false')
        and not (p ? 'price' or p ? 'sku' or p ? 'currency' or p ? 'purchase')
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(p->'objects', '[]'::jsonb)) as obj
          where jsonb_typeof(obj) <> 'object'
            or coalesce(obj->>'id', '') = ''
            or coalesce(obj->>'kind', '') not in ('shelf', 'desk', 'case', 'lamp', 'plant', 'rug', 'archive', 'wall-frame')
            or coalesce(obj->>'rotateY', '0') not in ('0', '90', '180', '270')
        )
      )
    );
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
      'layout', coalesce(r.layout, '{}'::jsonb),
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
