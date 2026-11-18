import { idRegistro, repoDeUrl } from "./lib/claves.mjs";

// ─── Lógica pura de Game enhanced (sin React ni red, probada en tests/gameenhanced.mjs) ─────────
// Tipos que hoy tienen fuente real: d (decomps, ports y recompilaciones) y e (juegos nuevos de los
// estudios). Versiones web y sucesores espirituales quedaron fuera hasta tener fuente (sonda 11-nov-2026).
// r = juego del registro propio (terminado / quiero jugar / pendiente), issue #43.
export const TIPO = {
  d: { etiqueta: "DECOMP", emoji: "🧩", motivo: "Porque terminaste " },
  e: { etiqueta: "ESTUDIO", emoji: "🏢", motivo: "Del estudio detrás de " },
  r: { etiqueta: "JUEGO", emoji: "🎮", motivo: "" },
};

export const ESTADOS_INFO = {
  terminado: { emoji: "🏁", etiqueta: "Terminado" },
  quiero: { emoji: "🎯", etiqueta: "Quiero jugar" },
  pendiente: { emoji: "⏳", etiqueta: "Pendiente" },
};
export const esCategoriaRegistro = clave => Object.prototype.hasOwnProperty.call(ESTADOS_INFO, clave);

// [clave de filtro, emoji, nombre]. "todo" = Novedades: lo que se movió hace poco, mezclado.
export const CATEGORIAS = [
  ["todo", "✨", "Novedades"],
  ["d", "🧩", "Decomps"],
  ["e", "🏢", "Estudios"],
  ["terminado", "🏁", "Terminados"],
  ["quiero", "🎯", "Quiero jugar"],
  ["pendiente", "⏳", "Pendientes"],
];

export const SUBTIPOS = {
  decompilation: "Decompilación", "static-recomp": "Recompilación estática", "source-port": "Source port",
  "engine-remake": "Reimplementación del motor", disassembly: "Desensamblado", "browser-port": "Port web",
};
const ASSETS = { byo: "Sí, con tu propia copia", instant: "No, se juega al instante", demo: "Solo la demo", unknown: "Sin dato" };

// Ventana de "Novedades": decomps con actividad en los últimos 90 días (y no inactivos); juegos de
// estudios lanzados hace ≤120 días o que salen en ≤240. Las categorías Decomps y Estudios muestran todo.
const VENTANA = { decompDias: 90, pasadoEstudio: 120, futuroEstudio: 240 };
export const enNovedades = j => (j.tipo === "r" ? false : j.tipo === "d" ? !j.inactivo && j.dias <= VENTANA.decompDias : j.dias >= -VENTANA.futuroEstudio && j.dias <= VENTANA.pasadoEstudio);

export const motivoDe = j => (j.tipo === "r" ? ESTADOS_INFO[j.estado].etiqueta : TIPO[j.tipo].motivo + j.tuJuego);

export function haceDias(n) {
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  if (n < 60) return `hace ${n} d`;
  if (n < 730) return `hace ${Math.round(n / 30)} m`;
  return `hace ${Math.round(n / 365)} a`;
}

