import { armarVista, keyEp, epMapToSet } from "../shared/episodios.js";
import { WORKER_URL, getSimklAuth, enqueueEpisodiosAction } from "./simkl.js";
import { marcarEdicionLocal } from "../shared/localedit.js";

const { useState, useEffect } = React;

// ─── Episodios por serie (issue #13) ────────────────────────────────────────
// Fuente: series-episodios.json en Angst-data (privado), que arma
// build-simkl.mjs con el catálogo de TMDb (nombre/fecha de cada episodio) y
// el avance real de Simkl. Se lee vía el Worker, igual que simkl-discovery.
//
// Escritura optimista: al marcar/desmarcar, la marca queda en un "overlay"
// local (localStorage) y se encola la acción para Simkl. El overlay se
// descarta episodio por episodio apenas Simkl lo refleja (o a las 48 hs, por
// si la acción se perdió), así la UI nunca muestra el estado viejo mientras
// espera a la próxima sincronización.

const OVERLAY_KEY = "angst-series-overlay-v1";
const OVERLAY_TTL_MS = 48 * 3600 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

const listeners = new Set();
let remote = null;          // { generatedAt, shows: { [tmdbId]: entry } }
let remoteAt = 0;
let cargando = false;
let errorCarga = null;
let overlay = loadOverlay();

function loadOverlay() {
  try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function saveOverlay() {
  try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay)); } catch (e) {}
}
function notify() { listeners.forEach(fn => fn(n => n + 1)); }
// Tras restaurar desde Angst-data / .json: el overlay en memoria se armó al
// cargar la página; hay que releerlo de localStorage (ver estado.js).
export function rehidratarOverlay() { overlay = loadOverlay(); notify(); }

// Quita del overlay lo que Simkl ya refleja y lo que venció.
function podarOverlay() {
  const ahora = Date.now();
  let cambio = false;
  for (const [id, marcas] of Object.entries(overlay)) {
    const vistosRemotos = remote?.shows?.[id] ? epMapToSet(remote.shows[id].ep) : null;
    for (const [k, o] of Object.entries(marcas)) {
      const vencida = ahora - (o.ts || 0) > OVERLAY_TTL_MS;
      const reflejada = vistosRemotos && vistosRemotos.has(k) === !!o.v;
      if (vencida || reflejada) { delete marcas[k]; cambio = true; }
    }
    if (!Object.keys(marcas).length) { delete overlay[id]; cambio = true; }
  }
  if (cambio) saveOverlay();
}

export function cargarEpisodios({ forzar = false } = {}) {
  const auth = getSimklAuth();
  if (!auth) { errorCarga = "sin-auth"; return; }
  if (cargando || (!forzar && remote && Date.now() - remoteAt < REFRESH_MS)) return;
  cargando = true;
  fetch(`${WORKER_URL}?path=series-episodios.json`, { headers: { "X-Angst-Auth": auth } })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d && d.found !== false && d.shows) {
        remote = d; remoteAt = Date.now(); errorCarga = null;
        podarOverlay();
      } else if (!remote) {
        errorCarga = "sin-datos";
      }
    })
    .catch(() => { if (!remote) errorCarga = "red"; })
    .finally(() => { cargando = false; notify(); });
}

function tmdbIdDe(guid) {
  const m = /^tmdb-tv-(\d+)$/.exec(guid || "");
  return m ? m[1] : null;
}
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Hook interno: re-render cuando cambian los datos o el overlay.
function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    listeners.add(setN);
    cargarEpisodios();
    return () => listeners.delete(setN);
  }, []);
}

// Vista de una serie (o null si todavía no hay catálogo para ella).
export function useSerieEpisodios(guid) {
  useTick();
  const id = tmdbIdDe(guid);
  const entry = id && remote?.shows?.[id];
  if (!entry) return { vista: null, estadoCarga: cargando ? "cargando" : (errorCarga || (remote ? "sin-catalogo" : "idle")) };
  return { vista: armarVista(entry, overlay[id], hoyISO()), estadoCarga: "ok", entry };
}

// Pendientes de una serie para pintar en las tarjetas. Solo series "en curso"
// (con algo visto): una serie sin empezar no necesita un "40 pendientes".
export function usePendientesDe() {
  useTick();
  return (guid) => {
    const id = tmdbIdDe(guid);
    const entry = id && remote?.shows?.[id];
    if (!entry) return null;
    const v = armarVista(entry, overlay[id], hoyISO());
    return v.vistos > 0 && v.pendientes > 0 ? v.pendientes : null;
  };
}

function aplicarMarcas(item, ops) {
  const id = tmdbIdDe(item.guid);
  if (!id) return;
  const marcas = (overlay[id] ||= {});
  const ts = Date.now();
  for (const [t, e] of ops.marcar || []) marcas[keyEp(t, e)] = { v: true, ts };
  for (const [t, e] of ops.desmarcar || []) marcas[keyEp(t, e)] = { v: false, ts };
  saveOverlay();
  marcarEdicionLocal();
  enqueueEpisodiosAction(item, ops);
  notify();
}

export function toggleEpisodio(item, t, e, visto) {
  aplicarMarcas(item, visto ? { desmarcar: [[t, e]] } : { marcar: [[t, e]] });
}

// Marca (o desmarca) todos los episodios EMITIDOS de la temporada que
// todavía no están en ese estado. Los que no salieron no se tocan.
export function marcarTemporada(item, vista, n, marcar) {
  const t = vista.temporadas.find(x => x.n === n);
  if (!t) return;
  const pares = t.eps.filter(x => x.emitido && x.visto !== marcar).map(x => [n, x.e]);
  if (pares.length) aplicarMarcas(item, marcar ? { marcar: pares } : { desmarcar: pares });
}

// "Hasta acá": marca como vistos todos los episodios emitidos anteriores o
// iguales a (t, e), de cualquier temporada, que todavía no lo estén.
export function marcarHastaAca(item, vista, t, e) {
  const pares = [];
  for (const s of vista.temporadas) {
    for (const x of s.eps) {
      if ((s.n < t || (s.n === t && x.e <= e)) && x.emitido && !x.visto) pares.push([s.n, x.e]);
    }
  }
  if (pares.length) aplicarMarcas(item, { marcar: pares });
}
