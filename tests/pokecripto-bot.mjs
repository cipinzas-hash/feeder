// Prueba de integración del bot con una API falsa (tests/helpers/mock-api.mjs). Correr: node tests/pokecripto-bot.mjs
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const dir = mkdtempSync(join(tmpdir(), "pokebot-"));
const P = f => join(dir, f);
const c = (id, name, number, set, setCode, extra = {}) => ({ id, cardId: setCode + "-" + number, name, number, set, setCode, estado: "hunting", carpeta: "MLP", priceHistory: [], tcgMarket: null, tcgUpdated: null, ...extra });
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const inv = [
  c("a1", "Foo", "1", "Alpha", "alp"), c("a2", "Bar", "2", "Alpha", "alp"), c("a3", "Baz", "3", "Alpha", "alp"),
  c("b120", "Card120", "120", "Beta", "bet"),
  c("g1", "Zzz", "1", "Gamma", "gam", { cardId: "gam-1", carpeta: "Price Watch" }),
  c("g9", "Distinto", "9", "Gamma", "gam", { tcgOverride: { name: "Weird Name ex", number: "009/050", setId: "gam", setCode: "GAM" } }),
  c("v1", "Vendida", "1", "Alpha", "alp", { estado: "vendida" }),
  c("var1", "Var", "7", "Alpha", "alp"),
  c("a1b", "Foo", "1", "Alpha", "alp", { carpeta: "Cambio" }),   // misma carta (cardId) en otra colección
  c("gu1", "Guard", "1", "Alpha", "alp", { cardId: "alp-g1", tcgId: "t-guard", tcgMarket: 5, tcgUpdated: "2026-09-01" }),
  c("gu2", "Guard", "1", "Alpha", "alp", { cardId: "otra-g1" }),   // otra carta que calzaría con el mismo tcgId: la guarda lo impide
  c("adios", "Adios", "1", "Alpha", "alp"),
  c("hist", "Hist", "1", "Alpha", "alp", { tcgId: "t-hist", tcgMarket: 8, tcgUpdated: dia(-60), priceHistory: [
    { date: dia(-90), market: 1, low: 0.5, high: 2, src: "tpl" }, { date: dia(-80), market: 3, low: 0.4, high: 4, src: "tpl" },
    { date: dia(-60), market: 2, low: 1, high: 3, src: "tpl" }] }),
  c("old", "Foo", "1", "Alpha", "alp", { tcgId: "t-alp-1", tcgMarket: 1, tcgUpdated: "2026-09-01", priceHistory: [{ date: "2026-09-01", market: 1, low: null, high: null }] }),
];
writeFileSync(P("inv.json"), JSON.stringify(inv));
writeFileSync(P("pending.json"), JSON.stringify([c("nueva", "Card5", "5", "Beta", "bet"), { id: "a2", _patch: { carpeta: "Price Watch" } }, { id: "adios", _baja: true }]));
writeFileSync(P("ov.json"), JSON.stringify({}));

