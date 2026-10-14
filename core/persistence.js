// Persistencia de Angst.
//
// ESTADO REAL (13-oct-2026, auditoría de datos): el motor genérico por
// manifests (buildDefaultState / buildExportPayload(fullState, manifests) /
// restoreFromPayload(payload, manifests) más abajo) NO es el que corre hoy.
// Los campos del planner siguen guardándose/exportando/restaurando desde
// core/App.jsx (saveToStorage, buildExportPayload, restoreFromPayload). Lo que
// SÍ se usa de este archivo: downloadBackupJSON y, desde la auditoría, la
// sección "Contrato del payload de export" del final (listas de campos,
// claves de localStorage de Feed/Vitrina/Pokécripto y validarPayloadExport),
// que tests/export-coverage.mjs verifica contra el código.
//
// Historia: reemplazaba la "regla vital de los 22 campos"
// (angst-context-4.md §2.3). Cada módulo declara sus campos en su manifest.js.

const STORAGE_KEY = "angst-v12";

export function buildDefaultState(manifests) {
  const state = {};
  for (const m of manifests) {
    for (const [key, spec] of Object.entries(m.state || {})) {
      state[key] = structuredClone(spec.default);
    }
  }
  return state;
}

export function requiredExportFields(manifests) {
  return manifests.flatMap((m) => Object.keys(m.state || {}));
}

export function buildExportPayload(fullState, manifests) {
  const payload = {};
  for (const key of requiredExportFields(manifests)) {
    payload[key] = fullState[key];
  }
  return payload;
}

// Antes de exportar: aborta con mensaje claro en vez de generar un backup
// incompleto (mismo comportamiento que el handleExport actual).
export function validateExportPayload(payload, manifests) {
  const missing = requiredExportFields(manifests).filter((k) => !(k in payload));
  return missing.length ? { ok: false, missing } : { ok: true };
}

export function restoreFromPayload(payload, manifests) {
  const restored = {};
  for (const key of requiredExportFields(manifests)) {
    if (key in payload) restored[key] = payload[key];
  }
  return restored;
}

export async function localGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function localSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// Secrets (API keys, etc.) — fuera del payload de backup por diseño, en su
// propia clave de localStorage. Nunca viajan en un .json exportado.
export function getSecret(manifest, secretKey) {
  const spec = manifest.secrets?.[secretKey];
  if (!spec) return null;
  return localStorage.getItem(spec.storageKey);
}

export function setSecret(manifest, secretKey, value) {
  const spec = manifest.secrets?.[secretKey];
  if (!spec) return false;
  localStorage.setItem(spec.storageKey, value);
  return true;
}

// Devuelve true/false: handleExport (App.jsx) lo usa para mostrar "descargado ✓"
// o "error al exportar". Antes devolvía undefined y el usuario no veía ningún aviso.
export function downloadBackupJSON(payload) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angst-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    return false;
  }
}


// ─── Contrato del payload de export ─────────────────────────────────────────
// Fuente única de QUÉ viaja en 💾 (.json), 📤/📥 (Angst-data) y qué se
// restaura. App.jsx arma el payload con estas listas; tests/export-coverage.mjs
// falla si el código usa una clave "angst-*" que no está acá (ni en
// EXPORT_EXEMPT_KEYS con su motivo).

// Campos del planner: viven en React state/refs de AngstApp y en "angst-v12".
// Tipo esperado en el export: "object" | "array" | "number" | "nullable"
// (nullable = null es un valor legítimo, p. ej. antes del primer rollover).
export const CORE_EXPORT_FIELDS = {
  dayData: "object", weekOffset: "number", budgets: "object", nutria: "object",
  calMarks: "object", cookingOpts: "array", aseoOpts: "array", routines: "array",
  recurring: "array", lastRollover: "nullable", kidsHealth: "object", custody: "object",
  fadimanData: "object", nutriLog: "object", ejercicioLog: "object", ejercicioDecks: "array",
  customFoods: "object", foodOverrides: "object", customEjercicios: "object", nutriDecks: "array",
  pokeInventario: "array", pokeCarpetas: "array", pokeDarkCatalogo: "array", pokePriceCache: "object",
};

