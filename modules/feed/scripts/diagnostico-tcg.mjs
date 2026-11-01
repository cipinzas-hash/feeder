// diagnostico-tcg.mjs v5 (30-oct-2026, issue #27 seguimiento): filas crudas de 3 sets con cartas sin resolver, para
// compararlas offline con el inventario y ver por qué no emparejan. Datos públicos de cartas; ~8 consultas.
import { writeFileSync } from "node:fs";
const KEY = process.env.TCG_API_KEY, BASE = "https://api.tcgpricelookup.com/v1";
const SETS = [["pokemon--neo-destiny", 232], ["pokemon--sm-cosmic-eclipse", 494], ["pokemon--swsh02-rebel-clash", 406]];
const out = { fecha: new Date().toISOString(), version: 5, sets: {} };
const dormir = ms => new Promise(r => setTimeout(r, ms));
for (const [slug, count] of SETS) {
  out.sets[slug] = { count, filas: [], errores: [] };
  for (let off = 0; off < Math.min(count, 500); off += 100) {
    await dormir(2600);
    try {
      const r = await fetch(`${BASE}/cards/search?set=${slug}&game=pokemon&limit=100${off ? `&offset=${off}` : ""}`, { headers: { "X-API-Key": KEY }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { out.sets[slug].errores.push(`offset ${off}: HTTP ${r.status}`); continue; }
      const j = await r.json();
      for (const c of j.data || []) out.sets[slug].filas.push([c.id, c.name, c.number, c.variant ?? null, c.rarity ?? null, c.set?.name ?? null]);
    } catch (e) { out.sets[slug].errores.push(`offset ${off}: ${e.message}`); }
  }
}
writeFileSync(new URL("../../../docs/diag-tcg.json", import.meta.url), JSON.stringify(out));
console.log("✓ diagnóstico v5 escrito");
