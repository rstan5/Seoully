/** Measure actual authored JSX geometry, excluding transparent hit boxes and shadow decals. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
let THREE;
require("./register-build-alias.cjs");
const { FLOOR_Y, FURNITURE_LOWER_BOUND, furnitureGroundY, DESK_TABLETOP_TOP, DESK_DRAWER_CENTERS, CHAIR_SEAT_TOP } = require("../.tmp/build/apps/mobile/src/room/roomGrounding.js");
async function main() {
const { RoundedBoxGeometry } = await import("../apps/mobile/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js");
THREE = await import("../apps/mobile/node_modules/three/build/three.module.js");
const source = fs.readFileSync("apps/mobile/src/room/roomEnvironment.tsx", "utf8");
const names = { shelf: "ShelfUnit", desk: "DeskUnit", case: "CaseUnit", chair: "ChairUnit", archive: "ArchiveCrate", rug: "Rug", lamp: "FloorLamp", plant: "Plant" };
const file = ts.createSourceFile("geometry.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && [...Object.values(names), "ChairCushion"].includes(node.name?.text)).map((node) => node.getText(file)).join("\n");
const jsx = (type, props) => ({ type, props: props ?? {} });
const sandbox = { exports: {}, require: () => ({ jsx, jsxs: jsx, Fragment: "group" }), ContactShadow: () => null, EdgeLip: () => null, DESK_DRAWER_CENTERS, CHAIR_SEAT_TOP, RoundedBoxGeometry, useMemo: (fn) => fn(), useEffect: () => {}, mixHex: () => "#ffffff" };
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
    const Geometry = { boxGeometry: THREE.BoxGeometry, cylinderGeometry: THREE.CylinderGeometry, sphereGeometry: THREE.SphereGeometry }[part?.type];
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
const { turnRoomObject, rotatedRoomObjectFootprint, defaultRoomObject: floorObject } = require("../.tmp/build/apps/mobile/src/room/roomObjects.js");
for (const [kind,name] of Object.entries(names)) for (const rotateY of [0,90,180,270]) {
  const object = floorObject(kind);
  const matrix = new THREE.Matrix4().makeRotationY(rotateY*Math.PI/180);
  const measured = bounds(sandbox[name]({theme,maps:{}}),matrix);
  const footprint = rotatedRoomObjectFootprint({...object,rotateY});
  assert.ok(Math.max(Math.abs(measured.min.x),Math.abs(measured.max.x)) <= footprint.halfX+1e-6, `${kind} ${rotateY} measured X footprint`);
  assert.ok(Math.max(Math.abs(measured.min.z),Math.abs(measured.max.z)) <= footprint.halfZ+1e-6, `${kind} ${rotateY} measured Z footprint`);
  assert.ok(Math.abs(measured.min.y-FURNITURE_LOWER_BOUND[kind])<1e-6,`${kind} stays grounded through turn`);
}
const { composeParentYaw } = require("../.tmp/build/apps/mobile/src/room/roomWorldTransform.js");
for (const degrees of [0,90,180,270]) for (const rotation of [{x:0,y:0.3,z:0},{x:0.4,y:0.6,z:-0.2},{x:-Math.PI/2,y:-0.22,z:0}]) {
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),degrees*Math.PI/180).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z)));
  const resolved = composeParentYaw(rotation,degrees);
  const actual = new THREE.Quaternion().setFromEuler(new THREE.Euler(resolved.x,resolved.y,resolved.z));
  assert.ok(expected.angleTo(actual)<1e-6,"parent yaw composes with tilted child/Binder pose exactly once");
  const inverted = composeParentYaw(resolved,-degrees);
  const restored = new THREE.Quaternion().setFromEuler(new THREE.Euler(inverted.x,inverted.y,inverted.z));
  assert.ok(restored.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z)))<1e-6,"inverse parent yaw preserves original pose");
}
console.log("Interaction polish actual quarter-turn bounds, grounding and Three quaternion composition passed");
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
Object.assign(sandbox, { Svg: "svg", Rect: "rect", Path: "path", Circle: "circle", Ellipse: "ellipse", SHOP_MINIATURES: { chair: "upholstered-armchair" } });
const miniatureCode = ts.transpileModule(miniatureFunction.getText(miniatureFile), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInContext(`(function () { ${miniatureCode} }).call(globalThis);`, sandbox);
const miniatureParts = children(sandbox.exports.ShopMiniature({ kind: "chair" })).flatMap(children);
const paddedMiniArms = miniatureParts.filter((node) => node.type === "rect" && node.props.width === 8 && node.props.height >= 20 && node.props.rx >= 4);
assert.equal(paddedMiniArms.length, 2, "Shop miniature has two rounded padded arms");
assert.ok(miniatureParts.some((node) => node.type === "rect" && node.props.width >= 30 && node.props.height >= 25 && node.props.rx >= 7), "Shop miniature has broad cushioned back");
console.log("Micro-polish actual native Shop lounge silhouette checks passed");
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
