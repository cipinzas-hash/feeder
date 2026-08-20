// Planner action layer — Angst Planner 0.0
// Public, UI-independent operations over Planner state.

import {
  createInitialState,
  replaceDayData,
  updateDay,
  setWeekOffset,
  replaceCalendarMarks,
  setCustody,
} from "./state.js";
import { previousWeekOffset, nextWeekOffset } from "./navigation.js";
import { postponeTask, completeCarriedTask, nextDateKey } from "./taskTransfer.js";

export {
  createInitialState,
  replaceDayData,
  updateDay,
  setWeekOffset,
  replaceCalendarMarks,
  setCustody,
  postponeTask,
  completeCarriedTask,
  nextDateKey,
};

export function previousWeek(state) {
  return setWeekOffset(state, previousWeekOffset(state.weekOffset));
}

export function nextWeek(state) {
  return setWeekOffset(state, nextWeekOffset(state.weekOffset));
}

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
