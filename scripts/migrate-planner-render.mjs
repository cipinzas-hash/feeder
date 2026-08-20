import fs from "node:fs";

const path = "core/LegacyApp.jsx";
let source = fs.readFileSync(path, "utf8");

const importNeedle = 'import { usePlanner } from "../modules/planner/PlannerProvider.jsx";';
const importReplacement = 'import { usePlanner } from "../modules/planner/PlannerProvider.jsx";\nimport PlannerPage from "../modules/planner/PlannerPage.jsx";';

if (!source.includes(importNeedle)) {
  throw new Error("Planner provider import not found; refusing to edit LegacyApp.jsx");
}
if (!source.includes('import PlannerPage from "../modules/planner/PlannerPage.jsx";')) {
  source = source.replace(importNeedle, importReplacement);
}

const start = source.indexOf('{semanaTab==="semana"&&<>');
if (start < 0) throw new Error("Legacy Semana render start marker not found");

const tail = '\n          </>}\n        )}\n\n        {page===1&&';
const end = source.indexOf(tail, start);
if (end < 0) throw new Error("Legacy Semana render end marker not found");

const replacement = `{semanaTab==="semana"&&<PlannerPage\n              state={plannerState}\n              actions={plannerActions}\n              integrations={{ todayKey: fmtFull(new Date()), holidayLookup: getHoliday }}\n            />}`;
source = source.slice(0, start) + replacement + source.slice(end + '\n          </>}'.length);

fs.writeFileSync(path, source);
console.log("Migrated Legacy Semana render to PlannerPage");
