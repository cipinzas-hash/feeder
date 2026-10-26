// Pruebas de la lógica pura de descubrimiento y de la cola pending. Correr: node tests/pokecripto-descubrimiento.mjs
import assert from "node:assert/strict";
import { cupoRestante, diagnosticarSet, emparejarTcgId, asignarTcgIds, agruparPorSet, paginasNecesarias, debeSaltarse, actualizarEstadoSet, presupuestoDescubrimiento, sumarDias } from "../modules/pokecripto/lib/discovery.mjs";
import { fusionarPending, pendingRestante, unirHistorial, mergePreciosBot, prioridadCarta } from "../modules/pokecripto/lib/review.mjs";
import { addSnapshot, fuenteCompatible, refreshPrecio } from "../modules/pokecripto/lib/pricing.mjs";

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const r = (tcgId, name, number, setId, setName, setCode, market = 1) => ({ tcgId, name, number, setId, setName, setCode, market });
const carta = (id, name, number, set, setCode, extra = {}) => ({ id, name, number, set, setCode, ...extra });

t("emparejarTcgId: número + set + nombre; el número llega como 116/084", () => {
  const m = emparejarTcgId(carta("1", "Mega Darkrai ex", "116", "Phantasmal Flames", "me2"), [r("x", "Mega Darkrai ex - 116/084", "116/084", "me2", "Phantasmal Flames", "PFL")]);
  assert.equal(m?.tcgId, "x");
});
t("emparejarTcgId: tcgpricelookup nombra el set distinto (nombre y código): igual empareja por nombre + número si es único", () => {
  const m = emparejarTcgId(carta("1", "Iono", "185", "Paldea Evolved", "sv2"), [r("x", "Iono", "185/193", "paldea-evolved", "SV02: Paldea Evolved", "PAL")]);
  assert.equal(m?.tcgId, "x");
});
t("emparejarTcgId: reimpresión en dos sets -> gana el set que coincide; si ninguno coincide, no se arriesga", () => {
  const dos = [r("a", "Pikachu", "25", "cel25", "Celebrations", "CEL"), r("b", "Pikachu", "25", "otro", "Otro Set", "OT")];
  assert.equal(emparejarTcgId(carta("1", "Pikachu", "25", "Celebrations", "cel25"), dos)?.tcgId, "a");
  assert.equal(emparejarTcgId(carta("1", "Pikachu", "25", "Set Raro", "raro"), dos), null);
});
t("emparejarTcgId: nombre distinto o número distinto no empareja (ni 'Foo ex' por 'Foo')", () => {
  assert.equal(emparejarTcgId(carta("1", "Foo", "1", "Alpha", "alp"), [r("a", "Foo ex", "1", "alp", "Alpha", "ALP")]), null);
  assert.equal(emparejarTcgId(carta("1", "Foo", "1", "Alpha", "alp"), [r("a", "Foo", "2", "alp", "Alpha", "ALP")]), null);
});
t("emparejarTcgId: la designación manual manda sobre el nombre de la carta", () => {
  const c = carta("1", "Distinto", "9", "Gamma", "gam", { tcgOverride: { name: "Weird Name ex", number: "009/050", setId: "gam", setCode: "GAM" } });
  assert.equal(emparejarTcgId(c, [r("o", "Weird Name ex", "009/050", "gam", "Gamma", "GAM")])?.tcgId, "o");
  assert.equal(emparejarTcgId(c, [r("o", "Weird Name ex", "009/050", "otro", "Otro", "OT")]), null);
});
t("asignarTcgIds: Map idCarta -> resultado, solo las que calzan", () => {
  const m = asignarTcgIds([carta("1", "Foo", "1", "Alpha", "alp"), carta("2", "Nada", "7", "Alpha", "alp")], [r("a", "Foo", "1", "alp", "Alpha", "ALP")]);
  assert.equal(m.size, 1); assert.equal(m.get("1").tcgId, "a");
});
t("agruparPorSet: Price Watch y sin precio primero, luego los más grandes", () => {
  const g = agruparPorSet([carta("1", "a", "1", "Grande", "g", { tcgMarket: 1 }), carta("2", "b", "2", "Grande", "g", { tcgMarket: 1 }), carta("3", "c", "3", "Chico", "c", { tcgMarket: 1, carpeta: "Price Watch" }), carta("4", "d", "4", "SinPrecio", "s")]);
  assert.deepEqual(g.map(x => x.set), ["Chico", "SinPrecio", "Grande"]);
});
t("paginasNecesarias: según el número más alto, con tope", () => {
  assert.equal(paginasNecesarias({ cartas: [carta("1", "a", "292", "X", "x")] }), 3);
  assert.equal(paginasNecesarias({ cartas: [carta("1", "a", "50", "X", "x")] }), 1);
  assert.equal(paginasNecesarias({ cartas: [carta("1", "a", "900", "X", "x")] }, 4), 4);
});
t("estado por set: reintento en 7 días si quedaron cartas, 21 si dos intentos sin nada, nunca si se resolvió", () => {
  const e1 = actualizarEstadoSet(null, { set: "X", hoy: "2026-10-12", encontradas: 5, restantes: 2 });
  assert.equal(e1.reintentarDespuesDe, "2026-10-19"); assert.ok(debeSaltarse(e1, "2026-10-15")); assert.ok(!debeSaltarse(e1, "2026-10-19"));
  const e2 = actualizarEstadoSet(actualizarEstadoSet(null, { set: "X", hoy: "2026-10-01", encontradas: 0, restantes: 3 }), { set: "X", hoy: "2026-10-12", encontradas: 0, restantes: 3 });
  assert.equal(e2.reintentarDespuesDe, "2026-11-02");
  assert.equal(actualizarEstadoSet(e1, { set: "X", hoy: "2026-10-20", encontradas: 2, restantes: 0 }).reintentarDespuesDe, null);
  assert.equal(sumarDias("2026-12-30", 3), "2027-01-02");
});
t("presupuestoDescubrimiento: lo que sobra después de los lotes y la reserva; 0 si no falta ningún tcgId", () => {
  assert.equal(presupuestoDescubrimiento({ reserva: 85, cartasConTcgId: 90, sinTcgId: 1200 }), 40);
  assert.equal(presupuestoDescubrimiento({ reserva: 85, cartasConTcgId: 1291, sinTcgId: 5 }), 12);
  assert.equal(presupuestoDescubrimiento({ reserva: 85, cartasConTcgId: 1291, sinTcgId: 0 }), 0);
  assert.equal(presupuestoDescubrimiento({ reserva: 60, cartasConTcgId: 1291, sinTcgId: 5 }), 0); // los lotes ya se comen el cupo
});
t("fusionarPending: alta nueva, parche de carpeta (solo campos permitidos), parche huérfano y alta repetida", () => {
  const inv = [carta("a", "A", "1", "S", "s", { carpeta: "MLP", costoUSD: 5 })];
  const f = fusionarPending(inv, [carta("n", "N", "2", "S", "s"), { id: "a", _patch: { carpeta: "Price Watch", costoUSD: 999 } }, { id: "zzz", _patch: { carpeta: "X" } }, carta("a", "A", "1", "S", "s")]);
  assert.equal(f.nuevas, 1); assert.equal(f.parcheadas, 1); assert.equal(f.inventario.length, 2);
  assert.equal(f.inventario[0].carpeta, "Price Watch"); assert.equal(f.inventario[0].costoUSD, 5); // costo no es parcheable
});
t("pendingRestante: conserva lo encolado durante la corrida y lo que cambió de contenido", () => {
  const e1 = carta("n", "N", "2", "S", "s"), fus = { n: JSON.stringify(e1) };
  assert.deepEqual(pendingRestante([e1], fus), []);
  assert.equal(pendingRestante([e1, carta("nuevo", "X", "3", "S", "s")], fus).length, 1);
  assert.equal(pendingRestante([{ ...e1, carpeta: "Price Watch" }], fus).length, 1); // el cliente la volvió a encolar con cambios
});
t("unirHistorial: une por fecha, gana el del bot en la misma fecha, ordena", () => {
  const h = unirHistorial([{ date: "2026-10-12", market: 9 }, { date: "2026-10-10", market: 1 }], [{ date: "2026-10-11", market: 2 }, { date: "2026-10-12", market: 3 }]);
  assert.deepEqual(h.map(x => [x.date, x.market]), [["2026-10-10", 1], ["2026-10-11", 2], ["2026-10-12", 3]]);
});
t("mergePreciosBot: no pierde snapshots locales y respeta un precio local más nuevo", () => {
  const local = [{ id: "a", tcgMarket: 5, tcgUpdated: "2026-10-13", priceHistory: [{ date: "2026-10-13", market: 5 }] }, { id: "b", tcgMarket: null, priceHistory: [] }];
  const remote = [{ id: "a", tcgMarket: 3, tcgUpdated: "2026-10-12", priceHistory: [{ date: "2026-10-12", market: 3 }] }, { id: "b", tcgMarket: null }];
  const m = mergePreciosBot(local, remote);
  assert.equal(m[0].tcgMarket, 5); assert.equal(m[0].priceHistory.length, 2); assert.equal(m[1].tcgMarket, null);
});
t("addSnapshot con fuente y fuenteCompatible", () => {
  assert.equal(addSnapshot([], 1, 0, 2, "2026-10-12", "tpl")[0].src, "tpl");
  assert.equal(addSnapshot([], 1, 0, 2, "2026-10-12")[0].src, undefined);
  assert.ok(fuenteCompatible({}, { src: "tpl" })); assert.ok(fuenteCompatible({ src: "tpl" }, { src: "tpl" })); assert.ok(!fuenteCompatible({ src: "tpl" }, { src: "ptcg" }));
});
t("cupoRestante: lee x-ratelimit-remaining y devuelve null si no hay cabeceras", () => {
  assert.equal(cupoRestante({ "x-ratelimit-remaining": "42" }), 42); assert.equal(cupoRestante({}), null); assert.equal(cupoRestante({ "x-ratelimit-reset": "9" }), null);
});
t("diagnosticarSet: resume la respuesta y explica el emparejamiento de las primeras cartas", () => {
  const d = diagnosticarSet({ set: "Alpha", cartas: [carta("1", "Foo", "1", "Alpha", "alp")] }, { ok: true, status: 200, cards: [r("a", "Foo", "1", "alp", "Alpha", "ALP")] });
  assert.equal(d.resultados, 1); assert.equal(d.cartas[0].emparejada, true); assert.equal(d.setsEnRespuesta.length, 1);
});
t("prioridadCarta: Price Watch primero", () => { assert.ok(prioridadCarta({ carpeta: "Price Watch" }) < prioridadCarta({ carpeta: "MLP" })); });
// refreshPrecio con soloTcg no toca pokemontcg.io (se prueba con un fetch falso que registra los hosts)
{
  const hosts = [], orig = globalThis.fetch;
  globalThis.fetch = async url => { hosts.push(new URL(url).hostname); return { ok: false, status: 404, headers: { get: () => null, forEach() {} }, json: async () => ({}), text: async () => "" }; };
  await refreshPrecio({ id: "x", cardId: "alp-1", name: "Foo", number: "1", set: "Alpha", setCode: "alp" }, "K", true, { soloTcg: true });
  const soloTcg = [...hosts]; hosts.length = 0;
  await refreshPrecio({ id: "x", cardId: "alp-1", name: "Foo", number: "1", set: "Alpha", setCode: "alp" }, "K", true, {});
  globalThis.fetch = orig;
  t("refreshPrecio soloTcg: no consulta pokemontcg.io; sin la opción sí (primer precio de una carta nueva)", () => {
    assert.ok(!soloTcg.includes("api.pokemontcg.io")); assert.ok(hosts.includes("api.pokemontcg.io"));
  });
}
// ── issue #27 ──
import { compactarHistorial } from "../modules/pokecripto/lib/pricing.mjs";
import { elegirVariante, slugParaSet, paginasDeSet } from "../modules/pokecripto/lib/discovery.mjs";
t("elegirVariante: Normal > Holofoil > la única que no es Reverse; ambiguo = null", () => {
  assert.equal(elegirVariante([{ tcgId: "r", variant: "Reverse Holofoil" }, { tcgId: "n", variant: "Normal" }]).tcgId, "n");
  assert.equal(elegirVariante([{ tcgId: "r", variant: "Reverse Holofoil" }, { tcgId: "h", variant: "Holofoil" }]).tcgId, "h");
  assert.equal(elegirVariante([{ tcgId: "r", variant: "Reverse Holofoil" }, { tcgId: "x", variant: "Poke Ball Pattern" }]).tcgId, "x");
  assert.equal(elegirVariante([{ tcgId: "a", variant: "Foo" }, { tcgId: "b", variant: "Bar" }]), null);
  assert.equal(elegirVariante([{ tcgId: "n1", variant: "Normal" }, { tcgId: "n2", variant: "Normal" }]), null);
  assert.equal(elegirVariante([]), null);
});
t("emparejarTcgId: filas de variantes de un solo set se resuelven aunque el nombre del set no coincida", () => {
  const carta = { id: "1", name: "AZ's Tranquility", number: "76", set: "Chaos Rising", setCode: "me4" };
  const res = [{ tcgId: "r", name: "AZ's Tranquility - 076/086", number: "076/086", variant: "Reverse Holofoil", setId: "S", setName: "ME04: Chaos Rising" }, { tcgId: "n", name: "AZ's Tranquility - 076/086", number: "076/086", variant: "Normal", setId: "S", setName: "ME04: Chaos Rising" }];
  assert.equal(emparejarTcgId(carta, res).tcgId, "n");
  const dosSets = [{ ...res[1], setId: "S" }, { ...res[1], tcgId: "otro", setId: "T", setName: "Otro" }];
  assert.equal(emparejarTcgId(carta, dosSets), null); // dos sets distintos y ninguno calza por nombre/código: no se adivina
});
t("asignarTcgIds: un tcgId ya tomado por otro cardId no se reasigna; mismo cardId sí comparte", () => {
  const res = [{ tcgId: "T", name: "Foo", number: "1", variant: "Normal" }];
  const tomados = new Map([["T", "a-1"]]);
  const a = asignarTcgIds([{ id: "x", cardId: "b-1", name: "Foo", number: "1" }], res, { setSeguro: true, tomados });
  assert.equal(a.size, 0);
  const b = asignarTcgIds([{ id: "y", cardId: "a-1", name: "Foo", number: "1" }], res, { setSeguro: true, tomados });
  assert.equal(b.get("y").tcgId, "T");
});
t("slugParaSet: quita el código de serie, no adivina si hay dos sets con el mismo nombre", () => {
  const sets = [{ name: "ME04: Chaos Rising", slug: "a" }, { name: "EX Delta Species", slug: "b" }, { name: "SV: Dup", slug: "c" }, { name: "SWSH: Dup", slug: "d" }];
  assert.equal(slugParaSet("Chaos Rising", sets).slug, "a"); assert.equal(slugParaSet("Delta Species", sets).slug, "b");
  assert.equal(slugParaSet("Dup", sets), null); assert.equal(slugParaSet("No existe", sets), null);
  assert.equal(paginasDeSet({ count: 284 }), 3); assert.equal(paginasDeSet({ count: 100 }), 1); assert.equal(paginasDeSet({}), 1);
});
t("compactarHistorial: mes viejo = 1 punto (promedio, low mín, high máx, n), idempotente, el último punto queda crudo", () => {
  const h = [
    { date: "2026-07-03", market: 1, low: 0.5, high: 2, src: "tpl" }, { date: "2026-07-20", market: 3, low: 0.4, high: 4, src: "tpl" },
    { date: "2026-08-10", market: 5, low: 4, high: 6, src: "tpl" }, { date: "2026-10-20", market: 7, low: 6, high: 9, src: "tpl" }, { date: "2026-10-25", market: 8, low: 7, high: 9, src: "tpl" },
  ];
  const c = compactarHistorial(h, "2026-10-26");
  assert.equal(c.length, 4);
  assert.deepEqual(c[0], { date: "2026-07-20", market: 2, low: 0.4, high: 4, n: 2, agg: true, src: "tpl" });
  assert.equal(c[1].agg, true); assert.equal(c[1].n, 1);
  assert.deepEqual(c.slice(2).map(x => x.date), ["2026-10-20", "2026-10-25"]);
  assert.deepEqual(compactarHistorial(c, "2026-10-26"), c);
  // el último punto, aunque tenga más de 30 días, no se agrega
  const viejo = compactarHistorial([{ date: "2026-05-01", market: 1 }, { date: "2026-05-20", market: 3 }], "2026-10-26");
  assert.equal(viejo.length, 2); assert.equal(viejo.at(-1).market, 3);
  // el mes sigue abierto en la frontera: lo que entra a la ventana se suma al mensual con su peso
  const a = compactarHistorial([{ date: "2026-10-20", market: 2, low: 1, high: 3 }, { date: "2026-10-27", market: 4, low: 2, high: 6 }, { date: "2026-11-30", market: 9, low: 9, high: 9 }], "2026-11-30");
  assert.equal(a.length, 2); assert.deepEqual(a[0], { date: "2026-10-27", market: 3, low: 1, high: 6, n: 2, agg: true });
  const b = compactarHistorial([...a, { date: "2026-12-05", market: 1, low: 1, high: 1 }, { date: "2026-12-30", market: 2, low: 2, high: 2 }], "2026-12-31");
  assert.equal(b.filter(x => x.agg).length, 2); assert.equal(b.find(x => x.date === "2026-11-30")?.n, 1); // nov (1 punto) y oct (n=2) quedan separados
});
console.log(`\n${n} pruebas en verde`);
