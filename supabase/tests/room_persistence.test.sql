-- Disposable LOCAL database only, after a complete local migration replay.
-- This suite is not an application script. Every fixture is rolled back.
begin;
select no_plan();

create temporary table room_contract_docs (style jsonb, layout jsonb);
insert into room_contract_docs values (
  '{"wall":"plum","floor":"walnut","furniture":"walnut","rug":"rose","light":"warm","brightness":"normal","binder":"cream"}',
  '{"version":1,"firstRoomEditCompleted":false,"objects":[
    {"id":"desk-a","kind":"desk","x":0,"y":-1,"z":-2,"rotateY":30,"binderDesk":true},
    {"id":"desk-b","kind":"desk","x":1,"y":-1,"z":-2,"rotateY":210},
    {"id":"lamp-a","kind":"table-lamp","x":0.2,"y":0,"z":0,"rotateY":60,"parent":{"objectId":"desk-b","surfaceId":"desk"}},
    {"id":"flowers-a","kind":"plant","x":-0.2,"y":0,"z":0,"rotateY":150,"parent":{"objectId":"desk-a","surfaceId":"desk"}},
    {"id":"string-a","kind":"photo-string","x":0,"y":0,"z":-3,"rotateY":0,"photoString":{"slots":[null,null,null,null,null]}},
    {"id":"string-b","kind":"photo-string","x":1,"y":0,"z":-3,"rotateY":0,"photoString":{"slots":[null,null,null,null,null]}}
  ]}'
);
select ok(public.room_style_is_valid(style), 'current Style including Cream accepted') from room_contract_docs;
select ok(public.room_style_is_valid(style - 'binder'), 'legacy Style without Binder color accepted') from room_contract_docs;
select is(public.public_room_visual_style(style - 'binder')->>'binder', 'cream', 'missing Binder defaults to Cream') from room_contract_docs;
select ok(not public.room_style_is_valid(style || '{"privateMetadata":"hidden"}'), 'unknown Style metadata rejected') from room_contract_docs;
select ok(not public.room_style_is_valid(style || '{"brightness":3}'), 'wrong Style scalar type rejected') from room_contract_docs;
select ok(not public.room_style_is_valid(style || '{"binder":"neon"}'), 'unsupported Style enum rejected') from room_contract_docs;
select ok(public.room_style_is_valid(jsonb_set(style, '{binder}', to_jsonb(color))), 'Binder color ' || color)
from room_contract_docs cross join unnest(array['cream','blush','lavender','sage','sky','cocoa','charcoal']) color;

select ok(public.room_layout_is_valid('{}'), 'legacy empty layout accepted');
select ok(public.room_layout_is_valid(layout), 'repeated furniture, parenting, Binder anchor, and Photo Strings accepted') from room_contract_docs;
select ok(public.room_layout_is_valid(jsonb_build_object('version',1,'firstRoomEditCompleted',true,'objects',
  jsonb_build_array(jsonb_build_object('id',kind||'-a','kind',kind,'x',0,'y',0,'z',0,'rotateY',yaw),
    jsonb_build_object('id',kind||'-b','kind',kind,'x',1,'y',0,'z',0,'rotateY',yaw)))), kind || ' repeated at yaw ' || yaw)
