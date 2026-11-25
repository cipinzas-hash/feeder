// «+ agregar» para Yu-Gi-Oh! y Digimon (unificación de Pokécripto, 23-nov-2026): como el de Pokémon, busca en TODO el pool del juego (no solo en las
// colecciones), muestra el texto del efecto, deja elegir variante y carpeta y crea el ejemplar («la tengo» o «solo la sigo») con su historial completo de
// precios (3 datos por mes desde feb-2024). También importa mazos (.ydk o lista de texto). Índice de nombres: ~0,5 MB al primer tipeo; archivo por letra
// al elegir la carta. Si el pool aún no se generó, cae al catálogo de colecciones.
import { fetchPoolIndice, fetchPoolLetra, fetchTcgCryptoData } from "../shared/catalog.js";
import { MarcoPoke, fmtUSD, BotonCerrar } from "./PokecriptoPage.jsx";
import { JUEGOS, aplicarMarca, precioDeCarta, pendientesDeCambio, claveVersion } from "./lib/juegos.mjs";
import { describirVariante } from "./lib/variantes-comunes.mjs";
import { normNombre, letraDe } from "./lib/mazos.mjs";
import { precioVersion, urlImagen } from "../tcgcrypto/logica.js";
import { encolarPokecriptoPending } from "./alta.js";
import { adjuntarHistorial } from "./historialAlAgregar.js";
import EfectoCarta from "./EfectoCarta.jsx";
import ImportarMazo from "./ImportarMazo.jsx";

