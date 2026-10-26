// diagnostico-tcg.mjs (26-oct-2026, issue #27)
// Diagnóstico de UNA sola corrida (workflow manual): cómo responde de verdad tcgpricelookup.com a la lista de sets,
// al parámetro `set` + `offset` y a la búsqueda por texto de Delta Reign (ME06), y qué dice pokemontcg.io de ese set.
// El sandbox de Claude no llega a estas APIs; Actions sí. Escribe SOLO datos públicos de cartas (nada de la key) a
// docs/diag-tcg.json. Gasta ~10 consultas del cupo diario.
import { writeFileSync } from "node:fs";
const KEY = process.env.TCG_API_KEY, BASE = "https://api.tcgpricelookup.com/v1", POKE = "https://api.pokemontcg.io/v2";
const out = { fecha: new Date().toISOString(), pasos: [] };
const rateDe = r => { const o = {}; try { r.headers.forEach((v, k) => { if (/rate|limit|quota|remaining|reset/i.test(k)) o[k] = v; }); } catch (e) {} return o; };
async function paso(nombre, url, headers = {}) {
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

// 1. lista de sets (varias formas; se anota cuál responde)
let sets = [];
for (const u of [`${BASE}/sets?game=pokemon&limit=100`, `${BASE}/sets?game=pokemon`, `${BASE}/sets`]) {
  const p = await paso("sets", u, H);
  const lista = p.json?.data || p.json?.sets || (Array.isArray(p.json) ? p.json : null);
  p.resumen = { claves: p.json && !Array.isArray(p.json) ? Object.keys(p.json) : null, n: lista?.length ?? null, muestra: (lista || []).slice(0, 3), total: p.json?.total ?? p.json?.totalCount ?? p.json?.meta ?? null };
  delete p.json;
  if (lista?.length) { sets = lista; break; }
}
// 2. sets que importan
const re = /delta|chaos rising|30th|ascended/i;
out.setsRelevantes = sets.filter(s => re.test(JSON.stringify(s))).slice(0, 12);
out.totalSets = sets.length;
// 3. parámetro `set` + `offset` con Chaos Rising (usando slug y id, según lo que haya)
const cr = sets.find(s => /chaos rising/i.test(s.name || ""));
if (cr) {
  for (const clave of [cr.slug, cr.id].filter(Boolean)) {
    const a = await paso(`set=${clave} offset=0`, `${BASE}/cards/search?set=${encodeURIComponent(clave)}&game=pokemon&limit=5`, H);
    const b = await paso(`set=${clave} offset=5`, `${BASE}/cards/search?set=${encodeURIComponent(clave)}&game=pokemon&limit=5&offset=5`, H);
    a.cartas = resumenCartas(a.json); a.total = a.json?.total ?? a.json?.meta ?? null; delete a.json;
    b.cartas = resumenCartas(b.json); delete b.json;
  }
} else out.aviso = "Chaos Rising no apareció en la lista de sets";
// 4. Delta Reign por texto y por nombre de carta
for (const q of ["Delta Reign", "Mega Rayquaza ex"]) {
  const p = await paso(`q=${q}`, `${BASE}/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=10`, H);
  p.cartas = resumenCartas(p.json); delete p.json;
}
// 5. pokemontcg.io: ¿ya existe el set?
const s1 = await paso("pokemontcg.io sets Delta Reign", `${POKE}/sets?q=${encodeURIComponent('name:"Delta Reign"')}`);
s1.resumen = (s1.json?.data || []).map(s => ({ id: s.id, name: s.name, releaseDate: s.releaseDate, total: s.total })); delete s1.json;
const s2 = await paso("pokemontcg.io últimos sets", `${POKE}/sets?orderBy=-releaseDate&pageSize=6&select=id,name,releaseDate,total`);
s2.resumen = s2.json?.data || null; delete s2.json;
writeFileSync(new URL("../../../docs/diag-tcg.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("✓ diagnóstico escrito en docs/diag-tcg.json,", out.pasos.length, "pasos");
