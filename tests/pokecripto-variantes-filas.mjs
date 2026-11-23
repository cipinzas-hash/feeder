// Pruebas de lib/variantes-filas.mjs (Pokémon: variante como ejemplar propio, unificación 22-nov-2026) y del repreciado diario desde tcgcsv.
// Correr: node tests/pokecripto-variantes-filas.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { aplicarVariantePoke, hermanasDe, baseSinVariante, esFilaVariante, parcheVariante, precioDeResultados, actualizarPreciosPokeVariantes, gruposDeVariantes } from "../modules/pokecripto/lib/variantes-filas.mjs";
import { variantesDeShard } from "../modules/pokecripto/lib/variantes-pokemon.mjs";
import { fusionarPending, colaSinPrecio } from "../modules/pokecripto/lib/review.mjs";
import { filaTiene } from "../modules/pokecripto/lib/juegos.mjs";

const dir = new URL("../modules/feed/data/pokemon-variantes/", import.meta.url);
const indice = JSON.parse(readFileSync(new URL("index.json", dir), "utf-8"));
// una carta real con ≥3 variantes y precios
let shard, clave, vs;
for (const fch of readdirSync(dir)) {
  if (fch === "index.json") continue;
  const sh = JSON.parse(readFileSync(new URL(fch, dir), "utf-8"));
  for (const k of Object.keys(sh.cartas)) {
    const [num, nom] = k.split("|");
    const v = variantesDeShard(sh, indice, num, nom);
    if (v.length >= 3 && v.filter(x => x.market != null).length >= 3) { shard = sh; clave = k; vs = v; break; }
  }
  if (vs) break;
}
assert.ok(vs, "hay una carta de prueba con variantes");
const hoy = "2026-11-22", ayer = "2026-11-21";
let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const base = (estado = "hunting") => ({ id: "1700000000001", cardId: "sv3-125", name: "Carta", set: "Set", number: "125", carpeta: "MLP", estado, cantidad: 1, costoUSD: 0, priceHistory: [{ date: ayer, market: 1, low: 0.5, high: 2, src: "api" }], tcgMarket: 1, tcgId: "abc", condicion: "NM" });
const [v1, v2, v3] = vs;

