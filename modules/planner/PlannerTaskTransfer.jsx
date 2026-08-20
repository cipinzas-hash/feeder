const React = globalThis.React;
import { completeCarriedTask, nextDateKey, postponeTask } from "./taskTransfer.js";

/** Transitional gesture adapter for carried tasks. */
export default function PlannerTaskTransfer({ state = {}, dateKey, task, actions = {}, children }) {
  if (!task) return children || null;

  const postpone = () => {
    const toDate = nextDateKey(dateKey);
    const next = postponeTask(state.dayData, dateKey, task.id, toDate);
    actions.replaceDayData?.(next);
  };

  const completeOnTime = () => {
    const next = completeCarriedTask(state.dayData, dateKey, task.id);
    actions.replaceDayData?.(next);
  };

  return React.createElement(
    "div",
    { className: "planner-task-transfer" },
    children({ postpone, completeOnTime }),
  );
}
