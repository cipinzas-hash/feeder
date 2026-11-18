// ─── Funciones puras del pipeline de Game enhanced (probadas en tests/gameenhanced.mjs) ─────────────
// Sin red ni disco: reciben datos ya descargados. Las usa build-game-enhanced.mjs.
import { ESTADOS_REGISTRO, repoDeUrl } from "../../../gameenhanced/lib/claves.mjs";
export { repoDeUrl };

export const DIA = 86400000;

export const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Días desde `iso` hasta `ahora` (negativo si está en el futuro). null si no hay fecha válida.
export function diasDesde(iso, ahora) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.round((ahora - t) / DIA) : null;
}

// ── 1) awesome-decomp-games ─────────────────────────────────────────────────
// Un proyecto casa con un terminado si el título del proyecto, sin el paréntesis final con el nombre del
// repo/port ("Wolfenstein 3D (ECWolf)" → "Wolfenstein 3D"), es el mismo título, o ese título más una
// palabra de edición ("Remastered", "HD", "DX"…). Las secuelas NO cuentan (Tekken Tag Tournament 2,
// Final Fantasy XI…): antes se cruzaba por "contiene" y mezclaba sagas enteras.
const EDICIONES = new Set(["remastered", "remaster", "hd", "dx", "directorscut", "definitiveedition", "remake", "fullbody", "goldedition", "specialedition"]);
const SUFIJO_PAREN = /\s*\((?:[^()]|\([^()]*\))*\)\s*$/;

export function tituloLimpio(titulo) {
  let t = String(titulo || "");
  for (let i = 0; i < 3 && SUFIJO_PAREN.test(t); i++) t = t.replace(SUFIJO_PAREN, "");
  return t;
}

export function casaConTerminado(tituloProyecto, busqueda) {
  const k = norm(tituloLimpio(tituloProyecto)), clave = norm(busqueda);
  if (!clave || !k) return false;
  return k === clave || (k.startsWith(clave) && EDICIONES.has(k.slice(clave.length)));
}

export function proyectosDeDecomps(juegosFuente, terminados, ahora) {
  const porId = new Map();
  for (const t of terminados) {
    for (const j of juegosFuente) {
      if (j.type === "tool" || !casaConTerminado(j.title, t.busqueda)) continue;
      const it = porId.get(j.id) || {
        id: "d-" + j.id, tipo: "d", titulo: j.title, subtipo: j.type, plataforma: j.platform || null,
        estrellas: j.stars ?? null, ultimoCommit: j.last_commit || null, release: j.release || null, fechaRelease: j.release_date || null,
        url: j.url || null, jugableUrl: j.play_url || null, pideAssets: j.needs_assets || null,
        ia: !!j.ai_flag, inactivo: !!(j.inactive || j.archived), tuyos: [],
      };
      if (!it.tuyos.includes(t.titulo)) it.tuyos.push(t.titulo);
      porId.set(j.id, it);
    }
  }
  return [...porId.values()].map(it => {
    const d = [diasDesde(it.ultimoCommit, ahora), diasDesde(it.fechaRelease, ahora)].filter(x => x !== null);
    return { ...it, tuJuego: it.tuyos[0], dias: d.length ? Math.max(0, Math.min(...d)) : 9999 };
  }).sort((a, b) => a.dias - b.dias || (a.id < b.id ? -1 : 1));
}

// ── 2) IGDB ─────────────────────────────────────────────────────────────────
// Tipos de juego de IGDB que cuentan como "juego nuevo": principal (0), expansión independiente (4) y remake (8).
// Quedan fuera DLC, paquetes, mods, remasterizaciones, ediciones ampliadas y ports (son el ruido de Namco, SNK, Konami…).
export const TIPOS_IGDB_VALIDOS = new Set([0, 4, 8]);
const NOMBRE_RUIDO = /^arcade archives\b|\bmaster collection\b|\banniversary collection\b/i;

export function esJuegoNuevoValido(g) {
  const tipo = g.game_type ?? g.category ?? 0;
  const t = typeof tipo === "object" && tipo !== null ? tipo.id : tipo;
  return TIPOS_IGDB_VALIDOS.has(t) && !g.version_parent && !NOMBRE_RUIDO.test(g.name || "");
}

// IGDB usa el 31-dic como fecha cuando solo se conoce el año.
export function fechaAproximada(unix) {
  const d = new Date(unix * 1000);
  return d.getUTCMonth() === 11 && d.getUTCDate() === 31;
}

