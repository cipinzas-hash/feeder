// Angst application shell — 0.0
// Owns composition. LegacyApp remains the compatibility implementation
// while modules replace its views incrementally.
import LegacyApp from "../core/App.jsx";
import PlannerPage from "../modules/planner/PlannerPage.jsx";
import {
  createInitialState,
  setWeekOffset,
  updateDay,
  setCalendarMarks,
  setCustody,
  setCookingOptions,
  setAseoOptions,
  setRoutines,
  setRecurring,
  setLastRollover,
  loadPlannerState,
  savePlannerState,
} from "../modules/planner/index.js";
import { MODULES } from "./moduleRegistry.js";

const React = globalThis.React;
const { useEffect, useState } = React;

function PlannerRuntime() {
  const [state, setState] = useState(() => createInitialState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadPlannerState().then((stored) => {
      if (cancelled) return;
      setState(stored);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded) savePlannerState(state);
  }, [loaded, state]);

  const commit = (transform) => {
    setState((current) => transform(current));
  };

  const actions = {
    setWeekOffset: (weekOffset) => commit((current) => setWeekOffset(current, weekOffset)),
    updateDay: (dateKey, fields) => commit((current) => updateDay(current, dateKey, fields)),
    setCalendarMarks: (marks) => commit((current) => setCalendarMarks(current, marks)),
    setCustody: (custody) => commit((current) => setCustody(current, custody)),
    setCookingOptions: (options) => commit((current) => setCookingOptions(current, options)),
    setAseoOptions: (options) => commit((current) => setAseoOptions(current, options)),
    setRoutines: (routines) => commit((current) => setRoutines(current, routines)),
    setRecurring: (recurring) => commit((current) => setRecurring(current, recurring)),
    setLastRollover: (lastRollover) => commit((current) => setLastRollover(current, lastRollover)),
  };

  if (!loaded) {
    return React.createElement("section", { "data-angst-module": "planner", "data-version": "0.0" }, "cargando Planner…");
  }

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
