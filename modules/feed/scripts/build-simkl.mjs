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

import { readFile, writeFile } from "node:fs/promises";
import { enrichMovieOrTv, tmdb } from "./lib/enrich.mjs";
import { encodeRangos, parseSxxExx, agruparPorTemporada, opsVacias } from "../../shared/episodios.js";

const SIMKL_ACCESS_TOKEN = process.env.SIMKL_ACCESS_TOKEN;
const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;
// Angst-data es un repo aparte de feeder -- el workflow lo clona como
// directorio hermano y pasa la ruta acá. No se puede adivinar por
// posición relativa al script como con feed.json/cine.json (mismo repo).
const STATE_PATH = process.env.SIMKL_STATE_PATH;
const DISCOVERY_PATH = process.env.SIMKL_DISCOVERY_PATH; // ídem, otro archivo en Angst-data
// Catálogo de episodios (nombre/fecha por episodio, TMDb) + avance por
// episodio leído de Simkl, en un solo archivo PRIVADO de Angst-data: saber
// QUÉ series seguís es dato personal, no va al feeder público.
const EPISODES_PATH = process.env.SERIES_EPISODES_PATH;
// Subir este número fuerza UNA relectura completa de /sync/all-items/shows
// (sin date_from) la próxima corrida, para que el estado guardado traiga el
// detalle por episodio. Es el "initial sync" normal de la API, no un abuso:
// se sigue chequeando /sync/activities antes y el resto de las corridas
// vuelve a leer solo cambios.
const EPISODIOS_V = 1;
// Cuántas series (llamadas /tv/{id}) refrescar del catálogo por corrida.
const EPISODES_BUDGET = 40;
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
  state.pendingActions = state.pendingActions || [];

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
  for (const action of state.pendingActions) {
    try {
      if (action.kind === "episodios" && action.tipo === "show") {
        // Marcado episodio por episodio (issue #13): altas por /sync/history,
        // bajas por /sync/history/remove. Agrupado por temporada.
        const base = { ids: { tmdb: action.tmdbId }, title: action.title, year: action.year };
        const ops = { marcar: action.marcar || [], desmarcar: action.desmarcar || [] };
        if (opsVacias(ops)) { console.log(`· Simkl · acción de episodios vacía: ${action.title || action.tmdbId}`); continue; }
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
      pushed = true;
    } catch (e) {
      console.error(`✗ Simkl · no se pudo sincronizar '${action.title || action.tmdbId}': ${e.message}`);
      stillPending.push(action); // se reintenta la próxima corrida
    }
  }
  state.pendingActions = stillPending;
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
  await buildEpisodios(state);
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
// series-episodios.json en Angst-data (privado), una entrada por serie:
//   { nombre, fetchedAt, temporadas: [{ n, eps: [[numero, nombre, fecha], ...] }],
//     simklStatus, vistos, total, noEmitidos, ultimo, siguiente, ep }
// El catálogo (nombres/fechas) sale de TMDb y se cachea; el avance sale de
// state.syncedList (Simkl). El cliente lo lee vía el Worker, autenticado.
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

async function buildEpisodios(state) {
  if (!EPISODES_PATH) {
    console.log("⚠ Simkl · SERIES_EPISODES_PATH no seteado, se omite el catálogo de episodios esta corrida");
    return;
  }
  let previo = { shows: {} };
  try { previo = JSON.parse(await readFile(EPISODES_PATH, "utf-8")); } catch (e) { /* primera corrida */ }
  const soloCatalogo = (e) => e ? { nombre: e.nombre, fetchedAt: e.fetchedAt, temporadas: e.temporadas } : null;

  // Alcance, en orden de prioridad (si el presupuesto no alcanza, lo que
  // queda entra en la corrida siguiente): en curso > por ver > catálogo de Vitrina.
  const prioridad = new Map();
  const agregar = (id, p) => { id = String(id); if (!prioridad.has(id) || prioridad.get(id) > p) prioridad.set(id, p); };
  for (const [id, e] of Object.entries(state.syncedList.shows || {})) {
    if (e.simklStatus === "watching" || e.simklStatus === "hold") agregar(id, 0);
    else if (e.simklStatus === "plantowatch") agregar(id, 1);
  }
  for (const a of state.pendingActions || []) if (a.tipo === "show") agregar(a.tmdbId, 0);
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
  const shows = {};
  for (const id of orden) {
    let cat = soloCatalogo(previo.shows?.[id]);
    const vencido = !cat || (Date.now() - new Date(cat.fetchedAt || 0).getTime()) > EPISODES_REFRESH_MS;
    if (vencido && llamadas < EPISODES_BUDGET) {
      llamadas++;
      try {
        const fresco = await catalogoSerie(id, cat);
        if (cat) refrescados++; else nuevos++;
        cat = fresco;
      } catch (e) {
        console.error(`✗ Simkl · catálogo de episodios tmdb-tv-${id}: ${e.message}`);
      }
    }
    if (!cat) continue; // todavía sin catálogo (entra en una corrida próxima)
    const s = state.syncedList.shows?.[id];
    shows[id] = {
      ...cat,
      simklStatus: s?.simklStatus ?? null,
      vistos: s?.vistos ?? null,
      total: s?.total ?? null,
      noEmitidos: s?.noEmitidos ?? null,
      ultimo: s?.progreso ?? null,
      siguiente: s?.siguiente ?? null,
      ep: s?.ep || {},
    };
  }
  console.log(`✓ Simkl · episodios: ${Object.keys(shows).length}/${orden.length} serie(s) con catálogo (${nuevos} nueva(s), ${refrescados} refrescada(s), ${llamadas} llamada(s) de detalle)`);
  await writeFile(EPISODES_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), shows }));
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
