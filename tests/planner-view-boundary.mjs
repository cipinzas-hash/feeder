import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../modules/planner/PlannerPage.jsx", import.meta.url), "utf8");
const card = fs.readFileSync(new URL("../modules/planner/PlannerDayCard.jsx", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../modules/planner/index.js", import.meta.url), "utf8");

assert.match(page, /PlannerDayCard/);
assert.match(page, /DAY_NAMES\.map/);
assert.match(card, /actions\.updateDay/);
assert.match(index, /PlannerDayCard/);
assert.doesNotMatch(page, /LegacyApp/);
assert.doesNotMatch(card, /LegacyApp/);

console.log("planner visual boundary ok");
