-- Slice 7D: curated Room style (wall/floor/furniture/rug/light/brightness/binder).
-- Replaces the unapplied 20261002 theme_id preset. Owner RLS is unchanged.
-- Public visitors receive only this style object via the existing public Room RPC.

alter table public.rooms
  add column if not exists style jsonb not null default '{"wall":"plum","floor":"walnut","furniture":"walnut","rug":"rose","light":"warm","brightness":"normal","binder":"cream"}'::jsonb;

comment on column public.rooms.style is
  'Curated collector Room style. Owner write via existing rooms_update_own RLS. Public read only through get_public_room_by_handle.';

create or replace function public.room_style_is_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(p) = 'object'
    and coalesce(p->>'wall', '') in ('plum', 'cream', 'ink', 'blush', 'sage')
    and coalesce(p->>'floor', '') in ('walnut', 'oak', 'charcoal', 'blush-wood')
    and coalesce(p->>'furniture', '') in ('walnut', 'oak', 'ink', 'blush')
    and coalesce(p->>'rug', '') in ('rose', 'cream', 'ink', 'sage')
    and coalesce(p->>'light', '') in ('warm', 'day', 'soft', 'night')
    and coalesce(p->>'brightness', '') in ('dim', 'normal', 'bright')
    and (not (p ? 'binder') or (jsonb_typeof(p->'binder') = 'string' and p->>'binder' in ('cream','blush','lavender','sage','sky','cocoa','charcoal')));
$$;

alter table public.rooms drop constraint if exists rooms_style_valid;
alter table public.rooms add constraint rooms_style_valid check (public.room_style_is_valid(style));

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
      'style', coalesce(r.style, '{"wall":"plum","floor":"walnut","furniture":"walnut","rug":"rose","light":"warm","brightness":"normal","binder":"cream"}'::jsonb),
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
