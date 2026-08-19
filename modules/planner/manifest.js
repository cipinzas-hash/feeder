export default {
  id: "planner",
  version: "0.0",
  tabLabel: "Semana",
  state: {
    dayData: { default: {} },
    weekOffset: { default: 0 },
    calMarks: { default: {} },
    routines: { default: [] },
    recurring: { default: [] },
    lastRollover: { default: null },
    cookingOpts: { default: [] },
    aseoOpts: { default: [] },
    custody: { default: { baseDate: null, withKids: true, overrides: {} } },
  },
};
