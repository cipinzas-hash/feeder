// sonda-sets.mjs (7-nov-2026, issue #34): ¿pokemontcg.io ya indexa los sets más recientes (Delta Reign / ME06)?
// Solo pokemontcg.io (sin key, sin gastar cupo de tcgpricelookup). Escribe docs/diag-sets.json.
import { writeFileSync } from "node:fs";
const BASE = "https://api.pokemontcg.io/v2";
const out = { fecha: new Date().toISOString(), sets: [], delta: null, errores: [] };
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(40000) });
      if (r.ok) return await r.json();
      out.errores.push(`${url} intento ${i}: HTTP ${r.status}`);
    } catch (e) { out.errores.push(`${url} intento ${i}: ${e.message}`); }
    await dormir(4000);
  }
  return null;
}
const j = await get(`${BASE}/sets?orderBy=-releaseDate&pageSize=12&select=id,name,series,releaseDate,total,updatedAt`);
if (j) out.sets = j.data || [];
const d = await get(`${BASE}/sets?q=name:"Delta Reign"`);
if (d) out.delta = d.data || [];
const c = await get(`${BASE}/cards?q=set.name:"Delta Reign"&pageSize=1&select=id,name`);
if (c) out.deltaCartas = { totalCount: c.totalCount ?? null };
writeFileSync(new URL("../../../docs/diag-sets.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("✓ sonda escrita", out.sets.length, "sets; errores:", out.errores.length);
