// sonda-panoramas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// SONDA del módulo Panoramas (issue #17, 13-nov-2026). Mide, por fuente, el
// mecanismo de acceso REAL: motor (WordPress/Drupal/otro), API JSON, ICS, RSS,
// JSON-LD schema.org/Event, endpoints escondidos en los bundles JS, sitemap y
// robots.txt. Además guarda muestras de HTML/JSON en data/muestras-panoramas/
// para escribir los parsers de la Fase 1 sobre datos reales, no supuestos.
//
// Contrato (igual que las sondas de música): nada tira excepción, volumen bajo
// (~100 requests en total, ≥1 s entre requests al mismo host), reporte parcial
// si llega SIGTERM. Salida: data/sonda-panoramas.json y docs/sonda-panoramas.md.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
const OUT_JSON = process.env.SONDA_OUT_JSON || path.join(__dirname, "..", "data", "sonda-panoramas.json");
const OUT_MD = process.env.SONDA_OUT_MD || path.join(ROOT, "docs", "sonda-panoramas.md");
const MUESTRAS = process.env.SONDA_MUESTRAS || path.join(__dirname, "..", "data", "muestras-panoramas");
const GAP_MS = parseInt(process.env.SONDA_GAP_MS || "1000", 10);
const UA = "angst-feed-sonda/1.0 ( https://github.com/cipinzas-hash/feeder )";
const UA_BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const strip = s => (s || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const uniq = a => [...new Set(a)];

// ── Fuentes ─────────────────────────────────────────────────────────────────
// Las URLs de dominio que no estaban verificadas en el issue se marcan con
// "supuesta: true": si fallan, es dato (la URL real hay que descubrirla).
const FUENTES = [
  { id: "artdec", nombre: "Red Nacional (SNPC) — artdec.gob.cl", base: "https://www.artdec.gob.cl", paginas: ["/cartelera/red-nacional"], issue: 1 },
  { id: "santiagocultura", nombre: "Santiago Cultura (Municipalidad de Santiago)", base: "https://www.santiagocultura.cl", paginas: ["/agenda-cultural/"], issue: 2 },
  { id: "nochedemuseos", nombre: "Noche de Museos (plataforma nacional)", base: "https://www.nochedemuseos.cl", paginas: ["/"], issue: 0 },
  { id: "gobiernosantiago", nombre: "Gobierno de Santiago / Región Metropolitana", base: "https://www.gobiernosantiago.cl", paginas: ["/"], issue: 3 },
  { id: "teatromunicipal", nombre: "Teatro Municipal — ticketera", base: "https://ticketera.municipal.cl", paginas: ["/entradas"], issue: 4 },
  { id: "gam", nombre: "GAM", base: "https://gam.cl", paginas: ["/"], issue: 5, supuesta: true },
  { id: "m100", nombre: "Matucana 100", base: "https://m100.cl", paginas: ["/"], issue: 5, supuesta: true },
  { id: "cclm", nombre: "Centro Cultural La Moneda", base: "https://www.cclm.cl", paginas: ["/"], issue: 5, supuesta: true },
  { id: "recoleta", nombre: "Municipalidad de Recoleta", base: "https://www.recoleta.cl", paginas: ["/"], issue: 0, supuesta: true },
  { id: "providencia", nombre: "Municipalidad de Providencia", base: "https://www.providencia.cl", paginas: ["/"], issue: 0, supuesta: true },
  { id: "quintanormal", nombre: "Municipalidad de Quinta Normal", base: "https://www.muniqn.cl", paginas: ["/"], issue: 0, supuesta: true },
  { id: "sesale", nombre: "SeSale! (agregador)", base: "https://www.sesale.cl", paginas: ["/"], issue: 0, supuesta: true },
  { id: "panoramasapp", nombre: "Panoramas.app (agregador)", base: "https://panoramas.app", paginas: ["/"], issue: 0, supuesta: true },
];

const PROBES = [
  ["/wp-json/", "wp-json raíz"],
  ["/wp-json/tribe/events/v1/events?per_page=3", "The Events Calendar (API)"],
  ["/wp-json/wp/v2/types", "tipos de contenido WP"],
  ["/feed/", "RSS /feed/"],
  ["/?post_type=tribe_events&ical=1&eventDisplay=list", "ICS The Events Calendar"],
  ["/jsonapi", "Drupal JSON:API"],
  ["/sitemap.xml", "sitemap.xml"],
  ["/robots.txt", "robots.txt"],
];

// ── HTTP ────────────────────────────────────────────────────────────────────
const ultimoPorHost = new Map();
async function http(url, { timeoutMs = 20000, ua = UA } = {}) {
  let host = "";
  try { host = new URL(url).host; } catch { return { ok: false, status: 0, error: "URL inválida" }; }
  const espera = (ultimoPorHost.get(host) || 0) + GAP_MS - Date.now();
  if (espera > 0) await sleep(espera);
  ultimoPorHost.set(host, Date.now());
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "text/html,application/json,application/xml,text/calendar,*/*", "Accept-Language": "es-CL,es;q=0.9" }, signal: ctrl.signal, redirect: "follow" });
    const text = await res.text();
    clearTimeout(t);
    return { ok: res.ok, status: res.status, finalUrl: res.url, type: res.headers.get("content-type") || "", text, bytes: text.length, ms: Date.now() - t0 };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, error: String(e.message || e), text: "", bytes: 0, ms: Date.now() - t0 };
  }
}
// Reintenta con UA de navegador si el sitio rechaza al bot; deja constancia.
async function httpAdaptativo(url) {
  let r = await http(url);
  if ((r.status === 403 || r.status === 406 || r.status === 429) ) {
    const r2 = await http(url, { ua: UA_BROWSER });
    if (r2.ok) { r2.necesitaUABrowser = true; return r2; }
  }
  return r;
}

