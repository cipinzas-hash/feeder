import {
  PLANNER_OWNED_FIELDS,
  PLANNER_PRIMARY_FIELD,
  assertPlannerOwnership,
  isPlannerOwnedField,
} from "../modules/planner/ownership.js";

if (PLANNER_PRIMARY_FIELD !== "weekOffset") {
  throw new Error("Planner 0.0: weekOffset must remain the first ownership milestone");
}

for (const field of ["dayData", "weekOffset", "calMarks", "routines", "recurring", "lastRollover", "cookingOpts", "aseoOpts", "custody"]) {
  if (!PLANNER_OWNED_FIELDS.includes(field) || !isPlannerOwnedField(field)) {
    throw new Error(`Planner 0.0: missing owned field ${field}`);
  }
}

assertPlannerOwnership(["weekOffset", "dayData"]);

let rejected = false;
try {
  assertPlannerOwnership(["budgets"]);
} catch {
  rejected = true;
}

if (!rejected) throw new Error("Planner 0.0: ownership must reject foreign fields");

console.log("OK: Planner ownership contract");
