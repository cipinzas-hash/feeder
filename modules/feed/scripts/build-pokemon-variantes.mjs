// Catálogo de VARIANTES de Pokémon por set, desde tcgcsv.com (espejo de TCGplayer). Variantes 20-nov-2026.
//
// Para cada carta con 2 o más variantes arma la lista: acabados del mismo producto (Normal / Holofoil / Reverse Holofoil), productos
// hermanos del mismo set con patrón (Poke Ball, Master Ball, Energy Symbol…) y sellos de otros grupos (campeonato, evento, prerelease,
// liga) con el mismo nombre y el mismo número CON total («025/165»). NO enlaza por nombre solo: las promos de liga modernas son cartas
// aparte y se mostrarían como si fueran la misma carta (la sonda midió 348 de 887 filas con «promos del mismo nombre»: demasiado ruido).
//
// Salida (se commitea; datos públicos, no es el inventario):
//   modules/feed/data/pokemon-variantes/index.json    { generado, grupos: [{id, nombre, abrev, n}] }
//   modules/feed/data/pokemon-variantes/<groupId>.json { g, cartas: { "<num>|<nombre>": [ [pid, sub, sufijo, market, low, high, grupoSello|0, rareza] … ] } }
// Los precios son los del día de la corrida (el catálogo se regenera cada semana): el precio vigente de cada carta sigue viniendo del bot diario.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normNum, normName } from "../../pokecripto/lib/pricing.mjs";
import { describirVariante } from "../../pokecripto/lib/variantes-comunes.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..", "..", "..");
const SALIDA = process.env.VARIANTES_OUT || path.join(RAIZ, "modules", "feed", "data", "pokemon-variantes");
const REPORTE = process.env.VARIANTES_REPORTE || path.join(RAIZ, "docs", "pokemon-variantes-reporte.md");
const TCGCSV = "https://tcgcsv.com/tcgplayer";
const UA = { "User-Agent": "angst-feed-bot (github.com/cipinzas-hash/feeder)" };
const CONCURRENCIA = 6, TIMEOUT_MS = 30000;
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
const ext = (p, nombre) => { const e = (Array.isArray(p.extendedData) ? p.extendedData : []).find(x => String(x.name || x.displayName || "").toLowerCase() === nombre.toLowerCase()); return e && e.value != null ? String(e.value) : ""; };
const parentesis = s => ((String(s || "").match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1).trim()).filter(x => x && !/^\d+([/-]\d+)?$/.test(x)).pop()) || "";
const sinParentesis = s => String(s || "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
const r2 = n => (n == null ? null : Math.round(n * 100) / 100);
const precio = r => (r.marketPrice ?? r.midPrice ?? r.lowPrice ?? null);
const numCrudo = p => String(p.numero || "").toUpperCase().replace(/\s+/g, "");   // número con total, p. ej. "025/165"

const cats = (await getJson(`${TCGCSV}/categories`)).results || [];
const cat = cats.find(c => /^pok[eé]mon$/i.test(String(c.name || "").trim())) || cats.find(c => /pok[eé]mon/i.test(String(c.name || "")) && !/japan/i.test(c.name));
if (!cat) throw new Error("no encontré la categoría Pokémon en tcgcsv");
const CAT = cat.categoryId;
const grupos = (await getJson(`${TCGCSV}/${CAT}/groups`)).results || [];
const nombreGrupo = new Map(grupos.map(g => [g.groupId, g.name]));
const productos = [];                // {pid, nombre, base, numero, num (normalizado), grupo, rareza, sufijo}
const precios = new Map();           // pid -> [{sub, market, low, high}]
const { fallos } = await enLote(grupos, async g => {
  const [prods, prs] = await Promise.all([getJson(`${TCGCSV}/${CAT}/${g.groupId}/products`), getJson(`${TCGCSV}/${CAT}/${g.groupId}/prices`)]);
  for (const p of prods.results || []) {
    const numero = ext(p, "Number"); if (!numero && !ext(p, "Rarity")) continue;     // sellado
    productos.push({ pid: p.productId, nombre: p.name, base: normName(sinParentesis(p.name)), numero, num: normNum(numero), grupo: g.groupId, rareza: ext(p, "Rarity"), sufijo: parentesis(p.name) });
  }
  for (const r of prs.results || []) { if (!precios.has(r.productId)) precios.set(r.productId, []); precios.get(r.productId).push({ sub: r.subTypeName || "", market: precio(r), low: r.lowPrice ?? null, high: r.highPrice ?? null }); }
});
console.log(`Categoría ${CAT}: ${grupos.length} sets, ${productos.length} productos de carta, ${precios.size} con precio, ${fallos} sets fallidos`);
if (productos.length < Number(process.env.VARIANTES_MIN_PRODUCTOS || 1000) || fallos > grupos.length * 0.1) throw new Error(`datos insuficientes (${productos.length} productos, ${fallos} fallos): no se sobrescribe el catálogo`);

// Índices
const porGrupoNumNombre = new Map();     // `${grupo}|${num}|${base}` -> [productos]  (mismo set, mismo número, mismo nombre base)
const porNombreNumero = new Map();       // `${base}|${numCrudo}` -> [productos]       (cualquier grupo, número con total)
for (const p of productos) {
  const k1 = `${p.grupo}|${p.num}|${p.base}`; if (!porGrupoNumNombre.has(k1)) porGrupoNumNombre.set(k1, []); porGrupoNumNombre.get(k1).push(p);
  if (p.numero.includes("/")) { const k2 = `${p.base}|${numCrudo(p)}`; if (!porNombreNumero.has(k2)) porNombreNumero.set(k2, []); porNombreNumero.get(k2).push(p); }
}

const salida = new Map();               // grupo -> {clave: variantes[]}
const unicas = new Map();               // grupo -> {clave: [pid, subtipo, rareza]} de las cartas con UNA sola variante
const conteo = { cartas: 0, conVarias: 0, acabados: 0, patrones: 0, sellos: new Map() };
const variantesDe = (p, grupoSello) => (precios.get(p.pid) || []).map(r => [p.pid, r.sub, p.sufijo, r2(r.market), r2(r.low), r2(r.high), grupoSello || 0, p.rareza]);
for (const [k1, hermanos] of porGrupoNumNombre) {
  const base = hermanos.find(p => !p.sufijo) || hermanos[0];
  conteo.cartas++;
  const lista = [];
  for (const p of hermanos) lista.push(...variantesDe(p, 0));
  // sellos de OTROS grupos con el mismo nombre y número con total
  if (numCrudo(base).includes("/")) {
    for (const s of porNombreNumero.get(`${base.base}|${numCrudo(base)}`) || []) {
      if (s.grupo === base.grupo || !s.sufijo) continue;
      const d = describirVariante({ juego: "pokemon", sufijo: s.sufijo, grupo: nombreGrupo.get(s.grupo) });
      if (d.tipo !== "sello") continue;
      lista.push(...variantesDe(s, s.grupo)); conteo.sellos.set(d.clave, (conteo.sellos.get(d.clave) || 0) + 1);
    }
  }
  const conPrecio = lista.filter(v => v[3] != null || v[4] != null);
  if (new Set(lista.map(v => `${v[0]}|${v[1]}`)).size < 2 || conPrecio.length < 1) {
    // una sola variante: no se lista en `cartas`, pero se anota en `u` ([pid, subtipo, rareza]) para poder ubicar su historial de precios (lib/historial-pool.mjs)
    if (conPrecio.length >= 1) { if (!unicas.has(base.grupo)) unicas.set(base.grupo, {}); unicas.get(base.grupo)[`${base.num}|${base.base}`] = [conPrecio[0][0], conPrecio[0][1], conPrecio[0][7]]; }
    continue;
  }
  conteo.conVarias++;
  for (const v of lista) { const d = describirVariante({ juego: "pokemon", sub: v[1], sufijo: v[2], grupo: v[6] ? nombreGrupo.get(v[6]) : "" }); if (d.tipo === "patron") conteo.patrones++; else if (d.tipo === "acabado") conteo.acabados++; }
  if (!salida.has(base.grupo)) salida.set(base.grupo, {});
  salida.get(base.grupo)[`${base.num}|${base.base}`] = lista;
}

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });
let bytes = 0;
const indice = [];
for (const g of grupos) {
  const cartas = salida.get(g.groupId) || {}, u = unicas.get(g.groupId); if (!Object.keys(cartas).length && !u) continue;
  const texto = JSON.stringify({ g: g.groupId, cartas, ...(u ? { u } : {}) });
  fs.writeFileSync(path.join(SALIDA, `${g.groupId}.json`), texto); bytes += texto.length;
  indice.push({ id: g.groupId, nombre: g.name, abrev: g.abbreviation || "", n: Object.keys(cartas).length });
}
fs.writeFileSync(path.join(SALIDA, "index.json"), JSON.stringify({ generado: new Date().toISOString(), categoria: CAT, grupos: indice }));
fs.mkdirSync(path.dirname(REPORTE), { recursive: true });
const grandes = indice.sort((a, b) => b.n - a.n).slice(0, 5).map(x => `${x.nombre} (${x.n})`).join(" · ");
fs.writeFileSync(REPORTE, [
  `# Catálogo de variantes de Pokémon (${new Date().toISOString().slice(0, 10)})`, "",
  `Generado por \`modules/feed/scripts/build-pokemon-variantes.mjs\` desde tcgcsv (categoría ${CAT}).`, "",
  `- Sets leídos: ${grupos.length} (${fallos} fallidos) · productos de carta: ${productos.length} · identidades set+número+nombre: ${conteo.cartas}`,
  `- Cartas con **2 o más variantes**: ${conteo.conVarias} (${Math.round(100 * conteo.conVarias / Math.max(1, conteo.cartas))} %) en ${indice.length} sets`,
  `- Variantes por tipo: acabados ${conteo.acabados} · patrones ${conteo.patrones} · sellos de otros grupos ${[...conteo.sellos.entries()].map(([k, v]) => `${k} (${v})`).join(" · ") || "—"}`,
  `- Tamaño: ${(bytes / 1048576).toFixed(2)} MB en ${indice.length} archivos (uno por set, cargado solo al abrir una carta de ese set). Sets con más cartas con variantes: ${grandes}`,
  avisos.length ? `\n## Avisos\n${avisos.map(a => "- " + a).join("\n")}` : "",
].join("\n"));
console.log(fs.readFileSync(REPORTE, "utf-8"));
