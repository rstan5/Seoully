import * as THREE from "three";

/**
 * @react-three/fiber/native evaluates polyfills() at import time and calls
 * THREE.LoaderUtils.extractUrlBase.bind(...). Metro's require("three") interop
 * for the ESM-only three@0.186 build can leave that static missing, which
 * throws TypeError: undefined is not a function before Canvas mounts.
 */
function extractUrlBase(url: string) {
  if (typeof url !== "string") return "./";
  const index = url.lastIndexOf("/");
  return index === -1 ? "./" : url.slice(0, index + 1);
}

const utils = (THREE as { LoaderUtils?: { extractUrlBase?: (url: string) => string } }).LoaderUtils;
if (utils && typeof utils.extractUrlBase !== "function") {
  utils.extractUrlBase = extractUrlBase;
}
