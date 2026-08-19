// Planner navigation is expressed in domain operations rather than UI math.
export function previousWeekOffset(offset = 0) {
  return Number(offset) - 1;
}

export function nextWeekOffset(offset = 0) {
  return Number(offset) + 1;
}

export function normalizeWeekOffset(offset) {
  const value = Number(offset);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}
