import assert from "node:assert/strict";
import { postponeTask, completeCarriedTask } from "../modules/planner/taskTransfer.js";

const start = {
  "2026-08-19": { tasks: [{ id: "a", text: "tarea", done: false, fixed: false }] },
  "2026-08-20": { tasks: [] },
};

const postponed = postponeTask(start, "2026-08-19", "a");
assert.equal(postponed["2026-08-20"].tasks.length, 1);
assert.equal(postponed["2026-08-20"].tasks[0].carried, true);
assert.equal(postponed["2026-08-20"].tasks[0].carriedFrom, "2026-08-19");

const carriedId = postponed["2026-08-20"].tasks[0].id;
const completed = completeCarriedTask(postponed, "2026-08-20", carriedId);
assert.equal(completed["2026-08-19"].tasks[0].done, true);
assert.equal(completed["2026-08-19"].tasks[0].doneOnTime, true);
assert.equal(completed["2026-08-20"].tasks.length, 0);

console.log("planner task transfer: ok");