// Desarrolladoras a partir de los resultados de buscar cada terminado en IGDB.
export function mapaDeEstudios(resultados) {
  const mapa = new Map();
  for (const r of resultados) {
    for (const dv of r.desarrolladoras || []) {
      const e = mapa.get(dv.id) || { id: dv.id, nombre: dv.nombre, tuyos: [] };
      if (!e.tuyos.includes(r.titulo)) e.tuyos.push(r.titulo);
      mapa.set(dv.id, e);
    }
  }
  return [...mapa.values()].sort((a, b) => a.id - b.id);
}

// Lanzamientos recientes y próximos de las desarrolladoras → ítems "estudio" (sin repetir juegos co-desarrollados).
export function itemsDeEstudios(porEstudio, ahora) {
  const porId = new Map();
  for (const { estudio, juegos } of porEstudio) {
    for (const g of juegos) {
      if (!g.first_release_date || !esJuegoNuevoValido(g)) continue;
      const it = porId.get(g.id) || {
        id: "e-" + g.id, tipo: "e", titulo: g.name,
        fecha: new Date(g.first_release_date * 1000).toISOString().slice(0, 10),
        fechaAprox: fechaAproximada(g.first_release_date),
        plataformas: (g.platforms || []).map(p => p.abbreviation).filter(Boolean).slice(0, 6),
        url: g.url || null, estudios: [], tuyos: [],
        portada: imagenIgdb(g.cover), resumen: recortarTexto(g.summary, 500) || null,
        generos: (g.genres || []).map(x => x.name).filter(Boolean).slice(0, 4),
      };
      if (!it.estudios.includes(estudio.nombre)) it.estudios.push(estudio.nombre);
      for (const t of estudio.tuyos) if (!it.tuyos.includes(t)) it.tuyos.push(t);
      porId.set(g.id, it);
    }
  }
  return [...porId.values()].map(it => ({
    ...it, estudio: it.estudios.join(" / "), tuJuego: it.tuyos[0],
    dias: Math.round((ahora - new Date(it.fecha + "T00:00:00Z").getTime()) / DIA),
  })).sort((a, b) => Math.abs(a.dias) - Math.abs(b.dias) || (a.id < b.id ? -1 : 1));
}

// ── 3) Fichas de IGDB, README de los proyectos y registro de Angst ─────────────────────────────
export function recortarTexto(s, max) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max), i = corte.lastIndexOf(" ");
  return (i > max * 0.6 ? corte.slice(0, i) : corte).replace(/[\s.,;:!?-]+$/, "") + "…";
}

// image_id de la portada de IGDB (solo letras y números, para poder armar la URL con seguridad).
export function imagenIgdb(cover) {
  const id = cover && cover.image_id;
  return typeof id === "string" && /^[a-z0-9]+$/i.test(id) ? id : null;
}

// Ficha de un juego del registro a partir del resultado de buscarlo en IGDB.
export function fichaDeIgdb(g) {
  if (!g) return null;
  return {
    igdbId: g.id ?? null, nombre: g.name || null, portada: imagenIgdb(g.cover), resumen: recortarTexto(g.summary, 700) || null,
    generos: (g.genres || []).map(x => x.name).filter(Boolean).slice(0, 4),
    plataformas: (g.platforms || []).map(p => p.abbreviation).filter(Boolean).slice(0, 6),
    lanzamiento: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    url: typeof g.url === "string" && g.url.startsWith("https://") ? g.url : null,
  };
}

const ENTIDADES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " " };
function limpiarLinea(s) {
  return String(s)
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, e => ENTIDADES[e])
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/\s+/g, " ").trim();
}

