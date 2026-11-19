import { fetchGameEnhancedData, fetchGameEnhancedFichas, fetchGameEnhancedReadmes, fetchGameEnhancedPlataformas } from "../shared/catalog.js";
import { Ventana, VentanaCabecera } from "../shared/ui.jsx";
import { CATEGORIAS, TIPO, ESTADOS_INFO, GLOSARIO_SUBTIPO, esCategoriaRegistro, esProyecto, tituloLimpio, sugerenciasDe, plataformasDe, motivoDe, cuando, detalleDe, filasFicha, madurezDecomp, edadDatos, itemsDe, XMB, OPACIDAD, disposicion, textoCompartir, resumen, portadaUrl, portadaDe } from "./logica.js";
import { useEstado, alternarGuardado, ocultar, deshacerOcultar } from "./estado.js";
import { useRegistro, agregarJuego, editarJuego, quitarJuego, restaurarJuego, sembrar } from "./registro.js";
import { ESTADOS_REGISTRO, idRegistro } from "./lib/claves.mjs";

const { useState, useEffect, useRef } = React;

// ─── Módulo Game enhanced (nov-2026) ────────────────────────────────────────
// Novedades de juegos que importan (decomps, ports nativos de clásicos y juegos nuevos de los estudios detrás de lo que
// terminaste) + tu registro propio de juegos: 🏁 terminados, 🎯 quiero jugar, ⏳ pendientes.
//
// Navegación al estilo XMB de PSP/PS3 (issue #43): una fila de íconos en horizontal cuyo activo queda fijo
// (más grande, con su nombre) mientras los demás se deslizan; los ítems cuelgan en columna bajo ese ícono,
// el enfocado es más grande, con aire arriba y abajo y su subtítulo, y los demás se atenúan con la distancia.
// Fondo oscuro con ondas suaves.
//
// Lineamiento (docs/angst-lineamiento-y-handoff.md §4):
//  · N1: montado sobre el marco `.app-fit` de core/App.jsx (clases .gameenh / .gameenh-body). No se mide
//    la pantalla: solo el propio contenedor de la lista (ResizeObserver) para saber cuántas filas ENTERAS
//    caben. El formulario de alta usa la Ventana compartida (shared/ui.jsx).
//  · N2: excepción de patrón (XMB; aprobado por Cristopher el 10-nov-2026 como menú en cruz y redirigido el
//    16-nov-2026 hacia el XMB de PSP/PS3): franja de estado + filas que se expanden en línea y de a una +
//    ficha como estado expandido.
//  · N3: colapsado sin scroll de módulo ni de página: la lista es un carrusel que se arrastra con el dedo (el
//    foco se mueve, la lista no scrollea); el scroll interno nace solo al expandir una fila. La ficha es un
//    popup (Ventana compartida) con su propio scroll: el XMB queda detrás, en la misma posición.
//
// Control táctil (17-nov-2026): el dedo arrastra el XMB en continuo, no por pasos. Tras ~8 px se fija la dirección
// (vertical: la lista; horizontal: el eje de íconos), el contenido sigue al dedo, y al soltar sigue con inercia y
// encaja en la fila / categoría más cercana. Fuera de los extremos hay resistencia elástica. La rueda y el
// teclado usan el mismo motor (`ir`). Con "reducir movimiento" salta directo al destino.
//  · R6: sin título propio. R7: Caveat + DM Sans, emojis como íconos, fondo oscuro con la paleta de los
//    módulos oscuros de Angst (acento oliva, bordes punteados).
//
// Datos: game-enhanced.json (decomps y estudios, una vez al día), game-enhanced-fichas.json (portada, resumen
// y géneros de IGDB de los juegos del registro) y game-enhanced-readmes.json (README de cada decomp en texto
// plano, para leerlo sin salir a GitHub). Persistencia: estado.js (guardados / ocultos) y registro.js
// (el registro de juegos; Angst es su fuente, sin conexión con Stash).

const FUENTE = "'DM Sans',sans-serif";
const CAVEAT = "'Caveat',cursive";
const ACC = "#aac756";
const WARN = "#e53935";
const DIM = "#9a9aa0";
const TXT = "#eaeaea";
const AVISO_MS = 6000;
const EJE = { ax: 54, paso: 62 };           // eje del XMB: centro del ícono activo y separación entre íconos
const UMBRAL_GESTO = 8;                      // px antes de decidir si el gesto es vertical u horizontal
const INERCIA_MS = 240;                      // cuánto "sigue" la lista tras soltar (proyección por velocidad)
const INERCIA_EJE_MS = 110;                  // el eje de íconos sigue menos: un golpe de dedo salta una o dos categorías, no seis
const limitar = (x, min, max) => Math.max(min, Math.min(max, x));
const resistir = (x, min, max) => (x < min ? min + (x - min) * 0.35 : x > max ? max + (x - max) * 0.35 : x);

