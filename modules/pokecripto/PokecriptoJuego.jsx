// Otros juegos dentro de Pokécripto (multi-juego, 17-nov-2026). Explorar las colecciones de Yu-Gi-Oh! y Digimon sigue la
// MISMA estructura que las colecciones de Pokémon: menú «🗂️ Colecciones» con completación y valor; colección con tarjeta de
// completación en dos mitades, cartas agrupadas por set (más nuevo primero) con avance y valor por set, vistas ⠿ ▦ ≡,
// borde verde = conseguida / rojo = falta, y al tocar una carta, detalle a pantalla completa con ‹ › para recorrer la lista.
//
// Datos: el MISMO inventario de Pokécripto (pokeInventario): una fila por carta marcada (ver lib/juegos.mjs). El catálogo
// es virtual (los JSON de tcgcrypto, de tcgcsv). Las pantallas siguen en este orden: menú → colección → detalle.
import { fetchTcgCryptoData } from "../shared/catalog.js";
import {
  MarcoPoke, PriceChartFill, fmtUSD, BarraSet, ChipHerramienta, fmtDateShort, computeHistMetrics, computeTimeframeDeltas, BotonCerrar,
} from "./PokecriptoPage.jsx";
import { JUEGOS, juegoDe, idFila, marcaDeFila, marcasDeFilas, aplicarMarca, actualizarPreciosFilas, cartaDe } from "./lib/juegos.mjs";
import {
  claveVersion, versionElegida, precioReferencia, precioVersion, cartasDeColeccion, resumenColeccion, filtrarCartas,
  etiquetaVersion, urlImagen, urlImagenGrande, rankSets, versionReferencia, valoresFiltro, cuentaFiltros,
} from "../tcgcrypto/logica.js";

