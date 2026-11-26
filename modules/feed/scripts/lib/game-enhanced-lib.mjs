// ─── Funciones puras del pipeline de Game enhanced (probadas en tests/gameenhanced.mjs) ─────────────
// Sin red ni disco: reciben datos ya descargados. Las usa build-game-enhanced.mjs.
import { ESTADOS_REGISTRO, ESTADOS_JUGADOS, normalizarEstado, idRegistro, repoDeUrl, tituloLimpio, PLATAFORMAS_SUGERIDAS } from "../../../gameenhanced/lib/claves.mjs";
export { repoDeUrl, tituloLimpio };

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
export function casaConTerminado(tituloProyecto, busqueda) {
  const k = norm(tituloLimpio(tituloProyecto)), clave = norm(busqueda);
  if (!clave || !k) return false;
  return k === clave || (k.startsWith(clave) && EDICIONES.has(k.slice(clave.length)));
}

// Imagen social del repo (og_image de la fuente): solo las que sirve GitHub, por https. Segundo recurso tras la portada de IGDB.
export const imagenRepoOk = u => (typeof u === "string" && /^https:\/\/repository-images\.githubusercontent\.com\/[A-Za-z0-9/_.-]+$/.test(u) ? u : null);

// Relación del ítem con tu registro (B, nov-2026): si casa con varios juegos tuyos manda el más "vivo" (jugando > inconcluso > quiero >
// terminado). Cada entrada de `lista` es { titulo, busqueda, estado? }; sin estado cuenta como terminado (así lo usaban los tests y la semilla).
const PRIORIDAD_RELACION = ["jugando", "inconcluso", "quiero", "terminado"];
export function relacionDe(entradas) {
  for (const r of PRIORIDAD_RELACION) {
    const e = entradas.find(x => (x.estado || "terminado") === r);
    if (e) return { relacion: r, tuJuego: e.titulo };
  }
  return { relacion: "terminado", tuJuego: entradas[0] ? entradas[0].titulo : undefined };
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
        ia: !!j.ai_flag, inactivo: !!(j.inactive || j.archived), tuyos: [], _entradas: [], ...(imagenRepoOk(j.og_image) ? { imagenRepo: imagenRepoOk(j.og_image) } : {}),
      };
      if (!it.tuyos.includes(t.titulo)) { it.tuyos.push(t.titulo); it._entradas.push(t); }
      porId.set(j.id, it);
    }
  }
  return [...porId.values()].map(({ _entradas, ...it }) => {
    const d = [diasDesde(it.ultimoCommit, ahora), diasDesde(it.fechaRelease, ahora)].filter(x => x !== null);
    return { ...it, ...relacionDe(_entradas), dias: d.length ? Math.max(0, Math.min(...d)) : 9999 };
  }).sort((a, b) => a.dias - b.dias || (a.id < b.id ? -1 : 1));
}

// ── 1b) Ports nativos de clásicos (no dependen de tu lista) ──────────────────────────────────
// Proyectos de la misma fuente que son ports nativos hechos sobre una decompilación / recompilación, de juegos cuya
// plataforma ORIGINAL es de la era clásica (la fuente no dice a qué consolas se porteó, solo la plataforma de origen).
// Se quedan los activos con versión publicada reciente y un mínimo de estrellas; el cliente muestra los últimos 30 días.
// Los que coinciden con un terminado tuyo llevan `tuyos` (la ficha dice "ya lo terminaste"), pero no se ocultan.
export const TIPOS_PORT = new Set(["source-port", "static-recomp", "engine-remake", "browser-port"]);
export const PLATAFORMAS_CLASICAS = new Set(["NES", "SNES", "N64", "Game Boy", "Game Boy Color", "GBA", "Genesis", "Master System", "Saturn", "Dreamcast", "PS1", "PS2", "GameCube", "Arcade", "DOS", "Sega CD", "Neo Geo"]);
export const PORTS = { dias: 90, minEstrellas: 100 };

