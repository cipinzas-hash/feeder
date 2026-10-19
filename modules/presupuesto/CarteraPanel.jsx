import { fmtCLP } from "../../core/format.js";
import { MONTH_NAMES } from "../../core/dates.js";
import { sinRepartir, maxSubMonto, claveBolsillo, gastosDe, puedeEliminar, fechaDe, progresoMeta } from "../../core/presupuesto-modelo.js";
import { AmountRow, COL, GAP, FUENTE, celdaTitulo, PAD_MONTO } from "./grilla.jsx";
const { useState } = React;

const fechaCorta = iso => { const d = fechaDe(iso); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`; };
const sub = { fontFamily: FUENTE, fontSize: 12, color: "#444" };

const etiquetaMes = k => `${MONTH_NAMES[parseInt(k.slice(5)) - 1].slice(0, 3)} ${k.slice(0, 4)}`;
const fechaLarga = iso => { const d = fechaDe(iso); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

// Meta de ahorro con fecha de una sub-partida: cuánto falta, cuánto aportar al mes y cuándo se cumple.
function MetaLinea({ s, est, periodo }) {
  const m = s.meta;
  if (!m) return null;
  const p = progresoMeta({ saldo: est ? est.saldo : 0, objetivo: m.objetivo, fecha: m.fecha, periodo, aporteMensual: s.monto });
  let txt, color;
  if (p.cumplida) { txt = `🎯 Meta de ${fmtCLP(m.objetivo)} cumplida`; color = "#070"; }
  else {
    txt = `🎯 ${fmtCLP(m.objetivo)} para el ${fechaLarga(m.fecha)} · faltan ${fmtCLP(p.falta)}`;
    if (p.meses === 0) txt += " · vence antes del próximo aporte";
    else if (p.alDia) txt += ` · al día, se cumple en ${etiquetaMes(p.cumpleEn)}`;
    else txt += ` · necesita ${fmtCLP(p.necesario)}/mes (hoy ${fmtCLP(s.monto)})` + (p.cumpleEn ? `; con el aporte actual se cumpliría en ${etiquetaMes(p.cumpleEn)}` : "");
    color = p.alDia ? "#070" : "#c60";
  }
  return <div style={{ ...sub, fontSize: 11, color, padding: "0 0 6px", lineHeight: 1.4 }}>{txt}</div>;
}

function SubFila({ s, row, est, sobresOn, periodo, onPatch, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState(s.label);
  const [metaAbierta, setMetaAbierta] = useState(false);
  const [obj, setObj] = useState(s.meta ? String(s.meta.objetivo) : "");
  const [fec, setFec] = useState(s.meta ? s.meta.fecha : "");
  const [errMeta, setErrMeta] = useState("");
  function guardarNombre() { if (txt.trim()) onPatch({ subs: row.subs.map(x => x.id === s.id ? { ...x, label: txt.trim() } : x) }); setEdit(false); }
  function guardarMeta() {
    const o = parseInt(String(obj).replace(/\D/g, "")) || 0;
    if (o <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fec)) { setErrMeta("Indica el monto y la fecha de la meta."); return; }
    setErrMeta(""); onPatch({ subs: row.subs.map(x => x.id === s.id ? { ...x, meta: { objetivo: o, fecha: fec } } : x) }); setMetaAbierta(false);
  }
  function quitarMeta() {
    onPatch({ subs: row.subs.map(x => { if (x.id !== s.id) return x; const { meta, ...resto } = x; return resto; }) });
    setObj(""); setFec(""); setErrMeta(""); setMetaAbierta(false);
  }
  return (
    <div style={{ borderBottom: "1px dashed #f0f0f0" }}>
      <div style={{ display: "grid", gridTemplateColumns: COL, gap: GAP, alignItems: "center", padding: "6px 0" }}>
        <div style={{ ...sub, display: "flex", gap: 5, minWidth: 0, alignItems: "center" }}>
          {s.emoji && <span style={{ flexShrink: 0 }}>{s.emoji}</span>}
          {edit
            ? <input autoFocus value={txt} onChange={e => setTxt(e.target.value)} onBlur={guardarNombre} onKeyDown={e => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEdit(false); }}
                style={{ fontSize: 12, border: "none", borderBottom: "1px dashed #aaa", background: "#fafafa", outline: "none", width: "100%", minWidth: 0 }}/>
            : <span onClick={() => { setTxt(s.label); setEdit(true); }} title="clic para editar" style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>}
          <span onClick={() => setMetaAbierta(a => !a)} title="Meta con fecha" style={{ cursor: "pointer", flexShrink: 0, fontSize: 12, opacity: s.meta ? 1 : 0.35 }}>🎯</span>
        </div>
        <AmountRow value={s.monto} max={maxSubMonto(row, s.id)} onSave={v => onPatch({ subs: row.subs.map(x => x.id === s.id ? { ...x, monto: v } : x) })}/>
        <div style={{ gridColumn: "3 / 5", ...sub, textAlign: "right", color: est && est.saldo < 0 ? "#c00" : "#111", fontWeight: 600 }}>{sobresOn && est ? fmtCLP(est.saldo) : "—"}</div>
        <button onClick={onDelete} style={{ background: "transparent", border: "none", color: "#ddd", fontSize: 15, cursor: "pointer", lineHeight: 1, padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#c00"} onMouseLeave={e => e.currentTarget.style.color = "#ddd"}>×</button>
      </div>
      <MetaLinea s={s} est={est} periodo={periodo}/>
      {metaAbierta && (
        <div style={{ background: "#f8f8f8", border: "1px dashed #ddd", borderRadius: 6, padding: "8px 10px", margin: "0 0 8px" }}>
          <div style={{ ...sub, fontSize: 11, color: "#888", marginBottom: 6 }}>Meta de ahorro con fecha para «{s.label}»</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input inputMode="numeric" placeholder="$ objetivo" value={obj ? fmtCLP(parseInt(String(obj).replace(/\D/g, "")) || 0) : ""} onChange={e => { setObj(e.target.value); setErrMeta(""); }} style={{ width: 110, border: "1px dashed #bbb", borderRadius: 4, padding: "5px 8px", fontSize: 13, fontFamily: FUENTE, textAlign: "right", outline: "none", background: "#fff" }}/>
            <input type="date" value={fec} onChange={e => { setFec(e.target.value); setErrMeta(""); }} style={{ border: "1px dashed #bbb", borderRadius: 4, padding: "4px 6px", fontSize: 13, fontFamily: FUENTE, outline: "none", background: "#fff" }}/>
            <button onClick={guardarMeta} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 4, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>✓</button>
            {s.meta && <button onClick={quitarMeta} style={{ background: "transparent", border: "none", color: "#c00", fontSize: 11, cursor: "pointer", fontFamily: FUENTE }}>quitar meta</button>}
          </div>
          {errMeta && <div style={{ ...sub, fontSize: 11, color: "#c00", marginTop: 6 }}>{errMeta}</div>}
        </div>
      )}
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
      {subs.map(s => <SubFila key={s.id} s={s} row={row} est={porId[s.id]} sobresOn={sobresOn} periodo={periodo} onPatch={onPatchRow} onDelete={() => quitar(s)}/>)}
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
