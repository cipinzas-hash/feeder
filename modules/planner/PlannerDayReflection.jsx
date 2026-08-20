const React = globalThis.React;

function RatingRow({ label, icon, value = 0, onChange }) {
  return React.createElement(
    "div",
    { className: "planner-rating-row", "data-field": label.toLowerCase() },
    React.createElement("span", { className: "planner-rating-row__label" }, label),
    React.createElement(
      "div",
      { className: "planner-rating-row__scale" },
      Array.from({ length: 5 }).map((_, index) => React.createElement(
        "button",
        {
          key: index,
          type: "button",
          onClick: () => onChange?.(index + 1 === value ? 0 : index + 1),
          "aria-label": `${label}: ${index + 1}`,
          "aria-pressed": index < value,
        },
        React.createElement("span", { style: { opacity: index < value ? 1 : 0.18, filter: index < value ? "none" : "grayscale(1)" } }, icon),
      )),
    ),
  );
}

export default function PlannerDayReflection({ day = {}, actions = {}, integrations = {} }) {
  const updateDay = (fields) => actions.updateDay?.(fields);

  const externalHumor = integrations.renderHumorSelector;

  return React.createElement(
    "section",
    { className: "planner-day-reflection" },
    React.createElement(
      "div",
      { className: "planner-day-reflection__text" },
      React.createElement("label", null,
        "Menú",
        React.createElement("textarea", {
          value: day.menu || "",
          placeholder: "qué vas a comer...",
          onChange: (event) => updateDay({ menu: event.target.value }),
        }),
      ),
      React.createElement("label", null,
        "Cierre del día",
        React.createElement("textarea", {
          value: day.summary || "",
          placeholder: "cómo fue el día...",
          onChange: (event) => updateDay({ summary: event.target.value }),
        }),
      ),
    ),
    externalHumor
      ? externalHumor({
          value: Array.isArray(day.humors) && day.humors.length ? day.humors : (day.humor ? [day.humor] : []),
          custom: day.humorCustom || [],
          onSave: (humors, custom) => updateDay({ humors, humorCustom: custom }),
        })
      : React.createElement("div", { className: "planner-day-reflection__humor" },
          React.createElement("span", null, "Humor"),
          React.createElement("button", {
            type: "button",
            onClick: () => updateDay({ humors: day.humors?.length ? [] : ["neutral"] }),
          }, day.humors?.length ? "registrado ✓" : "registrar"),
        ),
    React.createElement(
      "div",
      { className: "planner-day-reflection__ratings" },
      React.createElement("h4", null, "Energía · Concentración · Sueño"),
      React.createElement(RatingRow, { label: "Energía", icon: "⚡", value: day.energy || 0, onChange: (value) => updateDay({ energy: value }) }),
      React.createElement(RatingRow, { label: "Concentración", icon: "🧠", value: day.concentration || 0, onChange: (value) => updateDay({ concentration: value }) }),
      React.createElement(RatingRow, { label: "Sueño", icon: "😴", value: day.sleep || 0, onChange: (value) => updateDay({ sleep: value }) }),
    ),
  );
}
