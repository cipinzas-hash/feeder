import { mergeEpisodeOps, opsVacias, restarOps } from "../shared/episodios.js";

const { useState, useEffect, useRef } = React;


// ─── Simkl discovery ("bajo el radar") -- fetch único, cacheado a nivel de
// módulo, compartido entre las 3 categorías de Vitrina (Películas/Series/
// Animación). Mismo patrón reactivo que cineEstadoCache más abajo.
const simklDiscoveryListeners = new Set();
let simklDiscoveryItems = [];
let simklDiscoveryFetched = false;
export function useSimklDiscovery() {
  const [items, setItems] = useState(simklDiscoveryItems);
  useEffect(() => {
    simklDiscoveryListeners.add(setItems);
    if (!simklDiscoveryFetched) {
      simklDiscoveryFetched = true;
      const auth = getSimklAuth();
      if (auth) {
        fetch(`${WORKER_URL}?path=simkl-discovery.json`, { headers: { "X-Angst-Auth": auth } })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d && d.found !== false && Array.isArray(d.items)) {
              simklDiscoveryItems = d.items.map(it => ({ ...it, _deSimkl: true }));
              simklDiscoveryListeners.forEach(fn => fn(simklDiscoveryItems));
            }
          })
          .catch(() => {}); // sin red o Worker caído -- la Vitrina sigue andando sin esto, no es crítico
      }
    }
    return () => simklDiscoveryListeners.delete(setItems);
  }, []);
  return items;
}

// ─── Simkl: cola de pendientes + envío al Worker (issue #14) ───
// El navegador nunca le habla a Simkl directo (su API no tiene CORS) ni
// a GitHub directo (expondría una credencial fuerte) -- todo pasa por
// el Worker (angst-sync), que sí tiene ambas credenciales, server-side.
//
// AUTH_SECRET del Worker NO puede hornearse acá como constante --
// feeder es un repo público, cualquiera que lea el código lo vería y
// el secret dejaría de proteger nada. Se pide una sola vez con un
// prompt y se guarda SOLO en localStorage de este dispositivo -- nunca
// se commitea, nunca sale en el export/import de Angst.
const SIMKL_PENDING_KEY = "angst-simkl-pending-v1";
const SIMKL_AUTH_KEY = "angst-simkl-auth-v1";
export const WORKER_URL = "https://angst-sync.angst-66394c52.workers.dev";
const SIMKL_ESTADO_TO_STATUS = { interesa: "plantowatch", vista: "completed", descartada: "dropped" };

// Reactivo -- sin esto, conectar (o que el flush cambie de estado) no
// dispara ningún re-render, así que el botón/badge del toolbar se queda
// pegado en su estado viejo hasta que algo MÁS fuerce un refresh. Mismo
// patrón que cineEstadoListeners más arriba.
const simklSyncListeners = new Set();
let simklSyncStatus = { conectado: false, estado: "idle", ultimoOk: null, ultimoError: null };
try { simklSyncStatus.conectado = !!localStorage.getItem(SIMKL_AUTH_KEY); } catch (e) {}
function setSimklSyncStatus(patch) {
  simklSyncStatus = { ...simklSyncStatus, ...patch };
  simklSyncListeners.forEach(fn => fn(simklSyncStatus));
}
export function useSimklSyncStatus() {
  const [s, setS] = useState(simklSyncStatus);
  useEffect(() => {
    simklSyncListeners.add(setS);
    return () => simklSyncListeners.delete(setS);
  }, []);
  return s;
}

