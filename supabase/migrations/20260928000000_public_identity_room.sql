-- Phase 14: bounded, read-only public identity and Room projection.
-- The function exposes only placements in a public collection; it never grants
-- table access or mutation authority to visitors.
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

revoke all on function public.get_public_room_by_handle(text) from public;
grant execute on function public.get_public_room_by_handle(text) to authenticated;

create or replace function public.get_public_collection_summary(p_user_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select case when coalesce(p.collection_public, false) then jsonb_build_object(
    'holdingCount', count(h.id),
    'uniqueTemplateCount', count(distinct h.template_id),
    'groupCount', count(distinct ct.group_id)
  ) else null end
  from public.profiles p
  left join public.holdings h on h.owner_user_id = p.user_id
  left join public.collectible_templates ct on ct.id = h.template_id and ct.status <> 'restricted'
  where p.user_id = p_user_id
  group by p.collection_public;
$$;
revoke all on function public.get_public_collection_summary(uuid) from public;
grant execute on function public.get_public_collection_summary(uuid) to authenticated;

-- Keep collectible-media private. A visitor can read only an asset attached to
-- a holding currently displayed in a public Room.
create or replace function public.can_view_public_collectible_media(p_bucket text, p_path text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.media_assets ma
    join public.holdings h on h.id = ma.holding_id
    join public.room_placements rp on rp.holding_id = h.id
    join public.rooms r on r.id = rp.room_id and r.owner_user_id = h.owner_user_id
    join public.profiles p on p.user_id = h.owner_user_id and p.collection_public
    where ma.storage_bucket = p_bucket and ma.storage_path = p_path
  );
$$;
revoke all on function public.can_view_public_collectible_media(text, text) from public;
grant execute on function public.can_view_public_collectible_media(text, text) to authenticated;

drop policy if exists collectible_media_select_public_room on storage.objects;
create policy collectible_media_select_public_room on storage.objects for select to authenticated
using (
  bucket_id = 'collectible-media'
  and public.can_view_public_collectible_media(bucket_id, name)
);
