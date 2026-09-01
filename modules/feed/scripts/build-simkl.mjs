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

const SIMKL_ACCESS_TOKEN = process.env.SIMKL_ACCESS_TOKEN;
const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;
// Angst-data es un repo aparte de feeder -- el workflow lo clona como
// directorio hermano y pasa la ruta acá. No se puede adivinar por
// posición relativa al script como con feed.json/cine.json (mismo repo).
const STATE_PATH = process.env.SIMKL_STATE_PATH;
if (!STATE_PATH) {
  console.error("✗ Falta SIMKL_STATE_PATH (ruta a simkl-state.json en el checkout de Angst-data)");
  process.exit(1);
}

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
  const entry = { estado };
  if (tipo === "show" && (item.status === "watching" || item.status === "hold")) {
    entry.progreso = {
      temporada: item.next_episode?.season ?? item.last_watched?.season ?? null,
      episodio: item.next_episode?.episode ?? item.last_watched?.episode ?? null,
    };
  }
  return entry;
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
  const currentAll = activities?.all;
  const sinCambios = state.lastSimklActivity && currentAll && state.lastSimklActivity === currentAll;

  // 2) Procesar la cola de pendientes ANTES de refrescar syncedList, así
  // lo que se acaba de empujar ya se refleja en la lectura de más abajo
  // en vez de pisarse con un estado leído de antes.
  const stillPending = [];
  for (const action of state.pendingActions) {
    try {
      if (action.status === "completed") {
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
    } catch (e) {
      console.error(`✗ Simkl · no se pudo sincronizar '${action.title || action.tmdbId}': ${e.message}`);
      stillPending.push(action); // se reintenta la próxima corrida
    }
  }
  state.pendingActions = stillPending;

  // 3) Refrescar syncedList -- solo si hubo cambios reales (regla de la API).
  if (!sinCambios) {
    console.log("Actividad cambió (o primera corrida) -- pidiendo /sync/all-items...");
    const dateFrom = state.lastSimklActivity ? `?date_from=${encodeURIComponent(state.lastSimklActivity)}` : "";
    const movies = await simklGet(`/sync/all-items/movies${dateFrom}`);
    const shows = await simklGet(`/sync/all-items/shows${dateFrom}`);

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
    console.log(`✓ Simkl · ${Object.keys(state.syncedList.movies).length} película(s), ${Object.keys(state.syncedList.shows).length} serie(s) en syncedList`);
  } else {
    console.log("Sin cambios en Simkl desde la última corrida -- se omite /sync/all-items.");
  }

  state.generatedAt = new Date().toISOString();
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
  console.log("✓ simkl-state.json actualizado");
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
