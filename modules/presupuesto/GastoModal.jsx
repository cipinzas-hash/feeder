import { fmtCLP } from "../../core/format.js";
import { bolsillosDe, estadoBolsillo, inicioSobres, resolverPeriodo, periodoDeFecha, fechaISO, agregarGasto } from "../../core/presupuesto-modelo.js";
const { useState, useMemo } = React;

const F = "'DM Sans',sans-serif";
const campo = { width: "100%", boxSizing: "border-box", border: "1px dashed #bbb", borderRadius: 6, padding: "10px 10px", fontSize: 15, fontFamily: F, background: "#fff", outline: "none", color: "#111" };
const rotulo = { fontFamily: F, fontSize: 10, color: "#999", letterSpacing: 2, textTransform: "uppercase", margin: "12px 0 4px" };

// Botón "Gasto" del menú principal: pregunta cartera o fondo personal, sub-partida,
// monto, fecha y nota. Un gasto mayor al saldo del sobre no se registra.
export default function GastoModal({ budgets, onSaveBudget, onClose }) {
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [cartera, setCartera] = useState("");   // "sec|rowId"
  const [subId, setSubId] = useState("null");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

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

  function elegirCartera(v) {
    setCartera(v); setError("");
    const [s, id] = v.split("|");
    const f = (budget[s] || []).find(r => r.id === id);
    const lista = f ? bolsillosDe(s, f) : [];
    setSubId(f && f.subs && f.subs.length ? String(f.subs[0].id) : "null");
    void lista;
  }
  function registrar() {
    if (!fila) { setError("Elige la cartera o el fondo personal."); return; }
    if (!elegido) { setError("Elige la sub-partida."); return; }
    const r = agregarGasto(budgets, { fecha, sec, rowId: fila.id, subId: elegido.subId, monto: montoNum, nota });
    if (r.error) { setError(r.error + (typeof r.saldo === "number" ? ` Disponible: ${fmtCLP(Math.max(0, r.saldo))}.` : "")); return; }
    onSaveBudget(r.periodo, r.budget);
    onClose();
  }
  const excede = !!(elegido && elegido.est && montoNum > elegido.est.saldo);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 14, overflow: "hidden", boxShadow: "6px 6px 0 #111", width: "min(94vw,380px)", maxHeight: "90vh", overflowY: "auto" }}>
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
                <select value={subId} onChange={e => { setSubId(e.target.value); setError(""); }} style={campo}>
                  {bolsillos.map(b => <option key={String(b.subId)} value={String(b.subId)}>{b.emoji} {b.label}{b.est ? ` · saldo ${fmtCLP(b.est.saldo)}` : ""}</option>)}
                </select>
              </>}

              {elegido && elegido.est && <div style={{ fontFamily: F, fontSize: 12, color: excede ? "#c00" : "#666", marginTop: 8 }}>Disponible en el sobre: <b>{fmtCLP(elegido.est.saldo)}</b></div>}

              <div style={rotulo}>Monto</div>
              <input inputMode="numeric" value={monto ? fmtCLP(montoNum) : ""} onChange={e => { setMonto(e.target.value); setError(""); }} placeholder="$0" style={{ ...campo, textAlign: "right", fontSize: 20, color: excede ? "#c00" : "#111" }}/>

              <div style={rotulo}>Fecha</div>
              <input type="date" value={fecha} onChange={e => { setFecha(e.target.value || fechaISO(new Date())); setError(""); }} style={campo}/>

              <div style={rotulo}>Nota (en qué se gastó)</div>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="ej. zapatillas de Sophia" style={campo}/>

              {error && <div style={{ fontFamily: F, fontSize: 13, color: "#c00", marginTop: 12 }}>{error}</div>}
              <button onClick={registrar} disabled={!fila || !montoNum || excede} style={{ width: "100%", marginTop: 16, padding: "13px", background: (!fila || !montoNum || excede) ? "#ccc" : "#111", color: "#fff", border: "none", borderRadius: 8, fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, cursor: (!fila || !montoNum || excede) ? "default" : "pointer" }}>Registrar</button>
            </>}
        </div>
      </div>
    </div>
  );
}
