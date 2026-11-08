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
// Recoge las URLs que se piden a YouTube para inspeccionar la consulta (q, channelId, fechas).
function espiarYouTube(ids, titulosPorId = titulos) {
  const urls = [];
  globalThis.fetch = async url => {
    const u = String(url); urls.push(u);
    if (u.includes("/search?")) return { json: async () => ({ items: ids.map(id => ({ id: { videoId: id }, snippet: { title: titulosPorId[id] } })) }) };
    return { json: async () => ({ items: ids.map(id => ({ id, snippet: { title: titulosPorId[id] }, contentDetails: { duration: "PT22M" } })) }) };
  };
  return urls;
}
const param = (url, k) => new URL(url).searchParams.get(k);

await t("un título con UN solo nombre se rechaza (antes bastaba y se colaba otro set del jugador)", async () => {
  espiarYouTube(["v3"], { v3: "Soonsay wins big | GX4 highlights" });
  assert.equal(await M.findMatchClip("GENESIS X4", "Soonsay", "Rapmonster", null), null);
});
await t("un título con los dos nombres se acepta", async () => {
  espiarYouTube(["v2"]);
  assert.deepEqual(await M.findMatchClip("GENESIS X4", "Soonsay", "Rapmonster", "GRAND FINALS"), { videoId: "v2", startSeconds: 0 });
});

console.log("Canales de producción (solo majors, sin búsqueda libre)");
const VGBC = "UCj1J3QuIftjOq9iv_rr7Egw";
await t("VGBootCamp transmite CEO, Supernova, Riptide y GOML aunque no los organice", () => {
  for (const n of ["CEO 2027", "Supernova 2027", "Riptide 2027", "GOML 2027", "Get On My Level 2027"]) assert.equal(M.productionChannelFor(n)?.channelId, VGBC, n);
});
await t("Genesis, Port Priority y Battle of BC tienen su propio canal (IDs verificados en Actions)", () => {
  assert.equal(M.productionChannelFor("GENESIS X4")?.channelId, "UC7boel3KeF8CfIoe0j1WHqA");
  assert.equal(M.productionChannelFor("Port Priority: DX")?.channelId, "UCqB7d-vcBxxlccHB3oMk6ew");
  assert.equal(M.productionChannelFor("Battle of BC 9")?.channelId, "UCG-pxOMgCQ3AtsxVPWk3XuQ");
});
await t("lo que no es un major mapeado no tiene canal (Platfight, Taking Back Tampa, Tipped Off): no se archiva", () => {
  for (const n of ["Platfight 2026", "Taking Back Tampa", "Tipped Off 18", "", undefined]) assert.equal(M.productionChannelFor(n), null, String(n));
});
await t("torneo sin canal mapeado: NO se consulta YouTube (cero requests) y no hay clip", async () => {
  const urls = espiarYouTube(["v2"]);
  assert.equal(await M.findMatchClip("Platfight 2026", "Soonsay", "Rapmonster", "GRAND FINALS"), null);
  assert.equal(urls.length, 0);
});
await t("torneo mapeado: la búsqueda va restringida al canal y NO se reintenta en todo YouTube si viene vacía", async () => {
  const urls = espiarYouTube([]);
  assert.equal(await M.findMatchClip("GENESIS X4", "Soonsay", "Rapmonster", "GRAND FINALS", new Set(), 1802000000), null);
  assert.equal(urls.length, 1, "una sola búsqueda, sin segundo intento sin canal");
  assert.equal(param(urls[0], "channelId"), "UC7boel3KeF8CfIoe0j1WHqA");
});
await t("ventana de fechas: solo videos publicados desde el día antes del evento hasta 75 días después", async () => {
  const urls = espiarYouTube([]);
  await M.findMatchClip("GENESIS X4", "A", "B", null, new Set(), 1802000000);
  assert.equal(param(urls[0], "publishedAfter"), "2027-02-06T11:33:20Z");
  assert.equal(param(urls[0], "publishedBefore"), "2027-04-23T11:33:20Z");
  assert.equal(M.ventanaPublicacion(null), null);
});
await t("estilo vgbc: la consulta imita el título (TORNEO ETIQUETA Ganador vs Perdedor), también TOP 8", async () => {
  const urls = espiarYouTube([]);
  await M.findMatchClip("CEO 2027", "Zain", "Cody", "TOP 8", new Set(), 1802000000);
  assert.equal(param(urls[0], "q"), "CEO 2027 TOP 8 Zain vs Cody");
  assert.equal(param(urls[0], "channelId"), VGBC);
});
await t("estilo generic: solo nombres; 'TOP 8' no existe en esos títulos pero GRAND FINALS sí desempata", async () => {
  let urls = espiarYouTube([]);
  await M.findMatchClip("GENESIS X4", "Zain", "Cody", "TOP 8", new Set(), 1802000000);
  assert.equal(param(urls[0], "q"), "Zain vs Cody");
  urls = espiarYouTube([]);
  await M.findMatchClip("GENESIS X4", "Zain", "Cody", "GRAND FINALS", new Set(), 1802000000);
  assert.equal(param(urls[0], "q"), "Zain vs Cody GRAND FINALS");
});
console.log(`\n${process.exitCode ? "FALLÓ" : "OK"}: ${ok} pruebas pasaron`);
