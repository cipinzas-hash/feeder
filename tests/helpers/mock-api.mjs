// Precarga para pruebas del bot: reemplaza fetch por una API falsa de tcgpricelookup.com y pokemontcg.io.
// Contadores en globalThis.__llamadas y registro de consultas en process.env.MOCK_LOG (archivo).
import { appendFileSync } from "node:fs";
const logf = process.env.MOCK_LOG;
const log = s => logf && appendFileSync(logf, s + "\n");
const carta = (id, name, number, setId, setName, code, market) => ({ id, name, number, set: { id: setId, name: setName, ptcgoCode: code },
  prices: market ? { raw: { near_mint: { tcgplayer: { market, low: market / 2, high: market * 2 } } } } : {} });
const BD = [];
BD.push(carta("t-alp-1", "Foo", "001/003", "alp", "Alpha", "ALP", 1.5), carta("t-alp-2", "Bar", "002/003", "alp", "Alpha", "ALP", 2.5), carta("t-alp-3", "Baz", "003/003", "alp", "Alpha", "ALP", null));
for (let i = 1; i <= 130; i++) BD.push(carta("t-bet-" + i, "Card" + i, `${String(i).padStart(3, "0")}/130`, "bet", "Beta", "BET", i / 10));
BD.push(carta("t-ov-9", "Weird Name ex", "009/050", "gam", "Gamma", "GAM", 7));
const resp = body => ({ ok: true, status: 200, headers: { get: () => null, forEach: () => {} }, json: async () => body, text: async () => JSON.stringify(body) });
const err = status => ({ ok: false, status, headers: { get: () => null, forEach: () => {} }, json: async () => ({}), text: async () => "err" });
globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.hostname === "api.tcgpricelookup.com") {
    const ids = u.searchParams.get("ids"), q = u.searchParams.get("q"), page = parseInt(u.searchParams.get("page") || "1", 10);
    if (ids) { log("BATCH " + ids.split(",").length); return resp({ data: BD.filter(c => ids.split(",").includes(c.id)) }); }
    log(`SEARCH q=${q} page=${page}`);
    const qn = q.toLowerCase();
    let hits = BD.filter(c => c.set.name.toLowerCase() === qn);
    if (!hits.length) hits = BD.filter(c => (c.name + " " + c.number).toLowerCase().includes(qn.split(" ")[0]));
    return resp({ data: hits.slice((page - 1) * 100, page * 100) });
  }
  if (u.hostname === "api.pokemontcg.io") {
    const id = u.pathname.split("/").pop(); log("PTCG " + id);
    if (id === "gam-1") return resp({ data: { id, tcgplayer: { prices: { normal: { market: 0.4, low: 0.2, high: 0.9 } } } } });
    return err(404);
  }
  return err(500);
};
