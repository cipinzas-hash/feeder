// Otros juegos dentro de Pokécripto (multi-juego, 17-nov-2026). Misma estructura de datos que Pokécripto (inventario de
// ejemplares con carpeta, estado, costo, historial de precios), catálogo virtual de tcgcsv (JSON de tcgcrypto) y la
// lógica de filtros/versiones ya probada en tcgcrypto. Una fila existe solo si marcas la carta; ver lib/juegos.mjs.
import { fetchTcgCryptoData } from "../shared/catalog.js";
import { MarcoPoke, PriceChartFill, TimeframeDeltas, fmtUSD } from "./PokecriptoPage.jsx";
import {
  JUEGOS, juegoDe, idFila, filaTiene, marcaDeFila, marcasDeFilas, aplicarMarca, actualizarPreciosFilas, cartaDe,
} from "./lib/juegos.mjs";
import {
  claveVersion, precioVersion, versionElegida, precioReferencia, cartasDeColeccion, resumenColeccion, tramoBarra, filtrarCartas,
  usd, etiquetaVersion, urlImagen, rankSets, versionReferencia, valoresFiltro, cuentaFiltros, edadDatos,
} from "../tcgcrypto/logica.js";

const { useState, useEffect, useMemo } = React;
const F = { fontFamily: "'DM Sans',sans-serif" }, C = { fontFamily: "'Caveat',cursive" };
const PAGINA = 60;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const btn = { border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" };
const chip = on => ({ ...btn, padding: "6px 11px", borderRadius: 14, fontSize: 11, background: on ? "#2a2a2a" : "#151515", color: on ? "#fff" : "#777", border: on ? "1px solid #3a3a3a" : "1px solid #202020" });

function Barra({ pct }) {
  const t = tramoBarra(pct);
  return <div style={{ height: 3, background: "#1a1a1a", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: t.color, borderRadius: 99 }} /></div>;
}

function Ficha({ juego, datos, col, carta, fila, onVolver, onMarca }) {
  const rank = useMemo(() => rankSets(datos), [datos]);
  const marca = marcaDeFila(fila) || {};
  const el = versionElegida(carta, marca);
  const ref = versionReferencia(carta, marca, rank) || carta.v[0];
  const versiones = useMemo(() => [...carta.v].sort((a, b) => (rank[b[2]] ?? -1) - (rank[a[2]] ?? -1) || String(a[1]).localeCompare(String(b[1]))), [carta, rank]);
  const tiene = !!marca.c;
  const hist = (fila && fila.priceHistory) || [];
  return (
    <MarcoPoke>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onVolver} style={{ ...btn, background: "transparent", fontSize: 20, color: "#444", padding: 0 }}>←</button>
        <div style={{ flex: 1, ...C, fontSize: 20, fontWeight: 700, color: "#fff" }}>{carta.n}</div>
        <div style={{ ...F, fontSize: 10, color: "#666" }}>{col.emoji} {col.nombre}</div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <img src={urlImagen(datos.imgTpl, ref[0], 200)} alt={carta.n} loading="lazy" style={{ width: 96, borderRadius: 6, background: "#151515", alignSelf: "flex-start" }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...F, fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: 1, textTransform: "uppercase" }}>{el ? "versión elegida" : "sin elegir · la más barata"}</div>
          <div style={{ ...C, fontSize: 26, fontWeight: 700, color: "#aac756" }}>{usd(precioReferencia(carta, marca))}</div>
          <div style={{ ...F, fontSize: 10, color: "#666", marginBottom: 8 }}>{etiquetaVersion(ref, datos.sets)}</div>
          <button data-t="tengo" onClick={() => onMarca({ c: tiene ? 0 : 1 })} style={{ ...btn, padding: "8px 14px", borderRadius: 10, fontSize: 12, background: tiene ? "#2e7d52" : "#1c1c1c", color: "#fff" }}>{tiene ? "✓ la tengo" : "marcar como tengo"}</button>
        </div>
      </div>
      {tiene && <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", ...F, fontSize: 11, color: "#888" }}>
        <span>cantidad</span>
        <button onClick={() => onMarca({ q: Math.max(1, (marca.q || 1) - 1) })} style={{ ...btn, width: 28, height: 28, borderRadius: 8, background: "#1c1c1c", color: "#fff" }}>−</button>
        <span style={{ color: "#fff", minWidth: 16, textAlign: "center" }}>{marca.q || 1}</span>
        <button onClick={() => onMarca({ q: (marca.q || 1) + 1 })} style={{ ...btn, width: 28, height: 28, borderRadius: 8, background: "#1c1c1c", color: "#fff" }}>+</button>
        <span style={{ marginLeft: 8 }}>costo US$</span>
        <input defaultValue={marca.cu || ""} inputMode="decimal" onBlur={e => onMarca({ cu: parseFloat(e.target.value) || 0 })} style={{ width: 60, background: "#151515", border: "1px solid #262626", borderRadius: 8, color: "#fff", padding: "5px 7px", fontSize: 12 }} />
      </div>}
      <div style={{ ...F, fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>versión / edición ({carta.v.length})</div>
      {versiones.map(v => {
        const sel = el && claveVersion(el) === claveVersion(v), p = precioVersion(v);
        return (
          <button key={claveVersion(v)} data-t="version" onClick={() => onMarca({ e: sel ? null : claveVersion(v) })}
            style={{ ...btn, display: "flex", alignItems: "center", width: "100%", gap: 8, padding: "9px 10px", marginBottom: 4, borderRadius: 9, textAlign: "left", background: sel ? "#1d2a1d" : "#151515", border: sel ? "1px solid #2e7d52" : "1px solid #1c1c1c", color: "#ddd", fontSize: 11 }}>
            <span style={{ flex: 1 }}>{etiquetaVersion(v, datos.sets)}</span>
            <span style={{ color: p == null ? "#555" : "#aac756", fontWeight: 700 }}>{usd(p)}</span>
          </button>);
      })}
      {fila && hist.length > 0 && <>
        <div style={{ ...F, fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: 1, textTransform: "uppercase", margin: "14px 0 6px" }}>historial de precios</div>
        <TimeframeDeltas history={hist} dark />
        <div style={{ position: "relative", height: 150, marginBottom: 8 }}><PriceChartFill history={hist} range="todo" /></div>
      </>}
      {tiene && <textarea defaultValue={marca.nt || ""} placeholder="notas" onBlur={e => onMarca({ nt: e.target.value.trim() })} style={{ width: "100%", boxSizing: "border-box", minHeight: 54, background: "#151515", border: "1px solid #262626", borderRadius: 8, color: "#fff", padding: 8, fontSize: 12, marginTop: 8 }} />}
      <div style={{ height: 32 }} />
    </MarcoPoke>
  );
}

export default function PokecriptoJuego({ juego, inventario, saveInventario }) {
  const info = JUEGOS.find(j => j.id === juego);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState({ t: "home" });     // home | col {colId} | ficha {colId,k}
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("todas");
  const [filtros, setFiltros] = useState({});
  const [panel, setPanel] = useState(false);
  const [limite, setLimite] = useState(PAGINA);
  const filas = useMemo(() => (inventario || []).filter(f => juegoDe(f) === juego), [inventario, juego]);

  useEffect(() => {
    let vivo = true; setDatos(null); setError(null); setVista({ t: "home" }); setTexto(""); setModo("todas"); setFiltros({}); setPanel(false);
    fetchTcgCryptoData(juego).then(d => { if (vivo) setDatos(d); }).catch(e => { if (vivo) setError(e.message || "error"); });
    return () => { vivo = false; };
  }, [juego]);
  // Con el catálogo del día, repreciar las filas de este juego (sin consultas a ninguna API) y guardar solo si algo cambió.
  useEffect(() => {
    if (!datos) return;
    saveInventario(prev => { const r = actualizarPreciosFilas(prev || [], { [juego]: datos }, hoyISO()); return r.cambiadas ? r.filas : prev; });
  }, [datos]);
  useEffect(() => { setLimite(PAGINA); }, [vista.colId, texto, modo, filtros]);

  const marcar = (col, k, parche) => saveInventario(prev => aplicarMarca(prev || [], { juego, datos, col, k, parche, hoy: hoyISO() }));
  const cols = datos ? datos.colecciones : [];
  const col = vista.colId ? cols.find(c => c.id === vista.colId) : null;

  if (error) return <MarcoPoke><div style={{ ...F, color: "#e57373", fontSize: 12 }}>No pude cargar el catálogo de {info.nombre}: {error}</div></MarcoPoke>;
  if (!datos) return <MarcoPoke><div style={{ ...F, color: "#666", fontSize: 12 }}>cargando catálogo de {info.nombre}…</div></MarcoPoke>;

  if (vista.t === "ficha" && col) {
    const carta = cartaDe(datos, vista.k);
    const fila = filas.find(f => f.id === idFila(juego, col.id, vista.k)) || null;
    if (carta) return <Ficha juego={juego} datos={datos} col={col} carta={carta} fila={fila} onVolver={() => setVista({ t: "col", colId: col.id })} onMarca={p => marcar(col, carta.k, p)} />;
  }

  if (vista.t === "col" && col) {
    const todas = cartasDeColeccion(datos, col.id);
    const marcas = marcasDeFilas(filas, juego, col.nombre);
    const r = resumenColeccion(todas, marcas);
    const lista = filtrarCartas(todas, marcas, { texto, modo, filtros }, datos.sets);
    const nF = cuentaFiltros(filtros);
    return (
      <MarcoPoke>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={() => setVista({ t: "home" })} style={{ ...btn, background: "transparent", fontSize: 20, color: "#444", padding: 0 }}>←</button>
          <div style={{ flex: 1, ...C, fontSize: 22, fontWeight: 700, color: "#fff" }}>{col.emoji} {col.nombre}</div>
          <div style={{ textAlign: "right" }}><div style={{ ...C, fontSize: 18, fontWeight: 700, color: "#aac756" }}>{r.conseguidas}/{r.total}</div><div style={{ ...F, fontSize: 9, color: "#555" }}>{r.pct}% completado</div></div>
        </div>
        <Barra pct={r.pct} />
        <div style={{ ...F, fontSize: 10, color: "#666", margin: "6px 0 10px" }}>{fmtUSD(r.valorConseguido)} de {fmtUSD(r.valorTotal)} · {col.criterio}</div>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="🔍 buscar por nombre, número, edición…" style={{ width: "100%", boxSizing: "border-box", background: "#151515", border: "1px solid #262626", borderRadius: 10, color: "#fff", padding: "9px 11px", fontSize: 12, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {[["todas", "todas"], ["faltan", "me faltan"], ["tengo", "las tengo"]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={chip(modo === k)}>{l}</button>)}
          <button onClick={() => setPanel(!panel)} style={chip(panel || nF > 0)}>filtros{nF ? ` (${nF})` : ""}</button>
        </div>
        {panel && <div style={{ background: "#121212", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          {(datos.filtros || []).map(fl => {
            const vals = valoresFiltro(todas, fl.id);
            return <div key={fl.id} style={{ marginBottom: 6 }}>
              <div style={{ ...F, fontSize: 9, color: "#666", marginBottom: 3 }}>{fl.nombre || fl.id}</div>
              <select value={(filtros[fl.id] || [])[0] || ""} onChange={e => setFiltros(p => { const n = { ...p }; if (e.target.value) n[fl.id] = [e.target.value]; else delete n[fl.id]; return n; })} style={{ width: "100%", background: "#151515", color: "#ddd", border: "1px solid #262626", borderRadius: 8, padding: "6px 8px", fontSize: 11 }}>
                <option value="">todos</option>{vals.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>;
          })}
          {nF > 0 && <button onClick={() => setFiltros({})} style={{ ...btn, background: "transparent", color: "#e57373", fontSize: 11 }}>limpiar filtros</button>}
        </div>}
        <div style={{ ...F, fontSize: 10, color: "#555", marginBottom: 6 }}>{lista.length} carta(s)</div>
        {lista.slice(0, limite).map(c => {
          const m = marcas[c.k] || null, tiene = !!(m && m.c), p = precioReferencia(c, m);
          return (
            <button key={c.k} data-t="carta" onClick={() => setVista({ t: "ficha", colId: col.id, k: c.k })}
              style={{ ...btn, display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#151515", borderRadius: 10, padding: "8px 10px", marginBottom: 6, textAlign: "left" }}>
              <img src={urlImagen(datos.imgTpl, (versionReferencia(c, m, rankSets(datos)) || c.v[0])[0], 200)} alt="" loading="lazy" style={{ width: 34, height: 48, objectFit: "cover", borderRadius: 4, background: "#0d0d0d", opacity: tiene ? 1 : 0.55 }} />
              <div style={{ flex: 1, ...C, fontSize: 15, color: tiene ? "#fff" : "#999" }}>{c.n}{m && m.q > 1 ? ` ×${m.q}` : ""}</div>
              <div style={{ ...F, fontSize: 11, color: tiene ? "#aac756" : "#666" }}>{tiene ? "✓ " : ""}{usd(p)}</div>
            </button>);
        })}
        {lista.length > limite && <button onClick={() => setLimite(limite + PAGINA)} style={{ ...btn, width: "100%", padding: 10, borderRadius: 10, background: "#1c1c1c", color: "#aaa", fontSize: 12 }}>ver más ({lista.length - limite})</button>}
        <div style={{ height: 32 }} />
      </MarcoPoke>
    );
  }

  // Inicio del juego: totales y colecciones con su avance
  let total = 0, tengo = 0, vTot = 0, vCons = 0;
  const filasCol = cols.map(c => {
    const cs = cartasDeColeccion(datos, c.id), r = resumenColeccion(cs, marcasDeFilas(filas, juego, c.nombre));
    total += r.total; tengo += r.conseguidas; vTot += r.valorTotal; vCons += r.valorConseguido;
    return { c, r };
  });
  const edad = edadDatos(datos.generatedAt, Date.now());
  return (
    <MarcoPoke>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, ...C, fontSize: 22, fontWeight: 700, color: "#fff" }}>{info.emoji} {info.nombre}</div>
        <div style={{ textAlign: "right" }}><div style={{ ...C, fontSize: 20, fontWeight: 700, color: "#aac756" }}>{tengo}/{total}</div><div style={{ ...F, fontSize: 9, color: "#555" }}>{total ? Math.floor(tengo / total * 100) : 0}% completado</div></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#151515", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
        <div><div style={{ ...F, fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: 1, textTransform: "uppercase" }}>valor conseguido / total</div>
          <div style={{ ...C, fontSize: 17, fontWeight: 700, color: "#fff" }}>{fmtUSD(vCons)} <span style={{ color: "#555", fontSize: 14 }}>/ {fmtUSD(vTot)}</span></div></div>
        <div style={{ ...F, fontSize: 11, color: "#666" }}>{filas.length} ficha(s) · precios {edad && edad.texto ? edad.texto : "del día"}</div>
      </div>
      {filasCol.map(({ c, r }) => (
        <button key={c.id} data-t="coleccion" onClick={() => setVista({ t: "col", colId: c.id })}
          style={{ ...btn, display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#151515", borderRadius: 10, padding: "12px 14px", marginBottom: 8, textAlign: "left" }}>
          <div style={{ fontSize: 20 }}>{c.emoji}</div>
          <div style={{ flex: 1 }}><div style={{ ...C, fontSize: 16, color: "#fff" }}>{c.nombre}</div><div style={{ marginTop: 5 }}><Barra pct={r.pct} /></div></div>
          <div style={{ textAlign: "right" }}><div style={{ ...F, fontSize: 11, color: "#aac756" }}>{r.conseguidas}/{r.total} · {r.pct}%</div><div style={{ ...F, fontSize: 9, color: "#666", marginTop: 2 }}>{fmtUSD(r.valorConseguido)} / {fmtUSD(r.valorTotal)}</div></div>
        </button>))}
      <div style={{ height: 32 }} />
    </MarcoPoke>
  );
}
