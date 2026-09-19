begin;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase11a@example.test', 'test-only', now(), '{}'::jsonb, '{"handle":"phase11a","display_name":"Account A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase11b@example.test', 'test-only', now(), '{}'::jsonb, '{"handle":"phase11b","display_name":"Account B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select is((select count(*)::int from public.users), 1, 'A can read only their internal account row');
select is((select count(*)::int from public.profiles where handle = 'phase11a'), 1, 'A can read their public profile');
update public.profiles set display_name = 'A updated' where handle = 'phase11a';
select is((select display_name from public.profiles where handle = 'phase11a'), 'A updated', 'A can update A');

select set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000002', true);
select is((select count(*)::int from public.users), 1, 'B can read only their internal account row');
select is((select count(*)::int from public.profiles where handle = 'phase11b'), 1, 'B can read their public profile');
with changed as (
  update public.profiles set display_name = 'cross-user attack'
  where handle = 'phase11a'
  returning 1
)
select is((select count(*)::int from changed), 0, 'B cannot update A through a tampered profile selector');
select is((select display_name from public.profiles where handle = 'phase11a'), 'A updated', 'A profile remains unchanged after B attack');

reset role;
set local role anon;
select ok(not pg_catalog.has_table_privilege('anon', 'public.users', 'select'), 'anonymous visitors cannot read private account rows');
select is((select count(*)::int from public.profiles), 2, 'anonymous visitors can read only the public profile projection');
select ok(not pg_catalog.has_column_privilege('anon', 'public.profiles', 'display_name', 'update'), 'anonymous visitors cannot update profiles');

select * from finish();
rollback;
