const React = globalThis.React;
import { getDay } from "./state.js";
import PlannerTaskList from "./PlannerTaskList.jsx";

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

  const updateDay = (fields) => {
    if (actions.updateDay) actions.updateDay(dateKey, (current) => ({ ...current, ...fields }));
  };

  const updateTasks = (updater) => {
    updateDay({ tasks: updater(day.tasks || []) });
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
    React.createElement(PlannerTaskList, {
      tasks: day.tasks || [],
      actions: { updateTasks },
    }),
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
