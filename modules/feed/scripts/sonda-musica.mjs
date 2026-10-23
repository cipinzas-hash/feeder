// sonda-musica.mjs
// ─────────────────────────────────────────────────────────────────────────────
// SONDA de viabilidad del módulo de descubrimiento musical (22-oct-2026).
// NO es el pipeline final: no escribe nada que consuma la app. Toma los N
// ítems más recientes de la categoría "Dark scene / Música" de feed.json y mide,
// con datos reales, qué tan bien funciona cada pieza de la cadena:
//
//   titular → {artista, disco}  (Gemini; respaldo heurístico sin key)
//           → MusicBrainz (artista, desambiguación, discografía, links)
//           → Cover Art Archive (carátulas)
//           → Bandcamp (página del artista → ID de álbum → embed reproducible)
//           → Wikipedia vía Wikidata (historia)
//           → TheAudioDB / Fanart.tv / Last.fm (logo, imágenes, bio; los dos
//             últimos solo si hay key)
//
// Salida: data/sonda-musica.json (detalle por artista) y docs/sonda-musica.md
// (resumen de cobertura). Corre solo desde el workflow sonda-musica.yml, con
// la red abierta de Actions (el sandbox de desarrollo no llega a estas APIs).
//
// Contrato: ninguna llamada de red tira excepción; todo falla a null/false y
// queda contado en el reporte. Volumen bajo a propósito (≤ N artistas, 1 req/s
// a MusicBrainz, 2-3 requests a Bandcamp por artista).
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callGemini, geminiStatus } from "./lib/gemini.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEED_JSON = process.env.SONDA_FEED || path.join(__dirname, "..", "data", "feed.json");
const OUT_JSON = process.env.SONDA_OUT_JSON || path.join(__dirname, "..", "data", "sonda-musica.json");
const OUT_MD = process.env.SONDA_OUT_MD || path.join(__dirname, "..", "..", "..", "docs", "sonda-musica.md");

const N = Math.max(1, parseInt(process.env.SONDA_N || "30", 10) || 30);
const MB_GAP_MS = parseInt(process.env.MB_GAP_MS || "1100", 10);
const GEMINI_GAP_MS = parseInt(process.env.GEMINI_GAP_MS || "4500", 10);
const CAT_MUSICA = "Dark scene / Música";
const UA = "angst-feed-sonda/1.0 ( https://github.com/cipinzas-hash/feeder )";

const env = k => (process.env[k] && process.env[k].trim()) || null;
const AUDIODB_KEY = env("AUDIODB_KEY") || "2";
const FANART_KEY = env("FANART_API_KEY");
const LASTFM_KEY = env("LASTFM_API_KEY");
const HAS_GEMINI = !!env("GEMINI_API_KEY");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// ── HTTP con timeout, reintento en 429/503 y sin excepciones ─────────────────
async function http(url, { json = true, headers = {}, timeoutMs = 20000, retries = 2 } = {}) {
  for (let a = 0; a <= retries; a++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: json ? "application/json" : "text/html,*/*", ...headers },
        signal: ctrl.signal,
        redirect: "follow",
      });
      if ((res.status === 503 || res.status === 429) && a < retries) { clearTimeout(t); await sleep(2500 * (a + 1)); continue; }
      if (!res.ok) { clearTimeout(t); return { ok: false, status: res.status, data: null }; }
      const data = json ? await res.json() : await res.text();
      clearTimeout(t);
      return { ok: true, status: res.status, data };
    } catch (e) {
      clearTimeout(t);
      if (a < retries) { await sleep(1500); continue; }
      return { ok: false, status: 0, error: e.message, data: null };
    }
  }
  return { ok: false, status: 0, data: null };
}

// MusicBrainz pide ≤ 1 req/s: todas sus llamadas pasan por acá.
let lastMb = 0;
async function mb(pathAndQuery) {
  const wait = lastMb + MB_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const r = await http(`https://musicbrainz.org/ws/2/${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}fmt=json`);
  lastMb = Date.now();
  return r;
}

