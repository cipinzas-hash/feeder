import assert from "node:assert/strict";
import { claveNombre, memoriaDesdeHistorial, buscarSugerencias, recordarCompra, rangoPrecios, tieneMemoria, memoriaVacia } from "../core/comprasMemoria.js";

// Mismo producto con distinto plural, tilde, mayúscula o signo
assert.equal(claveNombre("Manzanas"), claveNombre("manzana")); assert.equal(claveNombre("Plátano"), claveNombre("Platano"));
assert.equal(claveNombre("Jamón?"), claveNombre("Jamon")); assert.equal(claveNombre("Huevos"), claveNombre("Huevo"));
assert.notEqual(claveNombre("Papa"), claveNombre("Papel")); assert.equal(claveNombre("  "), "");
assert.equal(claveNombre("Leches"), claveNombre("leche")); assert.equal(claveNombre("Papeles"), claveNombre("papel")); assert.equal(claveNombre("Limones"), claveNombre("Limón"));
assert.equal(claveNombre("Cafés"), claveNombre("cafe")); assert.equal(claveNombre("Tomates"), claveNombre("tomate")); assert.equal(claveNombre("Yogures"), claveNombre("yogur")); assert.equal(claveNombre("Hamburguesas"), claveNombre("hamburguesa"));

// Historial: se junta lo que es lo mismo, con el nombre más usado, los otros como alias, y la categoría y el último precio más recientes
const dia = (compras) => ({ compras });
const it = (text, extra = {}) => ({ id: Math.random().toString(36), text, done: true, ...extra });
const dayData = {
  "2026-10-01": dia([it("Manzana"), it("Manzana"), it("Yogurt", { categoria: "Lácteos", precio: 1300 }), it("Pendiente", { done: false })]),
  "2026-10-08": dia([it("Manzanas", { categoria: "Fruta", precio: 1500 }), it("Jamon"), it("Jamón?")]),
  "2026-10-15": dia([it("Manzana", { precio: 1700 }), it("Jamon"), it("   ")]),
};
const mem = memoriaDesdeHistorial(dayData);
assert.ok(tieneMemoria(mem)); assert.equal(mem.v, 1);
const man = mem.items[claveNombre("manzana")];
assert.deepEqual([man.n, man.veces, man.ult, man.cat, man.p, man.pp, man.alias], ["Manzana", 4, "2026-10-15", "Fruta", 1700, [1500, 1700], ["Manzanas"]]);
const jam = mem.items[claveNombre("jamon")]; assert.deepEqual([jam.n, jam.veces, jam.alias], ["Jamon", 3, ["Jamón?"]]);
assert.equal(Object.keys(mem.items).length, 3);                                  // Manzana, Yogurt, Jamon; lo pendiente y lo vacío no cuentan
assert.equal(mem.items[claveNombre("yogurt")].p, 1300);
assert.deepEqual(memoriaDesdeHistorial({}), memoriaVacia()); assert.deepEqual(memoriaDesdeHistorial(null), memoriaVacia());

// Sugerencias: mismo producto primero, luego por lo que empieza igual, y los parecidos marcados
let r = buscarSugerencias(mem, "manzanas"); assert.deepEqual([r[0].m.n, r[0].score, r[0].similar], ["Manzana", 3, false]);
r = buscarSugerencias(mem, "yogur"); assert.deepEqual([r[0].m.n, r[0].similar], ["Yogurt", false]);     // «yogur» es prefijo de «yogurt»
r = buscarSugerencias(mem, "yogut"); assert.deepEqual([r[0].m.n, r[0].similar], ["Yogurt", true]);       // una letra de diferencia: «¿quisiste decir…?»
r = buscarSugerencias(mem, "JAMÓN"); assert.equal(r[0].m.n, "Jamon");
assert.deepEqual(buscarSugerencias(mem, "xyz"), []); assert.deepEqual(buscarSugerencias(mem, ""), []); assert.deepEqual(buscarSugerencias({}, "ma"), []);
assert.equal(buscarSugerencias(mem, "m").length, 2);                                                    // «m»: Manzana y Jamon (la contiene); orden por coincidencia y veces
assert.equal(buscarSugerencias(mem, "m")[0].m.n, "Manzana");

// Recordar una compra: suma veces, aprende el precio confirmado (no el estimado), guarda alias y categoría; no muta
const m1 = recordarCompra(mem, { text: "manzanas", categoria: "Fruta", precio: 1900, fecha: "2026-10-27" });
const a = m1.items[claveNombre("manzana")]; assert.deepEqual([a.veces, a.p, a.pp, a.ult, a.n], [5, 1900, [1500, 1700, 1900], "2026-10-27", "Manzana"]);
assert.ok(a.alias.includes("manzanas")); assert.equal(mem.items[claveNombre("manzana")].veces, 4);
const m2 = recordarCompra(m1, { text: "Manzana", precio: 0, fecha: "2026-10-28" }); assert.deepEqual([m2.items[claveNombre("manzana")].p, m2.items[claveNombre("manzana")].veces], [1900, 6]);   // sin precio confirmado, no cambia el precio
const nuevo = recordarCompra(mem, { text: "Quinoa", categoria: "Prote", precio: 3000, fecha: "2026-10-27" }); assert.deepEqual([nuevo.items[claveNombre("quinoa")].n, nuevo.items[claveNombre("quinoa")].veces], ["Quinoa", 1]);
assert.equal(recordarCompra(mem, { text: "   " }), mem); assert.equal(Object.keys(recordarCompra({}, { text: "Pan" }).items).length, 1);
let largo = memoriaVacia(); for (let i = 1; i <= 12; i++) largo = recordarCompra(largo, { text: "Pan", precio: 1000 + i });
assert.equal(largo.items[claveNombre("pan")].pp.length, 8);                                              // guarda los últimos 8 precios

// Rango de los últimos 5 precios
assert.deepEqual(rangoPrecios({ pp: [900, 1000, 1100, 1300, 1700, 1500] }), { min: 1000, max: 1700, n: 5 });
assert.equal(rangoPrecios({ pp: [] }), null); assert.equal(rangoPrecios(null), null);
console.log("compras-memoria: OK");
