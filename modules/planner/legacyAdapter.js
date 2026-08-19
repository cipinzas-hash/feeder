const PLANNER_FIELDS = [
  "dayData",
  "weekOffset",
  "calMarks",
  "routines",
  "recurring",
  "lastRollover",
  "cookingOpts",
  "aseoOpts",
  "custody",
];

/**
 * Translate the historical AngstApp state into Planner's v0.0 contract.
 * This is deliberately the only place where the legacy state shape is named.
 */
export function fromLegacyState(legacyState = {}) {
  const plannerState = {};
  for (const field of PLANNER_FIELDS) {
    if (field in legacyState) plannerState[field] = legacyState[field];
  }
  return plannerState;
}

/**
 * Merge Planner v0.0 back into a legacy state without deleting unrelated
 * module data. Used during the incremental migration period.
 */
export function mergePlannerIntoLegacy(legacyState = {}, plannerState = {}) {
  return {
    ...legacyState,
    ...fromLegacyState(plannerState),
  };
}

export function getPlannerLegacyFields() {
  return [...PLANNER_FIELDS];
}
