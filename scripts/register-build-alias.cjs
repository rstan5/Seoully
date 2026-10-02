const Module = require("node:module");
const path = require("node:path");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.join(process.cwd(), ".tmp", "build", "src", request.slice(2));
  }
  if (request.startsWith("seoully-domain/")) {
    request = path.join(process.cwd(), ".tmp", "build", "src", "domain", request.slice("seoully-domain/".length));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
