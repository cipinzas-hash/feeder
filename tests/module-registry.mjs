import { MODULES, assertModuleVersions } from "../app/moduleRegistry.js";

assertModuleVersions();

const ids = new Set(MODULES.map((module) => module.id));
if (ids.size !== MODULES.length) {
  throw new Error("Angst 0.0: duplicate module id detected");
}

console.log(`OK: ${MODULES.length} Angst modules registered at v0.0`);
