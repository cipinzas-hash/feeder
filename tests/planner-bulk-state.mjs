import assert from "node:assert/strict";
import { createInitialState, replaceDayData, replaceCalendarMarks } from "../modules/planner/state.js";

const seed = createInitialState();
const dayData = { "2026-08-19": { tasks: [{ id: 1, text: "test" }] } };
const marks = { "2026-08-19": ["gym"] };

const withDays = replaceDayData(seed, dayData);
assert.deepEqual(withDays.dayData, dayData);
assert.equal(withDays.weekOffset, seed.weekOffset);

const withMarks = replaceCalendarMarks(withDays, marks);
assert.deepEqual(withMarks.calMarks, marks);
assert.deepEqual(withMarks.dayData, dayData);

console.log("planner bulk state ok");
