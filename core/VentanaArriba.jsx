// Ventana de captura rápida de ➕ Registrar: pegada ARRIBA de la pantalla para que el teclado no tape el registro,
// y con altura máxima ligada al área realmente visible (se achica sola cuando aparece el teclado).
// Se cierra solo al tocar fuera del cuadro, con "cerrar" o con la ×: guardar NO la cierra (se pueden anotar varias cosas seguidas).
const { useState, useEffect } = React;

const F = "'DM Sans',sans-serif";

function altoVisible() {
  const v = typeof window !== "undefined" && window.visualViewport;
  return Math.round(v ? v.height : (typeof window !== "undefined" ? window.innerHeight : 700));
}

// Líneas verdes de confirmación ("✓ Almuerzo · Pollo") de lo registrado en esta sesión de la ventana.
export function Hechos({ hechos }) {
  if (!hechos || !hechos.length) return null;
  return (
    <div style={{ background: "#f1f8f2", border: "1px dashed #9ccc9f", borderRadius: 8, padding: "6px 10px", marginBottom: 12 }}>
      {hechos.slice(-3).map((h, i) => (
        <div key={hechos.length - 3 + i} style={{ fontFamily: F, fontSize: 12, color: "#2e7d32", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✓ {h}</div>
      ))}
    </div>
  );
}

// Alto del área realmente visible; se actualiza cuando aparece o se va el teclado.
export function useAltoVisible() {
  const [alto, setAlto] = useState(altoVisible);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return undefined;
    const f = () => setAlto(altoVisible());
    v.addEventListener("resize", f);
    return () => v.removeEventListener("resize", f);
  }, []);
  return alto;
}

export default function VentanaArriba({ onClose, ancho = 480, children }) {
  const alto = useAltoVisible();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: `min(96vw,${ancho}px)`, background: "#fff", borderRadius: "0 0 16px 16px", padding: "16px 20px 22px", maxHeight: Math.round(alto * 0.9), overflowY: "auto", boxSizing: "border-box", boxShadow: "0 6px 24px rgba(0,0,0,0.25)" }}>
        {children}
      </div>
    </div>
  );
}
