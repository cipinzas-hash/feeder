import assert from "node:assert/strict";
import { nivelRegistro, colorRegistro, barrasRegistro } from "../core/registro.js";
import { weekOffsetFor } from "../core/dates.js";
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// SemanaDashboard.jsx es JSX: se compila a un módulo temporal para probar buildResumen sin React.
const out = join(tmpdir(), "registro-semana-dashboard.mjs");
await build({ entryPoints: [fileURLToPath(new URL("../core/SemanaDashboard.jsx", import.meta.url))], bundle: true, format: "esm",
  outfile: out, loader: { ".jsx": "jsx" }, logLevel: "silent" });
const { buildResumen } = await import(pathToFileURL(out).href);

// ── nivel de registro del día (lo que mostraba la pilita) ──
assert.deepEqual(nivelRegistro(undefined), {filled:0,total:9,pct:0}, "día sin datos: 9 campos, nada lleno");
assert.equal(nivelRegistro({}, {esTrabajo:true}).total, 10, "día de trabajo suma workLevel");
const lleno = {menu:"x",aseoMode:"a",cookingMode:"c",summary:"s",energy:3,concentration:4,mood:"ok",sleep:7};
assert.deepEqual(nivelRegistro(lleno, {tieneNutri:true}), {filled:9,total:9,pct:100});
assert.equal(nivelRegistro(lleno).pct, 89, "sin nutrición: 8 de 9");
assert.equal(nivelRegistro({...lleno,mood:undefined,intensity:2}, {tieneNutri:true}).pct, 100, "intensity cuenta como mood");
assert.equal(nivelRegistro({menu:"",summary:null,energy:0}).filled, 1, "0 cuenta como lleno; '' y null no");
assert.equal(nivelRegistro({workLevel:2}, {esTrabajo:false}).filled, 0, "workLevel solo cuenta en días de trabajo");

// ── color y barras ──
assert.equal(colorRegistro(0), "#e53935"); assert.equal(colorRegistro(30), "#e53935");
assert.equal(colorRegistro(31), "#ff9800"); assert.equal(colorRegistro(60), "#ff9800");
assert.equal(colorRegistro(61), "#ffcc00"); assert.equal(colorRegistro(90), "#ffcc00");
assert.equal(colorRegistro(91), "#4caf50"); assert.equal(colorRegistro(100), "#4caf50");
assert.deepEqual([0,1,20,21,40,41,60,61,80,81,100].map(barrasRegistro), [0,1,1,2,2,3,3,4,4,5,5]);

// ── semana a la que pertenece una fecha (base: 21-feb-2026) ──
assert.equal(weekOffsetFor("2026-02-21"), 0);
assert.equal(weekOffsetFor("2026-02-27"), 0);
assert.equal(weekOffsetFor("2026-02-28"), 1);
assert.equal(weekOffsetFor("2026-02-20"), -1);
assert.equal(weekOffsetFor("2026-10-28"), 35, "miércoles 28-oct");
assert.equal(weekOffsetFor("2026-10-30"), 35);
assert.equal(weekOffsetFor("2026-10-31"), 36, "sábado: empieza la semana siguiente");
assert.equal(weekOffsetFor("2026-11-01"), 36);
// cruzando los cambios de hora de Chile no se corre ningún día
for (const [k, w] of [["2026-04-04",6],["2026-04-10",6],["2026-04-11",7],["2026-09-05",28],["2026-09-12",29]]) assert.equal(weekOffsetFor(k), w, k);

// ── dashboard: la baliza lleva su fecha (para abrir el día) y el estrés sigue ahí ──
const dd = {
  "2026-10-28":{tasks:[]},
  "2026-11-10":{tasks:[{id:"b",text:"entrega",urgent:true,deadline:{h:16,m:0}}]},
};
const keys = ["2026-10-24","2026-10-25","2026-10-26","2026-10-27","2026-10-28","2026-10-29","2026-10-30"];
const r = buildResumen({todayKey:"2026-10-28", ahoraMin:600, weekKeys:keys, dayData:dd, calMarks:{}, eventos:[], stressFor:k=>k==="2026-10-29"?7:0, conNinosEn:()=>false, ejercicioHoy:null, kcalHoy:null});
if (r.proxima) { assert.equal(r.proxima.dateKey, "2026-11-10"); assert.equal(r.proxima.dias, 13); }
assert.equal(r.semana.length, 7);
assert.equal(r.semana[5].score, 7, "el anillo del dashboard sigue mostrando estrés");
assert.ok(r.semana.every(c => typeof c.k === "string"), "cada día de la tira trae su fecha");

console.log("registro-semana: ok");
