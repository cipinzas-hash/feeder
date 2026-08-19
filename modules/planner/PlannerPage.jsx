import React from "react";
import { getDay, setWeekOffset, updateDay } from "./index.js";

/**
 * Transitional Planner view.
 *
 * The visual composition is intentionally small at v0.0. Its purpose is to
 * establish the module mount contract before the historical Semana UI is
 * moved out of core/App.jsx.
 */
export default function PlannerPage({ state, actions = {}, integrations = {} }) {
  const plannerState = state || {};
  const weekOffset = plannerState.weekOffset || 0;
  const todayKey = integrations.todayKey || new Date().toISOString().slice(0, 10);
  const today = getDay(plannerState, todayKey);

  const changeWeek = (delta) => {
    if (actions.setWeekOffset) {
      actions.setWeekOffset(delta);
      return;
    }
    if (actions.setState) {
      actions.setState(setWeekOffset(plannerState, weekOffset + delta));
    }
  };

  const markToday = () => {
    const current = getDay(plannerState, todayKey);
    const next = updateDay(plannerState, todayKey, {
      ...current,
      summary: current.summary || "",
    });
    if (actions.setState) actions.setState(next);
  };

  return React.createElement(
    "section",
    { "data-angst-module": "planner", "data-version": "0.0" },
    React.createElement("header", null,
      React.createElement("strong", null, "Semana"),
      React.createElement("span", null, ` · semana ${weekOffset >= 0 ? "+" : ""}${weekOffset}`),
    ),
    React.createElement("p", null, `${today.tasks.length} tarea(s) registradas para ${todayKey}.`),
    React.createElement("div", null,
      React.createElement("button", { type: "button", onClick: () => changeWeek(-1) }, "← semana anterior"),
      React.createElement("button", { type: "button", onClick: () => changeWeek(1) }, "semana siguiente →"),
      React.createElement("button", { type: "button", onClick: markToday }, "mantener Planner activo"),
    ),
  );
}
