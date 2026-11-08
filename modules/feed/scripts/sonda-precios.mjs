// sonda-precios.mjs (8-nov-2026, issue #37): ¿por qué ciertas cartas sin precio no emparejan en tcgpricelookup?
// 7 casos x 2 consultas (búsqueda libre como el bot + búsqueda acotada al set por slug) = 14 consultas del cupo.
// Escribe docs/diag-precios.json con candidatos crudos para comparar nombre/número offline.
import { writeFileSync } from "node:fs";
import { fetchTCGPriceDiag, normName } from "../../pokecripto/lib/pricing.mjs";
const KEY = process.env.TCG_API_KEY, BASE = "https://api.tcgpricelookup.com/v1";
const dormir = ms => new Promise(r => setTimeout(r, ms));
const CASOS = [
  { name: "M Rayquaza-EX", set: "XY - Roaring Skies", number: "105", code: "xy6", slug: "pokemon--xy-roaring-skies", clave: "rayquaza" },
  { name: "M Charizard-EX", set: "XY - Flashfire", number: "13", code: "xy2", slug: "pokemon--xy-flashfire", clave: "charizard" },
  { name: "M Garchomp-EX", set: "XY Promos", number: "XY168", code: "xyp", slug: "pokemon--xy-promos", clave: "garchomp" },
  { name: "Cinderace ex", set: "SV Promos", number: "163", code: "svp", slug: "pokemon--sv-scarlet-and-violet-promo-cards", clave: "cinderace" },
  { name: "Mega Greninja ex", set: "Chaos Rising", number: "100", code: "me4", slug: "pokemon--me04-chaos-rising", clave: "greninja" },
  { name: "Pikachu", set: "30th Celebration", number: "36", code: "me55", slug: "pokemon--me-30th-celebration", clave: "pikachu" },
  { name: "M Mewtwo-EX", set: "XY - BREAKthrough", number: "63", code: "xy8", slug: "pokemon--xy-breakthrough", clave: "mewtwo" },
];
const out = { fecha: new Date().toISOString(), casos: [] };
for (const c of CASOS) {
  const item = { entrada: { name: c.name, number: c.number, code: c.code, slug: c.slug }, diag: null, enSet: null };
  await dormir(3200);
  item.diag = await fetchTCGPriceDiag(c.name, c.set, c.number, c.code, KEY);
  await dormir(3200);
  try {
    const r = await fetch(`${BASE}/cards/search?set=${c.slug}&q=${encodeURIComponent(c.clave)}&game=pokemon&limit=100`, { headers: { "X-API-Key": KEY }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) item.enSet = { error: `HTTP ${r.status}` };
    else {
      const j = await r.json();
      const filas = (j.data || []).map(x => {
        const nm = x.prices?.raw?.near_mint?.tcgplayer, lp = x.prices?.raw?.lightly_played?.tcgplayer;
        return [x.id, x.name, x.number, x.variant ?? null, x.rarity ?? null, (nm || lp)?.market ?? null, x.set?.id ?? null];
      });
      item.enSet = { total: filas.length, filas: filas.filter(f => normName(f[1]).includes(c.clave)).slice(0, 15) };
    }
  } catch (e) { item.enSet = { error: e.message }; }
  out.casos.push(item);
}
writeFileSync(new URL("../../../docs/diag-precios.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("✓ sonda de precios escrita,", out.casos.length, "casos");
