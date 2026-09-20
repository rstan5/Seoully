-- Phase 12B: derived compatibility and trade-intelligence facts.
-- No scores or trade matches are persisted; this RPC only returns a
-- privacy-filtered, bounded snapshot for server-side deterministic engines.

create or replace function public.graph_pair_snapshot(p_target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid := public.current_seoully_user_id();
  v_target_profile public.profiles%rowtype;
  v_actor_profile public.profiles%rowtype;
  v_target_collection_public boolean := false;
  v_target_wishlist_public boolean := false;
  v_actor_holdings jsonb := '[]'::jsonb;
  v_target_holdings jsonb := '[]'::jsonb;
  v_actor_wishlist jsonb := '[]'::jsonb;
  v_target_wishlist jsonb := '[]'::jsonb;
begin
  if v_actor_id is null or p_target_user_id is null or p_target_user_id = v_actor_id then
    return jsonb_build_object('target_user_id', p_target_user_id, 'visible', false);
  end if;

  select * into v_actor_profile from public.profiles where user_id = v_actor_id;
  select * into v_target_profile from public.profiles where user_id = p_target_user_id;
  if v_target_profile.user_id is null then
    return jsonb_build_object('target_user_id', p_target_user_id, 'visible', false);
  end if;

  v_target_collection_public := coalesce(v_target_profile.collection_public, false);
  v_target_wishlist_public := coalesce(v_target_profile.wishlist_public, false);

  select coalesce(jsonb_agg(jsonb_build_object(
    'holding_id', h.id,
    'template_id', t.id,
    'template_name', t.name,
    'group_id', t.group_id,
    'member_id', t.member_id,
    'release_id', t.release_id,
    'kind', t.kind,
    'trade_status', h.trade_status
  ) order by h.created_at, h.id), '[]'::jsonb)
  into v_actor_holdings
  from (
    select * from public.holdings where owner_user_id = v_actor_id order by created_at, id limit 500
  ) h
  join public.collectible_templates t on t.id = h.template_id;

  if v_target_collection_public then
    select coalesce(jsonb_agg(jsonb_build_object(
      'holding_id', h.id,
      'template_id', t.id,
      'template_name', t.name,
      'group_id', t.group_id,
      'member_id', t.member_id,
      'release_id', t.release_id,
      'kind', t.kind,
      'trade_status', h.trade_status
    ) order by h.created_at, h.id), '[]'::jsonb)
    into v_target_holdings
    from (
      select * from public.holdings where owner_user_id = p_target_user_id order by created_at, id limit 500
    ) h
    join public.collectible_templates t on t.id = h.template_id;
  end if;

  select coalesce(jsonb_agg(w.template_id order by w.created_at, w.template_id), '[]'::jsonb)
  into v_actor_wishlist
  from (
    select template_id, created_at from public.wishlist_entries where owner_user_id = v_actor_id order by created_at, template_id limit 500
  ) w;

  if v_target_wishlist_public then
    select coalesce(jsonb_agg(w.template_id order by w.created_at, w.template_id), '[]'::jsonb)
    into v_target_wishlist
    from (
      select template_id, created_at from public.wishlist_entries where owner_user_id = p_target_user_id order by created_at, template_id limit 500
    ) w;
  end if;

  return jsonb_build_object(
    'target_user_id', p_target_user_id,
    'visible', true,
    'target_collection_public', v_target_collection_public,
    'target_wishlist_public', v_target_wishlist_public,
    'actor', jsonb_build_object(
      'user_id', v_actor_id,
      'holdings', v_actor_holdings,
      'wishlist_template_ids', v_actor_wishlist,
      'favorite_group_ids', coalesce(to_jsonb(v_actor_profile.favorite_group_ids), '[]'::jsonb),
      'bias_member_ids', coalesce(to_jsonb(v_actor_profile.bias_member_ids), '[]'::jsonb),
      'favorite_era_ids', coalesce(to_jsonb(v_actor_profile.favorite_era_ids), '[]'::jsonb),
      'collector_interests', coalesce(to_jsonb(v_actor_profile.collector_interests), '[]'::jsonb)
    ),
    'target', jsonb_build_object(
      'user_id', p_target_user_id,
      'holdings', v_target_holdings,
      'wishlist_template_ids', v_target_wishlist,
      'favorite_group_ids', case when v_target_collection_public then coalesce(to_jsonb(v_target_profile.favorite_group_ids), '[]'::jsonb) else '[]'::jsonb end,
      'bias_member_ids', case when v_target_collection_public then coalesce(to_jsonb(v_target_profile.bias_member_ids), '[]'::jsonb) else '[]'::jsonb end,
      'favorite_era_ids', case when v_target_collection_public then coalesce(to_jsonb(v_target_profile.favorite_era_ids), '[]'::jsonb) else '[]'::jsonb end,
      'collector_interests', case when v_target_collection_public then coalesce(to_jsonb(v_target_profile.collector_interests), '[]'::jsonb) else '[]'::jsonb end
    )
  );
end;
$$;

revoke all on function public.graph_pair_snapshot(uuid) from public, anon;
grant execute on function public.graph_pair_snapshot(uuid) to authenticated;
