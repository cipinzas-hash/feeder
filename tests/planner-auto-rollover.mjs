import assert from "node:assert/strict";
import { applyAutomaticRollover } from "../modules/planner/domain/autoRollover.js";

const base = {
  lastRollover: "2026-08-18",
  dayData: {
    "2026-08-18": { tasks: [{ id: "a", text: "pendiente", done: false }] },
    "2026-08-19": { tasks: [] },
    "2026-08-20": { tasks: [] },
  },
};

const once = applyAutomaticRollover(base, "2026-08-20");
assert.equal(once.lastRollover, "2026-08-20");
assert.equal(once.dayData["2026-08-19"].tasks[0].id, "a");
assert.equal(once.dayData["2026-08-20"].tasks[0].id, "a");
assert.equal(once.dayData["2026-08-20"].tasks[0].carried, true);

const twice = applyAutomaticRollover(once, "2026-08-20");
assert.deepEqual(twice, once);

const firstRun = applyAutomaticRollover({ lastRollover: null, dayData: {} }, "2026-08-20");
assert.equal(firstRun.lastRollover, "2026-08-20");
assert.deepEqual(firstRun.dayData, {});

console.log("planner auto rollover tests: ok");
