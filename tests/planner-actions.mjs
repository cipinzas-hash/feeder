import {
  createInitialState,
  updateDay,
  setWeekOffset,
  setCalendarMarks,
  setCustody,
  setCookingOptions,
  setAseoOptions,
  setRoutines,
  setRecurring,
  setLastRollover,
} from "../modules/planner/index.js";

let state = createInitialState();

state = updateDay(state, "2026-08-19", (day) => ({ ...day, summary: "ok" }));
if (state.dayData["2026-08-19"].summary !== "ok") throw new Error("updateDay failed");

state = setWeekOffset(state, 3);
if (state.weekOffset !== 3) throw new Error("setWeekOffset failed");

state = setCalendarMarks(state, "2026-08-19", ["work"]);
if (state.calMarks["2026-08-19"][0] !== "work") throw new Error("setCalendarMarks failed");

state = setCustody(state, { baseDate: "2026-04-28", withKids: true, overrides: {} });
state = setCookingOptions(state, ["cocino hoy 🍳"]);
state = setAseoOptions(state, ["aseo básico 🧹"]);
state = setRoutines(state, [{ id: "r1" }]);
state = setRecurring(state, [{ id: "rr1" }]);
state = setLastRollover(state, "2026-08-19");

if (state.cookingOpts.length !== 1 || state.aseoOpts.length !== 1) throw new Error("option actions failed");
if (state.routines.length !== 1 || state.recurring.length !== 1) throw new Error("collection actions failed");
if (state.lastRollover !== "2026-08-19") throw new Error("setLastRollover failed");

console.log("OK: Planner actions contract");
