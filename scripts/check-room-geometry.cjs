/** Measure actual authored JSX geometry, excluding transparent hit boxes and shadow decals. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
let THREE;
require("./register-build-alias.cjs");
const { FLOOR_Y, FURNITURE_LOWER_BOUND, furnitureGroundY, DESK_TABLETOP_TOP, DESK_DRAWER_CENTERS, CHAIR_SEAT_TOP, SHELF_BOARD_Y, CASE_BOARD_Y } = require("../.tmp/build/apps/mobile/src/room/roomGrounding.js");
async function main() {
const { RoundedBoxGeometry } = await import("../apps/mobile/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js");
THREE = await import("../apps/mobile/node_modules/three/build/three.module.js");
const source = fs.readFileSync("apps/mobile/src/room/roomEnvironment.tsx", "utf8");
const names = { shelf: "ShelfUnit", desk: "DeskUnit", case: "CaseUnit", chair: "ChairUnit", archive: "ArchiveCrate", rug: "Rug", lamp: "FloorLamp", plant: "Plant", "table-lamp": "TableLamp", "large-plant": "LargePlant" };
const file = ts.createSourceFile("geometry.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && [...Object.values(names), "ChairCushion"].includes(node.name?.text)).map((node) => node.getText(file)).join("\n");
const jsx = (type, props) => ({ type, props: props ?? {} });
const sandbox = { ...require("../.tmp/build/apps/mobile/src/room/roomGrounding.js"), exports: {}, require: () => ({ jsx, jsxs: jsx, Fragment: "group" }), ContactShadow: () => null, EdgeLip: () => null, DESK_DRAWER_CENTERS, CHAIR_SEAT_TOP, SHELF_BOARD_Y, CASE_BOARD_Y, BufferGeometry: THREE.BufferGeometry, Float32BufferAttribute: THREE.Float32BufferAttribute, DoubleSide: THREE.DoubleSide, RoundedBoxGeometry, useMemo: (fn) => fn(), useEffect: () => {}, mixHex: () => "#ffffff" };
vm.createContext(sandbox);
vm.runInContext(ts.transpileModule(functions, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const theme = new Proxy({}, { get: () => "#ffffff" });
function children(node) { return [node.props?.children].flat(Infinity).filter(Boolean); }
function bounds(node, parent = new THREE.Matrix4(), result = new THREE.Box3()) {
  if (!node || typeof node !== "object") return result;
  if (typeof node.type === "function") return bounds(node.type(node.props), parent, result);
  const p = node.props ?? {};
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...(p.position ?? [0,0,0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation ?? [0,0,0]))), new THREE.Vector3(...(Array.isArray(p.scale) ? p.scale : [p.scale ?? 1,p.scale ?? 1,p.scale ?? 1])));
  const world = parent.clone().multiply(matrix);
  if (node.type === "mesh") {
    const parts = children(node);
    if (parts.some((part) => part.type?.endsWith("Material") && part.props.opacity === 0)) return result;
    const part = parts.find((part) => part.type?.endsWith("Geometry") || part.type === "primitive" && part.props.attach === "geometry");
    const args = part?.props.args ?? [];
    const Geometry = { boxGeometry: THREE.BoxGeometry, cylinderGeometry: THREE.CylinderGeometry, sphereGeometry: THREE.SphereGeometry, torusGeometry: THREE.TorusGeometry, circleGeometry: THREE.CircleGeometry, planeGeometry: THREE.PlaneGeometry }[part?.type];
    if (Geometry || part?.props.object) {
      const geometry = part.props.object ?? new Geometry(...args);
      geometry.computeBoundingBox();
      result.union(geometry.boundingBox.clone().applyMatrix4(world));
      geometry.dispose();
    }
  }
  for (const child of children(node)) bounds(child, world, result);
  return result;
}
for (const [kind, name] of Object.entries(names)) {
  const measured = bounds(sandbox[name]({ theme, maps: {} }));
  assert.ok(Math.abs(measured.min.y - FURNITURE_LOWER_BOUND[kind]) < 1e-6, `${kind}: metadata ${FURNITURE_LOWER_BOUND[kind]} matches actual mesh lower bound ${measured.min.y}`);
  const contact = furnitureGroundY(kind) + measured.min.y;
  assert.ok(Math.abs(contact - FLOOR_Y - (kind === "rug" ? 0.002 : 0)) < 1e-6, `${kind} floor contact`);
  console.log(`${kind}: visible bottom ${contact.toFixed(3)} / floor ${FLOOR_Y}`);
}
// Measure the real visible lips too, rather than ignoring them as interaction geometry.
const materialSource = fs.readFileSync("apps/mobile/src/room/roomMaterials.tsx", "utf8");
const materialFile = ts.createSourceFile("materials.tsx", materialSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const lip = materialFile.statements.find((node)=>ts.isFunctionDeclaration(node)&&node.name?.text==="EdgeLip");
const lipCode = ts.transpileModule(lip.getText(materialFile), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInContext(`(function () { ${lipCode} }).call(globalThis);`,sandbox);
sandbox.EdgeLip = sandbox.exports.EdgeLip;
for (const [name,top] of [["ShelfUnit",1.5675],["CaseUnit",1.565]]) {
  const node=sandbox[name]({theme,maps:{}});
  assert.ok(Math.abs(bounds(node).max.y-top)<1e-6,`${name} no visible board/lip protrudes above the connected frame roof`);
  const boards=children(node).filter((child)=>child.type==="group"&&child.props.position?.[2]===(name==="ShelfUnit"?0.12:0.16));
  assert.equal(boards.length,3,`${name} has three interior boards and existing frame roof`);
  assert.ok(boards.every((board)=>bounds(board).max.y<1.54),`${name} interior boards stay within frame`);
}
console.log("Completeness actual Shelf/Case visible boards, lips and connected roof bounds passed");
const { turnRoomObject, rotatedRoomObjectFootprint, defaultRoomObject: floorObject } = require("../.tmp/build/apps/mobile/src/room/roomObjects.js");
for (const [kind,name] of Object.entries(names)) for (const rotateY of Array.from({length:12},(_,i)=>i*30)) {
  const object = floorObject(kind);
  const matrix = new THREE.Matrix4().makeRotationY(rotateY*Math.PI/180);
  const measured = bounds(sandbox[name]({theme,maps:{}}),matrix);
  const footprint = rotatedRoomObjectFootprint({...object,rotateY});
  assert.ok(Math.max(Math.abs(measured.min.x),Math.abs(measured.max.x)) <= footprint.halfX+1e-6, `${kind} ${rotateY} measured X footprint`);
  assert.ok(Math.max(Math.abs(measured.min.z),Math.abs(measured.max.z)) <= footprint.halfZ+1e-6, `${kind} ${rotateY} measured Z footprint`);
  assert.ok(Math.abs(measured.min.y-FURNITURE_LOWER_BOUND[kind])<1e-6,`${kind} stays grounded through turn`);
}
const { composeParentYaw } = require("../.tmp/build/apps/mobile/src/room/roomWorldTransform.js");
for (const degrees of Array.from({length:12},(_,i)=>i*30)) for (const rotation of [{x:0,y:0.3,z:0},{x:0.4,y:0.6,z:-0.2},{x:-Math.PI/2,y:-0.22,z:0}]) {
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),degrees*Math.PI/180).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z)));
  const resolved = composeParentYaw(rotation,degrees);
  const actual = new THREE.Quaternion().setFromEuler(new THREE.Euler(resolved.x,resolved.y,resolved.z));
  assert.ok(expected.angleTo(actual)<1e-6,"parent yaw composes with tilted child/Binder pose exactly once");
  const inverted = composeParentYaw(resolved,-degrees);
  const restored = new THREE.Quaternion().setFromEuler(new THREE.Euler(inverted.x,inverted.y,inverted.z));
  assert.ok(restored.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z)))<1e-6,"inverse parent yaw preserves original pose");
}
console.log("Interaction polish actual 30° bounds, grounding and Three quaternion composition passed");
const lounge = sandbox.ChairUnit({ theme, maps: {} });
const cushions = children(lounge).filter((node) => node.type === sandbox.ChairCushion);
assert.equal(cushions.length, 4, "upholstered base, seat and two arms");
const seat = cushions.find((node) => node.props.position[1] === 0.04);
const seatBounds = bounds(seat);
assert.ok(Math.abs(seatBounds.max.y - CHAIR_SEAT_TOP) < 1e-6, "actual cushion top matches landing height");
assert.ok(seatBounds.max.x - seatBounds.min.x > 0.97, "wider lounge cushion");
const arms = cushions.filter((node) => Math.abs(node.props.position[0]) === 0.6);
assert.equal(arms.length, 2);
assert.ok(arms.every((node) => bounds(node).max.y > seatBounds.max.y), "padded arms above seat");
const back = children(lounge).find((node) => node.type === "group" && node.props.rotation?.[0] < 0);
assert.ok(back && bounds(back).max.y > 1, "substantial relaxed back cushion");
const { defaultRoomObject } = require("../.tmp/build/apps/mobile/src/room/roomObjects.js");
const { nativeRoomSurfaces } = require("../.tmp/build/apps/mobile/src/room/model.js");
const chair = defaultRoomObject("chair");
const landing = nativeRoomSurfaces("geometry", [chair]).find((surface) => surface.id.endsWith("chair-seat"));
assert.equal(chair.kind, "chair");
assert.ok(Math.abs(landing.y - chair.y - seatBounds.max.y) < 1e-6, "landing meets measured cushion");
assert.ok(landing.width <= seat.props.size[0] - 0.13 && landing.depth <= seat.props.size[2] - 0.13, "seat landing excludes rounded edges and arms");
console.log("Micro-polish lounge geometry, feet and measured cushion landing checks passed");
const miniatureSource = fs.readFileSync("apps/mobile/src/room/ShopMiniature.tsx", "utf8");
const miniatureFile = ts.createSourceFile("miniature.tsx", miniatureSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const miniatureFunction = miniatureFile.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ShopMiniature");
Object.assign(sandbox, { Svg: "svg", Rect: "rect", Path: "path", Circle: "circle", Ellipse: "ellipse", G: "group", SHOP_MINIATURES: { chair: "upholstered-armchair" } });
const miniatureCode = ts.transpileModule(miniatureFunction.getText(miniatureFile), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInContext(`(function () { ${miniatureCode} }).call(globalThis);`, sandbox);
const miniatureParts = children(sandbox.exports.ShopMiniature({ kind: "chair" })).flatMap(children);
const paddedMiniArms = miniatureParts.filter((node) => node.type === "rect" && node.props.width === 8 && node.props.height >= 20 && node.props.rx >= 4);
assert.equal(paddedMiniArms.length, 2, "Shop miniature has two rounded padded arms");
assert.ok(miniatureParts.some((node) => node.type === "rect" && node.props.width >= 30 && node.props.height >= 25 && node.props.rx >= 7), "Shop miniature has broad cushioned back");
console.log("Micro-polish actual native Shop lounge silhouette checks passed");

const binderSource = fs.readFileSync("apps/mobile/src/room/NativeOpenBinder.tsx", "utf8");
const binderFile = ts.createSourceFile("binder.tsx",binderSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const standingFunction=binderFile.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="DisplayBinder");
const standingCode=ts.transpileModule(standingFunction.getText(binderFile),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInContext(`(function () { ${standingCode} }).call(globalThis);`,sandbox);
Object.assign(sandbox,require("../.tmp/build/apps/mobile/src/room/binderPresentation.js"));
sandbox.BinderOwnerLabel=()=>null;
const standFunction=binderFile.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="BinderDisplayStand");
const standCode=ts.transpileModule(standFunction.getText(binderFile),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInContext(`(function () { ${standCode} }).call(globalThis);`,sandbox);
const book=sandbox.exports.DisplayBinder({cover:"#f3e8da",paper:"#efe8da"});
const support=sandbox.exports.BinderDisplayStand();
const standingBounds=bounds({type:"group",props:{children:[book,support]}});
const bookBounds=bounds(book);
assert.ok(bookBounds.max.y-bookBounds.min.y<0.4,"closed laid-back Binder has no upright silhouette");
assert.ok(standingBounds.max.z*0.62<0.42 && standingBounds.min.z*0.62> -0.42,"display Binder stays within reserved Desk footprint");
assert.ok(children(support).every(n=>typeof n.props.raycast==='function' && !n.props.onClick),'stand does not participate in picking');
const { CLOSED_BINDER_LOWER_BOUND, CLOSED_BINDER_SCALE }=require("../.tmp/build/apps/mobile/src/room/roomGrounding.js");
assert.ok(Math.abs(standingBounds.min.y-CLOSED_BINDER_LOWER_BOUND)<1e-6,"display stand authored lower bound");
const primary={...defaultRoomObject("desk"),binderDesk:true};const {deskBinderWorld}=require("../.tmp/build/apps/mobile/src/room/roomObjects.js");
assert.ok(Math.abs(deskBinderWorld([primary],primary.id).y + standingBounds.min.y*CLOSED_BINDER_SCALE-primary.y-DESK_TABLETOP_TOP)<1e-6,"visible Binder contacts Desk");
const palm=sandbox.LargePlant({theme});assert.equal(children(palm).filter(n=>n.type==="group").length,8,"eight separate arching fronds");
const flowers=sandbox.Plant({theme,maps:{}});assert.equal(children(flowers).filter(n=>n.type==="group").length,5,"five authored blossoms with stems");
console.log("Content actual Table Lamp/Flower Pot/palm bounds, distinct stems/fronds, and closed display Binder/stand Desk contact passed");

const desk = sandbox.DeskUnit({ theme, maps: {} });
for (const drawer of children(desk).filter((node) => node.type === "group" && node.props.position?.[0] === 0.82)) {
  assert.ok(bounds(drawer).max.y < DESK_TABLETOP_TOP, "actual drawer front/handle stays below tabletop");
}
console.log("Repair 08 actual furniture geometry/contact checks passed");

const representation = require("../.tmp/build/apps/mobile/src/room/representation.js");
const rendererSource = fs.readFileSync("apps/mobile/src/room/NativeRoomRenderer.tsx", "utf8");
const rendererFile = ts.createSourceFile("collectibles.tsx", rendererSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const forms = ["CollectibleForm", "FlatPaperForm", "Cardstock", "PosterForm", "AlbumForm", "VinylForm", "LightstickForm", "PlushieForm", "FigureForm"];
const extracted = rendererFile.statements.filter((n) => ts.isFunctionDeclaration(n) && forms.includes(n.name?.text)).map((n) => n.getText(rendererFile)).join("\n");
sandbox.extentsForGeometry = representation.extentsForGeometry;
sandbox.CachedPersonalMediaFace = () => null;
sandbox.CachedCoverMedia = () => null;
const collectibleCode = ts.transpileModule(extracted, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInContext(`(function () { ${collectibleCode}\nthis.CollectibleForm = CollectibleForm; }).call(globalThis);`, sandbox);
for (const geometry of ["photocard","album","vinyl","book","lightstick","plushie","figure","apparel","ticket","disc-case","memorabilia","generic"]) {
  const mesh = sandbox.CollectibleForm({ item: { geometry, color: "#fff", accent: "#fff", holding: { id: "measurement" } }, selected: false, loadTexture: false });
  const measured = bounds(mesh);
  const lower = representation.visibleLowerBound(geometry, 1, { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(measured.min.y - lower) < 1e-6, `${geometry}: contact metadata matches actual visible lower bound ${measured.min.y} / ${lower}`);
}
console.log("Repair 08 actual collectible lower-bound checks passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
