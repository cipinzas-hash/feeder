import fs from "node:fs";
const list = fs.readFileSync(new URL("../modules/planner/PlannerTaskList.jsx", import.meta.url), "utf8");
if (!list.includes('import PlannerTaskSwipe from "./PlannerTaskSwipe.jsx";')) throw new Error("missing swipe import");
if (!list.includes("integrations.postponeTask")) throw new Error("missing postpone integration");
if (!list.includes("PlannerTaskSwipe")) throw new Error("missing swipe mount");
console.log("planner task swipe mount: ok");
