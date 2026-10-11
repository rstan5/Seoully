const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name) });
  return module.exports;
}
const { PHOTOCARD, photocardCoverUV } = load('apps/mobile/src/media/photocard.ts');
const binder = fs.readFileSync('apps/mobile/src/room/NativeOpenBinder.tsx', 'utf8');
const three = import('../apps/mobile/node_modules/three/build/three.module.js');
async function face() {
  const THREE = await three;
  const source = ts.createSourceFile('binder.tsx', binder, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'CardFace');
  const jsx = (type, props) => ({ type, props });
  const sandbox = { exports: {}, require: () => ({ jsx, jsxs: jsx }), useLoader: () => new THREE.Texture(),
    TextureLoader: THREE.TextureLoader, nativeCardTexture: t => t, useMemo: f => f(), useEffect: () => {},
    CARD_W: PHOTOCARD.width, CARD_H: PHOTOCARD.height };
  vm.runInNewContext(ts.transpileModule(declaration.getText(source), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText + ';exports.face=CardFace;', sandbox);
  return { THREE, tree: sandbox.exports.face({ uri: 'file:///fixture.jpg', onReady() {}, onError() {} }) };
}
test('actual textured face spans both physical card edges, with no inset or overhang', async () => {
  const { THREE, tree } = await face();
  const geometry = new THREE.PlaneGeometry(...tree.props.children[0].props.args);
  const card = new THREE.BoxGeometry(PHOTOCARD.width, PHOTOCARD.height, .012);
  geometry.computeBoundingBox(); card.computeBoundingBox();
  for (const axis of ['x', 'y']) {
    assert.equal(geometry.boundingBox.min[axis], card.boundingBox.min[axis]);
    assert.equal(geometry.boundingBox.max[axis], card.boundingBox.max[axis]);
  }
  assert.equal(tree.props.children[1].props.toneMapped, false);
  assert.ok(tree.props.position[2] > .006, 'separated from body front to avoid z-fighting');
  assert.ok(tree.props.position[2] < .009, 'preserves approved face depth');
  geometry.dispose(); card.dispose();
});
test('old 92% geometry demonstrably misses both left and right edge rays; repaired face covers them', async () => {
  const { THREE, tree } = await face();
  const material = new THREE.MeshBasicMaterial();
  const current = new THREE.Mesh(new THREE.PlaneGeometry(...tree.props.children[0].props.args), material);
  const previous = new THREE.Mesh(new THREE.PlaneGeometry(PHOTOCARD.width * .92, PHOTOCARD.height * .92), material);
  current.updateMatrixWorld(); previous.updateMatrixWorld();
  for (const sign of [-1, 1]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(sign * PHOTOCARD.width * .49, 0, 1), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(previous).length, 0);
    assert.ok(ray.intersectObject(current).length > 0);
    ray.ray.origin.x = sign * PHOTOCARD.width * .51;
    assert.equal(ray.intersectObject(current).length, 0, 'no photo beyond card');
  }
  current.geometry.dispose(); previous.geometry.dispose(); material.dispose();
});
for (const [name, width, height] of [['tall asymmetric portrait', 601, 1501], ['wide asymmetric portrait', 901, 1201], ['landscape', 1601, 901], ['square', 1001, 1001]]) {
  test(`${name}: cover samples stay inside image and preserve centered, correctly oriented left/right detail`, async () => {
    const THREE = await three;
    const { nativeCardTexture } = load('apps/mobile/src/media/nativeCardTexture.ts', {
      three: THREE, '../room/roomMaterials': { prepCollectibleTexture: t => t }, './photocard': { photocardCoverUV },
    });
    const original = new THREE.Texture({ data: { localUri: 'file:///asymmetric.jpg' }, width, height });
    original.isDataTexture = true; original.flipY = true;
    const texture = nativeCardTexture(original); texture.updateMatrix();
    const left = texture.transformUv(new THREE.Vector2(0, .5));
    const right = texture.transformUv(new THREE.Vector2(1, .5));
    assert.ok(left.x >= 0 && right.x <= 1 && right.x > left.x);
    assert.ok(Math.abs(left.x + right.x - 1) < 1e-12, 'centered, no one-sided offset');
    assert.ok(Math.abs(width * texture.repeat.x / (height * texture.repeat.y) - 24 / 37) < 1e-12, 'no stretching');
    // Asymmetric synthetic image: red increases left→right; blue increases top→bottom.
    const sample = uv => ({ red: uv.x, blue: uv.y });
    assert.ok(sample(right).red > sample(left).red, 'horizontal detail is never mirrored');
    const top = texture.transformUv(new THREE.Vector2(.5, 1));
    const bottom = texture.transformUv(new THREE.Vector2(.5, 0));
    assert.ok(sample(top).blue < sample(bottom).blue, 'preserves native flipY convention');
    assert.equal(texture.isDataTexture, true);
    assert.equal(texture.image.data.localUri, original.image.data.localUri);
    assert.equal(original.repeat.x, 1, 'loader cache remains unchanged');
    texture.dispose(); original.dispose();
  });
}
test('native loader compatibility and one continuously mounted Binder card remain intact', () => {
  const native = fs.readFileSync('apps/mobile/node_modules/@react-three/fiber/native/dist/react-three-fiber-native.esm.js', 'utf8');
  assert.match(native, /texture.isDataTexture = true/);
  assert.match(native, /texture.flipY = true/);
  assert.match(binder, /pocket.holding \? <PocketCard/);
  assert.doesNotMatch(binder, /InspectedBinderCard|keepFlight|CARD_W \* 0.92/);
  assert.match(binder, /useMemo\(\(\) => nativeCardTexture\(texture\), \[texture\]\)/);
});
