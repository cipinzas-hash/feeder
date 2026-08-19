import assert from "node:assert/strict";
import {
  fromLegacyState,
  mergePlannerIntoLegacy,
  getPlannerLegacyFields,
} from "../modules/planner/legacyAdapter.js";

const legacy = {
  page: 3,
  dayData: { "2026-08-19": { tasks: [] } },
  weekOffset: 4,
  budgets: { "2026-08": {} },
  nutriLog: { "2026-08-19": [] },
};

const planner = fromLegacyState(legacy);
assert.deepEqual(planner.dayData, legacy.dayData);
assert.equal(planner.weekOffset, 4);
assert.equal(planner.budgets, undefined);
assert.equal(planner.nutriLog, undefined);

const merged = mergePlannerIntoLegacy(
  legacy,
  { weekOffset: 5, dayData: { "2026-08-20": { tasks: [] } } },
);
assert.equal(merged.weekOffset, 5);
assert.deepEqual(merged.dayData, { "2026-08-20": { tasks: [] } });
assert.deepEqual(merged.budgets, legacy.budgets);
assert.deepEqual(merged.nutriLog, legacy.nutriLog);

assert.deepEqual(getPlannerLegacyFields(), [
  "dayData",
  "weekOffset",
  "calMarks",
  "routines",
  "recurring",
  "lastRollover",
  "cookingOpts",
  "aseoOpts",
  "custody",
]);

console.log("OK: Planner legacy adapter preserves module boundaries");
