const React = globalThis.React;
import { getDay } from "./state.js";
import PlannerTaskList from "./PlannerTaskList.jsx";
import PlannerDayUtilities from "./PlannerDayUtilities.jsx";
import PlannerDayReflection from "./PlannerDayReflection.jsx";
import PlannerShopping from "./PlannerShopping.jsx";
import PlannerSchedule from "./PlannerSchedule.jsx";

const DEFAULT_DAY = { tasks: [], abasto: "", cookingMode: "", aseoMode: "", menu: "", summary: "", humors: [], humorCustom: [], compras: [], schedule: [] };
function normalizeDay(day) { return day || DEFAULT_DAY; }

export default function PlannerDayCard({ state, dateKey, dayName, holidayLabel = "", isToday = false, isWeekend = false, cookingOptions = [], aseoOptions = [], actions = {}, integrations = {} }) {
  const day = normalizeDay(getDay(state, dateKey));
  const updateDay = (fields) => { if (actions.updateDay) actions.updateDay(dateKey, (current) => ({ ...current, ...fields })); };
  const updateTasks = (updater) => updateDay({ tasks: updater(day.tasks || []) });
  const taskActions = { ...actions, updateTasks, postponeTask: (taskId) => actions.postponeTask?.(dateKey, taskId), completeCarriedTask: (taskId) => actions.completeCarriedTask?.(dateKey, taskId) };
  return React.createElement("article", { className: `planner-day-card${isToday ? " planner-day-card--today" : ""}`, "data-date": dateKey },
    React.createElement("header", { className: "planner-day-card__header" }, React.createElement("strong", null, dayName), React.createElement("span", null, dateKey), holidayLabel ? React.createElement("small", null, holidayLabel) : null),
    React.createElement(PlannerTaskList, { tasks: day.tasks || [], actions: taskActions, integrations }),
    React.createElement(PlannerShopping, { items: day.compras || [], actions: { updateItems: (items) => updateDay({ compras: items }) } }),
    React.createElement(PlannerSchedule, { schedule: day.schedule || [], actions: { updateSchedule: (schedule) => updateDay({ schedule }) } }),
    React.createElement(PlannerDayUtilities, { day, cookingOptions, aseoOptions, actions: { updateDay }, integrations }),
    React.createElement(PlannerDayReflection, { day, actions: { updateDay }, integrations }),
    React.createElement("footer", null, isWeekend ? "fin de semana" : "día laboral"),
  );
}
