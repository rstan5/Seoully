-- Native Room V2: durable, owner-scoped visual theme preset.

alter table public.rooms
  add column if not exists theme_id text not null default 'hearth'
  check (theme_id in ('hearth', 'blossom', 'midnight'));

comment on column public.rooms.theme_id is
  'Validated visual preset shared by native Room renderers; writable only through existing owner RLS.';
