// Registros de texto de ➕ Registrar: 📝 nota rápida (a la "Nota random" del día), ✅ tarea y 🛒 compra (de hoy).
// Quedan abiertos al guardar para seguir anotando; el guardado real lo hace App (onNota / onTarea / onCompra).
import VentanaArriba, { Hechos } from "./VentanaArriba.jsx";
import { fmtFull } from "./dates.js";
const { useState } = React;

const F = "'DM Sans',sans-serif";
const C = "'Caveat',cursive";
const campo = { width: "100%", border: "none", borderBottom: "2px solid #111", padding: "8px 4px", fontSize: 18, fontFamily: C, outline: "none", background: "transparent", color: "#111", boxSizing: "border-box" };
const chip = (activo, color) => ({ fontFamily: F, fontSize: 12, padding: "6px 12px", borderRadius: 14, border: "1px dashed " + (activo && color ? color : "#ddd"), background: activo ? (color || "#111") : "transparent", color: activo ? "#fff" : "#555", cursor: "pointer" });
const TITULOS = { nota: "📝 nota rápida", tarea: "✅ nueva tarea", compra: "🛒 nueva compra" };

function RegistroRapido({ tipo, onNota, onTarea, onCompra, onGuardado, onClose }) {
  const [texto, setTexto] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [dia, setDia] = useState("hoy");           // hoy | manana | fecha
  const [fecha, setFecha] = useState(fmtFull(new Date()));
  const [hechos, setHechos] = useState([]);

  const diaClave = () => {
    if (dia === "hoy") return fmtFull(new Date());
    if (dia === "manana") return fmtFull(new Date(Date.now() + 86400000));
    return fecha;
  };
  const puede = texto.trim().length > 0 && (tipo !== "tarea" || dia !== "fecha" || !!fecha);

  function guardar() {
    const t = texto.trim();
    if (!t) return;
    let aviso;
    if (tipo === "nota") { onNota(t); aviso = "Nota agregada"; }
    else if (tipo === "tarea") { onTarea({ text: t, date: diaClave(), urgent: urgente }); aviso = "Tarea agregada"; }
    else { onCompra(t); aviso = "Compra agregada"; }
    setHechos(h => [...h, `${aviso} · ${t.length > 40 ? t.slice(0, 40) + "…" : t}`]);
    if (onGuardado) onGuardado(`${aviso} ✓`);
    setTexto(""); setUrgente(false);               // el día elegido se mantiene para anotar varias seguidas
  }
  const enter = e => { if (e.key === "Enter") { e.preventDefault(); guardar(); } };

  return (
    <VentanaArriba onClose={onClose} ancho={440}>
      <div style={{ fontFamily: C, fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 10 }}>{TITULOS[tipo]}</div>
      <Hechos hechos={hechos} />
      {tipo === "nota" ? (
        <textarea value={texto} onChange={e => setTexto(e.target.value)} autoFocus rows={3} placeholder="algo que no quiero que se me pase…"
          style={{ ...campo, border: "1px dashed #ccc", borderRadius: 8, padding: "8px 10px", fontSize: 17, resize: "none", marginBottom: 12 }} />
      ) : (
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={enter} autoFocus
          placeholder={tipo === "tarea" ? "tarea…" : "qué hay que comprar…"} style={{ ...campo, marginBottom: 12 }} />
      )}
      {tipo === "tarea" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setDia("hoy")} style={chip(dia === "hoy")}>hoy</button>
            <button onClick={() => setDia("manana")} style={chip(dia === "manana")}>mañana</button>
            <button onClick={() => setDia("fecha")} style={chip(dia === "fecha")}>otro día</button>
            <button onClick={() => setUrgente(u => !u)} style={{ ...chip(urgente, "#ff3b30"), marginLeft: "auto" }}>{urgente ? "🔴 urgente" : "urgente"}</button>
          </div>
          {dia === "fecha" && <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ marginTop: 10, border: "1px dashed #ccc", borderRadius: 8, padding: "8px 10px", fontFamily: F, fontSize: 14, color: "#111" }} />}
        </div>
      )}
      {tipo === "compra" && <div style={{ fontFamily: F, fontSize: 11, color: "#aaa", marginBottom: 12 }}>se suma a la lista de compras de hoy</div>}
      <button onClick={guardar} disabled={!puede}
        style={{ width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontFamily: C, fontSize: 18, cursor: "pointer", opacity: puede ? 1 : 0.4, marginBottom: 8 }}>
        {tipo === "nota" ? "agregar nota" : tipo === "tarea" ? "agregar tarea" : "agregar compra"}
      </button>
      <button onClick={onClose} style={{ width: "100%", background: "transparent", color: "#999", border: "none", padding: "8px", fontFamily: F, fontSize: 12, cursor: "pointer" }}>cerrar</button>
    </VentanaArriba>
  );
}

export default RegistroRapido;
