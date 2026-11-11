import { JUEGOS, SIMULADO } from "./datos.js";
import { CATEGORIAS, TIPO, motivoDe, haceDias, itemsDe, ventana, filasQueCaben, resumen } from "./logica.js";
import { useEstado, alternarGuardado, ocultar, deshacerOcultar } from "./estado.js";

const { useState, useEffect, useRef, useCallback } = React;

// ─── Módulo Game enhanced (nov-2026) ────────────────────────────────────────
// Novedades de juegos que importan: decomps, versiones web, juegos nuevos de los estudios detrás
// de lo que terminaste y sucesores espirituales. Menú en cruz inspirado en el de la PSX:
// categorías en horizontal (✨ 🧩 🌐 🏢 👻), ítems en vertical con el enfocado fijo arriba.
//
// Lineamiento (docs/angst-lineamiento-y-handoff.md §4):
//  · N1: montado sobre el marco `.app-fit` de core/App.jsx (clases .gameenh / .gameenh-body).
//    No se mide la pantalla: solo el propio contenedor de la lista (ResizeObserver) para saber
//    cuántas filas ENTERAS caben.
//  · N2: excepción propuesta (el menú en cruz es un patrón nuevo, aprobado por Cristopher el
//    10-nov-2026 como carrusel que escala, igual que Vitrina): franja de estado arriba +
//    filas que se expanden en línea y de a una + ficha como estado expandido.
//  · N3: colapsado sin scroll (la lista es un carrusel: el foco se mueve, la lista no scrollea);
//    el scroll interno nace solo al expandir una fila o abrir la ficha.
//  · R6: sin título propio. R7: Caveat + DM Sans, emojis como iconos, fondo oscuro.
//
// Datos: SIMULADOS por ahora (datos.js). Persistencia: estado.js (guardados / ocultos).

const FUENTE = "'DM Sans',sans-serif";
const CAVEAT = "'Caveat',cursive";
const ROJO = "#e5383b";
const ROJO_TEXTO = "#ff5a5f";
const FONDO = "radial-gradient(120% 45% at 15% 20%,rgba(229,56,59,.18),rgba(229,56,59,0) 62%),radial-gradient(110% 40% at 95% 80%,rgba(255,255,255,.06),rgba(255,255,255,0) 60%),#0b0b0c";
const TONOS = ["#d4d4d8", "#c4c4ca", "#b8b8be", "#acacb2", "#a8a8ae", "#a4a4aa", "#a0a0a6"];
const AVISO_MS = 6000;

const reset = { background: "none", border: 0, padding: 0, color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", cursor: "pointer" };
const botonPri = { minHeight: 44, padding: "0 16px", borderRadius: 8, background: "#fff", color: "#0b0b0c", border: 0, fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const botonSec = { minHeight: 44, padding: "0 16px", borderRadius: 8, background: "transparent", color: "#eaeaea", border: "1px solid #4a4a50", fontFamily: FUENTE, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const sello = { flex: "none", fontFamily: FUENTE, fontSize: 10, letterSpacing: "0.14em", border: "1px solid #6a6a70", borderRadius: 4, padding: "2px 6px", color: "#b5b5bb" };

function Barra({ pct }) {
  return (
    <div role="img" aria-label={`Avance ${pct} %`} style={{ height: 4, background: "#2a2a2e", borderRadius: 2 }}>
      <div style={{ width: `${pct}%`, height: 4, background: ROJO, borderRadius: 2 }} />
    </div>
  );
}

function Fila({ j, foco, desnuda, expandida, guardado, tono, onClick }) {
  const t = TIPO[j.tipo];
  const estilo = {
    flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", height: 56, boxSizing: "border-box",
    textAlign: "left", borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: "0 solid transparent", cursor: "pointer", fontFamily: FUENTE, borderRadius: 10,
    ...(desnuda
      ? { background: "none", padding: "0 10px 0 9px", color: "#fff" }
      : foco
        ? { background: "#17171a", borderLeft: `3px solid ${ROJO}`, padding: "0 10px 0 9px", color: "#fff" }
        : { background: "none", padding: "0 10px 0 12px", color: tono || "#d4d4d8" }),
  };
  return (
    <button onClick={onClick} style={estilo} {...(foco ? { "aria-expanded": expandida ? "true" : "false" } : {})}>
      <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, boxSizing: "border-box", borderRadius: 10, background: "#1b1b1f", border: "1px solid #2c2c31", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{t.emoji}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.titulo}{guardado ? " ★" : ""}</span>
        <span style={{ fontSize: 12, color: "#9a9aa0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.etiqueta} · {motivoDe(j)}</span>
      </span>
      <span style={{ flex: "none", fontSize: 11, color: "#9a9aa0" }}>{haceDias(j.dias)}</span>
    </button>
  );
}

function Tarjeta({ j, guardado, onCerrar, onFicha, onDescartar }) {
  return (
    <div data-id={j.id} style={{ flex: "none", background: "#17171a", borderLeft: `3px solid ${ROJO}`, borderRadius: 10, paddingBottom: 12 }}>
      <Fila j={j} foco desnuda expandida guardado={guardado} onClick={onCerrar} />
      <div style={{ padding: "4px 12px 0 61px", display: "flex", flexDirection: "column", gap: 8, fontFamily: FUENTE, fontSize: 13, color: "#c4c4ca" }}>
        <span>{j.detalle}</span>
        {j.avance != null && <Barra pct={j.avance} />}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onFicha} style={botonPri}>Abrir ficha</button>
          <button onClick={onDescartar} style={botonSec}>No me interesa</button>
        </div>
      </div>
    </div>
  );
}

function Ficha({ j, guardado, onVolver, onGuardar, onDescartar }) {
  const t = TIPO[j.tipo];
  const filas = [["Tipo", t.etiqueta], ["Por qué lo ves", motivoDe(j)], ["Plataforma", j.plataforma], ["Novedad", haceDias(j.dias)]];
  if (j.pideRom) filas.push(["¿Pide tu ROM?", j.pideRom]);
  filas.push(["Fuente", SIMULADO ? "[enlace simulado]" : "—"]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FUENTE, color: "#eaeaea" }}>
      <button onClick={onVolver} style={{ ...reset, alignSelf: "flex-start", minHeight: 44, padding: "0 8px 0 0", fontSize: 14 }}>← Volver</button>
      <span style={{ alignSelf: "flex-start", fontSize: 11, letterSpacing: "0.12em", color: ROJO_TEXTO, border: `1px solid ${ROJO_TEXTO}`, borderRadius: 4, padding: "2px 6px" }}>{t.etiqueta}{SIMULADO ? " · SIMULADO" : ""}</span>
      <h2 style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 34, lineHeight: 1, color: "#fff", margin: 0 }}>{j.titulo}</h2>
      <p style={{ margin: 0, fontSize: 14, color: "#c4c4ca" }}>{j.detalle}</p>
      {j.avance != null && <Barra pct={j.avance} />}
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
        {filas.map(([k, v]) => [<dt key={"k" + k} style={{ color: "#9a9aa0" }}>{k}</dt>, <dd key={"v" + k} style={{ margin: 0, color: "#eaeaea" }}>{v}</dd>])}
      </dl>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onGuardar} aria-pressed={guardado} style={botonPri}>{guardado ? "★ Guardado" : "☆ Me interesa"}</button>
        <button onClick={onDescartar} style={botonSec}>No me interesa</button>
      </div>
    </div>
  );
}

