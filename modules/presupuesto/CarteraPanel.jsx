import { fmtCLP } from "../../core/format.js";
import { MONTH_NAMES } from "../../core/dates.js";
import { sinRepartir, maxSubMonto, claveBolsillo, gastosDe, puedeEliminar, fechaDe } from "../../core/presupuesto-modelo.js";
import { AmountRow, COL, GAP, FUENTE, celdaTitulo, PAD_MONTO } from "./grilla.jsx";
const { useState } = React;

const fechaCorta = iso => { const d = fechaDe(iso); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`; };
const sub = { fontFamily: FUENTE, fontSize: 12, color: "#444" };

function SubFila({ s, row, est, sobresOn, onPatch, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState(s.label);
  function guardarNombre() { if (txt.trim()) onPatch({ subs: row.subs.map(x => x.id === s.id ? { ...x, label: txt.trim() } : x) }); setEdit(false); }
  return (
    <div style={{ display: "grid", gridTemplateColumns: COL, gap: GAP, alignItems: "center", padding: "6px 0", borderBottom: "1px dashed #f0f0f0" }}>
      <div style={{ ...sub, display: "flex", gap: 5, minWidth: 0, alignItems: "center" }}>
        {s.emoji && <span style={{ flexShrink: 0 }}>{s.emoji}</span>}
        {edit
          ? <input autoFocus value={txt} onChange={e => setTxt(e.target.value)} onBlur={guardarNombre} onKeyDown={e => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEdit(false); }}
              style={{ fontSize: 12, border: "none", borderBottom: "1px dashed #aaa", background: "#fafafa", outline: "none", width: "100%", minWidth: 0 }}/>
          : <span onClick={() => { setTxt(s.label); setEdit(true); }} title="clic para editar" style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>}
      </div>
      <AmountRow value={s.monto} max={maxSubMonto(row, s.id)} onSave={v => onPatch({ subs: row.subs.map(x => x.id === s.id ? { ...x, monto: v } : x) })}/>
      <div style={{ gridColumn: "3 / 5", ...sub, textAlign: "right", color: est && est.saldo < 0 ? "#c00" : "#111", fontWeight: 600 }}>{sobresOn && est ? fmtCLP(est.saldo) : "—"}</div>
      <button onClick={onDelete} style={{ background: "transparent", border: "none", color: "#ddd", fontSize: 15, cursor: "pointer", lineHeight: 1, padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = "#c00"} onMouseLeave={e => e.currentTarget.style.color = "#ddd"}>×</button>
    </div>
  );
}

function GastoFila({ g, nombre, onDelete }) {
  const [seguro, setSeguro] = useState(false);
  return (
    <div style={{ padding: "5px 0", borderBottom: "1px dashed #f0f0f0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ ...sub, color: "#999", width: 44, flexShrink: 0 }}>{fechaCorta(g.fecha)}</span>
        <span style={{ ...sub, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</span>
        <span style={{ ...sub, fontWeight: 700, color: "#111" }}>{fmtCLP(g.monto)}</span>
        {seguro
          ? <span style={{ ...sub, fontSize: 11 }}><span onClick={onDelete} style={{ color: "#c00", cursor: "pointer", marginRight: 6 }}>borrar</span><span onClick={() => setSeguro(false)} style={{ color: "#999", cursor: "pointer" }}>no</span></span>
          : <button onClick={() => setSeguro(true)} style={{ background: "transparent", border: "none", color: "#ddd", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>}
      </div>
      {(g.nota || g.prestamoId) && <div style={{ ...sub, fontSize: 11, color: "#888", paddingLeft: 52 }}>{g.nota}{g.prestamoId && <span style={{ color: "#a60", marginLeft: g.nota ? 6 : 0 }}>💳 con préstamo</span>}</div>}
    </div>
  );
}

// Contenido de la ventana de una cartera: reparto en sub-partidas, saldos de sus sobres y gastos del período.
export default function CarteraPanel({ sec, row, periodo, budgets, budget, estado, sobresOn, esInicio, etiquetaSaldo, onPatchRow, onDeleteGasto, onApertura, onAviso }) {
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [nombre, setNombre] = useState("");
  const subs = row.subs || [];
  const porId = Object.fromEntries((estado ? estado.items : []).map(i => [String(i.subId), i.estado]));
  function agregar() {
    if (!nombre.trim()) return;
    onPatchRow({ subs: [...subs, { id: "s" + Date.now().toString(36), emoji: emoji.trim(), label: nombre.trim(), monto: 0 }] });
    setNombre(""); setEmoji(""); setAdding(false);
  }
  function quitar(s) {
    const p = puedeEliminar(budgets, periodo, sec, row, s.id);
    if (!p.ok) { onAviso(p.motivo); return; }
    onPatchRow({ subs: subs.filter(x => x.id !== s.id) });
  }
  const gastos = gastosDe(budget, sec, row.id).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const nombreDe = id => id == null ? (subs.length ? "Sin repartir" : row.label) : ((subs.find(x => x.id === id) || {}).label || "(sub-partida eliminada)");
  const libre = sinRepartir(row);
  const bolsillosInicio = estado ? estado.items : [];

  return (
    <div style={{ padding: "4px 0 8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: COL, gap: GAP, padding: "2px 0 4px" }}>
        <div style={{ ...celdaTitulo, letterSpacing: 2, textTransform: "uppercase" }}>Sub-partidas</div>
        <div style={{ ...celdaTitulo, textAlign: "right", paddingRight: PAD_MONTO }}>$ Asignado</div>
        <div style={{ ...celdaTitulo, gridColumn: "3 / 5", textAlign: "right" }}>{etiquetaSaldo}</div>
        <div/>
      </div>
      {subs.map(s => <SubFila key={s.id} s={s} row={row} est={porId[s.id]} sobresOn={sobresOn} onPatch={onPatchRow} onDelete={() => quitar(s)}/>)}
      {subs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: COL, gap: GAP, padding: "6px 0", alignItems: "center" }}>
          <div style={{ ...sub, color: "#888" }}>Sin repartir</div>
          <div style={{ ...sub, textAlign: "right", paddingRight: PAD_MONTO, color: "#888" }}>{fmtCLP(libre)}</div>
          <div style={{ gridColumn: "3 / 5", ...sub, textAlign: "right", color: "#888" }}>{sobresOn && porId["null"] ? fmtCLP(porId["null"].saldo) : "—"}</div>
          <div/>
        </div>
      )}
      {adding
        ? <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 0" }}>
            <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="📌" style={{ width: 34, textAlign: "center", border: "1px dashed #ccc", borderRadius: 4, padding: 3, fontSize: 15, outline: "none" }}/>
            <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") agregar(); if (e.key === "Escape") setAdding(false); }} placeholder="nombre de la sub-partida..."
              style={{ flex: 1, minWidth: 0, border: "1px dashed #ccc", borderRadius: 4, padding: "4px 8px", fontSize: 13, fontFamily: FUENTE, outline: "none", background: "#fff" }}/>
            <button onClick={agregar} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>✓</button>
            <button onClick={() => setAdding(false)} style={{ background: "transparent", border: "none", color: "#bbb", fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
        : <button onClick={() => setAdding(true)} style={{ background: "transparent", border: "1px dashed #ccc", borderRadius: 4, color: "#888", fontSize: 11, padding: "3px 10px", margin: "8px 0 2px", cursor: "pointer", fontFamily: FUENTE }}>+ sub-partida</button>}

      {sobresOn && esInicio && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...celdaTitulo, letterSpacing: 2, textTransform: "uppercase", padding: "4px 0" }}>Efectivo inicial del sobre</div>
          {bolsillosInicio.map(b => (
            <div key={String(b.subId)} style={{ display: "grid", gridTemplateColumns: COL, gap: GAP, alignItems: "center", padding: "4px 0" }}>
              <div style={{ ...sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.emoji} {b.label}</div>
              <AmountRow value={(budget.apertura || {})[claveBolsillo(sec, row.id, b.subId)] || 0} onSave={v => onApertura(claveBolsillo(sec, row.id, b.subId), v)}/>
              <div/><div/><div/>
            </div>
          ))}
        </div>
      )}

      {sobresOn && (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...celdaTitulo, letterSpacing: 2, textTransform: "uppercase", padding: "4px 0" }}>Gastos del período</div>
          {gastos.length === 0
            ? <div style={{ ...sub, color: "#bbb", fontSize: 11, padding: "4px 0" }}>Sin gastos registrados.</div>
            : gastos.map(g => <GastoFila key={g.id} g={g} nombre={nombreDe(g.subId)} onDelete={() => { const motivo = onDeleteGasto(g.id); if (typeof motivo === "string") onAviso(motivo); }}/>)}
        </div>
      )}
    </div>
  );
}
