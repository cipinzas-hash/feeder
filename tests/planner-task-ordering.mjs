import assert from "node:assert/strict";
import { splitTasks, reorderFlexibleTasks, moveTaskToDay } from "../modules/planner/taskOrdering.js";

const tasks = [
  { id: "f", text: "fija", fixed: true },
  { id: "a", text: "A", fixed: false },
  { id: "b", text: "B", fixed: false },
  { id: "c", text: "C", fixed: false },
];

const parts = splitTasks(tasks);
assert.deepEqual(parts.fixed.map((t) => t.id), ["f"]);
assert.deepEqual(parts.flexible.map((t) => t.id), ["a", "b", "c"]);

assert.deepEqual(
  reorderFlexibleTasks(tasks, 0, 2).map((t) => t.id),
  ["f", "b", "c", "a"],
);

const data = {
  "2026-08-19": { tasks: [{ id: "a", text: "A", fixed: false }] },
  "2026-08-20": { tasks: [] },
};
const moved = moveTaskToDay(data, "2026-08-19", "2026-08-20", "a", { newId: "b" });
assert.deepEqual(moved["2026-08-19"].tasks, []);
assert.equal(moved["2026-08-20"].tasks[0].id, "b");
assert.equal(moved["2026-08-20"].tasks[0].carried, true);
assert.equal(data["2026-08-19"].tasks[0].id, "a");

console.log("planner-task-ordering: ok");