// Campos que NO pasan por React state de AngstApp: cada uno vive en su propia
// clave de localStorage (Feed, Vitrina, Pokécripto). campo-del-payload -> clave.
// Pueden ser null si el usuario nunca usó ese módulo.
export const LOCAL_KEY_FIELDS = {
  feedState: "angst-feed-proto-v1",                       // cola/vistos/buzón/último refresh de Feed
  feedMicrodocsVistos: "angst-feed-microdocs-vistos-v1",
  feedPodcastsEscuchados: "angst-feed-podcasts-escuchados-v1",
  feedConciertosVistos: "angst-feed-conciertos-vistos-v1",
  feedCineEstado: "angst-cine-estado-v1",                 // interesa/descartada/vista + rating + nota + progreso T/E
  feedPodcastDispatched: "angst-podcast-dispatched-v1",
  feedMeleeVodVistos: "angst-feed-melee-vod-vistos-v1",
  feedPodcastPositions: "angst-podcast-positions-v1",     // {guid: segundos} — retomar un podcast (auditoría 13-oct)
  feedSeriesOverlay: "angst-series-overlay-v1",           // marcas de episodios aún no reflejadas por Simkl (TTL 48 h)
  pokeAgotadas: "angst-pokecripto-agotadas-v1",           // cartas agotadas en la revisión (cooldown 7 días)
};

// Claves "angst-*" que a propósito NO viajan en el export, con el motivo.
export const EXPORT_EXEMPT_KEYS = {
  "angst-v12": "es el blob del planner: su contenido viaja campo por campo (CORE_EXPORT_FIELDS)",
  "angst-simkl-auth-v1": "secreto (AUTH_SECRET del Worker): nunca viaja en un .json",
  "angst-tcg-price-key": "secreto (API key de precios): nunca viaja en un .json",
  "angst-last-local-edit-v1": "metadato del guard de sync; viaja como exportedAt",
  "angst-podcast-player-pos-v1": "posición del cuadrado flotante: preferencia de pantalla, por dispositivo",
  "angst-simkl-pending-v1": "cola hacia Simkl: se vacía sola hacia Angst-data (simkl-state.json); restaurarla reenviaría acciones viejas y podría revertir marcas nuevas",
  "angst-usdclp-v1": "caché diaria del dólar: se recalcula sola",
  "angst-pokecripto-tcgcalls-v1": "contador diario de consultas a la API de precios: por día y por dispositivo",
  "angst-pokecripto-migrated-v1": "flag de migración por dispositivo",
  "angst-nutri-decks-v1": "legado: ya migrado a nutriDecks (CORE_EXPORT_FIELDS)",
};

const TIPOS_OK = {
  object: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  number: (v) => typeof v === "number" && Number.isFinite(v),
};

// Valida un payload de export ANTES de bajarlo/subirlo. Devuelve la lista de
// problemas (vacía = ok). A diferencia del chequeo viejo (=== undefined, que
// nunca podía fallar porque clone() convierte undefined en null), acá un campo
// del planner en null/undefined o de tipo equivocado SÍ aborta el export.
export function validarPayloadExport(payload) {
  const problemas = [];
  if (!payload || typeof payload !== "object") return ["payload vacío"];
  for (const [campo, tipo] of Object.entries(CORE_EXPORT_FIELDS)) {
    const v = payload[campo];
    if (tipo === "nullable") { if (v === undefined) problemas.push(`${campo}: falta`); continue; }
    if (v === undefined || v === null) { problemas.push(`${campo}: falta`); continue; }
    if (!TIPOS_OK[tipo](v)) problemas.push(`${campo}: se esperaba ${tipo}`);
  }
  for (const campo of Object.keys(LOCAL_KEY_FIELDS)) {
    if (!(campo in payload)) problemas.push(`${campo}: falta`); // null sí vale (módulo sin uso)
  }
  return problemas;
}

// Lee los campos de LOCAL_KEY_FIELDS desde un storage (por defecto localStorage).
export function leerCamposLocales(storage = globalThis.localStorage) {
  const out = {};
  for (const [campo, clave] of Object.entries(LOCAL_KEY_FIELDS)) {
    try { const v = storage.getItem(clave); out[campo] = v ? JSON.parse(v) : null; } catch (e) { out[campo] = null; }
  }
  return out;
}

// Escribe en localStorage los campos locales que el payload traiga (null/undefined = no tocar).
// Devuelve la lista de campos escritos.
export function escribirCamposLocales(payload, storage = globalThis.localStorage) {
  const escritos = [];
  for (const [campo, clave] of Object.entries(LOCAL_KEY_FIELDS)) {
    if (payload?.[campo] == null) continue;
    try { storage.setItem(clave, JSON.stringify(payload[campo])); escritos.push(campo); } catch (e) {}
  }
  return escritos;
}
