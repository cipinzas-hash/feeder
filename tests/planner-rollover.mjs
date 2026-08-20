import assert from "node:assert/strict";
import { nextDateKey, rolloverDay, rolloverState } from "../modules/planner/domain/rollover.js";

assert.equal(nextDateKey("2026-08-20"), "2026-08-21");
assert.equal(nextDateKey("2026-08-31"), "2026-09-01");

const day = {
  dateKey: "2026-08-20",
  tasks: [
    { id: "pending", text: "pendiente", done: false },
    { id: "done", text: "hecha", done: true },
    { id: "fixed", text: "fija", done: false, fixed: true },
  ],
  menu: "almuerzo",
  compras: [{ id: "milk", name: "leche" }],
  schedule: [{ id: "meeting", time: "10:00", title: "reunión" }],
};

const result = rolloverDay(day, { dateKey: "2026-08-21", tasks: [{ id: "existing", text: "existente" }] });
assert.equal(result.target.tasks.length, 2);
assert.equal(result.target.tasks[1].carried, true);
assert.equal(result.target.tasks[1].carriedFrom, "2026-08-20");
assert.equal(result.source.tasks.find((task) => task.id === "pending").carried, true);
assert.equal(result.source.tasks.find((task) => task.id === "done").carried, undefined);
assert.equal(result.source.tasks.find((task) => task.id === "fixed").carried, undefined);
assert.deepEqual(result.target.compras, day.compras);
assert.deepEqual(result.target.schedule, day.schedule);

const state = rolloverState({ days: { "2026-08-20": day } }, "2026-08-20");
assert.ok(state.days["2026-08-21"]);
assert.equal(state.days["2026-08-21"].tasks.length, 1);

console.log("planner rollover tests: ok");
