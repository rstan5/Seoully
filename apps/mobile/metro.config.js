const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const domainRoot = path.resolve(repoRoot, "src/domain");
const publicRoot = path.resolve(repoRoot, "public");
const threeModule = path.resolve(projectRoot, "node_modules/three/build/three.module.js");

const config = getDefaultConfig(projectRoot);
const defaultResolve = config.resolver.resolveRequest;

config.watchFolders = [...new Set([
  ...(config.watchFolders ?? []),
  projectRoot,
  domainRoot,
  publicRoot,
])];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "seoully-domain": domainRoot,
  "seoully-public": publicRoot,
};

function resolveDomainFile(subpath) {
  const withoutExt = path.resolve(domainRoot, subpath);
  const candidates = [withoutExt, `${withoutExt}.ts`, `${withoutExt}.tsx`, path.join(withoutExt, "index.ts")];
  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeModule };
  }
  if (moduleName === "seoully-domain" || moduleName.startsWith("seoully-domain/")) {
    const subpath = moduleName === "seoully-domain" ? "." : moduleName.slice("seoully-domain/".length);
    const filePath = resolveDomainFile(subpath);
    if (filePath) return { type: "sourceFile", filePath };
  }
  if (defaultResolve) return defaultResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
