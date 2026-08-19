// Angst application shell — 0.0
// Owns composition. LegacyApp remains the compatibility implementation
// while modules replace its views incrementally.
import LegacyApp from "../core/App.jsx";
import PlannerPage from "../modules/planner/PlannerPage.jsx";
import { createInitialState, setWeekOffset } from "../modules/planner/index.js";
import { MODULES } from "./moduleRegistry.js";

const React = globalThis.React;
const { useState } = React;

function PlannerRuntime() {
  const [state, setState] = useState(() => createInitialState());

  const actions = {
    setWeekOffset: (weekOffset) => {
      setState((current) => setWeekOffset(current, weekOffset));
    },
  };

  return React.createElement(PlannerPage, {
    state,
    actions,
    integrations: {
      todayKey: new Date().toISOString().slice(0, 10),
    },
  });
}

export function AngstShell({ legacy = true, module = null }) {
  if (legacy) return React.createElement(LegacyApp);
  if (module === "planner") return React.createElement(PlannerRuntime);

  throw new Error("Angst 0.0 shell: no non-legacy module selected.");
}

export function getModuleRegistry() {
  return MODULES;
}

export default AngstShell;
