begin;
select no_plan();
select ok(not has_function_privilege('authenticated','public.create_verified_catalog_reference(uuid,uuid,uuid,text,text,bigint,text)','execute'),'shared reference server boundary cannot be bypassed by clients');
select ok(not has_table_privilege('authenticated','public.catalog_reference_images','insert'),'raw clients cannot bypass reference byte verification');
insert into auth.users(id,raw_user_meta_data) values
('a8130000-0000-4000-8000-000000000001','{"handle":"upload_one","display_name":"One"}'),
('a8130000-0000-4000-8000-000000000002','{"handle":"upload_two","display_name":"Two"}');
select set_config('test.owner_one',(select id::text from public.users where auth_subject='a8130000-0000-4000-8000-000000000001'),true);
select set_config('test.owner_two',(select id::text from public.users where auth_subject='a8130000-0000-4000-8000-000000000002'),true);
select ok((select not public from storage.buckets where id='media-upload-staging'),'staging bucket private');
select ok(not has_table_privilege('authenticated','public.media_upload_jobs','select'),'tickets not client readable');
select ok(not has_table_privilege('authenticated','public.media_upload_jobs','insert'),'clients cannot manufacture tickets');
select ok(not has_function_privilege('anon','public.complete_media_upload(uuid,uuid)','execute'),'anon cannot finalize');
select ok(not has_function_privilege('authenticated','public.complete_media_upload(uuid,uuid)','execute'),'authenticated cannot bypass server byte verification');
select ok(has_function_privilege('service_role','public.complete_media_upload(uuid,uuid)','execute'),'server can finalize');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8130000-0000-4000-8000-000000000001',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('media-upload-staging','a8130000-0000-4000-8000-000000000001/arbitrary')$$,'42501',null,'no direct arbitrary staging writes');
select set_config('test.upload_template',public.create_catalog_contribution('{"submissionKey":"a8130000-0000-4000-8000-000000000010","name":"Upload photocard","kind":"photocard","groupName":"Upload Group","descriptor":"Version A"}')#>>'{template,id}',true);
reset role;
update public.collectible_templates set publication_state='needs-media' where id=current_setting('test.upload_template')::uuid;
insert into public.media_upload_jobs(owner_id,id,payload) values
(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000011',jsonb_build_object('purpose','post','media',null,'caption','Persisted','taggedUserIds',jsonb_build_array(current_setting('test.owner_two')::uuid),'taggedTemplateIds',jsonb_build_array(current_setting('test.upload_template'))));
select is(public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000011')->>'postId','a8130000-0000-4000-8000-000000000011','text and tags complete atomically');
select is(public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000011')->>'postId','a8130000-0000-4000-8000-000000000011','duplicate/lost response returns original receipt');
select is((select count(*) from public.posts where id='a8130000-0000-4000-8000-000000000011'),1::bigint,'one post only');
select is((select count(*) from public.post_user_tags),1::bigint,'collector tag persisted once');
select is((select count(*) from public.post_collectible_tags),1::bigint,'collectible tag persisted once');
insert into public.media_upload_jobs(owner_id,id,payload) values
(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000012','{"purpose":"post","media":null,"caption":"Invalid","taggedUserIds":["a8130000-0000-4000-8000-000000000099"],"taggedTemplateIds":[]}');
select throws_ok($$select public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000012')$$,'P0001','invalid_user_tag','invalid tags rejected without partial success');
select is((select count(*) from public.posts where id='a8130000-0000-4000-8000-000000000012'),0::bigint,'invalid transaction left no post');
insert into public.media_upload_jobs(owner_id,id,payload) values
(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000013',jsonb_build_object('purpose','catalog','contextId',current_setting('test.upload_template'),'media',jsonb_build_object('mimeType','image/jpeg','byteSize',123)));
select throws_ok($$select public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000013')$$,'P0001','upload_object_missing','missing stored object rejected');
insert into storage.objects(bucket_id,name) values('catalog-reference-images',current_setting('test.owner_one')||'/'||current_setting('test.upload_template')||'/a8130000-0000-4000-8000-000000000013');
select is(public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000013')->>'templateId',current_setting('test.upload_template'),'shared image retains catalog identity');
select is((select publication_state from public.collectible_templates where id=current_setting('test.upload_template')::uuid),'published','valid reference publishes automatically');
select is((select count(*) from public.catalog_reference_images),1::bigint,'one shared reference association');
select throws_ok($$select public.complete_media_upload(current_setting('test.owner_two')::uuid,'a8130000-0000-4000-8000-000000000013')$$,'P0001','upload_not_found','collector-scoped retry receipt');
insert into public.media_upload_jobs(owner_id,id,payload,expires_at) values
(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000014','{"purpose":"avatar","media":{"mimeType":"image/jpeg","byteSize":123}}',now()-interval '1 minute');
select throws_ok($$select public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000014')$$,'P0001','upload_expired','expired authorization rejected');

select lives_ok($$select public.renew_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000014')$$,'expired pending draft obtains new authorization under same identity');
select ok((select expires_at>now() from public.media_upload_jobs where id='a8130000-0000-4000-8000-000000000014'),'renewal extends server deadline');
select ok(not has_function_privilege('authenticated','public.renew_media_upload(uuid,uuid)','execute'),'clients cannot extend authorization directly');
select ok(not has_function_privilege('authenticated','public.claim_media_upload_cleanup(integer)','execute'),'clients cannot claim cleanup');
insert into storage.objects(bucket_id,name) values('profile-avatars',current_setting('test.owner_one')||'/a8130000-0000-4000-8000-000000000014.jpg');
select is(public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000014')->>'avatarSubmissionId','a8130000-0000-4000-8000-000000000014','avatar staged for existing Profile Save');
select ok((select avatar_id is null from public.profiles where user_id=current_setting('test.owner_one')::uuid),'upload does not prematurely change selected avatar');
insert into public.holdings(id,owner_user_id,template_id) values('a8130000-0000-4000-8000-000000000020',current_setting('test.owner_one')::uuid,current_setting('test.upload_template')::uuid);
insert into public.media_upload_jobs(owner_id,id,payload) values
(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000021','{"purpose":"holding","contextId":"a8130000-0000-4000-8000-000000000020","media":{"mimeType":"image/jpeg","byteSize":123}}');
insert into storage.objects(bucket_id,name) values('collectible-media',current_setting('test.owner_one')||'/a8130000-0000-4000-8000-000000000021/original');
select is(public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000021')->>'holdingId','a8130000-0000-4000-8000-000000000020','personal photo attaches to authorized Holding');
select is((select count(*) from public.holdings),1::bigint,'media completion never creates Holding');
select is((select count(*) from public.catalog_reference_images),1::bigint,'personal upload never adds shared reference');
insert into public.media_upload_jobs(owner_id,id,payload) values
(current_setting('test.owner_two')::uuid,'a8130000-0000-4000-8000-000000000022','{"purpose":"holding","contextId":"a8130000-0000-4000-8000-000000000020","media":{"mimeType":"image/jpeg","byteSize":123}}');
insert into storage.objects(bucket_id,name) values('collectible-media',current_setting('test.owner_two')||'/a8130000-0000-4000-8000-000000000022/original');
select throws_ok($$select public.complete_media_upload(current_setting('test.owner_two')::uuid,'a8130000-0000-4000-8000-000000000022')$$,'P0001','not_authorized','completion rechecks cross-owner attachment');
update public.media_upload_jobs set expires_at=now()-interval '2 days' where id='a8130000-0000-4000-8000-000000000022';
select is((select count(*) from public.claim_media_upload_cleanup(25)),1::bigint,'cleanup claims only expired grace-window jobs');
select throws_ok($$select public.renew_media_upload(current_setting('test.owner_two')::uuid,'a8130000-0000-4000-8000-000000000022')$$,'P0001','upload_busy','cleanup and fresh authorization cannot race');
select throws_ok($$select public.complete_media_upload(current_setting('test.owner_two')::uuid,'a8130000-0000-4000-8000-000000000022')$$,'P0001','upload_busy','claimed cleanup cannot race final association');
insert into storage.objects(bucket_id,name) values('media-upload-staging',current_setting('test.owner_one')||'/private-stage');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8130000-0000-4000-8000-000000000001',true);
select is((select count(*) from storage.objects where bucket_id='media-upload-staging'),0::bigint,'ordinary owner session cannot read immutable staging');
with changed as (update storage.objects set name='overwrite' where bucket_id='media-upload-staging' returning id) select is((select count(*) from changed),0::bigint,'owner session cannot overwrite staging');
set local role anon;
select is((select count(*) from storage.objects where bucket_id='media-upload-staging'),0::bigint,'anonymous cannot read staging');
reset role;
select ok(not has_function_privilege('authenticated','public.abandon_media_post(uuid,uuid)','execute'),'raw client cannot cancel another completion');
insert into public.media_upload_jobs(owner_id,id,payload) values(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000030','{"purpose":"post","media":null,"caption":"Canceled","taggedUserIds":[],"taggedTemplateIds":[]}');
select is(public.abandon_media_post(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000030')->>'canceled','true','unfinished draft cancellation is atomic');
select is(public.complete_media_upload(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000030')->>'canceled','true','late completion cannot publish canceled draft');
select is((select count(*) from public.posts where id='a8130000-0000-4000-8000-000000000030'),0::bigint,'canceled draft left no duplicate post');
select is(public.abandon_media_post(current_setting('test.owner_one')::uuid,'a8130000-0000-4000-8000-000000000011')->>'postId','a8130000-0000-4000-8000-000000000011','already committed post is recovered rather than silently replaced');
select * from finish();
rollback;