const { useState, useEffect, useMemo, useRef } = React;
const f = { fontFamily: "'DM Sans',sans-serif" }, cv = { fontFamily: "'Caveat',cursive" };
const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function BuscarCatalogo({ juego, filas, saveInventario, carpetas, crearCarpeta, onVolver }) {
  const info = JUEGOS.find(j => j.id === juego);
  const [modo, setModo] = useState("carta");
  const [idx, setIdx] = useState(null), [aviso, setAviso] = useState(null), [error, setError] = useState(null);
  const [q, setQ] = useState(""), [sel, setSel] = useState(null);
  const [vkey, setVkey] = useState(null), [carpeta, setCarpeta] = useState((carpetas && carpetas[0]) || "Para cambio"), [tengo, setTengo] = useState(true);
  const normados = useRef(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const i = await fetchPoolIndice(juego);
      if (i && Array.isArray(i.n)) { normados.current = i.n.map(e => normNombre(e[1])); if (vivo) setIdx({ ...i, completo: true }); return; }
      const d = await fetchTcgCryptoData(juego);      // el pool aún no se generó: catálogo de colecciones
      normados.current = d.cartas.map(c => normNombre(c.n));
      if (vivo) { setIdx({ ...d, completo: false, n: d.cartas.map(c => [c.k, c.n, letraDe(c.n)]) }); setAviso("El catálogo completo todavía no se genera: por ahora solo busco en las cartas de las colecciones."); }
    })().catch(e => { if (vivo) setError(e.message || "error"); });
    return () => { vivo = false; };
  }, [juego]);
  const resultados = useMemo(() => {
    const t = normNombre(q);
    if (!idx || t.length < 2) return [];
    const out = [];
    for (let i = 0; i < idx.n.length && out.length < 40; i++) if (normados.current[i].includes(t)) out.push(idx.n[i]);
    return out;
  }, [idx, q]);
  const datosDe = c => ({ sets: idx.sets, setIds: idx.setIds, setFechas: idx.setFechas, imgTpl: idx.imgTpl, cartas: [c] });
  const [carta, setCarta] = useState(null);
  async function elegir(e) {
    setSel(e); setCarta(null);
    let c = null;
    if (idx.completo) { const sh = await fetchPoolLetra(juego, e[2]); c = sh && sh.cartas.find(x => x.k === e[0]); }
    else c = idx.cartas.find(x => x.k === e[0]);
    if (!c) { setSel(null); return; }
    setCarta(c); const p = precioDeCarta(c, null); setVkey(p ? claveVersion(p.version) : claveVersion(c.v[0])); setTengo(carpeta !== "Price Watch");
  }
  const versiones = useMemo(() => (carta && idx ? carta.v.map(v => ({ key: claveVersion(v), set: (idx.sets && idx.sets[v[2]]) || "", num: v[3] || "", market: precioVersion(v), d: describirVariante({ juego, sub: v[1], rareza: v[4], grupo: (idx.sets && idx.sets[v[2]]) || "" }) })).sort((a, b) => (b.market ?? -1) - (a.market ?? -1)) : []), [carta, idx, juego]);
  function agregar() {
    if (!carta || !vkey) return;
    const hoy = hoyISO();
    const next = aplicarMarca(filas, { juego, datos: datosDe(carta), col: { id: "carpeta:" + carpeta, nombre: carpeta }, k: carta.k, vkey, parche: tengo ? { c: 1 } : {}, hoy, forzar: true });
    saveInventario(next);
    const nuevos = pendientesDeCambio(filas, next).filter(c => c._baja || !filas.some(x => x.id === c.id));
    if (nuevos.length) encolarPokecriptoPending(nuevos);
    adjuntarHistorial(next.filter(x => !filas.some(y => y.id === x.id)), saveInventario, juego, hoy);
    onVolver();
  }
  if (error) return <MarcoPoke><div style={{ ...f, color: "#e57373", fontSize: 12 }}>No pude cargar el catálogo de {info.nombre}: {error}</div></MarcoPoke>;
  const chip = (act, onClick, txt, k) => <button key={k} onClick={onClick} style={{ ...f, fontSize: 11, padding: "5px 11px", borderRadius: 14, border: "1px solid " + (act ? "#fff" : "#333"), background: act ? "#fff" : "transparent", color: act ? "#111" : "#999", cursor: "pointer" }}>{txt}</button>;
  if (modo === "mazo") return <ImportarMazo juego={juego} filas={filas} saveInventario={saveInventario} carpetas={carpetas} crearCarpeta={crearCarpeta} onVolver={() => setModo("carta")} onListo={onVolver} />;
  return (
    <MarcoPoke>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={onVolver} style={{ background: "transparent", border: "none", fontSize: 20, color: "#bbb", cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1, ...cv, fontSize: 22, fontWeight: 700, color: "#fff" }}>{info.emoji} agregar carta de {info.nombre}</div>
        {juego === "yugioh" && <button data-t="importar-mazo" onClick={() => setModo("mazo")} style={{ ...f, fontSize: 11, padding: "6px 10px", borderRadius: 14, border: "1px solid #333", background: "transparent", color: "#ccc", cursor: "pointer" }}>importar mazo</button>}
      </div>
      {!idx ? <div style={{ ...f, color: "#666", fontSize: 12 }}>cargando catálogo…</div> : <>
        {aviso && <div style={{ ...f, fontSize: 10, color: "#c9a227", marginBottom: 8 }}>{aviso}</div>}
        <input data-t="buscar" autoFocus value={q} onChange={e => { setQ(e.target.value); setSel(null); setCarta(null); }} placeholder="nombre de la carta…"
          style={{ width: "100%", boxSizing: "border-box", background: "#000", border: "1px solid #333", borderRadius: 10, padding: "10px 12px", color: "#fff", ...f, fontSize: 14, marginBottom: 10 }} />
        {q.trim().length >= 2 && !resultados.length && <div style={{ ...f, fontSize: 12, color: "#777" }}>Sin resultados para «{q}».</div>}
        {!sel && resultados.map(e => (
          <div key={e[0]} data-t="resultado" onClick={() => elegir(e)} style={{ padding: "9px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer", ...f, fontSize: 13, color: "#eee" }}>{e[1]}</div>))}
        {sel && !carta && <div style={{ ...f, color: "#666", fontSize: 12 }}>cargando carta…</div>}
        {sel && carta && (
          <div data-t="elegir" style={{ background: "#111", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, ...cv, fontSize: 18, color: "#fff" }}>{carta.n}</div>
              <BotonCerrar onClick={() => { setSel(null); setCarta(null); }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <img src={urlImagen(idx.imgTpl, (versiones.find(x => x.key === vkey) ? carta.v.find(v => claveVersion(v) === vkey) : carta.v[0])[0], 400)} alt="" referrerPolicy="no-referrer" style={{ width: 96, aspectRatio: juego === "yugioh" ? "59/86" : "63/88", objectFit: "cover", borderRadius: 5, background: "#111", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}><EfectoCarta juego={juego} carta={carta} /></div>
            </div>
            <div style={{ ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", margin: "8px 0 4px" }}>versión / variante · {versiones.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, maxHeight: 240, overflowY: "auto" }}>
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
            <div style={{ ...f, fontSize: 9, color: "#555", marginTop: 6 }}>el historial de precios (media, mínimo y máximo por mes) se carga solo; si todavía no existe, la ficha avisa cuándo llega</div>
          </div>)}
      </>}
      <div style={{ height: 40 }} />
    </MarcoPoke>);
}
