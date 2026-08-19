const React = globalThis.React;
import { getDay } from "./state.js";

const DEFAULT_DAY = { tasks: [], abasto: "", cookingMode: "", aseoMode: "", menu: "", summary: "", humors: [], humorCustom: [], compras: [], schedule: [] };

function normalizeDay(day) {
  return day || DEFAULT_DAY;
}

export default function PlannerDayCard({
  state,
  dateKey,
  dayName,
  holidayLabel = "",
  isToday = false,
  isWeekend = false,
  actions = {},
}) {
  const day = normalizeDay(getDay(state, dateKey));
  const fixed = day.tasks.filter((task) => task.fixed);
  const flex = day.tasks.filter((task) => !task.fixed);

  const updateDay = (fields) => {
    if (actions.updateDay) actions.updateDay(dateKey, (current) => ({ ...current, ...fields }));
  };

  const addTask = () => {
    const task = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: "", done: false, fixed: false };
    if (actions.updateDay) {
      actions.updateDay(dateKey, (current) => ({ ...current, tasks: [...(current.tasks || []), task] }));
    }
  };

  const toggleTask = (id) => {
    if (!actions.updateDay) return;
    actions.updateDay(dateKey, (current) => ({
      ...current,
      tasks: (current.tasks || []).map((task) => task.id === id ? { ...task, done: !task.done } : task),
    }));
  };

  const removeTask = (id) => {
    if (!actions.updateDay) return;
    actions.updateDay(dateKey, (current) => ({
      ...current,
      tasks: (current.tasks || []).filter((task) => task.id !== id),
    }));
  };

  return React.createElement(
    "article",
    {
      className: `planner-day-card${isToday ? " planner-day-card--today" : ""}`,
      "data-date": dateKey,
    },
    React.createElement(
      "header",
      { className: "planner-day-card__header" },
      React.createElement("strong", null, dayName),
      React.createElement("span", null, dateKey),
      holidayLabel ? React.createElement("small", null, holidayLabel) : null,
    ),
    React.createElement(
      "section",
      { className: "planner-day-card__tasks" },
      React.createElement("h3", null, "Tareas"),
      fixed.map((task) => React.createElement(
        "div",
        { key: task.id, className: "planner-task planner-task--fixed" },
        React.createElement("button", { type: "button", onClick: () => toggleTask(task.id), "aria-label": task.done ? "marcar pendiente" : "marcar completada" }, task.done ? "✓" : "○"),
        React.createElement("span", { className: task.done ? "planner-task__done" : "" }, task.text || "tarea fija"),
        React.createElement("button", { type: "button", onClick: () => removeTask(task.id), "aria-label": "eliminar tarea" }, "×"),
      )),
      flex.map((task) => React.createElement(
        "div",
        { key: task.id, className: "planner-task" },
        React.createElement("button", { type: "button", onClick: () => toggleTask(task.id), "aria-label": task.done ? "marcar pendiente" : "marcar completada" }, task.done ? "✓" : "○"),
        React.createElement("span", { className: task.done ? "planner-task__done" : "" }, task.text || "tarea pendiente"),
        React.createElement("button", { type: "button", onClick: () => removeTask(task.id), "aria-label": "eliminar tarea" }, "×"),
      )),
      React.createElement("button", { type: "button", onClick: addTask }, "+ agregar tarea"),
    ),
    React.createElement(
      "section",
      { className: "planner-day-card__fields" },
      React.createElement("label", null, "Abasto", React.createElement("input", { value: day.abasto || "", onChange: (event) => updateDay({ abasto: event.target.value }) })),
      React.createElement("label", null, "Menú", React.createElement("textarea", { value: day.menu || "", onChange: (event) => updateDay({ menu: event.target.value }) })),
      React.createElement("label", null, "Cierre", React.createElement("textarea", { value: day.summary || "", onChange: (event) => updateDay({ summary: event.target.value }) })),
    ),
    React.createElement(
      "footer",
      null,
      isWeekend ? "fin de semana" : "día laboral",
    ),
  );
}
