import assert from "node:assert/strict";
import fs from "node:fs";

const dayCard = fs.readFileSync(new URL("../modules/planner/PlannerDayCard.jsx", import.meta.url), "utf8");
const utilities = fs.readFileSync(new URL("../modules/planner/PlannerDayUtilities.jsx", import.meta.url), "utf8");

assert.match(dayCard, /PlannerDayUtilities/);
assert.match(utilities, /cookingOptions/);
assert.match(utilities, /aseoOptions/);
assert.match(utilities, /updateDay/);
assert.match(utilities, /setCookingOptions/);
assert.match(utilities, /setAseoOptions/);
assert.doesNotMatch(utilities, /LegacyApp/);

console.log("planner day utilities boundary ok");