export function getSimklAuth() {
  try { return localStorage.getItem(SIMKL_AUTH_KEY) || null; } catch (e) { return null; }
}
export function pedirSimklAuth() {
  const v = prompt("Pegá el AUTH_SECRET del Worker de Simkl (una sola vez, queda solo en este dispositivo):");
  if (v && v.trim()) {
    try { localStorage.setItem(SIMKL_AUTH_KEY, v.trim()); } catch (e) {}
    setSimklSyncStatus({ conectado: true });
    flushSimklQueue();
  }
}
function loadSimklPending() {
  try { const raw = localStorage.getItem(SIMKL_PENDING_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
function saveSimklPending(arr) {
  try { localStorage.setItem(SIMKL_PENDING_KEY, JSON.stringify(arr)); } catch (e) {}
}
// guid = "tmdb-movie-603" / "tmdb-tv-1399" (ver build-cine.mjs) -- el
// ID de TMDb ya vive en el guid, no hace falta un campo nuevo.
function parseTmdbGuid(guid) {
  const m = /^tmdb-(movie|tv)-(\d+)$/.exec(guid || "");
  if (!m) return null;
  return { tipo: m[1] === "movie" ? "movie" : "show", tmdbId: Number(m[2]) };
}
// Cada acción lleva un id: la cola del repo es "solo agregar" y build-simkl
// anota los ids ya procesados, así nadie tiene que reescribir lo del otro.
function nuevoId() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
// ids que build-simkl ya procesó (los trae simkl-vitrina.json, ver avance.js):
// permiten podar la cola del repo.
let procesadasConocidas = new Set();
export function setProcesadasConocidas(ids) { procesadasConocidas = new Set(ids || []); }

export function enqueueSimklAction(item, estadoLocal, progreso) {
  const parsed = parseTmdbGuid(item?.guid);
  if (!parsed) return; // Animación (a veces ID de MAL) u otra fuente sin tmdb -- no aplica todavía
  // Con progreso de episodio, el status real en Simkl es "watching" --
  // "plantowatch" es para lo que todavía ni empezaste. Solo aplica a
  // series (parsed.tipo === "show"); progreso en una película no
  // tiene sentido.
  const status = progreso && parsed.tipo === "show" ? "watching" : SIMKL_ESTADO_TO_STATUS[estadoLocal];
  if (!status) return;
  const year = item.pubDate ? new Date(item.pubDate).getFullYear() : undefined;
  const pending = loadSimklPending();
  // Reemplaza cualquier acción pendiente anterior del mismo ítem -- no
  // tiene sentido mandar dos veces, gana la más reciente.
  const filtered = pending.filter(a => !(a.kind !== "episodios" && a.tmdbId === parsed.tmdbId && a.tipo === parsed.tipo));
  const accion = { id: nuevoId(), tmdbId: parsed.tmdbId, tipo: parsed.tipo, status, title: item.title, year, creadoEn: new Date().toISOString() };
  if (progreso) accion.progreso = progreso; // {temporada, episodio} -- build-simkl.mjs marca visto hasta ahí
  filtered.push(accion);
  saveSimklPending(filtered);
  flushSimklQueue(); // best effort, no bloquea la UI -- si falla, la cola queda para el próximo intento
}
// Marcado episodio por episodio (issue #13). ops = { marcar: [[t,e],...], desmarcar: [[t,e],...] }.
// A diferencia de las acciones de estado (gana la última), las de episodios
// se ACUMULAN por serie: marcar tres episodios seguidos antes de que corra la
// sincronización tiene que terminar en tres marcas, no en una.
export function enqueueEpisodiosAction(item, ops) {
  const parsed = parseTmdbGuid(item?.guid);
  if (!parsed || parsed.tipo !== "show" || opsVacias(ops)) return false;
  const year = item.pubDate ? new Date(item.pubDate).getFullYear() : undefined;
  const pending = loadSimklPending();
  const previa = pending.find(a => a.kind === "episodios" && a.tmdbId === parsed.tmdbId);
  const fusion = mergeEpisodeOps(previa, ops);
  const resto = pending.filter(a => !(a.kind === "episodios" && a.tmdbId === parsed.tmdbId));
  if (!opsVacias(fusion)) {
    resto.push({ id: previa?.id || nuevoId(), kind: "episodios", tipo: "show", tmdbId: parsed.tmdbId, title: item.title, year, marcar: fusion.marcar, desmarcar: fusion.desmarcar, creadoEn: new Date().toISOString() });
  }
  saveSimklPending(resto);
  flushSimklQueue();
  return true;
}
// Cola en el repo: simkl-queue.json lo escribe SOLO el navegador y lo lee
// build-simkl (que anota lo procesado en su propio estado). Antes el
// navegador reescribía simkl-state.json, que también escribe el cron: si el
// cron terminaba mientras tanto, el reintento de su push pisaba las acciones.
const SIMKL_QUEUE_FILE = "simkl-queue.json";
const COLA_MAX_EDAD_MS = 14 * 24 * 3600 * 1000;

// Tras confirmar un envío: se descarta de la cola local SOLO lo que viajó.
// Lo que se marcó mientras el envío estaba en vuelo se conserva (antes se
// vaciaba la cola entera y esas marcas se perdían sin avisar).
function reconciliarTrasEnvio(enviadas) {
  const porId = new Map(enviadas.map(a => [a.id, a]));
  const resto = [];
  for (const a of loadSimklPending()) {
    const enviada = porId.get(a.id);
    if (!enviada) { resto.push(a); continue; } // llegó durante el envío
    if (a.kind === "episodios") {
      const ops = restarOps(a, enviada); // lo agregado a esta acción después del snapshot
      if (!opsVacias(ops)) resto.push({ ...a, id: nuevoId(), marcar: ops.marcar, desmarcar: ops.desmarcar });
    }
    // acción de estado con el mismo id: viajó completa
  }
  saveSimklPending(resto);
  return resto.length;
}

let simklFlushInFlight = false;
let simklFlushRepetir = false;
export async function flushSimklQueue() {
  if (simklFlushInFlight) { simklFlushRepetir = true; return; } // se re-evalúa al terminar
  const auth = getSimklAuth();
  const pending = loadSimklPending();
  if (!auth || !pending.length) return;
  simklFlushInFlight = true;
  setSimklSyncStatus({ estado: "syncing" });
  const enviadas = JSON.parse(JSON.stringify(pending)); // snapshot de lo que se manda
  let quedaron = 0;
  try {
    const getResp = await fetch(`${WORKER_URL}?path=${SIMKL_QUEUE_FILE}`, { headers: { "X-Angst-Auth": auth } });
    if (!getResp.ok) { setSimklSyncStatus({ estado: "error", ultimoError: `GET ${getResp.status}` }); return; }
    const remote = await getResp.json();
    const colaRemota = remote.found === false ? [] : (Array.isArray(remote.actions) ? remote.actions : []);
    const ahora = Date.now();
    // Se poda lo ya procesado por el cron y lo muy viejo; el resto se conserva.
    const vigentes = colaRemota.filter(a => a.id && !procesadasConocidas.has(a.id)
      && ahora - new Date(a.creadoEn || ahora).getTime() < COLA_MAX_EDAD_MS);
    const ids = new Set(vigentes.map(a => a.id));
    const nuevas = enviadas.filter(a => !ids.has(a.id)); // idempotente si un reintento llega tras un POST cuya respuesta se perdió
    const postResp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "X-Angst-Auth": auth, "Content-Type": "application/json" },
      body: JSON.stringify({ path: SIMKL_QUEUE_FILE, payload: { actions: [...vigentes, ...nuevas] } }),
    });
    if (postResp.ok) {
      quedaron = reconciliarTrasEnvio(enviadas); // confirmado en Angst-data -- build-simkl lo toma en su próxima corrida
      setSimklSyncStatus({ estado: "ok", ultimoOk: new Date().toISOString(), ultimoError: null });
    } else {
      setSimklSyncStatus({ estado: "error", ultimoError: `POST ${postResp.status}` });
    }
  } catch (e) {
    // sin red o Worker caído -- la cola local queda intacta, se reintenta la próxima vez
    setSimklSyncStatus({ estado: "error", ultimoError: e.message });
  } finally {
    simklFlushInFlight = false;
    const repetir = simklFlushRepetir || quedaron > 0;
    simklFlushRepetir = false;
    if (repetir && loadSimklPending().length && simklSyncStatus.estado !== "error") setTimeout(flushSimklQueue, 0);
  }
}
