-- Native/web production direct-message foundation.

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
  primary key (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2_000),
  created_at timestamptz not null default now()
);

create index if not exists direct_participants_user_idx
  on public.direct_conversation_participants (user_id, joined_at desc, conversation_id);
create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at asc, id asc);

create or replace function public.is_direct_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.direct_conversation_participants p
    where p.conversation_id = p_conversation_id
      and p.user_id = public.current_seoully_user_id()
  );
$$;

revoke all on function public.is_direct_conversation_participant(uuid) from public, anon;
grant execute on function public.is_direct_conversation_participant(uuid) to authenticated;

create or replace function public.ensure_direct_conversation(p_peer_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_conversation_id;
  insert into public.direct_conversation_participants (conversation_id, user_id)
  values (v_conversation_id, actor), (v_conversation_id, p_peer_user_id)
  on conflict do nothing;
  return v_conversation_id;
end;
$$;

revoke all on function public.ensure_direct_conversation(uuid) from public, anon;
grant execute on function public.ensure_direct_conversation(uuid) to authenticated;

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_participants enable row level security;
alter table public.direct_messages enable row level security;

revoke all on public.direct_conversations, public.direct_conversation_participants, public.direct_messages from anon, authenticated;
grant select on public.direct_conversations, public.direct_conversation_participants, public.direct_messages to authenticated;
grant insert on public.direct_messages to authenticated;

create policy direct_conversations_select_participant on public.direct_conversations
for select to authenticated
using (public.is_direct_conversation_participant(id));

create policy direct_participants_select_participant on public.direct_conversation_participants
for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));

create policy direct_messages_select_participant on public.direct_messages
for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));

create policy direct_messages_insert_participant on public.direct_messages
for insert to authenticated
with check (
  sender_user_id = public.current_seoully_user_id()
  and public.is_direct_conversation_participant(conversation_id)
);
