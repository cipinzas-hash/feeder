const COPY_FIELDS = ["abasto", "cookingMode", "aseoMode", "menu", "compras", "schedule"];

export function nextDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return { ...value };
  return value;
}

export function rolloverDay(day = {}, nextDay = {}) {
  const current = { ...day };
  const target = { ...nextDay };
  const targetIds = new Set((Array.isArray(target.tasks) ? target.tasks : []).map((task) => task.id));
  const pending = Array.isArray(current.tasks)
    ? current.tasks.filter((task) => !task.done && !task.fixed && !targetIds.has(task.id))
    : [];
  const carried = pending.map((task) => ({ ...clone(task), carried: true, carriedFrom: current.dateKey || null }));
  const pendingIds = new Set(pending.map((task) => task.id));

  return {
    source: {
      ...current,
      tasks: Array.isArray(current.tasks)
        ? current.tasks.map((task) => pendingIds.has(task.id) ? { ...task, carried: true } : task)
        : [],
    },
    target: {
      ...target,
      ...Object.fromEntries(
        COPY_FIELDS
          .filter((key) => target[key] == null && current[key] != null)
          .map((key) => [key, clone(current[key])]),
      ),
      tasks: [...(Array.isArray(target.tasks) ? target.tasks : []), ...carried],
    },
  };
}

export function rolloverState(state = {}, dateKey) {
  const nextKey = nextDateKey(dateKey);
  const days = state.days || {};
  const result = rolloverDay({ ...(days[dateKey] || {}), dateKey }, { ...(days[nextKey] || {}), dateKey: nextKey });
  return { ...state, days: { ...days, [dateKey]: result.source, [nextKey]: result.target } };
}
