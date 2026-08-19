// Planner state model — Angst Planner 0.0
// Pure state helpers. React/UI remains outside this layer.

import { makeEmptyDay } from "./domain.js";

export function createInitialState() {
  return {
    dayData: {},
    weekOffset: 0,
    calMarks: {},
    routines: [],
    recurring: [],
    lastRollover: null,
    cookingOpts: [],
    aseoOpts: [],
    custody: { baseDate: null, withKids: true, overrides: {} },
  };
}

export function getDay(state, dateKey) {
  return state?.dayData?.[dateKey] || makeEmptyDay();
}

export function updateDay(state, dateKey, updater) {
  const current = getDay(state, dateKey);
  const nextDay = typeof updater === "function" ? updater(current) : updater;
  return {
    ...state,
    dayData: {
      ...(state?.dayData || {}),
      [dateKey]: nextDay,
    },
  };
}

export function setWeekOffset(state, weekOffset) {
  return { ...state, weekOffset };
}

export function setCalendarMarks(state, dateKey, marks) {
  return {
    ...state,
    calMarks: {
      ...(state?.calMarks || {}),
      [dateKey]: marks,
    },
  };
}

export function setCustody(state, custody) {
  return { ...state, custody };
}
