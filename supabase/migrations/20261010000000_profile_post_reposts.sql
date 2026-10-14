-- Profile-only references to originals. No copied posts, media, or feed entries.
create table public.post_reposts (
  reposter_user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reposter_user_id, post_id)
);
create index post_reposts_profile_created_idx on public.post_reposts (reposter_user_id, created_at desc, post_id desc);
create index post_reposts_post_idx on public.post_reposts (post_id);
alter table public.post_reposts enable row level security;
revoke all on public.post_reposts from public, anon, authenticated;
grant select, insert, delete on public.post_reposts to authenticated;
create policy post_reposts_visible on public.post_reposts for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and p.visibility = 'public')
  and exists (select 1 from public.profiles p where p.user_id = reposter_user_id)
);
create policy post_reposts_insert_self on public.post_reposts for insert to authenticated with check (
  reposter_user_id = (select public.current_seoully_user_id())
  and exists (select 1 from public.posts p where p.id = post_id and p.visibility = 'public' and p.author_user_id <> reposter_user_id)
);
create policy post_reposts_delete_self on public.post_reposts for delete to authenticated using (
  reposter_user_id = (select public.current_seoully_user_id())
);

-- Invoker: original posts/profiles remain subject to their existing RLS on every read.
-- Bounded combined timeline; cursor follows the profile event, not original publish time.
create function public.profile_post_timeline(p_user_id uuid, p_limit integer default 20, p_before timestamptz default null, p_before_id uuid default null)
returns table(post_id uuid, event_at timestamptz, reposted boolean)
language sql stable security invoker set search_path = pg_catalog as $$
  select t.post_id, t.event_at, t.reposted from (
    select p.id post_id, p.created_at event_at, false reposted
    from public.posts p where p.author_user_id = p_user_id and p.visibility = 'public'
    union all
    select r.post_id, r.created_at event_at, true reposted
    from public.post_reposts r join public.posts p on p.id = r.post_id
    where r.reposter_user_id = p_user_id and p.visibility = 'public'
  ) t
  where (select public.current_seoully_user_id()) is not null
    and exists (select 1 from public.profiles p where p.user_id = p_user_id)
    and (p_before is null or (t.event_at, t.post_id) < (p_before, p_before_id))
  order by t.event_at desc, t.post_id desc limit greatest(1, least(coalesce(p_limit, 20), 26));
$$;
revoke all on function public.profile_post_timeline(uuid,integer,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.profile_post_timeline(uuid,integer,timestamptz,uuid) to authenticated;
