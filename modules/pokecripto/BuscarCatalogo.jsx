// «+ agregar» para otros juegos (unificación de Pokécripto, 22-nov-2026): busca una carta por nombre en el catálogo del juego (tcgcsv, los
// mismos JSON del explorador de colecciones), elige su versión/variante y la carpeta (MLP, Staples & Meta, Price Watch…) y crea el
// ejemplar como en Pokémon: «la tengo» o «la sigo» (hunting). Mismo inventario, mismas carpetas, mismas fichas.
import { fetchTcgCryptoData } from "../shared/catalog.js";
import { MarcoPoke, fmtUSD, BotonCerrar } from "./PokecriptoPage.jsx";
import { JUEGOS, aplicarMarca, cartaDe, precioDeCarta, pendientesDeCambio, claveVersion } from "./lib/juegos.mjs";
import { describirVariante } from "./lib/variantes-comunes.mjs";
import { precioVersion, urlImagen } from "../tcgcrypto/logica.js";
import { encolarPokecriptoPending } from "./alta.js";

const { useState, useEffect, useMemo } = React;
const f = { fontFamily: "'DM Sans',sans-serif" }, cv = { fontFamily: "'Caveat',cursive" };
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function BuscarCatalogo({ juego, filas, saveInventario, carpetas, onVolver }) {
  const info = JUEGOS.find(j => j.id === juego);
  const [datos, setDatos] = useState(null), [error, setError] = useState(null);
  const [q, setQ] = useState(""), [sel, setSel] = useState(null);
  const [vkey, setVkey] = useState(null), [carpeta, setCarpeta] = useState((carpetas && carpetas[0]) || "MLP"), [tengo, setTengo] = useState(true);
  useEffect(() => { let vivo = true; fetchTcgCryptoData(juego).then(d => { if (vivo) setDatos(d); }).catch(e => { if (vivo) setError(e.message || "error"); }); return () => { vivo = false; }; }, [juego]);
  const resultados = useMemo(() => {
    const t = norm(q);
    if (!datos || t.length < 2) return [];
    return datos.cartas.filter(c => norm(c.n).includes(t)).slice(0, 40);
  }, [datos, q]);
  const versiones = useMemo(() => (sel && datos ? sel.v.map(v => ({ key: claveVersion(v), v, set: (datos.sets && datos.sets[v[2]]) || "", num: v[3] || "", market: precioVersion(v), d: describirVariante({ juego, sub: v[1], rareza: v[4], grupo: (datos.sets && datos.sets[v[2]]) || "" }) })) : []), [sel, datos, juego]);
  const elegir = c => { setSel(c); const p = precioDeCarta(c, null); setVkey(p ? claveVersion(p.version) : claveVersion(c.v[0])); setTengo(carpeta !== "Price Watch"); };
  function agregar() {
    if (!sel || !vkey) return;
    const next = aplicarMarca(filas, { juego, datos, col: { id: "carpeta:" + carpeta, nombre: carpeta }, k: sel.k, vkey, parche: tengo ? { c: 1 } : {}, hoy: hoyISO(), forzar: true });
    saveInventario(next);
    const nuevos = pendientesDeCambio(filas, next).filter(c => c._baja || !filas.some(x => x.id === c.id));
    if (nuevos.length) encolarPokecriptoPending(nuevos);
    onVolver();
  }
  if (error) return <MarcoPoke><div style={{ ...f, color: "#e57373", fontSize: 12 }}>No pude cargar el catálogo de {info.nombre}: {error}</div></MarcoPoke>;
  const chip = (act, onClick, txt, k) => <button key={k} onClick={onClick} style={{ ...f, fontSize: 11, padding: "5px 11px", borderRadius: 14, border: "1px solid " + (act ? "#fff" : "#333"), background: act ? "#fff" : "transparent", color: act ? "#111" : "#999", cursor: "pointer" }}>{txt}</button>;
  return (
    <MarcoPoke>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={onVolver} style={{ background: "transparent", border: "none", fontSize: 20, color: "#bbb", cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ ...cv, fontSize: 22, fontWeight: 700, color: "#fff" }}>{info.emoji} agregar carta de {info.nombre}</div>
      </div>
      {!datos ? <div style={{ ...f, color: "#666", fontSize: 12 }}>cargando catálogo…</div> : <>
        <input data-t="buscar" autoFocus value={q} onChange={e => { setQ(e.target.value); setSel(null); }} placeholder="nombre de la carta…"
          style={{ width: "100%", boxSizing: "border-box", background: "#000", border: "1px solid #333", borderRadius: 10, padding: "10px 12px", color: "#fff", ...f, fontSize: 14, marginBottom: 10 }} />
        {q.trim().length >= 2 && !resultados.length && <div style={{ ...f, fontSize: 12, color: "#777" }}>Sin resultados en el catálogo de {info.nombre}. Solo están las cartas de las colecciones que arma el bot.</div>}
        {!sel && resultados.map(c => {
          const p = precioDeCarta(c, null);
          return (
            <div key={c.k} data-t="resultado" onClick={() => elegir(c)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer" }}>
              <img src={urlImagen(datos.imgTpl, c.v[0][0], 200)} alt="" referrerPolicy="no-referrer" style={{ width: 38, aspectRatio: "0.69", objectFit: "cover", borderRadius: 4, background: "#111" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...f, fontSize: 13, color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.n}</div>
                <div style={{ ...f, fontSize: 10, color: "#666" }}>{c.v.length} versión{c.v.length === 1 ? "" : "es"}</div>
              </div>
              {p && <div style={{ ...cv, fontSize: 15, fontWeight: 700, color: "#5c9cff" }}>{fmtUSD(p.market)}</div>}
            </div>);
        })}
        {sel && (
          <div data-t="elegir" style={{ background: "#111", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, ...cv, fontSize: 18, color: "#fff" }}>{sel.n}</div>
              <BotonCerrar onClick={() => setSel(null)} />
            </div>
            <div style={{ ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>versión / variante</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, maxHeight: 220, overflowY: "auto" }}>
              {versiones.map(x => (
                <div key={x.key} data-t="version" onClick={() => setVkey(x.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 9, background: vkey === x.key ? "#1d2a3a" : "#151515", border: "1px solid " + (vkey === x.key ? "#5c9cff" : "#1f1f1f"), cursor: "pointer" }}>
                  <span style={{ ...f, fontSize: 12, color: x.d.color, width: 16, textAlign: "center" }}>{x.d.icono}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...f, fontSize: 11, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.d.etiqueta}</div>
                    <div style={{ ...f, fontSize: 9, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.set}{x.num ? ` · ${x.num}` : ""}</div>
                  </div>
                  <span style={{ ...cv, fontSize: 15, fontWeight: 700, color: x.market != null ? "#5c9cff" : "#555" }}>{x.market != null ? fmtUSD(x.market) : "—"}</span>
                </div>))}
            </div>
            <div style={{ ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>carpeta</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{(carpetas || []).map(c => chip(carpeta === c, () => { setCarpeta(c); setTengo(c !== "Price Watch"); }, c, c))}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{chip(tengo, () => setTengo(true), "la tengo", "t")}{chip(!tengo, () => setTengo(false), "solo la sigo", "s")}</div>
            <button data-t="agregar" onClick={agregar} style={{ width: "100%", background: "#aac756", border: "none", borderRadius: 10, padding: "11px", ...f, fontSize: 13, fontWeight: 700, color: "#111", cursor: "pointer" }}>agregar a {carpeta}</button>
          </div>)}
      </>}
      <div style={{ height: 40 }} />
    </MarcoPoke>);
}
