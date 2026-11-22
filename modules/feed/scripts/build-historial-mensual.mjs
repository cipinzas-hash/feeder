// Historial MENSUAL de precios desde el archivo diario de tcgcsv.com (desde el 8-feb-2024). Variantes 20-nov-2026.
//
// Para cada fila del inventario (Pokémon, Yu-Gi-Oh!, Digimon) toma el precio de SU variante (productId + subtipo) el día 1 de cada mes
// y lo guarda en el campo compacto `histMes` = {m: "YYYY-MM" del primer mes, p: [precio por mes consecutivo, null si falta]} (~180
// caracteres por carta: el inventario ya ocupa ~1,8 MB del almacenamiento del navegador, 20.000 objetos más lo desbordarían). La pantalla lo
// expande al dibujar (lib/historial.mjs: historialConMensual). Solo meses ANTERIORES al primer snapshot propio.
// Los archivos pesan 2-4 MB cada uno y son inmutables: se bajan una sola vez por corrida y se descartan (la documentación de tcgcsv
// pide no repetir descargas de archivos).
//
// MODO PRUEBA por omisión (APPLY distinto de "1"): no escribe el inventario; deja el informe y, si se pide, el inventario propuesto
// en HISTORIAL_PROPUESTA_PATH. Con APPLY=1 escribe el inventario en POKECRIPTO_INVENTARIO_PATH (el workflow lo commitea a Angst-data).
// Idempotente: la fila queda marcada `histMensual` y no se vuelve a tocar salvo FORZAR=1.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { normNum, normName } from "../../pokecripto/lib/pricing.mjs";
import { nombreSetCompatible } from "../../pokecripto/lib/variantes.mjs";
import { juegoDe } from "../../pokecripto/lib/juegos.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..", "..", "..");
const INV = process.env.POKECRIPTO_INVENTARIO_PATH;
const APPLY = process.env.APPLY === "1", FORZAR = process.env.FORZAR === "1";
const REPORTE = process.env.HISTORIAL_REPORTE || path.join(RAIZ, "docs", "historial-mensual-reporte.md");
const PROPUESTA = process.env.HISTORIAL_PROPUESTA_PATH || null;
const MAX_MESES = Number(process.env.MAX_MESES || 0);           // 0 = todos (para pruebas: limitar)
const TCGCSV = "https://tcgcsv.com/tcgplayer", ARCHIVO = "https://tcgcsv.com/archive/tcgplayer";
const UA = { "User-Agent": "angst-feed-bot (github.com/cipinzas-hash/feeder)" };
const CAT_JUEGO = { pokemon: null, yugioh: 2, digimon: 63 };     // Pokémon se descubre por nombre
const PRIMER_ARCHIVO = "2024-02-08";
const hoy = new Date().toISOString().slice(0, 10);
const avisos = [];
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url, intentos = 3) {
  let ult = null;
  for (let i = 0; i < intentos; i++) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 30000);
    try { const r = await fetch(url, { headers: UA, signal: ac.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    catch (e) { ult = e; await dormir(700 * (i + 1)); } finally { clearTimeout(tm); }
  }
  throw new Error(`${url}: ${ult && ult.message}`);
}
const ext = (p, n) => { const e = (Array.isArray(p.extendedData) ? p.extendedData : []).find(x => String(x.name || x.displayName || "").toLowerCase() === n.toLowerCase()); return e && e.value != null ? String(e.value) : ""; };
const sinParentesis = s => String(s || "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
const ordenSub = s => ({ normal: 0, holofoil: 1, "reverse holofoil": 2 }[String(s || "").toLowerCase()] ?? 9);
const precio = r => (r.marketPrice ?? r.midPrice ?? null);
const mediana = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = n => (n == null ? null : Math.round(n * 100) / 100);

const inventario = JSON.parse(fs.readFileSync(INV, "utf-8"));
const objetivos = new Map();                 // id de fila -> { cat, pid, sub }
const detalle = { pokemonSinMatch: 0, pokemonOk: 0, otrosOk: 0, otrosSinClave: 0 };

// ── 1. A qué (producto, subtipo) corresponde cada fila ──────────────────────────────────────────────────────────
// Yu-Gi-Oh!/Digimon: su `tcgcsvKey` ("pid|subtipo"). Pokémon: set + número + nombre contra tcgcsv (mismo criterio que la sonda: 91 % únicos).
const pokes = inventario.filter(c => c.estado !== "vendida" && juegoDe(c) === "pokemon" && c.name && c.set);
let CAT_POKE = null;
if (pokes.length) {
  const cats = (await getJson(`${TCGCSV}/categories`)).results || [];
  const cat = cats.find(c => /^pok[eé]mon$/i.test(String(c.name || "").trim())); if (!cat) throw new Error("sin categoría Pokémon");
  CAT_POKE = cat.categoryId;
  const grupos = (await getJson(`${TCGCSV}/${CAT_POKE}/groups`)).results || [];
  const prods = new Map(), porGrupoNum = new Map(), subs = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < grupos.length) {
      const g = grupos[i++];
      try {
        const [pr, pc] = await Promise.all([getJson(`${TCGCSV}/${CAT_POKE}/${g.groupId}/products`), getJson(`${TCGCSV}/${CAT_POKE}/${g.groupId}/prices`)]);
        for (const p of pr.results || []) { const numero = ext(p, "Number"); if (!numero) continue; const pp = { pid: p.productId, base: normName(sinParentesis(p.name)), nombre: p.name, num: normNum(numero), grupo: g.groupId }; prods.set(p.productId, pp); const k = `${g.groupId}|${pp.num}`; if (!porGrupoNum.has(k)) porGrupoNum.set(k, []); porGrupoNum.get(k).push(pp); }
        for (const r of pc.results || []) { if (!subs.has(r.productId)) subs.set(r.productId, []); subs.get(r.productId).push({ sub: r.subTypeName || "", market: precio(r) }); }
      } catch (e) { avisos.push("grupo " + g.groupId + ": " + String(e.message).slice(0, 100)); }
    }
  }));
  for (const c of pokes) {
    const gs = grupos.filter(g => nombreSetCompatible(c.set, g.name));
    const cand = gs.flatMap(g => porGrupoNum.get(`${g.groupId}|${normNum(c.number)}`) || []).filter(p => p.base === normName(c.name));
    if (!cand.length) { detalle.pokemonSinMatch++; continue; }
    const p = cand.sort((a, b) => (subs.get(b.pid)?.length || 0) - (subs.get(a.pid)?.length || 0))[0];
    const lista = (subs.get(p.pid) || []).filter(x => x.market != null);
    let sub;
    if (c.tcgcsvKey && c.tcgcsvKey.startsWith(p.pid + "|")) sub = c.tcgcsvKey.split("|")[1];
    else sub = ([...lista].sort((a, b) => ordenSub(a.sub) - ordenSub(b.sub))[0] || {}).sub;
    if (sub === undefined) { detalle.pokemonSinMatch++; continue; }
    objetivos.set(c.id, { cat: CAT_POKE, pid: p.pid, sub }); detalle.pokemonOk++;
  }
}
for (const c of inventario) {
  const j = juegoDe(c); if (j === "pokemon" || c.estado === "vendida") continue;
  const m = /^(\d+)\|(.*)$/.exec(c.tcgcsvKey || ""); if (!m || !CAT_JUEGO[j]) { detalle.otrosSinClave++; continue; }
  objetivos.set(c.id, { cat: CAT_JUEGO[j], pid: Number(m[1]), sub: m[2] }); detalle.otrosOk++;
}
console.log(`Filas con objetivo: ${objetivos.size} (Pokémon ${detalle.pokemonOk}, otros juegos ${detalle.otrosOk}) | sin match: ${detalle.pokemonSinMatch} | sin clave: ${detalle.otrosSinClave}`);

