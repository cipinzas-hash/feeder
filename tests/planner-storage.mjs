import assert from "node:assert/strict";
import { createInitialState } from "../modules/planner/state.js";
import {
  getPlannerStorageFields,
  loadPlannerState,
  savePlannerState,
} from "../modules/planner/storage.js";

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
})();

const foreign = { budgets: { "2026-08": { total: 123 } } };
globalThis.localStorage.setItem("angst-v12", JSON.stringify({ ...foreign }));

const initial = createInitialState();
assert.deepEqual(getPlannerStorageFields(), [
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

await savePlannerState({ ...initial, weekOffset: 3 });
const restored = await loadPlannerState();
assert.equal(restored.weekOffset, 3);

const raw = JSON.parse(globalThis.localStorage.getItem("angst-v12"));
assert.deepEqual(raw.budgets, foreign.budgets);
assert.equal(raw.weekOffset, 3);
assert.equal("nutriLog" in raw, false);

console.log("OK: Planner persistence is isolated inside angst-v12");
