import fs from "node:fs";

const swipe = fs.readFileSync(new URL("../modules/planner/PlannerTaskSwipe.jsx", import.meta.url), "utf8");
const taskList = fs.readFileSync(new URL("../modules/planner/PlannerTaskList.jsx", import.meta.url), "utf8");

if (!taskList.includes('import PlannerTaskSwipe from "./PlannerTaskSwipe.jsx";')) throw new Error("PlannerTaskList must import PlannerTaskSwipe");
if (!taskList.includes("integrations.postponeTask")) throw new Error("PlannerTaskList must route swipe to integrations.postponeTask");
if (!swipe.includes("onPostpone?.(taskId)")) throw new Error("PlannerTaskSwipe must delegate postponement");

console.log("planner task swipe integration contract: ok");
