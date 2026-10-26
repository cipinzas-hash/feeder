// diagnostico-tcg.mjs (26-oct-2026, issue #27)
// Diagnóstico de UNA sola corrida (workflow manual): cómo responde de verdad tcgpricelookup.com a la lista de sets,
// al parámetro `set` + `offset` y a la búsqueda por texto de Delta Reign (ME06), y qué dice pokemontcg.io de ese set.
// El sandbox de Claude no llega a estas APIs; Actions sí. Escribe SOLO datos públicos de cartas (nada de la key) a
// docs/diag-tcg.json. Gasta ~10 consultas del cupo diario.
import { writeFileSync } from "node:fs";
const KEY = process.env.TCG_API_KEY, BASE = "https://api.tcgpricelookup.com/v1", POKE = "https://api.pokemontcg.io/v2";
const out = { fecha: new Date().toISOString(), pasos: [] };
const rateDe = r => { const o = {}; try { r.headers.forEach((v, k) => { if (/rate|limit|quota|remaining|reset/i.test(k)) o[k] = v; }); } catch (e) {} return o; };
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function paso(nombre, url, headers = {}) {
  await dormir(1600); // límite de ráfaga de la API: 1 consulta a la vez
  const p = { nombre, url: url.replace(/(api[-_]?key=)[^&]+/i, "$1***") };
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    p.status = r.status; p.rate = rateDe(r);
    const txt = await r.text();
    try { p.json = JSON.parse(txt); } catch (e) { p.texto = txt.slice(0, 300); }
  } catch (e) { p.error = e.message; }
  out.pasos.push(p); return p;
}
const resumenCartas = j => (j?.data || []).slice(0, 5).map(c => ({ id: c.id, name: c.name, number: c.number, set: c.set }));
const H = { "X-API-Key": KEY };

// v2 (26-oct-2026): la v1 mostró que `set=<slug>` funciona y que las consultas seguidas dan 429 (ráfaga 1) — ahora con pausa.
// Objetivo: ver una carta CRUDA completa (qué distingue dos ids con mismo nombre+número), confirmar `offset` y listar Delta Reign.
const SLUG = "pokemon--me04-chaos-rising";
const a = await paso("raw set Chaos Rising limit=4", `${BASE}/cards/search?set=${SLUG}&game=pokemon&limit=4`, H);
a.crudas = (a.json?.data || []).slice(0, 4); a.total = a.json?.total ?? null; a.claves = a.json ? Object.keys(a.json) : null; delete a.json;
const b = await paso("offset=4 limit=4", `${BASE}/cards/search?set=${SLUG}&game=pokemon&limit=4&offset=4`, H);
b.cartas = (b.json?.data || []).map(c => ({ id: c.id, name: c.name, number: c.number })); delete b.json;
const d = await paso("Delta Reign set", `${BASE}/cards/search?set=pokemon--me06-delta-reign&game=pokemon&limit=30`, H);
d.total = d.json?.total ?? null; d.cartas = (d.json?.data || []).map(c => ({ id: c.id, name: c.name, number: c.number, rarity: c.rarity ?? null, market: c.prices?.raw?.near_mint?.tcgplayer?.market ?? null })); delete d.json;
const s1 = await paso("pokemontcg.io sets (ordenados por fecha desc, top 3)", `${POKE}/sets?orderBy=-releaseDate&pageSize=3&select=id,name,releaseDate`);
s1.resumen = s1.json?.data || null; delete s1.json;
writeFileSync(new URL("../../../docs/diag-tcg.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("✓ diagnóstico v2 escrito en docs/diag-tcg.json,", out.pasos.length, "pasos");
