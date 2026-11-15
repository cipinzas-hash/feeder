import { fetchTcgCryptoData } from "../shared/catalog.js";
import { useEstado, elegirTcg, elegirVista, marcaDe, ponerMarca } from "./estado.js";
import {
  claveVersion, precioVersion, versionElegida, precioReferencia, tieneCarta, cartasDeColeccion,
  resumenColeccion, tramoBarra, filtrarCartas, usd, etiquetaVersion, urlImagen, urlImagenGrande, edadDatos,
  rankSets, versionReferencia, agruparPorEdicion, valoresFiltro, cuentaFiltros,
} from "./logica.js";

const { useState, useEffect, useRef, useMemo } = React;

// ─── Módulo tcgcrypto (nov-2026, issue #42) ─────────────────────────────────────────────────────────────────────────
// Pokécripto para otros TCGs: selector de juego + las mismas colecciones, con carta conseguida (marco verde) o por
// conseguir (marco rojo), completitud con barra por tramos y valor actual/total. Por ahora Yu-Gi-Oh! y Digimon;
// Pokémon sigue en su módulo hasta el merge.
//
// Lineamiento (docs/angst-lineamiento-y-handoff.md §4):
//  · N1: montado sobre el marco `.app-fit` de core/App.jsx (clases .tcgc / .tcgc-body). No se mide la pantalla.
//  · N2: franja de estado arriba (selector de TCG + antigüedad de los datos) + filas-colección que se expanden en
//    línea y de a una + ficha de carta como estado expandido (formularios inline, sin ventanas emergentes).
//  · N3: colapsado sin scroll (solo las filas de colección y el resumen); el scroll interno nace al expandir o abrir ficha.
//  · R6: sin título propio. R7: Caveat + DM Sans, emojis como iconos, fondo oscuro.
//
// Vistas de cada colección: "Por edición" (grupos por set, el más reciente primero, con su avance) y "A–Z". Filtros de
// biblioteca (tipo, categoría, atributo, nivel…) según lo que declare cada juego. Imagen a pantalla completa con ×,
// datos bajo la carta y flechas, como en Pokécripto.
//
// Datos REALES (tcgcrypto-<juego>.json, lo arma build-tcgcrypto.mjs una vez al día): catálogo y precios de TCGplayer
// por set y versión. Persistencia: estado.js (qué cartas tenés, versión elegida, cantidad, costo y notas).

const FUENTE = "'DM Sans',sans-serif";
const CAVEAT = "'Caveat',cursive";
const ROJO = "#e5383b";
const VERDE = "#4caf50";
const FONDO = "radial-gradient(120% 45% at 15% 20%,rgba(229,56,59,.18),rgba(229,56,59,0) 62%),radial-gradient(110% 40% at 95% 80%,rgba(255,255,255,.06),rgba(255,255,255,0) 60%),#0b0b0c";
const TCGS = [{ id: "yugioh", emoji: "🃏", nombre: "Yu-Gi-Oh!" }, { id: "digimon", emoji: "🐉", nombre: "Digimon" }];
const PAGINA = 40;

