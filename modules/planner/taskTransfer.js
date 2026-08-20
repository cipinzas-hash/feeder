// Planner task transfer primitives — Angst Planner 0.0

function cloneTask(task, idFactory = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  return { ...task, id: idFactory(), done: false, notDone: false, carried: true };
}

function cloneDay(day) {
  return { ...(day || {}), tasks: Array.isArray(day?.tasks) ? [...day.tasks] : [] };
}

/**
 * Move a flexible task from one date to another and mark the source copy
 * as not completed. The source task remains in history; the destination
 * receives a carried copy.
 */
export function postponeTask(dayData, fromDate, taskId, toDate, idFactory) {
  const source = cloneDay(dayData?.[fromDate]);
  const target = cloneDay(dayData?.[toDate]);
  const task = source.tasks.find((item) => item.id === taskId);

  if (!task || task.fixed) return dayData || {};

  const next = { ...(dayData || {}) };
  source.tasks = source.tasks.map((item) =>
    item.id === taskId ? { ...item, notDone: true, done: false } : item,
  );

  target.tasks.push({
    ...cloneTask(task, idFactory),
    origId: task.origId || task.id,
    carriedFrom: fromDate,
  });

  next[fromDate] = source;
  next[toDate] = target;
  return next;
}

/**
 * Marks the original task as completed on its original date and removes
 * the carried copy from the current date.
 */
export function completeCarriedTask(dayData, dateKey, taskId) {
  const current = cloneDay(dayData?.[dateKey]);
  const carried = current.tasks.find((item) => item.id === taskId && item.carried);
  if (!carried) return dayData || {};

  const originDate = carried.carriedFrom;
  const originId = carried.origId || carried.id;
  const next = { ...(dayData || {}) };

  if (originDate && next[originDate]) {
    const origin = cloneDay(next[originDate]);
    origin.tasks = origin.tasks.map((item) =>
      item.id === originId ? { ...item, done: true, notDone: false, doneOnTime: true } : item,
    );
    next[originDate] = origin;
  }

  current.tasks = current.tasks.filter((item) => item.id !== taskId);
  next[dateKey] = current;
  return next;
}

export function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
