// Pruebas de lib/historial-pool.mjs: del archivo del grupo a fila.histMes, producto de una carta de Pokémon (con 1 o varias variantes), completado por el bot y aviso de espera.
// Correr: node tests/pokecripto-historial-pool.mjs
import assert from "node:assert/strict";
import { histMesDeShard, productoBasePoke, histMesDeFila, completarHistorial, diasParaHistorial, avisoHistorial } from "../modules/pokecripto/lib/historial-pool.mjs";
import { expandirHistMes } from "../modules/pokecripto/lib/historial.mjs";
import { juegoDe } from "../modules/pokecripto/lib/juegos.mjs";
let n = 0; const t = async (nombre, fn) => { await fn(); n++; console.log("✓", nombre); };
const indice = { grupos: [{ id: 77, nombre: "Scarlet & Violet 151", abrev: "MEW" }] };
const varShard = { g: 77, cartas: { "4|charizard": [[500, "Reverse Holofoil", "", 5, 3, 9, 0, "Rare"], [501, "Holofoil", "", 40, 30, 50, 0, "Rare"], [502, "Holofoil", "Poke Ball", 12, 9, 15, 0, "Rare"]] }, u: { "1|pidgey": [600, "Normal", "Common"] } };
const hist = { m: "2024-02", t: { "501|Holofoil": [3, 30, 25, 35, 32, 30, 40], "600|Normal": [0, 1, 0.5, 2] } };
const archivos = { "pokemon-variantes/index.json": indice, "pokemon-variantes/77.json": varShard, "tcgcrypto-hist/3/77.json": hist, "tcgcrypto-hist/estado.json": { ultimoMes: "2026-10" } };
const cargar = async r => archivos[r] || null;
const fila = (o) => ({ id: "1", name: "Charizard", set: "Scarlet & Violet 151", number: "4", estado: "en_mano", ...o });

await t("histMesDeShard: el desfase ubica el primer mes y los tríos quedan como [media, mín, máx]", () => {
  assert.deepEqual(histMesDeShard(hist, "501|Holofoil"), { m: "2024-05", t: [[30, 25, 35], [32, 30, 40]] });
  assert.equal(histMesDeShard(hist, "999|Normal"), null);
});
await t("producto de una carta de Pokémon: la base Holofoil sobre Reverse y patrón; una carta de UNA variante sale de `u`", () => {
  assert.deepEqual(productoBasePoke(varShard, indice, "4", "Charizard"), { pid: 501, sub: "Holofoil", grupoId: 77 });
  assert.deepEqual(productoBasePoke(varShard, indice, "1", "Pidgey"), { pid: 600, sub: "Normal", grupoId: 77 });
  assert.equal(productoBasePoke(varShard, indice, "9", "Nadie"), null);
});
await t("fila de Pokémon sin variante marcada: su histMes sale del producto base de su set", async () => {
  const r = await histMesDeFila(fila({}), cargar, "pokemon"); assert.deepEqual(r.histMes, { m: "2024-05", t: [[30, 25, 35], [32, 30, 40]] }); assert.equal(r.pid, 501);
});
await t("fila con variante marcada (tcgcsvKey + grupo): usa SU producto, no el base", async () => {
  const r = await histMesDeFila(fila({ tcgcsvKey: "600|Normal", tcgcsvGrupo: 77 }), cargar, "pokemon"); assert.equal(r.pid, 600);
});
await t("el archivo manda en los meses que tiene y el historial propio rellena los que faltan", async () => {
  const r = await histMesDeFila(fila({ histMes: { m: "2024-03", t: [[9, 9, 9], [8, 8, 8], [7, 7, 7], [6, 6, 6]] } }), cargar, "pokemon");
  const pts = expandirHistMes(r.histMes); assert.deepEqual(pts.map(p => [p.date.slice(0, 7), p.market]), [["2024-03", 9], ["2024-04", 8], ["2024-05", 30], ["2024-06", 32]]);
});
await t("bot: completa las filas sin histMes, marca histPend si aún no hay datos y rinde cuentas a los 8 días (histSin)", async () => {
  const filas = [fila({ id: "a" }), fila({ id: "b", name: "Desconocida", number: "99" }), fila({ id: "v", estado: "vendida" })];
  const r1 = await completarHistorial(filas, cargar, "2026-11-24", juegoDe);
  assert.ok(r1[0].histMes && r1[0].histHasta === "2026-10" && !r1[0].histPend);
  assert.equal(r1[1].histPend, "2026-11-24"); assert.ok(!r1[1].histMes); assert.equal(r1[2], filas[2]);
  assert.equal(await completarHistorial(r1, cargar, "2026-11-24", juegoDe), r1);                               // mismo día: no reintenta
  const r2 = await completarHistorial(r1, cargar, "2026-12-03", juegoDe); assert.equal(r2[1].histSin, true); assert.ok(!r2[1].histPend);
  assert.equal(await completarHistorial(r2, cargar, "2026-12-04", juegoDe), r2);                               // idempotente
});
await t("bot: cuando el historial avanza un mes, las filas completas se actualizan", async () => {
  const r1 = await completarHistorial([fila({ id: "a" })], cargar, "2026-11-24", juegoDe);
  archivos["tcgcrypto-hist/estado.json"] = { ultimoMes: "2026-11" }; archivos["tcgcrypto-hist/3/77.json"] = { ...hist, t: { ...hist.t, "501|Holofoil": [3, 30, 25, 35, 32, 30, 40, 44, 40, 50] } };
  const r2 = await completarHistorial(r1, cargar, "2026-12-03", juegoDe); assert.equal(r2[0].histHasta, "2026-11"); assert.equal(r2[0].histMes.t.length, 3);
});
await t("aviso de espera: cuenta los días hasta el domingo del catálogo + 1 del bot y baja con el tiempo", () => {
  assert.equal(diasParaHistorial("2026-11-24"), 6);                                  // martes → domingo en 5 días, +1
  assert.equal(avisoHistorial({ histPend: "2026-11-24" }, "2026-11-24"), "⏳ historial llega en ~6 días");
  assert.equal(avisoHistorial({ histPend: "2026-11-24" }, "2026-11-27"), "⏳ historial llega en ~3 días");
  assert.equal(avisoHistorial({ histPend: "2026-11-24", histMes: { m: "2024-01", t: [[1, 1, 1]] } }, "2026-11-24"), null);
  assert.equal(avisoHistorial({ histPend: "2026-11-24", histSin: true }, "2026-11-24"), null);
});
console.log(`${n} pruebas en verde`);
