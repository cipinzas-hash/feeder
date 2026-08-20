const React = globalThis.React;
const { createContext, useContext, useEffect, useMemo, useState } = React;

import {
  createInitialState,
  replaceDayData,
  setWeekOffset,
  updateDay,
  replaceCalendarMarks,
  setCustody,
  setCookingOptions,
  setAseoOptions,
  setRoutines,
  setRecurring,
  setLastRollover,
  loadPlannerState,
  savePlannerState,
} from "./index.js";
import { postponeTask, completeCarriedTask } from "./taskTransfer.js";

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  const [state, setState] = useState(() => createInitialState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPlannerState().then((stored) => {
      if (cancelled) return;
      setState(stored);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loaded) savePlannerState(state);
  }, [loaded, state]);

  const actions = useMemo(() => ({
    setWeekOffset: (value) => setState((current) => setWeekOffset(current, value)),
    applyStateAction: (action) => setState((current) => action(current)),
    replaceDayData: (value) => setState((current) => replaceDayData(current, value)),
    updateDay: (dateKey, fields) => setState((current) => updateDay(current, dateKey, fields)),
    setCalendarMarks: (marks) => setState((current) => replaceCalendarMarks(current, marks)),
    setCustody: (custody) => setState((current) => setCustody(current, custody)),
    setCookingOptions: (options) => setState((current) => setCookingOptions(current, options)),
    setAseoOptions: (options) => setState((current) => setAseoOptions(current, options)),
    setRoutines: (routines) => setState((current) => setRoutines(current, routines)),
    setRecurring: (recurring) => setState((current) => setRecurring(current, recurring)),
    setLastRollover: (value) => setState((current) => setLastRollover(current, value)),
    postponeTask: (dateKey, taskId) => setState((current) => postponeTask(current, dateKey, taskId)),
    completeCarriedTask: (dateKey, taskId) => setState((current) => completeCarriedTask(current, dateKey, taskId)),
  }), []);

  const value = useMemo(() => ({ state, actions, loaded }), [state, actions, loaded]);
  return React.createElement(PlannerContext.Provider, { value }, children);
}

export function usePlanner() {
  const value = useContext(PlannerContext);
  if (!value) throw new Error("usePlanner debe usarse dentro de PlannerProvider");
  return value;
}