// ── 2. Un archivo por mes ────────────────────────────────────────────────────────────────────────────────────────
const fechas = [PRIMER_ARCHIVO];
for (let y = 2024, mo = 3; `${y}-${String(mo).padStart(2, "0")}-01` <= hoy; mo++) { if (mo > 12) { mo = 1; y++; } const f = `${y}-${String(mo).padStart(2, "0")}-01`; if (f <= hoy) fechas.push(f); }
const fechasUsar = MAX_MESES ? fechas.slice(-MAX_MESES) : fechas;
const porCat = new Map();                          // cat -> Set(pid)
for (const o of objetivos.values()) { if (!porCat.has(o.cat)) porCat.set(o.cat, new Set()); porCat.get(o.cat).add(o.pid); }
const serie = new Map();                           // `${cat}|${pid}|${sub}` -> [[fecha, market]]
const resumenMeses = [];
async function procesar(fecha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mes-" + fecha + "-"));
  try {
    let buf = null, ult = "";
    for (let intento = 1; intento <= 4 && !buf; intento++) {            // un mes fallido deja un hueco: se reintenta con espera creciente
      try { const r = await fetch(`${ARCHIVO}/prices-${fecha}.ppmd.7z`, { headers: UA, signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error("HTTP " + r.status); buf = Buffer.from(await r.arrayBuffer()); }
      catch (e) { ult = String(e.message).slice(0, 80); await dormir(2000 * intento); }
    }
    if (!buf) { avisos.push(`archivo ${fecha}: ${ult} (4 intentos)`); return; }
    const f7 = path.join(dir, "a.7z"); fs.writeFileSync(f7, buf);
    const x = spawnSync("7z", ["x", "-y", `-o${dir}/x`, f7], { encoding: "utf-8" });
    if (x.status !== 0) { avisos.push(`7z ${fecha}: ${String(x.stderr || x.stdout).slice(0, 100)}`); return; }
    let n = 0;
    const caminar = d => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { caminar(p); continue; }
        if (!/(^|[\\/])prices(\.json)?$/.test(p)) continue;
        const partes = p.split(path.sep), cat = [...porCat.keys()].find(c => partes.includes(String(c))); if (!cat) continue;
        const pids = porCat.get(cat);
        try { for (const rr of JSON.parse(fs.readFileSync(p, "utf-8")).results || []) { if (!pids.has(rr.productId)) continue; const m = precio(rr); if (m == null) continue; const k = `${cat}|${rr.productId}|${rr.subTypeName || ""}`; if (!serie.has(k)) serie.set(k, []); serie.get(k).push([fecha, m]); n++; } } catch (e) { /* archivo ilegible */ }
      }
    };
    caminar(path.join(dir, "x"));
    resumenMeses.push({ fecha, puntos: n, mb: Math.round(fs.statSync(f7).size / 104857.6) / 10 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
let ix = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (ix < fechasUsar.length) { const f = fechasUsar[ix++]; try { await procesar(f); } catch (e) { avisos.push(`mes ${f}: ${String(e.message).slice(0, 100)}`); } } }));
resumenMeses.sort((a, b) => a.fecha.localeCompare(b.fecha));

// ── 3. Antes de cada fila: meses anteriores a su primer snapshot ───────────────────────────────────────────────
let filasConSerie = 0, puntosNuevos = 0, yaTenian = 0, chars = 0;
const largos = [], comparaciones = [];
const resultado = inventario.map(c => {
  const o = objetivos.get(c.id); if (!o) return c;
  if (c.histMensual && !FORZAR) { yaTenian++; return c; }
  const pts = (serie.get(`${o.cat}|${o.pid}|${o.sub}`) || []).sort((a, b) => a[0].localeCompare(b[0]));
  if (!pts.length) return c;
  const h = Array.isArray(c.priceHistory) ? c.priceHistory : [];
  const primero = h.filter(x => x && x.date && x.market > 0).map(x => x.date).sort()[0] || "9999-12-31";
  const hasta = primero.slice(0, 7);
  const util = pts.filter(([f]) => f.slice(0, 7) < hasta);
  // validación: meses en que ambos existen (el snapshot propio de ese mes vs el archivo)
  for (const [f, m] of pts) { const mesF = f.slice(0, 7); const propios = h.filter(x => x && x.market > 0 && x.date.slice(0, 7) === mesF).map(x => x.market); if (propios.length) comparaciones.push(m / mediana(propios)); }
  if (!util.length) return { ...c, histMensual: hoy.slice(0, 7) };
  const porMes = new Map(util.map(([f, m]) => [f.slice(0, 7), r2(m)]));
  const ini = util[0][0].slice(0, 7), meses = [];
  for (let [y, mo] = ini.split("-").map(Number); `${y}-${String(mo).padStart(2, "0")}` < hasta; mo++) { if (mo > 12) { mo = 1; y++; } const k = `${y}-${String(mo).padStart(2, "0")}`; if (k >= hasta) break; meses.push(porMes.has(k) ? porMes.get(k) : null); }
  filasConSerie++; puntosNuevos += util.length; largos.push(util.length);
  const histMes = { m: ini, p: meses };
  chars += JSON.stringify(histMes).length;
  return { ...c, histMes, histMensual: hoy.slice(0, 7) };
});

// ── 4. Informe y salida ─────────────────────────────────────────────────────────────────────────────────────────
const pct = (n, d) => (d ? Math.round(100 * n / d) + " %" : "—");
const dentro = (v, t) => (v.length ? Math.round(100 * v.filter(x => Math.abs(x - 1) <= t).length / v.length) + " %" : "—");
const md = [
  `# Historial mensual desde el archivo de tcgcsv (${hoy})`, "",
  `Generado por \`modules/feed/scripts/build-historial-mensual.mjs\`. **Modo ${APPLY ? "APLICAR (escribió el inventario)" : "PRUEBA (no escribió nada)"}.**`, "",
  `- Filas del inventario con producto y subtipo identificados: **${objetivos.size}** (Pokémon ${detalle.pokemonOk} de ${pokes.length}; otros juegos ${detalle.otrosOk}). Sin match: Pokémon ${detalle.pokemonSinMatch} · otros sin clave ${detalle.otrosSinClave}.`,
  `- Archivos mensuales leídos: ${resumenMeses.length} de ${fechasUsar.length} (${resumenMeses.map(m => m.mb).reduce((a, b) => a + b, 0).toFixed(1)} MB bajados en total).`,
  `- Filas que reciben historial: **${filasConSerie}** (${pct(filasConSerie, objetivos.size)}) · puntos mensuales nuevos: ${puntosNuevos} · mediana por fila: ${mediana(largos) ?? "—"} meses · máximo ${largos.length ? Math.max(...largos) : "—"}. **Espacio que suma al inventario: ${(chars / 1024).toFixed(0)} KB (${filasConSerie ? Math.round(chars / filasConSerie) : 0} caracteres por fila).** Ya marcadas de antes: ${yaTenian}.`,
  `- **Validación contra tus snapshots** (mes en que existen los dos): n=${comparaciones.length} · precio del archivo ÷ tu snapshot del mes: mediana ${comparaciones.length ? r2(mediana(comparaciones)) : "—"} · dentro de ±10 %: ${dentro(comparaciones, 0.1)} · ±25 %: ${dentro(comparaciones, 0.25)}.`,
  "", "| Mes | Puntos | MB |", "|---|---:|---:|", ...resumenMeses.map(m => `| ${m.fecha} | ${m.puntos} | ${m.mb} |`),
  avisos.length ? "\n## Avisos\n" + avisos.slice(0, 20).map(a => "- " + a).join("\n") : "",
].join("\n");
fs.mkdirSync(path.dirname(REPORTE), { recursive: true });
fs.writeFileSync(REPORTE, md);
if (PROPUESTA) fs.writeFileSync(PROPUESTA, JSON.stringify(resultado));
if (APPLY) { if (filasConSerie > 0) fs.writeFileSync(INV, JSON.stringify(resultado, null, 1)); else console.log("nada que aplicar"); }
console.log(md);
