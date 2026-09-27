const Module = require("node:module");
const path = require("node:path");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.join(process.cwd(), ".tmp", "build", "src", request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
