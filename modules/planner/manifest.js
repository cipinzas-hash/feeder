import {
  BASE_DATE,
  DAY_NAMES,
  DEFAULT_COOKING_OPTS,
  DEFAULT_ASEO_OPTS,
  CYNICAL_SUBTITLES,
  STOIC_PHRASES,
  makeEmptyDay,
  isWithKids,
  fmtTime,
} from "./domain.js";

export default {
  id: "planner",
  version: "0.0",
  tabLabel: "Semana",
  entry: "./PlannerPage.jsx",
  state: {
    dayData: { default: {} },
    weekOffset: { default: 0 },
    calMarks: { default: {} },
    routines: { default: [] },
    recurring: { default: [] },
    lastRollover: { default: null },
    cookingOpts: { default: DEFAULT_COOKING_OPTS },
    aseoOpts: { default: DEFAULT_ASEO_OPTS },
    custody: { default: { baseDate: null, withKids: true, overrides: {} } },
  },
  domain: {
    BASE_DATE,
    DAY_NAMES,
    CYNICAL_SUBTITLES,
    STOIC_PHRASES,
    makeEmptyDay,
    isWithKids,
    fmtTime,
  },
};
