const React = globalThis.React;
import PlannerDayCard from "./PlannerDayCard.jsx";
import { DAY_NAMES, isWithKids } from "./domain.js";
import { previousWeek, nextWeek } from "./actions.js";
import { getWeekDays, formatWeekRange, toDateKey } from "./weekView.js";

function applyWeekAction(actions, action, fallback) {
  if (actions.applyStateAction) actions.applyStateAction(action);
  else if (fallback) fallback();
}

export default function PlannerPage({ state = {}, actions = {}, integrations = {} }) {
  const weekOffset = state.weekOffset || 0;
  const todayKey = integrations.todayKey || toDateKey(new Date());
  const holidayLookup = integrations.holidayLookup || (() => "");

  const goPreviousWeek = () => applyWeekAction(
    actions,
    previousWeek,
    () => actions.setWeekOffset?.(weekOffset - 1),
  );
  const goNextWeek = () => applyWeekAction(
    actions,
    nextWeek,
    () => actions.setWeekOffset?.(weekOffset + 1),
  );

  const weekDays = getWeekDays(weekOffset);

  return React.createElement(
    "section",
    { className: "planner-page", "data-angst-module": "planner", "data-version": "0.0" },
    React.createElement(
      "div",
      { className: "planner-week-nav" },
      React.createElement("button", { type: "button", onClick: goPreviousWeek, "aria-label": "semana anterior" }, "‹"),
      React.createElement("div", { className: "planner-week-nav__range" }, formatWeekRange(weekOffset)),
      React.createElement("button", { type: "button", onClick: goNextWeek, "aria-label": "semana siguiente" }, "›"),
    ),
    React.createElement(
      "div",
      { className: "planner-week-grid" },
      weekDays.map(({ dayName, dateKey, isWeekend }) => React.createElement(
        PlannerDayCard,
        {
          key: dateKey,
          state,
          actions,
          dateKey,
          dayName,
          isWeekend,
          isToday: dateKey === todayKey,
          holidayLabel: holidayLookup(dateKey) || "",
          withKids: isWithKids(dateKey, state.custody),
        },
      )),
    ),
    React.createElement("div", { className: "planner-page__meta" }, `semana ${weekOffset >= 0 ? "+" : ""}${weekOffset} · ${DAY_NAMES.length} días`),
  );
}
