const React = globalThis.React;
import { getDay } from "./state.js";

/**
 * Transitional Planner view.
 *
 * v0.0 establishes the Shell -> Planner mount contract. The historical
 * Semana UI remains in core/App.jsx until the full visual extraction is done.
 */
export default function PlannerPage({ state, actions = {}, integrations = {} }) {
  const plannerState = state || {};
  const weekOffset = plannerState.weekOffset || 0;
  const todayKey = integrations.todayKey || new Date().toISOString().slice(0, 10);
  const today = getDay(plannerState, todayKey);

  const changeWeek = (delta) => {
    if (actions.setWeekOffset) actions.setWeekOffset(weekOffset + delta);
  };

  return React.createElement(
    "section",
    { "data-angst-module": "planner", "data-version": "0.0" },
    React.createElement(
      "header",
      null,
      React.createElement("strong", null, "Semana"),
      React.createElement("span", null, ` · semana ${weekOffset >= 0 ? "+" : ""}${weekOffset}`),
    ),
    React.createElement("p", null, `${today.tasks.length} tarea(s) registradas para ${todayKey}.`),
    React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        { type: "button", onClick: () => changeWeek(-1) },
        "← semana anterior",
      ),
      React.createElement(
        "button",
        { type: "button", onClick: () => changeWeek(1) },
        "semana siguiente →",
      ),
    ),
  );
}
