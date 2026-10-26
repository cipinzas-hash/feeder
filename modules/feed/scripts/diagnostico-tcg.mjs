// diagnostico-tcg.mjs v4 (26-oct-2026, issue #27): v3 mostró que /sets?...&offset=0 se cuelga (timeout de 20 s) mientras
// /sets?game=pokemon&limit=100 (sin offset) respondía en v1. Prueba, con tiempos, qué combinaciones de offset funcionan.
import { writeFileSync } from "node:fs";
const KEY = process.env.TCG_API_KEY, BASE = "https://api.tcgpricelookup.com/v1";
const out = { fecha: new Date().toISOString(), version: 4, pasos: [] };
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function paso(nombre, path) {
  await dormir(2600);
  const t0 = Date.now(), p = { nombre, path };
  try {
    const r = await fetch(BASE + path, { headers: { "X-API-Key": KEY }, signal: AbortSignal.timeout(30000) });
    p.status = r.status; p.ms = Date.now() - t0;
    const rate = {}; r.headers.forEach((v, k) => { if (/rate|limit|quota|remaining|reset/i.test(k)) rate[k] = v; }); p.rate = rate;
    const j = await r.json().catch(() => null);
    p.claves = j ? Object.keys(j) : null; p.total = j?.total ?? null; p.limit = j?.limit ?? null; p.offset = j?.offset ?? null;
    p.filas = j?.data?.length ?? null; p.primeros = (j?.data || []).slice(0, 2).map(x => x.slug || x.id + " " + x.name);
  } catch (e) { p.error = e.message; p.ms = Date.now() - t0; }
  out.pasos.push(p); return p;
}
await paso("sets sin offset", "/sets?game=pokemon&limit=100");
await paso("sets offset=100", "/sets?game=pokemon&limit=100&offset=100");
await paso("cards set sin offset", "/cards/search?set=pokemon--me04-chaos-rising&game=pokemon&limit=100");
await paso("cards set offset=100", "/cards/search?set=pokemon--me04-chaos-rising&game=pokemon&limit=100&offset=100");
writeFileSync(new URL("../../../docs/diag-tcg.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("✓ diagnóstico v4 escrito");
