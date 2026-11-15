import { fetchTcgCryptoData } from "../shared/catalog.js";
import { useEstado, elegirTcg, marcaDe, ponerMarca } from "./estado.js";
import {
  claveVersion, precioVersion, versionElegida, precioReferencia, tieneCarta, cartasDeColeccion,
  resumenColeccion, tramoBarra, filtrarCartas, usd, etiquetaVersion, urlImagen, edadDatos,
} from "./logica.js";

const { useState, useEffect, useRef } = React;

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

function FilaCarta({ c, marca, datos, onClick }) {
  const tiene = tieneCarta(marca);
  const el = versionElegida(c, marca);
  const ref = el || c.v[0];
  const precio = precioReferencia(c, marca);
  return (
    <button onClick={onClick}
      style={{ ...reset, flex: "none", display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", textAlign: "left", padding: "8px 10px", borderRadius: 8, background: "#111114", border: `2px solid ${tiene ? VERDE : ROJO}`, color: "#fff", fontFamily: FUENTE }}>
      <Miniatura tpl={datos.imgTpl} pid={ref && ref[0]} ancho={36} alto={50} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.n}</span>
        <span style={{ fontSize: 11, color: "#9a9aa0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {el ? etiquetaVersion(el, datos.sets) : `${c.v.length} ${c.v.length === 1 ? "versión" : "versiones"}`}
        </span>
      </span>
      <span style={{ flex: "none", fontSize: 13, color: precio == null ? "#6a6a70" : "#eaeaea" }}>{el || datos.agrupar === "producto" ? usd(precio) : `desde ${usd(precio)}`}</span>
    </button>
  );
}

function Ficha({ tcg, colec, c, marca, datos, onVolver }) {
  const tiene = tieneCarta(marca);
  const el = versionElegida(c, marca);
  const ref = el || c.v[0];
  const q = (marca && marca.q) || 1;
  const [costo, setCosto] = useState(marca && marca.cu ? String(marca.cu) : "");
  const [notas, setNotas] = useState((marca && marca.nt) || "");
  useEffect(() => { setCosto(marca && marca.cu ? String(marca.cu) : ""); setNotas((marca && marca.nt) || ""); }, [c.k, colec]);
  const poner = parche => ponerMarca(tcg, colec, c.k, parche);

  // Versiones agrupadas por set, ordenadas por nombre de set; dentro, de más cara a más barata.
  const grupos = [];
  const idx = new Map();
  [...c.v].sort((a, b) => String(datos.sets[a[2]]).localeCompare(String(datos.sets[b[2]])) || (precioVersion(b) ?? -1) - (precioVersion(a) ?? -1)).forEach(v => {
    if (!idx.has(v[2])) { idx.set(v[2], grupos.length); grupos.push({ set: datos.sets[v[2]] || "", filas: [] }); }
    grupos[idx.get(v[2])].filas.push(v);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: FUENTE, color: "#fff" }}>
      <button onClick={onVolver} style={{ ...reset, alignSelf: "flex-start", minHeight: 44, padding: "0 4px", fontSize: 13, color: "#b5b5bb" }}>← volver</button>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ flex: "none", width: 120, borderRadius: 8, overflow: "hidden", background: "#1b1b1f", border: `2px solid ${tiene ? VERDE : ROJO}` }}>
          {ref && <img src={urlImagen(datos.imgTpl, ref[0], 400)} alt={c.n} style={{ width: "100%", display: "block" }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 26, lineHeight: 1.05 }}>{c.n}</span>
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
                <button key={claveVersion(v)} onClick={() => poner({ e: elegida ? "" : claveVersion(v) })}
                  style={{ ...reset, display: "flex", alignItems: "center", gap: 10, minHeight: 44, boxSizing: "border-box", padding: "6px 10px", borderRadius: 8, textAlign: "left", background: elegida ? "#1d1d22" : "#111114", border: `1px solid ${elegida ? "#eaeaea" : "#26262b"}`, color: "#fff" }}>
                  <Miniatura tpl={datos.imgTpl} pid={v[0]} ancho={28} alto={39} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 13 }}>{[v[3], v[4]].filter(Boolean).join(" · ") || "—"}</span>
                    <span style={{ fontSize: 11, color: "#9a9aa0" }}>{v[1] || "sin edición"} · bajo {usd(v[6])} · alto {usd(v[7])}</span>
                  </span>
                  <span style={{ flex: "none", fontSize: 13 }}>{elegida ? "★ " : ""}{usd(precioVersion(v))}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TcgCryptoPage() {
  const estado = useEstado();
  const tcg = TCGS.some(t => t.id === estado.tcg) ? estado.tcg : TCGS[0].id;
  const [datosPor, setDatosPor] = useState({});
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [fichaSel, setFichaSel] = useState(null);   // { colec, k }
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("todas");
  const [limite, setLimite] = useState(PAGINA);
  const bodyRef = useRef(null);
  const datos = datosPor[tcg] || null;

  async function cargar(id) {
    setError(null);
    try { const d = await fetchTcgCryptoData(id); setDatosPor(p => ({ ...p, [id]: d })); } catch (e) { setError(e.message || "error"); }
  }
  useEffect(() => { if (!datosPor[tcg]) cargar(tcg); }, [tcg]);
  useEffect(() => { setAbierta(null); setFichaSel(null); setTexto(""); setModo("todas"); setLimite(PAGINA); }, [tcg]);
  useEffect(() => { setLimite(PAGINA); }, [abierta, texto, modo]);

  const expandido = abierta !== null || fichaSel !== null;
  // Válvula (4.5): colapsado nunca debería desbordar. Es un detector, no una solución.
  useEffect(() => {
    const b = bodyRef.current;
    if (b && !expandido && b.scrollHeight > b.clientHeight + 1) console.warn(`tcgcrypto desborda ${b.scrollHeight - b.clientHeight} px colapsado`);
  });

  const marcasDe = colec => (estado.cartas && estado.cartas[tcg] && estado.cartas[tcg][colec]) || {};
  const ancho = { width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box", position: "relative", padding: "10px 16px 8px" };
  const edad = edadDatos(datos && datos.generatedAt, Date.now());

  let cuerpo;
  if (fichaSel && datos) {
    const carta = datos.cartas.find(x => x.k === fichaSel.k);
    cuerpo = carta
      ? <Ficha tcg={tcg} colec={fichaSel.colec} c={carta} marca={marcaDe(estado, tcg, fichaSel.colec, carta.k)} datos={datos} onVolver={() => setFichaSel(null)} />
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
            const lista = esta ? filtrarCartas(cs, marcasDe(col.id), { texto, modo }, datos.sets) : [];
            return (
              <div key={col.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FilaColeccion col={col} r={r} abierta={esta} onClick={() => setAbierta(esta ? null : col.id)} />
                {esta && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input placeholder="Buscar por nombre, número, set o rareza" value={texto} onChange={e => setTexto(e.target.value)} style={campo} />
                      <div style={{ display: "flex", gap: 6 }}>
                        {[["todas", "Todas"], ["faltan", "Faltan"], ["tengo", "Tengo"]].map(([id, et]) => (
                          <button key={id} onClick={() => setModo(id)} aria-pressed={modo === id}
                            style={{ ...reset, flex: 1, minHeight: 44, borderRadius: 8, textAlign: "center", fontFamily: FUENTE, fontSize: 13, background: modo === id ? "#fff" : "transparent", color: modo === id ? "#0b0b0c" : "#c4c4ca", border: modo === id ? "1px solid #fff" : "1px solid #3a3a40" }}>{et}</button>))}
                      </div>
                      <span style={{ fontFamily: FUENTE, fontSize: 11, color: "#9a9aa0" }}>{col.criterio}</span>
                    </div>
                    {lista.length === 0 && <p style={{ margin: 0, padding: 8, fontFamily: FUENTE, fontSize: 13, color: "#9a9aa0" }}>Ninguna carta coincide.</p>}
                    {lista.slice(0, limite).map(c => <FilaCarta key={c.k} c={c} marca={marcaDe(estado, tcg, col.id, c.k)} datos={datos} onClick={() => setFichaSel({ colec: col.id, k: c.k })} />)}
                    {lista.length > limite && <button onClick={() => setLimite(l => l + PAGINA)} style={{ ...botonSec, flex: "none" }}>Ver más ({lista.length - limite})</button>}
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
    </div>
  );
}
