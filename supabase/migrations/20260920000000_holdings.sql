-- Phase 11D: durable ownership. Wishlist, trade, RoomPlacement and Room stay local.

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  template_id uuid not null references public.collectible_templates(id) on delete restrict,
  acquired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists holdings_owner_created_idx on public.holdings (owner_user_id, created_at desc, id);
create index if not exists holdings_template_idx on public.holdings (template_id, created_at desc);

create or replace function public.touch_holdings_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists holdings_touch_updated_at on public.holdings;
create trigger holdings_touch_updated_at
before update on public.holdings
for each row execute function public.touch_holdings_updated_at();

alter table public.holdings enable row level security;
revoke all on public.holdings from anon, authenticated;
grant select, insert, delete on public.holdings to authenticated;

drop policy if exists holdings_select_own on public.holdings;
create policy holdings_select_own
on public.holdings for select to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists holdings_insert_own on public.holdings;
create policy holdings_insert_own
on public.holdings for insert to authenticated
with check (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists holdings_delete_own on public.holdings;
create policy holdings_delete_own
on public.holdings for delete to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));
