import assert from "node:assert/strict";
import { completeCarriedTask, nextDateKey, postponeTask } from "../modules/planner/taskTransfer.js";

const source = {
  "2026-08-19": { tasks: [{ id: "a", text: "leer", fixed: false, done: false }] },
  "2026-08-20": { tasks: [] },
};

const moved = postponeTask(source, "2026-08-19", "a", "2026-08-20", () => "b");
assert.equal(moved["2026-08-19"].tasks[0].notDone, true);
assert.equal(moved["2026-08-20"].tasks[0].id, "b");
assert.equal(moved["2026-08-20"].tasks[0].carried, true);
assert.equal(moved["2026-08-20"].tasks[0].carriedFrom, "2026-08-19");

const completed = completeCarriedTask(moved, "2026-08-20", "b");
assert.equal(completed["2026-08-20"].tasks.length, 0);
assert.equal(completed["2026-08-19"].tasks[0].doneOnTime, true);
assert.equal(completed["2026-08-19"].tasks[0].done, true);

assert.equal(nextDateKey("2026-08-19"), "2026-08-20");
console.log("planner task transfer: ok");
