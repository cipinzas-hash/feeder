import { fmtCLP } from "../../core/format.js";
const { useState } = React;

// Grilla única del presupuesto (issue #24, punto 8). Encabezados, filas, subtotal y
// totales usan EXACTAMENTE la misma plantilla (con la columna del check siempre
// presente), así las columnas quedan alineadas en todas las filas.
export const FUENTE = "'DM Sans',sans-serif";
export const ARW = 22;                      // ancho de cada flecha ‹ ›
export const AMT_W = 72;                    // caja del monto (alineado a la derecha)
export const AMT_COL = ARW * 2 + 4 + AMT_W; // flecha + monto + flecha (+ 2 huecos de 2px)
export const CHK = 24;
export const GAP = 6;
export const COL = `minmax(0,1fr) ${AMT_COL}px 40px 76px 20px`;
export const GRID = `${CHK}px ${COL}`;
// El borde derecho del monto queda a (flecha + hueco) del borde de su columna.
export const PAD_MONTO = ARW + 2;

export const celdaTitulo = { fontFamily: FUENTE, fontSize: 9, color: "#bbb", letterSpacing: 1 };

const btnFlecha = {
  background: "transparent", border: "1px dashed #e0e0e0", borderRadius: 4, color: "#bbb", fontSize: 13,
  width: ARW, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0, fontWeight: 700, lineHeight: 1, padding: 0, transition: "all 0.12s",
};

// Monto con flechas de ±1.000. `min`/`max` acotan lo que se puede guardar.
export function AmountRow({ value, onSave, min = 0, max }) {
  const [ed, setEd] = useState(false);
  const [txt, setTxt] = useState(String(value));
  const acotar = v => { let r = Math.max(min, v); if (typeof max === "number") r = Math.min(max, r); return r; };
  const leer = s => parseInt(String(s).replace(/\D/g, "")) || 0;
  function commit() { onSave(acotar(leer(txt))); setEd(false); }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
      <button style={btnFlecha} onClick={() => onSave(acotar(value - 1000))}>‹</button>
      {ed
        ? <input autoFocus value={txt} onChange={e => { setTxt(e.target.value); onSave(acotar(leer(e.target.value))); }} onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") commit(); }}
            style={{ width: AMT_W, boxSizing: "border-box", border: "none", borderBottom: "1px dashed #aaa", background: "#fafafa", padding: "2px 0", fontSize: 13, fontFamily: FUENTE, color: "#111", outline: "none", textAlign: "right" }}/>
        : <div onClick={() => { setTxt(String(value)); setEd(true); }}
            style={{ width: AMT_W, boxSizing: "border-box", cursor: "pointer", fontSize: 13, color: "#333", fontFamily: FUENTE, textAlign: "right", padding: "2px 0", borderBottom: "1px solid transparent" }}>{fmtCLP(value)}</div>}
      <button style={btnFlecha} onClick={() => onSave(acotar(value + 1000))}>›</button>
    </div>
  );
}