// ── Utilidades de texto ──────────────────────────────────────────────────────
const stripHtml = s => (s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const luceneEsc = s => (s || "").replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
const decodeEntities = s => (s || "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const stripQuotes = s => (s || "").replace(/^[\s'"‘’“”«»]+|[\s'"‘’“”«»]+$/g, "").trim();

// ── Paso 1: titular → {esLanzamiento, tipo, artista, disco} ──────────────────
const VERBOS = /\s(?:releases?|announces?|sets|shares?|previews?|unveils?|premieres?|marks?|signs?|returns?|presents?|confirms?|drops?|streams?|find|confront|turn|commune|skewer|concoct)\s/i;

function extraerHeuristico(item) {
  const title = item.title || "";
  // Formato Electrozombies / Side-Line reseñas: "Artista – Título (Formato – Sello)"
  let m = title.match(/^(.+?)\s+[–—-]\s+(.+?)(?:\s+\((.+?)\))?$/);
  if (m && !VERBOS.test(` ${m[1]} `)) {
    const fmt = (m[3] || "").toLowerCase();
    const tipo = /\bep\b/.test(fmt) ? "ep" : /album|lp/.test(fmt) ? "album" : /single/.test(fmt) ? "single" : "otro";
    return { esLanzamiento: true, tipo, artista: stripQuotes(m[1]), disco: stripQuotes(m[2]) };
  }
  const v = title.match(VERBOS);
  if (v) {
    const artista = stripQuotes(title.slice(0, v.index));
    const q = title.match(/[‘'“"]([^’'”"]{2,80})[’'”"]/);
    const t = title.toLowerCase();
    const esLanz = /releases?|new album|debut album|single|video|\bep\b/.test(t);
    const tipo = /\bep\b/.test(t) ? "ep" : /album/.test(t) ? "album" : /single|video/.test(t) ? "single" : "otro";
    if (artista && artista.split(/\s+/).length <= 6) return { esLanzamiento: esLanz, tipo, artista, disco: q ? q[1] : null };
  }
  return { esLanzamiento: false, tipo: "otro", artista: null, disco: null };
}

async function extraerConGemini(item) {
  const texto = stripHtml(item.fullText || item.summary || "").slice(0, 700);
  const prompt =
    `Título: ${item.title}\nFuente: ${item.source}\nTexto: ${texto}\n\n` +
    `Responde SOLO un objeto JSON, sin markdown, con estas claves:\n` +
    `{"es_lanzamiento": boolean, "tipo": "album|ep|single|video|reedicion|anuncio|entrevista|festival|otro", "artista": string|null, "disco": string|null}\n` +
    `Reglas: usa únicamente lo que dice el título y el texto; no inventes. "es_lanzamiento" es true si la noticia trata de un álbum, EP, single, video o reedición concreto de una banda/artista. ` +
    `"artista" es el artista o banda principal (uno solo). "disco" es el título del disco o canción tal como aparece, sin comillas. Si no consta, null.`;
  const out = await callGemini(prompt, {
    systemInstruction: "Extraes datos estructurados de noticias de música. Respondes únicamente JSON válido.",
    temperature: 0,
    maxOutputTokens: 300,
    timeoutMs: 30000,
  });
  if (!out) return null;
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    return {
      esLanzamiento: !!j.es_lanzamiento,
      tipo: typeof j.tipo === "string" ? j.tipo : "otro",
      artista: j.artista ? stripQuotes(String(j.artista)) : null,
      disco: j.disco ? stripQuotes(String(j.disco)) : null,
    };
  } catch { return null; }
}

// ── Paso 2: MusicBrainz ──────────────────────────────────────────────────────
async function mbResolverArtista(artista, disco) {
  const r = await mb(`artist/?query=${encodeURIComponent(`artist:"${luceneEsc(artista)}"`)}&limit=6`);
  const cands = (r.data?.artists || []).filter(a => a.score >= 90);
  if (!cands.length) return { mbid: null, match: r.ok ? "sin-resultado" : `error-${r.status}`, candidatos: 0 };
  const exactos = cands.filter(a => norm(a.name) === norm(artista));
  if (exactos.length === 1) return { mbid: exactos[0].id, match: "exacto", candidatos: cands.length };
  if (exactos.length > 1 && disco) {
    // Nombre ambiguo (varias bandas se llaman igual): se desempata por el disco.
    const rg = await mb(`release-group/?query=${encodeURIComponent(`releasegroup:"${luceneEsc(disco)}" AND artist:"${luceneEsc(artista)}"`)}&limit=3`);
    const ids = new Set(exactos.map(a => a.id));
    const hit = (rg.data?.["release-groups"] || []).find(g => g.score >= 90 && (g["artist-credit"] || []).some(c => ids.has(c.artist?.id)));
    if (hit) return { mbid: (hit["artist-credit"].find(c => ids.has(c.artist?.id))).artist.id, match: "exacto-por-disco", candidatos: cands.length };
    return { mbid: exactos[0].id, match: "ambiguo", candidatos: cands.length };
  }
  if (exactos.length > 1) return { mbid: exactos[0].id, match: "ambiguo", candidatos: cands.length };
  return { mbid: cands[0].id, match: "dudoso", candidatos: cands.length }; // nombre no idéntico
}

async function mbFicha(mbid) {
  const r = await mb(`artist/${mbid}?inc=url-rels+tags+genres`);
  if (!r.ok) return null;
  const a = r.data;
  const rels = (a.relations || []).filter(x => x.url?.resource).map(x => ({ tipo: x.type, url: x.url.resource }));
  return {
    nombre: a.name, tipo: a.type || null, pais: a.country || null,
    desde: a["life-span"]?.begin || null,
    tags: (a.tags || []).sort((x, y) => y.count - x.count).slice(0, 6).map(t => t.name),
    rels,
  };
}

async function mbDiscografia(mbid) {
  const r = await mb(`release-group?artist=${mbid}&type=album|ep|single&limit=100`);
  if (!r.ok) return [];
  return (r.data["release-groups"] || [])
    .map(g => ({ id: g.id, titulo: g.title, tipo: g["primary-type"] || null, fecha: g["first-release-date"] || null }))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

// ── Paso 3: Cover Art Archive (muestra de hasta 6 release-groups) ────────────
async function caaMuestra(discos) {
  const muestra = discos.slice(0, 6);
  let conCaratula = 0;
  for (const d of muestra) {
    const r = await http(`https://coverartarchive.org/release-group/${d.id}`, { retries: 1 });
    const front = r.ok && (r.data?.images || []).some(i => i.front);
    d.caratula = !!front;
    if (front) conCaratula++;
  }
  return { revisados: muestra.length, conCaratula };
}

// ── Paso 4: Bandcamp ─────────────────────────────────────────────────────────
const BC_HOST_RE = /https?:\/\/([a-z0-9-]+)\.bandcamp\.com/i;

function bandcampBase(item, rels) {
  const fromRel = rels.find(r => r.tipo === "bandcamp") || rels.find(r => BC_HOST_RE.test(r.url));
  if (fromRel) { const m = fromRel.url.match(BC_HOST_RE); if (m) return { base: `https://${m[1]}.bandcamp.com`, fuente: "musicbrainz" }; }
  const texto = `${item.link || ""} ${item.fullText || ""}`;
  const m = texto.match(BC_HOST_RE);
  if (m && m[1].toLowerCase() !== "daily") return { base: `https://${m[1]}.bandcamp.com`, fuente: "noticia" };
  return null;
}

function idsDesdeEmbed(embedUrl) {
  if (!embedUrl) return null;
  const a = embedUrl.match(/album=(\d+)/), t = embedUrl.match(/track=(\d+)/);
  return a ? { tipo: "album", id: a[1] } : t ? { tipo: "track", id: t[1] } : null;
}

function parsearPaginaBandcamp(html) {
  const out = { id: null, tipo: null, imagen: null };
  const prop = html.match(/<meta\s+name="bc-page-properties"\s+content="([^"]+)"/i);
  if (prop) {
    try {
      const j = JSON.parse(decodeEntities(prop[1]));
      if (j.item_id) { out.id = String(j.item_id); out.tipo = j.item_type === "t" ? "track" : "album"; }
    } catch { /* sigue con respaldos */ }
  }
  if (!out.id) {
    const m = html.match(/"item_id"\s*:\s*(\d+)/) || html.match(/EmbeddedPlayer\/album=(\d+)/);
    if (m) { out.id = m[1]; out.tipo = "album"; }
  }
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (og) out.imagen = decodeEntities(og[1]);
  return out;
}

async function bandcampResolver(item, rels) {
  const res = { fuente: null, base: null, releasesEnPagina: 0, idResuelto: false, embedOk: false, imagen: false, detalle: null };
  const pre = idsDesdeEmbed(item.bandcampEmbedUrl);
  if (pre) { res.fuente = "embed-en-noticia"; res.idResuelto = true; res.detalle = pre; }

  const b = bandcampBase(item, rels);
  if (b) {
    res.base = b.base;
    if (!res.fuente) res.fuente = b.fuente;
    // Discografía de la página del artista: link a cada /album/ o /track/.
    let r = await http(`${b.base}/music`, { json: false, retries: 1 });
    if (!r.ok) r = await http(`${b.base}/`, { json: false, retries: 1 });
    if (r.ok) {
      const links = [...new Set([...r.data.matchAll(/href="(\/(?:album|track)\/[^"#?]+)"/gi)].map(m => m[1]))];
      res.releasesEnPagina = links.length;
      if (!pre) {
        let pag = parsearPaginaBandcamp(r.data);
        if (!pag.id && links.length) {
          const p2 = await http(`${b.base}${links[0]}`, { json: false, retries: 1 });
          if (p2.ok) pag = parsearPaginaBandcamp(p2.data);
        }
        if (pag.id) { res.idResuelto = true; res.detalle = { tipo: pag.tipo, id: pag.id }; }
        res.imagen = !!pag.imagen;
      } else {
        res.imagen = /og:image/i.test(r.data);
      }
    }
  }
  if (res.detalle) {
    const clave = res.detalle.tipo === "track" ? "track" : "album";
    const e = await http(`https://bandcamp.com/EmbeddedPlayer/${clave}=${res.detalle.id}/size=large/bgcol=0a0a0a/linkcol=ffffff/tracklist=false/transparent=true/`, { json: false, retries: 1 });
    res.embedOk = e.ok;
  }
  return res;
}

// ── Paso 5: Wikipedia vía Wikidata ───────────────────────────────────────────
async function wikipedia(rels) {
  const wd = rels.find(r => r.tipo === "wikidata")?.url.match(/(Q\d+)/);
  if (!wd) return { enMusicBrainz: false, idioma: null, extracto: 0, imagen: false };
  const e = await http(`https://www.wikidata.org/wiki/Special:EntityData/${wd[1]}.json`, { retries: 1 });
  const sl = e.data?.entities?.[wd[1]]?.sitelinks || {};
  const lang = sl.eswiki ? "es" : sl.enwiki ? "en" : null;
  if (!lang) return { enMusicBrainz: true, idioma: null, extracto: 0, imagen: false };
  const title = sl[`${lang}wiki`].title.replace(/ /g, "_");
  const s = await http(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { retries: 1 });
  return {
    enMusicBrainz: true, idioma: lang, tieneEs: !!sl.eswiki,
    extracto: (s.data?.extract || "").length, imagen: !!s.data?.thumbnail?.source,
  };
}

// ── Paso 6: logo / imágenes / bio ────────────────────────────────────────────
async function audiodb(mbid) {
  const r = await http(`https://www.theaudiodb.com/api/v1/json/${AUDIODB_KEY}/artist-mb.php?i=${mbid}`, { retries: 1 });
  const a = r.data?.artists?.[0];
  if (!a) return { encontrado: false, estado: r.ok ? "sin-ficha" : `error-${r.status}` };
  return {
    encontrado: true, logo: !!a.strArtistLogo, thumb: !!a.strArtistThumb, fanart: !!a.strArtistFanart, banner: !!a.strArtistBanner,
    bioEs: (a.strBiographyES || "").length, bioEn: (a.strBiographyEN || "").length,
  };
}

async function fanart(mbid) {
  if (!FANART_KEY) return { omitido: true };
  const r = await http(`https://webservice.fanart.tv/v3/music/${mbid}?api_key=${FANART_KEY}`, { retries: 1 });
  if (!r.ok) return { encontrado: false, estado: `error-${r.status}` };
  const d = r.data || {};
  return { encontrado: true, logo: !!(d.hdmusiclogo?.length || d.musiclogo?.length), fondos: d.artistbackground?.length || 0, fotos: d.artistthumb?.length || 0 };
}

async function lastfm(mbid) {
  if (!LASTFM_KEY) return { omitido: true };
  const r = await http(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&mbid=${mbid}&api_key=${LASTFM_KEY}&format=json`, { retries: 1 });
  const bio = r.data?.artist?.bio?.content || "";
  return { encontrado: !!r.data?.artist, bioChars: stripHtml(bio).length };
}

// ── Orquestación ─────────────────────────────────────────────────────────────
function cargarItems() {
  const d = JSON.parse(fs.readFileSync(FEED_JSON, "utf8"));
  const todos = [];
  for (const c of d.categories || []) for (const i of (Array.isArray(c) ? c : c.items || [])) if (i.categoria === CAT_MUSICA) todos.push(i);
  todos.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
  return { items: todos.slice(0, N), totalMusica: todos.length };
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");
const resultados = [];
const porArtista = new Map(); // caché: el mismo artista en dos noticias se resuelve una vez
let meta = { inicio: new Date().toISOString(), N, metodoExtraccion: HAS_GEMINI ? "gemini (con respaldo heurístico)" : "heurístico (sin GEMINI_API_KEY)" };

function escribirSalidas(parcial = false) {
  const artistas = [...porArtista.values()];
  const rel = resultados.filter(r => r.extraccion?.esLanzamiento && r.extraccion.artista);
  const conMB = artistas.filter(a => a.mb?.mbid);
  const exactos = artistas.filter(a => ["exacto", "exacto-por-disco"].includes(a.mb?.match));
  const conDisc = exactos.filter(a => a.discografia?.total > 0);
  const caratulaOk = exactos.filter(a => a.caratulas?.conCaratula > 0);
  const bcUrl = artistas.filter(a => a.bandcamp?.base || a.bandcamp?.fuente === "embed-en-noticia");
  const bcId = artistas.filter(a => a.bandcamp?.idResuelto);
  const bcEmbed = artistas.filter(a => a.bandcamp?.embedOk);
  const wiki = exactos.filter(a => a.wikipedia?.extracto > 0);
  const logo = exactos.filter(a => a.audiodb?.logo || a.fanart?.logo);
  const bio = exactos.filter(a => (a.audiodb?.bioEs || 0) + (a.audiodb?.bioEn || 0) > 0 || a.wikipedia?.extracto > 0 || a.lastfm?.bioChars > 0);

  const out = { meta: { ...meta, fin: new Date().toISOString(), parcial, geminiUltimoError: geminiStatus.lastError, geminiModelo: geminiStatus.lastModel }, noticias: resultados, artistas };
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 1));

  const L = [];
  L.push(`# Sonda del módulo de música — ${meta.inicio.slice(0, 10)}${parcial ? " (PARCIAL: el job se cortó)" : ""}`);
  L.push("");
  L.push(`Muestra: las ${resultados.length} noticias más recientes de "${CAT_MUSICA}" (de ${meta.totalMusica} en feed.json). Extracción: ${meta.metodoExtraccion}.`);
  L.push("");
  L.push("## Cobertura");
  L.push("");
  L.push("| Pieza | Resultado |");
  L.push("|---|---|");
  L.push(`| Noticias que son lanzamiento con artista identificado | ${rel.length}/${resultados.length} (${pct(rel.length, resultados.length)}) |`);
  L.push(`| Artistas únicos procesados | ${artistas.length} |`);
  L.push(`| Encontrados en MusicBrainz (cualquier match) | ${conMB.length}/${artistas.length} (${pct(conMB.length, artistas.length)}) |`);
  L.push(`| Match confiable (exacto o desempatado por disco) | ${exactos.length}/${artistas.length} (${pct(exactos.length, artistas.length)}) |`);
  L.push(`| Con discografía en MusicBrainz (sobre confiables) | ${conDisc.length}/${exactos.length} (${pct(conDisc.length, exactos.length)}) |`);
  L.push(`| Con al menos 1 carátula en Cover Art Archive (muestra de 6 discos) | ${caratulaOk.length}/${exactos.length} (${pct(caratulaOk.length, exactos.length)}) |`);
  L.push(`| Con página de Bandcamp localizada | ${bcUrl.length}/${artistas.length} (${pct(bcUrl.length, artistas.length)}) |`);
  L.push(`| Con ID de álbum de Bandcamp resuelto | ${bcId.length}/${artistas.length} (${pct(bcId.length, artistas.length)}) |`);
  L.push(`| Embed de Bandcamp responde 200 | ${bcEmbed.length}/${artistas.length} (${pct(bcEmbed.length, artistas.length)}) |`);
  L.push(`| Con texto de historia en Wikipedia (sobre confiables) | ${wiki.length}/${exactos.length} (${pct(wiki.length, exactos.length)}) |`);
  L.push(`| Con logo (TheAudioDB${FANART_KEY ? " o Fanart.tv" : ""}) (sobre confiables) | ${logo.length}/${exactos.length} (${pct(logo.length, exactos.length)}) |`);
  L.push(`| Con alguna biografía (Wikipedia/TheAudioDB${LASTFM_KEY ? "/Last.fm" : ""}) (sobre confiables) | ${bio.length}/${exactos.length} (${pct(bio.length, exactos.length)}) |`);
  L.push("");
  L.push(`Llaves opcionales: Fanart.tv ${FANART_KEY ? "sí" : "no"}, Last.fm ${LASTFM_KEY ? "sí" : "no"}, TheAudioDB ${env("AUDIODB_KEY") ? "propia" : "llave de prueba pública"}.`);
  L.push("");
  L.push("## Por artista");
  L.push("");
  L.push("| Artista | Disco de la noticia | MB | Discos | Carát. | Bandcamp | Embed | Wiki | Logo |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const a of artistas) {
    L.push(`| ${a.artista} | ${a.disco || "—"} | ${a.mb?.match || "—"} | ${a.discografia?.total ?? "—"} | ${a.caratulas ? `${a.caratulas.conCaratula}/${a.caratulas.revisados}` : "—"} | ${a.bandcamp?.fuente || "no"}${a.bandcamp?.releasesEnPagina ? ` (${a.bandcamp.releasesEnPagina} rel.)` : ""} | ${a.bandcamp?.embedOk ? "sí" : "no"} | ${a.wikipedia?.extracto ? `${a.wikipedia.idioma}/${a.wikipedia.extracto}c` : "no"} | ${a.audiodb?.logo || a.fanart?.logo ? "sí" : "no"} |`);
  }
  L.push("");
  L.push("## Noticias descartadas por no ser lanzamiento (o sin artista)");
  L.push("");
  for (const r of resultados.filter(r => !(r.extraccion?.esLanzamiento && r.extraccion.artista))) L.push(`- ${r.titulo} → ${r.extraccion?.tipo || "?"}`);
  L.push("");
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, L.join("\n"));
}

async function procesarArtista(item, ext) {
  const clave = norm(ext.artista);
  if (porArtista.has(clave)) { log(`  · ${ext.artista}: ya resuelto antes`); return clave; }
  const rec = { artista: ext.artista, disco: ext.disco };
  porArtista.set(clave, rec); // se registra antes para que un corte deje el estado parcial

  rec.mb = await mbResolverArtista(ext.artista, ext.disco);
  log(`  · MusicBrainz: ${rec.mb.match}${rec.mb.mbid ? " " + rec.mb.mbid : ""}`);

  let rels = [];
  if (rec.mb.mbid) {
    rec.ficha = await mbFicha(rec.mb.mbid);
    rels = rec.ficha?.rels || [];
    const disc = await mbDiscografia(rec.mb.mbid);
    rec.discografia = { total: disc.length, primeros: disc.slice(0, 6) };
    if (disc.length) rec.caratulas = await caaMuestra(rec.discografia.primeros);
  }
  rec.bandcamp = await bandcampResolver(item, rels);
  log(`  · Bandcamp: fuente=${rec.bandcamp.fuente || "no"} id=${rec.bandcamp.idResuelto} embed=${rec.bandcamp.embedOk}`);
  if (rec.mb.mbid) {
    rec.wikipedia = await wikipedia(rels);
    rec.audiodb = await audiodb(rec.mb.mbid);
    rec.fanart = await fanart(rec.mb.mbid);
    rec.lastfm = await lastfm(rec.mb.mbid);
  }
  return clave;
}

async function main() {
  const { items, totalMusica } = cargarItems();
  meta.totalMusica = totalMusica;
  log(`Sonda de música: ${items.length} noticias (de ${totalMusica}). Extracción: ${meta.metodoExtraccion}`);
  process.on("SIGTERM", () => { log("SIGTERM: guardando resultados parciales"); escribirSalidas(true); process.exit(1); });

  for (const [i, item] of items.entries()) {
    log(`[${i + 1}/${items.length}] ${item.title}`);
    let ext = null, metodo = null;
    if (HAS_GEMINI) {
      ext = await extraerConGemini(item);
      metodo = ext ? "gemini" : null;
      await sleep(GEMINI_GAP_MS);
    }
    if (!ext) { ext = extraerHeuristico(item); metodo = HAS_GEMINI ? "heuristico-por-fallo-gemini" : "heuristico"; }
    log(`  · extracción (${metodo}): ${ext.esLanzamiento ? "lanzamiento" : "no-lanzamiento"} / ${ext.artista || "—"} / ${ext.disco || "—"}`);
    const reg = { titulo: item.title, fuente: item.source, link: item.link, extraccion: { ...ext, metodo } };
    resultados.push(reg);
    if (ext.esLanzamiento && ext.artista) {
      try { reg.artistaClave = await procesarArtista(item, ext); }
      catch (e) { reg.error = e.message; log(`  ✗ error procesando: ${e.message}`); }
    }
  }
  escribirSalidas(false);
  log(`Listo. Reporte: ${OUT_MD}`);
}

main().catch(e => { console.error("Sonda abortada:", e); try { escribirSalidas(true); } catch {} process.exit(1); });
