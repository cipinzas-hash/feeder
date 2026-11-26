#!/usr/bin/env node
// sonda-conciertos.mjs — issue #44 (nov-2026). Sonda de viabilidad, solo lectura.
// 1) Resuelve candidatos de canal de YouTube (festivales + artistas) con la API,
//    y mide cuántos de sus últimos uploads (RSS) duran >= 30 min.
// 2) Prueba fuentes de descubrimiento: autodescubrimiento de RSS en sitios de
//    noticias de la línea gótica/visual kei/synthpop/folk metal y páginas de tag de Bandcamp.
// Salida: docs/sonda-conciertos.json. No toca feeds.json ni nada que lea la app.

import fs from "node:fs";

const KEY = process.env.YOUTUBE_API_KEY;
const UA = "angst-feed-bot/1.0 ( https://github.com/cipinzas-hash/feeder )";
const MIN = 30 * 60;
const out = { generatedAt: new Date().toISOString(), youtubeKey: !!KEY, canales: {}, rss: {}, bandcamp: {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, { json = false, timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: ctrl.signal, redirect: "follow" });
    const body = json ? await res.json().catch(() => null) : await res.text();
    return { ok: res.ok, status: res.status, body, url: res.url };
  } catch (e) { return { ok: false, status: 0, body: null, error: String(e.message || e) }; }
  finally { clearTimeout(t); }
}
const iso2s = d => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const yt = (ep, q) => get(`https://www.googleapis.com/youtube/v3/${ep}?${new URLSearchParams({ ...q, key: KEY })}`, { json: true });

// ── 1. Canales ───────────────────────────────────────────────────────────────
const CANALES = [
  ["rockpalast", "WDR Rockpalast"], ["amphi", "Amphi Festival"], ["wgt", "Wave-Gotik-Treffen"],
  ["castle-party", "Castle Party festival"], ["summer-breeze", "Summer Breeze Open Air"],
  ["moi-dix-mois", "Moi dix Mois"], ["kaya", "KAYA official"], ["juka", "Juka official"],
  ["hizaki", "Hizaki Grace Project"], ["solar-fake", "Solar Fake"], ["asbury-heights", "Asbury Heights"],
  ["versailles", "Versailles Philharmonic Quintet"], ["kamijo", "KAMIJO official"],
];

async function candidato(id) {
  const rss = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  const ids = rss.ok ? [...rss.body.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map(m => m[1]) : [];
  let largos = [], total = ids.length;
  if (KEY && ids.length) {
    const v = await yt("videos", { part: "contentDetails,snippet", id: ids.join(",") });
    for (const it of v.body?.items || []) {
      const s = iso2s(it.contentDetails?.duration);
      if (s >= MIN) largos.push({ t: it.snippet.title, min: Math.round(s / 60) });
    }
  }
  return { rssOk: rss.ok, subidasRSS: total, largos30: largos.length, ejemplos: largos.slice(0, 4) };
}

if (!KEY) { console.log("Sin YOUTUBE_API_KEY: se omite la parte de canales"); }
else for (const [k, q] of CANALES) {
  const s = await yt("search", { part: "snippet", type: "channel", maxResults: "4", q });
  const ids = (s.body?.items || []).map(i => i.id.channelId);
  const det = ids.length ? await yt("channels", { part: "snippet,statistics", id: ids.join(",") }) : { body: { items: [] } };
  const lista = [];
  for (const c of det.body?.items || []) {
    const m = await candidato(c.id);
    lista.push({ channelId: c.id, titulo: c.snippet.title, handle: c.snippet.customUrl, suscriptores: c.statistics?.subscriberCount, videos: c.statistics?.videoCount, descripcion: (c.snippet.description || "").slice(0, 140), ...m });
    await sleep(300);
  }
  out.canales[k] = { consulta: q, status: s.status, candidatos: lista };
  console.log(`✓ ${k}: ${lista.length} candidato(s)`);
}

// ── 2. Descubrimiento: RSS por autodescubrimiento ─────────────────────────────
const SITIOS = [
  "https://www.jame-world.com", "https://jrock247.com", "https://www.tokyohive.com",
  "https://www.sonic-seducer.de", "https://www.orkus.de", "https://www.gothtronic.com",
  "https://www.folk-metal.nl", "https://www.metalstorm.net", "https://www.blabbermouth.net",
  "https://www.metalinjection.net", "https://www.metal-hammer.de", "https://www.synthpop.net",
];
for (const base of SITIOS) {
  const home = await get(base);
  const found = home.ok ? [...home.body.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)].map(m => (/href=["']([^"']+)/i.exec(m[0]) || [])[1]).filter(Boolean) : [];
  const urls = [...new Set(found.map(h => new URL(h, base).href))].slice(0, 3);
  const feeds = [];
  for (const u of urls) {
    const f = await get(u);
    const titles = f.ok ? [...f.body.matchAll(/<item[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)].map(m => m[1].trim()).slice(0, 4) : [];
    const fecha = f.ok ? (/<(?:pubDate|updated)>([^<]+)</.exec(f.body) || [])[1] : null;
    feeds.push({ url: u, status: f.status, ultimaFecha: fecha, titulos: titles });
  }
  out.rss[base] = { homeStatus: home.status, feeds };
  console.log(`✓ rss ${base}: home ${home.status}, ${feeds.length} feed(s)`);
}

// ── 3. Descubrimiento: tags de Bandcamp ───────────────────────────────────────
for (const tag of ["visual-kei", "gothic-rock", "darkwave", "synthpop", "folk-metal", "post-punk", "industrial", "japanese-rock"]) {
  const r = await get(`https://bandcamp.com/tag/${tag}?sort_field=date`);
  const albums = r.ok ? [...new Set([...r.body.matchAll(/https:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[a-z0-9-]+/gi)].map(m => m[0]))] : [];
  out.bandcamp[tag] = { status: r.status, albumsEnHtml: albums.length, muestra: albums.slice(0, 5) };
  console.log(`✓ bandcamp ${tag}: ${r.status}, ${albums.length} enlaces de álbum`);
  await sleep(800);
}

fs.mkdirSync("../../docs", { recursive: true });
fs.writeFileSync("../../docs/sonda-conciertos.json", JSON.stringify(out, null, 2));
console.log("Reporte escrito en docs/sonda-conciertos.json");
