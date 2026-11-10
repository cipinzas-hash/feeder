// Issue #39 (9-nov-2026): Mega/Tera solo Double Rare, colecciones individuales (una carta por colección) y ACE SPEC.
import assert from "node:assert/strict";
import { esDoubleRare, esAceSpec, carpetaDeInv, carpetaDeCat, invEnCarpeta, invDeCarta, rarezaConocida, sobraPorRareza, entradasFaltantes,
  resumenAvance, sumarAvances, registrarSnapshotMes, serieColeccion, variacionMensual, mesDe, TOTAL_COLECCIONES } from "../modules/pokecripto/lib/colecciones.mjs";

// rareza: solo "Double Rare" es normal; ACE SPEC por rareza o por subtipo (desde que existen)
assert.equal(esDoubleRare({ rarity: "Double Rare" }), true);
assert.equal(esDoubleRare({ rarity: " double rare " }), true);
for (const r of ["Ultra Rare", "Illustration Rare", "Special Illustration Rare", "Mega Hyper Rare", "Hyper Rare", "Rare Holo EX", "", undefined]) assert.equal(esDoubleRare({ rarity: r }), false, String(r));
assert.equal(esAceSpec({ rarity: "ACE SPEC Rare" }), true);
assert.equal(esAceSpec({ rarity: "ACE SPEC" }), true);
assert.equal(esAceSpec({ rarity: "Rare Holo", subtypes: ["Item", "ACE SPEC"] }), true, "subtipo de los sets más viejos");
assert.equal(esAceSpec({ rarity: "Rare Holo", subtypes: ["Item"] }), false);
assert.equal(esAceSpec({}), false);

// Mega y Tera: con rareza desconocida no se da de baja nada
assert.equal(sobraPorRareza("Mega", "Ultra Rare"), true);
assert.equal(sobraPorRareza("Mega", "Special Illustration Rare"), true);
assert.equal(sobraPorRareza("Tera", "Illustration Rare"), true);
assert.equal(sobraPorRareza("Mega", "Double Rare"), false);
assert.equal(sobraPorRareza("Tera", "Double Rare"), false);
assert.equal(sobraPorRareza("Mega", ""), false, "rareza desconocida: no se adivina");
assert.equal(sobraPorRareza("Dark Collection", "Ultra Rare"), false, "solo Mega y Tera");
assert.equal(sobraPorRareza("ACE SPEC", "ACE SPEC Rare"), false);

// carpeta: Dark no guarda carpeta en el catálogo; en el inventario, las isDark antiguas sin carpeta
assert.equal(carpetaDeCat({ cardId: "a" }), "Dark Collection");
assert.equal(carpetaDeCat({ cardId: "a", carpeta: "Mega" }), "Mega");
assert.equal(carpetaDeInv({ isDark: true }), "Dark Collection");
assert.equal(carpetaDeInv({ carpeta: "Mega", isDark: false }), "Mega");
assert.equal(carpetaDeInv({}), "");

// cada colección es individual: lo que tengas en otra no cuenta aquí
const dark = { id: "1", cardId: "me1-3", carpeta: "Dark Collection", estado: "sin_publicar", tcgMarket: 1.5, tcgLow: 1, tcgHigh: 2, tcgUpdated: "2026-11-08", tcgId: "t-9",
  rarity: "Double Rare", artist: "Ilus", image: "s.png", imageHd: "l.png", priceHistory: [{ date: "2026-11-01", market: 1.4 }], notas: "mía", costoUSD: 2, set: "Mega Evolution", setCode: "me1", number: "3" };
const watch = { id: "2", cardId: "me1-3", carpeta: "Price Watch", estado: "hunting" };
const inv = [dark, watch];
assert.equal(invEnCarpeta(inv, "me1-3", "Mega"), null, "una Mega conseguida en Dark no cuenta en Mega");
assert.equal(invEnCarpeta(inv, "me1-3", "Dark Collection"), dark);
assert.equal(invEnCarpeta(inv, "me1-3", "Price Watch"), watch);
assert.equal(invDeCarta(inv, "me1-3", "Mega"), null, "con colección abierta, sin respaldo en otra");
assert.equal(invDeCarta(inv, "me1-3", null), dark, "sin colección: la primera que no sea Price Watch");
assert.equal(invDeCarta([watch], "me1-3", null), null);

