// Otros juegos dentro de Pokécripto (multi-juego + variantes, 20-nov-2026). Explorar las colecciones de Yu-Gi-Oh! y Digimon sigue la
// MISMA estructura que las de Pokémon (menú «🗂️ Colecciones» → colección por sets con avance y valor → detalle a pantalla completa),
// y las VARIANTES se informan igual en todos los juegos (ver lib/variantes-comunes.mjs): insignias en cada tarjeta, franja de variantes
// en el detalle con el precio de cada una, y cada variante que tienes es su propio ejemplar (fila del inventario de Pokécripto).
//
// Datos: el MISMO inventario de Pokécripto (pokeInventario): una fila por VARIANTE marcada (ver lib/juegos.mjs). El catálogo es virtual
// (los JSON de tcgcrypto, de tcgcsv). Una tarjeta es una impresión (set + número) y reúne todas las variantes de esa impresión.
import { fetchTcgCryptoData } from "../shared/catalog.js";
import {
  MarcoPoke, PriceChartFill, fmtUSD, BarraSet, ChipHerramienta, fmtDateShort, computeHistMetrics, computeTimeframeDeltas, BotonCerrar,
} from "./PokecriptoPage.jsx";
import { JUEGOS, juegoDe, idFila, filaTiene, marcasDeFilas, aplicarMarca, actualizarPreciosFilas, cartaDe, variantesDeImpresion, resumenFilas, pendientesDeCambio } from "./lib/juegos.mjs";
import { encolarPokecriptoPending } from "./alta.js";
import { multiploSobreBase } from "./lib/variantes-comunes.mjs";
import { historialConMensual } from "./lib/historial.mjs";
import {
  cartasDeColeccion, filtrarCartas, urlImagen, urlImagenGrande, rankSets, valoresFiltro, cuentaFiltros, precioReferencia,
} from "../tcgcrypto/logica.js";

const { useState, useEffect, useMemo } = React;
const f = { fontFamily: "'DM Sans',sans-serif" }, cv = { fontFamily: "'Caveat',cursive" };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const lbl = { ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" };
const numCmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// Tamaño de las caras (preferencia de este dispositivo, por juego). Las cartas de Yu-Gi-Oh!/Digimon llevan texto: por defecto L.
export const TAMANOS = [["S", "S", 64, 3], ["M", "M", 96, 5], ["L", "L", 150, 6], ["XL", "XL", 250, 8]];
const prefClave = j => `angst-caras-${j}`;
const leerTamano = j => { try { const v = window.localStorage.getItem(prefClave(j)); if (v === "lista" || TAMANOS.some(t => t[0] === v)) return v; } catch (e) { /* sin almacenamiento */ } return "L"; };
const guardarTamano = (j, v) => { try { window.localStorage.setItem(prefClave(j), v); } catch (e) { /* sin almacenamiento */ } };

// Ilustración con cadena de respaldos (200w → 400w → 1000x1000 del CDN de TCGplayer), sin enviar referer y con el alto reservado
// (así una carga lenta o fallida no colapsa la tarjeta). Si todas fallan queda un marcador con el nombre. La que falta se ve gris.
const ASPECTO = 0.69; // ancho/alto de una carta
function ImagenCarta({ datos, pid, alt, cons, grande, style }) {
  const urls = useMemo(() => {
    const l = grande ? [urlImagen(datos.imgTpl, pid, 400), urlImagenGrande(pid), urlImagen(datos.imgTpl, pid, 200)] : [urlImagen(datos.imgTpl, pid, 200), urlImagen(datos.imgTpl, pid, 400), urlImagenGrande(pid)];
    return l.filter((u, i) => l.indexOf(u) === i);
  }, [datos, pid, grande]);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [urls]);
  const filtro = cons ? "none" : "grayscale(1) brightness(0.6)";
  if (i >= urls.length) return <div style={{ aspectRatio: String(ASPECTO), background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 4, boxSizing: "border-box", textAlign: "center", ...f, fontSize: 8, color: "#555", overflow: "hidden", filter: filtro, ...style }}>{alt}</div>;
  return <img src={urls[i]} alt={alt} referrerPolicy="no-referrer" onError={() => setI(k => k + 1)} style={{ display: "block", width: "100%", aspectRatio: String(ASPECTO), objectFit: "cover", background: "#0d0d0d", filter: filtro, ...style }} />;
}

