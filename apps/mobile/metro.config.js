const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const domainRoot = path.resolve(repoRoot, "src/domain");
const localeRoot = path.resolve(repoRoot, "src/locale");
const publicRoot = path.resolve(repoRoot, "public");
const threeModule = path.resolve(projectRoot, "node_modules/three/build/three.module.js");

const config = getDefaultConfig(projectRoot);
const defaultResolve = config.resolver.resolveRequest;

config.watchFolders = [...new Set([
  ...(config.watchFolders ?? []),
  projectRoot,
  domainRoot,
  localeRoot,
  publicRoot,
])];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "seoully-domain": domainRoot,
  "seoully-public": publicRoot,
};

function resolveMappedFile(root, subpath) {
  const withoutExt = path.resolve(root, subpath);
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
  if (moduleName.startsWith("@/")) {
    const error = new Error(
      `Unsupported Metro specifier "${moduleName}". Expo Go cannot resolve Next.js @/ aliases. From apps/mobile use seoully-domain/* or seoully-public/*; from shared domain/locale files use a relative import.`,
    );
    error.type = "NamedRequiresError";
    throw error;
  }
  if (moduleName === "seoully-domain" || moduleName.startsWith("seoully-domain/")) {
    const subpath = moduleName === "seoully-domain" ? "." : moduleName.slice("seoully-domain/".length);
    const filePath = resolveMappedFile(domainRoot, subpath);
    if (filePath) return { type: "sourceFile", filePath };
  }
  if (defaultResolve) return defaultResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
