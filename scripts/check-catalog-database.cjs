/** No hosted URL/credentials. Creates an isolated disposable Docker PostgreSQL,
 * replays every migration, runs pgTAP, and tests real two-session concurrency.
 * Usage: node scripts/check-catalog-database.cjs /absolute/path/to/docker
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const docker = process.argv[2] || 'docker';
const image = 'public.ecr.aws/supabase/postgres:17.6.1.166';
const container = `seoully-catalog-test-${process.pid}`;
const run = args => execFileSync(docker,args,{encoding:'utf8',maxBuffer:16*1024*1024});
const sql = text => execFileSync(docker,['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','postgres'],{input:text,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const wait = ms => new Promise(r=>setTimeout(r,ms));
function session(){
  const proc=spawn(docker,['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','postgres']);
  let output='',error='';proc.stdout.on('data',x=>output+=x);proc.stderr.on('data',x=>error+=x);
  const done=new Promise((resolve,reject)=>proc.on('exit',code=>code===0?resolve(output.trim()):reject(Error(error))));
  return {proc,done};
}
async function main(){
  try {
    run(['run','-d','--name',container,'--network','none','--user','postgres','--entrypoint','/bin/sh',image,'-c','initdb -D /tmp/catalog-db -A trust >/tmp/init.log && exec postgres -D /tmp/catalog-db']);
    let ready=false;
    for(let i=0;i<60;i++){try{if(sql('select 1')==='1'){ready=true;break}}catch{}await wait(500)}
    assert.ok(ready,'disposable PostgreSQL ready');
    sql(fs.readFileSync('supabase/tests/bootstrap.sql','utf8'));
    const migrations=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
    for(const file of migrations){
      const body=fs.readFileSync(path.join('supabase/migrations',file),'utf8');
      if(file==='20261010000000_profile_post_reposts.sql') {
        // Exercise the exact hosted-head upgrade, with synthetic legacy ownership.
        const upgrade = sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values('a8090000-0000-4000-8000-000000000099','{"handle":"rollout_history","display_name":"History"}');
          insert into public.catalog_groups(id,slug,name) values('b8090000-0000-4000-8000-000000000099','rollout-history','History');
          insert into public.collectible_templates(id,group_id,kind,name,normalized_name,identity_key)
            select ('c8090000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b8090000-0000-4000-8000-000000000099','photocard','Legacy '||n,'legacy '||n,'rollout-history-'||n from generate_series(1,12) n;
          insert into public.holdings(owner_user_id,template_id)
            select p.user_id,t.id from public.profiles p cross join public.collectible_templates t where p.handle='rollout_history';
          create temporary table rollout_profiles as select user_id,to_jsonb(p) snapshot from public.profiles p;
          create temporary table rollout_holdings as select id,to_jsonb(h) snapshot from public.holdings h;
          create temporary table rollout_templates as select id,to_jsonb(t) snapshot from public.collectible_templates t;
          ${migrations.filter(f=>f>='20261010000000').map(f=>fs.readFileSync(path.join('supabase/migrations',f),'utf8')).join('\n')}
          select (select bool_and(to_jsonb(p)=o.snapshot) from public.profiles p join rollout_profiles o using(user_id))
            and (select bool_and(to_jsonb(h)=o.snapshot) from public.holdings h join rollout_holdings o using(id))
            and (select bool_and(to_jsonb(t)-'publication_state'=o.snapshot and t.publication_state='needs-media') from public.collectible_templates t join rollout_templates o using(id))
            and not has_table_privilege('authenticated','public.catalog_reference_images','INSERT')
            and not has_table_privilege('authenticated','public.media_upload_jobs','SELECT');
          set local role anon;
          select count(*)=12 from public.collectible_templates;
          reset role;
          rollback;`);
        assert.deepEqual(upgrade.split('\n').slice(-2), ['t','t'], '09 → 10 → 11 → 12 preserves identity/ownership and legacy anonymous discovery, tightens grants');
        console.log('Production-head 09 → 10 → 11 → 12 synthetic legacy preservation and visibility PASS.');
      }
      if(file==='20261011000000_catalog_image_publication.sql'){
        const trial=sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values('a8110000-0000-4000-8000-000000000090','{"handle":"history_media","display_name":"History"}');
          insert into public.catalog_groups(id,slug,name) values('b8110000-0000-4000-8000-000000000090','history-media','History');
          insert into public.collectible_templates(id,group_id,kind,name,normalized_name,identity_key) values
           ('c8110000-0000-4000-8000-000000000090','b8110000-0000-4000-8000-000000000090','photocard','Legacy','legacy','history-media-one'),
           ('c8110000-0000-4000-8000-000000000091','b8110000-0000-4000-8000-000000000090','photocard','Pictured','pictured','history-media-two');
          insert into public.holdings(owner_user_id,template_id) select user_id,'c8110000-0000-4000-8000-000000000090' from public.profiles where handle='history_media';
          insert into storage.objects(bucket_id,name) values('catalog-reference-images','historical-shared-reference');
          insert into public.catalog_reference_images(collectible_template_id,storage_path,contributed_by_user_id,mime_type,byte_size) select 'c8110000-0000-4000-8000-000000000091','historical-shared-reference',user_id,'image/jpeg',100 from public.profiles where handle='history_media';
          create temporary table original_templates as select id,to_jsonb(t) snapshot from public.collectible_templates t;
          create temporary table original_holdings as select id,to_jsonb(h) snapshot from public.holdings h;
          ${body}
          select (select bool_and(to_jsonb(t)-'publication_state'=o.snapshot) from public.collectible_templates t join original_templates o using(id)) and
           (select bool_and(to_jsonb(h)=o.snapshot) from public.holdings h join original_holdings o using(id)) and
           (select publication_state='needs-media' from public.collectible_templates where id='c8110000-0000-4000-8000-000000000090') and
           (select publication_state='published' from public.collectible_templates where id='c8110000-0000-4000-8000-000000000091');
          rollback;`);
        assert.equal(trial.split('\n').at(-1),'t','legacy template and Holding rows preserved exactly; image publication classified');
      }
      if(file==='20261005000000_catalog_contribution_idempotency.sql'){
        // A historical contribution exists BEFORE the new migration. Roll this
        // fixture trial back, then apply the same migration cleanly below.
        const history=sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values('a8050000-0000-4000-8000-000000000010','{"handle":"historytest","display_name":"History"}');
          set local role authenticated;
          select set_config('request.jwt.claim.sub','a8050000-0000-4000-8000-000000000010',true);
          select public.create_catalog_contribution('{"name":"Historical","groupName":"History","kind":"photocard"}');
          reset role;
          create temporary table original_history as select to_jsonb(c) snapshot from public.catalog_contributions c;
          ${body}
          select (select count(*)=1 from public.catalog_contributions) and
            (select to_jsonb(c)-'submission_key'-'submission_result'=h.snapshot and c.submission_key is null and c.submission_result is null from public.catalog_contributions c cross join original_history h);
          rollback;`);
        assert.equal(history.split('\n').at(-1),'t','historical contribution unchanged by migration');
      }
      if(file==='20261006000000_profile_appearance.sql') {
        const history=sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values('a8060000-0000-4000-8000-000000000010','{"handle":"appear_history","display_name":"History"}');
          update public.profiles set bio='Preserved biography',tagline='Preserved tagline' where handle='appear_history';
          create temporary table appearance_history as select to_jsonb(p) snapshot from public.profiles p;
          ${body}
          select bool_and(to_jsonb(p)-'appearance'=h.snapshot and p.appearance='{"mode":"default"}'::jsonb)
            from public.profiles p join appearance_history h on p.user_id=(h.snapshot->>'user_id')::uuid;
          rollback;`);
        assert.equal(history.split('\n').at(-1),'t','existing profiles unchanged except safe Default');
      }
      if(file==='20261007000000_profile_identity_media_and_contributions.sql') {
        const preserved=sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values('a8070000-0000-4000-8000-000000000010','{"handle":"identity_history","display_name":"History"}');
          update public.profiles set bio='Preserved identity',appearance='{"mode":"room-sync"}' where handle='identity_history';
          create temporary table identity_history as select to_jsonb(p) snapshot from public.profiles p;
          ${body}
          select bool_and(to_jsonb(p)-'avatar_id'=h.snapshot and p.avatar_id is null)
            from public.profiles p join identity_history h on p.user_id=(h.snapshot->>'user_id')::uuid;
          rollback;`);
        assert.equal(preserved.split('\n').at(-1),'t','existing identity and appearance preserved by new capability');
      }
      if(file==='20261008000000_profile_room_sync_default.sql') {
        const preserved=sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values
            ('a8080000-0000-4000-8000-000000000010','{"handle":"default_history","display_name":"Default"}'),
            ('a8080000-0000-4000-8000-000000000011','{"handle":"custom_history","display_name":"Custom"}'),
            ('a8080000-0000-4000-8000-000000000012','{"handle":"sync_history","display_name":"Sync"}');
          update public.profiles set appearance='{"mode":"custom","background":"mint"}' where handle='custom_history';
          update public.profiles set appearance='{"mode":"room-sync"}' where handle='sync_history';
          create temporary table sync_history_before as select to_jsonb(p) snapshot from public.profiles p;
          ${body}
          select bool_and(to_jsonb(p)=h.snapshot) from public.profiles p join sync_history_before h on p.user_id=(h.snapshot->>'user_id')::uuid;
          rollback;`);
        assert.equal(preserved.split('\n').at(-1),'t','default change preserves all legacy profile values byte-for-byte');
      }
      sql(`begin;\n${body}\ncommit;`);
    }
    sql('create extension pgtap');
    let tapCount=0;
    for(const file of ['room_persistence.test.sql','catalog_idempotency.test.sql','first_home.test.sql','user_profile_rls.test.sql','profile_appearance.test.sql','profile_identity.test.sql','profile_room_sync_default.test.sql','photocard_collector_counts.test.sql','profile_post_reposts.test.sql','catalog_image_publication.test.sql','community_catalog_launch.test.sql','direct_media_uploads.test.sql']){
      const result=sql(fs.readFileSync(path.join('supabase/tests',file),'utf8'));
      const lines=result.split('\n');const failures=lines.filter(l=>/^not ok |^# Looks like/.test(l));
      assert.deepEqual(failures,[],`${file} pgTAP failures`);
      const passed=lines.filter(l=>/^ok \d+ /.test(l)).length;
      assert.ok(passed>0);assert.ok(lines.includes(`1..${passed}`),'complete pgTAP plan');
      tapCount+=passed;console.log(`${file}: ${passed} pgTAP assertions passed`);
    }
    assert.equal(sql('select count(*) from public.catalog_contributions'),'0','fixtures rolled back');
    sql(`insert into auth.users(id,raw_user_meta_data) values('a8050000-0000-4000-8000-000000000020','{"handle":"concurrencytest","display_name":"Concurrent"}');`);
    const request=`select public.create_catalog_contribution('{"name":"Concurrent Card","groupName":"Concurrent","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000020"}');`;
    const start=`begin;set local role authenticated;set local request.jwt.claim.sub='a8050000-0000-4000-8000-000000000020';`;
    const first=session();first.proc.stdin.write(start+request+'\n');
    // First transaction holds its advisory lock after RPC completion.
    let held=false;for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='advisory' and granted"))>0){held=true;break}await wait(50)}
    assert.ok(held,'first request holds transaction lock');
    const second=session();second.proc.stdin.end(start+request+'commit;\n');
    let blocked=false;for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='advisory' and not granted"))>0){blocked=true;break}await wait(50)}
    assert.ok(blocked,'second real session blocks atomically on same operation');
    first.proc.stdin.end('commit;\n');
    const [a,b]=await Promise.all([first.done,second.done]);
    assert.deepEqual(JSON.parse(a),JSON.parse(b),'concurrent calls return identical original result');
    assert.equal(sql('select count(*) from public.catalog_contributions'),'1','two concurrent sessions created only one contribution');
    // Discard the first committed response; a new session retry returns it.
    const retry=JSON.parse(sql(start+request+'commit;'));
    assert.deepEqual(retry,JSON.parse(a),'committed-but-lost-response retry resolves original');
    assert.equal(sql('select count(*) from public.catalog_contributions'),'1');
    // Independent collectors and retry keys race on the same physical identity.
    sql(`insert into auth.users(id,raw_user_meta_data) values('a8120000-0000-4000-8000-000000000020','{"handle":"launchsecond","display_name":"Second"}');`);
    const sharedPayload={name:'Shared concurrent version',groupName:'Concurrent launch',kind:'photocard',descriptor:'Store A version 1'};
    const independentA=session(), independentB=session();
    independentA.proc.stdin.end(start+`select public.create_catalog_contribution('${JSON.stringify({...sharedPayload,submissionKey:'b8120000-0000-4000-8000-000000000001'})}');commit;`);
    independentB.proc.stdin.end(`begin;set local role authenticated;set local request.jwt.claim.sub='a8120000-0000-4000-8000-000000000020';select public.create_catalog_contribution('${JSON.stringify({...sharedPayload,submissionKey:'b8120000-0000-4000-8000-000000000002'})}');commit;`);
    const sharedResults=(await Promise.all([independentA.done,independentB.done])).map(JSON.parse);
    assert.equal(sharedResults[0].template.id,sharedResults[1].template.id,'concurrent collectors reuse one physical catalog identity');
    assert.equal(sharedResults.filter(r=>r.created).length,1,'only one concurrent collector creates the template');
    assert.equal(sql("select count(*) from public.collectible_templates where name='Shared concurrent version'"),'1');
    console.log('Independent collectors with distinct retry keys converge on one catalog identity PASS.');
    const identityRequest=`select public.contribute_catalog_identity('{"submissionId":"b8070000-0000-4000-8000-000000000020","kind":"group","name":"Concurrent Identity"}');`;
    const identityFirst=session(); identityFirst.proc.stdin.write(start+identityRequest+'\n');
    let identityHeld=false; for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='advisory' and granted"))>0){identityHeld=true;break}await wait(50)}
    assert.ok(identityHeld);
    const identitySecond=session(); identitySecond.proc.stdin.end(start+identityRequest+'commit;\n');
    let identityBlocked=false; for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='advisory' and not granted"))>0){identityBlocked=true;break}await wait(50)}
    assert.ok(identityBlocked);
    identityFirst.proc.stdin.end('commit;\n');
    const identityResults=await Promise.all([identityFirst.done,identitySecond.done]);
    assert.deepEqual(JSON.parse(identityResults[0]),JSON.parse(identityResults[1]));
    assert.deepEqual(JSON.parse(sql(start+identityRequest+'commit;')),JSON.parse(identityResults[0]));
    assert.equal(sql('select count(*) from public.catalog_identity_contributions'),'1');
    console.log('Identity contribution real concurrent retry and lost-response retry PASS.');
    const mediaOwner=sql("select id from public.users where auth_subject='a8050000-0000-4000-8000-000000000020'");
    const mediaJob='b8130000-0000-4000-8000-000000000020';
    sql(`insert into public.media_upload_jobs(owner_id,id,payload) values('${mediaOwner}','${mediaJob}','{"purpose":"post","media":null,"caption":"Concurrent upload","taggedUserIds":[],"taggedTemplateIds":[]}');`);
    const mediaRequest=`select public.complete_media_upload('${mediaOwner}','${mediaJob}');`;
    const mediaStart='begin;set local role service_role;';
    const mediaFirst=session();mediaFirst.proc.stdin.write(mediaStart+mediaRequest+'\n');
    let mediaHeld=false;for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_stat_activity where state='idle in transaction' and query like '%complete_media_upload%'"))>0){mediaHeld=true;break}await wait(50)}assert.ok(mediaHeld);
    const mediaSecond=session();mediaSecond.proc.stdin.end(mediaStart+mediaRequest+'commit;\n');
    let mediaBlocked=false;for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='transactionid' and not granted"))>0){mediaBlocked=true;break}await wait(50)}assert.ok(mediaBlocked,'concurrent completion waits on receipt row');
    mediaFirst.proc.stdin.end('commit;\n');
    const mediaResults=(await Promise.all([mediaFirst.done,mediaSecond.done])).map(JSON.parse);
    assert.deepEqual(mediaResults[0],mediaResults[1]);
    assert.equal(sql(`select count(*) from public.posts where id='${mediaJob}'`),'1');
    assert.deepEqual(JSON.parse(sql(mediaStart+mediaRequest+'commit;')),mediaResults[0],'lost response recovers exact committed post');
    console.log('Direct media real concurrent post completion and lost-response retry PASS.');
    console.log(`${migrations.length} migrations replayed; ${tapCount} pgTAP assertions passed; historical preservation, real two-session concurrency and lost-response retry PASS.`);
    console.log('Disposable database only; hosted Supabase untouched.');
  } finally {try{run(['rm','-f',container])}catch{}}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
