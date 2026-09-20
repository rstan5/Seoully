-- Phase 11F: durable Rooms and collectible RoomPlacements.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_placements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  holding_id uuid not null unique references public.holdings(id) on delete cascade,
  zone_id text not null check (char_length(zone_id) between 1 and 160),
  slot integer not null default 0 check (slot between 0 and 10000),
  spatial_offset jsonb,
  transform jsonb,
  surface_id text check (surface_id is null or char_length(surface_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_owner_idx on public.rooms (owner_user_id);
create index if not exists room_placements_room_idx on public.room_placements (room_id, updated_at desc, id);
create index if not exists room_placements_holding_idx on public.room_placements (holding_id);

create or replace function public.touch_rooms_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at before update on public.rooms for each row execute function public.touch_rooms_updated_at();

create or replace function public.touch_room_placements_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists room_placements_touch_updated_at on public.room_placements;
create trigger room_placements_touch_updated_at before update on public.room_placements for each row execute function public.touch_room_placements_updated_at();

alter table public.rooms enable row level security;
alter table public.room_placements enable row level security;

revoke all on public.rooms, public.room_placements from anon, authenticated;
grant select, insert, update on public.rooms to authenticated;
grant select, insert, update, delete on public.room_placements to authenticated;

drop policy if exists rooms_select_own on public.rooms;
create policy rooms_select_own on public.rooms for select to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists rooms_insert_own on public.rooms;
create policy rooms_insert_own on public.rooms for insert to authenticated
with check (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists rooms_update_own on public.rooms;
create policy rooms_update_own on public.rooms for update to authenticated
using (owner_user_id = (select public.current_seoully_user_id()))
with check (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists room_placements_select_own on public.room_placements;
create policy room_placements_select_own on public.room_placements for select to authenticated
using (exists (
  select 1 from public.rooms r
  where r.id = room_placements.room_id
    and r.owner_user_id = (select public.current_seoully_user_id())
));

drop policy if exists room_placements_insert_own on public.room_placements;
create policy room_placements_insert_own on public.room_placements for insert to authenticated
with check (exists (
  select 1 from public.rooms r
  join public.holdings h on h.owner_user_id = r.owner_user_id
  where r.id = room_placements.room_id
    and h.id = room_placements.holding_id
    and r.owner_user_id = (select public.current_seoully_user_id())
));

drop policy if exists room_placements_update_own on public.room_placements;
create policy room_placements_update_own on public.room_placements for update to authenticated
using (exists (
  select 1 from public.rooms r where r.id = room_placements.room_id
    and r.owner_user_id = (select public.current_seoully_user_id())
))
with check (exists (
  select 1 from public.rooms r
  join public.holdings h on h.owner_user_id = r.owner_user_id
  where r.id = room_placements.room_id
    and h.id = room_placements.holding_id
    and r.owner_user_id = (select public.current_seoully_user_id())
));

drop policy if exists room_placements_delete_own on public.room_placements;
create policy room_placements_delete_own on public.room_placements for delete to authenticated
using (exists (
  select 1 from public.rooms r where r.id = room_placements.room_id
    and r.owner_user_id = (select public.current_seoully_user_id())
));
