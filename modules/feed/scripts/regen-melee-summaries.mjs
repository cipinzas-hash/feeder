// scripts/regen-melee-summaries.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Regeneración RETROACTIVA de los resúmenes narrativos de torneos de Melee ya
// archivados (esArchivo). Hasta oct-2026 la narración con Gemini nunca
// funcionó (modelo retirado), así que los archivos quedaron con el resumen
// mecánico. Este script re-narra solo el campo `summary` de cada archivo,
// usando como datos el propio resumen mecánico existente (standings + upsets
// con seeds); no toca clips, VODs ni nada más.
//
//  - El texto anterior se conserva en `summaryOriginal` (nunca se pierde).
//  - Un archivo ya narrado (`summaryIA: true`) se salta, salvo con --force.
//  - Si Gemini no responde, el archivo queda exactamente como estaba.
//
// Se corre desde update-melee.yml con regen_summaries=true (necesita
// GEMINI_API_KEY). Local: node scripts/regen-melee-summaries.mjs [--force] [--dry]
// ─────────────────────────────────────────────────────────────────────────────
import { readFile, writeFile } from "node:fs/promises";
import { narrateResult } from "./lib/melee-narration.mjs";
import { geminiStatus } from "./lib/gemini.mjs";

const OUTPUT_PATH = new URL("../data/melee.json", import.meta.url);
const force = process.argv.includes("--force");
const dry = process.argv.includes("--dry");

const data = JSON.parse(await readFile(OUTPUT_PATH, "utf-8"));
const cat = (data.categories || []).find(c => c.cat === "Melee");
if (!cat) { console.log("melee.json sin categoría Melee: nada que hacer."); process.exit(0); }

const archivos = cat.items.filter(i => i.esArchivo && String(i.guid || "").startsWith("melee-archivo-"));
const pendientes = archivos.filter(a => force || !a.summaryIA);
console.log(`Archivos permanentes: ${archivos.length} · a regenerar: ${pendientes.length}${force ? " (--force)" : ""}`);

let ok = 0, fallidos = 0;
for (const a of pendientes) {
  const base = a.summaryOriginal || a.summary;
  const nombre = a.source || a.title;
  console.log(`\n→ ${nombre}`);
  const datos = `Resumen mecánico ya calculado del resultado -- es tu ÚNICA fuente de datos de standings y upsets (los números entre corchetes son seeds de entrada; "|" separa equipo/sponsor de jugador y no debe aparecer en tu texto):\n${base}`;
  const texto = await narrateResult(nombre, datos);
  if (!texto || texto.length < 80 || texto.length > 2500) {
    fallidos++;
    console.log(`  ✗ sin narración utilizable (${texto ? `largo ${texto.length}` : geminiStatus.lastError || "sin respuesta"}) -- el archivo queda como estaba`);
    continue;
  }
  console.log(`  ✓ (${geminiStatus.lastModel}) ${texto.slice(0, 220)}${texto.length > 220 ? "…" : ""}`);
  if (!dry) {
    a.summaryOriginal = base;
    a.summary = texto;
    a.summaryIA = true;
    a.summaryIAModel = geminiStatus.lastModel;
    a.summaryIAAt = new Date().toISOString();
  }
  ok++;
}

if (ok > 0 && !dry) {
  await writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\n✓ melee.json actualizado: ${ok} resumen(es) regenerado(s), ${fallidos} sin cambios`);
} else {
  console.log(`\nSin cambios en melee.json (${ok} narrado(s), ${fallidos} fallido(s)${dry ? ", --dry" : ""})`);
}
if (pendientes.length > 0 && ok === 0) process.exit(1); // que el workflow lo marque en rojo