export default function GameEnhancedPage() {
  const estado = useEstado();
  const [cat, setCat] = useState(0);
  const [focos, setFocos] = useState({});
  const [abierto, setAbierto] = useState(null);   // id de la fila expandida (una a la vez)
  const [fichaId, setFichaId] = useState(null);
  const [aviso, setAviso] = useState(null);       // { id, titulo, previo } mientras se puede deshacer
  const [cabe, setCabe] = useState(6);
  const bodyRef = useRef(null);
  const listaRef = useRef(null);
  const gesto = useRef(null);
  const ultimoGesto = useRef(0);
  const ultimaRueda = useRef(0);
  const tAviso = useRef(0);
  const vivo = useRef({});

  const lista = itemsDe(JUEGOS, CATEGORIAS[cat][0], estado.ocultos);
  const foco = Math.min(focos[cat] || 0, Math.max(0, lista.length - 1));
  const enfocado = lista[foco] || null;
  const expandida = abierto !== null && enfocado !== null && enfocado.id === abierto;
  const ficha = fichaId !== null ? JUEGOS.find(j => j.id === fichaId) || null : null;
  vivo.current = { cat, foco, largo: lista.length, expandida, ficha: !!ficha };

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
    const medir = () => setCabe(filasQueCaben(el.clientHeight));
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!ficha]);

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
  }, [!!ficha, mover]);

  // Teclado (escritorio).
  useEffect(() => {
    const h = e => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const v = vivo.current;
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

  // Al expandir o colapsar, la lista vuelve a su inicio (N3).
  useEffect(() => { if (listaRef.current) listaRef.current.scrollTop = 0; }, [expandida, cat]);

  // Válvula (4.5): colapsado nunca debería desbordar. Es un detector, no una solución.
  const expandido = expandida || !!ficha;
  useEffect(() => {
    const b = bodyRef.current;
    if (b && !expandido && b.scrollHeight > b.clientHeight + 1) console.warn(`game enhanced desborda ${b.scrollHeight - b.clientHeight} px colapsado`);
  });

  // Un swipe no debe disparar además el clic del elemento donde terminó el dedo.
  const clic = fn => e => { if (Date.now() - ultimoGesto.current < 350) return; fn(e); };
  const alPresionar = e => { gesto.current = [e.clientX, e.clientY]; };
  const alSoltar = e => {
    const g = gesto.current; gesto.current = null;
    if (!g || ficha) return;
    const dx = e.clientX - g[0], dy = e.clientY - g[1];
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) { ultimoGesto.current = Date.now(); mover(dx < 0 ? 1 : -1, 0); }
    else if (!expandida && Math.abs(dy) > 30 && Math.abs(dy) > 1.5 * Math.abs(dx)) { ultimoGesto.current = Date.now(); mover(0, dy < 0 ? 1 : -1); }
  };

  function tocarFila(j, i) {
    if (i === foco) setAbierto(a => (a === j.id ? null : j.id));
    else { setFocos(f => ({ ...f, [cat]: i })); setAbierto(null); }
  }
  function descartar(j) {
    const previo = ocultar(j.id);
    setAbierto(null); setFichaId(null);
    clearTimeout(tAviso.current);
    setAviso({ id: j.id, titulo: j.titulo, previo });
    tAviso.current = setTimeout(() => setAviso(null), AVISO_MS);
  }
  function deshacer() {
    if (!aviso) return;
    deshacerOcultar(aviso.id, aviso.previo);
    clearTimeout(tAviso.current);
    setAviso(null);
  }

  const r = resumen(JUEGOS, estado.ocultos, estado.guardados);
  const ancho = { width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box", position: "relative", padding: "10px 16px 8px" };

  let cuerpo;
  if (ficha) {
    cuerpo = (
      <Ficha j={ficha} guardado={!!estado.guardados[ficha.id]} onVolver={() => setFichaId(null)}
        onGuardar={() => alternarGuardado(ficha.id)} onDescartar={() => descartar(ficha)} />
    );
  } else {
    const v = ventana(lista.length, foco, cabe);
    cuerpo = (
      <>
        <div aria-live="polite" style={{ flex: "none", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: FUENTE, fontSize: 12, color: "#9a9aa0" }}>
          {aviso
            ? <><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Oculto: {aviso.titulo}</span>
                <button onClick={deshacer} style={{ ...reset, flex: "none", minHeight: 44, margin: "-8px 0", padding: "0 8px", color: ROJO_TEXTO, textDecoration: "underline" }}>Deshacer</button></>
            : <span>{r.semana} esta semana · {r.deEstudios} de tus estudios · ★ {r.guardados}</span>}
          {SIMULADO && <span style={sello}>SIMULADO</span>}
        </div>
        <div style={{ flex: "none", height: 84, marginTop: 6, display: "flex", alignItems: "flex-start", gap: 8 }}>
          {CATEGORIAS.map(([clave, emoji, nombre], i) => i === cat
            ? (
              <button key={clave} onClick={clic(() => {})} aria-label={`${nombre}, categoría seleccionada`} style={{ ...reset, width: 100, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, color: "#fff" }}>
                <span aria-hidden="true" style={{ width: 52, height: 52, boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid #eaeaea", background: "rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{emoji}</span>
                <span style={{ fontFamily: CAVEAT, fontWeight: 600, fontSize: 22, lineHeight: 1 }}>{nombre}</span>
              </button>)
            : (
              <button key={clave} onClick={clic(() => { setCat(i); setAbierto(null); })} aria-label={nombre} style={{ ...reset, width: 60, height: 52, fontSize: 24, opacity: 0.6 }}>{emoji}</button>))}
        </div>
        <div ref={listaRef} style={{ flex: 1, minHeight: 0, marginTop: 6, display: "flex", flexDirection: "column", gap: 5, justifyContent: expandida ? "flex-start" : "space-between", overflowX: "hidden", overflowY: expandida ? "auto" : "hidden", touchAction: expandida ? "pan-y" : "none" }}>
          {lista.length === 0 && <p style={{ margin: 0, padding: 12, fontFamily: FUENTE, fontSize: 13, color: "#9a9aa0" }}>No quedan ítems en esta categoría.</p>}
          {lista.length > 0 && expandida && lista.slice(foco).map((j, i) => i === 0
            ? <Tarjeta key={j.id} j={j} guardado={!!estado.guardados[j.id]} onCerrar={clic(() => setAbierto(null))} onFicha={clic(() => setFichaId(j.id))} onDescartar={clic(() => descartar(j))} />
            : <Fila key={j.id} j={j} guardado={!!estado.guardados[j.id]} tono={TONOS[Math.min(i - 1, TONOS.length - 1)]} onClick={clic(() => tocarFila(j, foco + i))} />)}
          {lista.length > 0 && !expandida && lista.slice(v.ini, v.fin).map((j, i) => {
            const idx = v.ini + i;
            return <Fila key={j.id} j={j} foco={idx === foco} guardado={!!estado.guardados[j.id]} tono={TONOS[Math.min(Math.max(0, idx - foco - 1), TONOS.length - 1)]} onClick={clic(() => tocarFila(j, idx))} />;
          })}
        </div>
      </>
    );
  }

  return (
    <div className="gameenh" style={{ background: FONDO }}>
      <div ref={bodyRef} className="gameenh-body" data-expandido={expandido ? "true" : "false"} data-ficha={ficha ? "true" : "false"}
        style={ancho} onPointerDown={alPresionar} onPointerUp={alSoltar} onPointerCancel={() => { gesto.current = null; }}>
        {cuerpo}
      </div>
    </div>
  );
}