// rareza: la del catálogo o la de cualquier carta con el mismo cardId
assert.equal(rarezaConocida({ cardId: "me1-3" }, inv), "Double Rare");
assert.equal(rarezaConocida({ cardId: "me1-3", rarity: "Ultra Rare" }, inv), "Ultra Rare");
assert.equal(rarezaConocida({ cardId: "zzz" }, inv), "");

// cartas que faltan: una por colección, hunting, heredan lo de la carta y no lo de la colección
const cat = [{ cardId: "me1-3", name: "Mega X ex", setName: "Mega Evolution", setId: "me1", number: "3" },                       // Dark (sin carpeta)
  { cardId: "me1-3", name: "Mega X ex", setName: "Mega Evolution", setId: "me1", number: "3", carpeta: "Mega" },
  { cardId: "me1-3", name: "Mega X ex", carpeta: "Mega" },                                                                          // repetida en el catálogo: una sola carta
  { cardId: "man", manual: true, carpeta: "Mega" },
  { cardId: "me1-9", name: "Otra", setName: "Mega Evolution", setId: "me1", number: "9", carpeta: "Tera", rarity: "Double Rare" }];
let n = 0;
const f = entradasFaltantes(cat, inv, d => "id" + (++n) + "_" + d.cardId);
assert.deepEqual(f.map(c => [c.carpeta, c.cardId]), [["Mega", "me1-3"], ["Tera", "me1-9"]]);
const m = f[0];
assert.equal(m.estado, "hunting"); assert.equal(m.costoUSD, 0); assert.equal(m.notas, ""); assert.deepEqual(m.priceHistory, []);
assert.equal(m.fechaCompra, null); assert.equal(m.isDark, false); assert.equal(m.cantidad, 1);
assert.equal(m.rarity, "Double Rare"); assert.equal(m.artist, "Ilus"); assert.equal(m.imageHd, "l.png");
assert.equal(m.tcgMarket, 1.5); assert.equal(m.tcgId, "t-9"); assert.equal(m.tcgUpdated, "2026-11-08");
assert.equal(f[1].tcgMarket, null, "sin hermana: sin precio hasta que lo traiga el bot");
assert.equal(f[1].rarity, "Double Rare", "toma la rareza del catálogo");
assert.equal(dark.estado, "sin_publicar", "no toca la carta de Dark"); assert.equal(inv.length, 2, "no muta");
// idempotente: con las cartas creadas ya no falta ninguna
assert.deepEqual(entradasFaltantes(cat, [...inv, ...f], () => "z"), []);
assert.equal(entradasFaltantes(undefined, undefined, () => "z").length, 0);

// una Dark antigua (isDark sin carpeta) cuenta como Dark: no se duplica
assert.deepEqual(entradasFaltantes([{ cardId: "d1" }], [{ id: "x", cardId: "d1", isDark: true }], () => "z"), []);

// ── Issue #40: avance + valor, y snapshots mensuales ──
const tiene = d => d.estado !== "hunting";
const cartas = [
  { estado: "sin_publicar", tcgMarket: 2.5 }, { estado: "hunting", tcgMarket: 10 }, { estado: "hunting", tcgMarket: null }, { estado: "vendida", tcgMarket: 1.25 },
];
const av = resumenAvance(cartas, tiene);
assert.deepEqual([av.total, av.conseguidas, av.pct], [4, 2, 50]);
assert.equal(av.valorTotal, 13.75); assert.equal(av.valorConseguido, 3.75); assert.equal(av.conPrecio, 3);
assert.equal(av.pctValor, 27, "3.75/13.75");
const vacio = resumenAvance([], tiene);
assert.deepEqual([vacio.total, vacio.pct, vacio.pctValor], [0, 0, 0], "sin cartas no divide por cero");
const sinPrecios = resumenAvance([{ estado: "hunting" }, { estado: "sin_publicar" }], tiene);
assert.deepEqual([sinPrecios.pct, sinPrecios.pctValor, sinPrecios.conPrecio], [50, 0, 0]);
const suma = sumarAvances([av, resumenAvance([{ estado: "sin_publicar", tcgMarket: 6.25 }], tiene)]);
assert.deepEqual([suma.total, suma.conseguidas, suma.pct, suma.valorTotal, suma.valorConseguido], [5, 3, 60, 20, 10]);
assert.equal(sumarAvances([]).pct, 0);

