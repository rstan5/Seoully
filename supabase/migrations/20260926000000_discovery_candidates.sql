-- Phase 12C: bounded privacy-filtered discovery candidate batch.
-- Scores are intentionally not persisted.

create or replace function public.graph_discovery_candidates(p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
with actor_profile as (
  select p.* from public.profiles p where p.user_id = public.current_seoully_user_id()
), actor as (
  select jsonb_build_object(
    'user_id', p.user_id,
    'holdings', coalesce((select jsonb_agg(jsonb_build_object(
      'holding_id', h.id, 'template_id', t.id, 'template_name', t.name,
      'group_id', t.group_id, 'member_id', t.member_id, 'release_id', t.release_id,
      'kind', t.kind, 'trade_status', h.trade_status
    ) order by h.created_at, h.id) from (select * from public.holdings where owner_user_id = p.user_id order by created_at, id limit 500) h join public.collectible_templates t on t.id = h.template_id), '[]'::jsonb),
    'wishlist_template_ids', coalesce((select jsonb_agg(w.template_id order by w.created_at, w.template_id) from (select template_id, created_at from public.wishlist_entries where owner_user_id = p.user_id order by created_at, template_id limit 500) w), '[]'::jsonb),
    'favorite_group_ids', coalesce(to_jsonb(p.favorite_group_ids), '[]'::jsonb),
    'bias_member_ids', coalesce(to_jsonb(p.bias_member_ids), '[]'::jsonb),
    'favorite_era_ids', coalesce(to_jsonb(p.favorite_era_ids), '[]'::jsonb),
    'collector_interests', coalesce(to_jsonb(p.collector_interests), '[]'::jsonb)
  ) as data from actor_profile p
), candidates as (
  select p.* from public.profiles p
  where p.user_id <> public.current_seoully_user_id()
    and p.collection_public
  order by p.display_name, p.user_id
  limit least(greatest(coalesce(p_limit, 100), 1), 100)
), candidate_rows as (
  select jsonb_build_object(
    'user_id', p.user_id,
    'handle', p.handle,
    'display_name', p.display_name,
    'collection_public', p.collection_public,
    'wishlist_public', p.wishlist_public,
    'holdings', coalesce((select jsonb_agg(jsonb_build_object(
      'holding_id', h.id, 'template_id', t.id, 'template_name', t.name,
      'group_id', t.group_id, 'member_id', t.member_id, 'release_id', t.release_id,
      'kind', t.kind, 'trade_status', h.trade_status
    ) order by h.created_at, h.id) from (select * from public.holdings where owner_user_id = p.user_id order by created_at, id limit 500) h join public.collectible_templates t on t.id = h.template_id), '[]'::jsonb),
    'wishlist_template_ids', case when p.wishlist_public then coalesce((select jsonb_agg(w.template_id order by w.created_at, w.template_id) from (select template_id, created_at from public.wishlist_entries where owner_user_id = p.user_id order by created_at, template_id limit 500) w), '[]'::jsonb) else '[]'::jsonb end,
    'favorite_group_ids', coalesce(to_jsonb(p.favorite_group_ids), '[]'::jsonb),
    'bias_member_ids', coalesce(to_jsonb(p.bias_member_ids), '[]'::jsonb),
    'favorite_era_ids', coalesce(to_jsonb(p.favorite_era_ids), '[]'::jsonb),
    'collector_interests', coalesce(to_jsonb(p.collector_interests), '[]'::jsonb),
    'room', (select jsonb_build_object('room_id', r.id, 'displayed_holding_count', count(rp.id)) from public.rooms r left join public.room_placements rp on rp.room_id = r.id where r.owner_user_id = p.user_id group by r.id order by r.id limit 1)
  ) as data
  from candidates p
)
select jsonb_build_object(
  'actor', coalesce((select data from actor), '{}'::jsonb),
  'candidates', coalesce((select jsonb_agg(data order by data->>'display_name') from candidate_rows), '[]'::jsonb)
);
$$;

revoke all on function public.graph_discovery_candidates(integer) from public, anon;
grant execute on function public.graph_discovery_candidates(integer) to authenticated;
