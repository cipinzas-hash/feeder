// Todos los movimientos (gastos registrados) del período, o de los últimos 12 meses si el interruptor está en Anual.
import { fmtCLP } from "../../core/format.js";
const { useState } = React;
const F = "'DM Sans',sans-serif", C = "'Caveat',cursive";

function fechaCorta(iso) { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : ""; }

// movs [{id,fecha,nota,categoria,monto,sec,rowId,enPeriodo}], filas [{sec,row}]
export default function MovimientosModal({ movs, filas, anual, periodLabel, onClose }) {
  const [q, setQ] = useState("");
  const [sobre, setSobre] = useState("");
  const base = movs.filter(m => anual || m.enPeriodo);
  const nombreDe = m => { const f = filas.find(x => x.sec === m.sec && x.row.id === m.rowId); return f ? `${f.row.emoji || ""} ${f.row.label}`.trim() : "Sobre"; };
  const lista = base.filter(m => (!sobre || `${m.sec}|${m.rowId}` === sobre) && (!q.trim() || `${m.nota || ""} ${m.categoria || ""} ${nombreDe(m)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const total = lista.reduce((t, m) => t + m.monto, 0);
  const campo = { border: "1px dashed #999", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: F, background: "#fff", color: "#111", outline: "none", boxSizing: "border-box" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 12, width: "min(95vw,440px)", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "6px 6px 0 #111", fontFamily: F, color: "#111" }}>
        <div style={{ background: "#111", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: C, fontSize: 22, color: "#fff", fontWeight: 700 }}>Todos los movimientos <span style={{ fontSize: 14, color: "#888" }}>{anual ? "12 meses" : periodLabel}</span></div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "10px 14px 6px", display: "flex", gap: 6 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nota, categoría o sobre" style={{ ...campo, flex: 1, minWidth: 0 }}/>
          <select value={sobre} onChange={e => setSobre(e.target.value)} style={{ ...campo, maxWidth: 130 }}>
            <option value="">Todos</option>
            {filas.map(f => <option key={f.sec + f.row.id} value={`${f.sec}|${f.row.id}`}>{f.row.emoji} {f.row.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
          {lista.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "26px 0" }}>Sin movimientos con ese filtro.</div>}
          {lista.map(m => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "8px 0", borderBottom: "1px dashed #ddd" }}>
              <span style={{ minWidth: 0 }}>{m.nota || "(sin nota)"}<div style={{ fontSize: 12, color: "#777" }}>{fechaCorta(m.fecha)} · {nombreDe(m)}{m.categoria ? ` · ${m.categoria}` : ""}</div></span>
              <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fmtCLP(m.monto)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px dashed #bbb", padding: "10px 16px", fontSize: 13, display: "flex", justifyContent: "space-between" }}><span style={{ color: "#777" }}>{lista.length} movimiento{lista.length === 1 ? "" : "s"}</span><b>{fmtCLP(total)}</b></div>
      </div>
    </div>
  );
}
