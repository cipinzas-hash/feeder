import { localGet, localSet } from "../../core/persistence.js";
import manifest from "./manifest.js";

const STORAGE_KEY = "angst-v12";
const PLANNER_FIELDS = Object.keys(manifest.state);

export async function loadPlannerState() {
  const fullState = (await localGet(STORAGE_KEY)) || {};
  const state = {};

  for (const key of PLANNER_FIELDS) {
    const spec = manifest.state[key];
    state[key] = key in fullState
      ? fullState[key]
      : structuredClone(spec.default);
  }

  return state;
}

export async function savePlannerState(plannerState) {
  const fullState = (await localGet(STORAGE_KEY)) || {};

  for (const key of PLANNER_FIELDS) {
    if (key in plannerState) fullState[key] = plannerState[key];
  }

  return localSet(STORAGE_KEY, fullState);
}

export function getPlannerStorageFields() {
  return [...PLANNER_FIELDS];
}
