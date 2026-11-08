// Issue #37 (8-nov-2026): sufijos de nombre, elección de variante y emparejado con número primero.
// Los casos salen de docs/diag-precios.json (sonda real contra tcgpricelookup).
import assert from "node:assert/strict";
import { normName, fetchTCGPriceDiag } from "../modules/pokecripto/lib/pricing.mjs";
import { elegirVariante, nombreSetCompatible } from "../modules/pokecripto/lib/variantes.mjs";
let n = 0;
const t = (nombre, fn) => { return Promise.resolve().then(fn).then(() => { n++; console.log("✓ " + nombre); }); };

await t("normName: sufijos reales de tcgpricelookup", () => {
  assert.equal(normName("M Rayquaza EX (105 Full Art)"), normName("M Rayquaza-EX"));
  assert.equal(normName("M Charizard EX (Y) (Secret)"), normName("M Charizard-EX"));
  assert.equal(normName("M Mewtwo EX (63)"), normName("M Mewtwo-EX"));
  assert.equal(normName("M Garchomp EX - XY168"), normName("M Garchomp-EX"));
  assert.equal(normName("Cinderace ex - 163"), normName("Cinderace ex"));
  assert.equal(normName("Mega Greninja ex - 100/086"), normName("Mega Greninja ex"));
  assert.equal(normName("Pikachu - 028/128"), "pikachu");
});
await t("normName: no funde impresiones distintas ni nombres con dígitos propios", () => {
  assert.notEqual(normName("Pikachu (Holo)"), normName("Pikachu"));
  assert.equal(normName("Porygon2"), "porygon2");
  assert.equal(normName("Unown - A"), "unowna");
});
await t("elegirVariante: descarta la Normal sin precio (Mega Greninja 100) y la Normal sin rareza (Pikachu 34)", () => {
  const r = elegirVariante([
    { tcgId: "n", variant: "Normal", rarity: "Ultra Rare", market: null },
    { tcgId: "h", variant: "Holofoil", rarity: "Ultra Rare", market: 7.63 }]);
  assert.equal(r.tcgId, "h");
  const p = elegirVariante([
    { tcgId: "n", variant: "Normal", rarity: null, market: 148 },
    { tcgId: "h", variant: "Holofoil", rarity: "Pikachu Rare", market: 0.87 }]);
  assert.equal(p.tcgId, "h");
});
await t("elegirVariante: sin precio ni rareza en ninguna fila, sigue Normal > Holofoil", () => {
  assert.equal(elegirVariante([{ tcgId: "h", variant: "Holofoil" }, { tcgId: "n", variant: "Normal" }]).tcgId, "n");
});
await t("nombreSetCompatible: prefijos de serie distintos en cada API", () => {
  assert.ok(nombreSetCompatible("Flashfire", "XY - Flashfire"));
  assert.ok(nombreSetCompatible("Chaos Rising", "ME04: Chaos Rising"));
  assert.ok(nombreSetCompatible("30th Celebration", "ME: 30th Celebration"));
  assert.ok(!nombreSetCompatible("Flashfire", "XY - Phantom Forces"));
});

// fetch simulado con filas tal como las devolvió la sonda
const fila = (id, name, number, setId, setName, variant, rarity, market) => ({
  id, name, number, variant, rarity, set: { id: setId, name: setName, ptcgoCode: null },
  prices: market == null ? {} : { raw: { near_mint: { tcgplayer: { market, low: market * 0.8, high: market * 1.2 } } } } });
function conFetch(filas, fn) {
  const orig = globalThis.fetch; let ultimaUrl = null;
  globalThis.fetch = async (u) => { ultimaUrl = String(u); return { ok: true, status: 200, headers: new Headers(), json: async () => ({ data: filas }) }; };
  return fn(() => ultimaUrl).finally(() => { globalThis.fetch = orig; });
}
await t("diag: M Charizard-EX 13 de Flashfire NO toma el precio de otro set (13/108)", () => conFetch([
  fila("evo", "M Charizard EX", "13/108", "uuid-evo", "XY - Evolutions", "Holofoil", "Rare Holo EX", 39.38),
  fila("flf", "M Charizard EX (Y)", "13/106", "uuid-flf", "XY - Flashfire", "Holofoil", "Rare Holo EX", 70.7)], async () => {
  const r = await fetchTCGPriceDiag("M Charizard-EX", "Flashfire", "13", "xy2", "k");
  assert.equal(r.matchEncontrado, true); assert.equal(r.tcgId, "flf"); assert.equal(r.market, 70.7);
}));
await t("diag: M Mewtwo-EX 63 empareja '(63)' del set correcto, no la fila de otro set sin precio", () => conFetch([
  fila("otro", "M Mewtwo EX - 63/162", "063/162", "uuid-otro", "Otro set", "Normal", null, null),
  fila("bkt", "M Mewtwo EX (63)", "63/162", "uuid-bkt", "XY - BREAKthrough", "Holofoil", "Rare Holo EX", 42.85)], async () => {
  const r = await fetchTCGPriceDiag("M Mewtwo-EX", "BREAKthrough", "63", "xy8", "k");
  assert.equal(r.tcgId, "bkt"); assert.equal(r.market, 42.85);
}));
await t("diag: Pikachu 28 de 30th Celebration elige la Holofoil con rareza, no la Normal fantasma de 49.95", () => conFetch([
  fila("n", "Pikachu - 028/128", "028/128", "uuid-p", "ME: 30th Celebration", "Normal", null, 49.95),
  fila("h", "Pikachu", "028/128", "uuid-p", "ME: 30th Celebration", "Holofoil", "Pikachu Rare", 0.9)], async () => {
  const r = await fetchTCGPriceDiag("Pikachu", "30th Celebration", "28", "me55", "k");
  assert.equal(r.tcgId, "h"); assert.equal(r.market, 0.9);
}));
await t("diag: con slug la búsqueda va acotada al set y candidatos salen con el número primero", () => conFetch([
  fila("a", "Pikachu", "054/214", "u1", "Otro", "Holofoil", "Rare", 2),
  fila("b", "Pikachu", "036/128", "u2", "ME: 30th Celebration", "Holofoil", "Pikachu Rare", 0.6)], async (url) => {
  const r = await fetchTCGPriceDiag("Pikachu", "30th Celebration", "36", "me55", "k", { slug: "pokemon--me-30th-celebration" });
  assert.match(url(), /set=pokemon--me-30th-celebration&q=Pikachu&/);
  assert.equal(r.candidatos[0].number, "036/128"); assert.equal(r.tcgId, "b");
}));
await t("diag: varias cartas de sets distintos y ninguna coincide por set -> no se adivina", () => conFetch([
  fila("a", "Pikachu", "25", "u1", "Set A", "Holofoil", "Rare", 3), fila("b", "Pikachu", "25", "u2", "Set B", "Holofoil", "Rare", 9)], async () => {
  const r = await fetchTCGPriceDiag("Pikachu", "Set Raro", "25", "raro", "k");
  assert.equal(r.matchEncontrado, false);
}));
console.log(`\n${n} pruebas en verde`);
