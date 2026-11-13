// sonda-panoramas-2.mjs — Segunda pasada (13-nov-2026) del módulo Panoramas.
// La sonda 1 mapeó el mecanismo de cada fuente; esta baja a lo que hace falta
// para escribir los adaptadores: fechas reales de eventos (Santiago Cultura,
// CCLM), tamaño del paginador y variantes de inscripción de Red Nacional (RM),
// payload de Teatro Municipal, calendarios de GAM / M100 y la API de Noche de
// Museos. Guarda muestras completas en data/muestras-panoramas/2_*.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_JSON = path.join(__dirname, "..", "data", "sonda-panoramas-2.json");
const OUT_MD = path.join(__dirname, "..", "..", "..", "docs", "sonda-panoramas-2.md");
const MUESTRAS = path.join(__dirname, "..", "data", "muestras-panoramas");
const GAP_MS = 1000;
const UA = "angst-feed-sonda/1.0 ( https://github.com/cipinzas-hash/feeder )";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const ultimo = new Map();
const R = { generado: null, parcial: true, bloques: {} };

async function http(url, timeoutMs = 25000) {
  let host; try { host = new URL(url).host; } catch { return { ok: false, status: 0, error: "URL inválida", text: "" }; }
  const w = (ultimo.get(host) || 0) + GAP_MS - Date.now(); if (w > 0) await sleep(w); ultimo.set(host, Date.now());
  const c = new AbortController(); const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*", "Accept-Language": "es-CL,es;q=0.9" }, signal: c.signal, redirect: "follow" });
    const text = await res.text(); clearTimeout(t);
    return { ok: res.ok, status: res.status, type: res.headers.get("content-type") || "", text, finalUrl: res.url };
  } catch (e) { clearTimeout(t); return { ok: false, status: 0, error: String(e.message || e), text: "" }; }
}
function guardar(nombre, txt, max = 400000) { try { fs.mkdirSync(MUESTRAS, { recursive: true }); fs.writeFileSync(path.join(MUESTRAS, "2_" + nombre), String(txt).slice(0, max)); } catch (e) { log("no se guardó", nombre, e.message); } }
function jsonLdEventos(html) {
  const out = []; for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1].trim()); const ns = []; const e = n => { if (Array.isArray(n)) n.forEach(e); else if (n && typeof n === "object") { ns.push(n); if (n["@graph"]) e(n["@graph"]); } }; e(j);
      for (const n of ns) if ([].concat(n["@type"] || []).some(x => /Event$/i.test(String(x)))) out.push({ name: n.name, startDate: n.startDate, endDate: n.endDate, location: n.location && (n.location.name || n.location.address), offers: n.offers });
    } catch { /* json-ld roto */ }
  } return out;
}
const fechasEnTexto = h => [...new Set((h.match(/\b20\d\d-\d\d-\d\d(?:T[\d:]+)?\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+20\d\d)?/gi) || []))].slice(0, 12);
const tryJson = t => { try { return JSON.parse(t); } catch { return null; } };
const escribir = (parcial) => {
  R.generado = new Date().toISOString(); R.parcial = parcial;
  try { fs.writeFileSync(OUT_JSON, JSON.stringify(R, null, 1)); } catch (e) { log("json", e.message); }
  const L = ["# Sonda 2 — módulo Panoramas", "", `Generado: ${R.generado}${parcial ? " · **PARCIAL**" : ""}`, ""];
  for (const [k, v] of Object.entries(R.bloques)) L.push(`## ${k}`, "", "```json", JSON.stringify(v, null, 1).slice(0, 5000), "```", "");
  try { fs.writeFileSync(OUT_MD, L.join("\n")); } catch (e) { log("md", e.message); }
};
process.on("SIGTERM", () => { escribir(true); process.exit(1); });

async function bloque(nombre, fn) { log("\n==", nombre); try { R.bloques[nombre] = await fn(); } catch (e) { R.bloques[nombre] = { error: String(e.message || e) }; } escribir(true); }

