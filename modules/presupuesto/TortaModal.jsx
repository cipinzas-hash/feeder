// Torta oval de gasto, en tres niveles y tres vistas (Por sobre / Por categoría / Por compra). Se abre desde los cuatro botones
// de las esquinas de la rueda. El interruptor Mensual/Anual es el mismo de la pantalla principal (un solo estado en BudgetPage).
// Tocar una porción la resalta y muestra su gasto del período y de 12 meses; tocarla otra vez abre el nivel siguiente.
import { fmtCLP } from "../../core/format.js";
import { Interruptor } from "./PresupuestoRueda.jsx";
import { rebanadas, emojiCategoria, SIN_CAT } from "./tortaDatos.js";
const { useState } = React;

const F = "'DM Sans',sans-serif", C = "'Caveat',cursive";
const NEG = ["#111111", "#3a3a3a", "#666666", "#8c8c8c", "#b5b5b5"], ROJ = ["#b71c1c", "#e53935", "#c62828", "#ef5350", "#ef9a9a"];
// Negros y rojos intercalados (negros y grises con el rojo de invitado)
const color = (i, n) => (n > 1 && n % 2 === 1 && i === n - 1) ? "#8c8c8c" : (i % 2 === 0 ? NEG[(i / 2) % NEG.length] : ROJ[((i - 1) / 2) % ROJ.length]);
const TABS = [["s", "Por sobre"], ["c", "Por categoría"], ["p", "Por compra"]];
const CX = 160, CY = 100, RX = 146, RY = 88;

