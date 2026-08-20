// Planner task transfer — pure state operations for moving tasks between days.

function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function postponeTask(state, dateKey, taskId) {
  const source = state?.dayData?.[dateKey];
  const tasks = Array.isArray(source?.tasks) ? source.tasks : [];
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.fixed || task.done) return state;

  const targetDateKey = nextDateKey(dateKey);
  const target = state?.dayData?.[targetDateKey] || {};
  const movedTask = {
    ...task,
    carried: true,
    carriedFrom: dateKey,
  };

  return {
    ...state,
    dayData: {
      ...(state.dayData || {}),
      [dateKey]: { ...source, tasks: tasks.filter((item) => item.id !== taskId) },
      [targetDateKey]: {
        ...target,
        tasks: [...(target.tasks || []).filter((item) => item.id !== taskId), movedTask],
      },
    },
  };
}

export function completeCarriedTask(state, dateKey, taskId) {
  const current = state?.dayData?.[dateKey];
  const tasks = Array.isArray(current?.tasks) ? current.tasks : [];
  const task = tasks.find((item) => item.id === taskId);
  if (!task?.carried || !task.carriedFrom) return state;

  const sourceKey = task.carriedFrom;
  const source = state?.dayData?.[sourceKey];
  const sourceTasks = Array.isArray(source?.tasks) ? source.tasks : [];

  return {
    ...state,
    dayData: {
      ...(state.dayData || {}),
      [dateKey]: { ...current, tasks: tasks.filter((item) => item.id !== taskId) },
      [sourceKey]: {
        ...source,
        tasks: sourceTasks.map((item) => item.id === taskId ? { ...item, done: true, doneOnTime: true } : item),
      },
    },
  };
}

export { nextDateKey };
