// build-simkl.mjs
// Corre vía GitHub Action periódica (update-simkl.yml). Server-side, no
// necesita el Worker de Cloudflare -- ese es solo para cuando el
// NAVEGADOR necesita hablarle a algo con una credencial fuerte (Simkl o
// GitHub). Acá el runner de Actions ya tiene salida normal a internet.
//
// Dos direcciones, dos dueños del archivo (issue #14):
// - syncedList/lastSimklActivity: los escribe ESTE script. "Esto es lo
//   que Simkl dice ahora mismo que tenés."
// - pendingActions: las escribe el navegador (vía el Worker). Este
//   script las CONSUME -- las empuja a Simkl y las saca de la cola en
//   éxito. Nunca las agrega.
//
// Regla de la API de Simkl que hay que respetar sí o sí (si no, suspenden
// el client_id sin aviso): nunca pegarle a /sync/all-items sin antes
// chequear /sync/activities. Ver https://api.simkl.org/api-rules

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { enrichMovieOrTv, tmdb } from "./lib/enrich.mjs";
import { armarVista, encodeRangos, inferirEp, parseSxxExx, agruparPorTemporada, opsVacias } from "../../shared/episodios.js";

const SIMKL_ACCESS_TOKEN = process.env.SIMKL_ACCESS_TOKEN;
const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;
// Angst-data es un repo aparte de feeder -- el workflow lo clona como
// directorio hermano y pasa la ruta acá. No se puede adivinar por
// posición relativa al script como con feed.json/cine.json (mismo repo).
const STATE_PATH = process.env.SIMKL_STATE_PATH;
const DISCOVERY_PATH = process.env.SIMKL_DISCOVERY_PATH; // ídem, otro archivo en Angst-data
// Todo lo de abajo es PRIVADO (Angst-data): saber QUÉ series seguís es dato
// personal, no va al feeder público.
// - QUEUE: cola de acciones que escribe SOLO el navegador (vía Worker). Este
//   script la lee pero nunca la escribe: con dos escritores sobre el mismo
//   archivo, el reintento de push (reset --soft) pisaba las marcas hechas
//   mientras corría el job. Lo ya procesado se anota en state.procesadas.
// - VITRINA: archivo liviano que lee la Vitrina al abrir (avance por serie,
//   estados, procesadas). Antes era un único archivo de 3 MB con los nombres
//   de todos los episodios: se bajaba entero aunque no abrieras una serie.
// - CATALOG_DIR: un archivo por serie con nombre/fecha de cada episodio (TMDb),
//   que la Vitrina baja solo al abrir esa serie.
const QUEUE_PATH = process.env.SIMKL_QUEUE_PATH;
const VITRINA_PATH = process.env.SIMKL_VITRINA_PATH;
const CATALOG_DIR = process.env.SERIES_CATALOG_DIR;
// Subir este número fuerza UNA relectura completa de /sync/all-items/shows
// (sin date_from) la próxima corrida, para que el estado guardado traiga el
// detalle por episodio. Es el "initial sync" normal de la API, no un abuso:
// se sigue chequeando /sync/activities antes y el resto de las corridas
// vuelve a leer solo cambios.
// v2: guardar last_watched de TODAS las series (antes solo watching/hold) para poder inferir el avance de completed/dropped.
const EPISODIOS_V = 2;
// Cuántas series (llamadas /tv/{id}) refrescar del catálogo por corrida.
const EPISODES_BUDGET = 80;
const EPISODES_REFRESH_MS = 12 * 3600 * 1000;
if (!STATE_PATH) {
  console.error("✗ Falta SIMKL_STATE_PATH (ruta a simkl-state.json en el checkout de Angst-data)");
  process.exit(1);
}
// cine.json sí vive en el mismo repo que este script -- acá no hace falta
// ninguna ruta pasada por env.
const CINE_JSON_PATH = new URL("../data/cine.json", import.meta.url);
// Cuántos ítems nuevos enriquecer como máximo por corrida -- cada uno son 5
// llamadas a TMDb en paralelo + OMDb + a veces Wikipedia, igual que en
// build-cine.mjs. Sin tope, una lista de Simkl grande podría hacer que esta
// corrida (cada 6hs, sin presupuesto de tiempo propio como Melee) se vuelva
// lenta de golpe -- lo que no entra en una corrida, entra en la siguiente
// (nada se pierde, syncedList no se toca acá).
const DISCOVERY_BUDGET = 20;

