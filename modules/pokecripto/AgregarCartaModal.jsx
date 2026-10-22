// Alta rápida de cartas desde ➕ Registrar: buscar → elegir → destino/carpeta → guardar, sin salir del módulo actual.
// La lógica (búsqueda, armado de la carta, cola para el bot de precios) es la misma de PokecriptoPage: vive en alta.js.
import { CARPETAS_DEFAULT } from "./PokecriptoPage.jsx";
import { getPrimaryPrice } from "./lib/pricing.mjs";
import { isDarkCard, buscarCartas, armarCartaNueva, encolarPokecriptoPending } from "./alta.js";
const { useState, useMemo } = React;

const F = "'DM Sans',sans-serif";
const C = "'Caveat',cursive";
const CONDICIONES = ["NM", "LP", "MP", "HP", "DMG"];
const rotulo = { fontFamily: F, fontSize: 10, color: "#aaa", marginBottom: 6 };
const chip = (activo) => ({ fontFamily: F, fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px dashed #ddd", background: activo ? "#111" : "transparent", color: activo ? "#fff" : "#555", cursor: "pointer" });
const campo = { width: "100%", border: "1px dashed #ccc", borderRadius: 8, padding: "8px 10px", fontSize: 16, fontFamily: C, outline: "none", boxSizing: "border-box", color: "#111" };
const fmtUSD = (n) => "$" + parseFloat(n || 0).toFixed(2);

function AgregarCartaModal({ inventario, carpetas, priceCache, saveInventario, onClose, onGuardado }) {
  const inv = inventario || [];
  const cache = priceCache || {};
  const hoy = new Date().toISOString().slice(0, 10);
  // Price Watch siempre existe como carpeta (igual que en PokecriptoPage).
  const cats = useMemo(() => { const b = carpetas || [...CARPETAS_DEFAULT]; return b.includes("Price Watch") ? b : [...b, "Price Watch"]; }, [carpetas]);
  const carpetasNormales = cats.filter(c => c !== "Price Watch");

  const [query, setQuery] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState(null);
  const [carta, setCarta] = useState(null);
  const [form, setForm] = useState({ destino: "inventario", carpeta: carpetasNormales[0] || "MLP", cantidad: 1, costoUSD: "", precioObjetivo: "", condicion: "NM" });

  async function buscar() {
    const q = query.trim(); if (!q) return;
    setCargando(true); setError(null); setResultados([]);
    try {
      const cards = await buscarCartas(q);
      setResultados(cards);
      if (!cards.length) setError(`Sin resultados para "${q}"`);
    } catch (e) { setError("Error de conexión: no se pudo buscar la carta"); }
    setCargando(false);
  }
  const precioDe = (c) => (cache[c.id] && cache[c.id].lastMarket) || (getPrimaryPrice(c) || {}).market || null;

  function elegir(c) {
    setCarta(c);
    setForm(f => ({ ...f, destino: "inventario", carpeta: isDarkCard(c) && carpetasNormales.includes("Dark Collection") ? "Dark Collection" : (carpetasNormales[0] || "MLP"), cantidad: 1, costoUSD: "", precioObjetivo: "" }));
  }
  function guardar() {
    const precio = precioDe(carta);
    const nueva = armarCartaNueva(carta, { ...form, precioVentaUSD: precio ? precio.toFixed(2) : "", fechaCompra: hoy, notas: "" }, cats, hoy);
    try {
      saveInventario(prev => [nueva, ...(prev || [])]);
    } catch (e) { setError("No se pudo guardar la carta"); return; }
    encolarPokecriptoPending([nueva]);
    if (onGuardado) onGuardado(`Guardado en ${nueva.carpeta} ✓`);
    onClose();
  }

  const envoltorio = (hijos) => (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(96vw,440px)", background: "#fff", borderRadius: "16px 16px 0 0", padding: "20px 20px 34px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>{hijos}</div>
    </div>
  );

  if (carta) {
    const watch = form.destino === "watch";
    return envoltorio(
      <div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
          {carta.images && carta.images.small && <img src={carta.images.small} alt={carta.name} style={{ width: 52, borderRadius: 6, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: C, fontSize: 20, fontWeight: 700, color: "#111", lineHeight: 1.2 }}>{carta.name}</div>
            <div style={{ fontFamily: F, fontSize: 11, color: "#888" }}>{carta.set && carta.set.name} · #{carta.number}{carta.rarity ? ` · ${carta.rarity}` : ""}</div>
            {precioDe(carta) && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#2e7d52", marginTop: 3 }}>{fmtUSD(precioDe(carta))} <span style={{ fontWeight: 400, color: "#bbb", fontSize: 10 }}>TCGPlayer</span></div>}
          </div>
        </div>
        <div style={{ display: "flex", marginBottom: 14, border: "1.5px solid #111", borderRadius: 10, overflow: "hidden" }}>
          {[["inventario", "📦 en posesión"], ["hunting", "🗡️ hunting"], ["watch", "🎯 price watch"]].map(([k, l]) => (
            <button key={k} onClick={() => setForm(f => ({ ...f, destino: k, carpeta: k === "watch" ? "Price Watch" : (f.carpeta === "Price Watch" ? (carpetasNormales[0] || "MLP") : f.carpeta) }))}
              style={{ flex: 1, padding: "8px 0", background: form.destino === k ? "#111" : "transparent", color: form.destino === k ? "#fff" : "#999", border: "none", cursor: "pointer", fontFamily: C, fontSize: 14, fontWeight: 700 }}>{l}</button>
          ))}
        </div>
        {!watch && (
          <div style={{ marginBottom: 12 }}>
            <div style={rotulo}>Carpeta</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {carpetasNormales.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, carpeta: c }))} style={chip(form.carpeta === c)}>{c}</button>)}
            </div>
          </div>
        )}
        {watch && (
          <div style={{ marginBottom: 12 }}>
            <div style={rotulo}>🎯 Me avisa cuando baje a (USD, opcional)</div>
            <input type="number" step="0.01" value={form.precioObjetivo} onChange={e => setForm(f => ({ ...f, precioObjetivo: e.target.value }))} placeholder="ej: 2.50" style={campo} />
          </div>
        )}
        {form.destino === "inventario" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={rotulo}>Lo que pagué USD (0 si fue regalo)</div>
              <input type="number" step="0.01" value={form.costoUSD} onChange={e => setForm(f => ({ ...f, costoUSD: e.target.value }))} placeholder="ej: 8.50" style={campo} />
            </div>
            <div>
              <div style={rotulo}>Cantidad</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setForm(f => ({ ...f, cantidad: Math.max(1, (f.cantidad || 1) - 1) }))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px dashed #ddd", background: "transparent", fontSize: 18, cursor: "pointer", color: "#555" }}>−</button>
                <span style={{ fontFamily: C, fontSize: 24, fontWeight: 700, color: "#111", minWidth: 28, textAlign: "center" }}>{form.cantidad || 1}</span>
                <button onClick={() => setForm(f => ({ ...f, cantidad: (f.cantidad || 1) + 1 }))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px dashed #ddd", background: "transparent", fontSize: 18, cursor: "pointer", color: "#555" }}>+</button>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={rotulo}>Condición</div>
          <div style={{ display: "flex", gap: 6 }}>
            {CONDICIONES.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, condicion: c }))} style={{ ...chip(form.condicion === c), flex: 1, padding: "6px 4px" }}>{c}</button>)}
          </div>
        </div>
        {error && <div style={{ fontFamily: F, fontSize: 12, color: "#c00", marginBottom: 10 }}>{error}</div>}
        <button onClick={guardar} style={{ width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontFamily: C, fontSize: 18, cursor: "pointer", marginBottom: 8 }}>guardar</button>
        <button onClick={() => { setCarta(null); setError(null); }} style={{ width: "100%", background: "transparent", color: "#999", border: "none", padding: "8px", fontFamily: F, fontSize: 12, cursor: "pointer" }}>volver a la búsqueda</button>
      </div>
    );
  }

  return envoltorio(
    <div>
      <div style={{ fontFamily: C, fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 10 }}>🃏 registrar carta</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && buscar()} autoFocus placeholder="nombre · sv3-125 · OBF 125"
          style={{ flex: 1, border: "none", borderBottom: "2px solid #111", padding: "8px 4px", fontSize: 18, fontFamily: C, outline: "none", background: "transparent", color: "#111", minWidth: 0 }} />
        <button onClick={buscar} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: C, fontSize: 15, cursor: "pointer" }}>buscar</button>
      </div>
      {cargando && <div style={{ textAlign: "center", padding: 14, fontFamily: F, fontSize: 12, color: "#aaa" }}>buscando…</div>}
      {!cargando && error && <div style={{ textAlign: "center", padding: 12, fontFamily: F, fontSize: 13, color: "#c00" }}>{error}</div>}
      {resultados.map(c => {
        const p = precioDe(c);
        const yaInv = inv.some(x => x.cardId === c.id && x.carpeta !== "Price Watch");
        const yaWatch = inv.some(x => x.cardId === c.id && x.carpeta === "Price Watch");
        return (
          <button key={c.id} onClick={() => elegir(c)} style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #f0f0f0", padding: "10px 0", cursor: "pointer" }}>
            {c.images && c.images.small && <img src={c.images.small} alt={c.name} style={{ width: 44, borderRadius: 5, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: C, fontSize: 17, fontWeight: 700, color: "#111", lineHeight: 1.2 }}>{c.name}</div>
              <div style={{ fontFamily: F, fontSize: 11, color: "#888" }}>{c.set && c.set.name} · #{c.number}{c.rarity ? ` · ${c.rarity}` : ""}</div>
              {p && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#2e7d52" }}>{fmtUSD(p)}</div>}
            </div>
            <div style={{ fontFamily: F, fontSize: 10, color: "#aaa", textAlign: "right", flexShrink: 0 }}>
              {yaInv && <div>ya en tu pool</div>}
              {yaWatch && <div>🎯 siguiéndola</div>}
            </div>
          </button>
        );
      })}
      <button onClick={onClose} style={{ width: "100%", background: "transparent", color: "#999", border: "none", padding: "12px 8px 0", fontFamily: F, fontSize: 12, cursor: "pointer" }}>cancelar</button>
    </div>
  );
}

export default AgregarCartaModal;
