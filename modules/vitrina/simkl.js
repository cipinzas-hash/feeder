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
const WORKER_URL = "https://angst-sync.angst-66394c52.workers.dev";
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

function getSimklAuth() {
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
  const filtered = pending.filter(a => !(a.tmdbId === parsed.tmdbId && a.tipo === parsed.tipo));
  const accion = { tmdbId: parsed.tmdbId, tipo: parsed.tipo, status, title: item.title, year, creadoEn: new Date().toISOString() };
  if (progreso) accion.progreso = progreso; // {temporada, episodio} -- build-simkl.mjs marca visto hasta ahí
  filtered.push(accion);
  saveSimklPending(filtered);
  flushSimklQueue(); // best effort, no bloquea la UI -- si falla, la cola queda para el próximo intento
}
let simklFlushInFlight = false;
export async function flushSimklQueue() {
  if (simklFlushInFlight) return;
  const auth = getSimklAuth();
  const pending = loadSimklPending();
  if (!auth || !pending.length) return;
  simklFlushInFlight = true;
  setSimklSyncStatus({ estado: "syncing" });
  try {
    // El POST del Worker REEMPLAZA el archivo entero, no hace merge --
    // hay que leer primero o se perdería syncedList/lastSimklActivity
    // (los escribe build-simkl.mjs del lado servidor) sin querer.
    const getResp = await fetch(`${WORKER_URL}?path=simkl-state.json`, { headers: { "X-Angst-Auth": auth } });
    if (!getResp.ok) { setSimklSyncStatus({ estado: "error", ultimoError: `GET ${getResp.status}` }); return; }
    const remote = await getResp.json();
    if (remote.found === false) { setSimklSyncStatus({ estado: "error", ultimoError: "simkl-state.json no existe todavía" }); return; }
    const remotePending = remote.pendingActions || [];
    const remoteKeys = new Set(remotePending.map(a => `${a.tipo}-${a.tmdbId}`));
    const merged = [...remotePending, ...pending.filter(a => !remoteKeys.has(`${a.tipo}-${a.tmdbId}`))];
    remote.pendingActions = merged;
    const postResp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "X-Angst-Auth": auth, "Content-Type": "application/json" },
      body: JSON.stringify({ path: "simkl-state.json", payload: remote }),
    });
    if (postResp.ok) {
      saveSimklPending([]); // confirmado en Angst-data -- build-simkl.mjs lo toma de ahí en su próxima corrida
      setSimklSyncStatus({ estado: "ok", ultimoOk: new Date().toISOString(), ultimoError: null });
    } else {
      setSimklSyncStatus({ estado: "error", ultimoError: `POST ${postResp.status}` });
    }
  } catch (e) {
    // sin red o Worker caído -- la cola local queda intacta, se reintenta la próxima vez
    setSimklSyncStatus({ estado: "error", ultimoError: e.message });
  } finally {
    simklFlushInFlight = false;
  }
}