const { useState, useEffect, useMemo } = React;
const f = { fontFamily: "'DM Sans',sans-serif" }, cv = { fontFamily: "'Caveat',cursive" };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const lbl = { ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" };
const numCmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// Ilustración: la que falta se ve gris y apagada, igual que en Pokémon.
function Arte({ src, alt, cons, style }) {
  return <img src={src} alt={alt} loading="lazy" style={{ display: "block", width: "100%", background: "#0d0d0d", filter: cons ? "none" : "grayscale(1) brightness(0.6)", ...style }} />;
}

function Detalle({ datos, col, carta, fila, lista, onIr, onCerrar, onMarca }) {
  const [rango, setRango] = useState("todo");
  const [sel, setSel] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [editar, setEditar] = useState(false);
  const [ed, setEd] = useState({});
  const rank = useMemo(() => rankSets(datos), [datos]);
  const marca = marcaDeFila(fila) || {};
  const el = versionElegida(carta, marca);
  const ref = versionReferencia(carta, marca, rank) || carta.v[0];
  const precio = precioReferencia(carta, marca);
  const cons = !!marca.c;
  const hist = (fila && fila.priceHistory) || [];
  const idx = lista.indexOf(carta.k), nav = lista.length > 1;
  const { ath, athDate, atl, atlDate, vol, volLabel } = computeHistMetrics(hist, rango);
  const versiones = useMemo(() => [...carta.v].sort((a, b) => (rank[b[2]] ?? -1) - (rank[a[2]] ?? -1) || String(a[1]).localeCompare(String(b[1]))), [carta, rank]);
  const rangoV = ref[6] != null || ref[7] != null ? [ref[6], ref[7]] : null;
  const datosLinea = [];
  if (cons) { if (fila && fila.condicion) datosLinea.push(fila.condicion); if ((marca.q || 1) > 1) datosLinea.push(`×${marca.q}`); }
  const flecha = (d, t) => <button onClick={e => { e.stopPropagation(); onIr(d); }} title={d < 0 ? "anterior" : "siguiente"} style={{ flex: "none", width: 30, height: 176, background: "rgba(255,255,255,0.09)", border: "none", borderRadius: 12, color: "#fff", fontSize: 26, cursor: "pointer" }}>{t}</button>;
  const btnAcc = (bg, color, extra) => ({ flex: 1, minWidth: 0, background: bg, border: bg === "transparent" ? "1px dashed #444" : "none", borderRadius: 10, padding: "10px 6px", ...f, fontSize: 12, color: color || "#fff", cursor: "pointer", ...extra });
  const deltas = hist.length >= 2 ? computeTimeframeDeltas(hist) : [];
  const celdas = hist.length >= 2 ? [
    { label: "ATH", txt: ath ? fmtUSD(parseFloat(ath)) : "—", color: ath ? "#4caf80" : "rgba(255,255,255,0.2)", sub: athDate ? fmtDateShort(athDate) : "" },
    { label: "ATL", txt: atl ? fmtUSD(parseFloat(atl)) : "—", color: atl ? "#e57373" : "rgba(255,255,255,0.2)", sub: atlDate ? fmtDateShort(atlDate) : "" },
    { label: `σ ${volLabel || ""}`, txt: vol ? `${vol}%` : "—", color: vol ? "#999" : "rgba(255,255,255,0.2)", sub: "" },
    ...deltas.map(d => ({ label: `${d.days}D`, txt: d.pct == null ? "—" : `${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}%`, color: d.pct == null ? "rgba(255,255,255,0.2)" : d.pct >= 0 ? "#4caf80" : "#e57373", sub: "" })),
  ] : [];
  const abrirEditar = () => { setEd({ cu: marca.cu || "", q: marca.q || 1, nt: marca.nt || "" }); setEditar(true); };
  return (<>
    <div style={{ position: "absolute", inset: 0, zIndex: 650, background: "#111", display: "flex", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "none", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #1f1f1f" }}>
          <button onClick={onCerrar} style={{ justifySelf: "start", background: "transparent", border: "none", color: "#888", ...f, fontSize: 12, cursor: "pointer", padding: 0 }}>← volver</button>
          <div style={{ ...f, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{nav && idx >= 0 ? `${idx + 1} / ${lista.length}` : ""}</div>
          <button onClick={onCerrar} title="cerrar" style={{ justifySelf: "end", background: "transparent", border: "none", color: "#999", fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px 12px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 4, flex: "none" }}>
              {nav && flecha(-1, "‹")}
              <img src={urlImagen(datos.imgTpl, ref[0], 400)} alt={carta.n} onClick={() => setZoom(urlImagenGrande(ref[0]))}
                style={{ width: 126, height: 176, objectFit: "contain", borderRadius: 8, cursor: "pointer", filter: cons ? "none" : "grayscale(1) brightness(0.65)", background: "#000", display: "block" }} />
              {nav && flecha(1, "›")}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{carta.n}</div>
              <div style={{ ...f, fontSize: 10, color: "#777", lineHeight: 1.3 }}>{ref[3] ? `#${ref[3]} · ` : ""}{datos.sets[ref[2]] || ""} · {col.nombre}</div>
              <div><span style={{ ...f, fontSize: 9, background: cons ? "rgba(76,175,128,0.16)" : "#222", color: cons ? "#4caf80" : "#888", borderRadius: 20, padding: "2px 9px", fontWeight: 600 }}>{cons ? "conseguida" : "falta"}</span></div>
              <div style={{ marginTop: 2 }}>
                <div style={lbl}>{el ? "mercado · versión elegida" : "mercado · la más barata"}</div>
                {precio != null ? <div style={{ ...cv, fontSize: 28, fontWeight: 700, color: "#5c9cff", lineHeight: 1 }}>{fmtUSD(precio)}</div> : <div style={{ ...f, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>sin precio aún</div>}
                {rangoV && <div style={{ ...f, fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>rango {rangoV[0] != null ? fmtUSD(rangoV[0]) : "—"} – {rangoV[1] != null ? fmtUSD(rangoV[1]) : "—"}</div>}
              </div>
              <div style={{ ...f, fontSize: 11, color: "#aaa" }}>{cons && marca.cu > 0 ? `pagué ${fmtUSD(marca.cu)}` : ""}</div>
              {datosLinea.length > 0 && <div style={{ ...f, fontSize: 10, color: "#888" }}>{datosLinea.join(" · ")}</div>}
              {marca.nt && <div style={{ ...cv, fontSize: 13, color: "rgba(255,255,255,0.5)", fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{marca.nt}</div>}
            </div>
          </div>
          {carta.v.length > 0 && <div style={{ flex: "none" }}>
            <div style={{ ...lbl, marginBottom: 4 }}>versión / edición · {carta.v.length}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxHeight: 74, overflowY: "auto" }}>
              {versiones.map(v => {
                const on = el && claveVersion(el) === claveVersion(v), p = precioVersion(v);
                return <button key={claveVersion(v)} data-t="version" onClick={() => onMarca({ e: on ? null : claveVersion(v) })}
                  style={{ ...f, fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px dashed " + (on ? "#fff" : "#444"), background: on ? "#fff" : "transparent", color: on ? "#111" : "#999", cursor: "pointer" }}>
                  {etiquetaVersion(v, datos.sets)}{p != null ? ` · ${fmtUSD(p)}` : ""}</button>;
              })}
            </div>
          </div>}
          {celdas.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, flex: "none" }}>
            {celdas.map(c => (
              <div key={c.label} style={{ background: "#1a1a1a", borderRadius: 8, padding: "6px 8px", minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 4, ...lbl }}><span>{c.label}</span><span style={{ letterSpacing: 0 }}>{c.sub}</span></div>
                <div style={{ ...cv, fontSize: 16, fontWeight: 700, color: c.color, lineHeight: 1.15, whiteSpace: "nowrap" }}>{c.txt}</div>
              </div>))}
          </div>}
          {hist.length >= 2 ? (
            <div style={{ flex: "1 1 150px", minHeight: 150, background: "#1a1a1a", borderRadius: 10, padding: "8px 12px", display: "flex", flexDirection: "column" }}>
              <div style={{ flex: "none", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ ...lbl, letterSpacing: 2 }}>historial · {hist.length}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["7d", "30d", "todo"].map(rg => <button key={rg} onClick={() => { setRango(rg); setSel(null); }} style={{ ...f, fontSize: 9, padding: "2px 7px", borderRadius: 8, border: "1px solid", cursor: "pointer", background: rango === rg ? "#fff" : "transparent", color: rango === rg ? "#111" : "#666", borderColor: rango === rg ? "#fff" : "#333" }}>{rg}</button>)}
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <PriceChartFill history={hist} range={rango} onSelectPoint={p => setSel(sel && sel.date === p.date && sel.market === p.market ? null : p)} selectedPoint={sel} />
              </div>
              {sel && <div style={{ flex: "none", marginTop: 6, display: "flex", alignItems: "center", gap: 8, borderTop: "1px dashed #2a2a2a", paddingTop: 6 }}>
                <span style={{ ...cv, fontSize: 15, fontWeight: 700, color: "#fff" }}>{fmtUSD(sel.market)}</span>
                <span style={{ ...f, fontSize: 10, color: "rgba(255,255,255,0.4)", flex: 1 }}>{sel.date}</span>
              </div>}
            </div>
          ) : (
            <div style={{ flex: "1 1 150px", minHeight: 90, background: "#1a1a1a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", ...f, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 12 }}>
              {fila ? "el historial aparece cuando haya al menos dos snapshots de precio" : "marca la carta para empezar a registrar su historial de precios"}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flex: "none" }}>
            <button data-t="tengo" onClick={() => onMarca({ c: cons ? 0 : 1 })} style={btnAcc(cons ? "transparent" : "#2e7d52", cons ? "#999" : "#fff")}>{cons ? "↺ volver a hunting" : "✓ marcar conseguida"}</button>
            {cons && <button data-t="editar" onClick={abrirEditar} style={btnAcc("transparent", "#999")}>✎ editar</button>}
            {fila && <button onClick={() => { if (window.confirm(`¿Quitar ${carta.n} de tu inventario?`)) onMarca({ c: 0, e: null, q: 0, cu: 0, nt: "" }); }} title="quitar del inventario" style={btnAcc("transparent", "#777", { flex: "none", padding: "10px 12px" })}>🗑</button>}
          </div>
        </div>
      </div>
    </div>
    {zoom && <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={zoom} alt={carta.n} style={{ maxWidth: "94vw", maxHeight: "92vh", borderRadius: 10 }} /></div>}
    {editar && <div onClick={() => setEditar(false)} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "min(96vw,420px)", background: "#111", borderRadius: "16px 16px 0 0", padding: "22px 20px 28px", boxSizing: "border-box" }}>
        <BotonCerrar onClick={() => setEditar(false)} />
        <div style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 12 }}>✎ {carta.n}</div>
        <div style={{ ...f, fontSize: 10, color: "#777", marginBottom: 5 }}>Costo USD</div>
        <input type="number" step="0.01" value={ed.cu} onChange={e => setEd(x => ({ ...x, cu: e.target.value }))} style={{ width: "100%", border: "1px dashed #444", borderRadius: 6, padding: "6px 8px", fontSize: 14, color: "#fff", background: "#111", boxSizing: "border-box", marginBottom: 10 }} />
        <div style={{ ...f, fontSize: 10, color: "#777", marginBottom: 5 }}>Cantidad</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setEd(x => ({ ...x, q: Math.max(1, (x.q || 1) - 1) }))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px dashed #444", background: "transparent", color: "#999", fontSize: 16, cursor: "pointer" }}>−</button>
          <span style={{ ...cv, fontSize: 22, fontWeight: 700, color: "#fff", minWidth: 28, textAlign: "center" }}>{ed.q || 1}</span>
          <button onClick={() => setEd(x => ({ ...x, q: (x.q || 1) + 1 }))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px dashed #444", background: "transparent", color: "#999", fontSize: 16, cursor: "pointer" }}>+</button>
        </div>
        <div style={{ ...f, fontSize: 10, color: "#777", marginBottom: 5 }}>Notas</div>
        <textarea rows={2} value={ed.nt} onChange={e => setEd(x => ({ ...x, nt: e.target.value }))} style={{ width: "100%", border: "1px dashed #444", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#fff", background: "#111", boxSizing: "border-box", marginBottom: 12, resize: "none" }} />
        <button data-t="guardar" onClick={() => { onMarca({ cu: parseFloat(ed.cu) || 0, q: ed.q || 1, nt: (ed.nt || "").trim() }); setEditar(false); }} style={{ width: "100%", background: "#aac756", border: "none", borderRadius: 10, padding: "11px", ...f, fontSize: 13, fontWeight: 700, color: "#111", cursor: "pointer" }}>guardar</button>
      </div>
    </div>}
  </>);
}

export default function PokecriptoJuego({ juego, inventario, saveInventario }) {
  const info = JUEGOS.find(j => j.id === juego);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState({ t: "menu" });          // menu | col {colId}
  const [detalle, setDetalle] = useState(null);                // {k, lista}
  const [view, setView] = useState("grid_med");
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [panel, setPanel] = useState(false);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("todas");
  const [filtros, setFiltros] = useState({});
  const filas = useMemo(() => (inventario || []).filter(x => juegoDe(x) === juego), [inventario, juego]);

  useEffect(() => {
    let vivo = true; setDatos(null); setError(null); setVista({ t: "menu" }); setDetalle(null); setSoloSinPrecio(false); setPanel(false); setTexto(""); setModo("todas"); setFiltros({});
    fetchTcgCryptoData(juego).then(d => { if (vivo) setDatos(d); }).catch(e => { if (vivo) setError(e.message || "error"); });
    return () => { vivo = false; };
  }, [juego]);
  // Con el catálogo del día se repreciean las filas de este juego (sin consultas a ninguna API) y se guarda solo si cambió algo.
  useEffect(() => {
    if (!datos) return;
    saveInventario(prev => { const r = actualizarPreciosFilas(prev || [], { [juego]: datos }, hoyISO()); return r.cambiadas ? r.filas : prev; });
  }, [datos]);

  const rank = useMemo(() => (datos ? rankSets(datos) : []), [datos]);
  const cols = datos ? datos.colecciones : [];
  const col = vista.colId && datos ? cols.find(c => c.id === vista.colId) : null;
  const marcar = (c, k, parche) => saveInventario(prev => aplicarMarca(prev || [], { juego, datos, col: c, k, parche, hoy: hoyISO() }));

  if (error) return <MarcoPoke><div style={{ ...f, color: "#e57373", fontSize: 12 }}>No pude cargar el catálogo de {info.nombre}: {error}</div></MarcoPoke>;
  if (!datos) return <MarcoPoke><div style={{ ...f, color: "#666", fontSize: 12 }}>cargando catálogo de {info.nombre}…</div></MarcoPoke>;

  // ── Colección ─────────────────────────────────────────────────────────────
  if (col) {
    const todas = cartasDeColeccion(datos, col.id);
    const marcas = marcasDeFilas(filas, juego, col.nombre);
    const r = resumenColeccion(todas, marcas);
    const nF = cuentaFiltros(filtros);
    let visibles = filtrarCartas(todas, marcas, { texto, modo, filtros }, datos.sets);
    if (soloSinPrecio) visibles = visibles.filter(c => precioReferencia(c, marcas[c.k] || null) == null);
    const refDe = c => versionReferencia(c, marcas[c.k] || null, rank) || c.v[0];
    const grupo = (cartas) => {
      const m = new Map();
      for (const c of cartas) { const ref = refDe(c), k = ref[2]; if (!m.has(k)) m.set(k, { setIdx: k, setName: datos.sets[k] || "—", cards: [] }); m.get(k).cards.push(c); }
      for (const g of m.values()) g.cards.sort((a, b) => numCmp(refDe(a)[3], refDe(b)[3]) || a.n.localeCompare(b.n));
      return m;
    };
    const completos = grupo(todas);
    const setGroups = [...grupo(visibles).values()].sort((a, b) => (rank[b.setIdx] ?? -1) - (rank[a.setIdx] ?? -1));
    const lista = setGroups.flatMap(g => g.cards.map(c => c.k));
    const abrir = c => setDetalle({ k: c.k, lista });
    const gridCols = view === "grid_small" ? "repeat(auto-fill,minmax(58px,1fr))" : view === "grid_med" ? "repeat(auto-fill,minmax(88px,1fr))" : null;
    const Tarjeta = ({ c }) => {
      const m = marcas[c.k] || null, cons = !!(m && m.c), ref = refDe(c), p = precioReferencia(c, m), chico = view === "grid_small";
      if (view === "lista") return (
        <div data-t="carta" onClick={() => abrir(c)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer" }}>
          <div style={{ width: 36, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}><Arte src={urlImagen(datos.imgTpl, ref[0], 200)} alt={c.n} cons={cons} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...f, fontSize: 13, color: cons ? "#fff" : "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: cons ? 600 : 400 }}>{c.n}{m && m.q > 1 ? ` ×${m.q}` : ""}</div>
            <div style={{ ...f, fontSize: 10, color: "#555" }}>{ref[3] ? `#${ref[3]}` : ""}</div>
          </div>
          {p != null && <div style={{ ...cv, fontSize: 14, fontWeight: 700, color: "#5c9cff", flexShrink: 0 }}>{fmtUSD(p)}</div>}
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${cons ? "#2e7d52" : "#e53935"}`, background: cons ? "#2e7d52" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cons && <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>✓</span>}</div>
        </div>);
      return (
        <div data-t="carta" onClick={() => abrir(c)} style={{ position: "relative", cursor: "pointer", borderRadius: chico ? 6 : 8, overflow: "hidden", border: cons ? "2px solid #2e7d52" : "2px solid #e53935", boxShadow: cons ? "0 2px 8px rgba(46,125,82,0.3)" : "0 2px 8px rgba(229,57,53,0.3)" }}>
          <Arte src={urlImagen(datos.imgTpl, ref[0], 200)} alt={c.n} cons={cons} />
          {cons && <div style={{ position: "absolute", top: 2, right: 2, background: "#2e7d52", borderRadius: "50%", width: chico ? 12 : 16, height: chico ? 12 : 16, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: chico ? 7 : 9, fontWeight: 700 }}>✓</span></div>}
          <div style={{ background: "rgba(0,0,0,0.7)", padding: chico ? "2px 3px" : "3px 4px", textAlign: "center" }}>
            <div style={{ ...f, fontSize: chico ? 8 : 9, color: "#aac756", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ref[3] || "·"}</div>
            {!chico && p != null && <div style={{ ...f, fontSize: 8, color: "#5c9cff" }}>{fmtUSD(p)}</div>}
          </div>
        </div>);
    };
    const detCarta = detalle ? cartaDe(datos, detalle.k) : null;
    const irA = d => { const i = detalle.lista.indexOf(detalle.k); const j = i + d; if (j >= 0 && j < detalle.lista.length) setDetalle({ ...detalle, k: detalle.lista[j] }); };
    const chipsHay = r.sinPrecio > 0 || (datos.filtros || []).length > 0;
    return (
      <MarcoPoke>
        {detCarta && <Detalle key={detCarta.k} datos={datos} col={col} carta={detCarta} fila={filas.find(x => x.id === idFila(juego, col.id, detCarta.k)) || null} lista={detalle.lista} onIr={irA} onCerrar={() => setDetalle(null)} onMarca={p => marcar(col, detCarta.k, p)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => { setVista({ t: "menu" }); setDetalle(null); }} style={{ background: "transparent", border: "none", fontSize: 20, color: "#444", cursor: "pointer", padding: 0 }}>←</button>
          <div style={{ flex: 1 }}><div style={{ ...cv, fontSize: 22, fontWeight: 700, color: "#fff" }}>{col.emoji} {col.nombre}</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 12, background: "#151515", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#aac756" }}>{r.conseguidas}/{r.total}</span><span style={{ ...f, fontSize: 12, color: "#888" }}>{r.pct}%</span></div>
            <div style={{ height: 3, background: "#1f1f1f", borderRadius: 99, overflow: "hidden", margin: "4px 0 6px" }}><div style={{ height: "100%", width: `${r.total ? r.conseguidas / r.total * 100 : 0}%`, background: "#2e7d52", borderRadius: 99 }} /></div>
            {r.valorTotal > 0 && <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span style={{ ...cv, fontSize: 15, fontWeight: 700, color: "#fff" }}>{fmtUSD(r.valorConseguido)} <span style={{ color: "#555", fontSize: 13 }}>/ {fmtUSD(r.valorTotal)}</span></span>
              <span style={{ ...f, fontSize: 10, color: "#aac756" }}>{Math.round(r.valorConseguido / r.valorTotal * 100)}% del valor</span>
            </div>}
          </div>
          {chipsHay && <><div style={{ width: 1, background: "#222", flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 6, alignContent: "center", justifyContent: "center" }}>
              {r.sinPrecio > 0 && <ChipHerramienta activo={soloSinPrecio} onClick={() => setSoloSinPrecio(v => !v)} title={soloSinPrecio ? "mostrando solo sin precio" : "filtrar sin precio"}>{soloSinPrecio ? "✕" : "🔍"} {r.sinPrecio}</ChipHerramienta>}
              {(datos.filtros || []).length > 0 && <ChipHerramienta activo={panel || nF > 0 || !!texto || modo !== "todas"} onClick={() => setPanel(v => !v)} title="buscar y filtrar">🔎{nF ? ` ${nF}` : ""}</ChipHerramienta>}
            </div></>}
        </div>
        {panel && <div style={{ background: "#121212", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="buscar por nombre, número, edición…" style={{ width: "100%", boxSizing: "border-box", background: "#151515", border: "1px solid #262626", borderRadius: 8, color: "#fff", padding: "8px 10px", fontSize: 12, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[["todas", "todas"], ["faltan", "me faltan"], ["tengo", "las tengo"]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "5px 10px", background: modo === k ? "#fff" : "transparent", color: modo === k ? "#111" : "#777", border: "1px solid", borderColor: modo === k ? "#fff" : "#333", borderRadius: 8, cursor: "pointer", ...f, fontSize: 11 }}>{l}</button>)}
          </div>
          {(datos.filtros || []).map(fl => (
            <div key={fl.id} style={{ marginBottom: 6 }}>
              <div style={{ ...f, fontSize: 9, color: "#666", marginBottom: 3 }}>{fl.nombre || fl.id}</div>
              <select value={(filtros[fl.id] || [])[0] || ""} onChange={e => setFiltros(p => { const n = { ...p }; if (e.target.value) n[fl.id] = [e.target.value]; else delete n[fl.id]; return n; })} style={{ width: "100%", background: "#151515", color: "#ddd", border: "1px solid #262626", borderRadius: 8, padding: "6px 8px", fontSize: 11 }}>
                <option value="">todos</option>{valoresFiltro(todas, fl.id).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>))}
          {(nF > 0 || texto || modo !== "todas") && <button onClick={() => { setFiltros({}); setTexto(""); setModo("todas"); }} style={{ background: "transparent", border: "none", color: "#e57373", ...f, fontSize: 11, cursor: "pointer", padding: 0 }}>limpiar</button>}
        </div>}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          {[["grid_small", "⠿"], ["grid_med", "▦"], ["lista", "≡"]].map(([v, l]) => (
            <button key={v} data-view={v} onClick={() => setView(v)} style={{ padding: "6px 10px", background: view === v ? "#fff" : "transparent", color: view === v ? "#111" : "#555", border: "1px solid", borderColor: view === v ? "#fff" : "#333", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{l}</button>))}
          <span style={{ marginLeft: "auto", ...f, fontSize: 10, color: "#444" }}>{visibles.length} carta(s)</span>
        </div>
        {setGroups.map(({ setName, setIdx, cards }) => {
          const rs = resumenColeccion((completos.get(setIdx) || { cards }).cards, marcas);
          return (
            <div key={setIdx} data-t="set" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 6 }}>
                <div style={{ ...cv, fontSize: 17, fontWeight: 700, color: "#fff", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{setName}</div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {rs.total > 0 && rs.conseguidas === rs.total && <div style={{ ...f, fontSize: 11, fontWeight: 700, color: "#d4af37" }}>¡completada!</div>}
                  {rs.valorTotal > 0 && <div style={{ ...f, fontSize: 9, color: "#666", marginTop: 1 }}>{fmtUSD(rs.valorConseguido)} / {fmtUSD(rs.valorTotal)}</div>}
                </div>
              </div>
              <BarraSet conseguidas={rs.conseguidas} total={rs.total} />
              {view === "lista" ? <div>{cards.map(c => <Tarjeta key={c.k} c={c} />)}</div>
                : <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: view === "grid_small" ? 3 : 5 }}>{cards.map(c => <Tarjeta key={c.k} c={c} />)}</div>}
            </div>);
        })}
        {setGroups.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", ...cv, fontSize: 16, color: "#333" }}>no hay cartas con ese filtro</div>}
        <div style={{ height: 40 }} />
      </MarcoPoke>
    );
  }

  // ── Menú de colecciones (igual al «🗂️ Colecciones» de Pokémon) ────────────
  let total = 0, tengo = 0, vTot = 0, vCons = 0;
  const filasCol = cols.map(c => {
    const r = resumenColeccion(cartasDeColeccion(datos, c.id), marcasDeFilas(filas, juego, c.nombre));
    total += r.total; tengo += r.conseguidas; vTot += r.valorTotal; vCons += r.valorConseguido;
    return { c, r };
  });
  const pct = total ? Math.floor(tengo / total * 100) : 0;
  return (
    <MarcoPoke>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, ...cv, fontSize: 22, fontWeight: 700, color: "#fff" }}>🗂️ Colecciones</div>
        {total > 0 && <div style={{ textAlign: "right" }}><div style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#aac756" }}>{tengo}/{total}</div><div style={{ ...f, fontSize: 9, color: "#444" }}>{pct}% completado</div></div>}
      </div>
      {total > 0 && <div style={{ height: 3, background: "#1a1a1a", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}><div style={{ height: "100%", width: `${tengo / total * 100}%`, background: "#2e7d52", borderRadius: 99 }} /></div>}
      {vTot > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#151515", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
        <div><div style={{ ...f, fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>valor conseguido / total</div>
          <div style={{ ...cv, fontSize: 17, fontWeight: 700, color: "#fff" }}>{fmtUSD(vCons)} <span style={{ color: "#555", fontSize: 14 }}>/ {fmtUSD(vTot)}</span></div></div>
        <div style={{ ...f, fontSize: 13, fontWeight: 700, color: "#aac756" }}>{Math.round(vCons / vTot * 100)}% del valor</div>
      </div>}
      {filasCol.map(({ c, r }) => (
        <button key={c.id} data-t="coleccion" onClick={() => setVista({ t: "col", colId: c.id })}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#151515", border: "none", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 20 }}>{c.emoji}</div>
          <div style={{ flex: 1, ...cv, fontSize: 16, color: "#fff" }}>{c.nombre}</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...f, fontSize: 11, color: r.total > 0 ? "#aac756" : "#555" }}>{r.conseguidas}/{r.total} · {r.pct}%</div>
            {r.valorTotal > 0 && <div style={{ ...f, fontSize: 9, color: "#666", marginTop: 2 }}>{fmtUSD(r.valorConseguido)} / {fmtUSD(r.valorTotal)}</div>}
          </div>
        </button>))}
      <div style={{ height: 32 }} />
    </MarcoPoke>
  );
}
