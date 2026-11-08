// Todos los movimientos (gastos registrados) del período, o de los últimos 12 meses si el interruptor está en Anual.
import { fmtCLP } from "../../core/format.js";
import { Ventana, VentanaCabecera } from "../shared/ui.jsx";
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
    <Ventana onClose={onClose} ancho={440}>
        <VentanaCabecera titulo="Todos los movimientos" sub={<>{anual ? "12 meses" : periodLabel}</>} onClose={onClose}/>
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
    </Ventana>
  );
}