// ── Análisis de HTML ────────────────────────────────────────────────────────
function metaGenerator(html) {
  const m = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']generator["']/i);
  return m ? m[1] : null;
}
function motor(html) {
  const pistas = [];
  const g = metaGenerator(html);
  if (g) pistas.push(g);
  if (/wp-content|wp-includes/i.test(html)) pistas.push("WordPress (wp-content)");
  if (/Drupal\.settings|drupalSettings|data-drupal/i.test(html)) pistas.push("Drupal");
  if (/__NEXT_DATA__/.test(html)) pistas.push("Next.js");
  if (/__NUXT__|window\.__NUXT/.test(html)) pistas.push("Nuxt");
  if (/tribe-events|tribe_events/i.test(html)) pistas.push("The Events Calendar");
  if (/ng-version|<app-root/i.test(html)) pistas.push("Angular");
  if (/id=["']root["']|id=["']__next["']/.test(html) && !/<article|<li/i.test(html.slice(0, 4000))) pistas.push("posible SPA (contenido por JS)");
  return uniq(pistas);
}
function jsonLd(html) {
  const out = { bloques: 0, tipos: [], eventos: 0, muestra: [] };
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.bloques++;
    let j;
    try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const nodos = [];
    const empuja = n => { if (!n) return; if (Array.isArray(n)) n.forEach(empuja); else if (typeof n === "object") { nodos.push(n); if (n["@graph"]) empuja(n["@graph"]); } };
    empuja(j);
    for (const n of nodos) {
      const t = [].concat(n["@type"] || []);
      t.forEach(x => out.tipos.push(String(x)));
      if (t.some(x => /Event$/i.test(String(x)))) {
        out.eventos++;
        if (out.muestra.length < 3) out.muestra.push({ name: n.name, startDate: n.startDate, endDate: n.endDate, location: n.location && (n.location.name || n.location.address), free: n.isAccessibleForFree, offers: n.offers && (n.offers.price ?? n.offers[0]?.price) });
      }
    }
  }
  out.tipos = uniq(out.tipos);
  return out;
}
function enlacesDatos(html, base) {
  const abs = h => { try { return new URL(h, base).href; } catch { return h; } };
  const alt = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)].map(x => x[0]).filter(x => /rss|atom|calendar|json/i.test(x)).map(x => { const h = x.match(/href=["']([^"']+)["']/i); const t = x.match(/type=["']([^"']+)["']/i); return h ? { href: abs(h[1]), type: t ? t[1] : "" } : null; }).filter(Boolean);
  const ics = uniq([...html.matchAll(/href=["']([^"']+\.ics[^"']*|webcal:[^"']+)["']/gi)].map(x => abs(x[1])));
  return { alternates: alt.slice(0, 8), ics: ics.slice(0, 5) };
}
function formulariosGET(html) {
  const out = [];
  for (const f of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = f[1], body = f[2];
    const method = (attrs.match(/method=["']?(\w+)/i) || [, "get"])[1].toLowerCase();
    const action = (attrs.match(/action=["']([^"']*)["']/i) || [, ""])[1];
    const campos = [];
    for (const s of body.matchAll(/<select\b[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi)) {
      const opts = [...s[2].matchAll(/<option\b[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)].map(o => ({ value: o[1], texto: strip(o[2]) }));
      campos.push({ tipo: "select", name: s[1], opciones: opts.slice(0, 40), totalOpciones: opts.length });
    }
    for (const i of body.matchAll(/<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi)) {
      const tipo = (i[0].match(/type=["']([^"']+)["']/i) || [, "text"])[1];
      if (!/hidden|submit|button|image/i.test(tipo)) campos.push({ tipo: "input:" + tipo, name: i[1] });
    }
    if (campos.length) out.push({ method, action, campos });
  }
  return out;
}
function scriptsMismoOrigen(html, base) {
  const host = new URL(base).host;
  return uniq([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => { try { return new URL(m[1], base).href; } catch { return null; } }).filter(u => u && new URL(u).host === host));
}
function endpointsEnTexto(txt) {
  const hits = [];
  for (const m of txt.matchAll(/https?:\/\/[^"'`\s\\)]+/g)) if (/api|wp-json|graphql|\.json|firebase|supabase|algolia|contentful|strapi|directus/i.test(m[0])) hits.push(m[0]);
  for (const m of txt.matchAll(/["'`](\/(?:api|wp-json|graphql|_next\/data)[^"'`\s]{0,120})["'`]/g)) hits.push(m[1]);
  return uniq(hits);
}
function resumenProbe(r, etiqueta) {
  if (!r.ok) return { etiqueta, status: r.status, error: r.error || null };
  const t = r.text, ct = r.type;
  const out = { etiqueta, status: r.status, contentType: ct, bytes: r.bytes };
  if (/json/i.test(ct) || /^\s*[\[{]/.test(t)) {
    try {
      const j = JSON.parse(t);
      out.json = true;
      if (Array.isArray(j)) out.items = j.length;
      else { out.claves = Object.keys(j).slice(0, 12); if (j.namespaces) out.namespaces = j.namespaces; if (Array.isArray(j.events)) out.eventos = j.events.length; if (j.total != null) out.total = j.total; }
      if (/types/.test(etiqueta) && !Array.isArray(j)) out.tipos = Object.keys(j);
    } catch { out.json = false; }
  } else if (/BEGIN:VCALENDAR/.test(t)) { out.ics = true; out.vevents = (t.match(/BEGIN:VEVENT/g) || []).length; }
  else if (/<rss|<feed/i.test(t.slice(0, 600))) { out.feed = true; out.items = (t.match(/<item\b|<entry\b/gi) || []).length; }
  else if (/<urlset|<sitemapindex/i.test(t.slice(0, 800))) { out.sitemap = true; const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]); out.urls = locs.length; out.muestraEventos = locs.filter(u => /event|agenda|panorama|cartelera|actividad/i.test(u)).slice(0, 5); }
  else if (/robots/.test(etiqueta)) { const l = t.split(/\r?\n/); out.disallow = l.filter(x => /^disallow:/i.test(x)).length; out.crawlDelay = (l.find(x => /^crawl-delay/i.test(x)) || null); out.sitemaps = l.filter(x => /^sitemap:/i.test(x)).slice(0, 3); out.bloqueaTodo = l.some(x => /^disallow:\s*\/\s*$/i.test(x)); }
  else out.html = true;
  return out;
}
function guardarMuestra(nombre, contenido, max = 90000) {
  try { fs.mkdirSync(MUESTRAS, { recursive: true }); fs.writeFileSync(path.join(MUESTRAS, nombre), String(contenido).slice(0, max)); } catch (e) { log("no se pudo guardar muestra", nombre, e.message); }
}

// ── Sonda por fuente ────────────────────────────────────────────────────────
const resultados = [];
const extras = {};

async function sondearFuente(f) {
  log(`\n== ${f.id} ==`);
  const res = { id: f.id, nombre: f.nombre, base: f.base, supuesta: !!f.supuesta, paginas: [], probes: [], motor: [], jsonLd: null, enlaces: null, endpoints: [], formularios: [], veredicto: null };
  try {
    let htmlPrincipal = "";
    for (const p of f.paginas) {
      const r = await httpAdaptativo(f.base + p);
      const pag = { url: f.base + p, status: r.status, finalUrl: r.finalUrl || null, bytes: r.bytes, ms: r.ms, error: r.error || null, necesitaUABrowser: !!r.necesitaUABrowser };
      res.paginas.push(pag);
      log(`  ${p} → ${r.status} (${r.bytes} B)`);
      if (r.ok && r.text) {
        if (!htmlPrincipal) htmlPrincipal = r.text;
        guardarMuestra(`${f.id}${p.replace(/[^a-z0-9]+/gi, "_")}.html`, r.text);
      }
    }
    if (htmlPrincipal) {
      res.motor = motor(htmlPrincipal);
      res.jsonLd = jsonLd(htmlPrincipal);
      res.enlaces = enlacesDatos(htmlPrincipal, f.base);
      res.formularios = formulariosGET(htmlPrincipal).slice(0, 4);
      // endpoints escondidos en HTML y en hasta 4 bundles JS del mismo origen
      let eps = endpointsEnTexto(htmlPrincipal);
      for (const src of scriptsMismoOrigen(htmlPrincipal, f.base).slice(0, 4)) {
        const js = await http(src, { timeoutMs: 25000 });
        if (js.ok) eps = eps.concat(endpointsEnTexto(js.text));
      }
      res.endpoints = uniq(eps).slice(0, 20);
    }
    // Probes genéricos (solo si el sitio respondió: evita gastar requests en dominios muertos)
    if (res.paginas.some(p => p.status >= 200 && p.status < 400)) {
      for (const [rel, etiqueta] of PROBES) {
        const r = await http(f.base + rel);
        const s = resumenProbe(r, etiqueta);
        res.probes.push(s);
        if (r.ok && /json|BEGIN:VCALENDAR|<rss|<feed/i.test(r.type + r.text.slice(0, 200)) && !/robots|sitemap/.test(etiqueta)) guardarMuestra(`${f.id}_probe_${etiqueta.replace(/[^a-z0-9]+/gi, "_")}.txt`, r.text, 40000);
      }
    }
    res.veredicto = veredicto(res);
  } catch (e) {
    res.error = String(e.message || e);
    res.veredicto = "error de la sonda: " + res.error;
  }
  resultados.push(res);
  log(`  veredicto: ${res.veredicto}`);
  return res;
}

function veredicto(r) {
  const ok = (et) => r.probes.find(p => p.etiqueta === et && p.status === 200);
  const tribe = ok("The Events Calendar (API)");
  if (tribe && tribe.json && (tribe.eventos > 0 || tribe.claves?.includes("events"))) return "A · JSON nativo (The Events Calendar)";
  const ics = ok("ICS The Events Calendar");
  if (ics && ics.ics) return "A · ICS";
  if (r.jsonLd && r.jsonLd.eventos > 0) return "B · JSON-LD schema.org/Event en la página";
  const ten = r.enlaces && (r.enlaces.ics.length || r.enlaces.alternates.some(a => /calendar|rss|atom/i.test(a.type)));
  if (ten) return "A/B · ICS o RSS enlazado desde la página";
  const wp = ok("tipos de contenido WP");
  if (wp && wp.json) return "A− · API WordPress (revisar si hay tipo de contenido de eventos)";
  if (r.endpoints.length) return "A? · endpoints candidatos en el código JS (ver lista)";
  if (!r.paginas.some(p => p.status >= 200 && p.status < 400)) return "✗ no responde / URL por descubrir";
  return "C · HTML (scraping)";
}

// ── Casos especiales ────────────────────────────────────────────────────────
async function profundizarArtdec() {
  const r = { filtros: null, regionParam: null, paginas: [] };
  try {
    const base = "https://www.artdec.gob.cl/cartelera/red-nacional";
    const p0 = await httpAdaptativo(base);
    if (!p0.ok) { extras.artdec = { error: "no respondió " + p0.status }; return; }
    const forms = formulariosGET(p0.text);
    r.filtros = forms;
    // Busca el select de región y la opción "Metropolitana"
    let param = null, valor = null;
    for (const f of forms) for (const c of f.campos) if (c.tipo === "select") {
      const op = (c.opciones || []).find(o => /metropolitana/i.test(o.texto));
      if (op) { param = c.name; valor = op.value; }
    }
    r.regionParam = param ? { name: param, value: valor } : null;
    const contar = html => ({ viewsRow: (html.match(/views-row/g) || []).length, hastaEl: (html.match(/\bhasta el\b/gi) || []).length, eventoVigente: (html.match(/Evento Vigente/gi) || []).length });
    r.paginas.push({ url: base, ...contar(p0.text) });
    if (param) {
      for (const n of [0, 1]) {
        const u = `${base}?${encodeURIComponent(param)}=${encodeURIComponent(valor)}${n ? "&page=" + n : ""}`;
        const pr = await httpAdaptativo(u);
        r.paginas.push({ url: u, status: pr.status, ...(pr.ok ? contar(pr.text) : {}) });
        if (pr.ok) guardarMuestra(`artdec_filtrado_metropolitana_p${n}.html`, pr.text);
        // primer evento: guarda su detalle
        if (pr.ok && n === 0) {
          const link = [...pr.text.matchAll(/href=["'](\/[^"']*(?:evento|actividad|cartelera)[^"']*)["']/gi)].map(m => m[1]).find(h => !/red-nacional\??$/.test(h) && h.split("/").length > 2);
          if (link) { const d = await httpAdaptativo("https://www.artdec.gob.cl" + link); r.detalle = { url: link, status: d.status, jsonLd: d.ok ? jsonLd(d.text) : null }; if (d.ok) guardarMuestra("artdec_detalle_evento.html", d.text); }
        }
      }
    }
  } catch (e) { r.error = String(e.message || e); }
  extras.artdec = r;
}

async function profundizarSantiagoCultura() {
  const r = {};
  try {
    const base = "https://www.santiagocultura.cl";
    const p = await httpAdaptativo(base + "/agenda-cultural/");
    if (!p.ok) { extras.santiagocultura = { error: "no respondió " + p.status }; return; }
    const links = uniq([...p.text.matchAll(/href=["'](https?:\/\/(?:www\.)?santiagocultura\.cl\/[^"']+)["']/gi)].map(m => m[1])).filter(u => /evento|agenda|actividad|\/20\d\d\//i.test(u) && !/agenda-cultural\/?$/.test(u));
    r.enlacesDeEventos = links.slice(0, 8);
    r.formularios = formulariosGET(p.text).slice(0, 3);
    if (links[0]) { const d = await httpAdaptativo(links[0]); r.detalle = { url: links[0], status: d.status, jsonLd: d.ok ? jsonLd(d.text) : null, motor: d.ok ? motor(d.text) : [] }; if (d.ok) guardarMuestra("santiagocultura_detalle_evento.html", d.text); }
    // WP: tipos de contenido y búsqueda de un tipo "evento"
    const tipos = await http(base + "/wp-json/wp/v2/types");
    if (tipos.ok) {
      try {
        const j = JSON.parse(tipos.text);
        r.tiposWP = Object.entries(j).map(([k, v]) => ({ k, rest_base: v.rest_base, nombre: v.name }));
        const cand = r.tiposWP.find(t => /event|agenda|actividad|panorama/i.test(t.k + t.rest_base + t.nombre));
        if (cand) { const ev = await http(`${base}/wp-json/wp/v2/${cand.rest_base}?per_page=3`); r.tipoEventos = { ...cand, status: ev.status, muestra: ev.ok ? ev.text.slice(0, 1500) : null }; if (ev.ok) guardarMuestra("santiagocultura_wp_eventos.json", ev.text, 40000); }
      } catch { /* respuesta no JSON */ }
    }
  } catch (e) { r.error = String(e.message || e); }
  extras.santiagocultura = r;
}

async function descubrirRedAlameda() {
  const r = {};
  try {
    const u = "https://www.gobiernosantiago.cl/2026/06/09/gobierno-de-santiago-y-mas-de-50-instituciones-lanzan-red-para-activar-la-eje-alameda-como-corredor-cultural/";
    const p = await httpAdaptativo(u);
    r.status = p.status;
    if (p.ok) {
      const hrefs = uniq([...p.text.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]));
      r.enlacesExternos = hrefs.filter(h => !/gobiernosantiago\.cl|facebook|twitter|instagram|youtube|linkedin|wa\.me|whatsapp/i.test(h)).slice(0, 15);
      r.mencionAlameda = hrefs.filter(h => /alameda/i.test(h)).slice(0, 8);
    }
  } catch (e) { r.error = String(e.message || e); }
  extras.redAlameda = r;
}

// ── Reporte ─────────────────────────────────────────────────────────────────
function escribir(parcial = false) {
  const out = { generado: new Date().toISOString(), parcial, fuentes: resultados, extras };
  try { fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true }); fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 1)); } catch (e) { log("no se pudo escribir json", e.message); }
  const L = [];
  L.push("# Sonda — módulo Panoramas (issue #17)", "");
  L.push(`Generado: ${out.generado}${parcial ? " · **PARCIAL**" : ""}`, "");
  L.push("Clave del veredicto: **A** API/JSON/ICS · **B** JSON-LD · **C** HTML (scraping) · **✗** no responde.", "");
  L.push("| Fuente | HTTP | Motor | Veredicto |", "|---|---|---|---|");
  for (const r of resultados) {
    const http0 = r.paginas[0] ? (r.paginas[0].status || r.paginas[0].error || "—") : "—";
    L.push(`| ${r.nombre}${r.supuesta ? " *(URL supuesta)*" : ""} | ${http0} | ${(r.motor || []).join(", ") || "—"} | ${r.veredicto || "—"} |`);
  }
  for (const r of resultados) {
    L.push("", `## ${r.nombre}`, "", `- Base: ${r.base}`);
    for (const p of r.paginas) L.push(`- Página \`${p.url}\` → ${p.status || p.error}${p.finalUrl && p.finalUrl !== p.url ? ` (redirige a ${p.finalUrl})` : ""}, ${p.bytes} B${p.necesitaUABrowser ? " · **requiere User-Agent de navegador**" : ""}`);
    if (r.jsonLd) L.push(`- JSON-LD: ${r.jsonLd.bloques} bloques, tipos [${r.jsonLd.tipos.join(", ")}], eventos ${r.jsonLd.eventos}`);
    if (r.jsonLd && r.jsonLd.muestra.length) L.push("  - muestra: `" + JSON.stringify(r.jsonLd.muestra[0]) + "`");
    if (r.enlaces && (r.enlaces.ics.length || r.enlaces.alternates.length)) L.push(`- Enlaces de datos: ICS ${JSON.stringify(r.enlaces.ics)} · alternates ${JSON.stringify(r.enlaces.alternates)}`);
    if (r.endpoints && r.endpoints.length) L.push(`- Endpoints candidatos en HTML/JS: ${r.endpoints.slice(0, 10).map(e => "`" + e + "`").join(", ")}`);
    if (r.formularios && r.formularios.length) L.push(`- Formularios: ${r.formularios.map(f => `${f.method.toUpperCase()} ${f.action || "(misma URL)"} [${f.campos.map(c => c.name).join(", ")}]`).join(" · ")}`);
    if (r.probes.length) {
      L.push("- Probes:");
      for (const p of r.probes) L.push(`  - ${p.etiqueta}: ${p.status || p.error || "—"}${p.json ? " JSON" : ""}${p.ics ? ` ICS(${p.vevents} eventos)` : ""}${p.feed ? ` feed(${p.items})` : ""}${p.sitemap ? ` sitemap(${p.urls} URLs)` : ""}${p.eventos != null ? ` eventos=${p.eventos}` : ""}${p.namespaces ? ` ns=[${p.namespaces.slice(0, 6).join(",")}]` : ""}${p.bloqueaTodo ? " · robots bloquea todo" : ""}${p.crawlDelay ? " · " + p.crawlDelay : ""}`);
    }
  }
  L.push("", "## Profundización", "", "```json", JSON.stringify(extras, null, 1).slice(0, 12000), "```", "");
  try { fs.mkdirSync(path.dirname(OUT_MD), { recursive: true }); fs.writeFileSync(OUT_MD, L.join("\n")); } catch (e) { log("no se pudo escribir md", e.message); }
}

process.on("SIGTERM", () => { log("SIGTERM: guardando parcial"); escribir(true); process.exit(1); });

(async () => {
  const solo = process.env.SONDA_SOLO ? process.env.SONDA_SOLO.split(",") : null;
  for (const f of FUENTES) {
    if (solo && !solo.includes(f.id)) continue;
    await sondearFuente(f);
    escribir(true); // checkpoint tras cada fuente
  }
  if (!solo || solo.includes("artdec")) await profundizarArtdec();
  if (!solo || solo.includes("santiagocultura")) await profundizarSantiagoCultura();
  if (!solo || solo.includes("gobiernosantiago")) await descubrirRedAlameda();
  escribir(false);
  log("\nlisto: reporte en", OUT_MD);
})().catch(e => { log("error fatal de la sonda:", e); escribir(true); process.exit(0); });
