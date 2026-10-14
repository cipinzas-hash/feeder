// Auditoría de datos (13-oct-2026): el export a 💾 / Angst-data no puede volver
// a perder un campo en silencio. Este test lee el código real y falla si:
//   1. Una clave "angst-*" de localStorage usada en core/ o modules/ no viaja en
//      el export (LOCAL_KEY_FIELDS) ni está en EXPORT_EXEMPT_KEYS con su motivo.
//   2. Un campo del planner (CORE_EXPORT_FIELDS) falta en saveToStorage,
//      buildExportPayload o restoreFromPayload de core/App.jsx.
//   3. restoreFromPayload no rehidrata las cachés vivas de Vitrina.
//   4. El validador deja pasar un payload roto (o bloquea uno sano).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  CORE_EXPORT_FIELDS, LOCAL_KEY_FIELDS, EXPORT_EXEMPT_KEYS, validarPayloadExport,
} from "../core/persistence.js";

const raiz = new URL("..", import.meta.url).pathname;
const fallos = [];
const falla = (m) => fallos.push(m);

// ── 1. Todas las claves "angst-*" del código ────────────────────────────────
function archivos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === "scripts" || n === "node_modules" || n === "data" || n === "lib") continue; // scripts/ = pipeline de Actions, no corre en el navegador
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.(js|jsx)$/.test(n)) out.push(p);
  }
  return out;
}
const usadas = new Map(); // clave -> archivo
for (const dir of ["core", "modules"]) {
  for (const f of archivos(join(raiz, dir))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/["'`](angst-[a-z0-9][a-z0-9-]*)["'`]/g)) {
      if (!usadas.has(m[1])) usadas.set(m[1], f.replace(raiz, ""));
    }
  }
}
const exportadas = new Set(Object.values(LOCAL_KEY_FIELDS));
for (const [clave, archivo] of usadas) {
  if (exportadas.has(clave) || clave in EXPORT_EXEMPT_KEYS) continue;
  falla(`clave "${clave}" (${archivo}) no viaja en el export ni está en EXPORT_EXEMPT_KEYS — ¿es un dato del usuario? Sumala a LOCAL_KEY_FIELDS en core/persistence.js (o a EXPORT_EXEMPT_KEYS con el motivo).`);
}
for (const clave of [...exportadas, ...Object.keys(EXPORT_EXEMPT_KEYS)]) {
  if (!usadas.has(clave)) console.warn(`aviso: "${clave}" figura en persistence.js pero ya no aparece en el código`);
}

// ── 2. Los 4 lugares de App.jsx para cada campo del planner ─────────────────
const app = readFileSync(join(raiz, "core/App.jsx"), "utf8");
const tramo = (desde, hasta) => {
  const i = app.indexOf(desde), j = app.indexOf(hasta, i + 1);
  assert(i >= 0 && j > i, `no encontré el tramo ${desde} … ${hasta} en App.jsx`);
  return app.slice(i, j);
};
const guardado = tramo("async function saveToStorage", "// Update a single day");
const exportador = tramo("function buildExportPayload", "// Qué campos deben viajar");
const restaurador = tramo("function restoreFromPayload", "function handleLoad");
for (const campo of Object.keys(CORE_EXPORT_FIELDS)) {
  if (!new RegExp(`\\b${campo}\\s*:`).test(guardado)) falla(`${campo}: falta en saveToStorage`);
  if (!new RegExp(`\\b${campo}\\s*:`).test(exportador)) falla(`${campo}: falta en buildExportPayload`);
  if (!new RegExp(`\\bd\\.${campo}\\b`).test(restaurador)) falla(`${campo}: falta en restoreFromPayload`);
}
if (!/\.\.\.leerCamposLocales\(\)/.test(exportador)) falla("buildExportPayload no incluye leerCamposLocales()");
if (!/escribirCamposLocales\(d\)/.test(restaurador)) falla("restoreFromPayload no llama a escribirCamposLocales(d)");

// ── 3. Rehidratación de cachés vivas tras restaurar ─────────────────────────
for (const [fn, motivo] of [
  ["rehidratarCineEstado()", "caché de módulo de Vitrina (estado.js)"],
  ["rehidratarOverlay()", "overlay de episodios (episodios.js)"],
  ["setPodcastDispatched(d.feedPodcastDispatched)", "state de podcasts despachados en App"],
]) if (!restaurador.includes(fn)) falla(`restoreFromPayload no rehidrata ${motivo}`);
if (!/validarPayloadExport\(payload\)/.test(tramo("async function pushStateToRepo", "async function leerDeRepo"))) falla("pushStateToRepo no valida el payload antes de subir");
if (!/validarPayloadExport\(fullPayload\)/.test(tramo("function handleExport", "function handleLoad"))) falla("handleExport no valida el payload");

// ── 4. El validador ─────────────────────────────────────────────────────────
const muestra = { schemaVersion: 1, exportedAt: "x" };
for (const [c, t] of Object.entries(CORE_EXPORT_FIELDS))
  muestra[c] = t === "array" ? [] : t === "number" ? 0 : t === "nullable" ? null : {};
for (const c of Object.keys(LOCAL_KEY_FIELDS)) muestra[c] = null; // módulo sin uso: null vale
assert.deepEqual(validarPayloadExport(muestra), [], "un payload sano no debe bloquearse");
assert(validarPayloadExport({}).length >= Object.keys(CORE_EXPORT_FIELDS).length - 1, "payload vacío debe fallar");
assert(validarPayloadExport({ ...muestra, dayData: null }).some(p => p.startsWith("dayData")), "campo core en null debe fallar (el chequeo viejo === undefined nunca lo veía)");
assert(validarPayloadExport({ ...muestra, routines: {} }).some(p => p.startsWith("routines")), "tipo equivocado debe fallar");
assert.deepEqual(validarPayloadExport({ ...muestra, lastRollover: null }), [], "lastRollover null es legítimo");
const sinCampoLocal = { ...muestra }; delete sinCampoLocal.feedPodcastPositions;
assert(validarPayloadExport(sinCampoLocal).some(p => p.startsWith("feedPodcastPositions")), "falta un campo local: debe fallar");

if (fallos.length) {
  console.error("✗ export-coverage:\n  - " + fallos.join("\n  - "));
  process.exit(1);
}
console.log(`OK export-coverage: ${usadas.size} claves angst-* revisadas, ${Object.keys(CORE_EXPORT_FIELDS).length} campos del planner x 3 lugares, ${Object.keys(LOCAL_KEY_FIELDS).length} claves locales exportadas`);