export default function TortaModal({ datos, modo, onModo, periodLabel, onPrev, onNext, tabInicial, onClose }) {
  const [tab, setTab] = useState(tabInicial || "s");
  const [sobre, setSobre] = useState(null);
  const [cat, setCat] = useState(null);
  const [prod, setProd] = useState(null);
  const [hi, setHi] = useState(-1);
  const anual = modo === "a";
  const { filas, movs } = datos;

  const r = rebanadas({ movs, filas, modo, tab, sobre, cat, prod });
  const items = r.items, nivel = r.nivel;
  const total = items.reduce((t, x) => t + x.d, 0);
  const filaDe = k => filas.find(f => `${f.sec}|${f.row.id}` === k);
  const sobreFila = sobre ? filaDe(sobre) : null;
  const catDe = m => (m.categoria && String(m.categoria).trim()) || SIN_CAT;

  const cambiarTab = t => { setTab(t); setSobre(null); setCat(null); setProd(null); setHi(-1); };
  const subir = () => { if (prod) setProd(null); else if (cat) { setCat(null); if (tab === "c") setSobre(null); } else if (sobre) setSobre(null); setHi(-1); };
  const profundo = tab === "p" ? !!prod : (tab === "s" ? !!sobre : !!cat);
  const tocar = i => {
    const x = items[i]; if (!x) return;
    if (hi === i && !x.otras && !(tab !== "p" && nivel === 2)) {
      if (tab === "s" && nivel === 0) setSobre(x.key);
      else if (tab === "s" && nivel === 1) setCat(x.l);
      else if (tab === "c" && nivel === 0) { setSobre(x.sobre); setCat(x.cat); }
      else if (tab === "p" && nivel === 0) setProd(x.key);
      setHi(-1); return;
    }
    setHi(hi === i ? -1 : i);
  };

  // Ruta (migas)
  const migas = [];
  const nombreTab = TABS.find(t => t[0] === tab)[1];
  migas.push({ t: nombreTab, ir: () => { setSobre(null); setCat(null); setProd(null); setHi(-1); } });
  if (tab === "s" && sobreFila) migas.push({ t: `${sobreFila.row.emoji || ""} ${sobreFila.row.label}`.trim(), ir: () => { setCat(null); setHi(-1); } });
  if (cat) migas.push({ t: `${emojiCategoria(cat)} ${cat}${tab === "c" && sobreFila ? " · " + sobreFila.row.label : ""}` });
  if (tab === "p" && r.ficha) migas.push({ t: `${r.ficha.e} ${r.ficha.l}` });
  const titulo = r.ficha ? `${r.ficha.e} ${r.ficha.l}` : (cat ? `${emojiCategoria(cat)} ${cat}` : (sobreFila && tab === "s" ? `${sobreFila.row.emoji || ""} ${sobreFila.row.label}` : "📊 Gasto"));

  // Torta
  let svg;
  if (r.ficha) svg = (<svg width="308" height="200" viewBox="0 0 320 200" role="img" aria-label={`Compra ${r.ficha.l}`}><ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="#111111" stroke="#fff" strokeWidth="2"/><text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="44">{r.ficha.e}</text></svg>);
  else if (items.length === 0) svg = <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13, textAlign: "center", padding: "0 20px" }}>Aún no hay gastos registrados {anual ? "en los últimos 12 meses" : "en este período"}.</div>;
  else {
    let cum = -Math.PI / 2; const trozos = [], emojis = [];
    items.forEach((x, i) => {
      const p = x.d / total, a = p * 2 * Math.PI, mid = cum + a / 2, f = p >= 0.06 ? 0.7 : 0.88, op = hi < 0 || hi === i ? 1 : 0.3;
      let ex = CX + RX * f * Math.cos(mid), ey = CY + RY * f * Math.sin(mid);
      if (items.length === 1) { trozos.push(<ellipse key={x.key} data-i={i} cx={CX} cy={CY} rx={RX} ry={RY} fill={color(i, 1)} stroke="#fff" strokeWidth="2" style={{ cursor: "pointer" }}/>); ex = CX; ey = CY - RY * 0.45; }
      else {
        const x1 = CX + RX * Math.cos(cum), y1 = CY + RY * Math.sin(cum); cum += a;
        const x2 = CX + RX * Math.cos(cum), y2 = CY + RY * Math.sin(cum);
        trozos.push(<path key={x.key} data-i={i} d={`M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)} A${RX},${RY} 0 ${a > Math.PI ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`} fill={color(i, items.length)} stroke="#fff" strokeWidth="2" style={{ cursor: "pointer", opacity: op }}/>);
      }
      emojis.push(<text key={"e" + x.key} data-i={i} x={ex.toFixed(1)} y={ey.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize={p >= 0.06 ? 18 : 14} style={{ cursor: "pointer", opacity: op === 1 ? 1 : 0.4 }}>{x.e}</text>);
    });
    const centro = nivel === 0 ? (tab === "p" ? (anual ? "compras año" : "compras") : (anual ? "12 meses" : "período")) : (cat || (sobreFila ? sobreFila.row.label : ""));
    svg = (<svg width="308" height="200" viewBox="0 0 320 200" role="img" aria-label="Torta oval de gasto">{trozos}{emojis}
      <ellipse cx={CX} cy={CY} rx="50" ry="29" fill="#fff"/>
      <text x={CX} y="93" textAnchor="middle" dominantBaseline="middle" fontFamily="Caveat,cursive" fontSize="15" fontWeight="700" fill="#111">{centro}</text>
      <text x={CX} y="110" textAnchor="middle" dominantBaseline="middle" fontFamily="DM Sans,sans-serif" fontSize="13" fontWeight="500" fill="#111">{fmtCLP(total)}</text></svg>);
  }

  // Resumen bajo la torta
  let resumen = null;
  if (r.ficha) {
    const f = r.ficha, fila = (rot, v) => <div key={rot} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "7px 0", borderBottom: "1px dashed #ddd" }}><span>{rot}</span><span style={{ textAlign: "right" }}>{v}</span></div>;
    resumen = (<div>
      <div style={{ background: "#f5f5f5", border: "1px dashed #bbb", borderRadius: 8, padding: "8px 10px", fontSize: 13, display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>{f.e} {f.l}</span><b>{fmtCLP(anual ? f.anual : f.periodo)}</b></div>
      {fila("Sobre", f.sobre)}{fila("Categoría", f.categoria)}
      {!anual && f.fechas.length > 0 && fila("Registrada", f.fechas.join(", "))}
      {fila("En el período", fmtCLP(f.periodo))}{fila("En 12 meses", `${fmtCLP(f.anual)} en ${f.veces} compra${f.veces === 1 ? "" : "s"}`)}
      {fila("Por compra", f.min === f.max ? fmtCLP(f.min) : `entre ${fmtCLP(f.min)} y ${fmtCLP(f.max)}`)}
      <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>Los precios varían: aquí verás cómo se movió cada vez.</div></div>);
  } else if (tab === "s" && nivel === 1 && sobreFila) {
    const gp = items.reduce((t, x) => t + (anual ? x.y : x.p), 0), tope = anual ? sobreFila.asignado * 12 : sobreFila.asignado, pc = tope > 0 ? Math.round((gp / tope) * 100) : 0;
    resumen = (<div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}><span>Gastado de lo asignado{anual ? " en el año" : ""}</span><span>{fmtCLP(gp)} de {fmtCLP(tope)}</span></div>
      <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden", margin: "6px 0 4px", border: "1px dashed #ccc" }}><div style={{ width: `${Math.min(100, pc)}%`, height: "100%", background: pc >= 85 ? "#b71c1c" : "#111" }}/></div>
      {anual && <div style={{ fontSize: 12, color: "#777" }}>En promedio {fmtCLP(gp / 12)} al mes contra {fmtCLP(sobreFila.asignado)} asignados.</div>}</div>);
  } else if (nivel === 2 && cat && sobre) {
    const base = movs.filter(m => `${m.sec}|${m.rowId}` === sobre && catDe(m) === cat);
    const y = base.reduce((t, m) => t + (m.monto || 0), 0), p = base.filter(m => m.enPeriodo).reduce((t, m) => t + (m.monto || 0), 0);
    resumen = <div style={{ background: "#f5f5f5", border: "1px dashed #bbb", borderRadius: 8, padding: "8px 10px", fontSize: 13, display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span>{emojiCategoria(cat)} {cat} · {anual ? "este período" : "últimos 12 meses"}</span><b>{fmtCLP(anual ? p : y)}</b></div>;
  }

  const h = hi >= 0 ? items[hi] : null;
  const hint = r.ficha ? "" : (h ? null : (tab !== "p" && nivel === 2 ? "Toca una compra para resaltarla" : "Toca una porción para resaltarla; otro toque abre el siguiente nivel"));
  const flecha = { background: "#fff", color: "#111", border: "1px dashed #999", borderRadius: 6, padding: "3px 9px", fontSize: 14, cursor: "pointer" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 12, width: "min(95vw,440px)", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "6px 6px 0 #111", fontFamily: F, color: "#111" }}>
        <div style={{ background: "#111", padding: "11px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          {profundo && <button onClick={subir} aria-label="Subir un nivel" style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", padding: "0 6px", lineHeight: 1 }}>‹</button>}
          <div style={{ fontFamily: C, fontSize: 22, color: "#fff", fontWeight: 700, flex: 1 }}>{titulo}</div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "#f5f5f5", borderBottom: "1px dashed #bbb", flexWrap: "wrap" }}>
          <Interruptor modo={modo} onChange={onModo}/>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2, fontSize: 12, color: "#555" }}>
            {!anual && <button onClick={onPrev} aria-label="Período anterior" style={flecha}>‹</button>}
            <span style={{ minWidth: 92, textAlign: "center" }}>{anual ? "últimos 12 meses" : periodLabel}</span>
            {!anual && <button onClick={onNext} aria-label="Período siguiente" style={flecha}>›</button>}
          </div>
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid #eee" }}>
          {TABS.map(([k, n]) => <button key={k} onClick={() => cambiarTab(k)} style={{ flex: 1, padding: "9px 4px", fontFamily: C, fontSize: 17, fontWeight: 700, cursor: "pointer", border: "none", borderRadius: 0, background: tab === k ? "#111" : "#fff", color: tab === k ? "#fff" : "#999" }}>{n}</button>)}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 14px" }}>
          <div style={{ fontSize: 12, color: "#777", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 4 }}>
            {migas.map((m, i) => i === migas.length - 1
              ? <span key={i} style={{ color: "#111", fontWeight: 500 }}>{m.t}</span>
              : <span key={i}><span onClick={m.ir} style={{ cursor: "pointer", textDecoration: "underline dotted" }}>{m.t}</span> ›</span>)}
          </div>
          <div onClick={e => { const t = e.target.closest ? e.target.closest("[data-i]") : null; if (t) tocar(Number(t.getAttribute("data-i"))); }} style={{ display: "flex", justifyContent: "center" }}>{svg}</div>
          <div style={{ fontSize: 12, color: "#777", textAlign: "center", minHeight: 34, margin: "2px 0 6px" }}>
            {h ? <span><b style={{ color: "#111" }}>{h.e} {h.l}</b>: {fmtCLP(h.p)} en el período · {fmtCLP(h.y)} en 12 meses{!h.otras && !(tab !== "p" && nivel === 2) ? <><br/>toca de nuevo para abrir</> : null}</span> : hint}
          </div>
          {resumen}
          {!r.ficha && items.map((x, i) => (
            <div key={x.key} data-i={i} onClick={() => tocar(i)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "7px 0", borderBottom: "1px dashed #ddd", cursor: "pointer", opacity: hi < 0 || hi === i ? 1 : 0.45 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, flexShrink: 0, background: color(i, items.length) }}/>
              <span style={{ fontSize: 16 }}>{x.e}</span>
              <span style={{ flex: 1, lineHeight: 1.25, minWidth: 0 }}>{x.l}{x.sub ? <span style={{ fontSize: 12, color: "#777" }}> · {x.sub}</span> : null}<div style={{ fontSize: 12, color: "#777" }}>{anual ? `período ${fmtCLP(x.p)}` : `12 meses ${fmtCLP(x.y)}`}</div></span>
              <span style={{ fontWeight: 500 }}>{fmtCLP(x.d)}</span>
              <span style={{ width: 34, textAlign: "right", fontSize: 12, color: "#777" }}>{total > 0 ? Math.round((x.d / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
