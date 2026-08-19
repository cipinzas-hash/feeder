// Planner action layer — Angst Planner 0.0
// Public, UI-independent operations over Planner state.

import {
  createInitialState,
  updateDay,
  setWeekOffset,
  setCalendarMarks,
  setCustody,
} from "./state.js";

export {
  createInitialState,
  updateDay,
  setWeekOffset,
  setCalendarMarks,
  setCustody,
};

export function setCookingOptions(state, options) {
  return { ...state, cookingOpts: [...(options || [])] };
}

export function setAseoOptions(state, options) {
  return { ...state, aseoOpts: [...(options || [])] };
}

export function setRoutines(state, routines) {
  return { ...state, routines: [...(routines || [])] };
}

export function setRecurring(state, recurring) {
  return { ...state, recurring: [...(recurring || [])] };
}

export function setLastRollover(state, lastRollover) {
  return { ...state, lastRollover };
}
