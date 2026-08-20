const React = globalThis.React;

export default function PlannerShopping({ items = [], actions = {} }) {
  const list = Array.isArray(items) ? items : [];
  const update = (next) => actions.updateItems?.(next);
  const addItem = () => {
    const name = globalThis.prompt?.("Producto")?.trim();
    if (!name) return;
    update([...list, { id: `${Date.now()}-${name}`, name, done: false }]);
  };
  const toggle = (id) => update(list.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const remove = (id) => update(list.filter((item) => item.id !== id));
  return React.createElement("section", { className: "planner-shopping", "data-planner-feature": "shopping" },
    React.createElement("header", null, React.createElement("strong", null, "Compras"), React.createElement("button", { type: "button", onClick: addItem }, "+")),
    list.length === 0 ? React.createElement("p", null, "Sin compras") : React.createElement("ul", null, list.map((item) => React.createElement("li", { key: item.id },
      React.createElement("button", { type: "button", onClick: () => toggle(item.id), "aria-pressed": !!item.done }, item.done ? "✓" : "○"),
      React.createElement("span", null, item.name),
      React.createElement("button", { type: "button", onClick: () => remove(item.id), "aria-label": `eliminar ${item.name}` }, "×"),
    ))),
  );
}