assert.equal(mesDe("2026-11-10"), "2026-11");
let h = registrarSnapshotMes([], "2026-10-31", { Mega: av, [TOTAL_COLECCIONES]: suma, Vacia: vacio, SinPrecios: sinPrecios });
assert.equal(h.length, 1);
assert.deepEqual(Object.keys(h[0].colecciones).sort(), [TOTAL_COLECCIONES, "Mega"].sort(), "sin cartas o sin ningún precio no se registra");
assert.deepEqual(h[0].colecciones.Mega, { v: 13.75, vc: 3.75, n: 4, c: 2, p: 3 });
assert.equal(registrarSnapshotMes(h, "2026-10-31", { Mega: av }), h, "mismo valor en el mismo mes: mismo array (cero escrituras)");
// el mes en curso se actualiza (queda el último valor) y no pisa otras colecciones del mismo mes
const av2 = resumenAvance([{ estado: "sin_publicar", tcgMarket: 3 }, { estado: "hunting", tcgMarket: 11 }, { estado: "hunting", tcgMarket: 1 }, { estado: "sin_publicar", tcgMarket: 1.25 }], tiene);
const h2 = registrarSnapshotMes(h, "2026-10-31", { Mega: av2 });
assert.equal(h2.length, 1); assert.equal(h2[0].colecciones.Mega.v, 16.25); assert.ok(h2[0].colecciones[TOTAL_COLECCIONES], "conserva lo ya registrado");
// mes nuevo: entrada nueva, ordenada
const h3 = registrarSnapshotMes(h2, "2026-11-10", { Mega: resumenAvance([{ estado: "sin_publicar", tcgMarket: 5 }, { estado: "hunting", tcgMarket: 11 }, { estado: "hunting", tcgMarket: 1 }, { estado: "sin_publicar", tcgMarket: 1.25 }], tiene) });
assert.deepEqual(h3.map(x => x.mes), ["2026-10", "2026-11"]);
assert.deepEqual(serieColeccion(h3, "Mega").map(s => s.mes), ["2026-10", "2026-11"]);
assert.deepEqual(serieColeccion(h3, "Nada"), []);
const vm = variacionMensual(h3, "Mega", "2026-11");
assert.equal(vm.desde, "2026-10"); assert.equal(vm.delta, 2); assert.equal(vm.pct, 12.3); assert.equal(vm.cambioCartas, false);
assert.equal(variacionMensual(h3, "Mega", "2026-10"), null, "sin mes anterior no hay variación");
assert.equal(variacionMensual(h3, "Nada", "2026-11"), null);
// salta meses sin snapshot y avisa cuando cambió la cantidad de cartas (set nuevo)
const h4 = registrarSnapshotMes(h3, "2027-01-05", { Mega: resumenAvance([...Array(6)].map(() => ({ estado: "hunting", tcgMarket: 2 })), tiene) });
const vm4 = variacionMensual(h4, "Mega", "2027-01");
assert.equal(vm4.desde, "2026-11"); assert.equal(vm4.cambioCartas, true); assert.deepEqual([vm4.nAntes, vm4.nAhora], [4, 6]);
assert.deepEqual(registrarSnapshotMes(undefined, "mal", { Mega: av }), [], "fecha inválida o historial ausente no rompe");

console.log("pokecripto-colecciones: OK");
