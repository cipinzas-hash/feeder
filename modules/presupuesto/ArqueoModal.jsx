import { fmtCLP } from "../../core/format.js";
import { MONTH_NAMES } from "../../core/dates.js";
import { filasArqueo, guardarArqueo, rendicion, resolverPeriodo, fechaISO, fechaDe, claveSiguiente } from "../../core/presupuesto-modelo.js";
import { FUENTE } from "./grilla.jsx";
const { useState, useMemo } = React;

const campo = { boxSizing: "border-box", border: "1px dashed #bbb", borderRadius: 6, padding: "8px 10px", fontSize: 15, fontFamily: FUENTE, background: "#fff", outline: "none", color: "#111", textAlign: "right", width: 130 };
const rotulo = { fontFamily: FUENTE, fontSize: 9, color: "#aaa", letterSpacing: 2, textTransform: "uppercase" };
const fechaCorta = iso => { const d = fechaDe(iso); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`; };
const etiquetaPeriodo = k => { const [a, m] = k.split("-").map(Number); const s = claveSiguiente(k); const m2 = parseInt(s.slice(5)) - 1; return `25 ${MONTH_NAMES[m - 1].slice(0, 3)} — 24 ${MONTH_NAMES[m2].slice(0, 3)} ${m === 12 ? a + 1 : a}`; };
const colorDif = d => d === 0 ? "#070" : "#c60";
const signo = d => (d > 0 ? "+" : d < 0 ? "−" : "") + fmtCLP(Math.abs(d));

// Cierre del período (issue #24): primero el arqueo (contar el efectivo de cada sobre y
// compararlo con lo que dicen los registros) y luego la rendición (a dónde se fue la plata).
// El arqueo es obligatorio antes de generar el período siguiente; una diferencia no bloquea.
export default function ArqueoModal({ budgets, periodo, onSaveBudget, onClose, tabInicial }) {
  const filas = useMemo(() => filasArqueo(budgets, periodo), [budgets, periodo]);
  const guardado = resolverPeriodo(budgets, periodo).arqueo;
  const [tab, setTab] = useState(tabInicial || (guardado ? "rendicion" : "arqueo"));
  const [fecha, setFecha] = useState(guardado ? guardado.fecha : fechaISO(new Date()));
  const [conteos, setConteos] = useState(() => Object.fromEntries(((guardado && guardado.filas) || []).map(f => [f.sec + "|" + f.rowId, String(f.contado)])));
  const [notas, setNotas] = useState(() => Object.fromEntries(((guardado && guardado.filas) || []).filter(f => f.nota).map(f => [f.sec + "|" + f.rowId, f.nota])));
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const num = v => (v === undefined || v === "" ? null : parseInt(String(v).replace(/\D/g, "")) || 0);
  const rend = useMemo(() => rendicion(budgets, periodo), [budgets, periodo]);

  const completo = !!filas && filas.every(f => num(conteos[f.sec + "|" + f.rowId]) !== null);
  const totEsperado = filas ? filas.reduce((s, f) => s + f.esperado, 0) : 0;
  const totContado = filas ? filas.reduce((s, f) => s + (num(conteos[f.sec + "|" + f.rowId]) || 0), 0) : 0;

  function guardar() {
    const c = {};
    (filas || []).forEach(f => { const v = num(conteos[f.sec + "|" + f.rowId]); if (v !== null) c[f.sec + "|" + f.rowId] = v; });
    const r = guardarArqueo(budgets, periodo, { fecha, conteos: c, notas });
    if (r.error) { setError(r.error); return; }
    setError(""); onSaveBudget(r.periodo, r.budget); setTab("rendicion");
  }
  function copiar() {
    if (!rend) return;
    const l = [`Rendición ${etiquetaPeriodo(periodo)}`];
    rend.filas.forEach(f => {
      l.push(`\n${f.row.emoji} ${f.row.label}: asignado ${fmtCLP(f.asignado)}, gastado ${fmtCLP(f.gastado)}, saldo ${fmtCLP(f.saldo)}`);
      f.gastos.forEach(g => l.push(`  ${fechaCorta(g.fecha)} · ${g.sub} · ${fmtCLP(g.monto)}${g.nota ? " · " + g.nota : ""}${g.prestamoId ? " · con préstamo" : ""}`));
      if (f.arqueo) l.push(`  Arqueo: debía haber ${fmtCLP(f.arqueo.esperado)}, contado ${fmtCLP(f.arqueo.contado)}, diferencia ${signo(f.arqueo.diferencia)}${f.arqueo.nota ? " (" + f.arqueo.nota + ")" : ""}`);
    });
    l.push(`\nTotal asignado ${fmtCLP(rend.totales.asignado)} · gastado ${fmtCLP(rend.totales.gastado)}${rend.totales.diferencia !== null ? " · diferencia de arqueo " + signo(rend.totales.diferencia) : ""}`);
    try { navigator.clipboard.writeText(l.join("\n")); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch (e) { setError("No se pudo copiar."); }
  }
  const tabBtn = (id, txt) => (
    <button onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 0", background: tab === id ? "#fff" : "transparent", color: tab === id ? "#111" : "#888", border: "none", borderRadius: "8px 8px 0 0", fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>{txt}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 14, overflow: "hidden", boxShadow: "6px 6px 0 #111", width: "min(96vw,540px)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#111", padding: "12px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>🔍 Cierre del período</div>
              <div style={{ fontFamily: FUENTE, fontSize: 10, color: "#777", letterSpacing: 1 }}>{etiquetaPeriodo(periodo)}</div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{tabBtn("arqueo", "Arqueo")}{tabBtn("rendicion", "Rendición")}</div>
        </div>
        <div style={{ overflowY: "auto", padding: "14px 18px 18px" }}>
          {!filas && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#999", padding: "16px 0" }}>Los sobres no están iniciados en este período: toca 🧾 en Presupuesto.</div>}

          {filas && tab === "arqueo" && <>
            <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#777", lineHeight: 1.5, marginBottom: 10 }}>Cuenta el efectivo que hay en cada sobre y escríbelo. Si no cuadra con los registros, el cierre igual se guarda y la diferencia queda documentada.</div>
            {guardado && <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#070", background: "#f3fbf3", border: "1px dashed #b5deb5", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>Arqueo guardado el {fechaCorta(guardado.fecha)}. Puedes rehacerlo.</div>}
            {filas.map(f => {
              const k = f.sec + "|" + f.rowId;
              const c = num(conteos[k]);
              const dif = c === null ? null : c - f.esperado;
              return (
                <div key={k} style={{ padding: "10px 0", borderBottom: "1px dashed #eee" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FUENTE, fontSize: 14, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.emoji} {f.label}</div>
                      <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#999" }}>debería haber <b style={{ color: "#555" }}>{fmtCLP(f.esperado)}</b></div>
                    </div>
                    <input inputMode="numeric" placeholder="contado" value={conteos[k] === undefined || conteos[k] === "" ? "" : fmtCLP(num(conteos[k]))} onChange={e => { setConteos({ ...conteos, [k]: e.target.value }); setError(""); }} style={campo}/>
                  </div>
                  {dif !== null && <div style={{ fontFamily: FUENTE, fontSize: 12, color: colorDif(dif), textAlign: "right", marginTop: 4 }}>{dif === 0 ? "cuadra" : `diferencia ${signo(dif)}`}</div>}
                  {dif !== null && dif !== 0 && <input placeholder="¿a qué se debe? (opcional)" value={notas[k] || ""} onChange={e => setNotas({ ...notas, [k]: e.target.value })} style={{ ...campo, width: "100%", textAlign: "left", fontSize: 12, marginTop: 6, padding: "6px 8px" }}/>}
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 2px", fontFamily: FUENTE }}>
              <span style={{ fontSize: 12, color: "#777" }}>Esperado {fmtCLP(totEsperado)} · contado {fmtCLP(totContado)}</span>
              {completo && <span style={{ fontSize: 13, fontWeight: 700, color: colorDif(totContado - totEsperado) }}>{totContado === totEsperado ? "todo cuadra" : `diferencia ${signo(totContado - totEsperado)}`}</span>}
            </div>
            <div style={{ ...rotulo, margin: "10px 0 4px" }}>Fecha del arqueo</div>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value || fechaISO(new Date()))} style={{ ...campo, width: "100%", textAlign: "left" }}/>
            {error && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#c00", marginTop: 12 }}>{error}</div>}
            <button onClick={guardar} disabled={!completo} style={{ width: "100%", marginTop: 14, padding: "13px", background: completo ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, cursor: completo ? "pointer" : "default" }}>{guardado ? "Guardar de nuevo" : "Guardar arqueo"}</button>
          </>}

          {filas && tab === "rendicion" && rend && <>
            {rend.arqueoFecha
              ? <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#777", marginBottom: 8 }}>Arqueo del {fechaCorta(rend.arqueoFecha)}.</div>
              : <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#a60", background: "#fffaf0", border: "1px dashed #e0b070", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>Falta el arqueo de este período: hazlo en la pestaña Arqueo.</div>}
            {rend.filas.map(f => (
              <div key={f.sec + f.row.id} style={{ padding: "10px 0", borderBottom: "1px dashed #eee" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, fontFamily: FUENTE, fontSize: 14, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.row.emoji} {f.row.label}</div>
                  <div style={{ fontFamily: FUENTE, fontSize: 15, fontWeight: 700, color: f.saldo < 0 ? "#c00" : "#111" }}>{fmtCLP(f.saldo)}</div>
                </div>
                <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#999", marginTop: 3, lineHeight: 1.5 }}>
                  asignado {fmtCLP(f.asignado)} · gastado {fmtCLP(f.gastado)}
                  {f.prestamoRecibido > 0 && ` · pidió ${fmtCLP(f.prestamoRecibido)}`}{f.prestamoDado > 0 && ` · prestó ${fmtCLP(f.prestamoDado)}`}
                  {f.devPagada > 0 && ` · devolvió ${fmtCLP(f.devPagada)}`}{f.devRecibida > 0 && ` · le devolvieron ${fmtCLP(f.devRecibida)}`}
                </div>
                {f.arqueo && (
                  <div style={{ fontFamily: FUENTE, fontSize: 12, color: colorDif(f.arqueo.diferencia), marginTop: 3 }}>
                    arqueo: contado {fmtCLP(f.arqueo.contado)} de {fmtCLP(f.arqueo.esperado)} · {f.arqueo.diferencia === 0 ? "cuadra" : `diferencia ${signo(f.arqueo.diferencia)}`}{f.arqueo.nota ? ` · ${f.arqueo.nota}` : ""}
                  </div>
                )}
                {(f.deudas.debe > 0 || f.deudas.teDeben > 0) && <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#a60", marginTop: 2 }}>{f.deudas.debe > 0 && `Debe ${fmtCLP(f.deudas.debe)}. `}{f.deudas.teDeben > 0 && `Le deben ${fmtCLP(f.deudas.teDeben)}.`}</div>}
                {f.gastos.length > 0 && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontFamily: FUENTE, fontSize: 11, color: "#666", cursor: "pointer" }}>{f.gastos.length} gasto{f.gastos.length > 1 ? "s" : ""}</summary>
                    {f.gastos.map(g => (
                      <div key={g.id} style={{ fontFamily: FUENTE, fontSize: 12, color: "#444", padding: "3px 0 3px 8px", display: "flex", gap: 8 }}>
                        <span style={{ color: "#999", width: 44, flexShrink: 0 }}>{fechaCorta(g.fecha)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{g.sub}{g.nota ? ` · ${g.nota}` : ""}{g.prestamoId ? " 💳" : ""}</span>
                        <span style={{ fontWeight: 700 }}>{fmtCLP(g.monto)}</span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 2px", fontFamily: FUENTE }}>
              <span style={{ fontSize: 12, color: "#555" }}>Asignado {fmtCLP(rend.totales.asignado)} · gastado {fmtCLP(rend.totales.gastado)}</span>
              {rend.totales.diferencia !== null && <span style={{ fontSize: 13, fontWeight: 700, color: colorDif(rend.totales.diferencia) }}>{rend.totales.diferencia === 0 ? "todo cuadra" : `diferencia ${signo(rend.totales.diferencia)}`}</span>}
            </div>
            {error && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#c00", marginTop: 8 }}>{error}</div>}
            <button onClick={copiar} style={{ width: "100%", marginTop: 14, padding: "11px", background: "transparent", color: "#555", border: "1px dashed #bbb", borderRadius: 8, fontFamily: "'Caveat',cursive", fontSize: 18, cursor: "pointer" }}>{copiado ? "✓ copiado" : "Copiar rendición"}</button>
          </>}
        </div>
      </div>
    </div>
  );
}
