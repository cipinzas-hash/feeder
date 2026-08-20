import { nextDateKey, rolloverDay } from "./rollover.js";

/** Applies rollover once for each date after the stored checkpoint. */
export function applyAutomaticRollover(state = {}, todayKey) {
  if (!todayKey || state.lastRollover === todayKey) return state;
  if (!state.lastRollover) return { ...state, lastRollover: todayKey };

  let nextState = state;
  let cursor = nextDateKey(state.lastRollover);

  while (cursor <= todayKey) {
    const [year, month, day] = cursor.split("-").map(Number);
    const previous = new Date(Date.UTC(year, month - 1, day));
    previous.setUTCDate(previous.getUTCDate() - 1);
    const sourceKey = previous.toISOString().slice(0, 10);
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
