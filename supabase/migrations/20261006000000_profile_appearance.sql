-- Persist the existing ProfileThemeChoice; effective Room colors are not copied.
-- Fast constant default preserves existing identity fields and legacy callers.
alter table public.profiles
  add column appearance jsonb not null default '{"mode":"default"}'::jsonb;

alter table public.profiles add constraint profiles_appearance_valid check (
  coalesce(case when jsonb_typeof(appearance) = 'object' then
    (appearance - array['mode', 'background', 'primary', 'secondary', 'tint']::text[]) = '{}'::jsonb
    and appearance ->> 'mode' in ('default', 'custom', 'room-sync')
    and (not (appearance ? 'background') or appearance ->> 'background' in ('paper', 'warm-cream', 'soft-lavender', 'powder-pink', 'baby-blue', 'mint', 'peach', 'soft-gray', 'deep-navy', 'midnight-purple', 'dark-plum', 'charcoal'))
    and (not (appearance ? 'primary') or appearance ->> 'primary' in ('lavender', 'lilac', 'powder-pink', 'baby-blue', 'mint', 'peach', 'rose', 'periwinkle', 'plum', 'deep-blue', 'warm-cream', 'soft-lilac'))
    and (not (appearance ? 'secondary') or appearance ->> 'secondary' in ('lavender', 'lilac', 'powder-pink', 'baby-blue', 'mint', 'peach', 'rose', 'periwinkle', 'plum', 'deep-blue', 'warm-cream', 'soft-lilac'))
    and (not (appearance ? 'tint') or appearance ->> 'tint' in ('lavender', 'lilac', 'powder-pink', 'baby-blue', 'mint', 'peach', 'rose', 'periwinkle', 'plum', 'deep-blue', 'warm-cream', 'soft-lilac'))
  else false end, false)
);

-- Existing profiles_update_own RLS remains authoritative; no new RPC or policy.
grant update (appearance) on public.profiles to authenticated;
