const React = globalThis.React;
import { getDay, updateDay } from "./state.js";
import { previousWeek, nextWeek } from "./actions.js";
import { BASE_DATE, DAY_NAMES, makeEmptyDay } from "./domain.js";
import PlannerDayCard from "./PlannerDayCard.jsx";

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatRange(start) {
  const end = addDays(start, 6);
  return `${start.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })} — ${end.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`;
}

/**
 * Planner 0.0 weekly view.
 *
 * This is intentionally the first real visual extraction from the historical
 * Semana view. Advanced overlays (calendar, schedule, compras, timers, etc.)
 * remain behind the Legacy boundary until their integrations are migrated.
 */
export default function PlannerPage({ state, actions = {}, integrations = {} }) {
  const plannerState = state || {};
  const weekOffset = plannerState.weekOffset || 0;
  const weekStart = addDays(BASE_DATE, weekOffset * 7);
  const todayKey = integrations.todayKey || dateKey(new Date());
  const today = getDay(plannerState, todayKey) || makeEmptyDay();

  const applyPrevious = () => {
    if (actions.applyStateAction) actions.applyStateAction(previousWeek);
    else if (actions.setWeekOffset) actions.setWeekOffset(weekOffset - 1);
  };

  const applyNext = () => {
    if (actions.applyStateAction) actions.applyStateAction(nextWeek);
    else if (actions.setWeekOffset) actions.setWeekOffset(weekOffset + 1);
  };

  const dayActions = {
    updateDay: (key, updater) => {
      if (actions.updateDay) actions.updateDay(key, updater);
    },
  };

  return React.createElement(
    "section",
    { "data-angst-module": "planner", "data-version": "0.0", className: "planner-page" },
    React.createElement(
      "header",
      { className: "planner-page__header" },
      React.createElement("div", null,
        React.createElement("strong", null, "Semana"),
        React.createElement("span", null, ` · semana ${weekOffset >= 0 ? "+" : ""}${weekOffset}`),
      ),
      React.createElement("span", null, formatRange(weekStart)),
    ),
    React.createElement(
      "nav",
      { className: "planner-page__nav" },
      React.createElement("button", { type: "button", onClick: applyPrevious }, "← semana anterior"),
      React.createElement("span", null, `${today.tasks.length} tarea(s) hoy`),
      React.createElement("button", { type: "button", onClick: applyNext }, "semana siguiente →"),
    ),
    React.createElement(
      "div",
      { className: "planner-page__grid" },
      DAY_NAMES.map((dayName, index) => {
        const date = addDays(weekStart, index);
        const key = dateKey(date);
        return React.createElement(PlannerDayCard, {
          key,
          state: plannerState,
          dateKey: key,
          dayName,
          isToday: key === todayKey,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          actions: dayActions,
        });
      }),
    ),
  );
}