// ── Santiago Cultura (EventON sobre WordPress) ─────────────────────────────
await bloque("santiagocultura", async () => {
  const B = "https://www.santiagocultura.cl", o = {};
  const l = await http(`${B}/wp-json/wp/v2/ajde_events?per_page=30&orderby=modified&order=desc`);
  const j = tryJson(l.text); o.listado = { status: l.status, n: Array.isArray(j) ? j.length : null, claves: Array.isArray(j) && j[0] ? Object.keys(j[0]) : null };
  const items = Array.isArray(j) ? j.map(e => ({ id: e.id, link: e.link, titulo: e.title && e.title.rendered, publicado: e.date, modificado: e.modified, meta: e.meta, tipos: e.event_type })) : [];
  o.muestraListado = items.slice(0, 8);
  guardar("sc_listado.json", l.text);
  for (const ep of ["/wp-json/eventon/v1/events", "/wp-json/eventon/v1/data", "/wp-json/wp/v2/event_type?per_page=50", "/wp-json/wp/v2/event_location?per_page=20"]) {
    const r = await http(B + ep); o[ep] = { status: r.status, type: r.type, bytes: (r.text || "").length, inicio: (r.text || "").slice(0, 600) }; if (r.ok) guardar("sc_" + ep.replace(/[^a-z0-9]+/gi, "_") + ".json", r.text, 60000);
  }
  o.detalles = [];
  for (const it of items.slice(0, 3)) {
    const d = await http(it.link); const ev = jsonLdEventos(d.text || "");
    o.detalles.push({ link: it.link, status: d.status, jsonLdEventos: ev, fechasEnTexto: fechasEnTexto(d.text || ""), tieneEvcal: /evcal|eventon/i.test(d.text || ""), unixEvcal: (d.text || "").match(/evcal_(?:s|e)row["':\s=]+["']?\d{9,10}/g) });
    if (d.ok) guardar(`sc_detalle_${it.id}.html`, d.text);
  }
  const sm = await http(`${B}/wp-sitemap-posts-ajde_events-1.xml`);
  if (sm.ok) { const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)]; o.sitemap = { urls: locs.length, ultimosLastmod: locs.slice(-5).map(m => m[2]) }; }
  return o;
});

// ── CCLM (WordPress, tipos propios) ────────────────────────────────────────
await bloque("cclm", async () => {
  const B = "https://www.cclm.cl", o = {};
  for (const t of ["actividad", "exposicion", "festival", "cineteca_nacional", "tipo_actividad"]) {
    const r = await http(`${B}/wp-json/wp/v2/${t}?per_page=${t === "actividad" ? 20 : 4}&orderby=date&order=desc`);
    const j = tryJson(r.text);
    o[t] = { status: r.status, n: Array.isArray(j) ? j.length : null, claves: Array.isArray(j) && j[0] ? Object.keys(j[0]) : null, acf: Array.isArray(j) && j[0] ? (j[0].acf || j[0].meta || null) : null, muestra: Array.isArray(j) ? j.slice(0, 4).map(e => ({ id: e.id, link: e.link, titulo: e.title && e.title.rendered, fecha: e.date, mod: e.modified })) : (r.text || "").slice(0, 300) };
    if (r.ok) guardar(`cclm_${t}.json`, r.text, 120000);
  }
  const first = o.actividad && o.actividad.muestra && o.actividad.muestra[0];
  if (first && first.link) { const d = await http(first.link); o.detalle = { link: first.link, status: d.status, jsonLdEventos: jsonLdEventos(d.text || ""), fechasEnTexto: fechasEnTexto(d.text || "") }; if (d.ok) guardar("cclm_detalle_actividad.html", d.text); }
  for (const p of ["/agenda/", "/cartelera/", "/programacion/"]) { const r = await http(B + p); o["pagina" + p] = { status: r.status, bytes: (r.text || "").length, fechas: fechasEnTexto(r.text || "") }; if (r.ok) { guardar("cclm_pagina" + p.replace(/\W/g, "_") + ".html", r.text); break; } }
  return o;
});

// ── Red Nacional (artdec), filtro RM: paginador completo + inscripción ────
await bloque("artdec_rm", async () => {
  const B = "https://www.artdec.gob.cl/cartelera/red-nacional?region=RM", o = { paginas: [], variantesInscripcion: {} };
  let ultimaPagina = null, filas = 0, conInscripcion = 0, muestraInsc = null;
  for (let p = 0; p < 40; p++) {
    const r = await http(p ? `${B}&page=${p}` : B);
    if (!r.ok) { o.paginas.push({ p, status: r.status }); break; }
    if (p === 0) { const nums = [...r.text.matchAll(/[?&]page=(\d+)/g)].map(m => +m[1]); o.maxPageEnPager = nums.length ? Math.max(...nums) : null; guardar("artdec_rm_p0_completo.html", r.text); }
    const rows = r.text.split('<div class="views-row">').slice(1); filas += rows.length;
    const fechas = rows.map(x => (x.match(/<time>([^<]+)<\/time>/) || [])[1]).filter(Boolean);
    for (const x of rows) { const m = x.match(/inscription-container">\s*<div class="([^"]+)">([^<]*)/); const k = m ? `${m[1]} · ${m[2].trim()}` : "(sin bloque)"; o.variantesInscripcion[k] = (o.variantesInscripcion[k] || 0) + 1; if (m && !/no-inscription/.test(m[1])) { conInscripcion++; if (!muestraInsc) muestraInsc = x.slice(0, 4000); } }
    o.paginas.push({ p, filas: rows.length, primeraFechaInicio: fechas[0], ultimaFechaInicio: fechas[fechas.length - 1] });
    ultimaPagina = p; if (rows.length < 10) break;
  }
  o.filasTotales = filas; o.ultimaPaginaLeida = ultimaPagina; o.conInscripcion = conInscripcion;
  if (muestraInsc) guardar("artdec_fila_con_inscripcion.html", muestraInsc);
  return o;
});

// ── Teatro Municipal, GAM, M100 (páginas completas para decidir parser) ───
await bloque("paginas_html", async () => {
  const o = {};
  for (const [id, url] of [["teatromunicipal", "https://ticketera.municipal.cl/entradas"], ["gam_calendario", "https://gam.cl/es/calendario/"], ["gam_calendario_b", "https://gam.cl/calendario/"], ["m100_semana", "https://www.m100.cl/esta-semana-en-m100/"], ["m100_programacion", "https://www.m100.cl/programacion/educacion/"]]) {
    const r = await http(url, 40000); const t = r.text || "";
    o[id] = { status: r.status, finalUrl: r.finalUrl, bytes: t.length, nuxtData: /__NUXT_DATA__|window\.__NUXT__/.test(t), jsonLdEventos: jsonLdEventos(t).length, fechas: fechasEnTexto(t).slice(0, 6) };
    if (r.ok) guardar(id + ".html", t, id === "teatromunicipal" ? 900000 : 300000);
  }
  return o;
});

// ── Noche de Museos: API propia ────────────────────────────────────────────
await bloque("nochedemuseos_api", async () => {
  const o = {};
  for (const u of ["https://api.nochedemuseos.cl", "https://api.nochedemuseos.cl/activities", "https://api.nochedemuseos.cl/actividades", "https://api.nochedemuseos.cl/events", "https://api.nochedemuseos.cl/api/activities", "https://api.nochedemuseos.cl/graphql"]) {
    const r = await http(u); o[u] = { status: r.status, type: r.type, inicio: (r.text || "").slice(0, 400) }; if (r.ok) guardar("ndm_" + u.replace(/\W+/g, "_") + ".txt", r.text, 80000);
  }
  const home = await http("https://nochedemuseos.cl/"); const js = [...(home.text || "").matchAll(/(?:src|href)=["']([^"']*_nuxt[^"']+\.js)["']/g)].map(m => new URL(m[1], "https://nochedemuseos.cl/").href).slice(0, 6);
  o.rutasEnBundles = [];
  for (const s of js) { const r = await http(s, 40000); if (r.ok) o.rutasEnBundles.push(...new Set([...r.text.matchAll(/["'`](\/(?:activit|actividad|event|espacio|museo|region|comuna|search|filter|programa)[a-z0-9_\/-]{0,40})["'`]/gi)].map(m => m[1]))); }
  o.rutasEnBundles = [...new Set(o.rutasEnBundles)].slice(0, 40);
  return o;
});

escribir(false);
log("\nlisto");