// README en Markdown → bloques de texto plano [["h", t] | ["p", t] | ["li", t]] para leerlo dentro de la app.
// Quita imágenes, insignias, HTML, bloques de código, tablas y enlaces sueltos; conserva títulos, párrafos y listas.
export function readmeABloques(md, { max = 3800, maxBloque = 600 } = {}) {
  let t = String(md || "").replace(/\r/g, "");
  t = t.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "").replace(/```[\s\S]*$/, "").replace(/~~~[\s\S]*?~~~/g, "");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/!\[[^\]]*\]\[[^\]]*\]/g, "");
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  t = t.replace(/<[^>]+>/g, " ");
  const bloques = [];
  let parrafo = [];
  let blancoTrasItem = false;   // hubo una línea en blanco desde la última viñeta
  const cerrar = () => { if (parrafo.length) bloques.push(["p", limpiarLinea(parrafo.join(" "))]); parrafo = []; };
  for (const cruda of t.split("\n")) {
    const l = cruda.trim();
    if (!l) { cerrar(); blancoTrasItem = true; continue; }
    if (/^\[[^\]]+\]:\s*\S+/.test(l) || /^\|/.test(l) || /^[-=|:\s]{3,}$/.test(l) || /^https?:\/\/\S+$/.test(l)) { cerrar(); continue; }
    const h = /^#{1,6}\s+(.*)$/.exec(l);
    if (h) { cerrar(); bloques.push(["h", limpiarLinea(h[1].replace(/#+\s*$/, ""))]); continue; }
    const li = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(l);
    if (li) { cerrar(); bloques.push(["li", limpiarLinea(li[1])]); blancoTrasItem = false; continue; }
    // Continuación de una viñeta (línea sangrada, o pegada a la viñeta sin línea en blanco): va en la misma viñeta.
    const previo = bloques[bloques.length - 1];
    if (previo && previo[0] === "li" && !parrafo.length && (/^(?: {2,}|\t)/.test(cruda) || !blancoTrasItem)) { previo[1] = limpiarLinea(previo[1] + " " + l.replace(/^>\s?/, "")); continue; }
    parrafo.push(l.replace(/^>\s?/, ""));
  }
  cerrar();
  const utiles = bloques.filter(([, x]) => /[\p{L}\p{N}]/u.test(x));
  const sinTitulosVacios = utiles.filter(([k], i) => k !== "h" || (utiles[i + 1] && utiles[i + 1][0] !== "h"));
  const salida = [];
  let total = 0, recortado = false;
  for (const [k, x] of sinTitulosVacios) {
    const texto = x.length > maxBloque ? recortarTexto(x, maxBloque) : x;
    if (texto !== x) recortado = true;
    if (total + texto.length > max) { recortado = true; break; }
    salida.push([k, texto]);
    total += texto.length;
  }
  return { bloques: salida, recortado };
}

// "Estado según el autor": la sección del README que habla del estado o avance del proyecto (Status, Estado, Progress,
// Roadmap…). Devuelve { titulo, texto } con el título de la sección y su primer párrafo o viñeta, o null si el README no
// tiene una. Se queda con el texto del autor (no se inventa nada); se calcula sobre el README completo, no sobre el recorte.
export function estadoDeReadme(md) {
  const t = String(md || "").replace(/\r/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "").replace(/```[\s\S]*$/, "").replace(/~~~[\s\S]*?~~~/g, "");
  const lineas = t.split("\n");
  const SI = /\b(status|estado|progress|progreso|roadmap)\b/i, NO = /\b(build|ci|badge|license|licencia)\b/i;
  for (let i = 0; i < lineas.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lineas[i].trim());
    if (!h) continue;
    const titulo = limpiarLinea(h[2].replace(/#+\s*$/, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, " "));
    if (!SI.test(titulo) || NO.test(titulo)) continue;
    let fin = lineas.length;
    for (let k = i + 1; k < lineas.length; k++) { const h2 = /^(#{1,6})\s/.exec(lineas[k].trim()); if (h2 && h2[1].length <= h[1].length) { fin = k; break; } }
    const { bloques } = readmeABloques(lineas.slice(i + 1, fin).join("\n"), { max: 700, maxBloque: 320 });
    const cuerpo = bloques.find(([k]) => k === "p" || k === "li");
    return { titulo: recortarTexto(titulo, 140), texto: cuerpo ? cuerpo[1] : "" };
  }
  return null;
}

// Registro de Angst (campo gameEnhancedRegistro del estado en Angst-data) → lista de juegos válidos.
// null = el estado no trae registro todavía (se usa la semilla); [] = registro vacío a propósito.
export function listaDeRegistro(estado) {
  const r = estado && estado.gameEnhancedRegistro;
  if (!r || typeof r !== "object" || !r.juegos || typeof r.juegos !== "object" || Array.isArray(r.juegos)) return null;
  return Object.values(r.juegos).filter(e => e && typeof e.titulo === "string" && e.titulo.trim() && ESTADOS_REGISTRO.includes(e.estado));
}

export function terminadosDe(lista) {
  return lista.filter(e => e.estado === "terminado").map(e => ({ titulo: e.titulo, busqueda: e.busqueda || e.titulo }));
}