const reset = { background: "none", border: 0, padding: 0, color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", cursor: "pointer" };
const botonPri = { minHeight: 44, padding: "0 16px", borderRadius: 8, background: "#fff", color: "#0b0b0c", border: 0, fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const botonSec = { minHeight: 44, padding: "0 16px", borderRadius: 8, background: "transparent", color: "#eaeaea", border: "1px solid #4a4a50", fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const sello = { flex: "none", fontFamily: FUENTE, fontSize: 10, letterSpacing: "0.1em", border: "1px solid #6a6a70", borderRadius: 4, padding: "2px 6px", color: "#b5b5bb" };
const campo = { boxSizing: "border-box", width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 8, background: "#141417", color: "#fff", border: "1px solid #3a3a40", fontFamily: FUENTE, fontSize: 14 };

function Barra({ pct }) {
  const t = tramoBarra(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#26262b", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: t.color }} />
      </div>
      <span style={{ flex: "none", minWidth: 34, textAlign: "right", fontFamily: FUENTE, fontSize: 12, color: t.color }}>{t.texto || `${pct}%`}</span>
    </div>
  );
}

function Miniatura({ tpl, pid, ancho, alto }) {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [pid]);
  return (
    <span aria-hidden="true" style={{ flex: "none", width: ancho, height: alto, borderRadius: 4, background: "#1b1b1f", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
      {pid && ok ? <img src={urlImagen(tpl, pid)} alt="" loading="lazy" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🂠"}
    </span>
  );
}

function FilaColeccion({ col, r, abierta, onClick }) {
  return (
    <button onClick={onClick} aria-expanded={abierta ? "true" : "false"}
      style={{ ...reset, flex: "none", display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box", textAlign: "left", padding: "12px 14px", borderRadius: 10, background: abierta ? "#17171a" : "#111114", border: `1px solid ${abierta ? "#4a4a50" : "#232328"}`, color: "#fff", fontFamily: FUENTE }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden="true" style={{ fontSize: 22 }}>{col.emoji}</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: CAVEAT, fontWeight: 600, fontSize: 24, lineHeight: 1 }}>{col.nombre}</span>
        <span style={{ fontSize: 12, color: "#b5b5bb" }}>{r.conseguidas}/{r.total}</span>
      </span>
      <Barra pct={r.pct} />
      <span style={{ fontSize: 12, color: "#9a9aa0" }}>{usd(r.valorConseguido)} de {usd(r.valorTotal)}{r.sinPrecio ? ` · ${r.sinPrecio} sin precio` : ""}</span>
    </button>
  );
}

function FilaCarta({ c, marca, datos, rank, onClick, onZoom }) {
  const tiene = tieneCarta(marca);
  const el = versionElegida(c, marca);
  const ref = versionReferencia(c, marca, rank) || c.v[0];
  const precio = precioReferencia(c, marca);
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, width: "100%", boxSizing: "border-box", padding: "4px 10px 4px 4px", borderRadius: 8, background: "#111114", border: `2px solid ${tiene ? VERDE : ROJO}`, color: "#fff", fontFamily: FUENTE }}>
      <button aria-label={`ver imagen de ${c.n}`} onClick={onZoom} style={{ ...reset, flex: "none", width: 44, minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Miniatura tpl={datos.imgTpl} pid={ref && ref[0]} ancho={36} alto={50} />
      </button>
      <button onClick={onClick} style={{ ...reset, flex: 1, minWidth: 0, minHeight: 56, display: "flex", alignItems: "center", gap: 10, textAlign: "left", color: "#fff", fontFamily: FUENTE }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.n}</span>
          <span style={{ fontSize: 11, color: "#9a9aa0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {el ? etiquetaVersion(el, datos.sets) : `${c.v.length} ${c.v.length === 1 ? "versión" : "versiones"}`}
          </span>
        </span>
        <span style={{ flex: "none", fontSize: 13, color: precio == null ? "#6a6a70" : "#eaeaea" }}>{el || datos.agrupar === "producto" ? usd(precio) : `desde ${usd(precio)}`}</span>
      </button>
    </div>
  );
}

// Pantalla completa de la ilustración (mismo diseño que Pokécripto): × arriba a la derecha, la carta, sus datos debajo
// y flechas para recorrer la lista. `items` = [{ pid, titulo, sub, precio, extra }].
function Zoom({ zoom, datos, onIdx, onCerrar }) {
  const { items, idx } = zoom;
  const it = items[idx];
  const [falla, setFalla] = useState(false);
  useEffect(() => { setFalla(false); }, [it && it.pid]);
  useEffect(() => {
    const k = e => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (!it) return null;
  const nav = items.length > 1;
  const ir = d => onIdx((idx + d + items.length) % items.length);
  const flecha = (lado, d, txt) => (
    <button aria-label={d < 0 ? "anterior" : "siguiente"} onClick={e => { e.stopPropagation(); ir(d); }}
      style={{ ...reset, position: "fixed", [lado]: 6, top: "42%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", borderRadius: 16, width: 56, height: 110, color: "#fff", fontSize: 30, zIndex: 2 }}>{txt}</button>
  );
  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 0", boxSizing: "border-box" }}>
      <button aria-label="cerrar" onClick={e => { e.stopPropagation(); onCerrar(); }}
        style={{ ...reset, position: "fixed", top: "calc(12px + env(safe-area-inset-top, 0px))", right: 14, background: "rgba(255,255,255,0.12)", borderRadius: 99, width: 44, height: 44, color: "#fff", fontSize: 22, zIndex: 2 }}>×</button>
      {nav && <div style={{ position: "fixed", top: "calc(22px + env(safe-area-inset-top, 0px))", left: 0, right: 0, textAlign: "center", fontFamily: FUENTE, fontSize: 11, color: "rgba(255,255,255,0.45)", pointerEvents: "none" }}>{idx + 1} / {items.length}</div>}
      <img src={falla ? urlImagen(datos.imgTpl, it.pid, 400) : urlImagenGrande(it.pid)} alt={it.titulo} onError={() => setFalla(true)}
        style={{ maxWidth: "90vw", maxHeight: "68vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
      <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, textAlign: "center", maxWidth: "86vw", fontFamily: FUENTE }}>
        <div style={{ fontFamily: CAVEAT, fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.15 }}>{it.titulo}</div>
        {it.sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{it.sub}</div>}
        <div style={{ fontSize: 12, marginTop: 5, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ color: it.precio != null ? "#5c9cff" : "rgba(255,255,255,0.35)", fontWeight: 700 }}>{it.precio != null ? usd(it.precio) : "sin precio"}</span>
          {it.extra && <span style={{ color: it.extra.color || "#ccc" }}>{it.extra.t}</span>}
        </div>
      </div>
      {nav && flecha("left", -1, "‹")}
      {nav && flecha("right", 1, "›")}
    </div>
  );
}

// Datos de carta para el encabezado de la ficha (ATK/DEF, nivel, atributo… según lo que traiga el bot).
function lineaDatos(c) {
  const m = c.m || {};
  const partes = [m.ct || m.t, m.a, m.r, m.lv != null ? `Nv ${m.lv}` : null, m.atk != null ? `ATK ${m.atk}` : null, m.def != null ? `DEF ${m.def}` : null, m.col, m.f, m.dp ? `DP ${m.dp}` : null].filter(Boolean);
  return partes.join(" · ");
}

function Ficha({ tcg, colec, c, marca, datos, onVolver, onZoom }) {
  const tiene = tieneCarta(marca);
  const el = versionElegida(c, marca);
  const ref = el || c.v[0];
  const q = (marca && marca.q) || 1;
  const [costo, setCosto] = useState(marca && marca.cu ? String(marca.cu) : "");
  const [notas, setNotas] = useState((marca && marca.nt) || "");
  useEffect(() => { setCosto(marca && marca.cu ? String(marca.cu) : ""); setNotas((marca && marca.nt) || ""); }, [c.k, colec]);
  const poner = parche => ponerMarca(tcg, colec, c.k, parche);

  // Versiones agrupadas por set (la edición más reciente primero); dentro, de más cara a más barata.
  const rank = useMemo(() => rankSets(datos), [datos]);
  const ordenadas = [...c.v].sort((a, b) => (rank[b[2]] ?? -1) - (rank[a[2]] ?? -1) || (precioVersion(b) ?? -1) - (precioVersion(a) ?? -1));
  const grupos = [];
  const idx = new Map();
  ordenadas.forEach(v => {
    if (!idx.has(v[2])) { idx.set(v[2], grupos.length); grupos.push({ set: datos.sets[v[2]] || "", filas: [] }); }
    grupos[idx.get(v[2])].filas.push(v);
  });
  const itemsZoom = ordenadas.map(v => ({ pid: v[0], titulo: c.n, sub: etiquetaVersion(v, datos.sets), precio: precioVersion(v), extra: el && claveVersion(el) === claveVersion(v) ? { t: "★ elegida", color: "#e6c229" } : null }));
  const abrirZoom = v => onZoom(itemsZoom, Math.max(0, ordenadas.findIndex(x => claveVersion(x) === claveVersion(v))));
  const datosCarta = lineaDatos(c);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: FUENTE, color: "#fff" }}>
      <button onClick={onVolver} style={{ ...reset, alignSelf: "flex-start", minHeight: 44, padding: "0 4px", fontSize: 13, color: "#b5b5bb" }}>← volver</button>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <button aria-label="ver imagen a pantalla completa" onClick={() => ref && abrirZoom(ref)}
          style={{ ...reset, flex: "none", width: 120, borderRadius: 8, overflow: "hidden", background: "#1b1b1f", border: `2px solid ${tiene ? VERDE : ROJO}` }}>
          {ref && <img src={urlImagen(datos.imgTpl, ref[0], 400)} alt={c.n} style={{ width: "100%", display: "block" }} />}
        </button>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 26, lineHeight: 1.05 }}>{c.n}</span>
          {datosCarta && <span style={{ fontSize: 12, color: "#c4c4ca" }}>{datosCarta}</span>}
          {c.m && c.m.ar && <span style={{ fontSize: 11, color: "#9a9aa0" }}>Arquetipo: {c.m.ar}</span>}
          <span style={{ fontSize: 12, color: "#9a9aa0" }}>{el ? etiquetaVersion(el, datos.sets) : "sin versión elegida"}</span>
          <span style={{ fontSize: 15 }}>{usd(precioReferencia(c, marca))}{el ? "" : " (la más barata)"}</span>
        </span>
      </div>

      <button onClick={() => poner({ c: tiene ? 0 : 1 })} style={tiene ? botonSec : botonPri}>{tiene ? "✓ La tengo (quitar)" : "Marcar como conseguida"}</button>

      {tiene && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: "#c4c4ca" }}>Cantidad</span>
            <button aria-label="menos" onClick={() => poner({ q: Math.max(1, q - 1) })} style={{ ...botonSec, minWidth: 44, padding: 0 }}>−</button>
            <span style={{ minWidth: 24, textAlign: "center", fontSize: 15 }}>{q}</span>
            <button aria-label="más" onClick={() => poner({ q: q + 1 })} style={{ ...botonSec, minWidth: 44, padding: 0 }}>+</button>
          </div>
          <input inputMode="decimal" placeholder="Costo en USD" value={costo} onChange={e => setCosto(e.target.value)}
            onBlur={() => { const n = parseFloat(String(costo).replace(",", ".")); poner({ cu: Number.isFinite(n) && n > 0 ? n : 0 }); }} style={campo} />
          <input placeholder="Notas" value={notas} onChange={e => setNotas(e.target.value)} onBlur={() => poner({ nt: notas.trim() })} style={campo} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 20 }}>Versiones ({c.v.length})</span>
        {grupos.map(g => (
          <div key={g.set} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.06em", color: "#9a9aa0", textTransform: "uppercase", marginTop: 6 }}>{g.set}</span>
            {g.filas.map(v => {
              const elegida = el && claveVersion(el) === claveVersion(v);
              return (
                <div key={claveVersion(v)} style={{ display: "flex", alignItems: "center", gap: 4, boxSizing: "border-box", borderRadius: 8, background: elegida ? "#1d1d22" : "#111114", border: `1px solid ${elegida ? "#eaeaea" : "#26262b"}` }}>
                  <button onClick={() => poner({ e: elegida ? "" : claveVersion(v) })}
                    style={{ ...reset, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "6px 0 6px 10px", textAlign: "left", color: "#fff" }}>
                    <Miniatura tpl={datos.imgTpl} pid={v[0]} ancho={28} alto={39} />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 13 }}>{[v[3], v[4]].filter(Boolean).join(" · ") || "—"}</span>
                      <span style={{ fontSize: 11, color: "#9a9aa0" }}>{v[1] || "sin edición"} · bajo {usd(v[6])} · alto {usd(v[7])}</span>
                    </span>
                    <span style={{ flex: "none", fontSize: 13 }}>{elegida ? "★ " : ""}{usd(precioVersion(v))}</span>
                  </button>
                  <button aria-label="ver esta versión a pantalla completa" onClick={() => abrirZoom(v)} style={{ ...reset, flex: "none", width: 44, minHeight: 48, fontSize: 16 }}>🔍</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ activo, onClick, children, flex }) {
  return (
    <button onClick={onClick} aria-pressed={activo}
      style={{ ...reset, ...(flex ? { flex: 1 } : {}), minHeight: 44, padding: "0 12px", borderRadius: 8, textAlign: "center", fontFamily: FUENTE, fontSize: 13, background: activo ? "#fff" : "transparent", color: activo ? "#0b0b0c" : "#c4c4ca", border: activo ? "1px solid #fff" : "1px solid #3a3a40" }}>{children}</button>
  );
}

const mesAnio = f => (f ? String(f).slice(0, 7) : "");

export default function TcgCryptoPage() {
  const estado = useEstado();
  const tcg = TCGS.some(t => t.id === estado.tcg) ? estado.tcg : TCGS[0].id;
  const vista = estado.vista === "az" ? "az" : "edicion";
  const [datosPor, setDatosPor] = useState({});
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [fichaSel, setFichaSel] = useState(null);   // { colec, k }
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("todas");
  const [filtros, setFiltros] = useState({});        // { [campo]: [valores] }
  const [panelFiltros, setPanelFiltros] = useState(false);
  const [setsAbiertos, setSetsAbiertos] = useState({});   // override manual de cada edición: true/false
  const [limite, setLimite] = useState(PAGINA);
  const [zoom, setZoom] = useState(null);            // { items, idx }
  const bodyRef = useRef(null);
  const datos = datosPor[tcg] || null;
  const rank = useMemo(() => rankSets(datos), [datos]);

  async function cargar(id) {
    setError(null);
    try { const d = await fetchTcgCryptoData(id); setDatosPor(p => ({ ...p, [id]: d })); } catch (e) { setError(e.message || "error"); }
  }
  useEffect(() => { if (!datosPor[tcg]) cargar(tcg); }, [tcg]);
  useEffect(() => { setAbierta(null); setFichaSel(null); setTexto(""); setModo("todas"); setFiltros({}); setPanelFiltros(false); setSetsAbiertos({}); setLimite(PAGINA); setZoom(null); }, [tcg]);
  useEffect(() => { setFiltros({}); setPanelFiltros(false); setSetsAbiertos({}); }, [abierta]);
  useEffect(() => { setLimite(PAGINA); }, [abierta, texto, modo, filtros, vista]);

  const expandido = abierta !== null || fichaSel !== null;
  // Válvula (4.5): colapsado nunca debería desbordar. Es un detector, no una solución.
  useEffect(() => {
    const b = bodyRef.current;
    if (b && !expandido && b.scrollHeight > b.clientHeight + 1) console.warn(`tcgcrypto desborda ${b.scrollHeight - b.clientHeight} px colapsado`);
  });

  const marcasDe = colec => (estado.cartas && estado.cartas[tcg] && estado.cartas[tcg][colec]) || {};
  const ancho = { width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box", position: "relative", padding: "10px 16px 8px" };
  const edad = edadDatos(datos && datos.generatedAt, Date.now());

  // Pantalla completa de una lista de cartas: la imagen de la versión que las ubica (elegida o más reciente).
  const zoomCartas = (lista, colec, i) => {
    const marcas = marcasDe(colec);
    setZoom({
      idx: i,
      items: lista.map(c => {
        const m = marcas[c.k] || null;
        const v = versionReferencia(c, m, rank) || c.v[0];
        const el = versionElegida(c, m);
        return { pid: v[0], titulo: c.n, sub: etiquetaVersion(v, datos.sets), precio: el ? precioVersion(el) : precioReferencia(c, m), extra: tieneCarta(m) ? { t: "conseguida", color: "#4caf80" } : { t: "falta", color: "#999" } };
      }),
    });
  };

  let cuerpo;
  if (fichaSel && datos) {
    const carta = datos.cartas.find(x => x.k === fichaSel.k);
    cuerpo = carta
      ? <Ficha tcg={tcg} colec={fichaSel.colec} c={carta} marca={marcaDe(estado, tcg, fichaSel.colec, carta.k)} datos={datos} onVolver={() => setFichaSel(null)} onZoom={(items, idx) => setZoom({ items, idx })} />
      : <button onClick={() => setFichaSel(null)} style={botonSec}>La carta ya no está en los datos · volver</button>;
  } else {
    const cols = datos ? datos.colecciones : [];
    let total = 0, tengo = 0, vTot = 0, vCons = 0;
    const filas = cols.map(col => {
      const cs = cartasDeColeccion(datos, col.id);
      const r = resumenColeccion(cs, marcasDe(col.id));
      total += r.total; tengo += r.conseguidas; vTot += r.valorTotal; vCons += r.valorConseguido;
      return { col, cs, r };
    });
    const nFiltros = cuentaFiltros(filtros);
    cuerpo = (
      <>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {TCGS.map(t => (
              <button key={t.id} onClick={() => elegirTcg(t.id)} aria-pressed={t.id === tcg}
                style={{ ...reset, minHeight: 44, padding: "0 12px", borderRadius: 22, display: "flex", alignItems: "center", gap: 6, fontFamily: FUENTE, fontSize: 13, background: t.id === tcg ? "#fff" : "transparent", color: t.id === tcg ? "#0b0b0c" : "#c4c4ca", border: t.id === tcg ? "1px solid #fff" : "1px solid #3a3a40" }}>
                <span aria-hidden="true">{t.emoji}</span>{t.nombre}
              </button>))}
          </div>
          {datos && <span style={{ ...sello, ...(edad.vieja ? { color: "#ff5a5f", borderColor: "#ff5a5f" } : {}) }}>DATOS {edad.texto.toUpperCase()}</span>}
        </div>
        <div style={{ flex: 1, minHeight: 0, marginTop: 6, display: "flex", flexDirection: "column", gap: 8, overflowX: "hidden", overflowY: expandido ? "auto" : "hidden" }}>
          {!datos && !error && <p style={{ margin: 0, padding: 12, fontFamily: FUENTE, fontSize: 13, color: "#9a9aa0" }}>Cargando…</p>}
          {error && !datos && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", fontFamily: FUENTE, fontSize: 13, color: "#c4c4ca" }}>
              <span>No se pudieron cargar los datos ({error}).</span>
              <button onClick={() => cargar(tcg)} style={botonSec}>Reintentar</button>
            </div>)}
          {filas.map(({ col, cs, r }) => {
            const esta = abierta === col.id;
            if (abierta !== null && !esta) return null;   // abrir una cierra las demás: solo queda la abierta
            const marcas = marcasDe(col.id);
            const lista = esta ? filtrarCartas(cs, marcas, { texto, modo, filtros }, datos.sets) : [];
            const hayBusqueda = !!(texto.trim() || nFiltros);
            let contenido = null;
            if (esta) {
              if (vista === "edicion") {
                const todos = agruparPorEdicion(cs, marcas, datos, rank);
                const visibles = new Set(lista.map(c => c.k));
                const grupos = todos.map(g => ({ ...g, mostrar: g.cartas.filter(c => visibles.has(c.k)) })).filter(g => g.mostrar.length);
                const auto = hayBusqueda && lista.length <= 80;   // pocos resultados: todo abierto, sin tener que ir set por set
                contenido = (
                  <>
                    {grupos.slice(0, limite).map(g => {
                      const abiertoSet = setsAbiertos[g.setIdx] !== undefined ? setsAbiertos[g.setIdx] : auto;
                      const rg = resumenColeccion(g.cartas, marcas);
                      return (
                        <div key={g.setIdx} style={{ flex: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                          <button onClick={() => setSetsAbiertos(p => ({ ...p, [g.setIdx]: !abiertoSet }))} aria-expanded={abiertoSet ? "true" : "false"}
                            style={{ ...reset, display: "flex", flexDirection: "column", gap: 6, minHeight: 44, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, textAlign: "left", background: "#17171a", border: "1px solid #2a2a30", color: "#fff", fontFamily: FUENTE }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span aria-hidden="true" style={{ fontSize: 11, color: "#9a9aa0" }}>{abiertoSet ? "▾" : "▸"}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.nombre}</span>
                              <span style={{ flex: "none", fontSize: 11, color: "#9a9aa0" }}>{mesAnio(g.fecha)}</span>
                              <span style={{ flex: "none", fontSize: 12, color: "#b5b5bb" }}>{rg.conseguidas}/{rg.total}</span>
                            </span>
                            <Barra pct={rg.pct} />
                          </button>
                          {abiertoSet && g.mostrar.map((c, i) => <FilaCarta key={c.k} c={c} marca={marcas[c.k] || null} datos={datos} rank={rank} onClick={() => setFichaSel({ colec: col.id, k: c.k })} onZoom={() => zoomCartas(g.mostrar, col.id, i)} />)}
                        </div>
                      );
                    })}
                    {grupos.length > limite && <button onClick={() => setLimite(l => l + PAGINA)} style={{ ...botonSec, flex: "none" }}>Ver más ediciones ({grupos.length - limite})</button>}
                    {grupos.length === 0 && <p style={{ margin: 0, padding: 8, fontFamily: FUENTE, fontSize: 13, color: "#9a9aa0" }}>Ninguna carta coincide.</p>}
                  </>
                );
              } else {
                contenido = (
                  <>
                    {lista.length === 0 && <p style={{ margin: 0, padding: 8, fontFamily: FUENTE, fontSize: 13, color: "#9a9aa0" }}>Ninguna carta coincide.</p>}
                    {lista.slice(0, limite).map((c, i) => <FilaCarta key={c.k} c={c} marca={marcas[c.k] || null} datos={datos} rank={rank} onClick={() => setFichaSel({ colec: col.id, k: c.k })} onZoom={() => zoomCartas(lista, col.id, i)} />)}
                    {lista.length > limite && <button onClick={() => setLimite(l => l + PAGINA)} style={{ ...botonSec, flex: "none" }}>Ver más ({lista.length - limite})</button>}
                  </>
                );
              }
            }
            return (
              <div key={col.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FilaColeccion col={col} r={r} abierta={esta} onClick={() => setAbierta(esta ? null : col.id)} />
                {esta && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input placeholder="Buscar por nombre, arquetipo, número, set o rareza" value={texto} onChange={e => setTexto(e.target.value)} style={campo} />
                      <div style={{ display: "flex", gap: 6 }}>
                        {[["todas", "Todas"], ["faltan", "Faltan"], ["tengo", "Tengo"]].map(([id, et]) => <Chip key={id} flex activo={modo === id} onClick={() => setModo(id)}>{et}</Chip>)}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Chip flex activo={vista === "edicion"} onClick={() => elegirVista("edicion")}>Por edición</Chip>
                        <Chip flex activo={vista === "az"} onClick={() => elegirVista("az")}>A–Z</Chip>
                        {datos.filtros && datos.filtros.length > 0 && <Chip flex activo={panelFiltros || nFiltros > 0} onClick={() => setPanelFiltros(p => !p)}>Filtros{nFiltros ? ` (${nFiltros})` : ""}</Chip>}
                      </div>
                      {panelFiltros && datos.filtros && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 10, borderRadius: 8, background: "#111114", border: "1px solid #26262b" }}>
                          {datos.filtros.map(f => {
                            const vals = valoresFiltro(cs, f.id);
                            if (!vals.length) return null;
                            const sel = filtros[f.id] || [];
                            return (
                              <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <span style={{ fontFamily: FUENTE, fontSize: 11, letterSpacing: "0.06em", color: "#9a9aa0", textTransform: "uppercase" }}>{f.nombre}</span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {vals.map(v => <Chip key={v} activo={sel.includes(v)} onClick={() => setFiltros(p => { const cur = p[f.id] || []; return { ...p, [f.id]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }; })}>{v}</Chip>)}
                                </div>
                              </div>
                            );
                          })}
                          {nFiltros > 0 && <button onClick={() => setFiltros({})} style={botonSec}>Limpiar filtros</button>}
                        </div>
                      )}
                      <span style={{ fontFamily: FUENTE, fontSize: 11, color: "#9a9aa0" }}>{col.criterio}{hayBusqueda || modo !== "todas" ? ` · ${lista.length} de ${cs.length}` : ""}</span>
                    </div>
                    {contenido}
                  </>
                )}
              </div>
            );
          })}
          {datos && abierta === null && (
            <div style={{ flex: "none", marginTop: "auto", paddingTop: 6, fontFamily: FUENTE, fontSize: 12, color: "#9a9aa0", textAlign: "center" }}>
              {tengo} de {total} cartas · {usd(vCons)} de {usd(vTot)}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="tcgc" style={{ background: FONDO }}>
      <div ref={bodyRef} className="tcgc-body" data-expandido={expandido ? "true" : "false"} data-ficha={fichaSel ? "true" : "false"} style={ancho}>
        {cuerpo}
      </div>
      {zoom && datos && <Zoom zoom={zoom} datos={datos} onIdx={idx => setZoom(z => ({ ...z, idx }))} onCerrar={() => setZoom(null)} />}
    </div>
  );
}
