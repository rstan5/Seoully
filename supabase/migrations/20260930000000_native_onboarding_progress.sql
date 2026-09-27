-- Durable native onboarding progress.
--
-- Existing profiles predate the native flow and are treated as complete.
-- Profiles provisioned after this migration begin at the group-selection step.
-- The column is not client-selectable by user id: existing profile RLS still
-- restricts updates to the authenticated Seoully identity.

alter table public.profiles
  add column if not exists onboarding_step text not null default 'done'
    check (onboarding_step in ('group', 'bias', 'interest', 'done'));

alter table public.profiles
  alter column onboarding_step set default 'group';

grant update (onboarding_step) on public.profiles to authenticated;
