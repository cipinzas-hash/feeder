// Worker angst-sync: endpoints /igdb/search y /igdb/game (21-nov-2026). Simula Twitch e IGDB con un fetch falso.
import assert from "node:assert/strict";

const llamadas = { twitch: 0, igdb: [] };
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith("https://id.twitch.tv/oauth2/token")) {
    llamadas.twitch++;
    assert(u.includes("client_id=CID") && u.includes("client_secret=SEC") && u.includes("grant_type=client_credentials"));
    return new Response(JSON.stringify({ access_token: "TOK", expires_in: 3600 }), { status: 200 });
  }
  if (u === "https://api.igdb.com/v4/games") {
    assert.equal(opts.headers["Client-ID"], "CID"); assert.equal(opts.headers.Authorization, "Bearer TOK");
    llamadas.igdb.push({ cuando: Date.now(), cuerpo: opts.body });
    if (/where id = 404;/.test(opts.body)) return new Response("[]", { status: 200 });
    return new Response(JSON.stringify([
      { id: 2, name: "Celeste (Edición)", version_parent: 1, first_release_date: Date.UTC(2020, 0, 1) / 1000 },
      { id: 1, name: "Celeste", first_release_date: Date.UTC(2018, 0, 25) / 1000, cover: { image_id: "co3byy" }, platforms: [{ abbreviation: "PC" }, { abbreviation: "Switch" }], genres: [{ name: "Platform" }], summary: "  Sube  la montaña.  " },
    ]), { status: 200 });
  }
  throw new Error("fetch inesperado: " + u);
};

const W = (await import("../cloudflare-worker/angst-sync.js")).default;
const ENV = { AUTH_SECRET: "s3", GITHUB_PAT: "x", IGDB_CLIENT_ID: "CID", IGDB_CLIENT_SECRET: "SEC" };
const pedir = (ruta, env = ENV, auth = "s3") => W.fetch(new Request("https://w.example" + ruta, { headers: auth ? { "X-Angst-Auth": auth } : {} }), env);

assert.equal((await pedir("/igdb/search?q=celeste", ENV, null)).status, 401, "sin auth: 401");
assert.equal((await pedir("/igdb/search?q=celeste", ENV, "mal")).status, 401);
assert.equal((await pedir("/igdb/search?q=celeste", { AUTH_SECRET: "s3" })).status, 501, "sin credenciales de IGDB: 501");
const r = await pedir("/igdb/search?q=celeste");
assert.equal(r.status, 200); assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*", "CORS");
const lista = await r.json();
assert.deepEqual(lista.map(x => x.igdbId), [1, 2], "los juegos base primero, las versiones después");
assert.deepEqual(lista[0], { igdbId: 1, nombre: "Celeste", anio: 2018, lanzamiento: "2018-01-25", portada: "co3byy", plataformas: ["PC", "Switch"], generos: ["Platform"], resumen: "Sube la montaña." });
assert(!("_version" in lista[0]), "sin campos internos");
assert.deepEqual(await (await pedir("/igdb/search?q=a")).json(), [], "menos de 2 letras: vacío, sin consultar");
await pedir('/igdb/search?q=' + encodeURIComponent('ce"leste\\'));
assert(!/"ce"/.test(llamadas.igdb.at(-1).cuerpo) && /search "ce leste"/.test(llamadas.igdb.at(-1).cuerpo), "comillas y barras fuera de la consulta");
assert.equal(llamadas.twitch, 1, "el token de Twitch se pide una vez y se reutiliza");
assert.equal((await pedir("/igdb/game?id=1")).status, 200);
assert.equal((await pedir("/igdb/game?id=abc")).status, 400); assert.equal((await pedir("/igdb/game?id=-3")).status, 400);
assert.deepEqual(await (await pedir("/igdb/game?id=404")).json(), { found: false });
const ts = llamadas.igdb.map(x => x.cuando);
assert(ts.every((t, i) => i === 0 || t - ts[i - 1] >= 250), "cola: pedidos separados ≥ 250 ms (límite de 4 por segundo)");
assert.equal((await W.fetch(new Request("https://w.example/igdb/search?q=celeste", { method: "OPTIONS" }), ENV)).status, 204, "preflight CORS");
console.log("OK gameenhanced-worker: IGDB vía Worker (auth, 501, CORS, cola, token, saneado)");
