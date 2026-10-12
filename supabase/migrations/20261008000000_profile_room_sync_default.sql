-- Future collectors start synced to their Room. Existing explicit/legacy choices
-- are indistinguishable and MUST remain unchanged. No profile data is rewritten.
-- Auth trigger + authenticated ensure/provision path omit appearance on INSERT,
-- so native and web account creation both inherit this default.
alter table public.profiles
  alter column appearance set default '{"mode":"room-sync"}'::jsonb;