const reset = { background: "none", border: 0, padding: 0, color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", cursor: "pointer" };
const botonPri = { minHeight: 44, padding: "0 16px", borderRadius: 8, background: "#fff", color: "#0b0b0c", border: 0, fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const botonSec = { minHeight: 44, padding: "0 16px", borderRadius: 8, background: "transparent", color: TXT, border: "1px dashed #555", fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const sello = { flex: "none", fontFamily: FUENTE, fontSize: 10, letterSpacing: "0.1em", border: "1px dashed #666", borderRadius: 4, padding: "2px 6px", color: "#b5b5bb" };
const entrada = { width: "100%", boxSizing: "border-box", minHeight: 44, padding: "10px 12px", borderRadius: 8, background: "#17171a", border: "1px dashed #555", color: TXT, fontFamily: FUENTE, fontSize: 14, colorScheme: "dark" };

function Valor({ v }) {
  if (v && typeof v === "object") return <a href={v.href} target="_blank" rel="noopener noreferrer" style={{ color: ACC, textDecoration: "underline" }}>{v.texto}</a>;
  return v;
}

// Fondo del XMB: ondas suaves que derivan despacio (quietas con "reducir movimiento").
function Ondas() {
  const quieta = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mov = (valores, dur) => (quieta ? null : <animateTransform attributeName="transform" type="translate" values={valores} dur={dur} repeatCount="indefinite" />);
  return (
    <svg aria-hidden="true" viewBox="0 0 480 800" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs><linearGradient id="gex-fondo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18181b" /><stop offset="1" stopColor="#0b0b0c" /></linearGradient></defs>
      <rect width="480" height="800" fill="url(#gex-fondo)" />
      <g><path d="M-140 360 C -20 270, 110 450, 250 360 S 470 280, 640 380 L640 800 L-140 800Z" fill="rgba(255,255,255,.03)" />{mov("0 0;-70 12;0 0", "26s")}</g>
      <g><path d="M-140 450 C 0 380, 140 520, 280 440 S 480 390, 640 470 L640 800 L-140 800Z" fill="rgba(255,255,255,.04)" />{mov("0 0;60 -10;0 0", "32s")}</g>
      <g><path d="M-140 560 C 30 500, 150 620, 300 550 S 500 510, 640 580 L640 800 L-140 800Z" fill="rgba(170,199,86,.05)" />{mov("0 0;-50 8;0 0", "38s")}</g>
      <g><path d="M-140 400 C -10 330, 120 480, 260 400 S 470 330, 640 420" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1.2" />{mov("0 0;80 -14;0 0", "30s")}</g>
    </svg>
  );
}

// Portada de IGDB (o el emoji del tipo si no hay o no carga). `lado` en px.
function Miniatura({ imagen, emoji, lado, resaltada }) {
  const [falla, setFalla] = useState(false);
  useEffect(() => { setFalla(false); }, [imagen]);
  const url = !falla ? portadaUrl(imagen, lado > 48 ? "t_cover_big" : "t_cover_small") : null;
  return (
    <span aria-hidden="true" style={{ flex: "none", width: lado, height: lado, boxSizing: "border-box", borderRadius: 10, overflow: "hidden", background: "#1b1b1f", border: resaltada ? "1.5px solid #fff" : "1px solid #2c2c31", boxShadow: resaltada ? "0 0 18px rgba(255,255,255,.22)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: lado * 0.46 }}>
      {url ? <img src={url} alt="" loading="lazy" onError={() => setFalla(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : emoji}
    </span>
  );
}

// Eje horizontal. `c` es la posición (decimal) de la categoría activa: sigue al dedo y los íconos se agrandan,
// se desplazan y se atenúan según su distancia a ella.
function Eje({ c, onElegir, mostrarMas, onMas }) {
  return (
    <div style={{ position: "relative", flex: "none", height: 96, marginTop: 4, overflow: "hidden" }}>
      {CATEGORIAS.map(([clave, emoji, nombre], i) => {
        const d = i - c, t = Math.max(0, 1 - Math.abs(d)), act = t > 0.5;
        const base = Math.max(0.28, 0.62 - Math.abs(d) * 0.07);
        const cx = EJE.ax + d * EJE.paso;
        const lado = 40 + 16 * t;
        return (
          <button key={clave} onClick={() => onElegir(i)} aria-label={act ? `${nombre}, categoría seleccionada` : nombre} aria-current={act ? "true" : undefined}
            style={{ ...reset, position: "absolute", top: 0, left: 0, width: EJE.paso, height: 60, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12 - 8 * t, zIndex: act ? 1 : 2, transform: `translateX(${cx - EJE.paso / 2}px)`, opacity: base + (1 - base) * t, color: "#fff", overflow: "visible" }}>
            <span style={{ width: lado, height: lado, boxSizing: "border-box", borderRadius: "50%", border: `1.5px solid rgba(255,255,255,${t})`, background: `rgba(255,255,255,${0.09 * t})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 + 4 * t }}>{emoji}</span>
            <span aria-hidden="true" style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontFamily: CAVEAT, fontWeight: 600, fontSize: 22, lineHeight: 1, opacity: t }}>{nombre}</span>
          </button>);
      })}
      {mostrarMas && <button onClick={onMas} aria-label="Agregar juego" style={{ ...reset, position: "absolute", right: 0, top: 8, width: 44, height: 44, borderRadius: "50%", border: `1px dashed ${ACC}`, color: ACC, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>＋</button>}
    </div>
  );
}

const subtitulo = (j, ahora) => (j.tipo === "r" ? detalleDe(j, ahora) : `${TIPO[j.tipo].etiqueta} · ${motivoDe(j)}`);

// Fila del XMB. `t` (0–1) es cuánto está "enfocada": a más t, más grande, con subtítulo; `alto` y `op` los da la
// disposición (continua mientras se arrastra) o, en la fila abierta, valores fijos.
function FilaX({ j, t = 0, alto, op = 1, foco, expandida, guardado, fichas, ahora, onClick, estiloExtra }) {
  const lado = 38 + 24 * t;
  const md = esProyecto(j) ? madurezDecomp(j, ahora) : null;      // estado de un decomp / port: visible sin abrir la ficha
  const ins = Math.round(15 + 7 * t);
  const estilo = {
    flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", textAlign: "left", border: 0, background: "none",
    cursor: "pointer", fontFamily: FUENTE, color: "#fff", padding: "0 6px 0 21px", height: alto, opacity: op, ...estiloExtra,
  };
  return (
    <button onClick={onClick} style={estilo} {...(foco ? { "aria-expanded": expandida ? "true" : "false" } : {})} {...(md ? { title: md.etiqueta } : {})}>
      <span style={{ flex: "none", width: 62, display: "flex", justifyContent: "center" }}>
        <span style={{ position: "relative", display: "flex" }}>
          <Miniatura imagen={portadaDe(j, fichas)} emoji={j.tipo === "r" ? ESTADOS_INFO[j.estado].emoji : TIPO[j.tipo].emoji} lado={lado} resaltada={t > 0.6} />
          {md && <span data-estado={md.nivel} aria-hidden="true" style={{ position: "absolute", right: -5, bottom: -5, width: ins, height: ins, borderRadius: "50%", background: "#0b0b0c", border: "1px solid #3a3a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ins * 0.62, lineHeight: 1 }}>{md.emoji}</span>}
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 14 + 3 * t, fontWeight: t > 0.5 ? 600 : 500, color: t > 0.5 ? "#fff" : "#d4d4d8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.titulo}{guardado ? " ★" : ""}</span>
        {t > 0.02 && <span style={{ fontSize: 12, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: t, maxHeight: 16 * t }}>{subtitulo(j, ahora)}</span>}
      </span>
      <span style={{ flex: "none", fontSize: 11, color: DIM }}>{cuando(j)}</span>
    </button>
  );
}

function Tarjeta({ j, ahora, guardado, fichas, enRegistro, otras, onCerrar, onFicha, onDescartar, onQuitar, onQuiero }) {
  return (
    <div data-id={j.id} style={{ flex: "none", margin: `${XMB.aire / 2}px 0`, background: "rgba(23,23,26,.92)", border: "1px dashed #3a3a40", borderRadius: 12, paddingBottom: 12 }}>
      <FilaX j={j} t={1} alto={XMB.foco} foco expandida guardado={guardado} fichas={fichas} ahora={ahora} onClick={onCerrar} />
      <div style={{ padding: "4px 14px 0 95px", display: "flex", flexDirection: "column", gap: 8, fontFamily: FUENTE, fontSize: 13, color: "#c4c4ca" }}>
        <span>{detalleDe(j, ahora)}</span>
        {otras && otras.length > 0 && <span style={{ color: DIM }}>También en (sugerido): <span style={{ color: "#c4c4ca" }}>{plataformasDe(otras).join(" · ")}</span></span>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onFicha} style={botonPri}>Abrir ficha</button>
          {j.tipo === "r"
            ? <button onClick={onQuitar} style={botonSec}>Quitar</button>
            : <>
                {(j.tipo === "e" || j.tipo === "p") && !enRegistro && <button onClick={onQuiero} style={botonSec}>🎯 Quiero jugar</button>}
                <button onClick={onDescartar} style={botonSec}>No me interesa</button>
              </>}
        </div>
      </div>
    </div>
  );
}

function Campo({ etiqueta, valor, onGuardar, multilinea, tipo }) {
  const [v, setV] = useState(valor || "");
  useEffect(() => { setV(valor || ""); }, [valor]);
  const fin = () => { const n = v.trim(); if (n !== (valor || "")) onGuardar(n); };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: DIM }}>
      {etiqueta}
      {multilinea
        ? <textarea rows={3} value={v} maxLength={600} onChange={e => setV(e.target.value)} onBlur={fin} style={{ ...entrada, minHeight: 80, resize: "vertical" }} />
        : tipo === "date"
          ? <input type="date" value={v} onChange={e => { setV(e.target.value); onGuardar(e.target.value); }} style={entrada} />
          : <input type="text" value={v} maxLength={60} onChange={e => setV(e.target.value)} onBlur={fin} style={entrada} />}
    </label>
  );
}

function ChipsEstado({ valor, onElegir, claro }) {
  return (
    <div role="group" aria-label="Estado" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {ESTADOS_REGISTRO.map(e => {
        const on = valor === e;
        const base = claro
          ? { background: on ? "#111" : "#fff", color: on ? "#fff" : "#111", border: on ? "1px solid #111" : "1px dashed #888" }
          : { background: on ? "#fff" : "transparent", color: on ? "#0b0b0c" : TXT, border: on ? "1px solid #fff" : "1px dashed #555" };
        return <button key={e} onClick={() => onElegir(e)} aria-pressed={on} style={{ minHeight: 44, padding: "0 12px", borderRadius: 8, fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer", ...base }}>{ESTADOS_INFO[e].emoji} {ESTADOS_INFO[e].etiqueta}</button>;
      })}
    </div>
  );
}

// Un título de sección en la ficha (Caveat).
const Seccion = ({ children }) => <h3 style={{ margin: "6px 0 0", fontFamily: CAVEAT, fontWeight: 600, fontSize: 24, lineHeight: 1, color: "#fff" }}>{children}</h3>;

function Readme({ readme, cargando, repoUrl }) {
  if (cargando) return <p style={{ margin: 0, fontSize: 13, color: DIM }}>Cargando README…</p>;
  if (!readme || !readme.bloques || !readme.bloques.length) return <p style={{ margin: 0, fontSize: 13, color: DIM }}>No hay un README legible para este proyecto.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {readme.bloques.map(([k, x], i) => k === "h"
        ? <h4 key={i} style={{ margin: "6px 0 0", fontFamily: CAVEAT, fontWeight: 600, fontSize: 20, lineHeight: 1.1, color: "#fff" }}>{x}</h4>
        : k === "li"
          ? <p key={i} style={{ margin: 0, paddingLeft: 14, textIndent: -14, fontSize: 13, lineHeight: 1.45, color: "#c4c4ca", overflowWrap: "anywhere" }}>• {x}</p>
          : <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#c4c4ca", overflowWrap: "anywhere" }}>{x}</p>)}
      {readme.recortado && <p style={{ margin: 0, fontSize: 12, color: DIM }}>Texto resumido: el README completo está en el repositorio{repoUrl ? <> (<a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACC }}>abrir</a>)</> : ""}.</p>}
    </div>
  );
}

// Estado de un decomp en una tarjeta arriba de la ficha: semáforo de madurez (con su motivo), lo que dice el autor en
// su README sobre el avance (textual, tal como lo escribió) y qué tipo de proyecto es, en lenguaje llano.
function EstadoDecomp({ j, ahora, readme }) {
  const md = madurezDecomp(j, ahora);
  const autor = readme && readme.estado;
  const glosario = GLOSARIO_SUBTIPO[j.subtipo];
  return (
    <div data-estado={md.nivel} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 10, background: "rgba(23,23,26,.92)", border: "1px dashed #3a3a40" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }} aria-hidden="true">{md.emoji}</span>
        <strong style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 24, lineHeight: 1, color: "#fff" }}>{md.etiqueta}</strong>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#c4c4ca" }}>{md.razon}</p>
      {autor && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, borderTop: "1px dashed #3a3a40" }}>
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: DIM }}>ESTADO SEGÚN EL AUTOR (README, en su idioma)</span>
          <span style={{ fontSize: 13, color: "#fff", overflowWrap: "anywhere" }}>{autor.titulo}</span>
          {autor.texto && <span style={{ fontSize: 12, lineHeight: 1.45, color: "#c4c4ca", overflowWrap: "anywhere" }}>{autor.texto}</span>}
        </div>)}
      {glosario && <p style={{ margin: 0, paddingTop: 8, borderTop: "1px dashed #3a3a40", fontSize: 12, lineHeight: 1.45, color: DIM }}><strong style={{ color: "#c4c4ca", fontWeight: 500 }}>Qué es este tipo de proyecto:</strong> {glosario}</p>}
    </div>
  );
}

// Versiones "nativas" del mismo juego en otras plataformas, detectadas por el nombre de ramas y forks del repositorio.
function OtrasPlataformas({ sugerencias, ahora }) {
  return (
    <>
      <Seccion>Versiones en otras plataformas</Seccion>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sugerencias.map(s => {
          const dias = s.pushed ? Math.round((ahora - new Date(s.pushed).getTime()) / 86400000) : null;
          return (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 10px", borderRadius: 8, border: "1px dashed #3a3a40", color: TXT, textDecoration: "none", overflowWrap: "anywhere" }}>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {s.plataformas.map(p => <span key={p} style={{ fontSize: 11, letterSpacing: "0.06em", color: ACC, border: `1px solid ${ACC}`, borderRadius: 4, padding: "1px 6px" }}>{p}</span>)}
              </span>
              <span style={{ fontSize: 13, color: "#fff" }}>{s.tipo === "rama" ? `Rama «${s.nombre}»` : s.nombre}</span>
              <span style={{ fontSize: 11, color: DIM }}>{s.tipo === "rama" ? "rama del mismo repositorio" : `fork · ⭐ ${s.estrellas}${dias === null ? "" : " · actualizado " + haceDiasTxt(dias)}`}</span>
            </a>);
        })}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: DIM }}>Sugerencias detectadas por el nombre o la descripción de la rama o el fork; no están verificadas.</p>
    </>
  );
}
const haceDiasTxt = d => (d <= 0 ? "hoy" : d < 30 ? `hace ${d} d` : d < 365 ? `hace ${Math.round(d / 30)} m` : `hace ${Math.round(d / 365)} a`);

const ETIQUETA_FICHA = { d: "Decomp", p: "Port", e: "Estudio", r: "Juego" };
// ¿Ya está en tu registro? Un estudio por su título; un port por el título del juego sin el nombre del proyecto entre paréntesis.
const registroDe = (j, registro) => (j.tipo === "e" ? registro.juegos[idRegistro(j.titulo)] : j.tipo === "p" ? registro.juegos[idRegistro(tituloLimpio(j.titulo))] : null) || null;
const tituloParaRegistro = j => (j.tipo === "p" ? tituloLimpio(j.titulo) : j.titulo);
// Marco oscuro de la Ventana compartida: el popup de la ficha combina con el XMB, no con el papel de los formularios.
const MARCO_OSCURO = { background: "#0b0b0c", color: TXT, border: "2px dashed #555", boxShadow: "6px 6px 0 #000" };

// Contenido de la ficha (va dentro del popup: la × de la cabecera la cierra).
function Ficha({ j, ahora, igdb, imagen, guardado, enRegistro, sugerencias, readme, cargandoReadme, onGuardar, onDescartar, onQuiero, onEditar, onQuitar }) {
  const [copiado, setCopiado] = useState(null);
  const tAviso = useRef(0);
  useEffect(() => () => clearTimeout(tAviso.current), []);
  const t = TIPO[j.tipo];
  const filas = filasFicha(j, ahora, igdb);
  const resumenTexto = j.tipo === "e" ? j.resumen : j.tipo === "r" ? igdb && igdb.resumen : null;
  const sub = j.tipo === "r" ? null : detalleDe(j, ahora);
  const url = imagen ? portadaUrl(imagen, "t_cover_big") : null;
  // Menú nativo de compartir del celular; donde no exista, copia el texto al portapapeles (igual que Panoramas).
  const compartir = async () => {
    const { titulo, texto, url: enlace } = textoCompartir(j, igdb, ahora);
    try {
      if (typeof navigator !== "undefined" && navigator.share) { await navigator.share({ title: titulo, text: texto, ...(enlace ? { url: enlace } : {}) }); return; }
    } catch (err) { if (err && err.name === "AbortError") return; }   // cerró el menú: no es un error
    try { await navigator.clipboard.writeText(enlace ? `${texto}\n${enlace}` : texto); setCopiado("Copiado ✓"); }
    catch (err) { setCopiado("No se pudo copiar"); }
    clearTimeout(tAviso.current);
    tAviso.current = setTimeout(() => setCopiado(null), 2200);
  };
  const botonCompartir = <button onClick={compartir} style={botonSec}>{copiado || "↗ Compartir"}</button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FUENTE, color: TXT }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {url && <img src={url} alt="" style={{ flex: "none", width: 96, height: 128, objectFit: "cover", borderRadius: 8, border: "1px solid #2c2c31", background: "#1b1b1f" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ alignSelf: "flex-start", fontSize: 11, letterSpacing: "0.12em", color: ACC, border: `1px solid ${ACC}`, borderRadius: 4, padding: "2px 6px" }}>{t.etiqueta}</span>
          <h2 style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 34, lineHeight: 1, color: "#fff", margin: 0, overflowWrap: "anywhere" }}>{j.titulo}</h2>
          {sub && <p style={{ margin: 0, fontSize: 13, color: "#c4c4ca" }}>{sub}</p>}
        </div>
      </div>
      {esProyecto(j) && <EstadoDecomp j={j} ahora={ahora} readme={readme} />}
      {sugerencias && sugerencias.length > 0 && <OtrasPlataformas sugerencias={sugerencias} ahora={ahora} />}
      {j.tipo === "r" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ChipsEstado valor={j.estado} onElegir={e => onEditar({ estado: e })} />
          {j.estado === "terminado" && <Campo etiqueta="Terminado el" tipo="date" valor={j.fecha} onGuardar={v => onEditar({ fecha: v })} />}
          <Campo etiqueta="Plataforma" valor={j.plataforma} onGuardar={v => onEditar({ plataforma: v })} />
          <Campo etiqueta="Nota" multilinea valor={j.nota} onGuardar={v => onEditar({ nota: v })} />
        </div>
      )}
      {resumenTexto && <><Seccion>Resumen</Seccion><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#c4c4ca" }}>{resumenTexto}</p></>}
      {esProyecto(j) && <><Seccion>Sobre el proyecto</Seccion><Readme readme={readme} cargando={cargandoReadme} repoUrl={j.url} /></>}
      {filas.length > 0 && (
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
          {filas.map(([k, v]) => [<dt key={"k" + k} style={{ color: DIM }}>{k}</dt>, <dd key={"v" + k} style={{ margin: 0, color: TXT, overflowWrap: "anywhere" }}><Valor v={v} /></dd>])}
        </dl>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {j.tipo === "r"
          ? <>{botonCompartir}<button onClick={onQuitar} style={botonSec}>Quitar del registro</button></>
          : <>
              <button onClick={onGuardar} aria-pressed={guardado} style={botonPri}>{guardado ? "★ Guardado" : "☆ Me interesa"}</button>
              {botonCompartir}
              {(j.tipo === "e" || j.tipo === "p") && (enRegistro ? <span style={{ alignSelf: "center", fontSize: 13, color: ACC }}>✓ En tu registro: {ESTADOS_INFO[enRegistro.estado].etiqueta}</span> : <button onClick={onQuiero} style={botonSec}>🎯 Quiero jugar</button>)}
              <button onClick={onDescartar} style={botonSec}>No me interesa</button>
            </>}
      </div>
      <span style={{ fontSize: 11, color: DIM }}>Datos: {esProyecto(j) ? "awesome-decomp-games y el README del repositorio" : j.tipo === "e" ? "IGDB" : "tu registro" + (igdb ? " e IGDB" : "")}</span>
    </div>
  );
}

// Alta de un juego al registro (ventana emergente compartida: solo para formularios).
function FormAgregar({ estadoInicial, existentes, onCancelar, onAgregar }) {
  const [titulo, setTitulo] = useState("");
  const [estado, setEstado] = useState(estadoInicial);
  const [plataforma, setPlataforma] = useState("");
  const [fecha, setFecha] = useState("");
  const id = idRegistro(titulo.trim());
  const previo = id ? existentes[id] : null;
  const campo = { width: "100%", boxSizing: "border-box", minHeight: 44, padding: "10px 12px", borderRadius: 8, border: "1px dashed #111", background: "#fff", color: "#111", fontFamily: FUENTE, fontSize: 15 };
  const etiq = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#555" };
  return (
    <Ventana onClose={onCancelar} ancho={420}>
      <VentanaCabecera titulo="Agregar juego" onClose={onCancelar} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <label style={etiq}>Título<input type="text" value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)} style={campo} /></label>
        <ChipsEstado valor={estado} onElegir={setEstado} claro />
        <label style={etiq}>Plataforma (opcional)<input type="text" value={plataforma} maxLength={60} onChange={e => setPlataforma(e.target.value)} style={campo} /></label>
        {estado === "terminado" && <label style={etiq}>Terminado el (opcional)<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={campo} /></label>}
        {previo && <p style={{ margin: 0, fontSize: 12, color: "#555" }}>Ya está en tu registro como «{ESTADOS_INFO[previo.estado].etiqueta}»: se actualizará su estado.</p>}
        <p style={{ margin: 0, fontSize: 12, color: "#777" }}>La portada y el resumen se agregan solos en la próxima actualización diaria, después de subir a Angst-data con 📤.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancelar} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, background: "#fff", color: "#111", border: "1px dashed #888", fontFamily: FUENTE, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => titulo.trim() && onAgregar({ titulo: titulo.trim(), estado, plataforma: plataforma.trim() || undefined, fecha: estado === "terminado" && fecha ? fecha : undefined })} disabled={!titulo.trim()} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, background: "#111", color: "#fff", border: 0, fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: titulo.trim() ? "pointer" : "default", opacity: titulo.trim() ? 1 : 0.4 }}>Agregar</button>
        </div>
      </div>
    </Ventana>
  );
}

export default function GameEnhancedPage() {
  const estado = useEstado();
  const registro = useRegistro();
  const [datos, setDatos] = useState(null);       // { juegos, generatedAt, fuentes, semilla }
  const [fichas, setFichas] = useState({});       // fichas de IGDB del registro: { [id]: { portada, resumen, ... } }
  const [readmes, setReadmes] = useState(null);   // README por decomp: null = sin pedir todavía
  const [plataformas, setPlataformas] = useState({}); // versiones sugeridas en otras plataformas, por repo
  const [cargandoReadme, setCargandoReadme] = useState(false);
  const [error, setError] = useState(null);
  const [cat, setCat] = useState(0);              // categoría activa (la más cercana a la posición del eje)
  const [abierto, setAbierto] = useState(null);   // id de la fila expandida (una a la vez)
  const [fichaId, setFichaId] = useState(null);   // ficha abierta (popup); el XMB queda detrás, donde estaba
  const [form, setForm] = useState(null);         // null | estado inicial del formulario de alta
  const [aviso, setAviso] = useState(null);       // { texto, deshacer } mientras se puede deshacer
  const [alto, setAlto] = useState(400);          // alto del contenedor de la lista (px)
  const [, setTick] = useState(0);
  const bodyRef = useRef(null);
  const listaRef = useRef(null);
  const gesto = useRef(null);
  const ultimoGesto = useRef(0);
  const acum = useRef({ x: 0, y: 0 });
  const tAviso = useRef(0);
  const pidioReadmes = useRef(false);
  const vivo = useRef({});
  // Motor del XMB: posiciones decimales (c = eje, f = lista de la categoría activa) y sus destinos. Se anima con
  // requestAnimationFrame; mientras el dedo arrastra (arr) manda el dedo.
  const mot = useRef({ c: 0, f: 0, tc: 0, tf: 0, raf: 0, ult: 0, arr: false });
  const catR = useRef(0);
  const focosR = useRef({});                      // dónde estaba el foco en cada categoría (se recuerda al volver)
  const quieta = useRef(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  const JUEGOS = datos ? datos.juegos : [];
  const ahora = Date.now();
  const clave = CATEGORIAS[cat][0];
  const enRegistroCat = esCategoriaRegistro(clave);
  const lista = itemsDe(JUEGOS, clave, estado.ocultos, registro, ahora);
  const m = mot.current;
  const maxF = Math.max(0, lista.length - 1);
  const fv = limitar(m.f, -0.35, maxF + 0.35);                   // posición visible (con algo de elasticidad en los extremos)
  const foco = Math.round(limitar(m.f, 0, maxF));
  const enfocado = lista[foco] || null;
  const expandida = abierto !== null && enfocado !== null && enfocado.id === abierto;
  const fichaJ = fichaId === null ? null
    : fichaId.startsWith("r-") ? (registro.juegos[fichaId] ? itemsDe([], registro.juegos[fichaId].estado, {}, registro, ahora).find(j => j.id === fichaId) || null : null)
    : JUEGOS.find(j => j.id === fichaId) || null;
  vivo.current = { largo: lista.length, expandida, ficha: !!fichaJ, form: form !== null };

  // Aplica la posición del motor: si el eje cruza la mitad entre dos categorías, cambia la activa (la lista cambia
  // con ella y el foco vuelve a donde estaba en esa categoría) y redibuja.
  function aplicar() {
    const mm = mot.current;
    const nc = limitar(Math.round(mm.c), 0, CATEGORIAS.length - 1);
    if (nc !== catR.current) {
      focosR.current[catR.current] = Math.round(mm.f);
      catR.current = nc;
      mm.f = mm.tf = focosR.current[nc] || 0;
      setCat(nc);
    }
    setTick(n => (n + 1) % 1000000);
  }
  function animar(ts) {
    const mm = mot.current;
    mm.raf = 0;
    if (mm.arr) return;
    const dt = Math.min(48, mm.ult ? ts - mm.ult : 16);
    mm.ult = ts;
    const k = 1 - Math.exp(-dt / 85);
    mm.c += (mm.tc - mm.c) * k;
    mm.f += (mm.tf - mm.f) * k;
    const fin = Math.abs(mm.tc - mm.c) < 0.004 && Math.abs(mm.tf - mm.f) < 0.004;
    if (fin) { mm.c = mm.tc; mm.f = mm.tf; mm.ult = 0; }
    aplicar();
    if (fin) { focosR.current[catR.current] = Math.round(mm.f); return; }
    mm.raf = requestAnimationFrame(animar);
  }
  function arrancar() {
    const mm = mot.current;
    if (quieta.current) {                              // "reducir movimiento": directo al destino, sin animación
      if (mm.raf) { cancelAnimationFrame(mm.raf); mm.raf = 0; }
      mm.c = mm.tc; mm.f = mm.tf; aplicar(); focosR.current[catR.current] = Math.round(mm.f);
      return;
    }
    if (!mm.raf) { mm.ult = 0; mm.raf = requestAnimationFrame(animar); }
  }
  // Va a una categoría y/o a una fila (enteras) con la animación del motor. Sin argumento = se queda donde está.
  function ir(tc, tf) {
    const mm = mot.current;
    const C = tc === undefined ? catR.current : limitar(Math.round(tc), 0, CATEGORIAS.length - 1);
    mm.tc = C;
    mm.tf = C === catR.current ? limitar(Math.round(tf === undefined ? mm.f : tf), 0, Math.max(0, vivo.current.largo - 1)) : (focosR.current[C] || 0);
    arrancar();
  }
  // Salto sin animación (al agregar un juego: se muestra donde quedó).
  function saltar(c, f) {
    const mm = mot.current;
    if (mm.raf) { cancelAnimationFrame(mm.raf); mm.raf = 0; }
    focosR.current[catR.current] = Math.round(mm.f);
    catR.current = c; focosR.current[c] = f;
    mm.c = mm.tc = c; mm.f = mm.tf = f;
    setCat(c); setTick(n => (n + 1) % 1000000);
  }

  // Filas / categorías vigentes si la lista cambió por debajo (se quitó un ítem): el foco nunca queda fuera.
  useEffect(() => {
    const mm = mot.current;
    if (!mm.arr && !mm.raf && mm.f > maxF + 0.01) { mm.f = mm.tf = maxF; focosR.current[catR.current] = maxF; setTick(n => (n + 1) % 1000000); }
  });
  useEffect(() => () => { const mm = mot.current; if (mm.raf) cancelAnimationFrame(mm.raf); }, []);

  // Alto del contenedor de la lista (no de la pantalla): solo para saber qué filas están a la vista.
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return undefined;
    const medir = () => setAlto(el.clientHeight);
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rueda del mouse / trackpad (escritorio): cada ~40 px de desplazamiento mueve una fila (o una categoría en horizontal).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return undefined;
    const h = e => {
      if (vivo.current.expandida) return;
      e.preventDefault();
      const a = acum.current;
      a.x += e.deltaX; a.y += e.deltaY;
      const mm = mot.current;
      if (Math.abs(a.x) > Math.abs(a.y) && Math.abs(a.x) >= 40) { ir(mm.tc + Math.sign(a.x), undefined); a.x = a.y = 0; }
      else if (Math.abs(a.y) >= 40) { ir(undefined, mm.tf + Math.sign(a.y)); a.x = a.y = 0; }
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  // Teclado (escritorio).
  useEffect(() => {
    const h = e => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const v = vivo.current, mm = mot.current;
      if (v.form) return;
      if (v.ficha) { if (e.key === "Escape") setFichaId(null); return; }
      if (e.key === "ArrowRight") { setAbierto(null); ir(mm.tc + 1, undefined); }
      else if (e.key === "ArrowLeft") { setAbierto(null); ir(mm.tc - 1, undefined); }
      else if (e.key === "ArrowDown" && !v.expandida) { e.preventDefault(); ir(undefined, mm.tf + 1); }
      else if (e.key === "ArrowUp" && !v.expandida) { e.preventDefault(); ir(undefined, mm.tf - 1); }
      else if (e.key === "Escape" && v.expandida) setAbierto(null);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => () => clearTimeout(tAviso.current), []);

  async function cargar() {
    setError(null);
    try { setDatos(await fetchGameEnhancedData()); } catch (e) { setError(e.message || "error"); }
  }
  useEffect(() => { cargar(); }, []);
  useEffect(() => { fetchGameEnhancedFichas().then(setFichas).catch(() => {}); }, []);
  useEffect(() => { fetchGameEnhancedPlataformas().then(setPlataformas).catch(() => {}); }, []);

  // Carga única de los terminados que ya estaban en el repo (después, el registro es solo de Angst).
  useEffect(() => { if (datos && registro.sembrado == null) sembrar(datos.semilla); }, [datos, registro.sembrado]);

  // README de los decomps: se pide la primera vez que se abre la ficha de uno.
  useEffect(() => {
    if (!fichaJ || !esProyecto(fichaJ) || pidioReadmes.current) return;
    pidioReadmes.current = true;
    setCargandoReadme(true);
    fetchGameEnhancedReadmes().then(setReadmes).catch(() => setReadmes({})).finally(() => setCargandoReadme(false));
  }, [fichaJ && fichaJ.tipo]);

  // Al expandir o colapsar, la lista abierta vuelve a su inicio (N3).
  useEffect(() => { if (listaRef.current) listaRef.current.scrollTop = 0; }, [expandida, cat]);

  // Válvula (4.5): colapsado nunca debería desbordar. Es un detector, no una solución.
  useEffect(() => {
    const b = bodyRef.current;
    if (b && !expandida && b.scrollHeight > b.clientHeight + 1) console.warn(`game enhanced desborda ${b.scrollHeight - b.clientHeight} px colapsado`);
  });

  // ── Gestos: el dedo arrastra el XMB en continuo ──────────────────────────
  // Un swipe no debe disparar además el clic del elemento donde terminó el dedo.
  const clic = fn => e => { if (Date.now() - ultimoGesto.current < 350) return; fn(e); };
  const velocidad = g => {                                   // unidades (filas o categorías) por ms, en los últimos ~100 ms
    const ms = g.muestras, u = ms[ms.length - 1];
    if (!u || ms.length < 2) return 0;
    const a = ms.find(x => u[0] - x[0] <= 100) || ms[0];
    return u[0] - a[0] > 0 ? (u[1] - a[1]) / (u[0] - a[0]) : 0;
  };
  function alPresionar(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const mm = mot.current;
    if (mm.raf) { cancelAnimationFrame(mm.raf); mm.raf = 0; mm.tc = mm.c; mm.tf = mm.f; }   // tocar frena la animación
    gesto.current = { x: e.clientX, y: e.clientY, c0: mm.c, f0: mm.f, lock: null, muestras: [] };
  }
  function alMover(e) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y, mm = mot.current;
    if (g.lock === null) {
      if (Math.hypot(dx, dy) < UMBRAL_GESTO) return;
      g.lock = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (g.lock === "v" && vivo.current.expandida) { g.lock = "x"; return; }   // fila abierta: el scroll vertical es del navegador
      mm.arr = true;
      setAbierto(null);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* sin captura: sigue funcionando */ }
    }
    if (g.lock === "h") mm.c = resistir(g.c0 - dx / EJE.paso, 0, CATEGORIAS.length - 1);
    else if (g.lock === "v") mm.f = resistir(g.f0 - dy / (XMB.fila + XMB.sep), 0, Math.max(0, vivo.current.largo - 1));
    else return;
    g.muestras.push([performance.now(), g.lock === "h" ? mm.c : mm.f]);
    if (g.muestras.length > 6) g.muestras.shift();
    aplicar();
  }
  // Al soltar: la velocidad del dedo se proyecta unos ms más adelante y se encaja en la fila / categoría entera más cercana.
  function alSoltar(cancelado) {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    const mm = mot.current;
    mm.arr = false;
    if (g.lock === "h" || g.lock === "v") {
      ultimoGesto.current = Date.now();
      const horiz = g.lock === "h", tope = horiz ? 2 : 8;
      const proy = (horiz ? mm.c : mm.f) + limitar((cancelado ? 0 : velocidad(g)) * (horiz ? INERCIA_EJE_MS : INERCIA_MS), -tope, tope);
      if (g.lock === "h") ir(Math.round(proy), undefined); else ir(undefined, Math.round(proy));
    } else if (g.lock === null) ir(Math.round(mm.c), Math.round(mm.f));      // un toque que frenó una animación: encaja
  }

  function tocarFila(j, i) {
    if (i === foco && Math.abs(i - m.f) < 0.2) setAbierto(a => (a === j.id ? null : j.id));
    else { ir(undefined, i); setAbierto(null); }
  }
  function avisar(texto, deshacer) {
    clearTimeout(tAviso.current);
    setAviso({ texto, deshacer });
    tAviso.current = setTimeout(() => setAviso(null), AVISO_MS);
  }
  function descartar(j) {
    const previo = ocultar(j.id);
    setAbierto(null); setFichaId(null);
    avisar(`Oculto: ${j.titulo}`, () => deshacerOcultar(j.id, previo));
  }
  function quitar(j) {
    const prev = quitarJuego(j.id);
    setAbierto(null); setFichaId(null);
    if (prev) avisar(`Quitado: ${j.titulo}`, () => restaurarJuego(prev));
  }
  function quiero(j) {
    const titulo = tituloParaRegistro(j);
    const res = agregarJuego({ titulo, estado: "quiero" });
    if (res) avisar(`En Quiero jugar: ${titulo}`, () => (res.previo ? restaurarJuego(res.previo) : quitarJuego(res.id)));
  }
  function agregar(datosForm) {
    const res = agregarJuego(datosForm);
    setForm(null);
    if (!res) return;
    saltar(CATEGORIAS.findIndex(c => c[0] === datosForm.estado), 0);
    setAbierto(null);
    avisar(`Agregado a ${ESTADOS_INFO[datosForm.estado].etiqueta}: ${datosForm.titulo}`, () => (res.previo ? restaurarJuego(res.previo) : quitarJuego(res.id)));
  }
  function deshacer() {
    if (!aviso) return;
    aviso.deshacer();
    clearTimeout(tAviso.current);
    setAviso(null);
  }

  const r = resumen(JUEGOS, estado.ocultos, estado.guardados, registro);
  const edad = edadDatos(datos && datos.generatedAt, ahora);
  const ancho = { width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box", position: "relative", padding: "10px 16px 8px", userSelect: "none", WebkitUserSelect: "none", touchAction: expandida ? "pan-y" : "none" };
  const guardadoDe = j => !!estado.guardados[j.id];

  // Filas del carrusel: solo las que están a la vista, cada una con su disposición continua.
  const filas = [];
  if (!expandida) {
    const desde = Math.max(0, Math.floor(fv) - 4), hasta = Math.min(lista.length - 1, Math.ceil(fv) + Math.ceil(alto / (XMB.fila + XMB.sep)) + 2);
    for (let i = desde; i <= hasta; i++) {
      const L = disposicion(i, fv);
      if (L.y > alto || L.y + L.h < 0) continue;
      const j = lista[i];
      filas.push(<FilaX key={j.id} j={j} t={L.t} alto={L.h} op={L.op} foco={i === foco} guardado={guardadoDe(j)} fichas={fichas} ahora={ahora}
        estiloExtra={{ position: "absolute", left: 0, top: 0, transform: `translateY(${L.y}px)` }} onClick={clic(() => tocarFila(j, i))} />);
    }
  }
  const igdb = fichaJ && fichaJ.tipo === "r" ? fichas[fichaJ.id] || null : null;
  const cerrarFicha = () => setFichaId(null);

  return (
    <div className="gameenh" style={{ background: "#0b0b0c", position: "relative", overflow: "hidden" }}>
      <Ondas />
      <div ref={bodyRef} className="gameenh-body" data-expandido={expandida ? "true" : "false"} style={{ ...ancho, zIndex: 1 }}
        onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={() => alSoltar(false)} onPointerCancel={() => alSoltar(true)}>
        <div aria-live="polite" style={{ flex: "none", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: FUENTE, fontSize: 12, color: DIM }}>
          {aviso
            ? <><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{aviso.texto}</span>
                <button onClick={deshacer} style={{ ...reset, flex: "none", minHeight: 44, margin: "-8px 0", padding: "0 8px", color: ACC, textDecoration: "underline" }}>Deshacer</button></>
            : <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.semana} esta semana · 🏁 {r.terminados} · 🎯 {r.quiero} · ⏳ {r.pendientes} · ★ {r.guardados}</span>}
          {datos && <span style={{ ...sello, ...(edad.vieja ? { color: WARN, borderColor: WARN } : {}) }}>DATOS {edad.texto.toUpperCase()}</span>}
        </div>
        <Eje c={m.c} onElegir={i => clic(() => { setAbierto(null); ir(i, undefined); })()} mostrarMas={enRegistroCat} onMas={() => setForm(clave)} />
        <div ref={listaRef} style={expandida
          ? { flex: 1, minHeight: 0, marginTop: 2, display: "flex", flexDirection: "column", gap: XMB.sep, overflowX: "hidden", overflowY: "auto" }
          : { flex: 1, minHeight: 0, marginTop: 2, position: "relative", overflow: "hidden" }}>
          {!enRegistroCat && !datos && !error && <p style={{ margin: 0, padding: 12, fontFamily: FUENTE, fontSize: 13, color: DIM }}>Cargando…</p>}
          {!enRegistroCat && error && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", fontFamily: FUENTE, fontSize: 13, color: "#c4c4ca" }}>
              <span>No se pudieron cargar los datos de Game enhanced ({error}).</span>
              <button onClick={cargar} style={botonSec}>Reintentar</button>
            </div>)}
          {lista.length === 0 && (enRegistroCat || datos) && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", fontFamily: FUENTE, fontSize: 13, color: DIM }}>
              <span>{enRegistroCat ? `Aún no hay juegos en «${CATEGORIAS[cat][2]}».` : clave === "todo" ? "Sin novedades recientes. Mira Decomps o Estudios." : clave === "p" ? "Sin ports nuevos de clásicos en los últimos 30 días." : "No quedan ítems en esta categoría."}</span>
              {enRegistroCat && <button onClick={() => setForm(clave)} style={botonSec}>＋ Agregar juego</button>}
            </div>)}
          {lista.length > 0 && expandida && lista.slice(foco).map((j, i) => i === 0
            ? <Tarjeta key={j.id} j={j} ahora={ahora} guardado={guardadoDe(j)} fichas={fichas} enRegistro={registroDe(j, registro)}
                otras={sugerenciasDe(j, plataformas)} onCerrar={clic(() => setAbierto(null))} onFicha={clic(() => setFichaId(j.id))} onDescartar={clic(() => descartar(j))} onQuitar={clic(() => quitar(j))} onQuiero={clic(() => quiero(j))} />
            : <FilaX key={j.id} j={j} t={0} alto={XMB.fila} op={OPACIDAD[Math.min(i, OPACIDAD.length - 1)]} guardado={guardadoDe(j)} fichas={fichas} ahora={ahora} onClick={clic(() => tocarFila(j, foco + i))} />)}
          {filas}
        </div>
      </div>
      {fichaJ && (
        <Ventana onClose={cerrarFicha} ancho={460} estiloMarco={MARCO_OSCURO}>
          <VentanaCabecera titulo={ETIQUETA_FICHA[fichaJ.tipo]} onClose={cerrarFicha} grande />
          <div style={{ padding: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>
            <Ficha j={fichaJ} ahora={ahora} igdb={igdb} imagen={portadaDe(fichaJ, fichas)} guardado={guardadoDe(fichaJ)}
              enRegistro={registroDe(fichaJ, registro)} sugerencias={sugerenciasDe(fichaJ, plataformas)}
              readme={readmes ? readmes[fichaJ.id] : null} cargandoReadme={cargandoReadme}
              onGuardar={() => alternarGuardado(fichaJ.id)} onDescartar={() => descartar(fichaJ)} onQuiero={() => quiero(fichaJ)}
              onEditar={cambios => editarJuego(fichaJ.id, cambios)} onQuitar={() => quitar(fichaJ)} />
          </div>
        </Ventana>)}
      {form !== null && <FormAgregar estadoInicial={form} existentes={registro.juegos} onCancelar={() => setForm(null)} onAgregar={agregar} />}
    </div>
  );
}
