-- LOCAL/DISPOSABLE ONLY: existing primary keys and RLS support retry orchestration.
begin;
select no_plan();
insert into auth.users(id,raw_user_meta_data) values
 ('a8080000-0000-4000-8000-000000000001','{"handle":"firsthomeone","display_name":"One"}'),
 ('a8080000-0000-4000-8000-000000000002','{"handle":"firsthometwo","display_name":"Two"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8080000-0000-4000-8000-000000000001',true);
select public.create_catalog_contribution('{"name":"First Card","groupName":"First Home Test","kind":"photocard","submissionKey":"d8080000-0000-4000-8000-000000000001"}');
insert into public.holdings(id,owner_user_id,template_id)
 select 'b8080000-0000-4000-8000-000000000001',public.current_seoully_user_id(),id from public.collectible_templates where name='First Card';
select is((select count(*)::integer from public.holdings),1,'first ownership is durable');
select throws_ok($$insert into public.holdings(id,owner_user_id,template_id) select 'b8080000-0000-4000-8000-000000000001',public.current_seoully_user_id(),id from public.collectible_templates where name='First Card'$$,'23505',null,'same operation UUID atomically rejects second row');
select is((select count(*)::integer from public.holdings),1,'retry retains exactly one Holding');
insert into public.rooms(id,owner_user_id) values('c8080000-0000-4000-8000-000000000001',public.current_seoully_user_id());
insert into public.room_placements(room_id,holding_id,zone_id,surface_id,transform) values
 ('c8080000-0000-4000-8000-000000000001','b8080000-0000-4000-8000-000000000001','desk','c8080000-0000-4000-8000-000000000001-desk','{"x":0,"y":0,"z":0}');
select is((select count(*)::integer from public.room_placements),1,'first placement is persisted separately');
insert into public.room_placements(room_id,holding_id,zone_id,surface_id,transform) values
 ('c8080000-0000-4000-8000-000000000001','b8080000-0000-4000-8000-000000000001','desk','c8080000-0000-4000-8000-000000000001-desk','{"x":1,"y":0,"z":0}')
 on conflict(holding_id) do update set transform=excluded.transform;
select is((select count(*)::integer from public.room_placements),1,'existing placement retry/upsert cannot duplicate placement');
select set_config('request.jwt.claim.sub','a8080000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.holdings),0,'another collector cannot read original ownership');
select is((select count(*)::integer from public.room_placements),0,'another collector cannot read original placement');
select throws_ok($$insert into public.holdings(id,owner_user_id,template_id) select 'b8080000-0000-4000-8000-000000000001',public.current_seoully_user_id(),id from public.collectible_templates where name='First Card'$$,'23505',null,'cross-collector UUID collision never mutates original Holding');
reset role;
select is((select count(*)::integer from public.holdings),1,'original ownership survives cross-collector retry');
select is((select count(*)::integer from public.rooms),1,'existing Room retained');
select * from finish();
rollback;
