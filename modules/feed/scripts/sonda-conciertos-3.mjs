#!/usr/bin/env node
// sonda-conciertos-3.mjs — issue #44 (nov-2026). Solo lectura.
// Productoras / sellos / organizadores de festivales / televisoras de Japón y Alemania
// (y algunos europeos) afines a folk metal, industrial, post-punk, goth, synthpop y visual kei.
// Mide por canal: suscriptores, fecha del último upload, uploads en los últimos 120 días,
// y cuántos de los últimos 15 duran >= 30 min y >= 10 min. Salida: docs/sonda-conciertos-3.json.

import fs from "node:fs";
const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.error("Falta YOUTUBE_API_KEY"); process.exit(1); }
const UA = "angst-feed-bot/1.0 ( https://github.com/cipinzas-hash/feeder )";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso2s = d => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
async function get(url, json = false) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try { const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" }); return { ok: r.ok, status: r.status, body: json ? await r.json().catch(() => null) : await r.text() }; }
  catch { return { ok: false, status: 0, body: null }; } finally { clearTimeout(t); }
}
const yt = (ep, q) => get(`https://www.googleapis.com/youtube/v3/${ep}?${new URLSearchParams({ ...q, key: KEY })}`, true);

const LISTA = [
  // Japón: promotoras, sellos y festivales
  ["JP", "Maverick DC Group"], ["JP", "DANGER CRUE official"], ["JP", "Free-Will visual kei"], ["JP", "Midi:Nette Mana"],
  ["JP", "Yoshiki Channel"], ["JP", "Visual Japan Summit"], ["JP", "LOUD PARK Creativeman"], ["JP", "Creativeman Productions"],
  ["JP", "FUJI ROCK FESTIVAL official"], ["JP", "SUMMER SONIC official"], ["JP", "SPACE SHOWER TV"], ["JP", "WOWOW LIVE ライブ"],
  ["JP", "V-ROCK FESTIVAL"], ["JP", "ヴィジュアル系 ライブ映像 公式チャンネル"], ["JP", "Gan-Shin records"], ["JP", "Warner Music Japan live"],
  // Alemania: festivales, organizadores, sellos, televisión, revistas
  ["DE", "M'era Luna Festival"], ["DE", "Wave-Gotik-Treffen official"], ["DE", "Amphi Festival official"], ["DE", "Rock Hard Festival"],
  ["DE", "Party.San Open Air"], ["DE", "With Full Force Festival"], ["DE", "Nuclear Blast Records"], ["DE", "Napalm Records"],
  ["DE", "Metal Hammer Germany"], ["DE", "ICS Festival Service Wacken"], ["DE", "FKP Scorpio Konzertproduktionen"], ["DE", "Rock am Ring official"],
  ["DE", "Sonic Seducer"], ["DE", "Orkus"], ["DE", "MDR Sachsen Konzert"], ["DE", "NDR Live Konzert"], ["DE", "ZDF Kultur Konzert"],
  ["DE", "Dark Troll Festival"], ["DE", "Ragnarök Festival"], ["DE", "Eisheilige Nacht"], ["DE", "Gothic Festival Konzert live Mitschnitt"],
  // Europa: afines
  ["EU", "Roadburn Festival"], ["EU", "Metaldays"], ["EU", "Brutal Assault"], ["EU", "Dark Easter Metal Meeting"],
];

const out = { generatedAt: new Date().toISOString(), canales: [] };
const vistos = new Set();
for (const [pais, q] of LISTA) {
  const s = await yt("search", { part: "snippet", type: "channel", maxResults: "3", q });
  const ids = (s.body?.items || []).map(i => i.id.channelId).filter(id => !vistos.has(id));
  if (!ids.length) { console.log(`· ${q}: sin candidatos`); continue; }
  const det = await yt("channels", { part: "snippet,statistics", id: ids.join(",") });
  for (const c of det.body?.items || []) {
    vistos.add(c.id);
    const rss = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`);
    const entries = rss.ok ? [...rss.body.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map(m => m[0]) : [];
    const vids = entries.map(e => ({ id: (/<yt:videoId>([^<]+)/.exec(e) || [])[1], pub: (/<published>([^<]+)/.exec(e) || [])[1] }));
    let l30 = 0, l10 = 0, ej = [];
    if (vids.length) {
      const v = await yt("videos", { part: "contentDetails,snippet", id: vids.map(x => x.id).join(",") });
      for (const it of v.body?.items || []) { const sec = iso2s(it.contentDetails?.duration); if (sec >= 600) l10++; if (sec >= 1800) { l30++; if (ej.length < 3) ej.push(`${it.snippet.title.slice(0, 60)} (${Math.round(sec / 60)}m)`); } }
    }
    const corte = Date.now() - 120 * 864e5;
    out.canales.push({ pais, consulta: q, channelId: c.id, titulo: c.snippet.title, handle: c.snippet.customUrl, suscriptores: +c.statistics?.subscriberCount || 0, videos: +c.statistics?.videoCount || 0, descripcion: (c.snippet.description || "").replace(/\s+/g, " ").slice(0, 110), ultimoUpload: vids[0]?.pub?.slice(0, 10), ultimos120d: vids.filter(x => x.pub && Date.parse(x.pub) >= corte).length, subidasRSS: vids.length, largos30: l30, largos10: l10, ejemplos: ej });
    await sleep(200);
  }
  console.log(`✓ ${pais} ${q}`);
}
fs.mkdirSync("../../docs", { recursive: true });
fs.writeFileSync("../../docs/sonda-conciertos-3.json", JSON.stringify(out, null, 2));
console.log(`Reporte escrito: ${out.canales.length} canales`);
