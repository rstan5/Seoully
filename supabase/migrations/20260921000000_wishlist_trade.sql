-- Phase 11E: durable wishlist intent and per-Holding trade availability.

alter table public.holdings
  add column if not exists trade_status text not null default 'not-for-trade'
  constraint holdings_trade_status_check check (trade_status in ('not-for-trade', 'for-trade'));

grant update on public.holdings to authenticated;

drop policy if exists holdings_update_own on public.holdings;
create policy holdings_update_own
on public.holdings for update to authenticated
using (owner_user_id = (select public.current_seoully_user_id()))
with check (owner_user_id = (select public.current_seoully_user_id()));

create table if not exists public.wishlist_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  template_id uuid not null references public.collectible_templates(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, template_id)
);

create index if not exists wishlist_entries_owner_created_idx
  on public.wishlist_entries (owner_user_id, created_at desc, id);
create index if not exists wishlist_entries_template_idx
  on public.wishlist_entries (template_id, created_at desc);

create or replace function public.touch_wishlist_entries_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists wishlist_entries_touch_updated_at on public.wishlist_entries;
create trigger wishlist_entries_touch_updated_at
before update on public.wishlist_entries
for each row execute function public.touch_wishlist_entries_updated_at();

alter table public.wishlist_entries enable row level security;
revoke all on public.wishlist_entries from anon, authenticated;
grant select, insert, delete on public.wishlist_entries to authenticated;

drop policy if exists wishlist_entries_select_own on public.wishlist_entries;
create policy wishlist_entries_select_own
on public.wishlist_entries for select to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists wishlist_entries_insert_own on public.wishlist_entries;
create policy wishlist_entries_insert_own
on public.wishlist_entries for insert to authenticated
with check (owner_user_id = (select public.current_seoully_user_id()));

drop policy if exists wishlist_entries_delete_own on public.wishlist_entries;
create policy wishlist_entries_delete_own
on public.wishlist_entries for delete to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));