from unnest(array['shelf','desk','case','chair','lamp','table-lamp','plant','large-plant','rug','archive','wall-frame','photo-string']) kind
cross join unnest(array[0,30,60,90,120,150,180,210,240,270,300,330]) yaw;
select ok(not public.room_layout_is_valid(layout #- '{objects,0,x}'), 'missing coordinate rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,x}','"1"')), 'string coordinate rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,y}','[]')), 'array coordinate rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,z}','21')), 'coordinate outside server bounds rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,rotateY}','31')), 'unsupported yaw rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,kind}','"closet"')), 'unsupported kind rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,binderDesk}','false')), 'false Binder designation rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,2,parent}','{"objectId":"missing","surfaceId":"desk"}')), 'missing parent rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,2,parent}','{"objectId":"desk-a","surfaceId":"wall"}')), 'invalid parent surface rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{objects,0,privateMetadata}','"hidden"')), 'unknown object metadata rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(layout || '{"privateMetadata":"hidden"}'), 'unknown root metadata rejected') from room_contract_docs;
select ok(not public.room_layout_is_valid(jsonb_set(layout,'{firstRoomEditCompleted}','"true"')), 'completion requires boolean') from room_contract_docs;
select is(public.public_room_visual_transform('{"x":1,"y":"2","scale":1,"secret":"hidden"}'), '{"x":1,"scale":1}'::jsonb, 'numeric transform allowlist strips metadata');
select ok(not (public.public_room_visual_layout(layout)#>'{objects,4}' ? 'photoString'), 'public layout excludes attachment Holding IDs') from room_contract_docs;
select is(public.room_holding_uuid('ABCDEF00-0000-4000-8000-000000000003'), 'abcdef00-0000-4000-8000-000000000003'::uuid, 'UUID matching is case insensitive');
select is(public.room_holding_uuid('malformed'), null::uuid, 'malformed UUID never casts unsafely');
select ok(not has_function_privilege('authenticated','public.get_public_room_media_locations(uuid,uuid[])','execute'), 'authenticated callers cannot request raw media locations');
select ok(not has_function_privilege('anon','public.get_public_room_media_locations(uuid,uuid[])','execute'), 'anonymous callers cannot request raw media locations');
select ok(has_function_privilege('service_role','public.get_public_room_media_locations(uuid,uuid[])','execute'), 'trusted server locator enabled');
select ok(not has_function_privilege('anon','public.get_public_room_by_handle(text)','execute'), 'anonymous public Room RPC disabled');
select ok(not has_function_privilege('service_role','public.get_public_room_by_handle(text)','execute'), 'public Room RPC explicitly authenticated-only');
select ok(not has_function_privilege('anon','public.can_view_public_collectible_media(text,text)','execute'), 'anonymous storage helper execution revoked');
select ok(not has_function_privilege('service_role','public.can_view_public_collectible_media(text,text)','execute'), 'server locator does not require storage helper execution');
select ok(has_function_privilege('authenticated','public.can_view_public_collectible_media(text,text)','execute'), 'viewer Storage policy can execute helper');
select ok((select prosecdef and proconfig = array['search_path=pg_catalog'] from pg_proc where oid='public.can_view_public_collectible_media(text,text)'::regprocedure), 'storage definer uses hardened catalog-only search path');

-- Runtime projection and owner trigger checks, including >500 real input rows.
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','a7110000-0000-4000-8000-000000000001','authenticated','authenticated','room-owner@example.test','test-only',now(),'{}','{"handle":"roomtestowner","display_name":"Owner"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a7110000-0000-4000-8000-000000000002','authenticated','authenticated','room-viewer@example.test','test-only',now(),'{}','{"handle":"roomtestviewer","display_name":"Viewer"}',now(),now());
update public.profiles set collection_public=true where handle='roomtestowner';
select set_config('request.jwt.claim.sub','a7110000-0000-4000-8000-000000000002',true);
select is(public.get_public_room_by_handle('roomtestowner')->'room','null'::jsonb,'missing Room is explicit null');
insert into public.rooms (id,owner_user_id) select 'a7110000-0000-4000-8000-000000000003',user_id from public.profiles where handle='roomtestowner';
select is((select style->>'binder' from public.rooms where id='a7110000-0000-4000-8000-000000000003'),'cream','existing/new row default Style is valid');
insert into public.catalog_groups (id,slug,name) values ('a7110000-0000-4000-8000-000000000004','room-test-group','Room test group');
insert into public.collectible_templates (id,group_id,kind,name,normalized_name,identity_key)
values ('a7110000-0000-4000-8000-000000000005','a7110000-0000-4000-8000-000000000004','photocard','Room card','room card','room-persistence-test');
insert into public.holdings (id,owner_user_id,template_id)
select md5('room-test-holding-'||n)::uuid,(select user_id from public.profiles where handle='roomtestowner'),'a7110000-0000-4000-8000-000000000005' from generate_series(1,502) n;
insert into public.room_placements (id,room_id,holding_id,zone_id,slot,updated_at,transform)
select md5('room-test-placement-'||n)::uuid,'a7110000-0000-4000-8000-000000000003',md5('room-test-holding-'||n)::uuid,'shelf',n,
  '2026-01-01'::timestamptz + n * interval '1 minute','{"x":1,"y":0,"z":0,"privateMetadata":"hidden"}'
from generate_series(1,501) n;
insert into public.media_assets (owner_user_id,holding_id,storage_path,mime_type,byte_size)
select (select user_id from public.profiles where handle='roomtestowner'),md5('room-test-holding-'||n)::uuid,
  (select user_id::text from public.profiles where handle='roomtestowner')||'/room-'||n||'.jpg','image/jpeg',100 from unnest(array[1,501,502]) n;
insert into storage.objects (bucket_id,name)
select storage_bucket,storage_path from public.media_assets where holding_id in (select md5('room-test-holding-'||n)::uuid from unnest(array[1,501,502]) n);
select set_config('room.test_public_path',(select user_id::text||'/room-501.jpg' from public.profiles where handle='roomtestowner'),true);
select set_config('room.test_unplaced_path',(select user_id::text||'/room-502.jpg' from public.profiles where handle='roomtestowner'),true);
select set_config('room.test_cutoff_path',(select user_id::text||'/room-1.jpg' from public.profiles where handle='roomtestowner'),true);
set local role authenticated;
select is(jsonb_array_length(public.get_public_room_by_handle('roomtestowner')#>'{room,placements}'),500,'placement input is capped before aggregation');
select is(public.get_public_room_by_handle('roomtestowner')#>>'{room,placements,0,id}',md5('room-test-placement-501')::uuid::text,'deterministic latest-first placement order');
select ok(public.get_public_room_by_handle('roomtestowner')::text !~ 'test-only|storage_path|mediaPath|mediaBucket|hidden','authenticated RPC exposes no raw storage coordinates or arbitrary metadata');
select ok(position(current_setting('room.test_public_path') in public.get_public_room_by_handle('roomtestowner')::text)=0,'actual personal-media path is absent from public projection');
select is(public.get_public_room_by_handle('roomtestowner')#>'{room,placements,0,holding,hasPersonalMedia}','true'::jsonb,'eligible image-presence bit reaches server signing path');
select is((select count(*)::integer from public.holdings where owner_user_id=(select user_id from public.profiles where handle='roomtestowner')),0,'visitor cannot enumerate owner Holdings');
select is((select count(*)::integer from public.media_assets where owner_user_id=(select user_id from public.profiles where handle='roomtestowner')),0,'visitor cannot enumerate owner MediaAssets');
select ok(public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')), 'legitimate public placed media authorized for viewer');
select is((select count(*)::integer from storage.objects where name=current_setting('room.test_public_path')),1,'viewer Storage SELECT permits legitimate public signing');
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_unplaced_path')), 'unplaced media denied even when its path is known');
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_cutoff_path')), 'placed media outside first 500 denied');
select ok(not public.can_view_public_collectible_media('other-bucket',current_setting('room.test_public_path')), 'forged bucket denied');
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')||'-forged'), 'forged path denied');
select ok(not public.can_view_public_collectible_media('collectible-media',bad_path), 'missing or malformed path denied') from unnest(array[null,'',' ','/absolute','a//b','a/../b','a/.','a/',E'a/\nb']) bad_path;
select set_config('request.jwt.claim.sub','',true);
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')), 'authenticated role without viewer JWT denied');
select set_config('request.jwt.claim.sub','a7110000-0000-4000-8000-000000000002',true);
reset role;
set local role anon;
select throws_ok($sql$ select public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')) $sql$,'42501','permission denied for function can_view_public_collectible_media','anonymous direct execution denied');
select is((select count(*)::integer from storage.objects where name=current_setting('room.test_public_path')),0,'anonymous Storage read denied');
reset role;

-- Privileged fixture changes model states clients cannot necessarily forge.
update public.collectible_templates set status='restricted' where id='a7110000-0000-4000-8000-000000000005';
set local role authenticated;
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')), 'restricted template media denied');
select is((select count(*)::integer from storage.objects where name=current_setting('room.test_public_path')),0,'restricted media cannot pass viewer Storage signing policy');
reset role;
update public.collectible_templates set status='community' where id='a7110000-0000-4000-8000-000000000005';
update public.media_assets set owner_user_id=(select user_id from public.profiles where handle='roomtestviewer') where holding_id=md5('room-test-holding-501')::uuid;
set local role authenticated;
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')), 'MediaAsset/Holding owner mismatch denied');
select is((select count(*)::integer from storage.objects where name=current_setting('room.test_public_path')),0,'mismatched media cannot pass Storage SELECT');
reset role;
update public.media_assets set owner_user_id=(select user_id from public.profiles where handle='roomtestowner') where holding_id=md5('room-test-holding-501')::uuid;
update public.holdings set owner_user_id=(select user_id from public.profiles where handle='roomtestviewer') where id=md5('room-test-holding-501')::uuid;
set local role authenticated;
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')), 'Holding/Room cross-user ownership mismatch denied');
reset role;
update public.holdings set owner_user_id=(select user_id from public.profiles where handle='roomtestowner') where id=md5('room-test-holding-501')::uuid;
update public.media_assets set storage_path=(select user_id::text||'/room-forged.jpg' from public.profiles where handle='roomtestviewer') where holding_id=md5('room-test-holding-501')::uuid;
set local role authenticated;
select ok(not public.can_view_public_collectible_media('collectible-media',(select user_id::text||'/room-forged.jpg' from public.profiles where handle='roomtestviewer')), 'stored path with unrelated owner prefix denied');
reset role;
update public.media_assets set storage_path=current_setting('room.test_public_path') where holding_id=md5('room-test-holding-501')::uuid;
update public.profiles set collection_public=false where handle='roomtestowner';
set local role authenticated;
select ok(not public.can_view_public_collectible_media('collectible-media',current_setting('room.test_public_path')), 'unrelated collector private media denied');
select is((select count(*)::integer from storage.objects where name=current_setting('room.test_public_path')),0,'private collection cannot pass Storage signing policy');
reset role;
update public.profiles set collection_public=true where handle='roomtestowner';
-- A known malformed path must fail even when stored on an otherwise eligible asset.
update public.media_assets set storage_path=(select user_id::text||'/../forged.jpg' from public.profiles where handle='roomtestowner') where holding_id=md5('room-test-holding-501')::uuid;
set local role authenticated;
select ok(not public.can_view_public_collectible_media('collectible-media',(select user_id::text||'/../forged.jpg' from public.profiles where handle='roomtestowner')), 'stored malformed path denied');
reset role;
update public.media_assets set storage_path=current_setting('room.test_public_path') where holding_id=md5('room-test-holding-501')::uuid;
set local role service_role;
select is(jsonb_array_length(public.get_public_room_media_locations('a7110000-0000-4000-8000-000000000003',
  array[md5('room-test-placement-501')::uuid])),1,'server locator resolves eligible displayed media');
select is(jsonb_array_length(public.get_public_room_media_locations('a7110000-0000-4000-8000-000000000003',
  array[md5('room-test-placement-1')::uuid])),0,'server locator respects same 500-placement cutoff');
select is(jsonb_array_length(public.get_public_room_media_locations('a7110000-0000-4000-8000-000000000003',
  array[md5('room-test-holding-502')::uuid])),0,'unplaced private media has no locator result');
reset role;

select set_config('request.jwt.claim.sub','a7110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($sql$ update public.rooms set layout='{"version":1,"firstRoomEditCompleted":true,"objects":[{"id":"string-a","kind":"photo-string","x":0,"y":0,"z":-3,"rotateY":0,"photoString":{"slots":[null,null,null,null,null]}}]}'
  where id='a7110000-0000-4000-8000-000000000003' $sql$, 'owner writes run invoker attachment trigger without direct trigger execute grant');
select throws_ok($sql$ update public.rooms set layout='{"version":1,"firstRoomEditCompleted":true,"objects":[{"id":"string-a","kind":"photo-string","x":0,"y":0,"z":-3,"rotateY":0,"photoString":{"slots":["a7110000-0000-4000-8000-000000000002",null,null,null,null]}}]}'
  where id='a7110000-0000-4000-8000-000000000003' $sql$,'23514','photo_string_holding_ineligible','non-owned/nonexistent attachment rejected');
reset role;
update public.rooms set layout=jsonb_build_object('version',1,'firstRoomEditCompleted',true,'objects',jsonb_build_array(
  jsonb_build_object('id','string-a','kind','photo-string','x',0,'y',0,'z',-3,'rotateY',0,'photoString',jsonb_build_object('slots',
    jsonb_build_array(upper(md5('room-test-holding-502')::uuid::text),null,null,null,null)))))
where id='a7110000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','a7110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(jsonb_array_length(public.get_public_room_by_handle('roomtestowner')#>'{room,photoStringCards}'),1,'uppercase attachment UUID survives safe public projection');
select ok(public.get_public_room_by_handle('roomtestowner')::text !~ md5('room-test-holding-502')::uuid::text,'public Photo String omits Holding identity');
reset role;
update public.profiles set collection_public=false where handle='roomtestowner';
set local role service_role;
select is(jsonb_array_length(public.get_public_room_media_locations('a7110000-0000-4000-8000-000000000003',array[md5('room-test-placement-501')::uuid])),0,'server locator refuses private collection');
reset role;
select * from finish();
rollback;