export function portsNativos(juegosFuente, terminados, ahora, { dias = PORTS.dias, minEstrellas = PORTS.minEstrellas } = {}) {
  const salida = [];
  for (const j of juegosFuente) {
    if (!TIPOS_PORT.has(j.type) || !PLATAFORMAS_CLASICAS.has(j.platform) || j.inactive || j.archived || !j.release) continue;
    if ((j.stars ?? 0) < minEstrellas) continue;
    const d = diasDesde(j.release_date, ahora);
    if (d === null || d > dias) continue;
    const casan = terminados.filter(t => casaConTerminado(j.title, t.busqueda));
    const tuyos = casan.map(t => t.titulo);
    salida.push({
      id: "p-" + j.id, tipo: "p", titulo: j.title, subtipo: j.type, plataforma: j.platform, estrellas: j.stars ?? null,
      ultimoCommit: j.last_commit || null, release: j.release, fechaRelease: j.release_date || null,
      url: j.url || null, jugableUrl: j.play_url || null, pideAssets: j.needs_assets || null,
      ia: !!j.ai_flag, inactivo: false, tuyos, ...(tuyos.length ? relacionDe(casan) : {}), ...(imagenRepoOk(j.og_image) ? { imagenRepo: imagenRepoOk(j.og_image) } : {}), dias: Math.max(0, d),
    });
  }
  return salida.sort((a, b) => a.dias - b.dias || (b.estrellas ?? 0) - (a.estrellas ?? 0) || (a.id < b.id ? -1 : 1));
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
      const e = mapa.get(dv.id) || { id: dv.id, nombre: dv.nombre, tuyos: [], estados: {} };
      if (!e.tuyos.includes(r.titulo)) e.tuyos.push(r.titulo);
      e.estados[r.titulo] = r.estado || "terminado";
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
        url: g.url || null, estudios: [], tuyos: [], _estados: {},
        portada: imagenIgdb(g.cover), resumen: recortarTexto(g.summary, 500) || null,
        generos: (g.genres || []).map(x => x.name).filter(Boolean).slice(0, 4),
      };
      if (!it.estudios.includes(estudio.nombre)) it.estudios.push(estudio.nombre);
      for (const t of estudio.tuyos) if (!it.tuyos.includes(t)) { it.tuyos.push(t); it._estados[t] = (estudio.estados && estudio.estados[t]) || "terminado"; }
      porId.set(g.id, it);
    }
  }
  return [...porId.values()].map(({ _estados, ...it }) => ({
    ...it, estudio: it.estudios.join(" / "), ...relacionDe(it.tuyos.map(t => ({ titulo: t, estado: _estados[t] }))),
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

// ── 4) Versiones en otras plataformas (sugeridas) ─────────────────────────────────────────────
// Para cada proyecto se buscan, en las ramas del repo y en sus forks más estrellados, versiones "nativas" en otras
// plataformas (3DS, Vita, Wii U, Switch, Android…). Se detectan SOLO por el nombre (y la descripción / topics de un fork):
// son sugerencias, no están verificadas. Se descarta la plataforma original del propio juego (si no, un juego de
// GameCube "aparecería" en GameCube), las ramas de trabajo (feat/, fix/…) y los forks con pocas estrellas.
const TOKENS_PLAT = { "3ds": "3DS", n3ds: "3DS", vita: "PS Vita", psvita: "PS Vita", wiiu: "Wii U", switch: "Switch", nx: "Switch", psp: "PSP", wii: "Wii", gamecube: "GameCube", gcn: "GameCube", ps3: "PS3", ps4: "PS4", ps5: "PS5", xbox: "Xbox", xbox360: "Xbox 360", dreamcast: "Dreamcast", saturn: "Saturn", android: "Android" };
const FRASES_PLAT = [[/\bnintendo switch\b/g, "Switch"], [/\b(?:ps|playstation) vita\b/g, "PS Vita"], [/\bwii u\b/g, "Wii U"], [/\bnew 3ds\b/g, "3DS"], [/\bplaystation portable\b/g, "PSP"], [/\bxbox 360\b/g, "Xbox 360"]];

export function plataformasDeNombre(texto, { conNx = true } = {}) {
  let t = String(texto || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");   // la puntuación ("PSVita,") no pega con la palabra
  const out = new Set();
  for (const [rx, p] of FRASES_PLAT) t = t.replace(rx, () => { out.add(p); return " "; });
  for (const tok of t.split(/\s+/)) { if (!tok || (tok === "nx" && !conNx)) continue; if (TOKENS_PLAT[tok]) out.add(TOKENS_PLAT[tok]); }
  return PLATAFORMAS_SUGERIDAS.filter(p => out.has(p));
}

const clavePlat = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function esPlataformaOriginal(etiqueta, original) {
  const k = clavePlat(etiqueta), o = clavePlat(original);
  if (!o) return false;
  return k === o || (k === "xbox" && o.includes("xbox") && !o.includes("360")) || (k === "xbox360" && o.includes("360"));
}
const RAMA_DE_TRABAJO = /^(?:feat|feature|fix|bugfix|hotfix|refactor|perf|chore|docs|test|ci|build|dependabot|renovate)(?:[/-]|$)/i;

export function sugerenciasDePlataformas({ repo, ramas = [], forks = [], plataformaOriginal = "", minEstrellas = 3, maxPorPlataforma = 3, max = 10 }) {
  const cand = [];
  ramas = Array.isArray(ramas) ? ramas : [];
  forks = Array.isArray(forks) ? forks : [];
  for (const b of ramas) {
    const nombre = b && typeof b.name === "string" ? b.name : "";
    if (!nombre || RAMA_DE_TRABAJO.test(nombre)) continue;
    const plataformas = plataformasDeNombre(nombre).filter(p => !esPlataformaOriginal(p, plataformaOriginal));
    if (plataformas.length) cand.push({ tipo: "rama", nombre, url: `https://github.com/${repo}/tree/${nombre.split("/").map(encodeURIComponent).join("/")}`, plataformas, estrellas: 0, pushed: null });
  }
  for (const f of forks) {
    if (!f || typeof f.full_name !== "string" || (f.stargazers_count ?? 0) < minEstrellas || typeof f.html_url !== "string" || !f.html_url.startsWith("https://github.com/")) continue;
    const todas = new Set([...plataformasDeNombre(f.name || ""), ...plataformasDeNombre(`${f.description || ""} ${(f.topics || []).join(" ")}`, { conNx: false })]);
    const plataformas = PLATAFORMAS_SUGERIDAS.filter(p => todas.has(p) && !esPlataformaOriginal(p, plataformaOriginal));
    if (plataformas.length) cand.push({ tipo: "fork", nombre: f.full_name, url: f.html_url, plataformas, estrellas: f.stargazers_count ?? 0, pushed: typeof f.pushed_at === "string" ? f.pushed_at.slice(0, 10) : null });
  }
  cand.sort((a, b) => (a.tipo === "rama" ? 0 : 1) - (b.tipo === "rama" ? 0 : 1) || b.estrellas - a.estrellas || (a.nombre < b.nombre ? -1 : 1));
  const cuenta = {}, salida = [];
  for (const c of cand) {
    if (salida.length >= max) break;
    if (c.plataformas.every(p => (cuenta[p] || 0) >= maxPorPlataforma)) continue;
    for (const p of c.plataformas) cuenta[p] = (cuenta[p] || 0) + 1;
    salida.push(c);
  }
  return salida;
}

// Registro de Angst (campo gameEnhancedRegistro del estado en Angst-data) → lista de juegos válidos.
// null = el estado no trae registro todavía (se usa la semilla); [] = registro vacío a propósito.
export function listaDeRegistro(estado) {
  const r = estado && estado.gameEnhancedRegistro;
  if (!r || typeof r !== "object" || !r.juegos || typeof r.juegos !== "object" || Array.isArray(r.juegos)) return null;
  return Object.values(r.juegos)
    .map(e => (e && typeof e === "object" ? { ...e, estado: normalizarEstado(e.estado) } : e))   // "pendiente" (antiguo) → "inconcluso"
    .filter(e => e && typeof e.titulo === "string" && e.titulo.trim() && ESTADOS_REGISTRO.includes(e.estado));
}

export function terminadosDe(lista) {
  return lista.filter(e => e.estado === "terminado").map(e => ({ titulo: e.titulo, busqueda: e.busqueda || e.titulo }));
}

// Juegos del registro que alimentan el cruce con decomps y ports (B, nov-2026): lo que has jugado (terminado / jugando / inconcluso)
// y lo que quieres jugar (quiero: «decomps y ports que permiten jugarlo»). Cada uno lleva su `estado`, que define la `relacion` del ítem.
export function relacionadosDe(lista) {
  return lista.filter(e => ESTADOS_REGISTRO.includes(e.estado)).map(e => ({ titulo: e.titulo, busqueda: e.busqueda || e.titulo, estado: e.estado }));
}

// Lo que has jugado (terminado, jugando o inconcluso): de sus desarrolladoras salen los juegos nuevos de Estudios. `quiero` no entra.
export function jugadosDe(lista) {
  return lista.filter(e => ESTADOS_JUGADOS.includes(e.estado)).map(e => ({ titulo: e.titulo, busqueda: e.busqueda || e.titulo, estado: e.estado }));
}

// Coincidencia de un título en los resultados de IGDB: nombre idéntico (mejor si no es una versión), luego idéntico, luego que empiece igual.
export function elegirCoincidencia(resultados, busqueda) {
  const k = norm(busqueda);
  if (!k || !Array.isArray(resultados)) return null;
  return resultados.find(x => norm(x.name) === k && !x.version_parent) || resultados.find(x => norm(x.name) === k)
    || resultados.find(x => norm(x.name).startsWith(k) && !x.version_parent) || null;
}

// Portadas de los proyectos (decomps y ports) a partir de lo ya sabido: la ficha del juego tuyo que lo motiva (sin consultar) y,
// si no hay, la consulta pendiente. `consultar(item)` devuelve true si hay que buscarlo en IGDB (no está en caché ni resuelto por la ficha).
export function planPortadas(items, fichas, previas, ahora, { diasEncontrada = 30, diasSinResultado = 7 } = {}) {
  const resueltos = {}, pendientes = [];
  for (const it of items) {
    const ficha = it.tuJuego ? fichas[idDeTitulo(it.tuJuego)] : null;
    if (ficha && ficha.portada) { resueltos[it.id] = { v: 1, imagen: ficha.portada, fuente: "ficha", nombre: it.tuJuego }; continue; }
    const busqueda = tituloLimpio(it.titulo), prev = previas[it.id];
    const vigente = prev && prev.v === 1 && prev.busqueda === busqueda && prev.buscado
      && (ahora - new Date(prev.buscado).getTime()) < (prev.imagen ? diasEncontrada : diasSinResultado) * DIA;
    if (vigente) resueltos[it.id] = prev; else pendientes.push({ id: it.id, busqueda });
  }
  return { resueltos, pendientes };
}
const idDeTitulo = t => idRegistro(t);
