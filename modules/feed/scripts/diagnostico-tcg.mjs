// diagnostico-tcg.mjs v3 (26-oct-2026, issue #27)
// Corre el MISMO código que usa el bot (discovery.mjs) contra la API real, desde Actions: lista de sets (fetchTCGSets),
// slug de un set, y dos páginas de ese set (fetchTCGSetPagina). Escribe docs/diag-tcg.json (solo datos públicos de cartas).
// Gasta ~5 consultas.
import { writeFileSync } from "node:fs";
import { fetchTCGSets, fetchTCGSetPagina, slugParaSet, elegirVariante } from "../../pokecripto/lib/discovery.mjs";
const KEY = process.env.TCG_API_KEY;
const out = { fecha: new Date().toISOString(), version: 3 };
try {
  const rs = await fetchTCGSets(KEY);
  out.sets = { ok: rs.ok, error: rs.error || null, status: rs.status ?? null, llamadas: rs.llamadas, n: rs.sets?.length ?? 0, rate: rs.rate };
  const api = slugParaSet("Chaos Rising", rs.sets || []);
  out.slugChaosRising = api ? { slug: api.slug, count: api.count } : null;
  out.mapeo = {};
  for (const n of ["Delta Species", "Ascended Heroes", "Unbroken Bonds", "Brilliant Stars", "Cosmic Eclipse", "Scarlet & Violet Black Star Promos", "HS—Triumphant", "151", "Mega Evolution", "Sword & Shield", "Expedition Base Set"]) {
    const m = slugParaSet(n, rs.sets || []); out.mapeo[n] = m ? m.slug : null;
  }
  if (api) {
    out.paginas = [];
    const vistos = new Set();
    for (const off of [0, 100]) {
      await new Promise(r => setTimeout(r, 2500));
      const p = await fetchTCGSetPagina(api.slug, KEY, off);
      out.paginas.push({ offset: off, ok: p.ok, status: p.status ?? null, error: p.error || null, filas: p.cards?.length ?? 0, total: p.total ?? null, rate: p.rate,
        nuevos: (p.cards || []).filter(c => !vistos.has(c.tcgId)).length, muestra: (p.cards || []).slice(0, 3).map(c => ({ name: c.name, number: c.number, variant: c.variant, market: c.market })) });
      (p.cards || []).forEach(c => vistos.add(c.tcgId));
    }
  }
} catch (e) { out.excepcion = String(e && e.stack || e).slice(0, 800); }
writeFileSync(new URL("../../../docs/diag-tcg.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("✓ diagnóstico v3 escrito en docs/diag-tcg.json");
