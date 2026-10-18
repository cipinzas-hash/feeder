import { fmtCLP } from "../../core/format.js";
import { guiaSobres } from "../../core/presupuesto-modelo.js";
import { FUENTE } from "./grilla.jsx";

// Guía mensual: cuánto efectivo debe haber en cada sobre al empezar el período
// (arrastre + asignación − devolución de deudas + devoluciones recibidas).
export default function GuiaSobres({ budgets, periodo, etiquetaPeriodo, onClose }) {
  const g = guiaSobres(budgets, periodo);
  const linea = (txt, v, signo) => v ? <span style={{ marginRight: 8 }}>{signo}{fmtCLP(Math.abs(v))} {txt}</span> : null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 14, overflow: "hidden", boxShadow: "6px 6px 0 #111", width: "min(96vw,520px)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#111", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>🧾 Cuánto debe haber en cada sobre</div>
            <div style={{ fontFamily: FUENTE, fontSize: 10, color: "#777", letterSpacing: 1 }}>AL EMPEZAR EL PERÍODO · {etiquetaPeriodo}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 18px 18px" }}>
          {!g
            ? <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#999", padding: "16px 0" }}>Los sobres no están iniciados en este período.</div>
            : <>
              {g.filas.map(f => (
                <div key={f.sec + f.row.id} style={{ padding: "10px 0", borderBottom: "1px dashed #eee" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontFamily: FUENTE, fontSize: 14, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.row.emoji} {f.row.label}</div>
                    <div style={{ fontFamily: FUENTE, fontSize: 16, fontWeight: 700, color: "#111" }}>{fmtCLP(f.debiaHaber)}</div>
                  </div>
                  <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#999", marginTop: 3, lineHeight: 1.5 }}>
                    {linea("de arrastre", f.inicial, "")}{linea("asignado", f.asignado, "+")}{linea("de devolución", f.devPagada, "−")}{linea("devueltos a este sobre", f.devRecibida, "+")}
                  </div>
                  {(f.deudas.debe > 0 || f.deudas.teDeben > 0) && (
                    <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#a60", marginTop: 2 }}>{f.deudas.debe > 0 && `Debe ${fmtCLP(f.deudas.debe)} a otras carteras. `}{f.deudas.teDeben > 0 && `Le deben ${fmtCLP(f.deudas.teDeben)}.`}</div>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 2px", fontFamily: FUENTE }}>
                <span style={{ fontSize: 13, color: "#555", fontWeight: 700 }}>Efectivo total en sobres</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>{fmtCLP(g.total)}</span>
              </div>
            </>}
        </div>
      </div>
    </div>
  );
}
