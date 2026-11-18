// Pruebas de lib/juegos.mjs (multi-juego, 17-nov-2026). Correr: node tests/pokecripto-juegos.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { juegoDe, esPokemon, idFila, filaTiene, marcaDeFila, marcasDeFilas, aplicarMarca, actualizarPreciosFilas, precioDeCarta, precioDeFila, cartaDe, JUEGOS } from "../modules/pokecripto/lib/juegos.mjs";
import { resumenColeccion, filtrarCartas } from "../modules/tcgcrypto/logica.js";

const ygo = JSON.parse(readFileSync(new URL("../modules/feed/data/tcgcrypto-yugioh.json", import.meta.url), "utf-8"));
const dgm = JSON.parse(readFileSync(new URL("../modules/feed/data/tcgcrypto-digimon.json", import.meta.url), "utf-8"));
const dark = ygo.colecciones.find(c => c.id === "dark");
const numemon = dgm.colecciones[0];
const hoy = "2026-11-17", ayer = "2026-11-16";
let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
// una carta de Yu-Gi-Oh! con ≥2 versiones con precio distinto
const carta = ygo.cartas.find(c => c.c.includes("dark") && c.v.filter(v => v[5] != null).length >= 2 && new Set(c.v.map(v => v[5])).size >= 2);

