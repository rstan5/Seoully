-- Phase 12A: visibility seams and derived collection graph queries.

alter table public.profiles
  add column if not exists collection_public boolean not null default true,
  add column if not exists wishlist_public boolean not null default false;

grant update (collection_public, wishlist_public) on public.profiles to authenticated;

create or replace function public.graph_owners_of_template(p_template_id uuid, p_limit integer default 50, p_offset integer default 0)
returns table(user_id uuid, handle text, display_name text, holding_count bigint, for_trade_count bigint)
language sql stable security definer set search_path = pg_catalog, public, auth as $$
  select p.user_id, p.handle, p.display_name, count(h.id), count(*) filter (where h.trade_status = 'for-trade')
  from public.holdings h join public.profiles p on p.user_id = h.owner_user_id
  where h.template_id = p_template_id and p.collection_public and h.owner_user_id <> public.current_seoully_user_id()
  group by p.user_id, p.handle, p.display_name
  order by p.display_name, p.user_id
  limit least(greatest(coalesce(p_limit, 50), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.graph_wanters_of_template(p_template_id uuid, p_limit integer default 50, p_offset integer default 0)
returns table(user_id uuid, handle text, display_name text)
language sql stable security definer set search_path = pg_catalog, public, auth as $$
  select p.user_id, p.handle, p.display_name
  from public.wishlist_entries w join public.profiles p on p.user_id = w.owner_user_id
  where w.template_id = p_template_id and p.wishlist_public and w.owner_user_id <> public.current_seoully_user_id()
  order by p.display_name, p.user_id
  limit least(greatest(coalesce(p_limit, 50), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.graph_owners_of_my_wishlist(p_limit integer default 50, p_offset integer default 0)
returns table(user_id uuid, handle text, display_name text, template_id uuid, template_name text, holding_count bigint, for_trade_count bigint)
language sql stable security definer set search_path = pg_catalog, public, auth as $$
  select p.user_id, p.handle, p.display_name, t.id, t.name, count(h.id), count(*) filter (where h.trade_status = 'for-trade')
  from public.wishlist_entries w
  join public.collectible_templates t on t.id = w.template_id
  join public.holdings h on h.template_id = w.template_id and h.owner_user_id <> public.current_seoully_user_id()
  join public.profiles p on p.user_id = h.owner_user_id and p.collection_public
  where w.owner_user_id = public.current_seoully_user_id()
  group by p.user_id, p.handle, p.display_name, t.id, t.name
  order by p.display_name, t.name
  limit least(greatest(coalesce(p_limit, 50), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.graph_collectors_wanting_my_items(p_limit integer default 50, p_offset integer default 0)
returns table(user_id uuid, handle text, display_name text, template_id uuid, template_name text, holding_id uuid, trade_status text)
language sql stable security definer set search_path = pg_catalog, public, auth as $$
  select p.user_id, p.handle, p.display_name, t.id, t.name, h.id, h.trade_status
  from public.holdings h
  join public.collectible_templates t on t.id = h.template_id
  join public.wishlist_entries w on w.template_id = h.template_id and w.owner_user_id <> public.current_seoully_user_id()
  join public.profiles p on p.user_id = w.owner_user_id and p.wishlist_public
  where h.owner_user_id = public.current_seoully_user_id()
  order by p.display_name, t.name, h.id
  limit least(greatest(coalesce(p_limit, 50), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.graph_overlap(p_target_user_id uuid, p_limit integer default 100)
returns table(template_id uuid, group_id uuid, member_id uuid, release_id uuid)
language sql stable security definer set search_path = pg_catalog, public, auth as $$
  select distinct t.id, t.group_id, t.member_id, t.release_id
  from public.holdings mine
  join public.holdings theirs on theirs.template_id = mine.template_id and theirs.owner_user_id = p_target_user_id
  join public.collectible_templates t on t.id = mine.template_id
  join public.profiles target_profile on target_profile.user_id = p_target_user_id and target_profile.collection_public
  where mine.owner_user_id = public.current_seoully_user_id() and p_target_user_id <> public.current_seoully_user_id()
  order by t.id limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

revoke all on function public.graph_owners_of_template(uuid, integer, integer) from public, anon;
revoke all on function public.graph_wanters_of_template(uuid, integer, integer) from public, anon;
revoke all on function public.graph_owners_of_my_wishlist(integer, integer) from public, anon;
revoke all on function public.graph_collectors_wanting_my_items(integer, integer) from public, anon;
revoke all on function public.graph_overlap(uuid, integer) from public, anon;
grant execute on function public.graph_owners_of_template(uuid, integer, integer) to authenticated;
grant execute on function public.graph_wanters_of_template(uuid, integer, integer) to authenticated;
grant execute on function public.graph_owners_of_my_wishlist(integer, integer) to authenticated;
grant execute on function public.graph_collectors_wanting_my_items(integer, integer) to authenticated;
grant execute on function public.graph_overlap(uuid, integer) to authenticated;
