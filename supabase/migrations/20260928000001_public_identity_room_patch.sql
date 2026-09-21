-- Phase 14 follow-up: complete public summary and media authorization helpers.
create or replace function public.get_public_collection_summary(p_user_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select case when coalesce(p.collection_public, false) then jsonb_build_object(
    'holdingCount', count(h.id), 'uniqueTemplateCount', count(distinct h.template_id), 'groupCount', count(distinct ct.group_id)
  ) else null end
  from public.profiles p
  left join public.holdings h on h.owner_user_id = p.user_id
  left join public.collectible_templates ct on ct.id = h.template_id and ct.status <> 'restricted'
  where p.user_id = p_user_id group by p.collection_public;
$$;
revoke all on function public.get_public_collection_summary(uuid) from public;
grant execute on function public.get_public_collection_summary(uuid) to authenticated;

create or replace function public.can_view_public_collectible_media(p_bucket text, p_path text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.media_assets ma
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
using (bucket_id = 'collectible-media' and public.can_view_public_collectible_media(bucket_id, name));
