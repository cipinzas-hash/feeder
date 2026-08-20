import fs from "node:fs";

const provider = fs.readFileSync("modules/planner/PlannerProvider.jsx", "utf8");
const taskList = fs.readFileSync("modules/planner/PlannerTaskList.jsx", "utf8");
const transfer = fs.readFileSync("modules/planner/taskTransfer.js", "utf8");

for (const name of ["postponeTask", "completeCarriedTask"]) {
  if (!provider.includes(`${name}:`)) throw new Error(`PlannerProvider missing ${name}`);
  if (!taskList.includes(`actions.${name}`)) throw new Error(`PlannerTaskList missing ${name}`);
  if (!transfer.includes(`export function ${name}`)) throw new Error(`taskTransfer missing ${name}`);
}

if (taskList.includes("integrations.postponeTask")) {
  throw new Error("PlannerTaskList must not delegate task postponement through integrations");
}

console.log("planner task provider boundary: ok");
