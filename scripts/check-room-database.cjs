/** Disposable in-memory PostgreSQL only. No URL, credentials, or remote connection.
 * Usage: node scripts/check-room-database.cjs /absolute/pglite-module /absolute/pgtap.sql.in
 * External tools stay outside the repository; see the repair document for setup.
 * Supabase Auth/Storage service schemas below are minimal test substitutes.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const [modulePath, tapPath] = process.argv.slice(2);
  if (!modulePath || !tapPath || !path.isAbsolute(modulePath) || !path.isAbsolute(tapPath)) {
    throw new Error('Supply absolute local PGlite module and official pgTAP SQL template paths');
  }
  const { PGlite } = require(modulePath);
  const db = new PGlite();
  try {
    await db.exec(fs.readFileSync('supabase/tests/bootstrap.sql', 'utf8'));
    const migrations = fs.readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort();
    for (const file of migrations) {
      // One transaction per migration, as required by the pending chain.
      try {
        await db.exec(`begin;\n${fs.readFileSync(path.join('supabase/migrations', file), 'utf8')}\ncommit;`);
      } catch (error) {
        throw new Error(`Local replay failed: ${file}: ${error.message}`, { cause: error });
      }
    }
    // pgTAP's distributed SQL template has two build-time substitutions. Version
    // is unused by these tests; 0 identifies this source-template installation.
    const tap = fs.readFileSync(tapPath, 'utf8').replaceAll('__OS__', 'wasm').replaceAll('__VERSION__', '0');
    await db.exec(tap);
    const results = await db.exec(fs.readFileSync('supabase/tests/room_persistence.test.sql', 'utf8'));
    const lines = results.flatMap(result => result.rows.flatMap(row => Object.values(row)))
      .filter(value => typeof value === 'string' && /^(?:ok |not ok |1\.\.|#)/.test(value));
    const failures = lines.filter(line => /^not ok /.test(line));
    if (failures.length) console.error(failures.join('\n'));
    assert.equal(failures.length, 0, 'pgTAP failures');
    const passed = lines.filter(line => /^ok /.test(line)).length;
    assert.ok(passed > 200, 'pgTAP actually executed the Room suite');
    assert.ok(lines.some(line => line === `1..${passed}`), 'pgTAP completion plan matches');
    const { rows } = await db.query('select count(*)::integer n from public.rooms');
    assert.equal(rows[0].n, 0, 'test fixtures were rolled back');
    console.log(`Disposable PGlite PostgreSQL: ${migrations.length} migrations replayed; ${passed} pgTAP assertions passed; fixtures rolled back.`);
    console.log('Auth/Storage schemas are substitutes. Hosted Storage HTTP signing and deployment are not verified by this test.');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
