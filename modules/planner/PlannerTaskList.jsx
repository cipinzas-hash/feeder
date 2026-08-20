const React = globalThis.React;
import { reorderFlexibleTasks } from "./taskOrdering.js";
import PlannerTaskDrag from "./PlannerTaskDrag.jsx";
import PlannerTaskSwipe from "./PlannerTaskSwipe.jsx";

function cloneTasks(tasks) {
  return Array.isArray(tasks) ? [...tasks] : [];
}

export default function PlannerTaskList({ tasks = [], actions = {}, integrations = {} }) {
  const update = (updater) => actions.updateTasks?.(updater);

  const toggleDone = (id) => update((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const toggleUrgent = (id) => update((current) => current.map((task) => task.id === id ? { ...task, urgent: !task.urgent } : task));
  const updateText = (id, text) => update((current) => current.map((task) => task.id === id ? { ...task, text } : task));
  const addTask = (fixed = false) => update((current) => [...cloneTasks(current), { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: "", done: false, fixed }]);
  const removeTask = (id) => update((current) => current.filter((task) => task.id !== id));

  const moveTask = (id, delta) => update((current) => {
    const flexible = current.filter((task) => !task.fixed);
    const from = flexible.findIndex((task) => task.id === id);
    if (from < 0) return current;
    return reorderFlexibleTasks(current, from, from + delta);
  });

  const editTask = integrations.editTask;
  const chooseDeadline = integrations.chooseDeadline;
  const formatDeadline = integrations.formatDeadline || ((deadline) => deadline ? `${String(deadline.h).padStart(2, "0")}:${String(deadline.m).padStart(2, "0")}` : "🕐");

  const renderTask = (task, kind, flexibleIndex = -1) => React.createElement(
    "div",
    { key: task.id, className: `planner-task planner-task--${kind}` },
    React.createElement("button", { type: "button", onClick: () => toggleDone(task.id), "aria-label": task.done ? "marcar pendiente" : "marcar completada" }, task.done ? "✓" : "○"),
    React.createElement("input", {
      value: task.text || "",
      placeholder: task.fixed ? "tarea fija" : "tarea pendiente",
      disabled: task.done,
      onChange: (event) => updateText(task.id, event.target.value),
      onBlur: () => editTask?.(task.id, task.text || ""),
    }),
    React.createElement("button", { type: "button", onClick: () => toggleUrgent(task.id), "aria-label": task.urgent ? "quitar urgencia" : "marcar urgente", title: "urgencia" }, "🚨"),
    React.createElement("button", { type: "button", onClick: () => chooseDeadline?.(task), title: "hora límite" }, formatDeadline(task.deadline)),
    !task.fixed ? React.createElement(PlannerTaskDrag, { taskId: task.id, disabled: task.done, onReorder: moveTask },
      React.createElement("span", { "aria-hidden": true, style: { fontSize: 14, padding: "0 4px" } }, "⋮⋮"),
    ) : null,
    !task.fixed ? React.createElement("button", { type: "button", onClick: () => moveTask(task.id, -1), disabled: flexibleIndex <= 0, "aria-label": "subir tarea", title: "subir" }, "↑") : null,
    !task.fixed ? React.createElement("button", { type: "button", onClick: () => moveTask(task.id, 1), disabled: flexibleIndex < 0 || flexibleIndex >= flexibleCount - 1, "aria-label": "bajar tarea", title: "bajar" }, "↓") : null,
    !task.fixed && !task.done ? React.createElement(PlannerTaskSwipe, { taskId: task.id, disabled: task.done, onPostpone: (taskId) => actions.postponeTask?.(taskId) },
      React.createElement("span", { "aria-hidden": true, style: { fontSize: 12, padding: "0 4px" } }, "→"),
    ) : null,
    !task.fixed && !task.done ? React.createElement("button", { type: "button", onClick: () => actions.postponeTask?.(task.id), title: "postergar al día siguiente", "aria-label": "postergar tarea" }, "→ mañana") : null,
    task.carried ? React.createElement("button", { type: "button", onClick: () => actions.completeCarriedTask?.(task.id), title: "marcar cumplida a tiempo" }, "✓ a tiempo") : null,
    React.createElement("button", { type: "button", onClick: () => removeTask(task.id), "aria-label": "eliminar tarea" }, "×"),
  );

  const fixed = tasks.filter((task) => task.fixed);
  const flexible = tasks.filter((task) => !task.fixed);
  const flexibleCount = flexible.length;

  return React.createElement(
    "section",
    { className: "planner-day-card__tasks" },
    React.createElement("h3", null, "Tareas"),
    fixed.map((task) => renderTask(task, "fixed")),
    flexible.map((task, index) => renderTask(task, "flexible", index)),
    React.createElement("div", { className: "planner-task-actions" },
      React.createElement("button", { type: "button", onClick: () => addTask(false) }, "+ tarea"),
      React.createElement("button", { type: "button", onClick: () => addTask(true) }, "+ fija"),
    ),
  );
}
