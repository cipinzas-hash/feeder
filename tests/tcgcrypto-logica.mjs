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


// ── ediciones: la más reciente primero; la carta va en la edición de su versión elegida o de su impresión más reciente ──
const datos = { sets: ["Vieja", "Media", "Nueva"], setFechas: ["2010-01-01", "2018-05-05", "2025-09-09"], setIds: [1, 2, 3] };
const rank = L.rankSets(datos);
assert.deepEqual(rank, [0, 1, 2]);
assert.deepEqual(L.rankSets({ sets: ["a", "b"], setFechas: ["", ""], setIds: [9, 4] }), [1, 0], "sin fecha, por id de set");
const tri = { k: "tri", n: "Tri", c: ["dark"], v: [[10, "", 0, "V-001", "Common", 1, 1, 1], [11, "", 2, "N-007", "Rare", 3, 3, 3]] };
assert.equal(L.versionReferencia(tri, null, rank)[2], 2, "sin elegir: la impresión más reciente");
assert.equal(L.versionReferencia(tri, { e: "10|" }, rank)[2], 0, "elegida: manda sobre la reciente");
const g = L.agruparPorEdicion([dm, tri, sin], datos, rank);
assert.deepEqual(g.map(x => x.nombre), ["Nueva", "Media", "Vieja"], "todas las ediciones con alguna impresión, la más reciente primero");
assert.deepEqual(g.find(x => x.nombre === "Vieja").cartas.map(c => c.k), ["dark magician", "sin precio", "tri"], "dentro de la edición, por número");
// una carta aparece en CADA edición donde se imprimió (no solo en la más reciente)
assert.ok(g.find(x => x.nombre === "Vieja").cartas.some(c => c.k === "tri"), "tri está en su edición antigua");
assert.ok(g.find(x => x.nombre === "Nueva").cartas.some(c => c.k === "tri"), "…y también en la nueva");
assert.equal(g.find(x => x.nombre === "Nueva").filas[0].vs.length, 1, "vs = versiones de la carta en esa edición");
assert.equal(L.versionEnEdicion(tri.v, { e: "11|" })[0], 11, "la elegida representa a la carta en su edición");
assert.equal(L.versionEnEdicion([tri.v[0]], { e: "11|" })[0], 10, "si la elegida no es de esa edición, la primera del set");

// ── filtros de biblioteca: O dentro de un campo, Y entre campos ──
const a = { k: "a", n: "A", c: ["x"], m: { t: "Monstruo", a: "DARK", lv: 4, ar: "Eldlich" }, v: [[1, "", 0, "1", "R", 1, 1, 1]] };
const b = { k: "b", n: "B", c: ["x"], m: { t: "Mágica", r: "Quick-Play" }, v: [[2, "", 0, "2", "R", 1, 1, 1]] };
assert.equal(L.pasaFiltros(a, { t: ["Monstruo"], lv: ["4", "5"] }), true);
assert.equal(L.pasaFiltros(a, { t: ["Mágica", "Trampa"] }), false);
assert.equal(L.pasaFiltros(b, { lv: ["4"] }), false, "un campo ausente no pasa un filtro que lo pide");
assert.equal(L.pasaFiltros(b, {}), true);
assert.equal(L.cuentaFiltros({ t: ["a", "b"], lv: ["4"], x: [] }), 3);
assert.deepEqual(L.valoresFiltro([a, b], "t"), ["Mágica", "Monstruo"]);
assert.deepEqual(L.valoresFiltro([{ m: { lv: 10 }, v: [] }, { m: { lv: 2 }, v: [] }], "lv"), ["2", "10"], "numéricos ordenados como números");
assert.equal(L.filtrarCartas([a, b], {}, { filtros: { t: ["Monstruo"] } }, sets).length, 1);
assert.equal(L.filtrarCartas([a, b], {}, { texto: "eldlich" }, sets).length, 1, "el texto busca también en el arquetipo");
assert.equal(L.urlImagenGrande(5), "https://product-images.tcgplayer.com/fit-in/1000x1000/5.jpg");

// ── vista elegida ──
E.elegirVista("az"); assert.equal(E.leerEstado().vista, "az");
E.elegirVista("loquesea"); assert.equal(E.leerEstado().vista, "edicion", "valor desconocido: vuelve a edición");

console.log("tcgcrypto: OK");
