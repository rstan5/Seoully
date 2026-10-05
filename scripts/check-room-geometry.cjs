/** Measure actual authored JSX geometry, excluding transparent hit boxes and shadow decals. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
let THREE;
require("./register-build-alias.cjs");
const { FLOOR_Y, FURNITURE_LOWER_BOUND, furnitureGroundY, DESK_TABLETOP_TOP, DESK_DRAWER_CENTERS } = require("../.tmp/build/apps/mobile/src/room/roomGrounding.js");
async function main() {
THREE = await import("../apps/mobile/node_modules/three/build/three.module.js");
const source = fs.readFileSync("apps/mobile/src/room/roomEnvironment.tsx", "utf8");
const names = { shelf: "ShelfUnit", desk: "DeskUnit", case: "CaseUnit", chair: "ChairUnit", archive: "ArchiveCrate", rug: "Rug", lamp: "FloorLamp", plant: "Plant" };
const file = ts.createSourceFile("geometry.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && Object.values(names).includes(node.name?.text)).map((node) => node.getText(file)).join("\n");
const jsx = (type, props) => ({ type, props: props ?? {} });
const sandbox = { exports: {}, require: () => ({ jsx, jsxs: jsx, Fragment: "group" }), ContactShadow: () => null, EdgeLip: () => null, DESK_DRAWER_CENTERS };
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
    const part = parts.find((part) => part.type?.endsWith("Geometry"));
    const args = part?.props.args ?? [];
    const Geometry = { boxGeometry: THREE.BoxGeometry, cylinderGeometry: THREE.CylinderGeometry, sphereGeometry: THREE.SphereGeometry }[part?.type];
    if (Geometry) {
      const geometry = new Geometry(...args);
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
