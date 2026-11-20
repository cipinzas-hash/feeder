// Sonda de viabilidad: ¿puede tcgcsv.com (espejo diario de TCGplayer) reemplazar a tcgpricelookup para Pokémon y darnos
// el historial mensual desde 2024? (lote 1 "precios limpios", 16-nov-2026). SOLO LEE: no escribe inventario ni datos.
//
// Mide, sobre el inventario real (ANGST_DATA_DIR/pokecripto-inventario.json) y la categoría Pokémon de tcgcsv:
//  1. Emparejamiento fila → producto (set + número + nombre) y por qué falla el resto.
//  2. Acabados (Normal / Holofoil / Reverse Holofoil…) y cuántas filas tendrían ≥2 con precio (alcance del selector).
//  3. Sellos y promos (prerelease, liga, staff…): productos hermanos con el mismo nombre y número en el mismo set.
//  4. Precio tcgcsv vs el precio actual de tcgpricelookup (tcgMarket).
//  5. Archivo histórico: disponibilidad de un archivo por mes desde feb-2024, y comparación contra el snapshot diario
//     de tcgpricelookup en la misma fecha (para saber si la serie mensual se empalma sin salto con la diaria).
//
// Salida: docs/sonda-tcgcsv-pokemon.md (agregados y pocos ejemplos; el repo es público) y, aparte, el detalle por fila en
// SONDA_DETALLE_PATH (se sube como artefacto del workflow; NO se commitea porque es el inventario).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { normNum, normName } from "../../pokecripto/lib/pricing.mjs";
import { nombreSetCompatible } from "../../pokecripto/lib/variantes.mjs";
import { describirVariante, multiploSobreBase } from "../../pokecripto/lib/variantes-comunes.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..", "..", "..");
const TCGCSV = "https://tcgcsv.com/tcgplayer";
const ARCHIVO = "https://tcgcsv.com/archive/tcgplayer";
const UA = { "User-Agent": "angst-feed-bot (github.com/cipinzas-hash/feeder)" };
const INV = process.env.POKECRIPTO_INVENTARIO_PATH || path.join(process.env.ANGST_DATA_DIR || "", "pokecripto-inventario.json");
const SALIDA_MD = process.env.SONDA_MD_PATH || path.join(RAIZ, "docs", "sonda-tcgcsv-pokemon.md");
const DETALLE = process.env.SONDA_DETALLE_PATH || path.join(os.tmpdir(), "sonda-tcgcsv-pokemon-detalle.json");
const FECHA_ARCHIVO = process.env.ARCHIVE_DATE || "2026-11-01";
const FECHA_ANTIGUA = process.env.ARCHIVE_OLD_DATE || "2024-02-08";
const CONCURRENCIA = 6, TIMEOUT_MS = 30000;
const hoyISO = new Date().toISOString().slice(0, 10);
const avisos = [];
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, intentos = 3) {
  let ult = null;
  for (let i = 0; i < intentos; i++) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try { const r = await fetch(url, { headers: UA, signal: ac.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    catch (e) { ult = e; await dormir(700 * (i + 1)); } finally { clearTimeout(tm); }
  }
  throw new Error(`${url}: ${ult && ult.message}`);
}
async function enLote(items, fn) {
  const out = new Array(items.length); let i = 0, fallos = 0;
  await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { fallos++; out[k] = null; if (fallos <= 5) avisos.push(String(e.message).slice(0, 180)); } }
  }));
  return { out, fallos };
}
const ext = (p, ...nombres) => {
  const lista = Array.isArray(p.extendedData) ? p.extendedData : [];
  for (const n of nombres) { const e = lista.find(x => String(x.name || x.displayName || "").toLowerCase() === n.toLowerCase()); if (e && e.value != null && e.value !== "") return String(e.value); }
  return "";
};
const precioDe = r => (r ? (r.marketPrice ?? r.midPrice ?? r.lowPrice ?? null) : null);
const ordenSub = s => ({ normal: 0, holofoil: 1, "reverse holofoil": 2 }[String(s || "").toLowerCase()] ?? 9);
const mediana = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctl = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r2 = n => (n == null ? null : Math.round(n * 100) / 100);
const fmtRatio = v => (v.length ? `mediana ${r2(mediana(v))} · p10 ${r2(pctl(v, 0.1))} · p90 ${r2(pctl(v, 0.9))} · n=${v.length}` : "sin datos");
const dentro = (v, tol) => (v.length ? Math.round(100 * v.filter(x => Math.abs(x - 1) <= tol).length / v.length) + " %" : "—");
// Los sellos pueden venir en cualquier parte del nombre ("Pikachu (Prerelease) - 025/165" o "Pikachu - 025/165 (League)"):
// se buscan paréntesis no numéricos en todo el nombre.
const sufijoParentesis = s => ((String(s || "").match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1).trim()).filter(x => x && !/^\d+([/-]\d+)?$/.test(x)).pop()) || "";
const quitaParentesis = s => String(s || "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
const esSello = txt => /prerelease|pre-release|league|staff|stamp|promo|winner|participant|regional|championship|worlds|play! pok|battle|cosmos|build|e3|sdcc|nycc|toys|best of|city|gym challenge|origins|trainer toolkit/i.test(txt);

// ── 1. Categoría, sets, productos y precios de Pokémon en tcgcsv ──────────────
const cats = (await getJson(`${TCGCSV}/categories`)).results || [];
const cat = cats.find(c => /^pok[eé]mon$/i.test(String(c.name || "").trim())) || cats.find(c => /pok[eé]mon/i.test(String(c.name || "")) && !/japan/i.test(c.name));
if (!cat) throw new Error("no encontré la categoría Pokémon en tcgcsv");
const CAT = cat.categoryId;
const grupos = (await getJson(`${TCGCSV}/${CAT}/groups`)).results || [];
console.log(`Categoría ${CAT} (${cat.name}): ${grupos.length} sets`);
const productos = new Map();      // productId -> {name, groupId, number, rarity, ext:[...]}
const precios = new Map();        // productId -> [{sub, market, low, mid, high}]
const camposExt = new Map();
const porGrupoNum = new Map();    // `${groupId}|${numNorm}` -> [productId]
const { fallos } = await enLote(grupos, async g => {
  const [prods, prs] = await Promise.all([getJson(`${TCGCSV}/${CAT}/${g.groupId}/products`), getJson(`${TCGCSV}/${CAT}/${g.groupId}/prices`)]);
  for (const p of prods.results || []) {
    const num = ext(p, "Number");
    for (const e of Array.isArray(p.extendedData) ? p.extendedData : []) camposExt.set(e.name, (camposExt.get(e.name) || 0) + 1);
    if (!num && !ext(p, "Rarity")) continue; // producto sellado, no carta suelta
    productos.set(p.productId, { productId: p.productId, name: p.name, cleanName: p.cleanName, groupId: g.groupId, number: num, rarity: ext(p, "Rarity") });
    const k = `${g.groupId}|${normNum(num)}`; if (!porGrupoNum.has(k)) porGrupoNum.set(k, []); porGrupoNum.get(k).push(p.productId);
  }
  for (const r of prs.results || []) {
    if (!precios.has(r.productId)) precios.set(r.productId, []);
    precios.get(r.productId).push({ sub: r.subTypeName || "", market: r.marketPrice ?? null, low: r.lowPrice ?? null, mid: r.midPrice ?? null, high: r.highPrice ?? null });
  }
});
console.log(`Productos de carta: ${productos.size} | con precio: ${precios.size} | sets que fallaron: ${fallos}`);

// ── 2. Emparejar el inventario real ───────────────────────────────────────────
const inventario = JSON.parse(fs.readFileSync(INV, "utf-8")).filter(c => c.estado !== "vendida" && c.name);
const gruposDe = set => grupos.filter(g => nombreSetCompatible(set, g.name));
const subAuto = lista => [...lista].sort((a, b) => ordenSub(a.sub) - ordenSub(b.sub)).find(x => x.market != null) || null;
const filas = [];
const cuenta = { total: inventario.length, unico: 0, multiple: 0, soloSello: 0, sinSet: 0, sinNumero: 0, sinNombre: 0 };
const ejemplosFallo = { sinSet: [], sinNumero: [], sinNombre: [] };
for (const c of inventario) {
  const gs = gruposDe(c.set);
  const f = { id: c.id, name: c.name, set: c.set, number: c.number, tcgMarket: c.tcgMarket ?? null, estado: "", productId: null, sub: null, tcgcsv: null, candidatos: 0, hermanosSello: [] };
  if (!gs.length) { cuenta.sinSet++; f.estado = "sin_set"; if (ejemplosFallo.sinSet.length < 8) ejemplosFallo.sinSet.push(`${c.name} (${c.set})`); filas.push(f); continue; }
  const numN = normNum(c.number), nomN = normName(c.name);
  const delNumero = gs.flatMap(g => porGrupoNum.get(`${g.groupId}|${numN}`) || []).map(id => productos.get(id));
  if (!delNumero.length) { cuenta.sinNumero++; f.estado = "sin_numero"; if (ejemplosFallo.sinNumero.length < 8) ejemplosFallo.sinNumero.push(`${c.name} ${c.number} (${c.set})`); filas.push(f); continue; }
  const exactos = delNumero.filter(p => normName(p.name) === nomN);
  const hermanos = delNumero.filter(p => !exactos.includes(p) && normName(quitaParentesis(p.name)) === nomN && sufijoParentesis(p.name));
  f.hermanosSello = hermanos.map(p => ({ productId: p.productId, sufijo: sufijoParentesis(p.name), sello: esSello(sufijoParentesis(p.name)), market: subAuto(precios.get(p.productId) || [])?.market ?? null }));
  f.candidatos = exactos.length;
  if (!exactos.length) { if (hermanos.length) { cuenta.soloSello++; f.estado = "solo_sello"; } else { cuenta.sinNombre++; f.estado = "sin_nombre"; if (ejemplosFallo.sinNombre.length < 8) ejemplosFallo.sinNombre.push(`${c.name} ${c.number} (${c.set}) ↔ ${delNumero.slice(0, 2).map(p => p.name).join(" / ")}`); } filas.push(f); continue; }
  if (exactos.length > 1) { cuenta.multiple++; f.estado = "multiple"; } else { cuenta.unico++; f.estado = "unico"; }
  const elegido = exactos.sort((a, b) => (precios.get(b.productId)?.length || 0) - (precios.get(a.productId)?.length || 0))[0];
  const lista = precios.get(elegido.productId) || [];
  const auto = subAuto(lista);
  f.productId = elegido.productId; f.rarity = elegido.rarity; f.subtipos = lista.map(x => ({ sub: x.sub, market: x.market, low: x.low, high: x.high }));
  f.sub = auto?.sub ?? null; f.tcgcsv = auto?.market ?? null;
  filas.push(f);
}
const emparejadas = filas.filter(f => f.productId);

// ── 3. Acabados ───────────────────────────────────────────────────────────────
const firma = f => (f.subtipos || []).filter(x => x.market != null).map(x => x.sub || "(sin subtipo)").sort((a, b) => ordenSub(a) - ordenSub(b)).join(" + ") || "(sin precio)";
const porFirma = new Map(); for (const f of emparejadas) porFirma.set(firma(f), (porFirma.get(firma(f)) || 0) + 1);
const conVarios = emparejadas.filter(f => (f.subtipos || []).filter(x => x.market != null).length >= 2);
let masCercanoDistinto = 0, conTcg = 0;
for (const f of conVarios) {
  if (!(f.tcgMarket > 0)) continue; conTcg++;
  const cerca = [...f.subtipos].filter(x => x.market != null).sort((a, b) => Math.abs(a.market - f.tcgMarket) - Math.abs(b.market - f.tcgMarket))[0];
  if (cerca && cerca.sub !== f.sub) masCercanoDistinto++;
}
const fuenteGrupo = new Map(); for (const f of conVarios) fuenteGrupo.set(f.set, (fuenteGrupo.get(f.set) || 0) + 1);

// ── 4. Sellos ─────────────────────────────────────────────────────────────────
const sufijos = new Map();
for (const p of productos.values()) { const s = sufijoParentesis(p.name); if (s && !/^\d+(\/\d+)?$/.test(s)) sufijos.set(s, (sufijos.get(s) || 0) + 1); }
const topSufijos = [...sufijos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
const conHermanoSello = filas.filter(f => f.hermanosSello.some(h => h.sello));
const ratiosSello = conHermanoSello.flatMap(f => f.hermanosSello.filter(h => h.sello && h.market && f.tcgcsv).map(h => h.market / f.tcgcsv));
const tcgCercaDeSello = conHermanoSello.filter(f => f.tcgMarket > 0 && f.tcgcsv > 0 && f.hermanosSello.some(h => h.sello && h.market && Math.abs(h.market - f.tcgMarket) < Math.abs(f.tcgcsv - f.tcgMarket))).length;

// ── 5. Precio tcgcsv vs tcgpricelookup (actual) ───────────────────────────────
const ratioActual = emparejadas.filter(f => f.tcgMarket > 0 && f.tcgcsv > 0).map(f => f.tcgcsv / f.tcgMarket);
const ratioMejor = emparejadas.filter(f => f.tcgMarket > 0).map(f => { const v = (f.subtipos || []).filter(x => x.market != null); if (!v.length) return null; const c = v.sort((a, b) => Math.abs(a.market - f.tcgMarket) - Math.abs(b.market - f.tcgMarket))[0]; return c.market / f.tcgMarket; }).filter(x => x != null);

// ── 5b. Variantes de sello ENTRE SETS (liga, prerelease, campeonato…) ───────────────────────────────────────
// Los sellos suelen vivir en grupos de promos aparte, no en el set de la carta base: se busca el mismo nombre base + mismo número CON total
// ("025/165") en toda la categoría y se miden los hermanos que traen paréntesis.
const numeroCrudo = p => String(p.number || "").toUpperCase().replace(/\s+/g, "");
const nombreBase = p => normName(quitaParentesis(p.name));
const porNombreNumero = new Map();
for (const p of productos.values()) { if (!p.number) continue; const k = nombreBase(p) + "|" + numeroCrudo(p); if (!porNombreNumero.has(k)) porNombreNumero.set(k, []); porNombreNumero.get(k).push(p); }
const grupoNombre = new Map(grupos.map(g => [g.groupId, g.name]));
const hallazgos = [];   // {fila, hermano, tipo, multiplo}
const tiposSello = new Map(), gruposSello = new Map();
let filasConSello = 0, filasConPatron = 0;
for (const f of emparejadas) {
  const base = productos.get(f.productId); if (!base) continue;
  const key = nombreBase(base) + "|" + numeroCrudo(base);
  const hermanos = (porNombreNumero.get(key) || []).filter(p => p.productId !== base.productId && sufijoParentesis(p.name));
  let sello = false, patron = false;
  const precioBase = f.tcgcsv;
  for (const h of hermanos) {
    const d = describirVariante({ juego: "pokemon", sufijo: sufijoParentesis(h.name), grupo: grupoNombre.get(h.groupId) });
    const ph = subAuto(precios.get(h.productId) || [])?.market ?? null;
    if (d.tipo === "sello") { sello = true; tiposSello.set(d.clave, (tiposSello.get(d.clave) || 0) + 1); gruposSello.set(grupoNombre.get(h.groupId), (gruposSello.get(grupoNombre.get(h.groupId)) || 0) + 1); hallazgos.push({ fila: f, hermano: h, tipo: d.clave, sufijo: sufijoParentesis(h.name), grupo: grupoNombre.get(h.groupId), precio: ph, multiplo: precioBase > 0 && ph != null ? Math.round(ph / precioBase * 10) / 10 : null }); }
    else if (d.tipo === "patron") patron = true;
  }
  if (sello) filasConSello++; if (patron) filasConPatron++;
}
const mults = hallazgos.map(h => h.multiplo).filter(x => x != null);
const topSello = [...hallazgos].filter(h => h.multiplo != null).sort((a, b) => b.multiplo - a.multiplo).slice(0, 12);
const porTipoFila = new Map(); for (const h of hallazgos) { const k = h.fila.id + "|" + h.tipo; porTipoFila.set(k, 1); }

// ── 5c. Promos de liga / prerelease / campeonato del MISMO NOMBRE (otro número) ────────────────────────────
// Las promos de liga modernas suelen ser cartas aparte (numeración de promo), no un reprint con el mismo número: se enlazan por nombre.
const porNombre = new Map();
for (const p of productos.values()) { const suf = sufijoParentesis(p.name); if (!suf) continue; const d = describirVariante({ juego: "pokemon", sufijo: suf, grupo: grupoNombre.get(p.groupId) }); if (d.tipo !== "sello") continue; const k = nombreBase(p); if (!porNombre.has(k)) porNombre.set(k, []); porNombre.get(k).push({ p, d }); }
const hallazgosNombre = []; const tipoNombre = new Map(), filasNombre = new Map(), grupoNombreCnt = new Map();
for (const f of emparejadas) {
  const base = productos.get(f.productId); if (!base) continue;
  const cand = (porNombre.get(nombreBase(base)) || []).filter(x => x.p.productId !== base.productId && numeroCrudo(x.p) !== numeroCrudo(base));
  for (const { p, d } of cand) {
    const ph = subAuto(precios.get(p.productId) || [])?.market ?? null;
    tipoNombre.set(d.clave, (tipoNombre.get(d.clave) || 0) + 1);
    filasNombre.set(d.clave, (filasNombre.get(d.clave) || new Set()).add(f.id));
    grupoNombreCnt.set(grupoNombre.get(p.groupId), (grupoNombreCnt.get(grupoNombre.get(p.groupId)) || 0) + 1);
    hallazgosNombre.push({ fila: f, p, tipo: d.clave, sufijo: sufijoParentesis(p.name), grupo: grupoNombre.get(p.groupId), precio: ph, multiplo: f.tcgcsv > 0 && ph != null ? Math.round(ph / f.tcgcsv * 10) / 10 : null });
  }
}
const filasConAlguna = new Set(hallazgosNombre.map(h => h.fila.id)).size;
const multsNombre = hallazgosNombre.map(h => h.multiplo).filter(x => x != null);
const topNombre = [...hallazgosNombre].filter(h => h.multiplo != null && h.tipo === "liga").sort((a, b) => b.multiplo - a.multiplo).slice(0, 10);

// ── 6. Archivo histórico ─────────────────────────────────────────────────────
const archivo = { disponibles: [], faltan: [], error: null, nuevo: null, antiguo: null };
const meses = []; for (let y = 2024, m = 2; y < 2026 || (y === 2026 && m <= 11); m++) { if (m > 12) { m = 1; y++; } meses.push(`${y}-${String(m).padStart(2, "0")}-${y === 2024 && m === 2 ? "08" : "01"}`); }
const urlArchivo = f => `${ARCHIVO}/prices-${f}.ppmd.7z`;
await enLote(meses, async f => {
  const r = await fetch(urlArchivo(f), { method: "HEAD", headers: UA, signal: AbortSignal.timeout(20000) }).catch(() => null);
  (r && r.ok ? archivo.disponibles : archivo.faltan).push(f + (r && r.ok && r.headers.get("content-length") ? ` (${Math.round(Number(r.headers.get("content-length")) / 1048576 * 10) / 10} MB)` : ""));
});
archivo.disponibles.sort(); archivo.faltan.sort();
function leerArchivo(fecha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tcgcsv-" + fecha + "-"));
  return (async () => {
    const r = await fetch(urlArchivo(fecha), { headers: UA, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error("HTTP " + r.status + " al bajar el archivo " + fecha);
    const f7 = path.join(dir, "a.7z"); fs.writeFileSync(f7, Buffer.from(await r.arrayBuffer()));
    const x = spawnSync("7z", ["x", "-y", `-o${dir}/x`, f7], { encoding: "utf-8" });
    if (x.status !== 0) throw new Error("7z falló: " + String(x.stderr || x.stdout).slice(0, 200));
    const porProducto = new Map(); let archivos = 0, ejemploRuta = null; const muestra = [];
    const caminar = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) caminar(p); else if (muestra.length < 6 && (muestra.push(path.relative(dir, p)), false)) { /* solo para diagnosticar la estructura */ } else if (/(^|[\\/])prices(\.json)?$/.test(p) && p.split(path.sep).includes(String(CAT))) { archivos++; ejemploRuta ||= path.relative(dir, p); try { for (const r2 of JSON.parse(fs.readFileSync(p, "utf-8")).results || []) { if (!porProducto.has(r2.productId)) porProducto.set(r2.productId, []); porProducto.get(r2.productId).push({ sub: r2.subTypeName || "", market: r2.marketPrice ?? null }); } } catch (e) { avisos.push("no pude leer " + p); } } } };
    caminar(path.join(dir, "x"));
    return { fecha, bytes: fs.statSync(f7).size, archivos, ejemploRuta, muestra, productos: porProducto.size, porProducto };
  })();
}
try { archivo.nuevo = await leerArchivo(FECHA_ARCHIVO); } catch (e) { archivo.error = String(e.message).slice(0, 300); }
try { archivo.antiguo = await leerArchivo(FECHA_ANTIGUA); } catch (e) { archivo.errorAntiguo = String(e.message).slice(0, 300); }
// Comparación con el snapshot diario de tcgpricelookup de la misma fecha
const invCompleto = JSON.parse(fs.readFileSync(INV, "utf-8")); const porId = new Map(invCompleto.map(c => [c.id, c]));
const ratiosArchivo = [];
if (archivo.nuevo) for (const f of emparejadas) {
  const lista = archivo.nuevo.porProducto.get(f.productId); if (!lista) continue;
  const snap = (porId.get(f.id)?.priceHistory || []).find(h => h.date === FECHA_ARCHIVO && h.src === "tpl" && h.market > 0); if (!snap) continue;
  const mismo = lista.find(x => x.sub === f.sub && x.market != null) || subAuto(lista); if (!mismo?.market) continue;
  ratiosArchivo.push(mismo.market / snap.market);
}
const cubiertas = archivo.antiguo ? emparejadas.filter(f => archivo.antiguo.porProducto.has(f.productId)).length : null;

// ── Informe ───────────────────────────────────────────────────────────────────
const pct = (n, d) => (d ? `${Math.round(100 * n / d)} %` : "—");
const md = [];
md.push(`# Sonda tcgcsv → Pokémon (${hoyISO})`, "", `Generado por \`modules/feed/scripts/sonda-tcgcsv-pokemon.mjs\`. Solo lectura. Categoría tcgcsv: **${CAT}** (${cat.name}), ${grupos.length} sets, ${productos.size} productos de carta, ${precios.size} con precio. Sets que fallaron al bajar: ${fallos}.`, "");
md.push("## 1. Emparejamiento del inventario (set + número + nombre)", "", "| Resultado | Filas | % |", "|---|---:|---:|");
md.push(`| Emparejadas con un solo producto | ${cuenta.unico} | ${pct(cuenta.unico, cuenta.total)} |`, `| Emparejadas con varios productos (se elige el que tiene más precios) | ${cuenta.multiple} | ${pct(cuenta.multiple, cuenta.total)} |`, `| Solo existe una versión con sello/promo del mismo nombre y número | ${cuenta.soloSello} | ${pct(cuenta.soloSello, cuenta.total)} |`, `| Set no encontrado | ${cuenta.sinSet} | ${pct(cuenta.sinSet, cuenta.total)} |`, `| Set encontrado pero no el número | ${cuenta.sinNumero} | ${pct(cuenta.sinNumero, cuenta.total)} |`, `| Número encontrado pero distinto nombre | ${cuenta.sinNombre} | ${pct(cuenta.sinNombre, cuenta.total)} |`, `| **Total filas activas** | ${cuenta.total} | |`, "");
for (const [k, v] of Object.entries(ejemplosFallo)) if (v.length) md.push(`Ejemplos «${k}»: ${v.join("; ")}`, "");
md.push("## 2. Acabados (subtipos con precio) en las filas emparejadas", "", "| Combinación de acabados con precio | Filas |", "|---|---:|", ...[...porFirma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `| ${k} | ${v} |`), "");
md.push(`Filas con **2 o más acabados con precio** (alcance del selector holo / reverse): **${conVarios.length}** de ${emparejadas.length} (${pct(conVarios.length, emparejadas.length)}).`, `De ellas, en ${masCercanoDistinto} de ${conTcg} el acabado cuyo precio está más cerca del precio actual de tcgpricelookup no es el que elige la regla automática (Normal > Holofoil > Reverse): ahí el selector cambiaría el precio mostrado.`, `Sets con más filas de varios acabados: ${[...fuenteGrupo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} (${v})`).join("; ") || "—"}.`, "");
md.push("## 3. Sellos y promos («icono de liga»)", "", `Sufijos entre paréntesis más frecuentes en los nombres de producto de Pokémon (cada uno es un producto aparte con su propio precio): ${topSufijos.map(([k, v]) => `${k} (${v})`).join(" · ")}.`, "", `Filas del inventario cuyo mismo nombre y número tiene un producto hermano con sello/promo en el mismo set: **${conHermanoSello.length}** (${pct(conHermanoSello.length, cuenta.total)}). Precio del hermano con sello ÷ precio del producto elegido: ${fmtRatio(ratiosSello)}. En ${tcgCercaDeSello} de esas filas el precio actual de tcgpricelookup está más cerca del hermano con sello que del producto elegido (posible emparejamiento contaminado).`, "");
// Desglose extra (el detalle por fila no se puede bajar del workflow desde el sandbox de desarrollo)
const contar = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const conCualquierHermano = filas.filter(f => f.hermanosSello.length);
md.push(`Filas con **cualquier** hermano entre paréntesis (mismo nombre y número en el set): ${conCualquierHermano.length}. Sufijos: ${contar(conCualquierHermano.flatMap(f => f.hermanosSello.map(h => h.sufijo))).slice(0, 10).map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}.`, "");
const soloSello = filas.filter(f => f.estado === "solo_sello");
md.push(`Las ${soloSello.length} filas «solo con sello»: sufijos ${contar(soloSello.flatMap(f => f.hermanosSello.map(h => h.sufijo))).slice(0, 8).map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}; ejemplos: ${soloSello.slice(0, 6).map(f => `${f.name} ${f.number} (${f.set})`).join("; ") || "—"}.`, "");
md.push("### Filas sin emparejar, por set del inventario", "", ...["sin_set", "sin_numero", "sin_nombre"].map(est => `- **${est}** (${filas.filter(f => f.estado === est).length}): ${contar(filas.filter(f => f.estado === est).map(f => f.set)).slice(0, 8).map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}`), "");
md.push("## 4. Precio tcgcsv vs tcgpricelookup actual (tcgMarket)", "", `- Con la regla automática de acabado: ${fmtRatio(ratioActual)}; dentro de ±10 %: ${dentro(ratioActual, 0.1)}; dentro de ±25 %: ${dentro(ratioActual, 0.25)}.`, `- Eligiendo para cada fila el acabado más cercano (cota optimista): ${fmtRatio(ratioMejor)}; dentro de ±10 %: ${dentro(ratioMejor, 0.1)}.`, "");
md.push("## 5. Variantes de sello entre sets (liga, prerelease, campeonato…)", "");
md.push(`Regla probada: mismo nombre base + mismo número con total (p. ej. «025/165») en **cualquier grupo** de la categoría, con un paréntesis en el nombre del producto hermano.`, "");
md.push(`- Filas del inventario con **al menos una variante de sello** en otro grupo (o en el mismo): **${filasConSello}** de ${emparejadas.length} (${pct(filasConSello, emparejadas.length)}). Con patrón (Poké Ball, Master Ball, logo de tipo…) además: ${filasConPatron}.`);
md.push(`- Tipos de sello encontrados (hermanos): ${[...tiposSello.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(" · ") || "ninguno"}.`);
md.push(`- Grupos donde viven: ${[...gruposSello.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}.`);
md.push(`- Precio del sello ÷ precio de la carta base (acabado automático): ${fmtRatio(mults)}.`);
if (topSello.length) { md.push("", "| Carta | Set | Sello | Grupo del sello | Base | Sello | × |", "|---|---|---|---|---:|---:|---:|", ...topSello.map(h => `| ${h.fila.name} ${h.fila.number} | ${h.fila.set} | ${h.tipo} (${h.sufijo}) | ${h.grupo} | ${h.fila.tcgcsv != null ? "$" + r2(h.fila.tcgcsv) : "—"} | ${h.precio != null ? "$" + r2(h.precio) : "—"} | ${h.multiplo} |`), ""); }
md.push("### 5c. Promos del mismo nombre y otro número (así viven las de liga modernas)", "");
md.push(`- Filas del inventario con **alguna promo de sello del mismo nombre**: **${filasConAlguna}** de ${emparejadas.length} (${pct(filasConAlguna, emparejadas.length)}). Por tipo (filas distintas): ${[...filasNombre.entries()].sort((a, b) => b[1].size - a[1].size).map(([k, v]) => `${k} (${v.size})`).join(" · ") || "ninguno"}.`);
md.push(`- Productos de sello enlazados por nombre: ${[...tipoNombre.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}. Grupos: ${[...grupoNombreCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}.`);
md.push(`- Precio de esas promos ÷ precio de tu carta: ${fmtRatio(multsNombre)}.`);
if (topNombre.length) md.push("", "Promos de **liga** más caras frente a tu carta:", "", "| Tu carta | Set | Promo de liga | Grupo | Tu carta $ | Promo $ | × |", "|---|---|---|---|---:|---:|---:|", ...topNombre.map(h => `| ${h.fila.name} ${h.fila.number} | ${h.fila.set} | ${h.p.name.slice(0, 46)} | ${h.grupo} | ${h.fila.tcgcsv != null ? "$" + r2(h.fila.tcgcsv) : "—"} | ${h.precio != null ? "$" + r2(h.precio) : "—"} | ${h.multiplo} |`), "");
md.push("## 6. Archivo histórico de tcgcsv", "");
if (archivo.error) md.push(`- ⚠ Archivo ${FECHA_ARCHIVO}: ${archivo.error}`);
if (archivo.nuevo) md.push(`- Archivo ${FECHA_ARCHIVO}: ${(archivo.nuevo.bytes / 1048576).toFixed(1)} MB, ${archivo.nuevo.archivos} archivos de precios de la categoría ${CAT} (p. ej. \`${archivo.nuevo.ejemploRuta}\`), ${archivo.nuevo.productos} productos. Primeras rutas extraídas: ${archivo.nuevo.muestra.map(x => "\`" + x + "\`").join(", ")}.`);
if (archivo.nuevo) md.push(`- **Empalme con tcgpricelookup el ${FECHA_ARCHIVO}** (precio del archivo ÷ snapshot diario de esa fecha, mismo acabado): ${fmtRatio(ratiosArchivo)}; dentro de ±10 %: ${dentro(ratiosArchivo, 0.1)}; dentro de ±25 %: ${dentro(ratiosArchivo, 0.25)}.`);
if (archivo.antiguo) md.push(`- Archivo ${FECHA_ANTIGUA}: ${(archivo.antiguo.bytes / 1048576).toFixed(1)} MB, ${archivo.antiguo.productos} productos; ${cubiertas} de ${emparejadas.length} filas emparejadas ya existían ese día.`);
else md.push(`- ⚠ Archivo ${FECHA_ANTIGUA}: ${archivo.errorAntiguo || "no disponible"}`);
md.push(`- Un archivo por mes (día 1; el primero del archivo es el ${FECHA_ANTIGUA}): ${archivo.disponibles.length} de ${meses.length} disponibles${archivo.faltan.length ? `; faltan: ${archivo.faltan.join(", ")}` : ""}.`, "");
if (avisos.length) md.push("## Avisos", "", ...avisos.map(a => "- " + a), "");
fs.mkdirSync(path.dirname(SALIDA_MD), { recursive: true });
fs.writeFileSync(SALIDA_MD, md.join("\n"));
fs.writeFileSync(DETALLE, JSON.stringify({ generado: new Date().toISOString(), categoria: CAT, filas, sellos: hallazgos.map(h => ({ id: h.fila.id, name: h.fila.name, number: h.fila.number, set: h.fila.set, productId: h.hermano.productId, tipo: h.tipo, sufijo: h.sufijo, grupo: h.grupo, precio: h.precio, multiplo: h.multiplo })) }, null, 1));
console.log(md.join("\n"));
