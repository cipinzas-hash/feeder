// Pruebas de la consulta por lote de tcgpricelookup.com (modules/pokecripto/lib/pricing.mjs) y del paso del
// tcgId de las designaciones a la carta. Correr: node tests/pokecripto-batch.mjs
import assert from "node:assert/strict";
import { fetchTCGBatch, precioDeApi, refreshPrecio } from "../modules/pokecripto/lib/pricing.mjs";
import { aplicarOverrides } from "../modules/pokecripto/lib/review.mjs";

let n = 0;
const t = async (nombre, fn) => { await fn(); n++; console.log("✓", nombre); };
const carta = (id, market) => ({ id, name: "X", set: { id: "s", name: "S", slug: "s" }, prices: market ? { raw: { near_mint: { tcgplayer: { market, low: market - 1, high: market + 1 } } } } : {} });
const resp = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: k => headers[k.toLowerCase()] ?? null, forEach: f => Object.entries(headers).forEach(([k, v]) => f(v, k)) }, json: async () => body, text: async () => JSON.stringify(body) });

await t("precioDeApi: Near Mint de TCGplayer, si no Lightly Played, si no nada", () => {
  assert.deepEqual(precioDeApi(carta("a", 5)), { market: 5, low: 4, high: 6 });
  assert.deepEqual(precioDeApi({ prices: { raw: { lightly_played: { tcgplayer: { market: 2 } } } } }), { market: 2, low: null, high: null });
  assert.equal(precioDeApi({ prices: { raw: { near_mint: { ebay: { market: 9 } } } } }), null);
  assert.equal(precioDeApi({}), null);
});
await t("fetchTCGBatch: arma ids=a,b,… (máx 20, sin repetidos), mapea por id y devuelve las cabeceras de cupo", async () => {
  let url = null;
  globalThis.fetch = async (u) => { url = decodeURIComponent(u); return resp(200, { data: [carta("a", 5), carta("b", 0)] }, { "x-ratelimit-remaining": "98" }); };
  const ids = Array.from({ length: 25 }, (_, i) => "id" + i).concat(["id0"]);
  ids[0] = "a"; ids[1] = "b";
  const r = await fetchTCGBatch(ids, "K");
  assert.ok(r.ok); assert.equal(r.pedidos, 20);
  assert.ok(url.includes("ids=a,b,id2,") && url.includes("&limit=20"));
  assert.equal(url.split("ids=")[1].split("&")[0].split(",").length, 20);
  assert.equal(r.porId.get("a").market, 5);
  assert.equal(r.porId.get("b").market, undefined); // existe pero sin precio
  assert.equal(r.rate["x-ratelimit-remaining"], "98");
});
await t("fetchTCGBatch: error de plan (403) devuelve ok:false con el detalle, sin lanzar", async () => {
  globalThis.fetch = async () => resp(403, { error: "plan" });
  const r = await fetchTCGBatch(["a"], "K");
  assert.equal(r.ok, false); assert.equal(r.status, 403); assert.ok(r.error.includes("403"));
});
await t("fetchTCGBatch: reintenta una vez tras un 429 y funciona", async () => {
  let llamadas = 0;
  globalThis.fetch = async () => (++llamadas === 1 ? resp(429, {}, { "retry-after": "0" }) : resp(200, { data: [carta("a", 3)] }));
  const r = await fetchTCGBatch(["a"], "K");
  assert.ok(r.ok); assert.equal(llamadas, 2); assert.equal(r.porId.get("a").market, 3);
});
await t("fetchTCGBatch: sin key, sin ids o con fallo de red no lanza", async () => {
  assert.equal((await fetchTCGBatch(["a"], null)).ok, false);
  assert.ok((await fetchTCGBatch([], "K")).ok);
  globalThis.fetch = async () => { throw new Error("sin red"); };
  const r = await fetchTCGBatch(["a"], "K"); assert.equal(r.ok, false); assert.equal(r.error, "sin red");
});
await t("aplicarOverrides pasa el tcgId a la carta y no pisa el existente si la designación no lo trae", () => {
  const inv = [{ id: "a", tcgId: "viejo" }, { id: "b" }, { id: "c", tcgId: "propio" }];
  const out = aplicarOverrides(inv, { a: { name: "A", number: "1", tcgId: "nuevo" }, b: { name: "B", number: "2", tcgId: "uuid-b" }, c: { name: "C", number: "3" } });
  assert.equal(out[0].tcgId, "nuevo"); assert.equal(out[1].tcgId, "uuid-b"); assert.equal(out[2].tcgId, "propio");
});
await t("refreshPrecio: usoTcg solo si hubo búsqueda real (no sin key, no si pokemontcg.io ya trajo precio)", async () => {
  globalThis.fetch = async (u) => String(u).includes("pokemontcg.io")
    ? resp(200, { data: { tcgplayer: { prices: { holofoil: { market: 3, low: 2, high: 4 } } } } })
    : resp(200, { data: [] });
  const a = await refreshPrecio({ cardId: "x-1", name: "A", number: "1" }, "K", true);
  assert.equal(a.usoTcg, false); assert.equal(a.market, 3);
  globalThis.fetch = async (u) => String(u).includes("pokemontcg.io") ? resp(404, {}) : resp(200, { data: [] });
  const b = await refreshPrecio({ cardId: "x-1", name: "A", number: "1" }, "K", true);
  assert.equal(b.usoTcg, true); assert.equal(b.market, null);       // falló, pero gastó cupo
  assert.equal((await refreshPrecio({ cardId: "x-1", name: "A", number: "1" }, null, true)).usoTcg, false); // sin key
  assert.equal((await refreshPrecio({ cardId: "x-1", name: "A", number: "1" }, "K", false)).usoTcg, false); // respaldo cortado
});
await t("refreshPrecio devuelve el tcgId de la carta que encontró el respaldo", async () => {
  globalThis.fetch = async (u) => String(u).includes("pokemontcg.io") ? resp(404, {})
    : resp(200, { data: [{ id: "uuid-9", name: "Pikachu", number: "027/094", set: { id: "me55", ptcgoCode: "ME55", name: "X" }, prices: { raw: { near_mint: { tcgplayer: { market: 1.5, low: 1, high: 2 } } } } }] });
  const r = await refreshPrecio({ cardId: "me55-27", name: "Pikachu", number: "27", set: "X", setCode: "me55" }, "K", true);
  assert.equal(r.market, 1.5); assert.equal(r.tcgId, "uuid-9"); assert.equal(r.fuente, "tcgpricelookup");
});
console.log(`\n${n} pruebas en verde`);
