import fs from "node:fs";

const provider = fs.readFileSync("modules/planner/PlannerProvider.jsx", "utf8");
const shell = fs.readFileSync("app/Shell.jsx", "utf8");
const index = fs.readFileSync("modules/planner/index.js", "utf8");

if (!provider.includes("PlannerContext") || !provider.includes("usePlanner")) {
  throw new Error("Planner provider must own its React context and expose usePlanner");
}

if (!shell.includes("PlannerProvider") || !shell.includes("usePlanner")) {
  throw new Error("Angst shell must mount Planner through PlannerProvider");
}

if (!index.includes('export { PlannerProvider, usePlanner }')) {
  throw new Error("Planner provider must be part of the public module API");
}

if (shell.includes("createInitialState") || shell.includes("savePlannerState")) {
  throw new Error("Shell must not own Planner state or persistence");
}

console.log("OK: Planner state ownership is inside the module boundary");
