import fs from "node:fs";
import assert from "node:assert/strict";

const calendar = fs.readFileSync(new URL("../modules/planner/PlannerCalendar.jsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../modules/planner/PlannerPage.jsx", import.meta.url), "utf8");

assert.ok(calendar.includes("export default function PlannerCalendar"));
assert.ok(calendar.includes("actions.setCalendarMarks"));
assert.ok(page.includes("./PlannerCalendar.jsx"));
assert.ok(!calendar.includes("core/ui.jsx"));

console.log("planner calendar boundary ok");
