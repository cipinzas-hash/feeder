#!/usr/bin/env node
// sonda-conciertos-2.mjs — issue #44 (nov-2026). Solo lectura.
// Descubre CANALES que suben conciertos completos recientes de los géneros de Cristopher:
// busca videos largos por género, agrupa por canal y mide, por canal, cuántos de sus
// últimos 15 uploads duran >= 30 min. Salida: docs/sonda-conciertos-2.json.

import fs from "node:fs";

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.error("Falta YOUTUBE_API_KEY"); process.exit(1); }
const UA = "angst-feed-bot/1.0 ( https://github.com/cipinzas-hash/feeder )";
const MIN = 30 * 60;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso2s = d => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

async function get(url, json = false) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" });
    return { ok: res.ok, status: res.status, body: json ? await res.json().catch(() => null) : await res.text() };
  } catch (e) { return { ok: false, status: 0, body: null }; } finally { clearTimeout(t); }
}
const yt = (ep, q) => get(`https://www.googleapis.com/youtube/v3/${ep}?${new URLSearchParams({ ...q, key: KEY })}`, true);

const YA_TIENE = new Set(["UCvQT6N9nu2BJ-lJuMg1jEZQ","UCi7TehIHH5f6DxS8UP6qPhA","UCvzFhRowoW-n4GRwgNhYLJw","UCD-AnWaZqJ844m8JDK3BGvA","UC-smeLB9AnOTeypr1YyjJ3A","UCAghi19qyH9cgL0FZOPgL9w"]);
const CONSULTAS = [
  ["folk-metal", "folk metal full concert live"], ["folk-metal", "pagan folk metal live full show festival"],
  ["folk-rock", "medieval folk rock live full concert"], ["industrial", "industrial metal live full concert"],
  ["industrial", "EBM industrial live full concert festival"], ["post-punk", "post-punk live full concert"],
  ["goth", "gothic rock live full concert"], ["goth", "darkwave live full concert festival"],
  ["synthpop", "synthpop live full concert"], ["synthpop", "futurepop electropop live full concert"],
  ["visual-kei", "visual kei live full concert"], ["visual-kei", "ヴィジュアル系 ライブ フル"],
  ["goth", "Wave-Gotik-Treffen live full concert"], ["goth", "Amphi Festival live full set"],
];
const desde = new Date(Date.now() - 400 * 864e5).toISOString();

const canales = new Map(); // id -> {titulo, generos:Set, videos:[]}
for (const [genero, q] of CONSULTAS) {
  let page;
  for (let p = 0; p < 2; p++) {
    const r = await yt("search", { part: "snippet", type: "video", videoDuration: "long", maxResults: "50", order: "relevance", publishedAfter: desde, q, ...(page ? { pageToken: page } : {}) });
    for (const it of r.body?.items || []) {
      const id = it.snippet.channelId;
      if (!canales.has(id)) canales.set(id, { titulo: it.snippet.channelTitle, generos: new Set(), videos: [] });
      const c = canales.get(id); c.generos.add(genero);
      if (c.videos.length < 3) c.videos.push(it.snippet.title.slice(0, 80));
    }
    page = r.body?.nextPageToken; if (!page) break;
    await sleep(250);
  }
  console.log(`✓ ${genero}: "${q}" -> ${canales.size} canales acumulados`);
}

// Ordenar por cuántos géneros/consultas lo mencionan, medir los 40 primeros
const orden = [...canales.entries()].sort((a, b) => (b[1].generos.size - a[1].generos.size) || (b[1].videos.length - a[1].videos.length)).slice(0, 60);
const out = { generatedAt: new Date().toISOString(), consultas: CONSULTAS.length, canalesEncontrados: canales.size, medidos: [] };
const ids = orden.map(([id]) => id);
const det = {};
for (let i = 0; i < ids.length; i += 50) {
  const r = await yt("channels", { part: "snippet,statistics", id: ids.slice(i, i + 50).join(",") });
  for (const c of r.body?.items || []) det[c.id] = c;
}
for (const [id, c] of orden) {
  const rss = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  const vids = rss.ok ? [...rss.body.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map(m => m[1]) : [];
  let largos = [];
  if (vids.length) {
    const v = await yt("videos", { part: "contentDetails,snippet", id: vids.join(",") });
    for (const it of v.body?.items || []) { const s = iso2s(it.contentDetails?.duration); if (s >= MIN) largos.push({ t: it.snippet.title.slice(0, 70), min: Math.round(s / 60) }); }
  }
  const d = det[id];
  out.medidos.push({ channelId: id, titulo: c.titulo, yaEnFeed: YA_TIENE.has(id), generos: [...c.generos], suscriptores: d?.statistics?.subscriberCount, videos: d?.statistics?.videoCount, descripcion: (d?.snippet?.description || "").slice(0, 120).replace(/\s+/g, " "), subidasRSS: vids.length, largos30: largos.length, ejemplos: largos.slice(0, 3), muestraBusqueda: c.videos });
  await sleep(250);
}
fs.mkdirSync("../../docs", { recursive: true });
fs.writeFileSync("../../docs/sonda-conciertos-2.json", JSON.stringify(out, null, 2));
console.log("Reporte escrito: docs/sonda-conciertos-2.json");
