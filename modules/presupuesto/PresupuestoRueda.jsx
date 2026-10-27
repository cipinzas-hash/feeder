// Pantalla principal de Presupuesto: «cómo voy». Los sobres (carteras) van en una rueda tipo iPod: se gira con el dedo,
// el de arriba es el seleccionado y sus datos se ven al centro; tocar el centro abre el detalle completo del sobre.
// La asignación (ingresos, gastos base, fondos) queda detrás de «Asignar».
// Va DENTRO del marco de la app (lineamiento «módulo colapsado, sin scroll»): sin ventana flotante, sin título propio (la pestaña ya
// dice el módulo) y llena el área libre; la rueda se escala al alto que sobra para que el estado colapsado nunca necesite scroll.
import { fmtCLP } from "../../core/format.js";
import { geometriaRueda, TAM } from "./ruedaGeometria.js";
const { useState, useRef, useEffect } = React;

const F = "'DM Sans',sans-serif", C = "'Caveat',cursive";
const mod = (a, n) => ((a % n) + n) % n;
const norm = a => { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; };

// Interruptor Mensual / Anual: dibujo propio (la «sombra» negra se queda fija sobre el modo en vista).
function Interruptor({ modo, onChange }) {
  const [x, setX] = useState(modo === "a" ? 84 : 0);
  const xr = useRef(x);
  useEffect(() => {
    const to = modo === "a" ? 84 : 0, from = xr.current;
    let t0 = null, raf;
    const paso = ts => {
      if (t0 === null) t0 = ts;
      const k = Math.min(1, (ts - t0) / 200), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
      xr.current = v; setX(v);
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [modo]);
  const alternar = () => onChange(modo === "m" ? "a" : "m");
  return (
    <svg width="176" height="34" viewBox="0 0 176 34" role="switch" aria-checked={modo === "a"} aria-label="Alternar entre mensual y anual" tabIndex={0}
      onClick={alternar} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar(); } }} style={{ cursor: "pointer", flexShrink: 0, outline: "none" }}>
      <rect x="1" y="1" width="174" height="32" rx="10" fill="#ffffff" stroke="#111111" strokeWidth="1.5" strokeDasharray="4 3"/>
      <text x="46" y="21" textAnchor="middle" fontSize="13" fill="#aaaaaa" fontFamily="DM Sans,sans-serif">Mensual</text>
      <text x="130" y="21" textAnchor="middle" fontSize="13" fill="#aaaaaa" fontFamily="DM Sans,sans-serif">Anual</text>
      <g transform={`translate(${x},0)`}>
        <rect x="6" y="6" width="84" height="26" rx="7" fill="#9a9a9a"/>
        <rect x="4" y="4" width="84" height="26" rx="7" fill="#111111"/>
        <text x="46" y="21" textAnchor="middle" fontSize="13" fontWeight="500" fill="#ffffff" fontFamily="DM Sans,sans-serif">{modo === "m" ? "Mensual" : "Anual"}</text>
      </g>
    </svg>
  );
}

