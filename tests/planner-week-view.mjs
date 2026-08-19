import assert from "node:assert/strict";
import { DAY_NAMES } from "../modules/planner/domain.js";
import { getWeekDays, formatWeekRange, toDateKey } from "../modules/planner/weekView.js";

const days = getWeekDays(0);
assert.equal(days.length, 7);
assert.deepEqual(days.map((day) => day.dayName), DAY_NAMES);
assert.equal(days[0].dateKey, toDateKey(days[0].date));
assert.equal(formatWeekRange(0), `${days[0].dateKey} — ${days[6].dateKey}`);
assert.equal(getWeekDays(1)[0].dateKey > days[6].dateKey, true);

console.log("planner week view ok");