// Insignia de variante: llena si la tienes, con borde si existe y no la tienes.
function Insignia({ v, tengo, px = 9 }) {
  return <span data-t="insignia" data-tengo={tengo ? "1" : "0"} title={v.etiqueta + (v.market != null ? ` · ${fmtUSD(v.market)}` : "")}
    style={{ ...f, fontSize: px, lineHeight: 1.15, padding: "1px 4px", borderRadius: 6, whiteSpace: "nowrap", background: tengo ? v.color : "transparent", color: tengo ? "#111" : v.color, border: `1px solid ${v.color}`, fontWeight: tengo ? 700 : 500 }}>{v.icono} {v.corta}</span>;
}
const rangoTxt = it => (it.min == null ? "" : it.min === it.max ? fmtUSD(it.min) : `${fmtUSD(it.min)}–${fmtUSD(it.max)}`);

function TarjetaImpresion({ it, datos, own, view, abrirRef }) {
  const c = it.c, ownSet = new Set(own ? own.split(",") : []);
  const cons = ownSet.size > 0, nTengo = it.vs.filter(v => ownSet.has(v.key)).length;
  const tam = TAMANOS.find(t => t[0] === view), grande = view === "L" || view === "XL";
  const color = cons ? "#2e7d52" : "#e53935";
  const abrir = () => abrirRef.current(it);
  const multi = it.vs.length > 1;
  if (view === "lista") return (
    <div data-t="carta" onClick={abrir} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer" }}>
      <div style={{ width: 40, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}><ImagenCarta datos={datos} pid={it.rep.pid} alt={c.n} cons={cons} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...f, fontSize: 13, color: cons ? "#fff" : "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: cons ? 600 : 400 }}>{c.n}</div>
        <div style={{ ...f, fontSize: 10, color: "#555", marginBottom: 2 }}>{it.num ? `#${it.num}` : ""}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{it.vs.slice(0, 6).map(v => <Insignia key={v.key} v={v} tengo={ownSet.has(v.key)} px={8} />)}{it.vs.length > 6 && <span style={{ ...f, fontSize: 8, color: "#666" }}>+{it.vs.length - 6}</span>}</div>
      </div>
      {it.min != null && <div style={{ ...cv, fontSize: 14, fontWeight: 700, color: "#5c9cff", flexShrink: 0, textAlign: "right" }}>{rangoTxt(it)}</div>}
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${color}`, background: cons ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cons && <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>✓</span>}</div>
    </div>);
  const chico = view === "S";
  return (
    <div data-t="carta" onClick={abrir} style={{ position: "relative", cursor: "pointer", borderRadius: chico ? 6 : 9, overflow: "hidden", border: `2px solid ${color}`, boxShadow: `0 2px 8px ${cons ? "rgba(46,125,82,0.3)" : "rgba(229,57,53,0.3)"}`, background: "#111" }}>
      <ImagenCarta datos={datos} pid={it.rep.pid} alt={c.n} cons={cons} grande={grande} />
      {cons && <div style={{ position: "absolute", top: 3, right: 3, background: "#2e7d52", borderRadius: "50%", minWidth: chico ? 12 : 17, height: chico ? 12 : 17, padding: multi && !chico ? "0 4px" : 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: chico ? 7 : 9, fontWeight: 700 }}>{multi && !chico ? `${nTengo}/${it.vs.length}` : "✓"}</span></div>}
      {it.vs.some(v => v.esSello) && <div title="tiene variante de sello" style={{ position: "absolute", top: 3, left: 3, fontSize: chico ? 9 : 12, lineHeight: 1 }}>🏅</div>}
      <div style={{ background: "rgba(0,0,0,0.78)", padding: chico ? "2px 3px" : "4px 5px" }}>
        {grande && <div style={{ ...f, fontSize: view === "XL" ? 13 : 11, color: "#eee", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 2 }}>{c.n}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 4, alignItems: "baseline" }}>
          <span style={{ ...f, fontSize: chico ? 8 : 9, color: "#aac756", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.num || "·"}</span>
          {!chico && it.min != null && <span style={{ ...f, fontSize: grande ? 10 : 8, color: "#5c9cff", whiteSpace: "nowrap" }}>{rangoTxt(it)}</span>}
        </div>
        {chico ? (multi && <div style={{ ...f, fontSize: 7, color: "#888", textAlign: "center" }}>+{it.vs.length}</div>)
          : <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 3 }}>{it.vs.slice(0, view === "M" ? 3 : 8).map(v => <Insignia key={v.key} v={v} tengo={ownSet.has(v.key)} px={grande ? 9 : 7} />)}{it.vs.length > (view === "M" ? 3 : 8) && <span style={{ ...f, fontSize: 8, color: "#777" }}>+{it.vs.length - (view === "M" ? 3 : 8)}</span>}</div>}
      </div>
    </div>);
}
const TarjetaMem = React.memo(TarjetaImpresion, (x, y) => x.it === y.it && x.view === y.view && x.datos === y.datos && x.own === y.own);

function Detalle({ datos, col, carta, tile, filasCarta, lista, onIr, onCerrar, onMarca }) {
  const [rango, setRango] = useState("todo");
  const [sel, setSel] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [editar, setEditar] = useState(false);
  const [ed, setEd] = useState({});
  const propias = new Map(filasCarta.map(x => [x.tcgcsvKey, x]));
  const tiene = key => { const r = propias.get(key); return !!r && filaTiene(r); };
  const [selKey, setSelKey] = useState(() => (tile.vs.find(v => tiene(v.key)) || tile.rep).key);
  const v = tile.vs.find(x => x.key === selKey) || tile.vs[0];
  const fila = propias.get(v.key) || null, cons = !!fila && filaTiene(fila);
  const nTengo = tile.vs.filter(x => tiene(x.key)).length;
  const hist = fila ? historialConMensual(fila) : [];
  const idx = lista.findIndex(x => x.k === carta.k && x.setIdx === tile.setIdx && x.num === tile.num), nav = lista.length > 1;
  const { ath, athDate, atl, atlDate, vol, volLabel } = computeHistMetrics(hist, rango);
  const mult = multiploSobreBase(v, tile.vs);
  const flecha = (d, t) => <button onClick={e => { e.stopPropagation(); onIr(d); }} title={d < 0 ? "anterior" : "siguiente"} style={{ flex: "none", width: 30, height: 176, background: "rgba(255,255,255,0.09)", border: "none", borderRadius: 12, color: "#fff", fontSize: 26, cursor: "pointer" }}>{t}</button>;
  const btnAcc = (bg, color, extra) => ({ flex: 1, minWidth: 0, background: bg, border: bg === "transparent" ? "1px dashed #444" : "none", borderRadius: 10, padding: "10px 6px", ...f, fontSize: 12, color: color || "#fff", cursor: "pointer", ...extra });
  const deltas = hist.length >= 2 ? computeTimeframeDeltas(hist) : [];
  const celdas = hist.length >= 2 ? [
    { label: "ATH", txt: ath ? fmtUSD(parseFloat(ath)) : "—", color: ath ? "#4caf80" : "rgba(255,255,255,0.2)", sub: athDate ? fmtDateShort(athDate) : "" },
    { label: "ATL", txt: atl ? fmtUSD(parseFloat(atl)) : "—", color: atl ? "#e57373" : "rgba(255,255,255,0.2)", sub: atlDate ? fmtDateShort(atlDate) : "" },
    { label: `σ ${volLabel || ""}`, txt: vol ? `${vol}%` : "—", color: vol ? "#999" : "rgba(255,255,255,0.2)", sub: "" },
    ...deltas.map(d => ({ label: `${d.days}D`, txt: d.pct == null ? "—" : `${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}%`, color: d.pct == null ? "rgba(255,255,255,0.2)" : d.pct >= 0 ? "#4caf80" : "#e57373", sub: "" })),
  ] : [];
  const abrirEditar = () => { setEd({ cu: fila ? fila.costoUSD || "" : "", q: fila ? fila.cantidad || 1 : 1, nt: fila ? fila.notas || "" : "" }); setEditar(true); };
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
              <div onClick={() => setZoom(v.pid)} style={{ width: 126, height: 176, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#000", flex: "none" }}>
                <ImagenCarta datos={datos} pid={v.pid} alt={carta.n} cons={cons} grande style={{ width: "100%", height: "100%", aspectRatio: "auto", objectFit: "contain" }} />
              </div>
              {nav && flecha(1, "›")}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{carta.n}</div>
              <div style={{ ...f, fontSize: 10, color: "#777", lineHeight: 1.3 }}>{tile.num ? `#${tile.num} · ` : ""}{datos.sets[tile.setIdx] || ""} · {col.nombre}</div>
              <div><span style={{ ...f, fontSize: 9, background: nTengo ? "rgba(76,175,128,0.16)" : "#222", color: nTengo ? "#4caf80" : "#888", borderRadius: 20, padding: "2px 9px", fontWeight: 600 }}>{nTengo ? `conseguida · ${nTengo}/${tile.vs.length} variante${tile.vs.length > 1 ? "s" : ""}` : "falta"}</span></div>
              <div style={{ marginTop: 2 }}>
                <div style={lbl}>mercado · {v.etiqueta}</div>
                {v.market != null ? <div style={{ ...cv, fontSize: 28, fontWeight: 700, color: "#5c9cff", lineHeight: 1 }}>{fmtUSD(v.market)}</div> : <div style={{ ...f, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>sin precio aún</div>}
                {(v.low != null || v.high != null) && <div style={{ ...f, fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>rango {v.low != null ? fmtUSD(v.low) : "—"} – {v.high != null ? fmtUSD(v.high) : "—"}</div>}
                {mult != null && v.esSello && <div style={{ ...f, fontSize: 10, color: "#e6c229", marginTop: 2 }}>🏅 ×{mult} el precio de la base</div>}
              </div>
              <div style={{ ...f, fontSize: 11, color: "#aaa" }}>{cons && fila.costoUSD > 0 ? `pagué ${fmtUSD(fila.costoUSD)}` : ""}{cons && fila.cantidad > 1 ? ` · ×${fila.cantidad}` : ""}</div>
              {cons && fila.notas && <div style={{ ...cv, fontSize: 13, color: "rgba(255,255,255,0.5)", fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fila.notas}</div>}
            </div>
          </div>
          <div style={{ flex: "none" }}>
            <div style={{ ...lbl, marginBottom: 4 }}>variantes · {tile.vs.length}{tile.min != null && tile.max !== tile.min ? ` · ${fmtUSD(tile.min)} a ${fmtUSD(tile.max)}` : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tile.vs.map(x => {
                const on = selKey === x.key, mia = tiene(x.key), m = multiploSobreBase(x, tile.vs);
                return (
                  <div key={x.key} data-t="variante" data-key={x.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 9, background: on ? "#1d1d1d" : "#151515", border: `1px solid ${on ? x.color : "#1f1f1f"}` }}>
                    <button data-t="var-tengo" title={mia ? "la tengo: tocar para marcar que no" : "marcar que la tengo"} onClick={() => onMarca(x.key, { c: mia ? 0 : 1 })}
                      style={{ flex: "none", width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${mia ? "#2e7d52" : "#555"}`, background: mia ? "#2e7d52" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", padding: 0 }}>{mia ? "✓" : ""}</button>
                    <button data-t="var-sel" onClick={() => setSelKey(x.key)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                      <span style={{ ...f, fontSize: 11, color: x.color, fontWeight: 700 }}>{x.icono}</span>
                      <span style={{ ...f, fontSize: 11, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.etiqueta}</span>
                      {x.esSello && m != null && m >= 1.5 && <span style={{ ...f, fontSize: 9, color: "#e6c229" }}>×{m}</span>}
                    </button>
                    <span style={{ ...cv, fontSize: 15, fontWeight: 700, color: x.market != null ? "#5c9cff" : "#555" }}>{x.market != null ? fmtUSD(x.market) : "—"}</span>
                  </div>);
              })}
            </div>
          </div>
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
                <div style={{ ...lbl, letterSpacing: 2 }}>historial · {v.corta} · {hist.length}</div>
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
            <div style={{ flex: "1 1 120px", minHeight: 80, background: "#1a1a1a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", ...f, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 12 }}>
              {fila ? "el historial de esta variante aparece cuando haya al menos dos snapshots de precio" : "marca esta variante para empezar a registrar su historial de precios"}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flex: "none" }}>
            <button data-t="tengo" onClick={() => onMarca(v.key, { c: cons ? 0 : 1 })} style={btnAcc(cons ? "transparent" : "#2e7d52", cons ? "#999" : "#fff")}>{cons ? "↺ volver a hunting" : "✓ marcar conseguida"}</button>
            {cons && <button data-t="editar" onClick={abrirEditar} style={btnAcc("transparent", "#999")}>✎ editar</button>}
            {fila && <button data-t="quitar" onClick={() => { if (window.confirm(`¿Quitar ${v.etiqueta} de ${carta.n} de tu inventario?`)) onMarca(v.key, { c: 0, q: 0, cu: 0, nt: "" }); }} title="quitar del inventario" style={btnAcc("transparent", "#777", { flex: "none", padding: "10px 12px" })}>🗑</button>}
          </div>
        </div>
      </div>
    </div>
    {zoom != null && <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: "min(92vw,420px)" }}><ImagenCarta datos={datos} pid={zoom} alt={carta.n} cons grande style={{ borderRadius: 10, objectFit: "contain" }} /></div></div>}
    {editar && <div onClick={() => setEditar(false)} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "min(96vw,420px)", background: "#111", borderRadius: "16px 16px 0 0", padding: "22px 20px 28px", boxSizing: "border-box" }}>
        <BotonCerrar onClick={() => setEditar(false)} />
        <div style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 2 }}>✎ {carta.n}</div>
        <div style={{ ...f, fontSize: 10, color: v.color, marginBottom: 12 }}>{v.icono} {v.etiqueta}</div>
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
        <button data-t="guardar" onClick={() => { onMarca(v.key, { cu: parseFloat(ed.cu) || 0, q: ed.q || 1, nt: (ed.nt || "").trim() }); setEditar(false); }} style={{ width: "100%", background: "#aac756", border: "none", borderRadius: 10, padding: "11px", ...f, fontSize: 13, fontWeight: 700, color: "#111", cursor: "pointer" }}>guardar</button>
      </div>
    </div>}
  </>);
}

const sameFilas = (a, b) => a.datos === b.datos && a.col === b.col && a.filas === b.filas && a.juego === b.juego;
const VistaColeccion = React.memo(function VistaColeccion({ juego, datos, col, filas, saveInventario, onVolver }) {
  const rank = useMemo(() => rankSets(datos), [datos]);
  const [detalle, setDetalle] = useState(null);                // {k, setIdx, num, lista}
  const [view, setViewRaw] = useState(() => leerTamano(juego));
  const setView = v => { guardarTamano(juego, v); setViewRaw(v); };
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [panel, setPanel] = useState(false);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("todas");
  const [filtros, setFiltros] = useState({});
  const [filtroVar, setFiltroVar] = useState("");               // "" | "sello" | "multi"
  const [invertidos, setInvertidos] = useState(() => new Set());   // sets que el usuario abrió/cerró respecto del valor por defecto
  const [filtroSet, setFiltroSet] = useState("");
  const abrirRef = React.useRef(() => {});
  const marcar = (c, k, vkey, parche) => {
    // El bot se entera del cambio (fila nueva, modificada o quitada) para precearla y acumular su historial; sin conexión no pasa nada.
    const cambios = pendientesDeCambio(filas, aplicarMarca(filas, { juego, datos, col: c, k, vkey, parche, hoy: hoyISO() }));
    if (cambios.length) encolarPokecriptoPending(cambios);
    saveInventario(prev => aplicarMarca(prev || [], { juego, datos, col: c, k, vkey, parche, hoy: hoyISO() }));
  };

  const todas = useMemo(() => cartasDeColeccion(datos, col.id), [datos, col.id]);
  const filasCol = useMemo(() => filas.filter(x => x.carpeta === col.nombre), [filas, col.nombre]);
  const marcas = useMemo(() => marcasDeFilas(filas, juego, col.nombre), [filas, juego, col.nombre]);
  const r = useMemo(() => resumenFilas(todas, filasCol), [todas, filasCol]);
  const nF = cuentaFiltros(filtros);
  const propiasPorCarta = useMemo(() => { const m = new Map(); for (const x of filasCol) { const a = m.get(x.cardId) || []; a.push(x); m.set(x.cardId, a); } return m; }, [filasCol]);
  const kVis = useMemo(() => {
    let vis = filtrarCartas(todas, marcas, { texto, modo, filtros }, datos.sets);
    if (soloSinPrecio) vis = vis.filter(c => precioReferencia(c, null) == null);
    return new Set(vis.map(c => c.k));
  }, [todas, marcas, texto, modo, filtros, soloSinPrecio, datos]);
  // Una tarjeta = una impresión (set + número) de una carta, con TODAS sus variantes (rarezas, ediciones, acabados, patrones, sellos).
  // La misma carta aparece en cada set donde se imprimió (Magic Ruler, Invasion of Chaos…).
  const { grupos, indice } = useMemo(() => {
    const porSet = new Map(), indice = new Map();
    for (const c of todas) {
      const vistos = new Set();
      for (const v of c.v) {
        const clave = `${v[2]}|${v[3] || ""}`; if (vistos.has(clave)) continue; vistos.add(clave);
        const vs = variantesDeImpresion(datos, c, v[2], v[3] || "", juego);
        const precios = vs.map(x => x.market).filter(p => p != null);
        const rep = vs.find(x => !x.esSello && x.market != null) || vs.find(x => x.market != null) || vs[0];
        const it = { c, setIdx: v[2], num: v[3] || "", vs, rep, min: precios.length ? Math.min(...precios) : null, max: precios.length ? Math.max(...precios) : null };
        let g = porSet.get(v[2]); if (!g) { g = { setIdx: v[2], setName: datos.sets[v[2]] || "—", items: [] }; porSet.set(v[2], g); }
        g.items.push(it); indice.set(`${c.k}|${it.setIdx}|${it.num}`, it);
      }
    }
    for (const g of porSet.values()) g.items.sort((a, b) => numCmp(a.num, b.num) || a.c.n.localeCompare(b.c.n));
    return { grupos: [...porSet.values()].sort((a, b) => (rank[b.setIdx] ?? -1) - (rank[a.setIdx] ?? -1)), indice };
  }, [todas, datos, rank, juego]);
  const ownDe = it => { const mias = propiasPorCarta.get(it.c.k); if (!mias) return ""; const ks = new Set(mias.filter(filaTiene).map(x => x.tcgcsvKey)); return it.vs.filter(v => ks.has(v.key)).map(v => v.key).sort().join(","); };
  const resumenSet = g => {
    let conseg = 0, vTot = 0, vCons = 0;
    for (const it of g.items) {
      if (it.min != null) vTot += it.min;
      const mias = propiasPorCarta.get(it.c.k) || [];
      const keys = new Set(it.vs.map(v => v.key));
      const tengo = mias.filter(x => filaTiene(x) && keys.has(x.tcgcsvKey));
      if (tengo.length) { conseg++; for (const x of tengo) vCons += (x.tcgMarket || 0) * Math.max(1, x.cantidad || 1); }
    }
    return { conseg, total: g.items.length, vTot: Math.round(vTot * 100) / 100, vCons: Math.round(vCons * 100) / 100 };
  };
  const pasaVar = it => filtroVar === "sello" ? it.vs.some(v => v.esSello) : filtroVar === "multi" ? it.vs.length > 1 : true;
  let gruposVis = grupos.map(g => ({ ...g, vis: g.items.filter(it => kVis.has(it.c.k) && pasaVar(it)) })).filter(g => g.vis.length > 0);
  if (filtroSet !== "") gruposVis = gruposVis.filter(g => String(g.setIdx) === filtroSet);
  const totalItems = gruposVis.reduce((n, g) => n + g.vis.length, 0);
  const abiertoPorDefecto = totalItems <= 400;          // pocas impresiones: todo abierto; muchas: sets cerrados y se abren al tocar
  const abierto = g => abiertoPorDefecto !== invertidos.has(g.setIdx);
  const alternar = idx => setInvertidos(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  const lista = gruposVis.filter(abierto).flatMap(g => g.vis.map(it => ({ k: it.c.k, setIdx: it.setIdx, num: it.num })));
  abrirRef.current = it => setDetalle({ k: it.c.k, setIdx: it.setIdx, num: it.num, lista });
  const tam = TAMANOS.find(t => t[0] === view);
  const gridCols = tam ? `repeat(auto-fill,minmax(${tam[2]}px,1fr))` : null, gap = tam ? tam[3] : 0;
  const detCarta = detalle ? cartaDe(datos, detalle.k) : null;
  const detTile = detalle ? indice.get(`${detalle.k}|${detalle.setIdx}|${detalle.num}`) : null;
  const irA = d => { const i = detalle.lista.findIndex(x => x.k === detalle.k && x.setIdx === detalle.setIdx && x.num === detalle.num); const j = i + d; if (j >= 0 && j < detalle.lista.length) setDetalle({ ...detalle, ...detalle.lista[j] }); };
  const hayFiltros = nF > 0 || !!texto || modo !== "todas" || filtroSet !== "" || filtroVar !== "";
  const nSellos = useMemo(() => grupos.reduce((n, g) => n + g.items.filter(it => it.vs.some(v => v.esSello)).length, 0), [grupos]);
  return (
    <MarcoPoke>
      {detCarta && detTile && <Detalle key={`${detalle.k}|${detalle.setIdx}|${detalle.num}`} datos={datos} col={col} carta={detCarta} tile={detTile} filasCarta={propiasPorCarta.get(detCarta.k) || []} lista={detalle.lista} onIr={irA} onCerrar={() => setDetalle(null)} onMarca={(vkey, p) => marcar(col, detCarta.k, vkey, p)} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onVolver} style={{ background: "transparent", border: "none", fontSize: 20, color: "#444", cursor: "pointer", padding: 0 }}>←</button>
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
        <div style={{ width: 1, background: "#222", flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 6, alignContent: "center", justifyContent: "center" }}>
          {r.sinPrecio > 0 && <ChipHerramienta activo={soloSinPrecio} onClick={() => setSoloSinPrecio(v => !v)} title={soloSinPrecio ? "mostrando solo sin precio" : "filtrar sin precio"}>{soloSinPrecio ? "✕" : "🔍"} {r.sinPrecio}</ChipHerramienta>}
          {nSellos > 0 && <ChipHerramienta activo={filtroVar === "sello"} onClick={() => setFiltroVar(v => (v === "sello" ? "" : "sello"))} title="solo cartas con variante de sello (liga, prerelease, campeonato…)">🏅 {nSellos}</ChipHerramienta>}
          <ChipHerramienta activo={panel || hayFiltros} onClick={() => setPanel(v => !v)} title="buscar, filtrar y elegir set">🔎{nF ? ` ${nF}` : ""}</ChipHerramienta>
        </div>
      </div>
      {panel && <div style={{ background: "#121212", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="buscar por nombre, número, edición…" style={{ width: "100%", boxSizing: "border-box", background: "#151515", border: "1px solid #262626", borderRadius: 8, color: "#fff", padding: "8px 10px", fontSize: 12, marginBottom: 8 }} />
        <div style={{ ...f, fontSize: 9, color: "#666", marginBottom: 3 }}>Set ({grupos.length})</div>
        <select data-t="filtro-set" value={filtroSet} onChange={e => setFiltroSet(e.target.value)} style={{ width: "100%", background: "#151515", color: "#ddd", border: "1px solid #262626", borderRadius: 8, padding: "6px 8px", fontSize: 11, marginBottom: 8 }}>
          <option value="">todos los sets</option>{grupos.map(g => <option key={g.setIdx} value={String(g.setIdx)}>{g.setName} ({g.items.length})</option>)}
        </select>
        <div style={{ ...f, fontSize: 9, color: "#666", marginBottom: 3 }}>Variantes</div>
        <select data-t="filtro-var" value={filtroVar} onChange={e => setFiltroVar(e.target.value)} style={{ width: "100%", background: "#151515", color: "#ddd", border: "1px solid #262626", borderRadius: 8, padding: "6px 8px", fontSize: 11, marginBottom: 8 }}>
          <option value="">todas las cartas</option><option value="multi">con más de una variante</option><option value="sello">con variante de sello (liga, prerelease, campeonato…)</option>
        </select>
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
        {hayFiltros && <button onClick={() => { setFiltros({}); setTexto(""); setModo("todas"); setFiltroSet(""); setFiltroVar(""); }} style={{ background: "transparent", border: "none", color: "#e57373", ...f, fontSize: 11, cursor: "pointer", padding: 0 }}>limpiar</button>}
      </div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...f, fontSize: 9, color: "#555" }}>caras</span>
        {TAMANOS.map(([v, l]) => (
          <button key={v} data-view={v} onClick={() => setView(v)} title={`caras ${l}`} style={{ padding: "5px 9px", background: view === v ? "#fff" : "transparent", color: view === v ? "#111" : "#555", border: "1px solid", borderColor: view === v ? "#fff" : "#333", borderRadius: 8, cursor: "pointer", ...f, fontSize: 11, fontWeight: 600 }}>{l}</button>))}
        <button data-view="lista" onClick={() => setView("lista")} title="lista" style={{ padding: "5px 9px", background: view === "lista" ? "#fff" : "transparent", color: view === "lista" ? "#111" : "#555", border: "1px solid", borderColor: view === "lista" ? "#fff" : "#333", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>≡</button>
        <span style={{ marginLeft: "auto", ...f, fontSize: 10, color: "#444" }}>{kVis.size} carta(s) · {gruposVis.length} set(s)</span>
      </div>
      {gruposVis.map(g => {
        const rs = resumenSet(g), open = abierto(g);
        return (
          <div key={g.setIdx} data-t="set" style={{ marginBottom: open ? 20 : 10 }}>
            <div data-t="set-cab" onClick={() => alternar(g.setIdx)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 6, cursor: "pointer" }}>
              <div style={{ ...cv, fontSize: 17, fontWeight: 700, color: "#fff", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ ...f, color: "#555", fontSize: 11 }}>{open ? "▾" : "▸"}</span> {g.setName} <span style={{ ...f, fontSize: 9, color: "#555" }}>({g.vis.length})</span></div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {rs.total > 0 && rs.conseg === rs.total && <div style={{ ...f, fontSize: 11, fontWeight: 700, color: "#d4af37" }}>¡completada!</div>}
                <div style={{ ...f, fontSize: 9, color: "#666", marginTop: 1 }}>{rs.conseg}/{rs.total}{rs.vTot > 0 ? ` · ${fmtUSD(rs.vCons)} / ${fmtUSD(rs.vTot)}` : ""}</div>
              </div>
            </div>
            <BarraSet conseguidas={rs.conseg} total={rs.total} />
            {open && (view === "lista" ? <div>{g.vis.map(it => <TarjetaMem key={it.c.k + "|" + it.num} it={it} datos={datos} own={ownDe(it)} view={view} abrirRef={abrirRef} />)}</div>
              : <div style={{ display: "grid", gridTemplateColumns: gridCols, gap }}>{g.vis.map(it => <TarjetaMem key={it.c.k + "|" + it.num} it={it} datos={datos} own={ownDe(it)} view={view} abrirRef={abrirRef} />)}</div>)}
          </div>);
      })}
      {gruposVis.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", ...cv, fontSize: 16, color: "#333" }}>no hay cartas con ese filtro</div>}
      <div style={{ height: 40 }} />
    </MarcoPoke>
  );
}, sameFilas);

export default function PokecriptoJuego({ juego, inventario, saveInventario, onSalir }) {
  const info = JUEGOS.find(j => j.id === juego);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState({ t: "menu" });          // menu | col {colId}
  const filas = useMemo(() => (inventario || []).filter(x => juegoDe(x) === juego), [inventario, juego]);

  useEffect(() => {
    let vivo = true; setDatos(null); setError(null); setVista({ t: "menu" });
    fetchTcgCryptoData(juego).then(d => { if (vivo) setDatos(d); }).catch(e => { if (vivo) setError(e.message || "error"); });
    return () => { vivo = false; };
  }, [juego]);
  // Con el catálogo del día se repreciean las filas de este juego (sin consultas a ninguna API) y se guarda solo si cambió algo.
  useEffect(() => {
    if (!datos) return;
    saveInventario(prev => { const r = actualizarPreciosFilas(prev || [], { [juego]: datos }, hoyISO()); return r.cambiadas ? r.filas : prev; });
  }, [datos]);

  const cols = datos ? datos.colecciones : [];
  const col = vista.colId && datos ? cols.find(c => c.id === vista.colId) : null;
  const resumenes = useMemo(() => (datos ? cols.map(c => ({ c, r: resumenFilas(cartasDeColeccion(datos, c.id), filas.filter(x => x.carpeta === c.nombre)) })) : []), [datos, filas]);

  if (error) return <MarcoPoke><div style={{ ...f, color: "#e57373", fontSize: 12 }}>No pude cargar el catálogo de {info.nombre}: {error}</div></MarcoPoke>;
  if (!datos) return <MarcoPoke><div style={{ ...f, color: "#666", fontSize: 12 }}>cargando catálogo de {info.nombre}…</div></MarcoPoke>;

  // ── Colección ─────────────────────────────────────────────────────────────
  if (col) return <VistaColeccion key={col.id} juego={juego} datos={datos} col={col} filas={filas} saveInventario={saveInventario} onVolver={() => setVista({ t: "menu" })} />;

  // ── Menú de colecciones (igual al «🗂️ Colecciones» de Pokémon) ────────────
  let total = 0, tengo = 0, vTot = 0, vCons = 0;
  for (const { r } of resumenes) { total += r.total; tengo += r.conseguidas; vTot += r.valorTotal; vCons += r.valorConseguido; }
  const pct = total ? Math.floor(tengo / total * 100) : 0;
  return (
    <MarcoPoke>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {onSalir && <button data-t="salir" onClick={onSalir} style={{ background: "transparent", border: "none", fontSize: 20, color: "#bbb", cursor: "pointer", padding: 0 }}>←</button>}
        <div style={{ flex: 1, ...cv, fontSize: 22, fontWeight: 700, color: "#fff" }}>🗂️ Colecciones</div>
        {total > 0 && <div style={{ textAlign: "right" }}><div style={{ ...cv, fontSize: 20, fontWeight: 700, color: "#aac756" }}>{tengo}/{total}</div><div style={{ ...f, fontSize: 9, color: "#444" }}>{pct}% completado</div></div>}
      </div>
      {total > 0 && <div style={{ height: 3, background: "#1a1a1a", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}><div style={{ height: "100%", width: `${tengo / total * 100}%`, background: "#2e7d52", borderRadius: 99 }} /></div>}
      {vTot > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#151515", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
        <div><div style={{ ...f, fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>valor conseguido / total</div>
          <div style={{ ...cv, fontSize: 17, fontWeight: 700, color: "#fff" }}>{fmtUSD(vCons)} <span style={{ color: "#555", fontSize: 14 }}>/ {fmtUSD(vTot)}</span></div></div>
        <div style={{ ...f, fontSize: 13, fontWeight: 700, color: "#aac756" }}>{Math.round(vCons / vTot * 100)}% del valor</div>
      </div>}
      {resumenes.map(({ c, r }) => (
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
