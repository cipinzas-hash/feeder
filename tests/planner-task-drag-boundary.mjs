import assert from "node:assert/strict";
import { reorderFlexibleTasks } from "../modules/planner/taskOrdering.js";

const tasks = [
  { id: "fixed", fixed: true },
  { id: "a", fixed: false },
  { id: "b", fixed: false },
];

const reordered = reorderFlexibleTasks(tasks, 1, 0);
assert.deepEqual(reordered.map((task) => task.id), ["fixed", "b", "a"]);
assert.equal(reordered[0].fixed, true);

console.log("planner-task-drag-boundary: ok");
