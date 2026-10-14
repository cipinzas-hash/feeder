import { armarVista, avanceEfectivo, epMapToSet, keyEp } from "../shared/episodios.js";
import { WORKER_URL, enqueueEpisodiosAction, getSimklAuth, setProcesadasConocidas } from "./simkl.js";
import { marcarEdicionLocal } from "../shared/localedit.js";

const { useState, useEffect } = React;

// ─── Avance de series y estados de Simkl (issue #13) ────────────────────────
// Dos fuentes, ambas en Angst-data (privado) y leídas vía el Worker:
//  - simkl-vitrina.json (liviano, ~decenas de KB): por serie vistos/pendientes y
//    episodios vistos; más el estado de Simkl de cada película/serie. Se baja
//    al abrir la Vitrina: alimenta "solo pendientes", los badges y los estados.
//  - series-episodios/<id>.json: nombre y fecha de cada episodio de UNA serie.
//    Se baja recién al abrir la ficha de esa serie (antes era un único archivo
//    de 3 MB con todas las series que se bajaba al montar el carrusel).
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
let version = 0;
let remote = null;          // { generatedAt, procesadas, series: { [tmdbId]: entry }, estados: { tv, movie } }
let remoteAt = 0;
let cargando = false;
let errorCarga = null;      // "sin-auth" | "sin-datos" | "red" | null
let overlay = loadOverlay();
const catalogos = new Map(); // tmdbId -> { estado: "cargando" | "ok" | "error", data }
const setsCache = new WeakMap(); // entry -> Set de "t-e" ya decodificado

function loadOverlay() {
  try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function saveOverlay() {
  try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay)); } catch (e) {}
}
function notify() { version++; listeners.forEach(fn => fn(version)); }
// Tras restaurar desde Angst-data / .json: el overlay en memoria se armó al
// cargar la página; hay que releerlo de localStorage (ver estado.js).
export function rehidratarOverlay() { overlay = loadOverlay(); notify(); }

function vistosRemotos(entry) {
  let s = setsCache.get(entry);
  if (!s) { s = epMapToSet(entry.ep); setsCache.set(entry, s); }
  return s;
}

// Quita del overlay lo que Simkl ya refleja y lo que venció.
function podarOverlay() {
  const ahora = Date.now();
  let cambio = false;
  for (const [id, marcas] of Object.entries(overlay)) {
    const entry = remote?.series?.[id];
    const reales = entry ? vistosRemotos(entry) : null;
    for (const [k, o] of Object.entries(marcas)) {
      const vencida = ahora - (o.ts || 0) > OVERLAY_TTL_MS;
      const reflejada = reales && reales.has(k) === !!o.v;
      if (vencida || reflejada) { delete marcas[k]; cambio = true; }
    }
    if (!Object.keys(marcas).length) { delete overlay[id]; cambio = true; }
  }
  if (cambio) saveOverlay();
}

export function cargarAvance({ forzar = false } = {}) {
  const auth = getSimklAuth();
  if (!auth) { if (errorCarga !== "sin-auth") { errorCarga = "sin-auth"; notify(); } return; }
  if (cargando || (!forzar && remote && Date.now() - remoteAt < REFRESH_MS)) return;
  cargando = true;
  fetch(`${WORKER_URL}?path=simkl-vitrina.json`, { headers: { "X-Angst-Auth": auth } })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d && d.found !== false && d.series) {
        remote = d; remoteAt = Date.now(); errorCarga = null;
        setProcesadasConocidas(d.procesadas);
        podarOverlay();
      } else if (!remote) {
        errorCarga = "sin-datos";
      }
    })
    .catch(() => { if (!remote) errorCarga = "red"; })
    .finally(() => { cargando = false; notify(); });
}

function cargarCatalogo(id) {
  const auth = getSimklAuth();
  const previo = catalogos.get(id);
  if (!auth || (previo && previo.estado !== "error")) return;
  catalogos.set(id, { estado: "cargando" });
  fetch(`${WORKER_URL}?path=series-episodios/${id}.json`, { headers: { "X-Angst-Auth": auth } })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      catalogos.set(id, d && d.found !== false && Array.isArray(d.temporadas) ? { estado: "ok", data: d } : { estado: "error" });
    })
    .catch(() => catalogos.set(id, { estado: "error" }))
    .finally(notify);
}

function tmdbIdDe(guid) {
  const m = /^tmdb-tv-(\d+)$/.exec(guid || "");
  return m ? m[1] : null;
}
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Re-render cuando cambian los datos o el overlay. Devuelve un número de
// versión que sirve como dependencia estable de useMemo.
export function useAvanceVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    cargarAvance();
    return () => listeners.delete(setV);
  }, []);
  return v;
}

// Estado de la carga, para avisar en pantalla en vez de mostrar nada.
export function estadoAvance() {
  return { cargando, error: errorCarga, hayDatos: !!remote, generatedAt: remote?.generatedAt || null };
}

// Avance de una serie con las marcas locales aplicadas (o null si no hay datos).
// Funciones de módulo (identidad estable): se usan dentro de useMemo con la
// versión de useAvanceVersion() como dependencia.
export function avanceDe(guid) {
  const id = tmdbIdDe(guid);
  const entry = id && remote?.series?.[id];
  if (!entry) return null;
  const ef = avanceEfectivo(entry, overlay[id]);
  return { vistos: ef.vistos, pendientes: ef.pendientes, simklStatus: entry.simklStatus, catalogo: !!entry.catalogo, epInferido: !!entry.epInferido };
}

// Estado que Simkl tiene para este ítem ("interesa" | "vista" | "descartada"),
// para reflejar lo marcado fuera de la Vitrina. Las marcas locales ganan.
export function estadoRemotoDe(guid) {
  const m = /^tmdb-(movie|tv)-(\d+)$/.exec(guid || "");
  if (!m) return null;
  return remote?.estados?.[m[1]]?.[m[2]] ?? null;
}
export function estadoEfectivo(cineEstado, guid) {
  return cineEstado[guid]?.estado ?? estadoRemotoDe(guid) ?? "sin_marca";
}

// Vista completa de una serie (temporadas, episodios con nombre) -- baja el
// catálogo de ESA serie la primera vez que se usa.
export function useSerieEpisodios(guid) {
  useAvanceVersion();
  const id = tmdbIdDe(guid);
  useEffect(() => { if (id && remote?.series?.[id]?.catalogo) cargarCatalogo(id); });
  const entry = id && remote?.series?.[id];
  if (!entry) return { vista: null, estadoCarga: cargando ? "cargando" : (errorCarga || "sin-datos") };
  if (!entry.catalogo) return { vista: null, estadoCarga: "sin-catalogo", entry };
  const cat = catalogos.get(id);
  if (!cat || cat.estado === "cargando") return { vista: null, estadoCarga: "cargando", entry };
  if (cat.estado === "error") return { vista: null, estadoCarga: "error", entry };
  return { vista: armarVista({ temporadas: cat.data.temporadas, ep: entry.ep }, overlay[id], hoyISO()), estadoCarga: "ok", entry };
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
