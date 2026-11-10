// Issue #41: el script del bot de snapshots mensuales, corrido de verdad contra archivos temporales.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../modules/feed/scripts/build-pokecripto-colecciones.mjs", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "colecciones-"));
const inv = join(dir, "inventario.json"), out = join(dir, "historial.json");
const correr = () => spawnSync("node", [script], { env: { ...process.env, POKECRIPTO_INVENTARIO_PATH: inv, POKECRIPTO_COLECCIONES_PATH: out }, encoding: "utf8" });
const fila = (carpeta, estado, tcgMarket) => ({ id: Math.random().toString(36), cardId: "c" + Math.random(), carpeta, estado, tcgMarket });
const mesHoy = new Date().toISOString().slice(0, 7);

// 1. primera corrida: crea el historial con el mes en curso
const base = [fila("Mega", "sin_publicar", 3), fila("Mega", "hunting", 7), fila("Tera", "hunting", 2), fila("Price Watch", "hunting", 50)];
writeFileSync(inv, JSON.stringify(base));
let r = correr(); assert.equal(r.status, 0, r.stderr);
let h = JSON.parse(readFileSync(out, "utf8"));
assert.equal(h.length, 1); assert.equal(h[0].mes, mesHoy);
assert.deepEqual(h[0].colecciones.Mega, { v: 10, vc: 3, n: 2, c: 1, p: 2 });
assert.deepEqual(h[0].colecciones["*"], { v: 12, vc: 3, n: 3, c: 1, p: 3 });
assert.equal(h[0].colecciones["Price Watch"], undefined, "Price Watch no es colección");
assert.equal(h[0].colecciones.tayu, undefined, "colección sin cartas no se registra");

// 2. misma data: no reescribe
const antes = readFileSync(out, "utf8"); r = correr(); assert.equal(r.status, 0); assert.match(r.stdout, /sin cambios/); assert.equal(readFileSync(out, "utf8"), antes);

// 3. cambia un precio dentro del mes: se actualiza la entrada del mes (no se agrega otra)
base[1].tcgMarket = 9; writeFileSync(inv, JSON.stringify(base)); r = correr(); assert.equal(r.status, 0);
h = JSON.parse(readFileSync(out, "utf8")); assert.equal(h.length, 1); assert.equal(h[0].colecciones.Mega.v, 12);

// 4. los meses anteriores no se tocan
const viejo = { mes: "2026-01", fecha: "2026-01-31", colecciones: { Mega: { v: 1, vc: 0, n: 2, c: 0, p: 2 } } };
writeFileSync(out, JSON.stringify([viejo, ...h])); r = correr(); assert.equal(r.status, 0);
h = JSON.parse(readFileSync(out, "utf8")); assert.equal(h.length, 2); assert.deepEqual(h[0], viejo);

// 5. guardas: historial corrupto, inventario vacío/ilegible, inventario a menos de la mitad -> exit 1 y no se toca nada
const intacto = readFileSync(out, "utf8");
writeFileSync(out, "{no es json"); r = correr(); assert.equal(r.status, 1); assert.equal(readFileSync(out, "utf8"), "{no es json", "historial ilegible: no se pisa");
writeFileSync(out, intacto);
writeFileSync(inv, "[]"); r = correr(); assert.equal(r.status, 1); assert.equal(readFileSync(out, "utf8"), intacto);
writeFileSync(inv, "no json"); r = correr(); assert.equal(r.status, 1); assert.equal(readFileSync(out, "utf8"), intacto);
writeFileSync(inv, JSON.stringify([fila("Mega", "hunting", 1)])); r = correr(); assert.equal(r.status, 1, r.stdout); assert.match(r.stderr, /se descarta/); assert.equal(readFileSync(out, "utf8"), intacto);
assert.equal(spawnSync("node", [script], { env: { ...process.env, POKECRIPTO_INVENTARIO_PATH: "", POKECRIPTO_COLECCIONES_PATH: "" }, encoding: "utf8" }).status, 1, "sin rutas");
assert.equal(existsSync(out), true);
console.log("pokecripto-colecciones-bot: OK");