const APP_PARAMS = "app-name=angst&app-version=1.0";

function simklHeaders() {
  return {
    Authorization: `Bearer ${SIMKL_ACCESS_TOKEN}`,
    "simkl-api-key": SIMKL_CLIENT_ID,
    "Content-Type": "application/json",
    "User-Agent": "angst/1.0",
  };
}

async function simklGet(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://api.simkl.com${path}${sep}${APP_PARAMS}`, {
    headers: simklHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} -> ${res.status} ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function simklPost(path, body) {
  const res = await fetch(`https://api.simkl.com${path}?${APP_PARAMS}`, {
    method: "POST",
    headers: simklHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`POST ${path} -> ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

// Mapeo de estados acordado en sesión: plantowatch="interesa", completed=
// "vista", dropped="descartada". watching/hold solo aplican a series --
// van al mismo bucket que "interesa" pero con progreso de temporada/
// episodio enganchado (no es un estado local nuevo).
function mapSimklStatus(status) {
  switch (status) {
    case "plantowatch": return "interesa";
    case "completed": return "vista";
    case "dropped": return "descartada";
    case "watching":
    case "hold": return "interesa"; // + progreso, ver mapEntry()
    default: return null;
  }
}

function mapEntry(item, tipo) {
  const estado = mapSimklStatus(item.status);
  if (!estado) return null;
  const entry = { estado, simklStatus: item.status };
  if (tipo === "show") {
    // Simkl devuelve last_watched / next_to_watch como string "S28E05" (no
    // objetos con .season/.episode: leerlos así dejaba el progreso siempre
    // vacío). "progreso" = lo ÚLTIMO VISTO -- así lo muestra la UI ("vas por").
    const ultimo = parseSxxExx(item.last_watched);
    const siguiente = parseSxxExx(item.next_to_watch);
    if (item.status === "watching" || item.status === "hold") {
      entry.progreso = { temporada: ultimo?.t ?? null, episodio: ultimo?.e ?? null };
    }
    if (ultimo) entry.ultimo = { temporada: ultimo.t, episodio: ultimo.e };
    if (siguiente) entry.siguiente = { temporada: siguiente.t, episodio: siguiente.e };
    if (Number.isFinite(item.total_episodes_count)) {
      entry.total = item.total_episodes_count;
      entry.vistos = item.watched_episodes_count ?? 0;
      entry.noEmitidos = item.not_aired_episodes_count ?? 0;
    }
    // Detalle por episodio (episode_watched_at=yes): solo vienen los vistos.
    if (Array.isArray(item.seasons)) {
      const porTemporada = {};
      for (const sea of item.seasons) {
        for (const ep of sea.episodes || []) (porTemporada[sea.number] ||= []).push(ep.number);
      }
      entry.ep = {};
      for (const t of Object.keys(porTemporada).sort((a, b) => a - b)) entry.ep[t] = encodeRangos(porTemporada[t]);
    }
  }
  return entry;
}

// Para marcar "hasta acá" en una serie hace falta saber cuántos episodios
// tenía CADA temporada anterior a la actual (si no, no se puede armar la
// lista completa de episodios a marcar visto -- Simkl no tiene un "marcá
// todo hasta el episodio X" nativo, hay que mandarle la lista explícita).
async function episodiosPorTemporada(tmdbId, hastaTemporada) {
  const details = await tmdb(`/tv/${tmdbId}`, {}, null);
  const seasons = (details.seasons || []).filter(s => s.season_number > 0 && s.season_number <= hastaTemporada);
  return seasons.map(s => ({ numero: s.season_number, episodios: s.episode_count }));
}

async function main() {
  let state = { generatedAt: null, lastSimklActivity: null, syncedList: { movies: {}, shows: {} }, pendingActions: [] };
  try {
    state = JSON.parse(await readFile(STATE_PATH, "utf-8"));
  } catch (e) {
    console.log("No había simkl-state.json todavía, arranca desde cero.");
  }
  state.syncedList = state.syncedList || { movies: {}, shows: {} };
  state.pendingActions = state.pendingActions || []; // formato anterior (el navegador escribía acá); se sigue procesando por compatibilidad
  state.procesadas = state.procesadas || [];
  state.intentos = state.intentos || {};
  let cola = [];
  if (QUEUE_PATH) {
    try {
      const q = JSON.parse(await readFile(QUEUE_PATH, "utf-8"));
      cola = Array.isArray(q.actions) ? q.actions : [];
    } catch (e) { /* sin cola todavía */ }
  }

  if (!SIMKL_ACCESS_TOKEN || !SIMKL_CLIENT_ID) {
    console.error("✗ Simkl · faltan SIMKL_ACCESS_TOKEN/SIMKL_CLIENT_ID, se omite esta corrida");
    return;
  }

  // 1) Regla obligatoria: chequear actividad antes de tocar /sync/all-items.
  const activities = await simklGet("/sync/activities");
  let currentAll = activities?.all;
  let sinCambios = state.lastSimklActivity && currentAll && state.lastSimklActivity === currentAll;

  // 2) Procesar la cola de pendientes ANTES de refrescar syncedList, así
  // lo que se acaba de empujar ya se refleja en la lectura de más abajo
  // en vez de pisarse con un estado leído de antes.
  const stillPending = [];
  let pushed = false;
  // Orden = orden de la cola: las marcas de episodios dependen de la secuencia
  // (marcar y desmarcar el mismo episodio: gana la última).
  const hechas = new Set(state.procesadas);
  const porProcesar = [
    ...state.pendingActions.map(a => ({ action: a, legacy: true })),
    ...cola.filter(a => a.id && !hechas.has(a.id)).map(a => ({ action: a, legacy: false })),
  ];
  for (const { action, legacy } of porProcesar) {
    try {
      if (action.kind === "episodios" && action.tipo === "show") {
        // Marcado episodio por episodio (issue #13): altas por /sync/history,
        // bajas por /sync/history/remove. Agrupado por temporada.
        const base = { ids: { tmdb: action.tmdbId }, title: action.title, year: action.year };
        const ops = { marcar: action.marcar || [], desmarcar: action.desmarcar || [] };
        if (opsVacias(ops)) {
          console.log(`· Simkl · acción de episodios vacía: ${action.title || action.tmdbId}`);
          if (!legacy) state.procesadas.push(action.id);
          continue;
        }
        if (ops.marcar.length) {
          const resp = await simklPost("/sync/history", { shows: [{ ...base, seasons: agruparPorTemporada(ops.marcar) }] });
          console.log(`✓ Simkl · ${ops.marcar.length} episodio(s) marcado(s): ${action.title || action.tmdbId}`, JSON.stringify(resp).slice(0, 150));
          // Marcar episodios implica que la estás viendo: si no estaba en
          // watching/hold/completed, pasa a watching.
          const st = state.syncedList.shows?.[action.tmdbId]?.simklStatus;
          if (!st || st === "plantowatch" || st === "dropped") {
            await simklPost("/sync/add-to-list", { shows: [{ ...base, to: "watching" }] });
          }
        }
        if (ops.desmarcar.length) {
          const resp = await simklPost("/sync/history/remove", { shows: [{ ...base, seasons: agruparPorTemporada(ops.desmarcar) }] });
          console.log(`✓ Simkl · ${ops.desmarcar.length} episodio(s) desmarcado(s): ${action.title || action.tmdbId}`, JSON.stringify(resp).slice(0, 150));
        }
      } else if (action.progreso && action.tipo === "show") {
        // "Marcar hasta acá": arma la lista completa de episodios (todas
        // las temporadas anteriores completas + la actual hasta el
        // episodio marcado) y la manda de una -- Simkl no tiene un "marcá
        // todo hasta X" nativo.
        const { temporada, episodio } = action.progreso;
        const seasonsInfo = await episodiosPorTemporada(action.tmdbId, temporada);
        const seasonsPayload = seasonsInfo.map(s => ({
          number: s.numero,
          episodes: Array.from(
            { length: s.numero === temporada ? episodio : s.episodios },
            (_, i) => ({ number: i + 1 })
          ),
        }));
        const resp = await simklPost("/sync/history", {
          shows: [{ ids: { tmdb: action.tmdbId }, title: action.title, year: action.year, seasons: seasonsPayload }],
        });
        console.log(`✓ Simkl · progreso T${temporada}·E${episodio}: ${action.title || action.tmdbId}`, JSON.stringify(resp).slice(0, 150));
        // Además del historial de episodios, el status de la serie en sí
        // queda en "watching" -- /sync/history marca episodios, no cambia
        // el status general por su cuenta.
        await simklPost("/sync/add-to-list", {
          shows: [{ ids: { tmdb: action.tmdbId }, title: action.title, year: action.year, to: "watching" }],
        });
      } else if (action.status === "completed") {
        const resp = await simklPost("/sync/history", {
          [action.tipo === "movie" ? "movies" : "shows"]: [
            { ids: { tmdb: action.tmdbId }, title: action.title, year: action.year },
          ],
        });
        console.log(`✓ Simkl · marcado visto: ${action.title || action.tmdbId}`, JSON.stringify(resp).slice(0, 150));
      } else {
        const resp = await simklPost("/sync/add-to-list", {
          [action.tipo === "movie" ? "movies" : "shows"]: [
            { ids: { tmdb: action.tmdbId }, title: action.title, year: action.year, to: action.status },
          ],
        });
        console.log(`✓ Simkl · status '${action.status}': ${action.title || action.tmdbId}`, JSON.stringify(resp).slice(0, 150));
      }
      if (!legacy) { state.procesadas.push(action.id); delete state.intentos[action.id]; }
      pushed = true;
    } catch (e) {
      console.error(`✗ Simkl · no se pudo sincronizar '${action.title || action.tmdbId}': ${e.message}`);
      if (legacy) {
        stillPending.push(action); // se reintenta la próxima corrida
      } else {
        // Acción de la cola: se reintenta en la próxima corrida; tras 5 fallos
        // se abandona para que una acción rota no trabe a las que vienen detrás.
        const n = (state.intentos[action.id] || 0) + 1;
        state.intentos[action.id] = n;
        if (n >= 5) {
          console.error(`✗ Simkl · acción ${action.id} abandonada tras ${n} intentos`);
          state.procesadas.push(action.id);
          delete state.intentos[action.id];
        }
      }
    }
  }
  state.pendingActions = stillPending;
  state.procesadas = state.procesadas.slice(-500);
  const procesadasSet = new Set(state.procesadas);
  const colaRestante = [...stillPending, ...cola.filter(a => a.id && !procesadasSet.has(a.id))];
  // Si empujamos algo, la actividad de Simkl cambió por nuestra propia
  // escritura: se vuelve a pedir para que la lectura de abajo ya traiga lo
  // recién enviado (si no, se vería recién en la corrida siguiente).
  if (pushed) {
    try {
      const a2 = await simklGet("/sync/activities");
      if (a2?.all) { currentAll = a2.all; sinCambios = false; }
    } catch (e) { /* queda como estaba, la próxima corrida lo lee */ }
  }
  const necesitaCompleto = state.episodiosV !== EPISODIOS_V;

  // 3) Refrescar syncedList -- solo si hubo cambios reales (regla de la API).
  if (!sinCambios || necesitaCompleto) {
    console.log(necesitaCompleto ? "Relectura completa de series (detalle por episodio) -- pidiendo /sync/all-items..." : "Actividad cambió (o primera corrida) -- pidiendo /sync/all-items...");
    const dateFrom = state.lastSimklActivity ? `?date_from=${encodeURIComponent(state.lastSimklActivity)}` : "";
    const movies = await simklGet(`/sync/all-items/movies${dateFrom}`);
    // Series con detalle por episodio. Conjunto de parámetros verificado con
    // la API real (probe del 12-oct-2026): trae seasons[].episodes[].watched_at.
    const showsParams = new URLSearchParams({ extended: "full", episode_watched_at: "yes", next_watch_info: "yes" });
    if (state.lastSimklActivity && !necesitaCompleto) showsParams.set("date_from", state.lastSimklActivity);
    const shows = await simklGet(`/sync/all-items/shows?${showsParams}`);

    for (const item of movies?.movies || []) {
      const tmdbId = item.movie?.ids?.tmdb;
      if (!tmdbId) continue;
      const mapped = mapEntry(item, "movie");
      if (mapped) state.syncedList.movies[tmdbId] = mapped;
    }
    for (const item of shows?.shows || []) {
      const tmdbId = item.show?.ids?.tmdb;
      if (!tmdbId) continue;
      const mapped = mapEntry(item, "show");
      if (mapped) state.syncedList.shows[tmdbId] = mapped;
    }
    state.lastSimklActivity = currentAll || state.lastSimklActivity;
    state.episodiosV = EPISODIOS_V;
    console.log(`✓ Simkl · ${Object.keys(state.syncedList.movies).length} película(s), ${Object.keys(state.syncedList.shows).length} serie(s) en syncedList`);
  } else {
    console.log("Sin cambios en Simkl desde la última corrida -- se omite /sync/all-items.");
  }

  state.generatedAt = new Date().toISOString();
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
  console.log("✓ simkl-state.json actualizado");

  await buildDiscovery(state);
  await buildEpisodios(state, colaRestante);
}

// ─── "Bajo el radar" (issue #14, fase B): lo que ya está en tu lista de
// Simkl pero el descubrimiento normal de TMDb (trending/estrenos) nunca
// trajo a cine.json -- contenido de nicho, continuaciones, etc. Se guarda
// en un archivo PRIVADO aparte (simkl-discovery.json en Angst-data), NUNCA
// en el cine.json público de feeder: aunque el título/poster de una
// película no es dato personal en sí, la ATRIBUCIÓN ("esto está en tu
// lista") sí lo es -- publicarla ahí sería exactamente el tipo de fuga que
// el issue prohíbe. El cliente lo lee vía el Worker (autenticado), igual
// que simkl-state.json.
async function buildDiscovery(state) {
  if (!DISCOVERY_PATH) {
    console.log("⚠ Simkl · SIMKL_DISCOVERY_PATH no seteado, se omite 'bajo el radar' esta corrida");
    return;
  }

  let cineData = { categories: [] };
  try {
    cineData = JSON.parse(await readFile(CINE_JSON_PATH, "utf-8"));
  } catch (e) {
    console.log("No se pudo leer cine.json, se asume vacío para el cruce.");
  }
  const yaEnCine = new Set();
  for (const cat of cineData.categories || []) {
    for (const item of cat.items || []) {
      const m = /^tmdb-(movie|tv)-(\d+)$/.exec(item.guid || "");
      if (m) yaEnCine.add(`${m[1] === "movie" ? "movie" : "show"}-${m[2]}`);
    }
  }

  let previousDiscovery = { items: [] };
  try {
    previousDiscovery = JSON.parse(await readFile(DISCOVERY_PATH, "utf-8"));
  } catch (e) { /* primera corrida */ }
  const cache = {};
  for (const it of previousDiscovery.items || []) cache[it.guid] = it;

  // Candidatos: solo lo que todavía importa mostrar -- "interesa" (plantowatch)
  // o en curso (watching/hold, ya mapeados a "interesa" por mapEntry). Lo
  // "vista"/"descartada" no tiene sentido empujarlo a un catálogo de
  // descubrimiento.
  const candidatos = [];
  for (const [tmdbId, entry] of Object.entries(state.syncedList.movies || {})) {
    if (entry.estado === "interesa" && !yaEnCine.has(`movie-${tmdbId}`)) {
      candidatos.push({ tmdbId: Number(tmdbId), tipo: "movie", entry });
    }
  }
  for (const [tmdbId, entry] of Object.entries(state.syncedList.shows || {})) {
    if (entry.estado === "interesa" && !yaEnCine.has(`show-${tmdbId}`)) {
      candidatos.push({ tmdbId: Number(tmdbId), tipo: "show", entry });
    }
  }

  console.log(`Simkl · 'bajo el radar': ${candidatos.length} candidato(s) fuera de cine.json`);

  let enriquecidos = 0;
  const items = [];
  for (const c of candidatos) {
    const guid = `tmdb-${c.tipo === "movie" ? "movie" : "tv"}-${c.tmdbId}`;
    if (cache[guid]) {
      // Ya enriquecido en una corrida anterior -- se reusa tal cual, no
      // hace falta re-pedir a TMDb cada 6hs algo que no cambia seguido.
      items.push({ ...cache[guid], simklStatus: c.entry.estado, simklProgreso: c.entry.progreso || null });
      continue;
    }
    if (enriquecidos >= DISCOVERY_BUDGET) continue; // lo que no entra esta corrida, entra en la próxima
    try {
      const mediaType = c.tipo === "movie" ? "movie" : "tv";
      const enriched = await enrichMovieOrTv(mediaType, c.tmdbId, {}, guid);
      if (enriched) {
        items.push({ ...enriched, simklStatus: c.entry.estado, simklProgreso: c.entry.progreso || null });
        enriquecidos++;
      }
    } catch (e) {
      console.error(`✗ Simkl · no se pudo enriquecer ${guid}: ${e.message}`);
    }
  }
  console.log(`✓ Simkl · 'bajo el radar': ${enriquecidos} ítem(s) nuevo(s) enriquecido(s), ${items.length} en total`);

  await writeFile(DISCOVERY_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2));
}

// ─── Catálogo de episodios + avance por episodio (issue #13) ─────────────────
// Catálogo por serie (SERIES_CATALOG_DIR/<tmdbId>.json): { nombre, fetchedAt,
// temporadas: [{ n, eps: [[numero, nombre, fecha], ...] }] }, de TMDb y cacheado.
// El avance liviano (vistos/emitidos/pendientes/ep por serie) sale de
// state.syncedList (Simkl) y va a simkl-vitrina.json. El cliente lee ambos
// vía el Worker, autenticado.
const nombreGenerico = (n) => !n || /^episod(io|e)\s*\d+$/i.test(String(n).trim());

async function catalogoSerie(id, previo) {
  const det = await tmdb(`/tv/${id}`, {}, "es-CL");
  const ultimaTemp = det.last_episode_to_air?.season_number ?? det.number_of_seasons ?? 0;
  const previas = new Map((previo?.temporadas || []).map(t => [t.n, t]));
  const temporadas = [];
  for (const sea of det.seasons || []) {
    if (sea.season_number <= 0) continue; // 0 = especiales, no cuenta como avance
    const p = previas.get(sea.season_number);
    // Temporada ya cerrada, con la misma cantidad de episodios y todos con
    // nombre real: se reusa sin volver a pedirla.
    if (p && p.eps.length === sea.episode_count && sea.season_number < ultimaTemp && !p.eps.some(e => nombreGenerico(e[1]))) {
      temporadas.push(p);
      continue;
    }
    const sd = await tmdb(`/tv/${id}/season/${sea.season_number}`, {}, "es-CL");
    const eps = (sd.episodes || []).map(e => [e.episode_number, nombreGenerico(e.name) ? "" : e.name, e.air_date || null]);
    if (eps.some(e => !e[1])) {
      // Sin traducción al español: se completa con el título original en inglés.
      try {
        const en = await tmdb(`/tv/${id}/season/${sea.season_number}`, {}, "en-US");
        const porNum = new Map((en.episodes || []).map(e => [e.episode_number, e.name]));
        for (const e of eps) if (!e[1]) e[1] = nombreGenerico(porNum.get(e[0])) ? `Episodio ${e[0]}` : porNum.get(e[0]);
      } catch (err) {
        for (const e of eps) if (!e[1]) e[1] = `Episodio ${e[0]}`;
      }
    }
    temporadas.push({ n: sea.season_number, eps });
  }
  return { nombre: det.name || null, fetchedAt: new Date().toISOString(), temporadas };
}

async function buildEpisodios(state, colaRestante = []) {
  if (!CATALOG_DIR || !VITRINA_PATH) {
    console.log("⚠ Simkl · SERIES_CATALOG_DIR/SIMKL_VITRINA_PATH no seteados, se omite el avance de series esta corrida");
    return;
  }
  await mkdir(CATALOG_DIR, { recursive: true });
  const leerCatalogo = async (id) => {
    try {
      const e = JSON.parse(await readFile(join(CATALOG_DIR, `${id}.json`), "utf-8"));
      return { nombre: e.nombre, fetchedAt: e.fetchedAt, temporadas: e.temporadas };
    } catch (e) { return null; }
  };
  const shows = state.syncedList.shows || {};

  // Catálogo de episodios (TMDb), por serie. Orden de prioridad (si el
  // presupuesto no alcanza, lo que queda entra en la corrida siguiente):
  // en curso > por ver / dropped con algo visto > catálogo de Vitrina > completas.
  const prioridad = new Map();
  const agregar = (id, p) => { id = String(id); if (!prioridad.has(id) || prioridad.get(id) > p) prioridad.set(id, p); };
  for (const [id, e] of Object.entries(shows)) {
    if (e.simklStatus === "watching" || e.simklStatus === "hold") agregar(id, 0);
    else if (e.simklStatus === "plantowatch") agregar(id, 1);
    else if ((e.vistos || 0) > 0) agregar(id, e.simklStatus === "completed" ? 3 : 1);
  }
  for (const a of colaRestante) if (a.tipo === "show") agregar(a.tmdbId, 0);
  try {
    const cine = JSON.parse(await readFile(CINE_JSON_PATH, "utf-8"));
    for (const cat of cine.categories || []) {
      for (const it of cat.items || []) {
        const m = /^tmdb-tv-(\d+)$/.exec(it.guid || "");
        if (m) agregar(m[1], 2);
      }
    }
  } catch (e) { /* sin cine.json: solo lo de Simkl */ }

  const orden = [...prioridad.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  let llamadas = 0, nuevos = 0, refrescados = 0;
  const catalogos = new Map();
  for (const id of orden) {
    let cat = await leerCatalogo(id);
    const refreshMs = prioridad.get(id) >= 3 ? 7 * 24 * 3600 * 1000 : EPISODES_REFRESH_MS;
    const vencido = !cat || (Date.now() - new Date(cat.fetchedAt || 0).getTime()) > refreshMs;
    if (vencido && llamadas < EPISODES_BUDGET) {
      llamadas++;
      try {
        const fresco = await catalogoSerie(id, cat);
        if (cat) refrescados++; else nuevos++;
        cat = fresco;
        await writeFile(join(CATALOG_DIR, `${id}.json`), JSON.stringify(cat));
      } catch (e) {
        console.error(`✗ Simkl · catálogo de episodios tmdb-tv-${id}: ${e.message}`);
      }
    }
    if (cat) catalogos.set(id, cat);
  }

  // Avance por serie (liviano). Alcance: todo lo que está en curso o por ver
  // y todo lo que tiene algo visto -- aunque todavía no tenga catálogo, con
  // los contadores de Simkl alcanza para "pendientes".
  const hoy = new Date().toISOString().slice(0, 10);
  const series = {};
  for (const [id, s] of Object.entries(shows)) {
    const enAlcance = s.simklStatus === "watching" || s.simklStatus === "hold" || s.simklStatus === "plantowatch" || (s.vistos || 0) > 0;
    if (!enAlcance) continue;
    const ultimo = s.ultimo ?? s.progreso ?? null;
    const cat = catalogos.get(id);
    let ep = s.ep || {};
    let epInferido = false;
    if (!Object.keys(ep).length && (s.vistos || 0) > 0 && cat) {
      // Simkl no trae detalle por episodio de completed/dropped: se infiere.
      const inf = inferirEp(cat.temporadas, ultimo?.temporada != null ? ultimo : null, s.vistos, s.total);
      if (inf) { ep = inf; epInferido = true; }
    }
    let vistos, emitidos, pendientes;
    if (cat) {
      const v = armarVista({ temporadas: cat.temporadas, ep }, null, hoy);
      ({ vistos, emitidos, pendientes } = v);
    } else {
      vistos = s.vistos ?? 0;
      emitidos = Math.max((s.total ?? 0) - (s.noEmitidos ?? 0), 0);
      pendientes = Math.max(emitidos - vistos, 0);
    }
    series[id] = {
      nombre: cat?.nombre ?? null,
      simklStatus: s.simklStatus ?? null,
      vistos, emitidos, pendientes,
      ultimo,
      ep,
      ...(epInferido ? { epInferido: true } : {}),
      catalogo: !!cat,
    };
  }

  // Estados de Simkl por ítem (interesa/vista/descartada) para reflejar en la
  // Vitrina lo marcado fuera de ella.
  const estados = { tv: {}, movie: {} };
  for (const [id, s] of Object.entries(shows)) if (s.estado) estados.tv[id] = s.estado;
  for (const [id, m] of Object.entries(state.syncedList.movies || {})) if (m.estado) estados.movie[id] = m.estado;

  await writeFile(VITRINA_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), procesadas: state.procesadas, series, estados }));
  console.log(`✓ Simkl · avance de ${Object.keys(series).length} serie(s), catálogo de ${catalogos.size}/${orden.length} (${nuevos} nueva(s), ${refrescados} refrescada(s), ${llamadas} llamada(s) de detalle)`);
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
