const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');

function configuration(file) {
  const input = ts.readConfigFile(file, ts.sys.readFile);
  assert.equal(input.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(input.config, ts.sys, process.cwd());
  assert.deepEqual(parsed.errors, []);
  return parsed;
}
const config = configuration('tsconfig.json');
const program = ts.createProgram(config.fileNames, { ...config.options, incremental: false });
const checker = program.getTypeChecker();

test('actual production TypeScript program includes web/server sources without native test imports', () => {
  const files = program.getSourceFiles().map(file => file.fileName.replaceAll('\\', '/'));
  assert.ok(files.some(file => file.endsWith('/src/server/dal/catalog.ts')));
  assert.ok(files.some(file => file.endsWith('/src/app/api/mobile/posts/route.ts')));
  assert.ok(!files.some(file => file.includes('/apps/mobile/')), 'native dependencies must stay outside the web program');
  assert.ok(!config.fileNames.some(file => file.includes('/scripts/')), 'test entry points have independent projects');
});

test('server multipart handlers resolve FormData and get() to DOM declarations', () => {
  for (const route of ['src/app/api/mobile/posts/route.ts', 'src/app/api/mobile/catalog/reference-images/route.ts']) {
    const source = program.getSourceFile(path.resolve(route));
    assert.ok(source, `${route} is typechecked`);
    let formType;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer &&
          node.initializer.getText(source).includes('request.formData()')) {
        formType = checker.getTypeAtLocation(node.name);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(formType, 'real request.formData() variable found');
    const get = checker.getPropertyOfType(formType, 'get');
    assert.ok(get, 'server FormData supports get()');
    assert.ok(formType.symbol.declarations.some(node => node.getSourceFile().fileName.endsWith('/lib.dom.d.ts')));
    assert.ok(!formType.symbol.declarations.some(node => node.getSourceFile().fileName.includes('/react-native/')));
    assert.ok(get.declarations.every(node => node.getSourceFile().fileName.endsWith('/lib.dom.d.ts')));
  }
});

test('native regression configurations retain their independent script and native entry points', () => {
  for (const [file, script, native] of [
    ['tsconfig.check-physical-qa.json', '/scripts/check-physical-qa.ts', '/apps/mobile/src/startup/routing.ts'],
    ['tsconfig.check-slice8.json', '/scripts/check-slice8.ts', '/apps/mobile/src/onboarding/journey.ts'],
  ]) {
    const files = configuration(file).fileNames;
    assert.ok(files.some(name => name.endsWith(script)), `${file} retains its test`);
    assert.ok(files.some(name => name.endsWith(native)), `${file} retains native inputs`);
  }
});