t("variantes del catálogo traen sub y grupo de tcgcsv (el del producto: los sellos viven en otro grupo)", () => {
  for (const v of vs) { assert.ok(v.key.includes("|")); assert.equal(typeof v.sub, "string"); assert.ok(v.grupoId, "grupoId"); }
});
t("agregar sobre una fila hunting la PROMUEVE: misma fila, pasa a en_mano con la variante y su precio (sin fila de más)", () => {
  const b = base(); const inv = aplicarVariantePoke([b], { fila: b, v: v1, accion: "agregar", hoy });
  assert.equal(inv.length, 1); const f = inv[0];
  assert.equal(f.id, b.id); assert.equal(f.cardId, "sv3-125"); assert.equal(f.estado, "en_mano"); assert.equal(f.tcgcsvKey, v1.key); assert.equal(f.variantePromovida, true);
  assert.equal(f.tcgMarket, v1.market); assert.equal(f.tcgcsvGrupo, v1.grupoId); assert.equal(f.varianteEtiqueta, v1.etiqueta);
  assert.equal(f.priceHistory.at(-1).src, "csv"); assert.equal(f.priceHistory.at(-1).tid, String(v1.pid));
  assert.ok(esFilaVariante(f));
});
t("agregar sobre una fila que YA tengo crea un ejemplar extra con id/cardId propios y baseCardId; la original no cambia", () => {
  const b = base("en_mano"); const inv = aplicarVariantePoke([b], { fila: b, v: v2, accion: "agregar", hoy });
  assert.equal(inv.length, 2); assert.equal(inv[0], b);
  const x = inv[1]; assert.equal(x.baseCardId, "sv3-125"); assert.equal(x.cardId, `sv3-125~${v2.pid}`); assert.notEqual(x.id, b.id);
  assert.equal(x.carpeta, "MLP"); assert.equal(x.estado, "en_mano"); assert.equal(x.costoUSD, 0); assert.equal(x.tcgId, undefined); assert.equal(x.tcgMarket, v2.market);
  assert.equal(x.priceHistory.length, 1); assert.equal(x.name, "Carta");
});
t("agregar es idempotente y no duplica: dos veces la misma variante = el mismo inventario", () => {
  const b = base("en_mano"); const a = aplicarVariantePoke([b], { fila: b, v: v2, accion: "agregar", hoy });
  assert.equal(aplicarVariantePoke(a, { fila: b, v: v2, accion: "agregar", hoy }), a);
});
t("varias variantes: cada una su fila; hermanasDe las reúne desde cualquiera de ellas", () => {
  const b = base("en_mano"); let inv = aplicarVariantePoke([b], { fila: b, v: v2, accion: "agregar", hoy });
  inv = aplicarVariantePoke(inv, { fila: b, v: v3, accion: "agregar", hoy });
  assert.equal(inv.length, 3); assert.equal(hermanasDe(inv, inv[1]).length, 3); assert.equal(hermanasDe(inv, inv[2]).length, 3);
  assert.equal(baseSinVariante(hermanasDe(inv, b)), b);
});
t("asignar: la fila que ya tengo ES esa variante (no crea filas; corte de historial por cambio de producto)", () => {
  const b = base("en_mano"); const inv = aplicarVariantePoke([b], { fila: b, v: v1, accion: "asignar", hoy });
  assert.equal(inv.length, 1); assert.equal(inv[0].tcgcsvKey, v1.key); assert.equal(inv[0].variantePromovida, undefined); assert.equal(inv[0].estado, "en_mano");
  assert.equal(inv[0].priceHistory.length, 2);
  // sobre una fila que no tengo no hace nada
  const h = base("hunting"); assert.equal(aplicarVariantePoke([h], { fila: h, v: v1, accion: "asignar", hoy })[0], h);
});
t("quitar: ejemplar extra se borra; promovida vuelve a hunting; la de siempre solo pierde la variante y sigue en mano", () => {
  const b = base("en_mano"); const extra = aplicarVariantePoke([b], { fila: b, v: v2, accion: "agregar", hoy });
  assert.deepEqual(aplicarVariantePoke(extra, { fila: b, v: v2, accion: "quitar", hoy }), [b]);
  const h = base(); const prom = aplicarVariantePoke([h], { fila: h, v: v1, accion: "agregar", hoy });
  const q1 = aplicarVariantePoke(prom, { fila: prom[0], v: v1, accion: "quitar", hoy })[0];
  assert.equal(q1.estado, "hunting"); assert.equal(q1.tcgcsvKey, undefined); assert.equal(q1.variantePromovida, undefined); assert.ok(!filaTiene(q1));
  const asig = aplicarVariantePoke([b], { fila: b, v: v1, accion: "asignar", hoy });
  const q2 = aplicarVariantePoke(asig, { fila: asig[0], v: v1, accion: "quitar", hoy })[0];
  assert.equal(q2.estado, "en_mano"); assert.equal(q2.tcgcsvKey, undefined);
});
t("las filas de Pokémon de siempre no cambian: sin tcgcsvKey no son variantes y la cola de «sin precio» sigue igual", () => {
  const b = base(); assert.ok(!esFilaVariante(b));
  const sinPrecio = { ...b, id: "2", tcgMarket: null }; assert.equal(colaSinPrecio([sinPrecio]).length, 1);
  assert.equal(colaSinPrecio([{ ...sinPrecio, tcgcsvKey: "1|Normal" }]).length, 0);
});
t("pendiente del bot: una fila existente a la que se asigna variante viaja como parche; la nueva entera; la baja como _baja", () => {
  const b = base("en_mano"); const asig = aplicarVariantePoke([b], { fila: b, v: v1, accion: "asignar", hoy });
  const p = parcheVariante([b], asig); assert.equal(p.length, 1); assert.equal(p[0].id, b.id); assert.equal(p[0]._patch.tcgcsvKey, v1.key);
  const r = fusionarPending([b], p); assert.equal(r.parcheadas, 1); assert.equal(r.inventario[0].tcgcsvKey, v1.key); assert.equal(r.inventario[0].tcgcsvGrupo, v1.grupoId);
  const desasig = aplicarVariantePoke(asig, { fila: asig[0], v: v1, accion: "quitar", hoy });
  const r2 = fusionarPending(r.inventario, parcheVariante(asig, desasig)); assert.equal(r2.inventario[0].tcgcsvKey, null);
});
t("precio diario desde tcgcsv: por producto y subtipo; la fila se repreciea una vez por día y conserva su historial", () => {
  const b = base(); const [f0] = aplicarVariantePoke([b], { fila: b, v: v1, accion: "agregar", hoy: ayer });
  assert.deepEqual(gruposDeVariantes([f0]), [v1.grupoId]);
  const res = [{ productId: v1.pid, subTypeName: v1.sub, marketPrice: 12.34, lowPrice: 10, highPrice: 20 }, { productId: v1.pid, subTypeName: "OtroSub", marketPrice: 99 }];
  assert.deepEqual(precioDeResultados(res, v1.pid, v1.sub), { market: 12.34, low: 10, high: 20, tid: String(v1.pid), variant: v1.sub });
  const r = actualizarPreciosPokeVariantes([f0, base("en_mano")], { [v1.grupoId]: res }, hoy);
  assert.equal(r.cambiadas, 1); assert.equal(r.filas[0].tcgMarket, 12.34); assert.equal(r.filas[0].tcgUpdated, hoy); assert.ok(r.filas[0].priceHistory.length >= 2);
  assert.equal(r.filas[1].tcgMarket, 1);                                          // la de siempre no se toca
  assert.equal(actualizarPreciosPokeVariantes(r.filas, { [v1.grupoId]: res }, hoy).cambiadas, 0);   // idempotente
  assert.equal(actualizarPreciosPokeVariantes([f0], {}, hoy).cambiadas, 0);       // sin datos ese día: conserva
});
console.log(`${n} pruebas en verde`);