t("juego: sin campo es Pokémon; el registro tiene los tres juegos", () => {
  assert.equal(juegoDe({}), "pokemon"); assert.equal(juegoDe(null), "pokemon"); assert.equal(juegoDe({ juego: "yugioh" }), "yugioh");
  assert.ok(esPokemon({ id: "x" })); assert.ok(!esPokemon({ juego: "digimon" }));
  assert.deepEqual(JUEGOS.map(j => j.id), ["pokemon", "yugioh", "digimon"]);
});
t("marca: la tengo crea la fila (en_mano) con precio del catálogo, historial csv con tcgId y versión más barata sin elegir", () => {
  const inv = aplicarMarca([], { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { c: 1 }, hoy });
  assert.equal(inv.length, 1);
  const f = inv[0];
  assert.equal(f.id, idFila("yugioh", "dark", carta.k)); assert.equal(f.juego, "yugioh"); assert.equal(f.carpeta, "Dark"); assert.equal(f.estado, "en_mano");
  assert.equal(f.cardId, carta.k); assert.equal(f.name, carta.n); assert.ok(filaTiene(f));
  const min = Math.min(...carta.v.filter(v => v[5] != null || v[6] != null).map(v => (v[5] != null ? v[5] : v[6])));
  assert.equal(f.tcgMarket, min);
  assert.equal(f.priceHistory.length, 1); assert.equal(f.priceHistory[0].src, "csv"); assert.ok(f.priceHistory[0].tid); assert.equal(f.priceHistory[0].date, hoy);
  assert.ok(/^https:\/\//.test(f.image)); assert.equal(f.cantidad, 1); assert.equal(f.costoUSD, 0);
});
t("marca: elegir versión, cantidad, costo y notas se guardan en la misma fila; el precio sigue a la versión elegida", () => {
  let inv = aplicarMarca([], { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { c: 1 }, hoy: ayer });
  const caras = carta.v.filter(v => v[5] != null).sort((a, b) => b[5] - a[5]);
  const cara = caras[0];
  inv = aplicarMarca(inv, { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { e: `${cara[0]}|${cara[1]}`, q: 3, cu: 2.5, nt: "firmada" }, hoy });
  assert.equal(inv.length, 1); const f = inv[0];
  assert.equal(f.tcgcsvKey, `${cara[0]}|${cara[1]}`); assert.equal(f.tcgMarket, cara[5]); assert.equal(f.cantidad, 3); assert.equal(f.costoUSD, 2.5); assert.equal(f.notas, "firmada");
  assert.equal(f.priceHistory.length, 2); assert.equal(f.priceHistory.at(-1).tid, String(cara[0])); assert.equal(f.priceHistory.at(-1).var, cara[1]);
  assert.equal(f.estado, "en_mano"); assert.equal(f.fechaCompra, ayer);
});
t("marca: 'la busco' (solo versión elegida) es una fila hunting; sacar todo borra la fila (no deja basura)", () => {
  const v = carta.v.find(x => x[5] != null);
  let inv = aplicarMarca([], { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { e: `${v[0]}|${v[1]}` }, hoy });
  assert.equal(inv.length, 1); assert.equal(inv[0].estado, "hunting"); assert.ok(!filaTiene(inv[0]));
  inv = aplicarMarca(inv, { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { e: null }, hoy });
  assert.equal(inv.length, 0);
  const x = aplicarMarca([], { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { c: 1 }, hoy });
  assert.equal(aplicarMarca(x, { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { c: 0 }, hoy }).length, 0);
});
t("marca: colección individual (la misma carta en dos colecciones son dos filas) y las filas de Pokémon no se tocan", () => {
  const zombie = ygo.colecciones.find(c => c.id === "zombie");
  const poke = { id: "p1", cardId: "sv1-1", name: "Pikachu", estado: "en_mano" };
  let inv = aplicarMarca([poke], { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { c: 1 }, hoy });
  inv = aplicarMarca(inv, { juego: "yugioh", datos: ygo, col: zombie, k: carta.k, parche: { c: 1 }, hoy });
  assert.equal(inv.length, 3); assert.equal(inv[0], poke);
  assert.deepEqual(inv.filter(f => f.juego === "yugioh").map(f => f.carpeta).sort(), ["Dark", "Zombie"]);
  assert.equal(aplicarMarca(inv, { juego: "yugioh", datos: ygo, col: dark, k: "no-existe", parche: { c: 1 }, hoy }), inv);
});
t("marcasDeFilas + resumenColeccion: el avance se calcula con la lógica probada de tcgcrypto sobre las filas", () => {
  const cs = ygo.cartas.filter(c => c.c.includes("dark")).slice(0, 5);
  let inv = [];
  for (const c of cs.slice(0, 2)) inv = aplicarMarca(inv, { juego: "yugioh", datos: ygo, col: dark, k: c.k, parche: { c: 1, q: 2 }, hoy });
  inv = aplicarMarca(inv, { juego: "yugioh", datos: ygo, col: dark, k: cs[2].k, parche: { c: 1 }, hoy });
  const marcas = marcasDeFilas(inv, "yugioh", "Dark");
  assert.equal(Object.keys(marcas).length, 3);
  const r = resumenColeccion(cs, marcas);
  assert.equal(r.total, 5); assert.equal(r.conseguidas, 3);
  assert.equal(filtrarCartas(cs, marcas, { modo: "tengo" }, ygo.sets).length, 3);
  assert.equal(filtrarCartas(cs, marcas, { modo: "faltan" }, ygo.sets).length, 2);
  assert.deepEqual(marcasDeFilas(inv, "digimon", "Dark"), {});
});
t("Digimon: una fila por arte (producto), con su propia imagen y precio", () => {
  const c = dgm.cartas[0];
  const inv = aplicarMarca([], { juego: "digimon", datos: dgm, col: numemon, k: c.k, parche: { c: 1 }, hoy });
  assert.equal(inv[0].juego, "digimon"); assert.equal(inv[0].id, idFila("digimon", "numemon", c.k)); assert.equal(inv[0].carpeta, numemon.nombre);
  assert.ok(inv[0].image.includes(String(c.v[0][0])));
});
t("actualizarPreciosFilas: reprecia solo filas de otros juegos desde el catálogo, agrega snapshot del día y no toca Pokémon ni vendidas", () => {
  let inv = aplicarMarca([], { juego: "yugioh", datos: ygo, col: dark, k: carta.k, parche: { c: 1 }, hoy: ayer });
  const viejo = { ...inv[0], tcgMarket: 0.01, tcgUpdated: ayer };
  const poke = { id: "p1", cardId: "x", estado: "en_mano", tcgMarket: 5 };
  const vendida = { ...viejo, id: "v", estado: "vendida" };
  const r = actualizarPreciosFilas([poke, viejo, vendida], { yugioh: ygo }, hoy);
  assert.equal(r.cambiadas, 1); assert.equal(r.filas[0], poke); assert.equal(r.filas[2], vendida);
  assert.notEqual(r.filas[1].tcgMarket, 0.01); assert.equal(r.filas[1].tcgUpdated, hoy); assert.equal(r.filas[1].priceHistory.at(-1).date, hoy);
  const otra = actualizarPreciosFilas(r.filas, { yugioh: ygo }, hoy);
  assert.equal(otra.cambiadas, 0); assert.equal(otra.filas, r.filas);                        // idempotente: mismo arreglo
  assert.equal(actualizarPreciosFilas([viejo], {}, hoy).cambiadas, 0);                        // sin catálogo: no inventa precios
});
t("precioDeCarta: sin precio en ninguna versión devuelve null; con versión elegida sin precio no cae a otra", () => {
  assert.equal(precioDeCarta({ k: "a", n: "A", v: [[1, "N", 0, "1", "C", null, null, null]] }, null), null);
  assert.equal(precioDeCarta(null, null), null);
  const c = { k: "a", n: "A", v: [[1, "1st", 0, "1", "C", 5, 4, 6], [2, "Unl", 0, "1", "C", null, null, null]] };
  assert.equal(precioDeCarta(c, { e: "2|Unl" }), null);
  assert.equal(precioDeCarta(c, { e: "1|1st" }).market, 5);
  assert.equal(precioDeCarta(c, null).tid, "1");
});
console.log(`\n${n} pruebas en verde`);
