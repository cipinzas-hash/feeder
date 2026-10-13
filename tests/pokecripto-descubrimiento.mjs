// Pruebas de la lógica pura de descubrimiento y de la cola pending. Correr: node tests/pokecripto-descubrimiento.mjs
import assert from "node:assert/strict";
import { cupoRestante, diagnosticarSet, emparejarTcgId, asignarTcgIds, agruparPorSet, paginasNecesarias, debeSaltarse, actualizarEstadoSet, presupuestoDescubrimiento, sumarDias } from "../modules/pokecripto/lib/discovery.mjs";
import { fusionarPending, pendingRestante, unirHistorial, mergePreciosBot, prioridadCarta } from "../modules/pokecripto/lib/review.mjs";
import { addSnapshot, fuenteCompatible } from "../modules/pokecripto/lib/pricing.mjs";

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
console.log(`\n${n} pruebas en verde`);
