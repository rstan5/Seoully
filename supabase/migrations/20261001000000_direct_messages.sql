-- Seoully communications: 1:1 DMs with post/template context, unread cursors, and in-app notices.
-- UNAPPLIED. Slice 5 revised this file before any production apply.
-- Do not apply without explicit human approval. Do not apply 20261002000000 from this slice.

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text not null unique,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.direct_conversation_participants (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_message_templates (
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  template_id uuid not null references public.collectible_templates(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (message_id, template_id)
);

create table if not exists public.social_notices (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'follow', 'trade', 'activity', 'repost')),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_user_id <> actor_user_id)
);

create table if not exists public.social_notice_templates (
  notice_id uuid not null references public.social_notices(id) on delete cascade,
  template_id uuid not null references public.collectible_templates(id) on delete restrict,
  primary key (notice_id, template_id)
);

create index if not exists direct_participants_user_idx
  on public.direct_conversation_participants (user_id, joined_at desc, conversation_id);
create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at asc, id asc);
create index if not exists social_notices_recipient_idx
  on public.social_notices (recipient_user_id, created_at desc, id desc);

create unique index if not exists social_notices_like_idx
  on public.social_notices (recipient_user_id, actor_user_id, post_id)
  where kind = 'like' and post_id is not null;
create unique index if not exists social_notices_comment_idx
  on public.social_notices (comment_id)
  where kind = 'comment' and comment_id is not null;
create unique index if not exists social_notices_follow_idx
  on public.social_notices (recipient_user_id, actor_user_id)
  where kind = 'follow';

create or replace function public.is_direct_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth as $$
  select exists (
    select 1 from public.direct_conversation_participants p
    where p.conversation_id = p_conversation_id
      and p.user_id = public.current_seoully_user_id()
  );
$$;

create or replace function public.ensure_direct_conversation(p_peer_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth as $$
declare
  actor uuid := public.current_seoully_user_id();
  v_conversation_id uuid;
  pair_key text;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  if p_peer_user_id is null or p_peer_user_id = actor then raise exception 'invalid_peer'; end if;
  if not exists (select 1 from public.profiles where user_id = p_peer_user_id) then
    raise exception 'collector_not_found';
  end if;
  pair_key := least(actor::text, p_peer_user_id::text) || ':' || greatest(actor::text, p_peer_user_id::text);
  insert into public.direct_conversations (direct_key, created_by_user_id)
  values (pair_key, actor)
  on conflict (direct_key) do update set updated_at = now()
  returning id into v_conversation_id;
  insert into public.direct_conversation_participants (conversation_id, user_id, last_read_at)
  values (v_conversation_id, actor, now())
  on conflict (conversation_id, user_id) do nothing;
  insert into public.direct_conversation_participants (conversation_id, user_id, last_read_at)
  values (v_conversation_id, p_peer_user_id, null)
  on conflict (conversation_id, user_id) do nothing;
  return v_conversation_id;
end;
$$;

create or replace function public.mark_direct_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth as $$
declare
  actor uuid := public.current_seoully_user_id();
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  if not public.is_direct_conversation_participant(p_conversation_id) then raise exception 'conversation_forbidden'; end if;
  update public.direct_conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = actor;
end;
$$;

create or replace function public.emit_social_notice_like(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth as $$
declare
  actor uuid := public.current_seoully_user_id();
  author uuid;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  select author_user_id into author from public.posts where id = p_post_id;
  if author is null or author = actor then return; end if;
  if not exists (select 1 from public.post_likes where post_id = p_post_id and user_id = actor) then return; end if;
  insert into public.social_notices (recipient_user_id, actor_user_id, kind, post_id)
  values (author, actor, 'like', p_post_id)
  on conflict do nothing;
end;
$$;

create or replace function public.emit_social_notice_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth as $$
declare
  actor uuid := public.current_seoully_user_id();
  author uuid;
  v_post uuid;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  select c.post_id, p.author_user_id into v_post, author
  from public.post_comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment_id and c.author_user_id = actor;
  if author is null or author = actor then return; end if;
  insert into public.social_notices (recipient_user_id, actor_user_id, kind, post_id, comment_id)
  values (author, actor, 'comment', v_post, p_comment_id)
  on conflict do nothing;
end;
$$;

create or replace function public.emit_social_notice_follow(p_followee_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth as $$
declare
  actor uuid := public.current_seoully_user_id();
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  if p_followee_user_id is null or p_followee_user_id = actor then return; end if;
  if not exists (
    select 1 from public.follows
    where follower_user_id = actor and followed_user_id = p_followee_user_id
  ) then return; end if;
  insert into public.social_notices (recipient_user_id, actor_user_id, kind)
  values (p_followee_user_id, actor, 'follow')
  on conflict do nothing;
end;
$$;

revoke all on function public.is_direct_conversation_participant(uuid) from public, anon;
revoke all on function public.ensure_direct_conversation(uuid) from public, anon;
revoke all on function public.mark_direct_conversation_read(uuid) from public, anon;
revoke all on function public.emit_social_notice_like(uuid) from public, anon;
revoke all on function public.emit_social_notice_comment(uuid) from public, anon;
revoke all on function public.emit_social_notice_follow(uuid) from public, anon;
grant execute on function public.is_direct_conversation_participant(uuid) to authenticated;
grant execute on function public.ensure_direct_conversation(uuid) to authenticated;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;
grant execute on function public.emit_social_notice_like(uuid) to authenticated;
grant execute on function public.emit_social_notice_comment(uuid) to authenticated;
grant execute on function public.emit_social_notice_follow(uuid) to authenticated;

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_participants enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_templates enable row level security;
alter table public.social_notices enable row level security;
alter table public.social_notice_templates enable row level security;

revoke all on public.direct_conversations, public.direct_conversation_participants, public.direct_messages, public.direct_message_templates, public.social_notices, public.social_notice_templates from anon, authenticated;
grant select on public.direct_conversations, public.direct_conversation_participants, public.direct_messages, public.direct_message_templates, public.social_notices, public.social_notice_templates to authenticated;
grant insert on public.direct_messages, public.direct_message_templates to authenticated;
grant update (last_read_at) on public.direct_conversation_participants to authenticated;
grant update (read_at) on public.social_notices to authenticated;

drop policy if exists direct_conversations_select_participant on public.direct_conversations;
create policy direct_conversations_select_participant on public.direct_conversations
for select to authenticated
using (public.is_direct_conversation_participant(id));

drop policy if exists direct_participants_select_participant on public.direct_conversation_participants;
create policy direct_participants_select_participant on public.direct_conversation_participants
for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));

drop policy if exists direct_participants_update_self on public.direct_conversation_participants;
create policy direct_participants_update_self on public.direct_conversation_participants
for update to authenticated
using (user_id = public.current_seoully_user_id())
with check (user_id = public.current_seoully_user_id());

drop policy if exists direct_messages_select_participant on public.direct_messages;
create policy direct_messages_select_participant on public.direct_messages
for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));

