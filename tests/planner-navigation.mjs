import assert from "node:assert/strict";
import { previousWeekOffset, nextWeekOffset, normalizeWeekOffset } from "../modules/planner/navigation.js";

assert.equal(previousWeekOffset(0), -1);
assert.equal(nextWeekOffset(0), 1);
assert.equal(previousWeekOffset(3), 2);
assert.equal(nextWeekOffset(-2), -1);
assert.equal(normalizeWeekOffset("4.8"), 4);
assert.equal(normalizeWeekOffset("wat"), 0);

console.log("planner-navigation: ok");
