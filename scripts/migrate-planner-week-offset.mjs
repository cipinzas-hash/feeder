import fs from "node:fs";

const path = "core/LegacyApp.jsx";
let text = fs.readFileSync(path, "utf8");

const importLine = 'import { usePlanner } from "../modules/planner/PlannerProvider.jsx";';
if (!text.includes(importLine)) {
  const anchor = 'import FeedPage from "../modules/feed/FeedPage.jsx";';
  if (!text.includes(anchor)) throw new Error("Planner migration: import anchor not found");
  text = text.replace(anchor, `${anchor}\n${importLine}`);
}

const oldState = '  const [weekOffset, setWeekOffset] = useState(0);';
if (text.includes(oldState)) {
  const marker = 'function AngstApp() {\n';
  if (!text.includes(marker)) throw new Error("Planner migration: AngstApp marker not found");
  text = text.replace(
    oldState,
    '  // Planner 0.0 owns weekOffset. Legacy keeps a local ref only for async-compatible reads.\n'
  );
  text = text.replace(
    marker,
    `${marker}  const { state: plannerState, actions: plannerActions } = usePlanner();\n  const weekOffset = plannerState.weekOffset ?? 0;\n`
  );
} else if (!text.includes('const { state: plannerState, actions: plannerActions } = usePlanner();')) {
  throw new Error("Planner migration: expected weekOffset state or migrated Planner bindings not found");
}

const setterPattern = /\bsetWeekOffset\(/g;
const setterMatches = text.match(setterPattern)?.length ?? 0;
if (setterMatches > 0) {
  text = text.replace(setterPattern, "plannerActions.setWeekOffset(");
}

if (!text.includes("const { state: plannerState, actions: plannerActions } = usePlanner();")) {
  throw new Error("Planner migration: Planner bindings missing after transformation");
}
if (/const \[weekOffset, setWeekOffset\]/.test(text)) {
  throw new Error("Planner migration: legacy weekOffset state still present");
}
if (/[^\w.]setWeekOffset\(/.test(text)) {
  throw new Error("Planner migration: unmanaged setWeekOffset call remains");
}

fs.writeFileSync(path, text);
console.log(`Planner weekOffset migration applied. Replaced ${setterMatches} setter call(s).`);