export function diasDesdeIso(iso, ahora) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.round((ahora - t) / 86400000) : null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaLegible(j) {
  if (!j.fecha) return "—";
  if (j.fechaAprox) return `${j.fecha.slice(0, 4)} (fecha por confirmar)`;
  const [a, m, d] = j.fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

// Texto corto a la derecha de cada fila.
export function cuando(j) {
  if (j.tipo === "r") return j.estado === "terminado" && !j.fecha ? "" : haceDias(j.dias);
  if (j.tipo === "e" && j.dias < 0) return j.fechaAprox ? `en ${j.fecha.slice(0, 4)}` : j.dias < -60 ? `en ${Math.round(-j.dias / 30)} m` : `en ${-j.dias} d`;
  return j.dias >= 9999 ? "—" : haceDias(j.dias);
}

const miles = n => (typeof n === "number" ? n.toLocaleString("es-CL") : "—");

// Línea de detalle de la tarjeta expandida.
export function detalleDe(j, ahora) {
  if (j.tipo === "r") {
    const ei = ESTADOS_INFO[j.estado];
    return [`${ei.emoji} ${ei.etiqueta}`, j.plataforma, j.estado === "terminado" && j.fecha ? `terminado el ${fechaLegible(j)}` : null, j.nota ? (j.nota.length > 80 ? j.nota.slice(0, 79) + "…" : j.nota) : null].filter(Boolean).join(" · ");
  }
  if (j.tipo === "d") {
    const c = diasDesdeIso(j.ultimoCommit, ahora);
    return [SUBTIPOS[j.subtipo] || j.subtipo, j.plataforma, `⭐ ${miles(j.estrellas)}`, c === null ? null : `último commit ${haceDias(c)}`, j.inactivo ? "inactivo" : null, j.ia ? "hecho con IA según la fuente" : null].filter(Boolean).join(" · ");
  }
  return [j.plataformas && j.plataformas.length ? j.plataformas.join(" · ") : null, j.dias < 0 ? `sale ${j.fechaAprox ? "en " + j.fecha.slice(0, 4) : fechaLegible(j)}` : `salió ${fechaLegible(j)}`].filter(Boolean).join(" · ");
}

// Enlaces a los releases de un decomp (solo repos de GitHub con una versión publicada): la página de la última
// versión y la lista completa. null si no hay repo de GitHub o no hay versión.
export function enlacesRelease(j) {
  const repo = repoDeUrl(j.url);
  if (!repo || !j.release) return null;
  return { version: `https://github.com/${repo}/releases/tag/${encodeURIComponent(j.release)}`, todas: `https://github.com/${repo}/releases` };
}

// Filas de la ficha: [etiqueta, texto | { href, texto }]. Solo filas con dato: nada de "Sin dato" ni "No" de relleno.
// `igdb` = ficha de IGDB del juego del registro (portada, resumen, géneros…), si el pipeline ya la armó.
export function filasFicha(j, ahora, igdb = null) {
  const enlace = (href, texto) => (typeof href === "string" && href.startsWith("https://") ? { href, texto } : null);
  const filas = [];
  const add = (k, v) => { if (v !== null && v !== undefined && v !== "" && v !== "—") filas.push([k, v]); };
  if (j.tipo === "d") {
    const c = diasDesdeIso(j.ultimoCommit, ahora), r = diasDesdeIso(j.fechaRelease, ahora);
    add("Proyecto", SUBTIPOS[j.subtipo] || j.subtipo); add("Por qué lo ves", motivoDe(j)); add("Tus juegos", (j.tuyos || []).join(", "));
    add("Plataforma", j.plataforma); add("Estrellas", typeof j.estrellas === "number" ? miles(j.estrellas) : null);
    add("Último commit", c === null ? null : haceDias(c));
    const rel = enlacesRelease(j), vTexto = j.release ? `${j.release}${r === null ? "" : " (" + haceDias(r) + ")"}` : null;
    add("Última versión", vTexto && (rel ? enlace(rel.version, vTexto) : vTexto));
    add("Todas las versiones", rel ? enlace(rel.todas, "Releases") : null);
    add("Jugar en el navegador", j.jugableUrl ? enlace(j.jugableUrl, "Abrir") : null);
    add("¿Pide tu ROM o archivos?", ASSETS[j.pideAssets] && j.pideAssets !== "unknown" ? ASSETS[j.pideAssets] : null);
    add("Hecho con IA (según la fuente)", j.ia ? "Sí" : null); add("Estado", j.inactivo ? "Inactivo o archivado" : "Activo");
    add("Fuente", enlace(j.url, "Repositorio"));
    return filas;
  }
  if (j.tipo === "e") {
    add("Estudio", j.estudio); add("Por qué lo ves", motivoDe(j)); add("Tus juegos", (j.tuyos || []).join(", "));
    add("Géneros", (j.generos || []).join(" · ")); add("Plataformas", j.plataformas && j.plataformas.length ? j.plataformas.join(" · ") : null);
    add("Fecha", j.fecha ? fechaLegible(j) : null); add("Fuente", enlace(j.url, "IGDB"));
    return filas;
  }
  const ei = ESTADOS_INFO[j.estado];
  add("Estado", `${ei.emoji} ${ei.etiqueta}`); add("Plataforma", j.plataforma);
  add("Terminado el", j.estado === "terminado" && j.fecha ? fechaLegible(j) : null);
  if (igdb) {
    add("Géneros", (igdb.generos || []).join(" · ")); add("Lanzamiento", igdb.lanzamiento ? fechaLegible({ fecha: igdb.lanzamiento }) : null);
    add("Plataformas (IGDB)", (igdb.plataformas || []).join(" · ")); add("Fuente", enlace(igdb.url, "IGDB"));
  }
  return filas;
}

// Lo que se comparte de un ítem (menú nativo del celular o portapapeles): título, una línea de contexto y el enlace.
// De un decomp, además, su última versión con el enlace al release. No incluye la nota personal de un juego del registro.
export function textoCompartir(j, igdb = null, ahora = Date.now()) {
  const lineas = [j.titulo];
  let url = null;
  if (j.tipo === "r") {
    const ei = ESTADOS_INFO[j.estado];
    lineas.push([`${ei.emoji} ${ei.etiqueta}`, j.plataforma].filter(Boolean).join(" · "));
    url = igdb && typeof igdb.url === "string" && igdb.url.startsWith("https://") ? igdb.url : null;
  } else {
    lineas.push(detalleDe(j, ahora));
    if (j.tipo === "d") { const rel = enlacesRelease(j); if (rel) lineas.push(`Última versión ${j.release}: ${rel.version}`); }
    url = typeof j.url === "string" && j.url.startsWith("https://") ? j.url : null;
  }
  return { titulo: j.titulo, texto: lineas.filter(Boolean).join("\n"), url };
}

// Juegos del registro de un estado, como ítems de lista: los terminados por fecha de término (o, sin fecha, por cuándo
// se tocaron), los demás por última actualización; los más recientes primero.
export function itemsRegistro(registro, estado, ahora = Date.now()) {
  const marca = j => (j.fecha ? new Date(j.fecha).getTime() : j.actualizado || 0);
  return Object.values((registro && registro.juegos) || {})
    .filter(j => j.estado === estado)
    .map(j => ({ ...j, tipo: "r", dias: marca(j) ? Math.round((ahora - marca(j)) / 86400000) : 9999 }))
    .sort((a, b) => marca(b) - marca(a) || (a.titulo.toLowerCase() < b.titulo.toLowerCase() ? -1 : 1));
}

// Ítems de una categoría, sin los ocultos, los más cercanos a hoy primero (pasados y futuros por igual).
// Las categorías del registro (terminado / quiero / pendiente) salen del registro propio, no de los datos del pipeline.
export function itemsDe(juegos, clave, ocultos = {}, registro = null, ahora = Date.now()) {
  if (esCategoriaRegistro(clave)) return itemsRegistro(registro, clave, ahora);
  return juegos
    .filter(j => !ocultos[j.id] && (j.tipo === "d" || j.tipo === "e") && (clave === "todo" ? enNovedades(j) : j.tipo === clave))
    .sort((a, b) => Math.abs(a.dias) - Math.abs(b.dias) || (a.id < b.id ? -1 : 1));
}

// ── Disposición continua del XMB ──────────────────────────────────────────
// La lista no salta de fila en fila: `f` es la posición (decimal) del foco entre las filas, así el dedo la arrastra
// libremente y la inercia la frena en una fila entera. Todo es geometría pura: cada fila `i` ocupa [y, y+h] y tiene
// un grado de "enfocada" `t` (0–1: más grande, con subtítulo) y una opacidad que baja con la distancia.
export const XMB = { foco: 78, fila: 50, sep: 4, aire: 14, arriba: 2 };
export const OPACIDAD = [1, 0.85, 0.7, 0.55, 0.42];   // por distancia (en filas) al enfocado

// Dónde queda el borde superior del enfocado: arriba del todo al empezar la lista; a medida que se avanza deja
// ver hasta `arriba` filas anteriores, como el XMB real, y ahí se queda.
export const anclaXmb = (f, o = XMB) => o.aire / 2 + Math.min(Math.max(f, 0), o.arriba) * (o.fila + o.sep + o.aire);

export function disposicion(i, f, o = XMB) {
  const d = i - f, a = Math.abs(d);
  const t = Math.max(0, 1 - a);
  const paso = o.fila + o.sep, P = paso + o.aire, A = anclaXmb(f, o);
  const y = d >= 0
    ? (d <= 1 ? A + d * (o.foco + o.aire) : A + o.foco + o.aire + (d - 1) * paso)
    : (d >= -1 ? A + d * P : A - P + (d + 1) * paso);
  const k = Math.min(a, OPACIDAD.length - 1), k0 = Math.floor(k), k1 = Math.min(k0 + 1, OPACIDAD.length - 1);
  return { y, h: o.fila + (o.foco - o.fila) * t, t, op: OPACIDAD[k0] + (OPACIDAD[k1] - OPACIDAD[k0]) * (k - k0) };
}

// Franja de estado: lo que se consulta a diario.
export function resumen(juegos, ocultos = {}, guardados = {}, registro = null) {
  const v = juegos.filter(j => (j.tipo === "d" || j.tipo === "e") && !ocultos[j.id]);
  const reg = Object.values((registro && registro.juegos) || {});
  return {
    semana: v.filter(j => Math.abs(j.dias) <= 7).length,
    deEstudios: v.filter(j => j.tipo === "e" && enNovedades(j)).length,
    guardados: v.filter(j => guardados[j.id]).length,
    terminados: reg.filter(j => j.estado === "terminado").length,
    quiero: reg.filter(j => j.estado === "quiero").length,
    pendientes: reg.filter(j => j.estado === "pendiente").length,
  };
}

// Portada de IGDB: image_id → URL (solo ids de letras y números). `tam`: t_cover_small (90 px), t_cover_big (264 px).
export const portadaUrl = (imageId, tam = "t_cover_big") => (typeof imageId === "string" && /^[a-z0-9]+$/i.test(imageId) ? `https://images.igdb.com/igdb/image/upload/${tam}/${imageId}.jpg` : null);

// image_id de la portada de un ítem: la suya (estudios), la ficha del registro (juegos del registro) o la del juego
// tuyo que motiva el decomp (así los decomps también muestran portada).
export function portadaDe(j, fichas = {}) {
  if (j.tipo === "e") return j.portada || null;
  if (j.tipo === "r") return (fichas[j.id] && fichas[j.id].portada) || null;
  const id = idRegistro(j.tuJuego);
  return (id && fichas[id] && fichas[id].portada) || null;
}

// Antigüedad de los datos para el sello de la franja.
export function edadDatos(generatedAt, ahora) {
  const t = generatedAt ? new Date(generatedAt).getTime() : NaN;
  if (!Number.isFinite(t)) return { texto: "sin fecha", vieja: true };
  const h = Math.max(0, Math.round((ahora - t) / 3600000));
  return { texto: h < 1 ? "hace <1 h" : h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`, vieja: h > 36 };
}
