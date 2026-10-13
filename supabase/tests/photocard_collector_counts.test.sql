begin;
select no_plan();
insert into auth.users(id,raw_user_meta_data) values
 ('a8090000-0000-4000-8000-000000000001','{"handle":"count_a","display_name":"A"}'),
 ('a8090000-0000-4000-8000-000000000002','{"handle":"count_b","display_name":"B"}'),
 ('a8090000-0000-4000-8000-000000000003','{"handle":"count_c","display_name":"C"}');
insert into public.catalog_groups(id,slug,name) values ('b8090000-0000-4000-8000-000000000001','count-group','Count Group');
insert into public.collectible_templates(id,group_id,kind,name,normalized_name,identity_key,descriptor,status) values
 ('c8090000-0000-4000-8000-000000000001','b8090000-0000-4000-8000-000000000001','photocard','One','one','count-one','','community'),
 ('c8090000-0000-4000-8000-000000000002','b8090000-0000-4000-8000-000000000001','photocard','Two','two','count-two','','community'),
 ('c8090000-0000-4000-8000-000000000003','b8090000-0000-4000-8000-000000000001','album','Album','album','count-album','','community'),
 ('c8090000-0000-4000-8000-000000000004','b8090000-0000-4000-8000-000000000001','photocard','Restricted','restricted','count-restricted','','restricted');
-- Duplicate physical copies count once; every live row is actual ownership.
insert into public.holdings(id,owner_user_id,template_id) select
 ('d8090000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 (select user_id from public.profiles where handle=case when n<3 then 'count_a' else 'count_b' end),
 'c8090000-0000-4000-8000-000000000001' from generate_series(1,3) n;
select ok(has_function_privilege('authenticated','public.get_photocard_collector_counts(uuid[])','execute'),'authenticated execution');
select ok(not has_function_privilege('anon','public.get_photocard_collector_counts(uuid[])','execute'),'no anon execution');
select ok(not has_function_privilege('service_role','public.get_photocard_collector_counts(uuid[])','execute'),'no service role execution');
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.get_photocard_collector_counts(uuid[])'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'no PUBLIC execution');
select ok((select prosecdef from pg_proc where oid='public.get_photocard_collector_counts(uuid[])'::regprocedure),'definer required only for aggregate across owner RLS');
select is((select proconfig::text from pg_proc where oid='public.get_photocard_collector_counts(uuid[])'::regprocedure),'{search_path=pg_catalog}','hardened path');
select ok((select relrowsecurity from pg_class where oid='public.holdings'::regclass),'Holding RLS retained');
select ok(exists(select 1 from pg_indexes where indexname='holdings_template_owner_count_idx'),'bounded template-owner index');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8090000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.holdings),2,'direct Holding read remains owner-only');
select is((select collector_count from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000001'::uuid])),2::bigint,'multiple owners with duplicate copies count once');
select is((select collector_count from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000002'::uuid])),0::bigint,'zero is legitimate');
select is((select count(*)::int from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000001'::uuid,'c8090000-0000-4000-8000-000000000002'::uuid])),2,'batch independent canonical cards');
select is((select count(*)::int from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000001'::uuid,'c8090000-0000-4000-8000-000000000001'::uuid])),1,'duplicate input does not duplicate results');
select is((select count(*)::int from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000003'::uuid])),0,'albums excluded');
select is((select count(*)::int from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000004'::uuid])),0,'restricted catalog excluded');
select is((select count(*)::int from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000099'::uuid])),0,'missing identity omitted rather than false zero');
select is((select count(*)::int from public.get_photocard_collector_counts('{}'::uuid[])),0,'empty batch');
select throws_ok($$select * from public.get_photocard_collector_counts(null)$$,'22023','invalid_template_ids','null input denied');
select throws_ok($$select * from public.get_photocard_collector_counts(array[null]::uuid[])$$,'22023','invalid_template_ids','null element denied');
select throws_ok($$select * from public.get_photocard_collector_counts(array_fill(gen_random_uuid(),array[101]))$$,'22023','invalid_template_ids','oversized batch denied');
select throws_ok($$select * from public.get_photocard_collector_counts(array['bad'::uuid])$$,'22P02',null,'malformed UUID denied');
insert into public.wishlist_entries(owner_user_id,template_id) values(public.current_seoully_user_id(),'c8090000-0000-4000-8000-000000000002');
select is((select collector_count from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000002'::uuid])),0::bigint,'wishlist does not count');
delete from public.holdings where id='d8090000-0000-4000-8000-000000000001';
select is((select collector_count from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000001'::uuid])),2::bigint,'removing one copy preserves owner');
delete from public.holdings where id='d8090000-0000-4000-8000-000000000002';
select is((select collector_count from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000001'::uuid])),1::bigint,'last copy removal removes owner');
reset role;
update public.users set status='suspended' where id=(select user_id from public.profiles where handle='count_b');
set local role authenticated;
select is((select collector_count from public.get_photocard_collector_counts(array['c8090000-0000-4000-8000-000000000001'::uuid])),0::bigint,'inactive collector excluded');
select set_config('request.jwt.claim.sub','a8090000-0000-4000-8000-000000000002',true);
select throws_ok($$select * from public.get_photocard_collector_counts('{}'::uuid[])$$,'42501','unauthenticated','inactive requester denied');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select * from public.get_photocard_collector_counts('{}'::uuid[])$$,'42501','unauthenticated','missing authenticated identity denied');
reset role;
set local role anon;
select throws_ok($$select * from public.get_photocard_collector_counts('{}'::uuid[])$$,'42501',null,'anonymous direct execution denied');
reset role;
select is((select pg_get_function_result('public.get_photocard_collector_counts(uuid[])'::regprocedure)),'TABLE(template_id uuid, collector_count bigint)','only canonical ID/count returned, no owners or private media');
select * from finish();
rollback;
