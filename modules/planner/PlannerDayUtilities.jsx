const React = globalThis.React;

export default function PlannerDayUtilities({
  day = {},
  cookingOptions = [],
  aseoOptions = [],
  actions = {},
  integrations = {},
}) {
  const updateDay = (fields) => actions.updateDay?.((current) => ({ ...current, ...fields }));
  const saveOption = (field, value, fallback = []) => {
    const next = [...(field === "cookingOpts" ? cookingOptions : aseoOptions), value];
    if (field === "cookingOpts") integrations.setCookingOptions?.(next);
    else integrations.setAseoOptions?.(next);
  };

  return React.createElement(
    "section",
    { className: "planner-day-card__utilities" },
    React.createElement("div", { className: "planner-day-card__abasto" },
      React.createElement("label", null, "Abasto"),
      React.createElement("input", {
        value: day.abasto || "",
        placeholder: "qué hay que comprar...",
        onChange: (event) => updateDay({ abasto: event.target.value }),
      }),
      React.createElement("button", { type: "button", onClick: () => integrations.openShopping?.() }, "🛒"),
    ),
    React.createElement("div", { className: "planner-day-card__cooking" },
      React.createElement("label", null, "Cocina"),
      React.createElement("select", {
        value: day.cookingMode || "",
        onChange: (event) => updateDay({ cookingMode: event.target.value }),
      },
        React.createElement("option", { value: "" }, "🍳 seleccionar"),
        cookingOptions.map((option) => React.createElement("option", { key: option, value: option }, option)),
      ),
      React.createElement("button", { type: "button", onClick: () => { const value = prompt("Nueva opción de cocina"); if (value) saveOption("cookingOpts", value); } }, "+"),
    ),
    React.createElement("div", { className: "planner-day-card__cleaning" },
      React.createElement("label", null, "Aseo"),
      React.createElement("select", {
        value: day.aseoMode || "",
        onChange: (event) => updateDay({ aseoMode: event.target.value }),
      },
        React.createElement("option", { value: "" }, "🧹 seleccionar"),
        aseoOptions.map((option) => React.createElement("option", { key: option, value: option }, option)),
      ),
      React.createElement("button", { type: "button", onClick: () => { const value = prompt("Nueva opción de aseo"); if (value) saveOption("aseoOpts", value); } }, "+"),
    ),
  );
}
