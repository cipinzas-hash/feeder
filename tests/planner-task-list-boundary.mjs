import fs from "node:fs";
import assert from "node:assert/strict";

const taskList = fs.readFileSync("modules/planner/PlannerTaskList.jsx", "utf8");
const dayCard = fs.readFileSync("modules/planner/PlannerDayCard.jsx", "utf8");

assert.match(dayCard, /import PlannerTaskList from \"\.\/PlannerTaskList\.jsx\"/);
assert.match(dayCard, /<PlannerTaskList|PlannerTaskList,/);
assert.match(taskList, /actions\.updateTasks/);
assert.doesNotMatch(taskList, /useState\s*\(/);
assert.doesNotMatch(taskList, /LegacyApp/);

console.log("planner task boundary ok");
