/** Local contract/runtime tests. SQL source assertions are NOT a PostgreSQL replay. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');

function load(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, ...globals, require(name) {
    if (name === 'server-only') return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return require(name);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, sandbox, { filename: file });
  return module.exports;
}
const contract = load('src/domain/room-object-schema.ts');
const privacy = load('src/domain/public-room-layout.ts', { './room-object-schema': contract });
const roomSchema = load('src/server/dal/room-schema.ts', { '../../domain/room-object-schema': contract });
const dalSource = fs.readFileSync('src/server/dal/rooms.ts', 'utf8');
const schemaStart = dalSource.indexOf('const uuid =');
const schemaEnd = dalSource.indexOf('export interface RoomDTO');
const schemas = { exports: {}, z, ...contract };
vm.runInNewContext(ts.transpileModule(dalSource.slice(schemaStart, schemaEnd)
  + '\nexports.style=roomStyleSchema; exports.layout=roomLayoutSchema;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, schemas);
const roomId = 'a1000000-0000-4000-8000-000000000001';
const placementId = 'b2000000-0000-4000-8000-000000000002';
const holdingId = 'abcdef00-0000-4000-8000-000000000003';
const style = { ...roomSchema.DEFAULT_NATIVE_ROOM_STYLE };
function validStyle(value) { return schemas.exports.style.safeParse({ roomId, style: value }).success; }
assert.ok(validStyle(style));
assert.ok(validStyle(Object.fromEntries(Object.entries(style).filter(([key]) => key !== 'binder'))));
for (const binder of Object.keys(contract.ROOM_BINDER_COLORS)) assert.ok(validStyle({ ...style, binder }));
for (const invalid of [{ ...style, privateMetadata: 'hidden' }, { ...style, wall: 3 },
  { ...style, binder: null }, { ...style, floor: 'unsupported' }, { ...style, brightness: [] }]) assert.equal(validStyle(invalid), false);
assert.equal(roomSchema.nativeRoomStyleFromRow({ style: { ...style, binder: undefined } }).binder, 'cream');

const objects = contract.ROOM_OBJECT_KINDS.flatMap((kind, i) => [0, 1].map(copy => ({
  id: `${kind}-${copy}`, kind, x: i / 2, y: -1, z: -2, rotateY: contract.ROOM_YAWS[i],
})));
objects.find(o => o.id === 'desk-0').binderDesk = true;
objects.find(o => o.id === 'table-lamp-0').parent = { objectId: 'desk-0', surfaceId: 'desk' };
objects.find(o => o.id === 'plant-0').parent = { objectId: 'shelf-1', surfaceId: 'shelf-bay-1' };
objects.find(o => o.id === 'photo-string-0').photoString = { slots: [holdingId.toUpperCase(), null, null, null, null] };
objects.find(o => o.id === 'photo-string-1').photoString = { slots: [null, holdingId, null, null, null] };
const layout = { version: 1, firstRoomEditCompleted: false, objects };
function validLayout(value) { return schemas.exports.layout.safeParse({ roomId, layout: value }).success; }
assert.ok(validLayout(layout));
assert.equal(schemas.exports.layout.parse({ roomId, layout }).layout.objects.find(o => o.id === 'photo-string-0').photoString.slots[0], holdingId);
for (const rotateY of contract.ROOM_YAWS) assert.ok(validLayout({ ...layout, objects: [{ id: 'a', kind: 'chair', x: 0, y: 0, z: 0, rotateY }] }));
for (const patch of [{ x: undefined }, { y: '0' }, { z: [] }, { x: 21 }, { rotateY: '30' }, { rotateY: 31 },
  { parent: { objectId: 'desk-0', surfaceId: 'desk', metadata: 'private' } },
  { kind: 'closet' }, { binderDesk: false }, { privateMetadata: 'hidden' }]) {
  const mutated = objects.map(o => o.id === 'table-lamp-0' ? { ...o, ...patch } : o);
  assert.equal(validLayout({ ...layout, objects: mutated }), false, JSON.stringify(patch));
}
assert.equal(validLayout({ ...layout, firstRoomEditCompleted: 'true' }), false);
assert.equal(validLayout({ ...layout, privateMetadata: 'hidden' }), false);
assert.equal(validLayout({ ...layout, objects: [...objects, objects[0]] }), false);
assert.equal(validLayout({ ...layout, objects: objects.map(o => o.id === 'photo-string-0' ? { ...o, photoString: { slots: [holdingId, holdingId.toUpperCase(), null, null, null] } } : o) }), false);
assert.equal(JSON.stringify(privacy.publicVisualRoomLayout({})), '{}');
const projected = privacy.publicVisualRoomLayout(layout);
assert.equal(projected.objects.length, 24);
assert.ok(!JSON.stringify(projected).includes(holdingId));
assert.ok(!JSON.stringify(projected).includes('photoString'));
assert.equal(privacy.publicRoomVisualTransform({ x: 2, scale: 1, y: '2', metadata: 'hidden' }).x, 2);
assert.equal(JSON.stringify(privacy.publicRoomVisualTransform({ x: 2, scale: 1, y: '2', metadata: 'hidden' })), '{"x":2,"scale":1}');

const sql02 = fs.readFileSync('supabase/migrations/20261002000000_native_room_theme.sql', 'utf8');
const sql03 = fs.readFileSync('supabase/migrations/20261003000000_native_room_style.sql', 'utf8');
const sql04 = fs.readFileSync('supabase/migrations/20261004000000_native_room_layout.sql', 'utf8');
const stripComments = s => s.replace(/--[^\n]*/g, '');
assert.equal(stripComments(sql02).trim(), 'select 1;');
function body(sql, name) {
  const match = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, 'i'));
  assert.ok(match, name); return match[1];
}
const styleBody = body(sql03, 'room_style_is_valid');
assert.match(styleBody, /p - array\['wall','floor','furniture','rug','light','brightness','binder'\]/);
assert.match(styleBody, /jsonb_typeof\(p->k\) is distinct from 'string'/);
for (const value of Object.values(style)) assert.ok(styleBody.includes(`'${value}'`));
for (const [key, field] of Object.entries(schemas.exports.style.shape.style.shape)) {
  const options = (key === 'binder' ? field.unwrap() : field).options;
  const match = styleBody.match(new RegExp(`p->>'${key}' in \\(([^)]+)\\)`));
  assert.ok(match, `SQL Style enum ${key}`);
  const sqlValues = [...match[1].matchAll(/'([^']+)'/g)].map(value => value[1]);
  assert.deepEqual(sqlValues.sort(), [...options].sort(), `Style enum parity: ${key}`);
}
const layoutBody = body(sql04, 'room_layout_is_valid');
assert.match(layoutBody, /p = '\{\}'::jsonb then return true/);
assert.match(layoutBody, /jsonb_typeof\(p->'firstRoomEditCompleted'\) is distinct from 'boolean'/);
assert.match(layoutBody, /obj - array\['id','kind','x','y','z','rotateY','parent','binderDesk','photoString'\]/);
assert.match(layoutBody, /jsonb_typeof\(obj->k\) is distinct from 'number'/);
assert.match(layoutBody, /not between -20 and 20/);
for (const kind of contract.ROOM_OBJECT_KINDS) assert.ok(layoutBody.includes(`'${kind}'`));
const sqlKinds = layoutBody.match(/coalesce\(obj->>'kind', ''\) not in \(([^)]+)\)/)[1];
assert.deepEqual([...sqlKinds.matchAll(/'([^']+)'/g)].map(value => value[1]).sort(), [...contract.ROOM_OBJECT_KINDS].sort());
for (const surfaces of Object.values(contract.ROOM_CARRIER_SURFACES)) {
  for (const surface of surfaces) assert.ok(layoutBody.includes(`'${surface}'`), `SQL parent surface parity: ${surface}`);
}
assert.match(layoutBody, /not in \(0,30,60,90,120,150,180,210,240,270,300,330\)/);
assert.match(layoutBody, /jsonb_array_length\(slots\) <> 5/);
assert.match(layoutBody, /lower\(slot #>> '\{\}'\) = any\(ids\)/);
for (const sql of [sql03, sql04]) {
  const rpc = body(sql, 'get_public_room_by_handle');
  assert.match(rpc, /p\.collection_public and r\.id is not null/);
  assert.match(rpc, /auth\.uid\(\) is not null/);
  assert.match(rpc, /from \([\s\S]*select placed\.\*[\s\S]*order by placed\.updated_at desc, placed\.id limit 500\s*\) rp/);
  assert.match(rpc, /order by rp\.updated_at desc, rp\.id/);
  assert.match(rpc, /owned\.owner_user_id = p\.user_id/);
  assert.match(rpc, /visible\.status <> 'restricted'/);
  assert.match(rpc, /public\.public_room_visual_style\(r\.style\)/);
  assert.match(rpc, /public\.public_room_visual_transform\(rp\.transform\)/);
  assert.ok(!/mediaPath|mediaBucket|storage_path|storage_bucket[\s]*'\s*,/.test(rpc));
  assert.ok(!rpc.includes("'holdingId'"));
  assert.match(sql, /revoke all on function public\.get_public_room_by_handle\(text\) from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function public\.get_public_room_by_handle\(text\) to authenticated/);
  assert.ok(!/create policy|disable row level security|grant .* on .*public\.holdings/i.test(sql));
  assert.ok(!/^(begin|commit);/mi.test(sql));
}
const locatorSQL = body(sql03, 'get_public_room_media_locations');
assert.match(locatorSQL, /p\.collection_public/);
assert.match(locatorSQL, /ma\.owner_user_id = r\.owner_user_id/);
assert.match(locatorSQL, /ct\.status <> 'restricted'/);
assert.match(locatorSQL, /order by rp\.updated_at desc, rp\.id limit 500/);
assert.match(locatorSQL, /where rp\.id = any\(p_placement_ids\)/);
assert.match(sql03, /revoke all on function public\.get_public_room_media_locations\(uuid, uuid\[\]\) from public, anon, authenticated, service_role/);
assert.match(sql03, /grant execute on function public\.get_public_room_media_locations\(uuid, uuid\[\]\) to service_role/);
assert.match(sql03, /get_public_room_media_locations[^]*?security invoker/);
const storageAuth = body(sql03, 'can_view_public_collectible_media');
assert.match(sql03, /can_view_public_collectible_media\(p_bucket text, p_path text\)\s*returns boolean language sql stable security definer set search_path = pg_catalog/);
assert.match(storageAuth, /auth\.uid\(\) is not null/);
assert.match(storageAuth, /p_bucket = 'collectible-media'/);
assert.match(storageAuth, /h\.owner_user_id = ma\.owner_user_id/);
assert.match(storageAuth, /r\.owner_user_id = h\.owner_user_id/);
assert.match(storageAuth, /p\.collection_public/);
assert.match(storageAuth, /ct\.status <> 'restricted'/);
assert.match(storageAuth, /ma\.storage_bucket = p_bucket and ma\.storage_path = p_path/);
assert.match(storageAuth, /split_part\(p_path, '\/', 1\) = ma\.owner_user_id::text/);
assert.match(storageAuth, /order by placed\.updated_at desc, placed\.id limit 500/);
assert.match(sql03, /revoke all on function public\.can_view_public_collectible_media\(text, text\) from public, anon, authenticated, service_role/);
assert.match(sql03, /grant execute on function public\.can_view_public_collectible_media\(text, text\) to authenticated/);
assert.match(sql04, /h\.id = public\.room_holding_uuid\(chosen\.value #>> '\{\}'\)/);
assert.match(body(sql04, 'room_holding_uuid'), /then return null; end if;\s*return p::uuid/);
assert.match(body(sql04, 'validate_room_photo_string_holdings'), /h\.owner_user_id = new\.owner_user_id/);
assert.match(body(sql04, 'validate_room_photo_string_holdings'), /ct\.kind = 'photocard' and ct\.status <> 'restricted'/);

(async () => {
  let lookups = 0, signs = [], capturedClientOptions;
  const env = { SUPABASE_URL: 'https://local.example.invalid', SUPABASE_SECRET_KEY: 'test-only-placeholder' };
  const media = load('src/server/dal/public-room-media.ts', {
    '@supabase/supabase-js': { createClient(url, key, options) {
      assert.equal(url, env.SUPABASE_URL); assert.equal(key, env.SUPABASE_SECRET_KEY); capturedClientOptions = options;
      return { async rpc(name, args) {
        lookups++; assert.equal(name, 'get_public_room_media_locations'); assert.equal(args.p_room_id, roomId);
        assert.deepEqual([...args.p_placement_ids], [placementId]);
        return { data: [{ placementId, bucket: 'collectible-media', path: 'owner/public.jpg' },
          { placementId: roomId, bucket: 'collectible-media', path: 'unrequested/private.jpg' },
          { placementId, bucket: 'private-other-bucket', path: 'private.jpg' }], error: null };
      } };
    } },
  }, { process: { env } });
  const viewer = { storage: { from(bucket) {
    assert.equal(bucket, 'collectible-media'); return { async createSignedUrl(path, seconds) {
      signs.push(path); assert.equal(seconds, 300); return { data: { signedUrl: 'https://authorized.example/image' } };
    } };
  } } };
  assert.equal((await media.signPublicRoomMedia(viewer, roomId, [])).size, 0);
  assert.equal(lookups, 0);
  const urls = await media.signPublicRoomMedia(viewer, roomId, [placementId, placementId]);
  assert.deepEqual(signs, ['owner/public.jpg']); assert.equal(urls.get(placementId), 'https://authorized.example/image');
  assert.equal(capturedClientOptions.auth.persistSession, false);
  await assert.rejects(() => media.signPublicRoomMedia(viewer, 'null', [placementId]));
  env.SUPABASE_SECRET_KEY = '';
  await assert.rejects(() => media.signPublicRoomMedia(viewer, roomId, [placementId]), /public_room_media_configuration_missing/);

  let brokerCalls = 0;
  const publicDal = load('src/server/dal/public-room.ts', {
    './public-room-media': { async signPublicRoomMedia(client, id, ids) {
      brokerCalls++; assert.equal(client, publicClient); assert.equal(id, roomId);
      assert.deepEqual([...ids], [placementId]); return new Map([[placementId, 'https://authorized.example/image']]);
    } }, './room-schema': roomSchema, '@/domain/public-room-layout': privacy,
    '@/server/dal/catalog-reference-images': { async listActiveCatalogReferenceImages() { return []; } },
    '@/server/supabase/server': {}, '@/server/dal/profile': {},
  });
  let response = { owner: { userId: holdingId, handle: 'collector', displayName: 'Collector' }, room: null, private: false };
  const publicClient = { auth: { async getUser() { return { data: { user: { id: roomId } } }; } },
    async rpc(name) { assert.equal(name, 'get_public_room_by_handle'); return { data: response, error: null }; } };
  const missing = await publicDal.getPublicRoomByHandle('collector', publicClient);
  assert.equal(missing.room, null); assert.equal(missing.private, false); assert.equal(brokerCalls, 0);
  response = { ...response, room: { id: null } };
  assert.equal((await publicDal.getPublicRoomByHandle('collector', publicClient)).room, null);
  response = { ...response, room: { id: 'null' } };
  assert.equal((await publicDal.getPublicRoomByHandle('collector', publicClient)).room, null);
  response = { ...response, private: true, room: { id: roomId } };
  assert.equal((await publicDal.getPublicRoomByHandle('collector', publicClient)).room, null); assert.equal(brokerCalls, 0);
  response = { ...response, private: false, room: { id: roomId, style: { ...style, privateMetadata: 'hidden' }, layout,
    placements: [{ id: placementId, zoneId: 'shelf', slot: 0, offset: { x: 1, metadata: 'hidden' }, transform: { x: 2 },
      holding: { templateId: holdingId, hasPersonalMedia: true, mediaPath: 'private/path', mediaBucket: 'private/bucket',
        privateMetadata: 'hidden', template: { id: holdingId, name: 'Safe', kind: 'album', privateMetadata: 'hidden' } } }],
    photoStringCards: [{ objectId: 'photo-string-0', slot: 0, templateId: holdingId, holdingId, mediaPath: 'private/path',
      template: { id: holdingId, kind: 'photocard', name: 'Card', privateMetadata: 'hidden' } }],
  } };
  const dto = await publicDal.getPublicRoomByHandle('collector', publicClient);
  assert.equal(dto.room.placements[0].holding.personalMediaUrl, 'https://authorized.example/image');
  assert.ok(!/private\/path|private\/bucket|hidden|hasPersonalMedia|holdingId/.test(JSON.stringify(dto)));
  assert.equal(dto.room.style.binder, 'cream'); assert.equal(dto.room.layout.objects.length, 24);
  // Connect both real DAL modules. Only external SDK/Storage boundaries are mocked.
  env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
  const connectedDal = load('src/server/dal/public-room.ts', {
    './public-room-media': media, './room-schema': roomSchema, '@/domain/public-room-layout': privacy,
    '@/server/dal/catalog-reference-images': { async listActiveCatalogReferenceImages() { return []; } },
    '@/server/supabase/server': {}, '@/server/dal/profile': {},
  });
  const connectedDto = await connectedDal.getPublicRoomByHandle('collector', { ...publicClient, ...viewer });
  assert.equal(connectedDto.room.placements[0].holding.personalMediaUrl, 'https://authorized.example/image');
  assert.ok(!/owner\/public.jpg|private\/path|private\/bucket|hasPersonalMedia/.test(JSON.stringify(connectedDto)));
  const deniedDto = await connectedDal.getPublicRoomByHandle('collector', { ...publicClient,
    storage: { from() { return { async createSignedUrl() { return { data: null, error: { message: 'denied' } }; } }; } },
  });
  assert.equal(deniedDto.room.placements[0].holding.personalMediaUrl, undefined, 'denied viewer signing cannot produce a public image');
  await assert.rejects(() => publicDal.getPublicRoomByHandle('collector', { ...publicClient,
    auth: { async getUser() { return { data: { user: null } }; } } }), /unauthenticated/);
  console.log('Room persistence: actual TypeScript contracts, mocked media/DAL authorization, and SQL source guards passed (SQL replay not performed).');
})().catch(error => { console.error(error); process.exitCode = 1; });
