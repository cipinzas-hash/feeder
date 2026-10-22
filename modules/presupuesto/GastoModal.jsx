import { fmtCLP } from "../../core/format.js";
import { bolsillosDe, estadoBolsillo, inicioSobres, resolverPeriodo, periodoDeFecha, fechaISO, agregarGasto, candidatosPrestamo, sugerirFuentes, claveBolsillo, categoriasDe, agregarCategoria, TOPE_PRESTAMO, TOPE_DEVOLUCION } from "../../core/presupuesto-modelo.js";
import { AmountRow } from "./grilla.jsx";
const { useState, useMemo } = React;

const F = "'DM Sans',sans-serif";
const campo = { width: "100%", boxSizing: "border-box", border: "1px dashed #bbb", borderRadius: 6, padding: "10px 10px", fontSize: 15, fontFamily: F, background: "#fff", outline: "none", color: "#111" };
const rotulo = { fontFamily: F, fontSize: 10, color: "#999", letterSpacing: 2, textTransform: "uppercase", margin: "12px 0 4px" };
const mismo = (x, f) => x.sec === f.sec && x.rowId === f.rowId && (x.subId ?? null) === (f.subId ?? null);

// Botón "Gasto": pregunta cartera o fondo personal, sub-partida, monto, fecha y nota.
// Si el gasto supera el saldo del sobre, deja elegir de qué otras carteras pedir lo que falta
// (multifinanciamiento: tope 30% del saldo de cada cartera; la devolución es automática).
export default function GastoModal({ budgets, onSaveBudget, onClose, inicial }) {
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [cartera, setCartera] = useState(inicial || "");   // "sec|rowId"
  const [subId, setSubId] = useState(() => {
    if (!inicial) return "null";
    const [s0, id0] = inicial.split("|");
    const f0 = (resolverPeriodo(budgets, periodoDeFecha(new Date()))[s0] || []).find(r => r.id === id0);
    return f0 && f0.subs && f0.subs.length ? String(f0.subs[0].id) : "null";
  });
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [categoria, setCategoria] = useState("");      // "" = sin categoría · "__nueva" = escribir una nueva
  const [nuevaCat, setNuevaCat] = useState("");
  const [error, setError] = useState("");
  const [manual, setManual] = useState(null);   // fuentes editadas a mano; null = usar la sugerencia

  const periodo = periodoDeFecha(fecha);
  const activo = !!inicioSobres(budgets);
  const budget = useMemo(() => resolverPeriodo(budgets, periodo), [budgets, periodo]);
  const grupos = [["propositos", "Fondos por propósito", "📦"], ["personales", "Fondos personales", "👤"]];
  const [sec, rowId] = cartera ? cartera.split("|") : [null, null];
  const fila = sec ? (budget[sec] || []).find(r => r.id === rowId) : null;

  const bolsillos = useMemo(() => {
    if (!fila) return [];
    return bolsillosDe(sec, fila)
      .map(b => ({ ...b, est: estadoBolsillo(budgets, periodo, sec, fila.id, b.subId) }))
      .filter(b => !b.libre || !fila.subs || !fila.subs.length || b.asignado > 0 || (b.est && b.est.saldo !== 0));
  }, [budgets, periodo, sec, fila]);
  const elegido = bolsillos.find(b => String(b.subId) === subId) || null;
  const montoNum = parseInt(String(monto).replace(/\D/g, "")) || 0;
  const saldo = elegido && elegido.est ? elegido.est.saldo : 0;
  const falta = elegido && montoNum > saldo ? montoNum - saldo : 0;

  // Multifinanciamiento: de dónde pedir lo que falta
  const destino = useMemo(() => (fila ? { sec, rowId: fila.id } : null), [sec, fila]);
  const candidatos = useMemo(() => (falta > 0 && destino ? candidatosPrestamo(budgets, periodo, destino) : []), [budgets, periodo, destino, falta]);
  const sugeridas = useMemo(() => (falta > 0 && destino ? sugerirFuentes(budgets, periodo, destino, falta) : { fuentes: [], cubierto: 0 }), [budgets, periodo, destino, falta]);
  const usadas = falta > 0 ? (manual || sugeridas.fuentes) : [];
  const cubierto = usadas.reduce((s, f) => s + f.monto, 0);
  const completo = falta > 0 && cubierto === falta;
  const etiquetaFuente = f => {
    const c = candidatos.find(x => mismo(x, f));
    if (c) return `${c.emoji} ${c.cartera}${c.libre ? "" : " · " + c.label}`;
    const r = (budget[f.sec] || []).find(x => x.id === f.rowId);
    return r ? `${r.emoji || ""} ${r.label}` : "(cartera)";
  };
  const dispDe = f => { const c = candidatos.find(x => mismo(x, f)); return c ? c.disp : 0; };
  const editarFuente = (i, v) => setManual((manual || sugeridas.fuentes).map((f, j) => j === i ? { ...f, monto: Math.min(v, dispDe(f)) } : f));
  const quitarFuente = i => setManual((manual || sugeridas.fuentes).filter((_, j) => j !== i));
  const libres = candidatos.filter(c => !usadas.some(f => mismo(c, f)));
  function agregarFuente(v) {
    const c = libres.find(x => claveBolsillo(x.sec, x.rowId, x.subId) === v);
    if (!c) return;
    const resto = Math.max(0, falta - cubierto);
    setManual([...(manual || sugeridas.fuentes), { sec: c.sec, rowId: c.rowId, subId: c.subId, monto: Math.min(c.disp, resto) || c.disp }]);
  }

  function elegirCartera(v) {
    setCartera(v); setError(""); setManual(null); setCategoria(""); setNuevaCat("");
    const [s, id] = v.split("|");
    const f = (budget[s] || []).find(r => r.id === id);
    setSubId(f && f.subs && f.subs.length ? String(f.subs[0].id) : "null");
  }
  function registrar() {
    if (!fila) { setError("Elige la cartera o el fondo personal."); return; }
    if (!elegido) { setError("Elige la sub-partida."); return; }
    const fuentes = falta > 0 ? usadas.filter(f => f.monto > 0) : undefined;
    const cat = categoria === "__nueva" ? nuevaCat.trim() : categoria;
    if (categoria === "__nueva" && !cat) { setError("Escribe el nombre de la categoría."); return; }
    const r = agregarGasto(budgets, { fecha, sec, rowId: fila.id, subId: elegido.subId, monto: montoNum, nota, fuentes, categoria: cat });
    if (r.error) { setError(r.error); return; }
    onSaveBudget(r.periodo, cat ? agregarCategoria(r.budget, sec, fila.id, cat) : r.budget);
    onClose();
  }
  const puede = !!fila && montoNum > 0 && (falta === 0 || completo);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 14, overflow: "hidden", boxShadow: "6px 6px 0 #111", width: "min(94vw,400px)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ background: "#111", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>💸 Registrar gasto</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#777", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "4px 18px 18px" }}>
          {!activo
            ? <div style={{ fontFamily: F, fontSize: 14, color: "#555", padding: "18px 0", lineHeight: 1.5 }}>Los sobres todavía no están iniciados. Ve a Presupuesto y toca 🧾 para iniciarlos; después podrás registrar gastos aquí.</div>
            : <>
              <div style={rotulo}>Cartera o fondo personal</div>
              <select value={cartera} onChange={e => elegirCartera(e.target.value)} style={campo}>
                <option value="">Elegir…</option>
                {grupos.map(([s, titulo, em]) => (budget[s] || []).length > 0 && (
                  <optgroup key={s} label={`${em} ${titulo}`}>
                    {budget[s].map(r => <option key={r.id} value={`${s}|${r.id}`}>{r.emoji} {r.label}</option>)}
                  </optgroup>
                ))}
              </select>

              {fila && bolsillos.length > 1 && <>
                <div style={rotulo}>Sub-partida</div>
                <select value={subId} onChange={e => { setSubId(e.target.value); setError(""); setManual(null); }} style={campo}>
                  {bolsillos.map(b => <option key={String(b.subId)} value={String(b.subId)}>{b.emoji} {b.label}{b.est ? ` · saldo ${fmtCLP(b.est.saldo)}` : ""}</option>)}
                </select>
              </>}

              {elegido && elegido.est && <div style={{ fontFamily: F, fontSize: 12, color: falta ? "#c60" : "#666", marginTop: 8 }}>Disponible en el sobre: <b>{fmtCLP(saldo)}</b></div>}

              <div style={rotulo}>Monto</div>
              <input inputMode="numeric" value={monto ? fmtCLP(montoNum) : ""} onChange={e => { setMonto(e.target.value); setError(""); setManual(null); }} placeholder="$0" style={{ ...campo, textAlign: "right", fontSize: 20, color: falta ? "#c60" : "#111" }}/>

              {falta > 0 && (
                <div style={{ marginTop: 12, border: "1px dashed #e0b070", background: "#fffaf0", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontFamily: F, fontSize: 13, color: "#8a5a00" }}>Faltan <b>{fmtCLP(falta)}</b>. Pídelos a otras carteras (máximo {Math.round(TOPE_PRESTAMO * 100)}% del saldo de cada una):</div>
                  {candidatos.length === 0 && <div style={{ fontFamily: F, fontSize: 12, color: "#c00", marginTop: 8 }}>Ninguna cartera tiene saldo para prestar.</div>}
                  {usadas.map((f, i) => (
                    <div key={claveBolsillo(f.sec, f.rowId, f.subId)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 12, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etiquetaFuente(f)}<div style={{ fontSize: 10, color: "#aaa" }}>puede aportar hasta {fmtCLP(dispDe(f))}</div></div>
                      <AmountRow value={f.monto} min={0} max={dispDe(f)} onSave={v => editarFuente(i, v)}/>
                      <button onClick={() => quitarFuente(i)} style={{ background: "transparent", border: "none", color: "#bbb", fontSize: 16, cursor: "pointer", padding: 0 }}>×</button>
                    </div>
                  ))}
                  {libres.length > 0 && (
                    <select value="" onChange={e => agregarFuente(e.target.value)} style={{ ...campo, marginTop: 8, padding: "6px 8px", fontSize: 12 }}>
                      <option value="">+ pedir también a…</option>
                      {libres.map(c => <option key={claveBolsillo(c.sec, c.rowId, c.subId)} value={claveBolsillo(c.sec, c.rowId, c.subId)}>{c.emoji} {c.cartera}{c.libre ? "" : " · " + c.label} (hasta {fmtCLP(c.disp)})</option>)}
                    </select>
                  )}
                  <div style={{ fontFamily: F, fontSize: 12, marginTop: 8, color: completo ? "#070" : "#c00" }}>{completo ? `Cubierto: ${fmtCLP(cubierto)}` : `Cubierto ${fmtCLP(cubierto)} de ${fmtCLP(falta)}`}</div>
                  <div style={{ fontFamily: F, fontSize: 11, color: "#999", marginTop: 6, lineHeight: 1.4 }}>Se devuelve solo: desde el período siguiente se descuenta hasta el {Math.round(TOPE_DEVOLUCION * 100)}% de la asignación mensual de esta cartera.</div>
                </div>
              )}

              {fila && <>
                <div style={rotulo}>Categoría (opcional)</div>
                <select value={categoria} onChange={e => { setCategoria(e.target.value); setError(""); }} style={campo}>
                  <option value="">Sin categoría</option>
                  {categoriasDe(fila).map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__nueva">+ nueva categoría…</option>
                </select>
                {categoria === "__nueva" && <input value={nuevaCat} onChange={e => { setNuevaCat(e.target.value); setError(""); }} placeholder="nombre de la categoría" style={{ ...campo, marginTop: 6 }}/>}
              </>}

              <div style={rotulo}>Fecha</div>
              <input type="date" value={fecha} onChange={e => { setFecha(e.target.value || fechaISO(new Date())); setError(""); setManual(null); }} style={campo}/>

              <div style={rotulo}>Nota (en qué se gastó)</div>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="ej. zapatillas de Sophia" style={campo}/>

              {error && <div style={{ fontFamily: F, fontSize: 13, color: "#c00", marginTop: 12 }}>{error}</div>}
              <button onClick={registrar} disabled={!puede} style={{ width: "100%", marginTop: 16, padding: "13px", background: puede ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, cursor: puede ? "pointer" : "default" }}>{falta > 0 ? "Registrar con préstamo" : "Registrar"}</button>
            </>}
        </div>
      </div>
    </div>
  );
}
