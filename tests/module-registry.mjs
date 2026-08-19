import { MODULES, MODULES_BY_ID, assertModuleVersions } from "../app/moduleRegistry.js";

assertModuleVersions();

const ids = new Set(MODULES.map((module) => module.id));
if (ids.size !== MODULES.length) {
  throw new Error("Angst 0.0: duplicate module id detected");
}

if (!MODULES_BY_ID.planner || MODULES_BY_ID.planner.version !== "0.0") {
  throw new Error("Angst 0.0: planner module is not registered at v0.0");
}

console.log(`OK: ${MODULES.length} Angst modules registered at v0.0`);
console.log("OK: Planner is registered and available to the application shell");
