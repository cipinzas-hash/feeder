// tests/melee-orden.mjs — orden del Top 8 por eliminaciones y emparejamiento de videos
// (caso real: Platfight 2026, nov-2026). Sin red: fetch simulado. Correr: node tests/melee-orden.mjs
process.env.YOUTUBE_API_KEY = "test-key";
import assert from "node:assert/strict";
const M = await import("../modules/feed/scripts/build-melee.mjs");

let ok = 0;
const t = (nombre, fn) => Promise.resolve().then(fn).then(() => { ok++; console.log("  ✓", nombre); }, e => { console.error("  ✗", nombre, "\n   ", e.message); process.exitCode = 1; });

// Sets sintéticos con la forma de start.gg que consume buildTop8Ordered.
const jug = (id, name) => ({ id, name, initialSeedNum: id });
let sid = 109142000;
const set = (ronda, a, b, fase = 1, id = ++sid) => ({ id, fullRoundText: ronda, winnerId: a, slots: [{ entrant: jug(a, "P" + a) }, { entrant: jug(b, "P" + b) }], games: [], phaseGroup: { phase: { id: fase } } });

console.log("Orden del Top 8 por eliminaciones");
// Un Top 8 como Platfight: ronda de los 7º ("Losers Round 3", 2 sets), WSF, LQF (5º), WF, LSF (4º), LF (3º), GF, reset.
// `sets` viene RECENT-first en start.gg: se entrega al revés a propósito.
const bracket = [
  set("Losers Round 1", 1, 2), set("Losers Round 1", 3, 4), set("Losers Round 1", 5, 6), set("Losers Round 1", 7, 8), // ronda de más atrás: >2 sets
  set("Losers Round 3", 1, 2), set("Losers Round 3", 3, 4),
  set("Winners Semi-Final", 5, 6), set("Winners Semi-Final", 7, 8),
  set("Losers Quarter-Final", 1, 8), set("Losers Quarter-Final", 3, 6),
  set("Winners Final", 5, 7), set("Losers Semi-Final", 1, 3), set("Losers Final", 7, 1), set("Grand Final", 5, 7), set("Grand Final Reset", 5, 7),
].reverse();
const orden = M.buildTop8Ordered(bracket, 1).map(m => m.ronda);
await t("secuencia completa: 7º → WSF → LQF(5º) → WF → LSF(4º) → LF(3º) → GF → reset", () => {
  assert.deepEqual(orden, ["Losers Round 3", "Losers Round 3", "Winners Semi-Final", "Winners Semi-Final", "Losers Quarter-Final", "Losers Quarter-Final", "Winners Final", "Losers Semi-Final", "Losers Final", "Grand Final", "Grand Final Reset"]);
});
await t("la ronda de más atrás (Losers Round 1, 4 sets) NO entra al Top 8", () => assert.ok(!orden.includes("Losers Round 1")));
await t("los 2 sets de una misma ronda salen en orden de bracket (id ascendente), no RECENT-first", () => {
  const ids = M.buildTop8Ordered(bracket, 1).filter(m => m.ronda === "Winners Semi-Final").map(m => m.setId);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
});
await t("regla de Cristopher: en cada etapa el set de losers va antes que el de winners", () => {
  const rk = r => orden.indexOf(r);
  assert.ok(rk("Losers Round 3") < rk("Winners Semi-Final"), "7º antes que WSF");
  assert.ok(rk("Losers Quarter-Final") < rk("Winners Final"), "LQF (5º) antes que WF");
  assert.ok(rk("Losers Final") < rk("Grand Final") && rk("Losers Semi-Final") < rk("Losers Final"));
});
await t("Winners Quarter va antes que la ronda de los 7º (la ronda de los 7º depende de ella)", () => {
  const con = M.buildTop8Ordered([set("Losers Round 1", 1, 2), set("Losers Round 1", 3, 4), set("Winners Quarter-Final", 5, 6), set("Losers Quarter-Final", 1, 3)], 1).map(m => m.ronda);
  assert.deepEqual(con, ["Winners Quarter-Final", "Losers Round 1", "Losers Round 1", "Losers Quarter-Final"]);
});
await t("sin Losers Quarter no se adivina cuál es la ronda de los 7º", () => assert.equal(M.ronda7mos([set("Losers Round 2", 1, 2), set("Winners Final", 3, 4)], 1), null));
await t("la fase se respeta: rondas de otra fase no cuentan", () => assert.equal(M.buildTop8Ordered([set("Winners Final", 1, 2, 2)], 1).length, 0));

console.log("Caché de videos y emparejamiento");
await t("misma pareja en rondas distintas = claves distintas (WF vs GF, rematch WSF vs LF)", () => {
  assert.notEqual(M.clipCacheKey("RapMonster", "Soonsay", "Winners Final"), M.clipCacheKey("RapMonster", "Soonsay", "Grand Final"));
  assert.notEqual(M.clipCacheKey("Soonsay", "Salt", "Winners Semi-Final"), M.clipCacheKey("Soonsay", "Salt", "Losers Final"));
});
await t("el mismo set en dos secciones (top8 y upsets) comparte clave: se busca una sola vez", () =>
  assert.equal(M.clipCacheKey("A", "B", "Grand Final"), M.clipCacheKey("A", "B", "Grand Final")));

const titulos = {
  v1: "Soonsay (Fox) vs Rapmonster (Luigi) - Winners Finals - Platfight 2026",
  v2: "Soonsay (Fox) vs Rapmonster (Luigi) - Grand Finals - Platfight 2026",
  v3: "Magi destroys everyone | Melee highlights",
};
function simularYouTube(ids) {
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.includes("/search?")) return { json: async () => ({ items: ids.map(id => ({ id: { videoId: id }, snippet: { title: titulos[id] } })) }) };
    return { json: async () => ({ items: ids.map(id => ({ id, snippet: { title: titulos[id] }, contentDetails: { duration: "PT22M" } })) }) };
  };
}
await t("con el rótulo GRAND FINALS gana el video de la Grand Final, no el de Winners Final", async () => {
  simularYouTube(["v1", "v2"]);
  const b = await M.pickBestMatchClip([{ id: { videoId: "v1" } }, { id: { videoId: "v2" } }], "Soonsay", "Rapmonster", "GRAND FINALS");
  assert.equal(b.videoId, "v2"); assert.equal(b.ambos, true);
});
await t("un video ya asignado a otro set se excluye (no se repite entre dos sets)", async () => {
  simularYouTube(["v1", "v2"]);
  const b = await M.pickBestMatchClip([{ id: { videoId: "v1" } }, { id: { videoId: "v2" } }], "Soonsay", "Rapmonster", "GRAND FINALS", new Set(["v2"]));
  assert.notEqual(b.videoId, "v2");
});
await t("un título con UN solo nombre se rechaza (antes bastaba y se colaba otro set del jugador)", async () => {
  simularYouTube(["v3"]);
  titulos.v3 = "Soonsay wins big | Platfight 2026 highlights"; // un solo nombre
  const r = await M.findMatchClip("Platfight 2026", "Soonsay", "Rapmonster", null);
  assert.equal(r, null);
});
await t("un título con los dos nombres se acepta", async () => {
  simularYouTube(["v2"]);
  const r = await M.findMatchClip("Platfight 2026", "Soonsay", "Rapmonster", "GRAND FINALS");
  assert.deepEqual(r, { videoId: "v2", startSeconds: 0 });
});
console.log(`\n${process.exitCode ? "FALLÓ" : "OK"}: ${ok} pruebas pasaron`);
