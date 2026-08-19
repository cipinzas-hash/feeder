// Angst application shell — 0.0
// Owns composition. LegacyApp remains the compatibility implementation
// while modules replace its views incrementally.
import LegacyApp from "../core/App.jsx";
import PlannerPage from "../modules/planner/PlannerPage.jsx";
import { PlannerProvider, usePlanner } from "../modules/planner/PlannerProvider.jsx";
import { MODULES } from "./moduleRegistry.js";

const React = globalThis.React;

function PlannerRuntime() {
  const { state, actions, loaded } = usePlanner();

  if (!loaded) {
    return React.createElement(
      "section",
      { "data-angst-module": "planner", "data-version": "0.0" },
      "cargando Planner…",
    );
  }

  return React.createElement(PlannerPage, {
    state,
    actions,
    integrations: {
      todayKey: new Date().toISOString().slice(0, 10),
    },
  });
}

function PlannerModule() {
  return React.createElement(
    PlannerProvider,
    null,
    React.createElement(PlannerRuntime),
  );
}

export function AngstShell({ legacy = true, module = null }) {
  if (legacy) return React.createElement(LegacyApp);
  if (module === "planner") return React.createElement(PlannerModule);

  throw new Error("Angst 0.0 shell: no non-legacy module selected.");
}

export function getModuleRegistry() {
  return MODULES;
}

export default AngstShell;
