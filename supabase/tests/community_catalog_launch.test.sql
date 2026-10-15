begin;
select no_plan();
insert into auth.users(id,raw_user_meta_data) values
 ('a8120000-0000-4000-8000-000000000001','{"handle":"launch_first","display_name":"First"}'),
 ('a8120000-0000-4000-8000-000000000002','{"handle":"launch_second","display_name":"Second"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8120000-0000-4000-8000-000000000001',true);
select set_config('test.launch',public.create_catalog_contribution('{"submissionKey":"a8120000-0000-4000-8000-000000000010","name":"Launch photocard","kind":"photocard","groupName":"Launch Group","memberName":"Member","releaseName":"Album","descriptor":"Store A, version 1"}')#>>'{template,id}',true);
select is(public.create_catalog_contribution('{"submissionKey":"a8120000-0000-4000-8000-000000000010","name":"Launch photocard","kind":"photocard","groupName":"Launch Group","memberName":"Member","releaseName":"Album","descriptor":"Store A, version 1"}')#>>'{template,id}',current_setting('test.launch'),'interrupted contribution reuses exact template');
select is((select publication_state from public.collectible_templates where id=current_setting('test.launch')::uuid),'draft','first collector creates unpublished draft until image is stored');
insert into storage.objects(bucket_id,name) values('collectible-media',public.current_seoully_user_id()::text||'/private-photo');
select throws_ok($$insert into public.catalog_reference_images(collectible_template_id,storage_bucket,storage_path,contributed_by_user_id,mime_type,byte_size) values(current_setting('test.launch')::uuid,'collectible-media',public.current_seoully_user_id()::text||'/private-photo',public.current_seoully_user_id(),'image/jpeg',100)$$,'42501',null,'private photo cannot serve as shared reference');
select set_config('request.jwt.claim.sub','a8120000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.collectible_templates where id=current_setting('test.launch')::uuid),0,'second collector cannot discover unpublished draft');
select set_config('request.jwt.claim.sub','a8120000-0000-4000-8000-000000000001',true);
insert into storage.objects(bucket_id,name) values('catalog-reference-images',public.current_seoully_user_id()::text||'/launch-reference');
insert into public.catalog_reference_images(collectible_template_id,storage_path,contributed_by_user_id,mime_type,byte_size,source_key)
 values(current_setting('test.launch')::uuid,public.current_seoully_user_id()::text||'/launch-reference',public.current_seoully_user_id(),'image/jpeg',100,'launch-retry');
select is((select publication_state from public.collectible_templates where id=current_setting('test.launch')::uuid),'published','stored authorized reference immediately publishes without moderation');
insert into public.holdings(id,owner_user_id,template_id) values('c8120000-0000-4000-8000-000000000001',public.current_seoully_user_id(),current_setting('test.launch')::uuid);
select is((select count(*)::int from public.own_catalog_reference_retry(current_setting('test.launch')::uuid,'launch-retry')),1,'lost upload response recovers stored reference without a second upload');
select set_config('request.jwt.claim.sub','a8120000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.collectible_templates where search_text ilike '%Launch Group%' and publication_state in ('published','needs-media')),1,'second collector immediately finds published template via canonical search');
select is((select id::text from public.collectible_templates where id=current_setting('test.launch')::uuid),current_setting('test.launch'),'tagging/details resolve identical public template ID');
insert into public.posts(id,author_user_id,caption) values('b8120000-0000-4000-8000-000000000001',public.current_seoully_user_id(),'Shared catalog launch');
insert into public.post_collectible_tags(post_id,template_id) values('b8120000-0000-4000-8000-000000000001',current_setting('test.launch')::uuid);
select is((select template_id::text from public.post_collectible_tags where post_id='b8120000-0000-4000-8000-000000000001'),current_setting('test.launch'),'second collector can tag newly published item before owning it');
insert into public.wishlist_entries(owner_user_id,template_id) values(public.current_seoully_user_id(),current_setting('test.launch')::uuid);
select is((select template_id::text from public.wishlist_entries),current_setting('test.launch'),'newly published template immediately supports wishlist reuse');
select is((select count(*)::int from public.catalog_reference_images where collectible_template_id=current_setting('test.launch')::uuid),1,'second collector can read shared reference metadata');
select is((select count(*)::int from storage.objects where bucket_id='collectible-media'),0,'shared discovery cannot expose first collector private photo');
insert into public.holdings(id,owner_user_id,template_id) values('c8120000-0000-4000-8000-000000000002',public.current_seoully_user_id(),current_setting('test.launch')::uuid);
select is(public.create_catalog_contribution('{"submissionKey":"a8120000-0000-4000-8000-000000000011","name":" LAUNCH PHOTOCARD ","kind":"photocard","groupName":"Launch Group","memberName":"Member","releaseName":"Album","descriptor":"Store A, version 1"}')#>>'{template,id}',current_setting('test.launch'),'second contribution with same physical identity reuses catalog entry');
select isnt(public.create_catalog_contribution('{"name":"Launch photocard","kind":"photocard","groupName":"Launch Group","memberName":"Member","releaseName":"Album","descriptor":"Store A, version 2"}')#>>'{template,id}',current_setting('test.launch'),'genuinely different version gets separate identity');
reset role;
select is((select count(*)::int from public.holdings where template_id=current_setting('test.launch')::uuid),2,'two collectors own independent copies of one shared template');
select is((select count(*)::int from public.catalog_reference_images where collectible_template_id=current_setting('test.launch')::uuid),1,'community reuse requires only one shared upload');
select * from finish();
rollback;