// datos {filas:[{sec,row,asignado,gastado,anual,saldo,debiaHaber}], movs:[{id,fecha,nota,categoria,monto,sec,rowId,enPeriodo}]}
export default function PresupuestoRueda({ datos, periodLabel, sobresOn, hayInicio, modo, onModo, onPrev, onNext, bloqueo, aviso,
  onAsignar, onCierre, onGuia, onIniciarSobres, cierreVence, onAbrir, onRegistrar, onTodos }) {
  const filas = datos.filas;
  const N = Math.max(1, filas.length);
  const g = geometriaRueda(N);
  const [rot, setRotS] = useState(0);
  const rotRef = useRef(0);
  const setRot = v => { rotRef.current = v; setRotS(v); };
  const [arrastrando, setArrastrando] = useState(false);
  const caja = useRef(null);
  const zona = useRef(null);
  const [dim, setDim] = useState({ w: TAM, h: TAM + 20 });
  useEffect(() => {
    const el = zona.current;
    if (!el) return undefined;
    const medir = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filas.length]);
  const k = Math.max(0.5, Math.min(1.15, (dim.h - 14) / TAM, dim.w / TAM));   // escala de la rueda según el alto libre
  const down = useRef(null);
  const sel = mod(Math.round(-rot / g.paso), N);
  const fila = filas[sel];

  const prevSel = useRef(sel);
  useEffect(() => {
    if (prevSel.current !== sel) { prevSel.current = sel; try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) { /* sin vibración */ } }
  }, [sel]);

  const angulo = e => { const r = caja.current.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  function alBajar(e) {
    const t = e.target.closest ? e.target.closest("[data-i]") : null;
    down.current = { x: e.clientX, y: e.clientY, i: t ? Number(t.getAttribute("data-i")) : null, centro: !!(e.target.closest && e.target.closest("[data-centro]")), movido: false, ult: angulo(e) };
    setArrastrando(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
  }
  function alMover(e) {
    const d = down.current; if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5) d.movido = true;
    if (!d.movido) return;
    const a = angulo(e); setRot(rotRef.current + norm(a - d.ult)); d.ult = a;
  }
  function alSoltar() {
    const d = down.current; if (!d) return;
    setArrastrando(false);
    const s0 = Math.round(-rotRef.current / g.paso);
    let s = s0;
    if (!d.movido && d.i !== null) { let df = mod(d.i - s0, N); if (df > N / 2) df -= N; s = s0 + df; }
    setRot(-s * g.paso);
    down.current = null;
    if (!d.movido && d.centro && fila) onAbrir(fila.sec, fila.row.id);
  }

  const anual = modo === "a";
  const movsVista = datos.movs.filter(m => anual || m.enPeriodo);
  const totalGastado = filas.reduce((t, f) => t + (anual ? f.anual : f.gastado), 0);
  const nombreDe = m => { const f = filas.find(x => x.sec === m.sec && x.row.id === m.rowId); return f ? f.row.label : "Sobre"; };

  // Datos del centro según el modo
  let grande = 0, etiqueta = "disponible", pc = 0, linea = "";
  if (fila) {
    if (!anual) {
      grande = fila.saldo !== null ? fila.saldo : fila.asignado - fila.gastado;
      const base = fila.saldo !== null && fila.debiaHaber ? fila.debiaHaber : fila.asignado;
      pc = base > 0 ? Math.round((fila.gastado / base) * 100) : 0;
      linea = `${fmtCLP(fila.gastado)} gastado`;
    } else {
      grande = fila.anual; etiqueta = "gastado en 12 meses";
      pc = fila.asignado > 0 ? Math.round((fila.anual / (fila.asignado * 12)) * 100) : 0;
      linea = `promedio ${fmtCLP(fila.anual / 12)} al mes`;
    }
  }
  const pill = { flex: 1, background: "#fff", color: "#111", border: "1px dashed #111", borderRadius: 8, padding: "6px 4px", fontSize: 12, fontFamily: F, cursor: "pointer", whiteSpace: "nowrap" };
  const flecha = { background: "#fff", color: "#111", border: "1px dashed #999", borderRadius: 6, padding: "3px 9px", fontSize: 14, cursor: "pointer" };

  return (
    <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px 6px", boxSizing: "border-box", overflowY: "auto", fontFamily: F, color: "#111" }}>
      {bloqueo && <div style={{ flex: "none", fontSize: 12, color: "#8a5a00", background: "#fffaf0", border: "1px dashed #e0b070", borderRadius: 6, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ flex: 1 }}>🔒 {bloqueo.motivo}</span>{bloqueo.accion && <button onClick={bloqueo.accion} style={{ ...pill, flex: "none", padding: "5px 10px" }}>{bloqueo.etiqueta}</button>}</div>}
      {aviso && <div style={{ flex: "none", fontSize: 12, color: "#c00", background: "#fff5f5", border: "1px dashed #e0b0b0", borderRadius: 6, padding: "8px 10px" }}>{aviso}</div>}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Interruptor modo={modo} onChange={onModo}/>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2, fontSize: 12, color: "#555" }}>
          {!anual && <button onClick={onPrev} aria-label="Período anterior" style={flecha}>‹</button>}
          <span style={{ minWidth: 96, textAlign: "center" }}>{anual ? "últimos 12 meses" : periodLabel}</span>
          {!anual && <button onClick={onNext} aria-label="Período siguiente" style={flecha}>›</button>}
        </div>
      </div>
      <div style={{ flex: "none", display: "flex", gap: 6 }}>
        <button onClick={onAsignar} style={pill}>⚙️ Asignar</button>
        {sobresOn && <button onClick={onCierre} style={{ ...pill, ...(cierreVence ? { color: "#b71c1c", borderColor: "#b71c1c" } : {}) }}>🔍 Cierre</button>}
        {hayInicio ? <button onClick={onGuia} style={pill}>🧾 Guía</button> : <button onClick={onIniciarSobres} style={pill}>🧾 Iniciar sobres</button>}
      </div>
      <div style={{ flex: "none", display: "flex", gap: 8, alignItems: "stretch" }}>
        <div style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px dashed #111", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 12, color: "#777" }}>{anual ? "Gastado en 12 meses" : "Gastado en el período"}</div>
          <div style={{ fontFamily: C, fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{fmtCLP(totalGastado)}</div>
          <div style={{ fontSize: 12, color: "#777" }}>{movsVista.length} movimiento{movsVista.length === 1 ? "" : "s"}</div>
        </div>
        <div role="button" tabIndex={0} aria-label="Registrar gasto" onClick={() => fila && onRegistrar(fila.sec, fila.row.id)}
          onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && fila) { e.preventDefault(); onRegistrar(fila.sec, fila.row.id); } }}
          style={{ width: 92, flexShrink: 0, background: "#111", color: "#fff", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none", fontFamily: C, fontSize: 19, fontWeight: 700, lineHeight: 1.05, textAlign: "center", boxShadow: "3px 3px 0 #9a9a9a" }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>+</span><span>Registrar<br/>gasto</span>
        </div>
      </div>
      <div style={{ flex: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px 2px" }}>
          <span style={{ fontFamily: C, fontSize: 19, fontWeight: 700 }}>Últimos movimientos</span>
          <span onClick={onTodos} role="button" style={{ fontSize: 12, color: "#777", cursor: "pointer", textDecoration: "underline dotted" }}>ver todos ›</span>
        </div>
        {movsVista.length === 0 && <div style={{ fontSize: 13, color: "#aaa", padding: "6px 0" }}>Aún no hay gastos registrados {anual ? "en los últimos 12 meses" : "en este período"}.</div>}
        {movsVista.slice(0, 2).map((m, i, a) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: i < a.length - 1 ? "1px dashed #ddd" : "none" }}>
            <span>{m.nota || "(sin nota)"} <span style={{ fontSize: 12, color: "#777" }}>· {nombreDe(m)}</span></span><span>{fmtCLP(m.monto)}</span>
          </div>
        ))}
      </div>
      <div ref={zona} style={{ flex: "1 1 0", minHeight: 150, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 12 }}>
        {filas.length === 0 ? <div style={{ fontSize: 13, color: "#aaa", textAlign: "center" }}>Aún no hay sobres: créalos en Asignar.</div> : (
          <div style={{ position: "relative", width: TAM * k, height: TAM * k, flexShrink: 0 }}>
            <div ref={caja} onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
              style={{ position: "absolute", left: 0, top: 0, width: TAM, height: TAM, transform: `scale(${k})`, transformOrigin: "top left", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", cursor: "grab" }}>
              <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", fontSize: 14, color: "#b71c1c", zIndex: 2, lineHeight: 1 }}>▼</div>
              <div style={{ position: "absolute", left: g.pista.left, top: g.pista.top, width: g.pista.size, height: g.pista.size, border: "1px dashed #999", borderRadius: "50%", boxSizing: "border-box" }}/>
              <div style={{ position: "absolute", inset: 0, transform: `rotate(${rot}deg)`, transition: arrastrando ? "none" : "transform .25s ease" }}>
                {g.nodos.map(n => { const f = filas[n.i], on = n.i === sel; return (
                  <div key={f.sec + f.row.id} data-i={n.i} role="button" aria-label={f.row.label}
                    style={{ position: "absolute", left: n.cx - g.nodo / 2, top: n.cy - g.nodo / 2, width: g.nodo, height: g.nodo, borderRadius: "50%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(g.nodo * 0.5), lineHeight: 1,
                      background: on ? "#111" : "#fff", border: on ? "2px solid #111" : "1px dashed #888", boxShadow: on ? "0 0 0 3px #fff, 0 0 0 4px #b71c1c" : "none",
                      transform: `rotate(${-rot}deg)${on ? " scale(1.3)" : ""}`, transition: arrastrando ? "none" : "transform .25s ease" }}>{f.row.emoji || "📦"}</div>
                ); })}
              </div>
              <div data-centro="1" style={{ position: "absolute", left: (TAM - g.centro) / 2, top: (TAM - g.centro) / 2, width: g.centro, height: g.centro, borderRadius: "50%", boxSizing: "border-box", background: "#fff", border: "1.5px dashed #111", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 18px", cursor: "pointer" }}>
                <div data-centro="1" style={{ fontFamily: C, fontSize: 21, fontWeight: 700, lineHeight: 1.05, maxHeight: 46, overflow: "hidden" }}>{fila.row.label}</div>
                <div data-centro="1" style={{ fontFamily: C, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{fmtCLP(grande)}</div>
                <div data-centro="1" style={{ fontSize: 12, color: "#777", marginTop: -2 }}>{etiqueta}</div>
                <div data-centro="1" style={{ width: "100%", height: 7, background: "#eee", borderRadius: 4, overflow: "hidden", margin: "6px 0 4px", border: "1px dashed #bbb", boxSizing: "border-box" }}><div style={{ width: `${Math.max(0, Math.min(100, pc))}%`, height: "100%", background: pc >= 85 ? "#b71c1c" : "#111" }}/></div>
                <div data-centro="1" style={{ fontSize: 12, color: "#777" }}>{linea}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
