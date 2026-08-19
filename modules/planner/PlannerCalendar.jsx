const React = globalThis.React;

const MARKS = [
  ["social", "🟢"],
  ["romantic", "🌸"],
  ["work", "💼"],
  ["colegio", "🎒"],
  ["doctor", "🏥"],
  ["gym", "🏋️"],
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function keyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameWeek(a, b) {
  const aa = new Date(a);
  const bb = new Date(b);
  aa.setHours(12, 0, 0, 0);
  bb.setHours(12, 0, 0, 0);
  const delta = (aa.getDay() + 6) % 7;
  aa.setDate(aa.getDate() - delta);
  return aa.getTime() === bb.getTime();
}

export default function PlannerCalendar({ state, actions = {}, weekStart, onClose }) {
  const initial = weekStart || new Date();
  const [month, setMonth] = React.useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [mark, setMark] = React.useState(null);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: leading + days }, (_, i) => i < leading ? null : new Date(year, monthIndex, i - leading + 1));
  const marks = state?.calMarks || {};

  const toggleMark = (date) => {
    if (!mark || !actions.setCalendarMarks) return;
    const key = keyOf(date);
    const current = Array.isArray(marks[key]) ? marks[key] : marks[key] ? [marks[key]] : [];
    const next = current.includes(mark) ? current.filter((value) => value !== mark) : [...current, mark];
    actions.setCalendarMarks({ ...marks, [key]: next });
  };

  return React.createElement(
    "div",
    { style: { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }, onClick: onClose },
    React.createElement(
      "section",
      { style: { background: "#fff", width: "min(94vw, 420px)", border: "2px dashed #111", borderRadius: 12, boxShadow: "5px 5px 0 #111", overflow: "hidden" }, onClick: (event) => event.stopPropagation() },
      React.createElement("header", { style: { background: "#111", color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("button", { onClick: () => setMonth(new Date(year, monthIndex - 1, 1)), style: { background: "transparent", border: 0, color: "#fff", fontSize: 22 } }, "‹"),
        React.createElement("strong", { style: { fontFamily: "'Caveat',cursive", fontSize: 22 } }, `${MONTHS[monthIndex]} ${year}`),
        React.createElement("button", { onClick: () => setMonth(new Date(year, monthIndex + 1, 1)), style: { background: "transparent", border: 0, color: "#fff", fontSize: 22 } }, "›"),
      ),
      React.createElement("div", { style: { padding: 10, display: "flex", flexWrap: "wrap", gap: 6, borderBottom: "1px solid #eee" } },
        React.createElement("span", { style: { fontSize: 10, color: "#aaa", letterSpacing: 2, alignSelf: "center" } }, "MARCAR"),
        ...MARKS.map(([id, icon]) => React.createElement("button", { key: id, onClick: () => setMark(mark === id ? null : id), style: { border: "1px solid #ccc", borderRadius: 16, background: mark === id ? "#111" : "#fff", color: mark === id ? "#fff" : "#111", padding: "4px 8px", cursor: "pointer" } }, `${icon} ${id}`)),
      ),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, padding: 12 } },
        ...["L", "M", "X", "J", "V", "S", "D"].map((label) => React.createElement("div", { key: label, style: { fontSize: 10, color: "#aaa", textAlign: "center" } }, label)),
        ...cells.map((date, index) => {
          if (!date) return React.createElement("div", { key: `empty-${index}` });
          const key = keyOf(date);
          const dayMarks = Array.isArray(marks[key]) ? marks[key] : marks[key] ? [marks[key]] : [];
          const selected = sameWeek(date, weekStart || initial);
          return React.createElement(
            "button",
            { key, onClick: () => toggleMark(date), title: mark ? `marcar ${mark}` : key, style: { minHeight: 48, border: selected ? "2px solid #111" : "1px solid #eee", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 } },
            React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, date.getDate()),
            React.createElement("span", { style: { fontSize: 11 } }, dayMarks.map((id) => MARKS.find(([key]) => key === id)?.[1] || "").join(" ")),
          );
        }),
      ),
      React.createElement("footer", { style: { display: "flex", justifyContent: "space-between", padding: "10px 12px", borderTop: "1px solid #eee" } },
        React.createElement("button", { onClick: onClose }, "cerrar"),
        React.createElement("button", { onClick: () => { if (actions.setWeekOffset && weekStart) actions.setWeekOffset(0); onClose?.(); } }, "cerrar"),
      ),
    ),
  );
}
