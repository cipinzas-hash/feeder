import { nextDateKey, rolloverDay } from "./rollover.js";

/**
 * Applies the calendar rollover at most once per date.
 * The operation is pure so callers can safely run it on every app boot.
 */
export function applyAutomaticRollover(state = {}, todayKey) {
  if (!todayKey || state.lastRollover === todayKey) return state;

  let nextState = state;
  let cursor = state.lastRollover ? nextDateKey(state.lastRollover) : todayKey;

  // First initialization establishes the checkpoint without manufacturing history.
  if (!state.lastRollover) {
    return { ...state, lastRollover: todayKey };
  }

  while (cursor <= todayKey) {
    const previousKey = nextDateKey(cursor).slice(0, 10) === cursor ? null : null;
    // The previous date is the checkpoint immediately before cursor.
    const [y, m, d] = cursor.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    const sourceKey = date.toISOString().slice(0, 10);
    const days = nextState.dayData || {};
    const result = rolloverDay(
      { ...(days[sourceKey] || {}), dateKey: sourceKey },
      { ...(days[cursor] || {}), dateKey: cursor },
    );
    nextState = {
      ...nextState,
      dayData: { ...days, [sourceKey]: result.source, [cursor]: result.target },
      lastRollover: cursor,
    };
    cursor = nextDateKey(cursor);
  }

  return nextState;
}
