import { fetchGameEnhancedData, fetchGameEnhancedFichas, fetchGameEnhancedReadmes } from "../shared/catalog.js";
import { Ventana, VentanaCabecera } from "../shared/ui.jsx";
import { CATEGORIAS, TIPO, ESTADOS_INFO, esCategoriaRegistro, motivoDe, cuando, detalleDe, filasFicha, edadDatos, itemsDe, ventana, filasXmb, XMB, resumen, portadaUrl, portadaDe } from "./logica.js";
import { useEstado, alternarGuardado, ocultar, deshacerOcultar } from "./estado.js";
import { useRegistro, agregarJuego, editarJuego, quitarJuego, restaurarJuego, sembrar } from "./registro.js";
import { ESTADOS_REGISTRO, idRegistro } from "./lib/claves.mjs";

const { useState, useEffect, useRef, useCallback } = React;

// ─── Módulo Game enhanced (nov-2026) ────────────────────────────────────────
// Novedades de juegos que importan (decomps, ports y juegos nuevos de los estudios detrás de lo que
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
//  · N3: colapsado sin scroll (la lista es un carrusel: el foco se mueve, la lista no scrollea); el scroll
//    interno nace solo al expandir una fila o abrir la ficha.
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
const OPACIDAD = [1, 0.85, 0.7, 0.55, 0.42]; // por distancia al enfocado

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
    <span aria-hidden="true" style={{ flex: "none", width: lado, height: lado, boxSizing: "border-box", borderRadius: 10, overflow: "hidden", background: "#1b1b1f", border: resaltada ? "1.5px solid #fff" : "1px solid #2c2c31", boxShadow: resaltada ? "0 0 18px rgba(255,255,255,.22)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: lado * 0.46, transition: "width .22s ease,height .22s ease,font-size .22s ease" }}>
      {url ? <img src={url} alt="" loading="lazy" onError={() => setFalla(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : emoji}
    </span>
  );
}

function Eje({ cat, onElegir, mostrarMas, onMas }) {
  return (
    <div style={{ position: "relative", flex: "none", height: 96, marginTop: 4, overflow: "hidden" }}>
      {CATEGORIAS.map(([clave, emoji, nombre], i) => {
        const act = i === cat;
        const cx = EJE.ax + (i - cat) * EJE.paso;
        return (
          <button key={clave} onClick={() => (act ? null : onElegir(i))} aria-label={act ? `${nombre}, categoría seleccionada` : nombre} aria-current={act ? "true" : undefined}
            style={{ ...reset, position: "absolute", top: 0, left: 0, width: EJE.paso, height: 60, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: act ? 4 : 12, zIndex: act ? 1 : 2, transform: `translateX(${cx - EJE.paso / 2}px)`, opacity: act ? 1 : Math.max(0.28, 0.62 - Math.abs(i - cat) * 0.07), color: "#fff", transition: "transform .28s cubic-bezier(.2,.8,.2,1),opacity .28s ease,padding .28s ease", cursor: act ? "default" : "pointer", overflow: "visible" }}>
            <span style={{ width: act ? 56 : 40, height: act ? 56 : 40, boxSizing: "border-box", borderRadius: "50%", border: act ? "1.5px solid #fff" : "1px solid transparent", background: act ? "rgba(255,255,255,.09)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: act ? 26 : 22, transition: "width .28s ease,height .28s ease,font-size .28s ease,background .28s ease" }}>{emoji}</span>
            <span aria-hidden="true" style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontFamily: CAVEAT, fontWeight: 600, fontSize: 22, lineHeight: 1, opacity: act ? 1 : 0, transition: "opacity .28s ease" }}>{nombre}</span>
          </button>);
      })}
      {mostrarMas && <button onClick={onMas} aria-label="Agregar juego" style={{ ...reset, position: "absolute", right: 0, top: 8, width: 44, height: 44, borderRadius: "50%", border: `1px dashed ${ACC}`, color: ACC, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>＋</button>}
    </div>
  );
}

const subtitulo = (j, ahora) => (j.tipo === "r" ? detalleDe(j, ahora) : `${TIPO[j.tipo].etiqueta} · ${motivoDe(j)}`);

function FilaX({ j, d, foco, desnuda, expandida, guardado, fichas, ahora, onClick }) {
  const t = TIPO[j.tipo];
  const lado = foco ? 62 : 38;
  const sub = foco ? subtitulo(j, ahora) : "";
  const estilo = {
    flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", textAlign: "left", border: 0, background: "none",
    cursor: "pointer", fontFamily: FUENTE, color: "#fff", padding: "0 6px 0 21px",
    height: foco ? XMB.foco : XMB.fila, margin: foco && !desnuda ? `${XMB.aire / 2}px 0` : 0,
    opacity: foco ? 1 : OPACIDAD[Math.min(Math.abs(d), OPACIDAD.length - 1)], transition: "height .22s ease,opacity .22s ease,margin .22s ease",
  };
  return (
    <button onClick={onClick} style={estilo} {...(foco ? { "aria-expanded": expandida ? "true" : "false" } : {})}>
      <span style={{ flex: "none", width: 62, display: "flex", justifyContent: "center" }}><Miniatura imagen={portadaDe(j, fichas)} emoji={j.tipo === "r" ? ESTADOS_INFO[j.estado].emoji : t.emoji} lado={lado} resaltada={foco} /></span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: foco ? 17 : 14, fontWeight: foco ? 600 : 500, color: foco ? "#fff" : "#d4d4d8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "font-size .22s ease" }}>{j.titulo}{guardado ? " ★" : ""}</span>
        {foco && <span style={{ fontSize: 12, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>}
      </span>
      <span style={{ flex: "none", fontSize: 11, color: DIM }}>{cuando(j)}</span>
    </button>
  );
}

function Tarjeta({ j, ahora, guardado, fichas, enRegistro, onCerrar, onFicha, onDescartar, onQuitar, onQuiero }) {
  return (
    <div data-id={j.id} style={{ flex: "none", margin: `${XMB.aire / 2}px 0`, background: "rgba(23,23,26,.92)", border: "1px dashed #3a3a40", borderRadius: 12, paddingBottom: 12 }}>
      <FilaX j={j} d={0} foco desnuda expandida guardado={guardado} fichas={fichas} ahora={ahora} onClick={onCerrar} />
      <div style={{ padding: "4px 14px 0 95px", display: "flex", flexDirection: "column", gap: 8, fontFamily: FUENTE, fontSize: 13, color: "#c4c4ca" }}>
        <span>{detalleDe(j, ahora)}</span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onFicha} style={botonPri}>Abrir ficha</button>
          {j.tipo === "r"
            ? <button onClick={onQuitar} style={botonSec}>Quitar</button>
            : <>
                {j.tipo === "e" && !enRegistro && <button onClick={onQuiero} style={botonSec}>🎯 Quiero jugar</button>}
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

function Ficha({ j, ahora, igdb, imagen, guardado, enRegistro, readme, cargandoReadme, onVolver, onGuardar, onDescartar, onQuiero, onEditar, onQuitar }) {
  const t = TIPO[j.tipo];
  const filas = filasFicha(j, ahora, igdb);
  const resumenTexto = j.tipo === "e" ? j.resumen : j.tipo === "r" ? igdb && igdb.resumen : null;
  const sub = j.tipo === "r" ? null : detalleDe(j, ahora);
  const url = imagen ? portadaUrl(imagen, "t_cover_big") : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FUENTE, color: TXT }}>
      <button onClick={onVolver} style={{ ...reset, alignSelf: "flex-start", minHeight: 44, padding: "0 8px 0 0", fontSize: 14 }}>← Volver</button>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {url && <img src={url} alt="" style={{ flex: "none", width: 96, height: 128, objectFit: "cover", borderRadius: 8, border: "1px solid #2c2c31", background: "#1b1b1f" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ alignSelf: "flex-start", fontSize: 11, letterSpacing: "0.12em", color: ACC, border: `1px solid ${ACC}`, borderRadius: 4, padding: "2px 6px" }}>{t.etiqueta}</span>
          <h2 style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 34, lineHeight: 1, color: "#fff", margin: 0, overflowWrap: "anywhere" }}>{j.titulo}</h2>
          {sub && <p style={{ margin: 0, fontSize: 13, color: "#c4c4ca" }}>{sub}</p>}
        </div>
      </div>
      {j.tipo === "r" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ChipsEstado valor={j.estado} onElegir={e => onEditar({ estado: e })} />
          {j.estado === "terminado" && <Campo etiqueta="Terminado el" tipo="date" valor={j.fecha} onGuardar={v => onEditar({ fecha: v })} />}
          <Campo etiqueta="Plataforma" valor={j.plataforma} onGuardar={v => onEditar({ plataforma: v })} />
          <Campo etiqueta="Nota" multilinea valor={j.nota} onGuardar={v => onEditar({ nota: v })} />
        </div>
      )}
      {resumenTexto && <><Seccion>Resumen</Seccion><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#c4c4ca" }}>{resumenTexto}</p></>}
      {j.tipo === "d" && <><Seccion>Sobre el proyecto</Seccion><Readme readme={readme} cargando={cargandoReadme} repoUrl={j.url} /></>}
      {filas.length > 0 && (
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
          {filas.map(([k, v]) => [<dt key={"k" + k} style={{ color: DIM }}>{k}</dt>, <dd key={"v" + k} style={{ margin: 0, color: TXT, overflowWrap: "anywhere" }}><Valor v={v} /></dd>])}
        </dl>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {j.tipo === "r"
          ? <button onClick={onQuitar} style={botonSec}>Quitar del registro</button>
          : <>
              <button onClick={onGuardar} aria-pressed={guardado} style={botonPri}>{guardado ? "★ Guardado" : "☆ Me interesa"}</button>
              {j.tipo === "e" && (enRegistro ? <span style={{ alignSelf: "center", fontSize: 13, color: ACC }}>✓ En tu registro: {ESTADOS_INFO[enRegistro.estado].etiqueta}</span> : <button onClick={onQuiero} style={botonSec}>🎯 Quiero jugar</button>)}
              <button onClick={onDescartar} style={botonSec}>No me interesa</button>
            </>}
      </div>
      <span style={{ fontSize: 11, color: DIM }}>Datos: {j.tipo === "d" ? "awesome-decomp-games y el README del repositorio" : j.tipo === "e" ? "IGDB" : "tu registro" + (igdb ? " e IGDB" : "")}</span>
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
  const [cargandoReadme, setCargandoReadme] = useState(false);
  const [error, setError] = useState(null);
  const [cat, setCat] = useState(0);
  const [focos, setFocos] = useState({});
  const [abierto, setAbierto] = useState(null);   // id de la fila expandida (una a la vez)
  const [fichaId, setFichaId] = useState(null);
  const [form, setForm] = useState(null);         // null | estado inicial del formulario de alta
  const [aviso, setAviso] = useState(null);       // { texto, deshacer } mientras se puede deshacer
  const [cabe, setCabe] = useState(6);
  const bodyRef = useRef(null);
  const listaRef = useRef(null);
  const gesto = useRef(null);
  const ultimoGesto = useRef(0);
  const ultimaRueda = useRef(0);
  const tAviso = useRef(0);
  const pidioReadmes = useRef(false);
  const vivo = useRef({});

  const JUEGOS = datos ? datos.juegos : [];
  const ahora = Date.now();
  const clave = CATEGORIAS[cat][0];
  const enRegistroCat = esCategoriaRegistro(clave);
  const lista = itemsDe(JUEGOS, clave, estado.ocultos, registro, ahora);
  const foco = Math.min(focos[cat] || 0, Math.max(0, lista.length - 1));
  const enfocado = lista[foco] || null;
  const expandida = abierto !== null && enfocado !== null && enfocado.id === abierto;
  const fichaJ = fichaId === null ? null
    : fichaId.startsWith("r-") ? (registro.juegos[fichaId] ? itemsDe([], registro.juegos[fichaId].estado, {}, registro, ahora).find(j => j.id === fichaId) || null : null)
    : JUEGOS.find(j => j.id === fichaId) || null;
  vivo.current = { cat, foco, largo: lista.length, expandida, ficha: !!fichaJ, form: form !== null };

  const mover = useCallback((dc, df) => {
    const v = vivo.current;
    setAbierto(null);
    if (dc) setCat((v.cat + dc + CATEGORIAS.length) % CATEGORIAS.length);
    if (df) setFocos(f => ({ ...f, [v.cat]: Math.max(0, Math.min(v.largo - 1, v.foco + df)) }));
  }, []);

  // Filas enteras que caben: se mide SOLO el contenedor de la lista (no la pantalla).
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return undefined;
    const medir = () => setCabe(filasXmb(el.clientHeight));
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!fichaJ]);

  // Rueda del mouse (escritorio): mueve el foco mientras no haya fila expandida.
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return undefined;
    const h = e => {
      if (vivo.current.expandida) return;
      e.preventDefault();
      const t = Date.now();
      if (t - ultimaRueda.current < 180) return;
      ultimaRueda.current = t;
      mover(0, e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [!!fichaJ, mover]);

  // Teclado (escritorio).
  useEffect(() => {
    const h = e => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const v = vivo.current;
      if (v.form) return;
      if (v.ficha) { if (e.key === "Escape") setFichaId(null); return; }
      if (e.key === "ArrowRight") mover(1, 0);
      else if (e.key === "ArrowLeft") mover(-1, 0);
      else if (e.key === "ArrowDown" && !v.expandida) { e.preventDefault(); mover(0, 1); }
      else if (e.key === "ArrowUp" && !v.expandida) { e.preventDefault(); mover(0, -1); }
      else if (e.key === "Escape" && v.expandida) setAbierto(null);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mover]);

  useEffect(() => () => clearTimeout(tAviso.current), []);

  async function cargar() {
    setError(null);
    try { setDatos(await fetchGameEnhancedData()); } catch (e) { setError(e.message || "error"); }
  }
  useEffect(() => { cargar(); }, []);
  useEffect(() => { fetchGameEnhancedFichas().then(setFichas).catch(() => {}); }, []);

  // Carga única de los terminados que ya estaban en el repo (después, el registro es solo de Angst).
  useEffect(() => { if (datos && registro.sembrado == null) sembrar(datos.semilla); }, [datos, registro.sembrado]);

  // README de los decomps: se pide la primera vez que se abre la ficha de uno.
  useEffect(() => {
    if (!fichaJ || fichaJ.tipo !== "d" || pidioReadmes.current) return;
    pidioReadmes.current = true;
    setCargandoReadme(true);
    fetchGameEnhancedReadmes().then(setReadmes).catch(() => setReadmes({})).finally(() => setCargandoReadme(false));
  }, [fichaJ && fichaJ.tipo]);

  // Al expandir o colapsar, la lista vuelve a su inicio (N3).
  useEffect(() => { if (listaRef.current) listaRef.current.scrollTop = 0; }, [expandida, cat]);

  // Válvula (4.5): colapsado nunca debería desbordar. Es un detector, no una solución.
  const expandido = expandida || !!fichaJ;
  useEffect(() => {
    const b = bodyRef.current;
    if (b && !expandido && b.scrollHeight > b.clientHeight + 1) console.warn(`game enhanced desborda ${b.scrollHeight - b.clientHeight} px colapsado`);
  });

  // Un swipe no debe disparar además el clic del elemento donde terminó el dedo.
  const clic = fn => e => { if (Date.now() - ultimoGesto.current < 350) return; fn(e); };
  const alPresionar = e => { gesto.current = [e.clientX, e.clientY]; };
  const alSoltar = e => {
    const g = gesto.current; gesto.current = null;
    if (!g || fichaJ) return;
    const dx = e.clientX - g[0], dy = e.clientY - g[1];
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) { ultimoGesto.current = Date.now(); mover(dx < 0 ? 1 : -1, 0); }
    else if (!expandida && Math.abs(dy) > 30 && Math.abs(dy) > 1.5 * Math.abs(dx)) { ultimoGesto.current = Date.now(); mover(0, dy < 0 ? 1 : -1); }
  };

  function tocarFila(j, i) {
    if (i === foco) setAbierto(a => (a === j.id ? null : j.id));
    else { setFocos(f => ({ ...f, [cat]: i })); setAbierto(null); }
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
    const res = agregarJuego({ titulo: j.titulo, estado: "quiero" });
    if (res) avisar(`En Quiero jugar: ${j.titulo}`, () => (res.previo ? restaurarJuego(res.previo) : quitarJuego(res.id)));
  }
  function agregar(datosForm) {
    const res = agregarJuego(datosForm);
    setForm(null);
    if (!res) return;
    const i = CATEGORIAS.findIndex(c => c[0] === datosForm.estado);
    setCat(i); setFocos(f => ({ ...f, [i]: 0 })); setAbierto(null);
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
  const ancho = { width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box", position: "relative", padding: "10px 16px 8px" };
  const guardadoDe = j => !!estado.guardados[j.id];

  let cuerpo;
  if (fichaJ) {
    const igdb = fichaJ.tipo === "r" ? fichas[fichaJ.id] || null : null;
    cuerpo = (
      <Ficha j={fichaJ} ahora={ahora} igdb={igdb} imagen={portadaDe(fichaJ, fichas)} guardado={guardadoDe(fichaJ)}
        enRegistro={fichaJ.tipo === "e" ? registro.juegos[idRegistro(fichaJ.titulo)] || null : null}
        readme={readmes ? readmes[fichaJ.id] : null} cargandoReadme={cargandoReadme}
        onVolver={() => setFichaId(null)} onGuardar={() => alternarGuardado(fichaJ.id)} onDescartar={() => descartar(fichaJ)}
        onQuiero={() => quiero(fichaJ)} onEditar={cambios => editarJuego(fichaJ.id, cambios)} onQuitar={() => quitar(fichaJ)} />
    );
  } else {
    const v = ventana(lista.length, foco, cabe);
    const fila = (j, idx, props) => <FilaX key={j.id} j={j} d={idx - foco} guardado={guardadoDe(j)} fichas={fichas} ahora={ahora} onClick={clic(() => tocarFila(j, idx))} {...props} />;
    cuerpo = (
      <>
        <div aria-live="polite" style={{ flex: "none", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: FUENTE, fontSize: 12, color: DIM }}>
          {aviso
            ? <><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{aviso.texto}</span>
                <button onClick={deshacer} style={{ ...reset, flex: "none", minHeight: 44, margin: "-8px 0", padding: "0 8px", color: ACC, textDecoration: "underline" }}>Deshacer</button></>
            : <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.semana} esta semana · 🏁 {r.terminados} · 🎯 {r.quiero} · ⏳ {r.pendientes} · ★ {r.guardados}</span>}
          {datos && <span style={{ ...sello, ...(edad.vieja ? { color: WARN, borderColor: WARN } : {}) }}>DATOS {edad.texto.toUpperCase()}</span>}
        </div>
        <Eje cat={cat} onElegir={i => { setCat(i); setAbierto(null); }} mostrarMas={enRegistroCat} onMas={() => setForm(clave)} />
        <div ref={listaRef} style={{ flex: 1, minHeight: 0, marginTop: 2, display: "flex", flexDirection: "column", gap: XMB.sep, justifyContent: expandida ? "flex-start" : "space-between", overflowX: "hidden", overflowY: expandida ? "auto" : "hidden", touchAction: expandida ? "pan-y" : "none" }}>
          {!enRegistroCat && !datos && !error && <p style={{ margin: 0, padding: 12, fontFamily: FUENTE, fontSize: 13, color: DIM }}>Cargando…</p>}
          {!enRegistroCat && error && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", fontFamily: FUENTE, fontSize: 13, color: "#c4c4ca" }}>
              <span>No se pudieron cargar los datos de Game enhanced ({error}).</span>
              <button onClick={cargar} style={botonSec}>Reintentar</button>
            </div>)}
          {lista.length === 0 && (enRegistroCat || datos) && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", fontFamily: FUENTE, fontSize: 13, color: DIM }}>
              <span>{enRegistroCat ? `Aún no hay juegos en «${CATEGORIAS[cat][2]}».` : clave === "todo" ? "Sin novedades recientes. Mira Decomps o Estudios." : "No quedan ítems en esta categoría."}</span>
              {enRegistroCat && <button onClick={() => setForm(clave)} style={botonSec}>＋ Agregar juego</button>}
            </div>)}
          {lista.length > 0 && expandida && lista.slice(foco).map((j, i) => i === 0
            ? <Tarjeta key={j.id} j={j} ahora={ahora} guardado={guardadoDe(j)} fichas={fichas} enRegistro={j.tipo === "e" ? registro.juegos[idRegistro(j.titulo)] || null : null}
                onCerrar={clic(() => setAbierto(null))} onFicha={clic(() => setFichaId(j.id))} onDescartar={clic(() => descartar(j))} onQuitar={clic(() => quitar(j))} onQuiero={clic(() => quiero(j))} />
            : fila(j, foco + i))}
          {lista.length > 0 && !expandida && lista.slice(v.ini, v.fin).map((j, i) => { const idx = v.ini + i; return fila(j, idx, { foco: idx === foco }); })}
        </div>
      </>
    );
  }

  return (
    <div className="gameenh" style={{ background: "#0b0b0c", position: "relative", overflow: "hidden" }}>
      <Ondas />
      <div ref={bodyRef} className="gameenh-body" data-expandido={expandido ? "true" : "false"} data-ficha={fichaJ ? "true" : "false"}
        style={{ ...ancho, zIndex: 1 }} onPointerDown={alPresionar} onPointerUp={alSoltar} onPointerCancel={() => { gesto.current = null; }}>
        {cuerpo}
      </div>
      {form !== null && <FormAgregar estadoInicial={form} existentes={registro.juegos} onCancelar={() => setForm(null)} onAgregar={agregar} />}
    </div>
  );
}
