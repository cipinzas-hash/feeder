// Precarga para pruebas del bot: reemplaza fetch por una API falsa de tcgpricelookup.com y pokemontcg.io.
// Contadores en globalThis.__llamadas y registro de consultas en process.env.MOCK_LOG (archivo).
import { appendFileSync } from "node:fs";
const logf = process.env.MOCK_LOG;
const log = s => logf && appendFileSync(logf, s + "\n");
const carta = (id, name, number, setId, setName, code, market, variant = null) => ({ id, name, number, variant, set: { id: setId, slug: "pokemon--" + setId, name: setName, ptcgoCode: code },
  prices: market ? { raw: { near_mint: { tcgplayer: { market, low: market / 2, high: market * 2 } } } } : {} });
const BD = [];
BD.push(carta("t-alp-1", "Foo", "001/003", "alp", "Alpha", "ALP", 1.5), carta("t-alp-2", "Bar", "002/003", "alp", "Alpha", "ALP", 2.5), carta("t-alp-3", "Baz", "003/003", "alp", "Alpha", "ALP", null));
for (let i = 1; i <= 130; i++) BD.push(carta("t-bet-" + i, "Card" + i, `${String(i).padStart(3, "0")}/130`, "bet", "SV05: Beta", "BET", i / 10));
// variantes de impresión (la API devuelve una fila por variante; la Reverse viene primero a propósito)
BD.push(carta("t-alp-7r", "Var", "007/010", "alp", "Alpha", "ALP", 0.9, "Reverse Holofoil"), carta("t-alp-7n", "Var", "007/010", "alp", "Alpha", "ALP", 0.2, "Normal"));
BD.push(carta("t-guard", "Guard", "001/010", "alp", "Alpha", "ALP", 5, "Normal"));
BD.push(carta("t-hist", "Hist", "001/010", "alp", "Alpha", "ALP", 8, "Holofoil"));
BD.push(carta("t-ov-9", "Weird Name ex", "009/050", "gam", "Gamma", "GAM", 7));
BD.push(carta("t-sol-5", "Solo", "005/100", "del", "Delta Species", "DEL", 3.3), carta("t-sol2-5", "Solo", "005/100", "del2", "Otro Set", "DE2", 9));
BD.push(carta("t-par-6", "Par", "006/100", "del", "Delta Species", "DEL", 4.4)); // se cosecha en la búsqueda de "Solo 5"? no: solo aparece si el nombre coincide
const headersMock = { "x-ratelimit-remaining": process.env.MOCK_REMAINING || "90" };
const resp = body => ({ ok: true, status: 200, headers: { get: k => headersMock[k.toLowerCase()] ?? null, forEach: f => Object.entries(headersMock).forEach(([k, v]) => f(v, k)) }, json: async () => body, text: async () => JSON.stringify(body) });
const err = status => ({ ok: false, status, headers: { get: () => null, forEach: () => {} }, json: async () => ({}), text: async () => "err" });
globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.hostname === "api.tcgpricelookup.com") {
    if (u.pathname === "/v1/sets") {
      const off = parseInt(u.searchParams.get("offset") || "0", 10); log("SETS offset=" + off);
      const m = new Map(); for (const c of BD) { const e = m.get(c.set.id) || { id: c.set.id + "-uuid", slug: c.set.slug, name: c.set.name, count: 0 }; e.count++; m.set(c.set.id, e); }
      const todos = [...m.values()];
      for (const [id, name] of [["u1", "Set Uno"], ["u2", "Set Dos"], ["u3", "Set Tres"]]) todos.push({ id: id + "-uuid", slug: "pokemon--" + id, name, count: 0 }); // sets sin cartas en la BD falsa
      return resp({ data: todos.slice(off, off + 100), total: todos.length, limit: 100, offset: off });
    }
    const ids = u.searchParams.get("ids"), q = u.searchParams.get("q"), page = parseInt(u.searchParams.get("page") || "1", 10);
    const setSlug = u.searchParams.get("set");
    if (setSlug) {
      const off = parseInt(u.searchParams.get("offset") || "0", 10); log(`SETCARDS slug=${setSlug} offset=${off}`);
      if (process.env.MOCK_NO_SETSEARCH) return resp({ data: [], total: 0, limit: 100, offset: off });
      const hits = BD.filter(c => c.set.slug === setSlug);
      return resp({ data: hits.slice(off, off + 100), total: hits.length, limit: 100, offset: off });
    }
    if (ids) { log("BATCH " + ids.split(",").length); return resp({ data: BD.filter(c => ids.split(",").includes(c.id)) }); }
    log(`SEARCH q=${q} page=${page}`);
    const qn = q.toLowerCase();
    const m = qn.match(/^(.*) (\d+)$/);
    if (m) { // "Nombre Número": como la búsqueda real, trae TODAS las cartas con ese nombre (varios sets) y rellena con parecidas
      const hits = BD.filter(c => c.name.toLowerCase() === m[1]);
      return resp({ data: hits.slice(0, 100) });
    }
    if (process.env.MOCK_NO_SETSEARCH) return resp({ data: [] });
    const hits = BD.filter(c => c.set.name.toLowerCase() === qn);
    return resp({ data: hits.slice((page - 1) * 100, page * 100) });
  }
  if (u.hostname === "api.pokemontcg.io") {
    const id = u.pathname.split("/").pop(); log("PTCG " + id);
    if (id === "gam-1") return resp({ data: { id, tcgplayer: { prices: { normal: { market: 0.4, low: 0.2, high: 0.9 } } } } });
    return err(404);
  }
  return err(500);
};
