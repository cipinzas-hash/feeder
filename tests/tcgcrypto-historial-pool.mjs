// Prueba de build-historial-pool.mjs con archivos diarios locales (mismo formato que los extraídos de tcgcsv). Correr: node tests/tcgcrypto-historial-pool.mjs
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expandirHistMes } from "../modules/pokecripto/lib/historial.mjs";
let n = 0; const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const arch = mkdtempSync(join(tmpdir(), "arch-")), salida = mkdtempSync(join(tmpdir(), "hist-"));
const dia = (fecha, cat, grupo, results) => { const d = join(arch, fecha, String(cat), String(grupo)); mkdirSync(d, { recursive: true }); writeFileSync(join(d, "prices"), JSON.stringify({ success: true, results })); };
const px = (productId, subTypeName, marketPrice) => ({ productId, subTypeName, marketPrice, lowPrice: marketPrice / 2, highPrice: marketPrice * 2 });
// categoría 3 (Pokémon) grupo 77: A vale 10/20 en agosto, 30 en septiembre, nada en octubre; B es bulk; C aparece recién en septiembre
dia("2026-08-05", 3, 77, [px(1, "Holofoil", 10), px(2, "Normal", 0.2)]); dia("2026-08-20", 3, 77, [px(1, "Holofoil", 20), px(2, "Normal", 0.3)]);
dia("2026-09-10", 3, 77, [px(1, "Holofoil", 30), px(3, "Normal", 5)]); dia("2026-09-11", 3, 77, [px(3, "Normal", 7)]);
dia("2026-08-07", 2, 55, [px(9, "1st Edition", 100)]);                       // Yu-Gi-Oh! (categoría 2)
dia("2026-11-03", 3, 77, [px(1, "Holofoil", 40)]);
const correr = hoy => spawnSync("node", ["modules/feed/scripts/build-historial-pool.mjs"], { env: { ...process.env, DATA_DIR: salida, ARCHIVO_LOCAL: arch, DESDE: "2026-08-01", HOY: hoy, MIN_USD: "0.5" }, encoding: "utf-8" });
const r1 = correr("2026-11-02");                                              // cerrados: agosto, septiembre, octubre
assert.equal(r1.status, 0, r1.stderr);
const leer = f => JSON.parse(readFileSync(join(salida, "tcgcrypto-hist", f), "utf-8"));
t("por producto y subtipo: [desfase, media, mín, máx] por mes; octubre sin dato no agrega nada al final", () => {
  const g = leer("3/77.json"); assert.equal(g.m, "2026-08");
  assert.deepEqual(g.t["1|Holofoil"], [0, 15, 10, 20, 30, 30, 30]);
  assert.deepEqual(g.t["3|Normal"], [1, 6, 5, 7]);                             // desfase 1: aparece en septiembre
  assert.ok(leer("2/55.json").t["9|1st Edition"]);
});
t("el bulk (nunca llegó a US$0,50) no se guarda y el informe dice cuánto habría pesado sin el filtro", () => {
  assert.ok(!leer("3/77.json").t["2|Normal"]);
  const e = leer("estado.json"); assert.equal(e.ultimoMes, "2026-10"); assert.equal(e.informe.productosConHistorial, 4); assert.equal(e.informe.productosGuardados, 3);
  assert.ok(e.informe.pesoSinFiltroMB >= e.informe.pesoConFiltroMB);
});
t("el formato se convierte directo al histMes de la fila (3 datos por mes) y se expande para el gráfico", () => {
  const e = leer("3/77.json").t["1|Holofoil"]; const [o, ...flat] = e;
  const hm = { m: "2026-08", t: Array.from({ length: flat.length / 3 }, (_, i) => flat.slice(i * 3, i * 3 + 3)) };
  const pts = expandirHistMes(hm); assert.deepEqual(pts.map(p => [p.date, p.market, p.low, p.high]), [["2026-08-01", 15, 10, 20], ["2026-09-01", 30, 30, 30]]);
});
t("corrida mensual: solo procesa los meses cerrados que faltan y los anexa con el hueco de octubre", () => {
  const r2 = correr("2026-12-02"); assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(leer("3/77.json").t["1|Holofoil"], [0, 15, 10, 20, 30, 30, 30, null, null, null, 40, 40, 40]);
  const e = leer("estado.json"); assert.equal(e.ultimoMes, "2026-11"); assert.equal(e.informe.dias, 30);          // solo noviembre
  assert.equal(correr("2026-12-02").stdout.includes("Nada que hacer"), true);                                      // sin meses nuevos no hace nada
});
console.log(`${n} pruebas en verde`);
