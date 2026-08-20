import fs from "node:fs";
import assert from "node:assert/strict";

const reflection = fs.readFileSync("modules/planner/PlannerDayReflection.jsx", "utf8");
const card = fs.readFileSync("modules/planner/PlannerDayCard.jsx", "utf8");

assert.match(reflection, /updateDay\?\./);
assert.match(reflection, /energy/);
assert.match(reflection, /concentration/);
assert.match(reflection, /sleep/);
assert.match(reflection, /humors/);
assert.match(card, /PlannerDayReflection/);
assert.doesNotMatch(reflection, /LegacyApp/);

console.log("Planner day reflection boundary: ok");
