// Prueba del builder del catálogo completo (pool) de tcgcrypto contra un servidor local que imita tcgcsv y YGOPRODeck.
// Correr: node tests/tcgcrypto-pool.mjs
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
let n = 0; const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const ext = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value }));
const prod = (productId, name, num, rar, extra = {}) => ({ productId, name, imageUrl: `https://cdn.test/product/${productId}_200w.jpg`, extendedData: ext({ Number: num, Rarity: rar, ...extra }) });
const precio = (productId, sub, market, low, high) => ({ productId, subTypeName: sub, marketPrice: market, lowPrice: low, highPrice: high });
const mock = {
  "/2/groups": { results: [{ groupId: 10, name: "Legend of Blue Eyes", publishedOn: "2002-03-08T00:00:00" }, { groupId: 11, name: "Ghosts From the Past", publishedOn: "2023-01-01T00:00:00" }] },
  "/2/10/products": { results: [prod(100, "Ash Blossom & Joyous Spring", "LOB-001", "Ultra Rare"), prod(101, "Dark Magician", "LOB-005", "Ultra Rare"), prod(102, "Zombie Master", "LOB-006", "Rare")] },
  "/2/10/prices": { results: [precio(100, "Unlimited", 90, 70, 120), precio(100, "1st Edition", 150, 110, 200), precio(101, "1st Edition", 400, 300, 500), precio(102, "Unlimited", 1.2, 0.5, 2)] },
  "/2/11/products": { results: [prod(200, "Ash Blossom & Joyous Spring (Secret Rare)", "GFP2-EN001", "Secret Rare"), prod(201, "Token", "TKN-1", "Common")] },
  "/2/11/prices": { results: [precio(200, "Unlimited", 4.5, 3, 6), precio(201, "Unlimited", 0.1, 0.05, 0.2)] },
  "/63/groups": { results: [{ groupId: 20, name: "Release Special Booster", publishedOn: "2021-01-01T00:00:00" }] },
  "/63/20/products": { results: [prod(300, "Agumon", "BT1-010", "Common", { Description: "[Main] Gain 1 memory." }), prod(301, "Numemon", "BT1-084", "Uncommon")] },
  "/63/20/prices": { results: [precio(300, "Normal", 0.3, 0.1, 0.9), precio(301, "Normal", 0.2, 0.1, 0.5)] },
  "/ygopro": { data: [
    { id: 14558127, name: "Ash Blossom & Joyous Spring", desc: "When a card or effect is activated that includes any of these effects.", type: "Tuner Monster", race: "Zombie", attribute: "FIRE", level: 3, atk: 0, def: 1800, card_sets: [{ set_code: "LOB-001" }, { set_code: "GFP2-EN001" }], card_images: [{ id: 14558127 }, { id: 14558128 }] },
    { id: 46986414, name: "Dark Magician", desc: "The ultimate wizard in terms of attack and defense.", type: "Normal Monster", race: "Spellcaster", attribute: "DARK", level: 7, atk: 2500, def: 2100, card_sets: [{ set_code: "LOB-005" }], card_images: [{ id: 46986414 }] },
    { id: 1, name: "Zombie Master", desc: "Discard 1 card: Special Summon 1 Zombie.", type: "Effect Monster", race: "Zombie", attribute: "DARK", level: 4, atk: 1800, def: 0, card_sets: [{ set_code: "LOB-006" }], card_images: [{ id: 1 }] },
  ] },
};
const srv = http.createServer((req, res) => { const u = new URL(req.url, "http://x").pathname; const b = mock[u]; if (!b) { res.statusCode = 404; return res.end("{}"); } res.setHeader("content-type", "application/json"); res.end(JSON.stringify(b)); });
await new Promise(r => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}`;
// asíncrono: el servidor de prueba vive en este mismo proceso y spawnSync lo congelaría
const correr = env => new Promise(res => { const dir = mkdtempSync(join(tmpdir(), "pool-")); const p = spawn("node", ["modules/feed/scripts/build-tcgcrypto.mjs"], { env: { ...process.env, TCGCSV_BASE: base, YGOPRO_URL: base + "/ygopro", DATA_DIR: dir, ...env } }); let err = ""; p.stderr.on("data", d => { err += d; }); p.on("close", status => res({ dir, r: { status, stderr: err } })); });
const { dir, r } = await correr({ POOL: "1" });
assert.equal(r.status, 0, r.stderr);
const leer = (f) => JSON.parse(readFileSync(join(dir, f), "utf-8"));
const pool = join(dir, "tcgcrypto-pool");
t("Dark ya no es colección; Zombie sí, y solo con lo que cumple el criterio", () => {
  const c = leer("tcgcrypto-yugioh.json");
  assert.deepEqual(c.colecciones.map(x => x.id), ["zombie", "eldlich"]);
  assert.ok(!c.cartas.some(x => x.k === "dark magician")); assert.ok(c.cartas.some(x => x.k === "zombie master"));
  assert.ok(c.cartas.every(x => !("x" in x) && !("i" in x)), "el catálogo de colecciones no carga texto ni pasaportes");
});
t("pool Yu-Gi-Oh!: TODAS las cartas (incluida la que no es de ninguna colección), fichas fuera, con sus versiones y el texto del efecto", () => {
  const idx = leer("tcgcrypto-pool/yugioh-index.json");
  assert.deepEqual(idx.n.map(x => x[0]).sort(), ["ash blossom joyous spring", "dark magician", "zombie master"]);
  const a = leer("tcgcrypto-pool/yugioh-a.json").cartas.find(x => x.k === "ash blossom joyous spring");
  assert.equal(a.v.length, 3); assert.ok(a.x.includes("activated")); assert.deepEqual(a.i, [14558127, 14558128]);
  assert.ok(a.v.some(v => v[3] === "GFP2-EN001" && v[4] === "Secret Rare" && v[5] === 4.5));      // la versión de otro set se une a la misma carta
  assert.ok(idx.setIds.includes(10) && idx.imgTpl.includes("{id}"));
});
t("pasaportes → carta (importar .ydk): todos los números de una carta, incluidos los de artes alternativos", () => {
  const cod = leer("tcgcrypto-pool/yugioh-codigos.json");
  assert.equal(cod["14558128"], "ash blossom joyous spring"); assert.equal(cod["46986414"], "dark magician");
});
t("pool Digimon: cada arte es su carta (clave = producto), con índice y archivo por letra", () => {
  const idx = leer("tcgcrypto-pool/digimon-index.json");
  assert.deepEqual(idx.n.map(x => x[1]).sort(), ["Agumon", "Numemon"]);
  assert.equal(leer("tcgcrypto-pool/digimon-a.json").cartas[0].x, "[Main] Gain 1 memory.");
  assert.deepEqual(leer("tcgcrypto-digimon.json").cartas.map(x => x.n), ["Numemon"]);               // la colección sigue siendo solo Numemon
});
t("el diagnóstico informa el peso del pool para decidir con datos reales", () => {
  const d = leer("tcgcrypto-diag.json"); assert.ok(d.juegos.yugioh.poolBytes > 0 && d.juegos.yugioh.poolCartas === 3 && d.juegos.yugioh.poolMayorArchivoKB >= 0);
});
{ const dia = new Date().getUTCDay(); if (dia !== 0) { const x = await correr({ POOL: "" }); t("fuera de domingo y sin POOL=1 solo se reescriben las colecciones", () => { assert.equal(x.r.status, 0); assert.ok(!existsSync(join(x.dir, "tcgcrypto-pool"))); }); } }
srv.close();
console.log(`${n} pruebas en verde`);
