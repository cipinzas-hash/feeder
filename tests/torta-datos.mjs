import assert from "node:assert/strict";
import { rebanadas, emojiProducto, emojiCategoria, nombreProducto, claveProducto, SIN_CAT } from "../modules/presupuesto/tortaDatos.js";

assert.equal(nombreProducto("2× Manzana"), "Manzana"); assert.equal(nombreProducto("1,5x Leche"), "Leche"); assert.equal(nombreProducto(""), "(sin nota)");
assert.equal(claveProducto("Manzanas"), claveProducto("manzana")); assert.equal(claveProducto("Plátano"), claveProducto("platano")); assert.notEqual(claveProducto("Papa"), claveProducto("Papel"));
assert.equal(emojiProducto("Manzanas", "Fruta"), "🍎"); assert.equal(emojiProducto("Papel higiénico", "Aseo"), "🧻"); assert.equal(emojiProducto("Salchicha", "Prote"), "🍗"); // «sal» no atrapa «salchicha»
assert.equal(emojiProducto("Algo raro", "Zzz"), "🛒"); assert.equal(emojiCategoria("Lácteos"), "🥛"); assert.equal(emojiCategoria("loquesea"), "🏷️");

const filas = [{ sec: "propositos", row: { id: "ali", label: "Alimentación", emoji: "🍽️" } }, { sec: "propositos", row: { id: "aseo", label: "Aseo", emoji: "🧹" } }];
const g = (id, fecha, rowId, monto, nota, categoria, enPeriodo = true) => ({ id, fecha, sec: "propositos", rowId, monto, nota, categoria, enPeriodo });
const movs = [
  g("1", "2026-10-26", "ali", 3000, "1× Manzana", "Fruta"), g("2", "2026-10-27", "ali", 2000, "Manzanas", "Fruta"), g("3", "2026-10-20", "ali", 6000, "Pollo", "Prote"),
  g("4", "2026-10-21", "aseo", 2500, "Cloro", "Aseo"), g("5", "2026-10-22", "ali", 900, "Pan"), g("6", "2026-09-30", "ali", 4000, "Manzana", "Fruta", false), g("7", "2026-09-10", "ali", 1500, "Pan", undefined, false),
];
const R = (o) => rebanadas({ movs, filas, modo: "m", tab: "s", ...o });
// por sobre, nivel 0: mensual vs anual
let r = R({}); assert.equal(r.nivel, 0);
assert.deepEqual(r.items.map(x => [x.l, x.d, x.p, x.y]), [["Alimentación", 11900, 11900, 17400], ["Aseo", 2500, 2500, 2500]]);
r = R({ modo: "a" }); assert.deepEqual(r.items.map(x => [x.l, x.d]), [["Alimentación", 17400], ["Aseo", 2500]]);
// nivel 1: categorías del sobre; lo sin categoría se llama «Sin categoría» (no se pierde)
r = R({ sobre: "propositos|ali" }); assert.equal(r.nivel, 1);
assert.deepEqual(r.items.map(x => [x.l, x.p, x.y]), [["Prote", 6000, 6000], ["Fruta", 5000, 9000], [SIN_CAT, 900, 2400]]);
// nivel 2 mensual: compras individuales con su fecha y el total del producto en 12 meses; anual: juntas por producto
r = R({ sobre: "propositos|ali", cat: "Fruta" }); assert.equal(r.nivel, 2);
assert.deepEqual(r.items.map(x => [x.l, x.p, x.y, x.sub]), [["Manzana", 3000, 9000, "26/10"], ["Manzanas", 2000, 9000, "27/10"]]);
r = R({ sobre: "propositos|ali", cat: "Fruta", modo: "a" }); assert.deepEqual(r.items.map(x => [x.l, x.d, x.n, x.ny]), [["Manzana", 9000, 2, 3]]);
// por categoría
r = R({ tab: "c" }); assert.deepEqual(r.items.map(x => [x.l, x.sub, x.p]), [["Prote", "Alimentación", 6000], ["Fruta", "Alimentación", 5000], ["Aseo", "Aseo", 2500], [SIN_CAT, "Alimentación", 900]]);
r = R({ tab: "c", sobre: "propositos|aseo", cat: "Aseo" }); assert.deepEqual(r.items.map(x => x.l), ["Cloro"]);
// por compra: mensual = individuales; anual = por producto; «Otras» junta las más chicas
r = R({ tab: "p" }); assert.equal(r.items.length, 5); assert.equal(r.items[0].l, "Pollo");
r = R({ tab: "p", modo: "a" }); assert.deepEqual(r.items.map(x => [x.l, x.d]).slice(0, 2), [["Manzana", 9000], ["Pollo", 6000]]);
const muchos = Array.from({ length: 14 }, (_, i) => g("m" + i, "2026-10-25", "ali", 1000 + i, "Cosa " + i, "Snack"));
r = rebanadas({ movs: muchos, filas, modo: "m", tab: "p" }); assert.equal(r.items.length, 10); assert.equal(r.items[9].otras, true); assert.equal(r.items[9].l, "Otras (5)");
// ficha de una compra
r = R({ tab: "p", prod: "1" }); assert.equal(r.nivel, 1);
assert.deepEqual([r.ficha.l, r.ficha.sobre, r.ficha.categoria, r.ficha.periodo, r.ficha.anual, r.ficha.veces, r.ficha.min, r.ficha.max], ["Manzana", "Alimentación", "Fruta", 5000, 9000, 3, 2000, 4000]);
assert.equal(R({ tab: "p", prod: "no-existe" }).ficha, null);
console.log("torta-datos: OK");
