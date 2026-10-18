import { fmtCLP } from "../../core/format.js";
import { estadoFila } from "../../core/presupuesto-modelo.js";
import CarteraPanel from "./CarteraPanel.jsx";
import { FUENTE } from "./grilla.jsx";
const { useState, useEffect } = React;

const flecha = { background: "transparent", border: "1px solid #444", borderRadius: 8, color: "#fff", fontSize: 24, width: 44, height: 40, cursor: "pointer", lineHeight: 1, flexShrink: 0 };

// Ventana emergente de una cartera (issue #24). Se abre una a la vez; ‹ › pasan a la
// cartera anterior o siguiente (dando la vuelta) y × vuelve al menú anterior.
// Aquí vive todo lo de la cartera: sub-partidas, saldos, gastos y lo que se vaya sumando.
export default function CarteraVentana({ carteras, index, onIndex, onClose, budgets, budget, periodo, sobresOn, esInicio, onPatchRow, onDeleteGasto, onApertura, onGasto }) {
  const [aviso, setAviso] = useState("");
  const n = carteras.length;
  const { sec, row } = carteras[index];
  const ir = d => { setAviso(""); onIndex((index + d + n) % n); };

  useEffect(() => {
    function tecla(e) {
      const t = e.target && e.target.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if (e.key === "ArrowLeft") ir(-1);
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const estado = sobresOn ? estadoFila(budgets, periodo, sec, row) : null;
  const etiqueta = sec === "personales" ? "Ahorrado" : "Saldo";
  const dato = (titulo, valor, color) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontFamily: FUENTE, fontSize: 9, color: "#aaa", letterSpacing: 1, textTransform: "uppercase" }}>{titulo}</div>
      <div style={{ fontFamily: FUENTE, fontSize: 15, fontWeight: 700, color: color || "#111", marginTop: 2 }}>{valor}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 14, overflow: "hidden", boxShadow: "6px 6px 0 #111", width: "min(96vw,520px)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#111", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => ir(-1)} style={flecha} title="Cartera anterior">‹</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.emoji} {row.label}</div>
            <div style={{ fontFamily: FUENTE, fontSize: 10, color: "#777", letterSpacing: 1 }}>{sec === "personales" ? "FONDO PERSONAL" : "FONDO POR PROPÓSITO"} · {index + 1} / {n}</div>
          </div>
          <button onClick={() => ir(1)} style={flecha} title="Cartera siguiente">›</button>
          <button onClick={onClose} style={{ ...flecha, border: "none", color: "#888", width: 34 }} title="Volver">×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "14px 18px 18px" }}>
          <div style={{ display: "flex", gap: 8, padding: "4px 0 12px", borderBottom: "1px dashed #eee", marginBottom: 8 }}>
            {dato("Mensual", fmtCLP(row.monto))}
            {estado ? dato(etiqueta, fmtCLP(estado.saldo), estado.saldo < 0 ? "#c00" : "#111") : dato(etiqueta, "—", "#bbb")}
            {estado ? dato("Gastado", fmtCLP(estado.gastado)) : dato("Gastado", "—", "#bbb")}
          </div>
          {aviso && <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#c00", background: "#fff5f5", border: "1px dashed #e0b0b0", borderRadius: 6, padding: "8px 10px", margin: "6px 0 10px" }}>{aviso}</div>}
          {!sobresOn && <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#999", padding: "4px 0 10px" }}>Los sobres no están iniciados en este período: toca 🧾 en Presupuesto para activar saldos y gastos.</div>}
          <CarteraPanel sec={sec} row={row} periodo={periodo} budgets={budgets} budget={budget} estado={estado} sobresOn={sobresOn} esInicio={esInicio} etiquetaSaldo={etiqueta}
            onPatchRow={patch => onPatchRow(sec, row.id, patch)} onDeleteGasto={onDeleteGasto} onApertura={onApertura} onAviso={setAviso}/>
          <button onClick={() => onGasto(sec, row.id)} disabled={!sobresOn} style={{ width: "100%", marginTop: 14, padding: "12px", background: sobresOn ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontFamily: "'Caveat',cursive", fontSize: 19, fontWeight: 700, cursor: sobresOn ? "pointer" : "default" }}>💸 Registrar gasto en esta cartera</button>
        </div>
      </div>
    </div>
  );
}
