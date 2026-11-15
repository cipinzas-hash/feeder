// Prueba de la lógica pura y del estado de tcgcrypto (issue #42). Sin navegador ni red.
import assert from "node:assert/strict";

const almacen = new Map();
globalThis.localStorage = { getItem: k => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)), removeItem: k => almacen.delete(k) };

const L = await import("../modules/tcgcrypto/logica.js");
const E = await import("../modules/tcgcrypto/estado.js");

// v = [productId, subtipo, setIdx, número, rareza, mercado, bajo, alto]
const sets = ["Set A", "Set B"];
const dm = { k: "dark magician", n: "Dark Magician", c: ["dark"], v: [[1, "1st Edition", 0, "A-001", "Ultra Rare", 5, 3, 9], [2, "Unlimited", 1, "B-002", "Common", 0.5, 0.2, 2], [3, "Unlimited", 1, "B-003", "Rare", null, null, null]] };
const sin = { k: "sin precio", n: "Sin Precio", c: ["dark"], v: [[4, "", 0, "A-009", "Rare", null, null, null]] };

// precio de referencia: versión más barata con precio, o la elegida
assert.equal(L.precioReferencia(dm, null), 0.5);
assert.equal(L.precioReferencia(dm, { e: "1|1st Edition" }), 5);
assert.equal(L.precioReferencia(dm, { e: "3|Unlimited" }), null, "la elegida manda aunque no tenga precio");
assert.equal(L.precioReferencia(sin, null), null);

// resumen: completitud por cantidad, valor por versión elegida × cantidad
const r = L.resumenColeccion([dm, sin], { "dark magician": { c: 1, e: "1|1st Edition", q: 2 } });
assert.deepEqual([r.total, r.conseguidas, r.pct, r.valorConseguido, r.valorTotal, r.sinPrecio], [2, 1, 50, 10, 5, 1]);
assert.equal(L.resumenColeccion([], {}).pct, 0);

// barra por tramos
assert.equal(L.tramoBarra(0).color, "#e5383b"); assert.equal(L.tramoBarra(30).color, "#f08a24");
assert.equal(L.tramoBarra(60).color, "#e6c229"); assert.equal(L.tramoBarra(80).color, "#4caf50");
assert.equal(L.tramoBarra(100).texto, "¡completada!");

// filtros
const marcas = { "dark magician": { c: 1 } };
assert.equal(L.filtrarCartas([dm, sin], marcas, { modo: "faltan" }, sets).length, 1);
assert.equal(L.filtrarCartas([dm, sin], marcas, { modo: "tengo" }, sets)[0].k, "dark magician");
assert.equal(L.filtrarCartas([dm, sin], marcas, { texto: "b-002" }, sets).length, 1, "busca por número de cualquier versión");
assert.equal(L.filtrarCartas([dm, sin], marcas, { texto: "set b" }, sets).length, 1, "busca por set");
assert.equal(L.filtrarCartas([dm, sin], marcas, { texto: "DÁRK" }, sets).length, 1, "la búsqueda ignora mayúsculas y tildes");
assert.equal(L.filtrarCartas([dm, sin], marcas, { texto: "zzz" }, sets).length, 0);

assert.equal(L.usd(null), "—"); assert.equal(L.usd(0.5), "$0.50"); assert.equal(L.usd(1234.5), "$1,235");
assert.equal(L.urlImagen("https://x/p/{id}_200w.jpg", 7), "https://x/p/7_200w.jpg");
assert.equal(L.urlImagen("https://x/p/{id}_200w.jpg", 7, 400), "https://x/p/7_400w.jpg");
assert.equal(L.edadDatos(new Date(Date.now() - 3 * 3600000).toISOString(), Date.now()).texto, "hace 3 h");
assert.equal(L.edadDatos(null, Date.now()).vieja, true);

// estado: cada colección es individual; una marca vacía se borra; clave propia
E.ponerMarca("yugioh", "dark", "dark magician", { c: 1, e: "1|1st Edition" });
E.ponerMarca("yugioh", "zombie", "dark magician", { c: 1 });
E.ponerMarca("yugioh", "dark", "dark magician", { c: 0 });
let st = E.leerEstado();
assert.equal(E.marcaDe(st, "yugioh", "zombie", "dark magician").c, 1, "lo de una colección no toca la otra");
assert.equal(E.marcaDe(st, "yugioh", "dark", "dark magician").e, "1|1st Edition");
E.ponerMarca("yugioh", "dark", "dark magician", { e: "" });
assert.equal(E.marcaDe(E.leerEstado(), "yugioh", "dark", "dark magician"), null, "sin nada que guardar, la marca se borra");
E.elegirTcg("digimon");
assert.equal(JSON.parse(almacen.get("angst-tcgcrypto-estado-v1")).tcg, "digimon");
almacen.set("angst-tcgcrypto-estado-v1", "{roto");
E.rehidratarEstado();
assert.equal(E.leerEstado().tcg, "yugioh", "clave corrupta: estado vacío, sin romper");

console.log("tcgcrypto: OK");