function correr() {
  const r = spawnSync("node", ["--import", "./tests/helpers/mock-api.mjs", "modules/feed/scripts/build-pokecripto.mjs"], {
    cwd: process.cwd(), encoding: "utf-8",
    env: { ...process.env, TCG_API_KEY: "K", POKECRIPTO_INVENTARIO_PATH: P("inv.json"), POKECRIPTO_PENDING_PATH: P("pending.json"),
      POKECRIPTO_OVERRIDES_PATH: P("ov.json"), POKECRIPTO_ESTADO_PATH: P("estado.json"), POKECRIPTO_MERGED_PATH: P("merged.json"),
      POKECRIPTO_DESCUBRIMIENTO_TOPE: "40", POKECRIPTO_THROTTLE_MS: "0", POKECRIPTO_PAUSA_MS: "0", MOCK_LOG: P("log.txt") },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout;
}
const leer = f => JSON.parse(readFileSync(P(f), "utf-8"));
const log = () => existsSync(P("log.txt")) ? readFileSync(P("log.txt"), "utf-8").trim().split("\n") : [];

const out = correr();
const res = leer("inv.json"), por = Object.fromEntries(res.map(x => [x.id, x]));
t("fusiona pending: carta nueva entra y el parche mueve a2 a Price Watch", () => {
  assert.ok(por.nueva); assert.equal(por.a2.carpeta, "Price Watch");
  assert.deepEqual(Object.keys(leer("merged.json")).sort(), ["a2", "adios", "nueva"]);
});
t("descubrimiento por set: asigna tcgId y trae el snapshot de una vez, con src tpl", () => {
  assert.equal(por.a1.tcgId, "t-alp-1"); assert.equal(por.a1.tcgMarket, 1.5);
  assert.equal(por.a1.priceHistory.at(-1).src, "tpl");
  assert.equal(por.a3.tcgId, "t-alp-3"); assert.equal(por.a3.tcgMarket, null); // la API la tiene pero sin precio
});
t("paginación: una carta del número 120 se encuentra en la página 2", () => {
  assert.equal(por.b120.tcgId, "t-bet-120"); assert.ok(log().some(l => l === "SETCARDS slug=pokemon--bet offset=100"));
  assert.equal(por.nueva.tcgId, "t-bet-5");
});
t("override: se empareja por la designación manual aunque el nombre difiera", () => {
  assert.equal(por.g9.tcgId, "t-ov-9"); assert.equal(por.g9.tcgMarket, 7);
});
t("lotes: la carta que ya tenía tcgId se actualiza por lote (20 por consulta) y suma snapshot a su historial", () => {
  assert.ok(log().some(l => /^BATCH \d+$/.test(l))); assert.equal(por.old.tcgUpdated, new Date().toISOString().slice(0, 10));
  assert.equal(por.old.priceHistory.length, 2); assert.equal(por.old.priceHistory[0].market, 1);
});
t("una sola fuente: el bot nunca consulta pokemontcg.io; lo que tcgpricelookup no tiene queda sin tocar y pasa al final de la cola", () => {
  assert.ok(!log().some(l => l.startsWith("PTCG")));
  assert.equal(por.g1.tcgMarket, null); assert.equal(por.g1.tcgIntento, new Date().toISOString().slice(0, 10));
  for (const x of res) for (const h of x.priceHistory) if (h.date === new Date().toISOString().slice(0, 10)) assert.equal(h.src, "tpl");
});
t("la vendida no se toca y no gasta consultas", () => { assert.equal(por.v1.tcgMarket, null); });
t("resumen de corrida en pokecripto-estado.json", () => {
  const e = leer("estado.json");
  assert.ok(e.ultimaCorrida.descubrimiento.tcgIdNuevos >= 6); assert.ok(e.ultimaCorrida.consultasTcg > 0);
  assert.ok(e.sets && Object.keys(e.sets).length >= 2);
});
t("baja: la carta con _baja desaparece del canónico y queda registrada como fusionada", () => { assert.ok(!por.adios); });
t("variantes: la carta toma la impresión Normal aunque la Reverse venga primero", () => { assert.equal(por.var1.tcgId, "t-alp-7n"); });
t("misma carta en dos colecciones (mismo cardId) comparte tcgId", () => { assert.equal(por.a1b.tcgId, por.a1.tcgId); assert.equal(por.a1b.tcgId, "t-alp-1"); });
t("guarda: un tcgId que ya tiene otra carta (otro cardId) no se asigna a una distinta", () => { assert.equal(por.gu1.tcgId, "t-guard"); assert.ok(!por.gu2.tcgId); });
t("compactación: lo viejo queda en un punto por mes (promedio, low mínimo, high máximo) y el último punto se conserva", () => {
  const h = por.hist.priceHistory, agg = h.filter(x => x.agg);
  assert.ok(agg.length >= 1 && h.length < 4);
  const total = agg.reduce((a, x) => a + x.n, 0); assert.equal(total, 3);
  const meses = new Set([dia(-90).slice(0, 7), dia(-80).slice(0, 7), dia(-60).slice(0, 7)]);
  if (meses.size === 1) { const x = agg[0]; assert.equal(x.market, 2); assert.equal(x.low, 0.4); assert.equal(x.high, 4); }
  assert.equal(h.at(-1).date, new Date().toISOString().slice(0, 10)); assert.equal(h.at(-1).market, 8);
});
// 2ª corrida: ahora todo lo emparejado va por lote y el descubrimiento no repite los sets ya resueltos
writeFileSync(P("pending.json"), "[]"); writeFileSync(P("log.txt"), "");
const out2 = correr(); const res2 = Object.fromEntries(leer("inv.json").map(x => [x.id, x]));
t("2ª corrida: sin búsquedas por set repetidas de sets resueltos; todo lo emparejado va por lote", () => {
  const l = log();
  assert.ok(!l.some(x => x.startsWith("SETCARDS slug=pokemon--bet")) && !l.some(x => x.startsWith("SETCARDS slug=pokemon--alp")));
  assert.ok(!l.some(x => x.startsWith("SETS")), "la lista de sets se reutiliza (cache de 7 días)");
  assert.ok(l.filter(x => x.startsWith("BATCH")).length >= 1);
  assert.equal(res2.a1.priceHistory.length, 1); // misma fecha: se reemplaza, no se duplica
  const unicos = new Set(Object.values(res2).filter(x => x.estado !== "vendida" && x.tcgId).map(x => x.tcgId)).size;
  const enLotes = l.filter(x => x.startsWith("BATCH")).reduce((a, x) => a + parseInt(x.split(" ")[1], 10), 0);
  assert.equal(enLotes, unicos, "los lotes piden cada tcgId una sola vez, aunque la carta esté en varias colecciones");
  assert.equal(res2.hist.priceHistory.filter(x => x.agg).reduce((a, x) => a + x.n, 0), 3); // idempotente: no se vuelve a compactar
});
console.log(`\n${n} pruebas en verde`);
