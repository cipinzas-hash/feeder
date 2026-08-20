import assert from "node:assert/strict";
import { postponeTask, completeCarriedTask } from "../modules/planner/taskTransfer.js";

const source = {
  "2026-08-19": { tasks: [{ id: "task-1", text: "tarea", fixed: false }] },
  "2026-08-20": { tasks: [] },
};

const moved = postponeTask(source, "2026-08-19", "task-1", "2026-08-20", () => "task-2");
const carried = moved["2026-08-20"].tasks[0];
assert.equal(carried.carried, true);
assert.equal(carried.carriedFrom, "2026-08-19");

const completed = completeCarriedTask(moved, "2026-08-20", "task-2");
assert.equal(completed["2026-08-20"].tasks.length, 0);
assert.equal(completed["2026-08-19"].tasks[0].doneOnTime, true);

console.log("planner task transfer boundary: ok");
