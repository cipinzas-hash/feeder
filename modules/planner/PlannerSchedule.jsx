const React = globalThis.React;

function makeId() {
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEvent(event) {
  return {
    id: event.id || makeId(),
    time: event.time || "09:00",
    title: event.title || "",
    done: !!event.done,
  };
}

export function addScheduleEvent(schedule, event) {
  return [...(Array.isArray(schedule) ? schedule : []), normalizeEvent(event)]
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

export function updateScheduleEvent(schedule, id, patch) {
  return (Array.isArray(schedule) ? schedule : []).map((event) =>
    event.id === id ? normalizeEvent({ ...event, ...patch }) : event,
  );
}

export function removeScheduleEvent(schedule, id) {
  return (Array.isArray(schedule) ? schedule : []).filter((event) => event.id !== id);
}

export default function PlannerSchedule({ schedule = [], actions = {} }) {
  const list = Array.isArray(schedule) ? schedule : [];
  const update = (next) => actions.updateSchedule?.(next);

  const add = () => {
    const title = globalThis.prompt?.("Evento")?.trim();
    if (!title) return;
    const time = globalThis.prompt?.("Hora", "09:00")?.trim() || "09:00";
    update(addScheduleEvent(list, { title, time }));
  };

  return React.createElement(
    "section",
    { className: "planner-schedule", "data-planner-feature": "schedule" },
    React.createElement("header", null,
      React.createElement("strong", null, "Agenda"),
      React.createElement("button", { type: "button", onClick: add }, "+"),
    ),
    list.length === 0
      ? React.createElement("p", null, "Sin eventos")
      : React.createElement("ol", null, list.map((event) => React.createElement(
        "li",
        { key: event.id },
        React.createElement("time", null, event.time),
        React.createElement("span", null, event.title),
        React.createElement("button", { type: "button", onClick: () => update(updateScheduleEvent(list, event.id, { done: !event.done })) }, event.done ? "✓" : "○"),
        React.createElement("button", { type: "button", onClick: () => update(removeScheduleEvent(list, event.id)), "aria-label": `eliminar ${event.title}` }, "×"),
      ))),
  );
}
