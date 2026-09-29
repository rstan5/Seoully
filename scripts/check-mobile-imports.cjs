#!/usr/bin/env node
/**
 * Fail the native gate if apps/mobile imports something TypeScript can see
 * but Expo Go Metro cannot (Next @/ aliases, escaped repo-root paths, etc.).
 */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const mobileRoot = path.join(repoRoot, "apps/mobile");
const ALLOWED_ALIASES = new Set(["seoully-domain", "seoully-public"]);
const SKIP_DIRS = new Set(["node_modules", ".expo", "dist", "android", "ios", ".git"]);
const IMPORT_RE = /(?:from|import|require|export)\s*(?:type\s+)?(?:["']([^"']+)["'])/g;
const FROM_RE = /\bfrom\s+["']([^"']+)["']/g;
const REQUIRE_RE = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && entry.name !== "metro.config.js") files.push(full);
  }
  return files;
}

function specifiers(source) {
  const found = new Set();
  for (const re of [FROM_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source))) found.add(match[1]);
  }
  void IMPORT_RE;
  return [...found];
}

function aliasName(spec) {
  if (spec.startsWith("@/")) return "@/";
  const slash = spec.indexOf("/");
  return slash === -1 ? spec : spec.slice(0, slash);
}

const failures = [];
for (const file of walk(path.join(mobileRoot, "app")).concat(walk(path.join(mobileRoot, "src")))) {
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(mobileRoot, file);
  for (const spec of specifiers(source)) {
    if (spec.startsWith("@/")) {
      failures.push(`${rel}: Next.js alias "${spec}" is not resolvable by Expo Go Metro`);
      continue;
    }
    if (spec.startsWith("seoully-locale/") || spec === "seoully-locale") {
      failures.push(`${rel}: seoully-locale is not an established Metro boundary`);
      continue;
    }
    const alias = aliasName(spec);
    if (alias.startsWith("seoully-") && !ALLOWED_ALIASES.has(alias)) {
      failures.push(`${rel}: unsupported alias "${spec}"`);
      continue;
    }
    if (spec.startsWith("seoully-domain/") || spec === "seoully-domain" || spec.startsWith("seoully-public/") || spec === "seoully-public") {
      continue;
    }
    if (spec.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), spec);
      const insideMobile = resolved === mobileRoot || resolved.startsWith(`${mobileRoot}${path.sep}`);
      if (!insideMobile) {
        failures.push(`${rel}: relative import "${spec}" escapes apps/mobile`);
      }
    }
  }
}

if (failures.length) {
  console.error("Mobile import-boundary check failed:\n");
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

console.log("Mobile import-boundary check passed.");
