import { marcarEdicionLocal } from "../shared/localedit.js";

const { useState, useEffect, useRef } = React;


// ─── STATUS_BADGE — traduce item.status (crudo de TMDb para pelis/series,
// de Jikan para anime) a lo que Cristopher realmente quiere saber al ver
// una tarjeta en Vitrina: ¿esto es un estreno, sigue en emisión, o es una
// serie vieja ya terminada? "Released" (pelis) no se muestra — es el caso
// normal y no aporta nada, solo ruido.
export const STATUS_BADGE = {
  "Returning Series": { label: "EN EMISIÓN", color: "#4caf7d" },
  "In Production": { label: "EN PRODUCCIÓN", color: "#5c9cff" },
  "Planned": { label: "PRÓXIMAMENTE", color: "#5c9cff" },
  "Pilot": { label: "PILOTO", color: "#5c9cff" },
  "Post Production": { label: "POST-PRODUCCIÓN", color: "#5c9cff" },
  "Ended": { label: "FINALIZADA", color: "#888" },
  "Canceled": { label: "CANCELADA", color: "#888" },
  "Currently Airing": { label: "EN EMISIÓN", color: "#4caf7d" },
  "Finished Airing": { label: "FINALIZADA", color: "#888" },
  "Not yet aired": { label: "PRÓXIMAMENTE", color: "#5c9cff" },
};

// Solo aplica a Series (item.numberOfSeasons viene de TMDb, ver
// build-cine.mjs). En emisión: temporada actual en curso. Terminada/
// cancelada: total de temporadas que tuvo.
export function seasonLabel(item) {
  if (item.categoria !== "Series" || !item.numberOfSeasons) return null;
  if (item.status === "Returning Series" && item.currentSeason) return `T${item.currentSeason} en curso`;
  return item.numberOfSeasons === 1 ? "1 temporada" : `${item.numberOfSeasons} temporadas`;
}

// ─── CineExtendedView — formato "cine" del detalle ──────────────────────────
// ─── Estado de Cine (interesa/descartada/vista) — decisión tomada en el
// detalle, después de tráiler/sinopsis (nunca desde el póster del carrusel,
// que es puramente de exhibición). Clave propia de localStorage, aislada
// del blob principal (mismo patrón que PODCASTS_ESCUCHADOS_KEY), pero se
// cose al export/import general (ver core/persistence.js) porque acá sí
// aplica la regla de "toda la info entra al export".
//   sin_marca  -> default, sin decisión tomada aún
//   interesa   -> guarda copia completa del item (título/imagen/sinopsis/
//                 trailer/rating) para sobrevivir a la poda de 30 días de
//                 build-cine.mjs, que no sabe nada de este estado
//   descartada -> no me interesa
//   vista      -> rating obligatorio (4 categorías) + nota opcional
const CINE_ESTADO_KEY = "angst-cine-estado-v1";
const CINE_NUEVO_MS = 7 * 86400000; // 1 semana desde firstSeenAt
export const CINE_RATINGS = [
  { id: "unwatchable", emoji: "💀", label: "unwatchable" },
  { id: "forgettable", emoji: "😐", label: "forgettable" },
  { id: "remarkable", emoji: "✨", label: "remarkable" },
  { id: "outstanding", emoji: "🏆", label: "outstanding" },
];
function loadCineEstado() {
  try {
    const raw = localStorage.getItem(CINE_ESTADO_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
let cineEstadoCache = loadCineEstado();
const cineEstadoListeners = new Set();
function saveCineEstado(map) {
  cineEstadoCache = map;
  try { localStorage.setItem(CINE_ESTADO_KEY, JSON.stringify(map)); } catch (e) {}
  marcarEdicionLocal();
  cineEstadoListeners.forEach(fn => fn(map));
}
// Después de restaurar desde Angst-data / .json (App.jsx → restoreFromPayload)
// el payload se escribe directo a localStorage, pero esta caché de módulo se
// armó al cargar la página: sin esto la Vitrina mostraba el estado viejo y la
// PRÓXIMA marca pisaba lo restaurado (bug probado en la auditoría 13-oct-2026).
export function rehidratarCineEstado() {
  cineEstadoCache = loadCineEstado();
  cineEstadoListeners.forEach(fn => fn(cineEstadoCache));
}
// patch=null borra la entrada (vuelve a sin_marca)
export function setCineItemEstado(guid, patch) {
  const next = { ...cineEstadoCache };
  if (patch === null) delete next[guid];
  else next[guid] = { ...(next[guid] || {}), ...patch };
  saveCineEstado(next);
}
export function useCineEstadoMap() {
  const [map, setMap] = useState(cineEstadoCache);
  useEffect(() => {
    cineEstadoListeners.add(setMap);
    return () => cineEstadoListeners.delete(setMap);
  }, []);
  return map;
}

export function diasRestantesCartelera(item) {
  if (!item.firstSeenAt) return null;
  const RETENTION_MS = 30 * 86400000;
  const elapsed = Date.now() - new Date(item.firstSeenAt).getTime();
  return Math.max(0, Math.ceil((RETENTION_MS - elapsed) / 86400000));
}
export function esNuevo(item) {
  if (!item.firstSeenAt) return false;
  return Date.now() - new Date(item.firstSeenAt).getTime() <= CINE_NUEVO_MS;
}
// Ciclo de vida real de la película, independiente de cuándo Angst la
// descubrió (eso es "nuevo", basado en firstSeenAt). Estas tres van por
// pubDate (= release_date real de TMDb) y por el flag trending que arma
// build-cine.mjs -- no son excluyentes entre sí.
export function esEstreno(item) {
  // "Solo estrenos": todavía la puedo ver en cine -- se estrenó hace
  // menos de 15 días, ya estrenada (no futura). Una peli vieja que
  // resurge en trending no cuenta como estreno solo por eso -- esa es
  // la etiqueta "trending", separada.
  if (!item.pubDate) return false;
  const t = new Date(item.pubDate).getTime();
  if (Date.now() < t) return false;
  return Date.now() - t <= 15 * 86400000;
}
export function esEnProduccion(item) {
  if (!item.pubDate) return false;
  return new Date(item.pubDate).getTime() > Date.now();
}
export function diasParaEstreno(item) {
  if (!item.pubDate) return null;
  const dias = Math.ceil((new Date(item.pubDate).getTime() - Date.now()) / 86400000);
  return dias >= 0 ? dias : null;
}
export function esTrending(item) {
  return !!item.trending;
}

export function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const dias = Math.ceil((new Date(fechaISO).getTime() - Date.now()) / 86400000);
  return dias;
}
