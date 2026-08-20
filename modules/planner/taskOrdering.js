// Planner task ordering — Angst Planner 0.0
// Pure operations used by drag/drop and future keyboard reordering.

export function splitTasks(tasks = []) {
  const all = Array.isArray(tasks) ? tasks : [];
  return {
    fixed: all.filter((task) => task.fixed),
    flexible: all.filter((task) => !task.fixed),
  };
}

export function reorderFlexibleTasks(tasks = [], fromIndex, toIndex) {
  const { fixed, flexible } = splitTasks(tasks);
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return allTasks(fixed, flexible);
  if (fromIndex < 0 || fromIndex >= flexible.length) return allTasks(fixed, flexible);
  const target = Math.max(0, Math.min(toIndex, flexible.length - 1));
  const next = [...flexible];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(target, 0, moved);
  return allTasks(fixed, next);
}

export function moveTaskToDay(dayData, fromDateKey, toDateKey, taskId, options = {}) {
  const source = dayData?.[fromDateKey] || { tasks: [] };
  const target = dayData?.[toDateKey] || { tasks: [] };
  const task = (source.tasks || []).find((item) => item.id === taskId);
  if (!task || fromDateKey === toDateKey) return dayData;

  const next = { ...dayData };
  const sourceTasks = (source.tasks || []).filter((item) => item.id !== taskId);
  const carriedTask = {
    ...task,
    id: options.newId || task.id,
    carried: options.carried ?? true,
    carriedFrom: fromDateKey,
    done: false,
    notDone: false,
  };

  next[fromDateKey] = { ...source, tasks: sourceTasks };
  next[toDateKey] = { ...target, tasks: [...(target.tasks || []), carriedTask] };
  return next;
}

function allTasks(fixed, flexible) {
  return [...fixed, ...flexible];
}
