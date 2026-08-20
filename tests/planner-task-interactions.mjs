import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("modules/planner/PlannerTaskList.jsx", "utf8");

for (const token of ["toggleDone", "toggleUrgent", "updateText", "chooseDeadline", "removeTask"]) {
  assert.ok(source.includes(token), `PlannerTaskList should expose ${token}`);
}
assert.ok(source.includes("actions.updateTasks"), "task writes must pass through Planner actions");
assert.ok(!source.includes("useState"), "task interactions should not create local task state");
assert.ok(!source.includes("LegacyApp"), "task component must not depend on LegacyApp");

console.log("planner task interactions ok");
