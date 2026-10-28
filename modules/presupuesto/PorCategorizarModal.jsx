// Gastos ya registrados que quedaron sin categoría (todos los gastos deben tener una). Se les pone una a una, desde la lista de
// categorías de su sobre o creando una nueva; el dato original (monto, fecha, nota) no se toca.
import { fmtCLP } from "../../core/format.js";
import { gastosSinCategoria, categorizarGasto, categoriasDe } from "../../core/presupuesto-modelo.js";
const { useState } = React;
const F = "'DM Sans',sans-serif", C = "'Caveat',cursive";
const campo = { border: "1px dashed #999", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: F, background: "#fff", color: "#111", outline: "none", boxSizing: "border-box", width: "100%" };
const fechaCorta = iso => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : ""; };

function Pendiente({ budgets, periodo, gasto, onGuardar }) {
  const fila = ((budgets[periodo] || {})[gasto.sec] || []).find(r => r.id === gasto.rowId);
  const cats = fila ? categoriasDe(fila) : [];
  const [sel, setSel] = useState("");
  const [nueva, setNueva] = useState("");
  const [err, setErr] = useState("");
  const efectiva = sel || (cats.length === 0 ? "__nueva" : "");
  const cat = efectiva === "__nueva" ? nueva.trim() : efectiva;
  function guardar() {
    const r = categorizarGasto(budgets, periodo, gasto.id, cat);
    if (r.error) { setErr(r.error); return; }
    onGuardar(periodo, r.budget);
  }
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px dashed #ddd" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
        <span style={{ minWidth: 0 }}>{gasto.nota || "(sin nota)"}<div style={{ fontSize: 12, color: "#777" }}>{fechaCorta(gasto.fecha)} · {fila ? `${fila.emoji || ""} ${fila.label}`.trim() : "Sobre"}</div></span>
        <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fmtCLP(gasto.monto)}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {cats.length > 0 && (
          <select value={efectiva} onChange={e => { setSel(e.target.value); setErr(""); }} style={{ ...campo, flex: 1 }}>
            <option value="">Elegir categoría…</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__nueva">+ nueva categoría…</option>
          </select>
        )}
        {efectiva === "__nueva" && <input value={nueva} onChange={e => { setNueva(e.target.value); setErr(""); }} placeholder={cats.length === 0 ? `primera categoría de ${fila ? fila.label : "este sobre"}` : "nombre"} style={{ ...campo, flex: 1 }}/>}
        <div role="button" tabIndex={0} aria-label="Guardar categoría" onClick={() => cat && guardar()} onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && cat) { e.preventDefault(); guardar(); } }}
          style={{ flexShrink: 0, background: cat ? "#111" : "#ccc", color: "#fff", borderRadius: 8, padding: "8px 14px", fontFamily: C, fontSize: 17, fontWeight: 700, cursor: cat ? "pointer" : "default", userSelect: "none", display: "flex", alignItems: "center" }}>Guardar</div>
      </div>
      {err && <div style={{ fontSize: 12, color: "#c00", marginTop: 4 }}>{err}</div>}
    </div>
  );
}

export default function PorCategorizarModal({ budgets, onSaveBudget, onClose }) {
  const lista = gastosSinCategoria(budgets);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 12, width: "min(95vw,440px)", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "6px 6px 0 #111", fontFamily: F, color: "#111" }}>
        <div style={{ background: "#111", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: C, fontSize: 22, color: "#fff", fontWeight: 700 }}>🏷️ Por categorizar <span style={{ fontSize: 14, color: "#888" }}>{lista.length}</span></div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 14px" }}>
          <div style={{ fontSize: 12, color: "#777", padding: "8px 0 2px" }}>Todo gasto lleva categoría. Estos se registraron antes de que fuera obligatoria: ponles la que corresponda; el monto, la fecha y la nota no cambian.</div>
          {lista.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "26px 0" }}>Todo está categorizado ✓</div>}
          {lista.map(x => <Pendiente key={x.gasto.id} budgets={budgets} periodo={x.periodo} gasto={x.gasto} onGuardar={onSaveBudget}/>)}
        </div>
      </div>
    </div>
  );
}
