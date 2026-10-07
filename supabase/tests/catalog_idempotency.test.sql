-- LOCAL/DISPOSABLE ONLY. Fixtures and tests roll back.
begin;
select no_plan();
insert into auth.users (id,raw_user_meta_data) values
 ('a8050000-0000-4000-8000-000000000001','{"handle":"catalogtestone","display_name":"One"}'),
 ('a8050000-0000-4000-8000-000000000002','{"handle":"catalogtesttwo","display_name":"Two"}');
create temporary table catalog_results (label text primary key, result jsonb);
grant all on catalog_results to authenticated;
select ok((select relrowsecurity from pg_class where oid='public.catalog_contributions'::regclass),'contribution RLS stays enabled');
select ok(not has_table_privilege('authenticated','public.catalog_contributions','select'),'no direct authenticated contribution read');
select ok(not has_table_privilege('authenticated','public.catalog_contributions','insert'),'no direct authenticated contribution write');
select ok(not has_function_privilege('anon','public.create_catalog_contribution(jsonb)','execute'),'anon cannot execute');
select ok(has_function_privilege('authenticated','public.create_catalog_contribution(jsonb)','execute'),'authenticated execution preserved');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.create_catalog_contribution(jsonb)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC execution absent');
select ok((select prosecdef and proconfig=array['search_path=pg_catalog, public, auth'] from pg_proc where oid='public.create_catalog_contribution(jsonb)'::regprocedure),'definer and hardened search path preserved');
set local role authenticated;
select throws_ok($$select public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard"}')$$,'42501','unauthenticated','unauthenticated RPC denied');
select set_config('request.jwt.claim.sub','a8050000-0000-4000-8000-000000000001',true);
insert into catalog_results values ('first',public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000001"}'));
insert into catalog_results values ('retry',public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000001"}'));
select is((select result from catalog_results where label='retry'),(select result from catalog_results where label='first'),'exact retry returns original full result');
select throws_ok($$select public.create_catalog_contribution('{"name":"Changed","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000001"}')$$,'22023','submission key reused with different details','changed request with same key rejected');
select throws_ok($$select public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"invalid"}')$$,'22023','invalid submission key','malformed UUID rejected');
select throws_ok($$select public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":null}')$$,'22023','invalid submission key','null key rejected');
select throws_ok($$select public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":123}')$$,'22023','invalid submission key','numeric key rejected');
select throws_ok($$select public.create_catalog_contribution('[]')$$,'22023','invalid catalog payload','non-object rejected');
select throws_ok($$select public.create_catalog_contribution('{"name":"","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000009"}')$$,'22023','catalog details required','invalid body cannot reserve key');
reset role;
select is((select count(*)::integer from public.catalog_contributions),1,'first + retry created exactly one contribution');
select is((select count(*)::integer from public.collectible_templates where name='Card'),1,'first creates expected template');
select throws_ok($$insert into public.catalog_contributions(template_id,contributor_user_id,source_metadata,submission_key,submission_result)
 select template_id,contributor_user_id,source_metadata,submission_key,submission_result from public.catalog_contributions limit 1$$,
 '23505',null,'unique index independently forbids duplicate collector/key');
select throws_ok($$insert into public.catalog_contributions(template_id,contributor_user_id,submission_key)
 select template_id,contributor_user_id,'b8050000-0000-4000-8000-000000000099'::uuid from public.catalog_contributions limit 1$$,
 '23514',null,'incomplete keyed result cannot be persisted');
-- A later template edit must not change the cached original RPC result.
update public.collectible_templates set descriptor='later metadata' where name='Card';
set local role authenticated;
insert into catalog_results values ('after-edit',public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000001"}'));
select is((select result from catalog_results where label='after-edit'),(select result from catalog_results where label='first'),'retry snapshot remains original after template update');
insert into catalog_results values ('new-key',public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000002"}'));
select is((select result#>>'{template,id}' from catalog_results where label='new-key'),(select result#>>'{template,id}' from catalog_results where label='first'),'new contribution still deduplicates template');
select set_config('request.jwt.claim.sub','a8050000-0000-4000-8000-000000000002',true);
insert into catalog_results values ('other-user',public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000001"}'));
select isnt((select result->>'contributor_user_id' from catalog_results where label='other-user'),(select result->>'contributor_user_id' from catalog_results where label='first'),'same textual key cannot return other collector result');
insert into catalog_results values ('other-retry',public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000001"}'));
select is((select result from catalog_results where label='other-retry'),(select result from catalog_results where label='other-user'),'other collector retry stays scoped');
reset role;
select is((select count(*)::integer from public.catalog_contributions),3,'new key and different collector each create legitimate contribution');
select is((select count(*)::integer from public.collectible_templates where name='Card'),1,'cross-collector template deduplication remains');
select ok(not exists(select 1 from public.catalog_contributions where submission_key is not null and submission_result is null),'no incomplete keyed results');
set local role authenticated;
-- Legacy compatibility is deliberately opt-in: no key keeps old behavior.
select public.create_catalog_contribution('{"name":"Legacy Card","groupName":"Test Group","kind":"photocard"}');
select public.create_catalog_contribution('{"name":"Legacy Card","groupName":"Test Group","kind":"photocard"}');
reset role;
select is((select count(*)::integer from public.catalog_contributions where submission_key is null),2,'legacy callers stay compatible and unkeyed');
select is((select count(*)::integer from public.collectible_templates where name='Legacy Card'),1,'legacy template deduplication remains');
select is((select count(*)::integer from public.holdings),0,'catalog retry orchestration creates no Holdings');
select is((select count(*)::integer from public.media_assets),0,'catalog retry orchestration creates no MediaAssets');
select ok((select bool_and(source_metadata->>'submissionKey' is null) from public.catalog_contributions),'operation key stored separately from immutable request body');
set local role anon;
select throws_ok($$select public.create_catalog_contribution('{"name":"Card","groupName":"Test Group","kind":"photocard"}')$$,'42501',null,'anonymous write RPC actually denied');
reset role;
set local role authenticated;
select throws_ok($$select * from public.catalog_contributions$$,'42501',null,'authenticated cannot enumerate private contribution records');
insert into catalog_results values ('forged-owner',public.create_catalog_contribution('{"name":"Other Card","groupName":"Test Group","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000003","contributor_user_id":"forged-owner"}'));
select is((select result->>'contributor_user_id' from catalog_results where label='forged-owner'),public.current_seoully_user_id()::text,'supplied owner cannot override authenticated identity');
select is((select result->>'contributor_user_id' from catalog_results where label='forged-owner'),(select result->>'contributor_user_id' from catalog_results where label='other-user'),'forged owner attempt remains current collector');
reset role;
select * from finish();
rollback;
