#!/usr/bin/env node
/**
 * Native runtime-hardening gate.
 *
 * Distinguishes graphs that previously got collapsed:
 *   TypeScript ≠ Expo Go / DEV Metro ≠ production iOS ≠ production Android
 *
 * Demo modules are __DEV__-only. A production export that omits them is not
 * proof Expo Go can resolve the Demo Ask/notices/Send-to graph.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const mobileRoot = path.join(repoRoot, "apps/mobile");
const outRoot = path.join(repoRoot, ".tmp/mobile-verify");

function fail(message) {
  console.error(`\nmobile:verify FAILED — ${message}`);
  process.exit(1);
}

function run(label, command, args, cwd = mobileRoot) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) fail(`${label} exited ${result.status}`);
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function expoExport(label, { platform, dev, dir }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const args = ["expo", "export", "--platform", platform, "--output-dir", dir, "--clear"];
  if (dev) args.push("--dev");
  return run(label, "npx", args);
}

function findBundle(dir, ext) {
  function walk(current, hits = []) {
    if (!fs.existsSync(current)) return hits;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, hits);
      else if (entry.name.endsWith(ext)) hits.push(full);
    }
    return hits;
  }
  return walk(dir);
}

function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`${label} missing ${JSON.stringify(needle)}`);
}

function assertAbsent(haystack, needle, label) {
  if (haystack.includes(needle)) fail(`${label} unexpectedly contains ${JSON.stringify(needle)}`);
}

console.log("Seoully mobile:verify");
console.log(`repo  ${repoRoot}`);
console.log(`tmp   ${outRoot}`);
console.log(`host  ${os.platform()}`);

run("import-boundary", "node", [path.join(repoRoot, "scripts/check-mobile-imports.cjs")], repoRoot);
run("slice-1 honesty", "npm", ["run", "check:slice1"], repoRoot);
run("slice-2 own collector", "npm", ["run", "check:slice2"], repoRoot);
run("slice-3 collection graph", "npm", ["run", "check:slice3"], repoRoot);
run("slice-4 discover search", "npm", ["run", "check:slice4"], repoRoot);
run("mobile TypeScript", "npx", ["tsc", "--noEmit"]);
run("Expo lint", "npx", ["expo", "lint"]);
run("Expo Doctor", "npx", ["expo-doctor"]);

const iosDevDir = path.join(outRoot, "ios-dev");
const iosDevLog = expoExport("DEV iOS Metro (__DEV__ === true)", { platform: "ios", dev: true, dir: iosDevDir });
const iosDevBundles = findBundle(iosDevDir, ".js");
if (!iosDevBundles.length) fail("DEV iOS export produced no JS bundle");
const iosDevJs = iosDevBundles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

assertContains(iosDevJs, "src/data/demo/ask.ts", "DEV iOS graph");
assertContains(iosDevJs, "askDemo", "DEV iOS graph");
assertContains(iosDevJs, "DemoSocialRepository", "DEV iOS graph");
assertContains(iosDevJs, "searchShareRecipients", "DEV iOS graph");
assertContains(iosDevJs, "loadNotices", "DEV iOS graph");
assertContains(iosDevLog, "minji.png", "DEV iOS asset list");
assertAbsent(iosDevJs, '"@/locale/translate"', "DEV iOS graph");
assertAbsent(iosDevJs, '"@/domain/', "DEV iOS graph");
assertContains(iosDevJs, "seoully-domain/assistant-tools", "DEV iOS graph");
assertContains(iosDevJs, "../../src/locale/translate.ts", "DEV iOS graph");
console.log("DEV iOS graph includes Demo Ask, DemoSocialRepository, notices, Send-to, and resolved locale/translate.");

const iosProdDir = path.join(outRoot, "ios-prod");
const iosProdLog = expoExport("production iOS Metro", { platform: "ios", dev: false, dir: iosProdDir });
assertAbsent(iosProdLog, "minji.png", "production iOS asset list");
assertAbsent(iosProdLog, "public/avatars", "production iOS asset list");
assertAbsent(iosProdLog, "public/posts", "production iOS asset list");
const iosProdJs = findBundle(iosProdDir, ".js").concat(findBundle(iosProdDir, ".hbc"));
if (!iosProdJs.length) fail("production iOS export produced no JS/Hermes bundle");
console.log("production iOS graph excluded Demo fixture assets.");

const androidProdDir = path.join(outRoot, "android-prod");
const androidProdLog = expoExport("production Android Metro", { platform: "android", dev: false, dir: androidProdDir });
assertAbsent(androidProdLog, "minji.png", "production Android asset list");
assertAbsent(androidProdLog, "public/avatars", "production Android asset list");
assertAbsent(androidProdLog, "public/posts", "production Android asset list");
const androidProdJs = findBundle(androidProdDir, ".js").concat(findBundle(androidProdDir, ".hbc"));
if (!androidProdJs.length) fail("production Android export produced no JS/Hermes bundle");
console.log("production Android graph excluded Demo fixture assets.");

console.log("\nmobile:verify passed.");
console.log("Graphs checked: TypeScript, Expo Go/DEV iOS Metro, production iOS, production Android.");
