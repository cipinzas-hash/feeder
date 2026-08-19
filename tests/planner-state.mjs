import { createInitialState, getDay, updateDay, setWeekOffset, setCalendarMarks, setCustody } from "../modules/planner/state.js";

const initial = createInitialState();
if (initial.weekOffset !== 0) throw new Error("invalid initial Planner state");
const empty = getDay(initial, "2026-08-19");
if (!Array.isArray(empty.tasks)) throw new Error("getDay() must return a day model");
const withTask = updateDay(initial, "2026-08-19", (day) => ({ ...day, tasks: [{ id: "t1", text: "test" }] }));
if (withTask.dayData["2026-08-19"].tasks.length !== 1) throw new Error("updateDay() failed");
const shifted = setWeekOffset(withTask, 2);
if (shifted.weekOffset !== 2) throw new Error("setWeekOffset() failed");
const marked = setCalendarMarks(shifted, "2026-08-19", ["work"]);
if (marked.calMarks["2026-08-19"][0] !== "work") throw new Error("setCalendarMarks() failed");
const custody = setCustody(marked, { baseDate: "2026-04-28", withKids: true, overrides: {} });
if (custody.custody.baseDate !== "2026-04-28") throw new Error("setCustody() failed");
console.log("OK: Planner state contract");
