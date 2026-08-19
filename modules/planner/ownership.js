// Ownership contract for Angst 0.0.
// LegacyApp may consume these values during migration, but Planner is the
// authoritative owner of the fields listed here.
export const PLANNER_OWNED_FIELDS = Object.freeze([
  "dayData",
  "weekOffset",
  "calMarks",
  "routines",
  "recurring",
  "lastRollover",
  "cookingOpts",
  "aseoOpts",
  "custody",
]);

export const PLANNER_PRIMARY_FIELD = "weekOffset";

export function isPlannerOwnedField(field) {
  return PLANNER_OWNED_FIELDS.includes(field);
}

export function assertPlannerOwnership(fields) {
  const invalid = fields.filter((field) => !isPlannerOwnedField(field));
  if (invalid.length) {
    throw new Error(`Planner 0.0 recibió campos fuera de su dominio: ${invalid.join(", ")}`);
  }
  return true;
}