drop policy if exists direct_messages_insert_participant on public.direct_messages;
create policy direct_messages_insert_participant on public.direct_messages
for insert to authenticated
with check (
  sender_user_id = public.current_seoully_user_id()
  and public.is_direct_conversation_participant(conversation_id)
  and (
    post_id is null
    or exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.visibility = 'public'
    )
  )
);

drop policy if exists direct_message_templates_select_participant on public.direct_message_templates;
create policy direct_message_templates_select_participant on public.direct_message_templates
for select to authenticated
using (
  exists (
    select 1 from public.direct_messages m
    where m.id = message_id and public.is_direct_conversation_participant(m.conversation_id)
  )
);

drop policy if exists direct_message_templates_insert_participant on public.direct_message_templates;
create policy direct_message_templates_insert_participant on public.direct_message_templates
for insert to authenticated
with check (
  exists (
    select 1 from public.direct_messages m
    where m.id = message_id
      and m.sender_user_id = public.current_seoully_user_id()
      and public.is_direct_conversation_participant(m.conversation_id)
  )
  and exists (
    select 1 from public.collectible_templates t
    where t.id = template_id and t.status <> 'restricted'
  )
);

drop policy if exists social_notices_select_recipient on public.social_notices;
create policy social_notices_select_recipient on public.social_notices
for select to authenticated
using (recipient_user_id = public.current_seoully_user_id());

drop policy if exists social_notices_update_recipient on public.social_notices;
create policy social_notices_update_recipient on public.social_notices
for update to authenticated
using (recipient_user_id = public.current_seoully_user_id())
with check (recipient_user_id = public.current_seoully_user_id());

drop policy if exists social_notice_templates_select_recipient on public.social_notice_templates;
create policy social_notice_templates_select_recipient on public.social_notice_templates
for select to authenticated
using (
  exists (
    select 1 from public.social_notices n
    where n.id = notice_id and n.recipient_user_id = public.current_seoully_user_id()
  )
);
