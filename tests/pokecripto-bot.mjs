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
const inv = [
  c("a1", "Foo", "1", "Alpha", "alp"), c("a2", "Bar", "2", "Alpha", "alp"), c("a3", "Baz", "3", "Alpha", "alp"),
  c("b120", "Card120", "120", "Beta", "bet"),
  c("g1", "Zzz", "1", "Gamma", "gam", { cardId: "gam-1", carpeta: "Price Watch" }),
  c("g9", "Distinto", "9", "Gamma", "gam", { tcgOverride: { name: "Weird Name ex", number: "009/050", setId: "gam", setCode: "GAM" } }),
  c("v1", "Vendida", "1", "Alpha", "alp", { estado: "vendida" }),
  c("old", "Foo", "1", "Alpha", "alp", { tcgId: "t-alp-1", tcgMarket: 1, tcgUpdated: "2026-09-01", priceHistory: [{ date: "2026-09-01", market: 1, low: null, high: null }] }),
];
writeFileSync(P("inv.json"), JSON.stringify(inv));
writeFileSync(P("pending.json"), JSON.stringify([c("nueva", "Card5", "5", "Beta", "bet"), { id: "a2", _patch: { carpeta: "Price Watch" } }]));
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
  assert.deepEqual(Object.keys(leer("merged.json")).sort(), ["a2", "nueva"]);
});
t("descubrimiento por set: asigna tcgId y trae el snapshot de una vez, con src tpl", () => {
  assert.equal(por.a1.tcgId, "t-alp-1"); assert.equal(por.a1.tcgMarket, 1.5);
  assert.equal(por.a1.priceHistory.at(-1).src, "tpl");
  assert.equal(por.a3.tcgId, "t-alp-3"); assert.equal(por.a3.tcgMarket, null); // la API la tiene pero sin precio
});
t("paginación: una carta del número 120 se encuentra en la página 2", () => {
  assert.equal(por.b120.tcgId, "t-bet-120"); assert.ok(log().some(l => l === "SEARCH q=Beta page=2"));
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
// 2ª corrida: ahora todo lo emparejado va por lote y el descubrimiento no repite los sets ya resueltos
writeFileSync(P("pending.json"), "[]"); writeFileSync(P("log.txt"), "");
const out2 = correr(); const res2 = Object.fromEntries(leer("inv.json").map(x => [x.id, x]));
t("2ª corrida: sin búsquedas por set repetidas de sets resueltos; todo lo emparejado va por lote", () => {
  const l = log();
  assert.ok(!l.some(x => x.startsWith("SEARCH q=Beta")) && !l.some(x => x.startsWith("SEARCH q=Alpha")));
  assert.ok(l.filter(x => x.startsWith("BATCH")).length >= 1);
  assert.equal(res2.a1.priceHistory.length, 1); // misma fecha: se reemplaza, no se duplica
});
console.log(`\n${n} pruebas en verde`);
