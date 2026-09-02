// build-feed.mjs
// Corre vía GitHub Action cada 4h. Baja los feeds definidos en feeds.json,
// extrae texto completo (Readability) solo para artículos nuevos que no
// vinieron ya con content:encoded, y escribe todo en data/feed.json.
//
// Angst (el prototipo/la app) solo hace fetch() a ese JSON servido por
// raw.githubusercontent.com — CORS nativo, sin proxy de ningún tipo.
//
// Melee vive en su propio script (build-melee.mjs) y su propio workflow
// (update-melee.yml) desde el 30-ago-2026 (issue #7) -- antes compartía job
// acá mismo, lo que causaba corridas canceladas por timeout job-level y,
// una vez, que el job de Cine pisara este archivo entero por un checkout
// desincronizado. Este script ya no toca nada de Melee.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import createDOMPurify from "dompurify";
import Parser from "rss-parser";

const FEEDS_PATH = new URL("../feeds.json", import.meta.url);
const OUTPUT_PATH = new URL("../data/feed.json", import.meta.url);
const PODCAST_LATEST_PATH = new URL("../data/podcast-latest.json", import.meta.url);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY; // Conciertos: filtra por duración real si hay key; si no, cae al criterio de título (ver CONCIERTOS_INCLUDE_RE)

// Meta Pod es el único podcast que se sigue (categoría "Podcasts" completa
// eliminada de feeds.json: 1797 items acumulados sin retención, 45MB de los
// 51MB de feed.json, con fullText que nunca se usaba -- ver sesión del
// 28-29 ago 2026). Este fetch vive aparte, liviano, sin pasar por
// extractFullText ni por categories/feed.json -- solo alimenta el banner +
// reproductor global de core/App.jsx con los últimos 5 episodios crudos.
// El cliente decide qué está pendiente cruzando esto contra su propio set
// de guids "despachados" (angst-podcast-dispatched-v1) -- nada de eso vive
// acá ni en el archivo generado.
const META_POD_RSS_URL = "https://anchor.fm/s/238c39d0/podcast/rss";
const PODCAST_LATEST_WINDOW = 5;

async function fetchPodcastLatestEpisodes() {
  try {
    const feed = await parser.parseURL(META_POD_RSS_URL);
    return (feed.items || [])
      .map(item => ({
        guid: item.guid || item.id || item.link,
        title: (item.title || "").trim(),
        audioUrl: item.enclosure?.url || null,
        pubDate: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null),
        link: item.link || "",
      }))
      .filter(e => e.guid && e.title && e.audioUrl)
      .sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""))
      .slice(0, PODCAST_LATEST_WINDOW);
  } catch (e) {
    console.error(`✗ Meta Pod (podcast-latest): ${e.message}`);
    return null; // null = no reescribir el archivo esta corrida, se conserva el de la corrida anterior
  }
}

const RETENTION_DAYS = 30;              // no guardar items más viejos que esto
const MAX_NEW_EXTRACTIONS_PER_RUN = 60; // tope de extracciones nuevas por corrida
const FEED_CONCURRENCY = 5;             // feeds en paralelo
const EXTRACT_CONCURRENCY = 4;          // extracciones de artículo en paralelo
const TIMEOUT_MS = 15000;

const UA = "Mozilla/5.0 (compatible; AngstFeedBot/1.0; +personal use, no scraping at scale)";

// ── Filtro Dark scene / Música: noticias de "release" sin forma de escucharlo ──
// Heurística v1, sobre título en inglés (idioma real de Side-Line/Post-Punk/
// Electrozombies) — se espera afinar después de ver casos reales filtrados/
// mantenidos, no es exacta. Solo aplica si categoria === MUSIC_CATEGORIA.
const MUSIC_CATEGORIA = "Dark scene / Música";
const RELEASE_TITLE_RE = /\b(new (single|album|ep|track|song|video)|out now|video premiere|song premiere|premieres?\b|shares? (new )?(song|track|video)|announces? new (album|ep|single)|drops? new|unveils? new (song|track|video))\b/i;
const LISTEN_EMBED_RE = /(youtube\.com\/(embed|watch)|youtu\.be\/|bandcamp\.com\/(track|album|embeddedplayer)|soundcloud\.com|open\.spotify\.com)/i;

function looksLikeReleaseNews(title) {
  return RELEASE_TITLE_RE.test(title || "");
}
function hasListenEmbed(rawHtml) {
  return LISTEN_EMBED_RE.test(rawHtml || "");
}
// Si el embed ya detectado es de YouTube, se puede sacar el videoId directo del
// HTML sin gastar cuota de búsqueda — y es más preciso: es el video real que
// puso la banda/sello, no un resultado de búsqueda aproximado.
function extractYoutubeId(rawHtml) {
  if (!rawHtml) return null;
  const m = rawHtml.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
// Bandcamp NO tiene oEmbed (confirmado — lo rechaza, 404). Solo se puede reusar
// un embed si el blog YA trae el iframe de EmbeddedPlayer en el HTML crudo; si
// solo hay un link plano a la canción, no hay forma legítima de reconstruirlo
// (la API real de Bandcamp es para sellos/artistas, no para esto).
function extractBandcampEmbedUrl(rawHtml) {
  if (!rawHtml) return null;
  const m = rawHtml.match(/https?:\/\/bandcamp\.com\/EmbeddedPlayer\/[^"'\s<>]+/i);
  return m ? m[0] : null;
}
// SoundCloud sí tiene oEmbed público real, sin auth — solo hace falta el link
// plano a la canción, la resolución del embed pasa en musicResolved (main()).
function extractSoundcloudTrackUrl(rawHtml) {
  if (!rawHtml) return null;
  const m = rawHtml.match(/https?:\/\/soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/i);
  return m ? m[0] : null;
}
async function resolveSoundcloudEmbed(trackUrl) {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.html || "").match(/src="([^"]+)"/);
    return m ? m[1] : null;
  } catch (e) {
    console.error(`✗ Música · oEmbed SoundCloud (${trackUrl}): ${e.message}`);
    return null;
  }
}

const parser = new Parser({
  timeout: TIMEOUT_MS,
  headers: { "User-Agent": UA },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["yt:videoId", "ytVideoId"],
    ],
  },
});

let purify; // se inicializa una sola vez, jsdom es relativamente caro de crear
function sanitize(html) {
  if (!purify) purify = createDOMPurify(new JSDOM("").window);
  return purify.sanitize(html);
}

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractImage(item) {
  if (Array.isArray(item.mediaContent)) {
    const withUrl = item.mediaContent.find(m => m?.["$"]?.url);
    if (withUrl) return withUrl["$"].url;
  }
  if (item.mediaThumbnail?.["$"]?.url) return item.mediaThumbnail["$"].url;
  if (item.enclosure?.url && (item.enclosure.type || "").startsWith("image")) return item.enclosure.url;
  const html = item.contentEncoded || item.content || item.summary || "";
  const m = html.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchFeed(source, cat) {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || [])
      .map(item => {
        const rawForEmbedCheck = item.contentEncoded || item.content || item.summary || "";
        const directYoutubeId = extractYoutubeId(rawForEmbedCheck);
        const bandcampEmbedUrl = extractBandcampEmbedUrl(rawForEmbedCheck);
        const soundcloudTrackUrl = !directYoutubeId && !bandcampEmbedUrl ? extractSoundcloudTrackUrl(rawForEmbedCheck) : null;
        const base = {
          guid: item.guid || item.id || item.link,
          title: (item.title || "").trim(),
          link: item.link || "",
          summary: stripHtml(item.contentSnippet || item.summary || item.content || "").slice(0, 260),
          image: extractImage(item),
          pubDate: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null),
          source: source.name,
          tema: source.tema || null,
          categoria: cat,
          fullText: item.contentEncoded ? sanitize(item.contentEncoded) : null,
          hasListenEmbed: hasListenEmbed(rawForEmbedCheck),
          ...(directYoutubeId ? { tipo: "video", videoId: directYoutubeId } : {}),
          ...(bandcampEmbedUrl ? { bandcampEmbedUrl } : {}),
          ...(soundcloudTrackUrl ? { soundcloudTrackUrl } : {}),
        };
        // video/podcast: mismo shape de siempre + los campos que usa ExtendedView
        // para embeber en vez de extraer texto. Sin "tipo" en feeds.json, el item
        // sale igual que antes (comportamiento de texto, sin tocar nada).
        if (source.tipo === "video") {
          return { ...base, tipo: "video", videoId: item.ytVideoId || null, fullText: null };
        }
        if (source.tipo === "podcast") {
          return { ...base, tipo: "podcast", audioUrl: item.enclosure?.url || null };
        }
        return base;
      })
      .filter(a => a.title && a.link && a.guid);
  } catch (e) {
    console.error(`✗ ${cat} · ${source.name}: ${e.message}`);
    return [];
  }
}

async function extractFullText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA } });
    if (!res.ok) return { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null };
    // el abort tiene que seguir armado durante res.text() también: fetch() resuelve
    // apenas llegan los headers, no cuando termina de bajar el body — si no, una
    // página que gotea el body muy lento (o se cuelga) queda leyendo sin límite.
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null };
    // chequeo de embed ANTES de sanitize(): DOMPurify pela <iframe> por defecto,
    // así que si se chequea después del sanitize nunca se va a detectar nada.
    const videoId = extractYoutubeId(article.content);
    const bandcampEmbedUrl = extractBandcampEmbedUrl(article.content);
    return {
      sanitized: sanitize(article.content),
      hasEmbed: hasListenEmbed(article.content),
      videoId,
      bandcampEmbedUrl,
      soundcloudTrackUrl: !videoId && !bandcampEmbedUrl ? extractSoundcloudTrackUrl(article.content) : null,
    };
  } catch (e) {
    return { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null };
  } finally {
    clearTimeout(timer);
  }
}
async function main() {
  const feedsConfig = JSON.parse(await readFile(FEEDS_PATH, "utf-8"));

  // Corrida anterior — para reusar fullText ya extraído y no repetir trabajo.
  let previous = { categories: [] };
  try {
    previous = JSON.parse(await readFile(OUTPUT_PATH, "utf-8"));
  } catch (e) { /* primera corrida, no hay archivo previo todavía */ }
  const previousByGuid = new Map();
  for (const cat of previous.categories || []) {
    for (const item of cat.items || []) previousByGuid.set(item.guid, item);
  }

  const allSources = feedsConfig.flatMap(g => g.feeds.map(f => ({ ...f, cat: g.cat })));
  console.log(`Bajando ${allSources.length} feeds...`);
  const fetched = await mapWithConcurrency(allSources, FEED_CONCURRENCY, f => fetchFeed(f, f.cat));
  const allItems = fetched.flat();

  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  // Podcasts (Meta Pod, Uncommon Energy) queda fuera de la retención de 30 días:
  // son shows activos con cadencia baja, se acumulan indefinidamente en vez de
  // perderse cada mes como el resto del feed de lectura.
  const recentItems = allItems.filter(a => a.categoria === "Podcasts" || !a.pubDate || new Date(a.pubDate).getTime() >= cutoff);

  // Conciertos: los 6 canales (WackenTV, Hellfest, M'era Luna, Bangers Open
  // Air, ARTE Concert, MagentaTV) suben de todo -- trailers, aftermovies,
  // vlogs, anuncios de line-up, contenido genérico de la plataforma (caso
  // MagentaTV), y también recortes cortos de un tema suelto. El filtro por
  // título solo (versión anterior) fallaba demasiado -- títulos de "live
  // performance" reales no siempre dicen "live", y clips cortos de 3-4 min
  // sí pueden decirlo. Se cambia a duración real: la idea es una performance
  // completa en un solo video, no cortos. >=30 min vía YouTube Data API
  // (contentDetails.duration), en lotes de 50 ids por llamada.
  const CONCIERTOS_MIN_SECONDS = 30 * 60;
  const CONCIERTOS_EXCLUDE_RE = /\btrailer\b|\baftermovie\b|\bvlog\b|subscribers?|line[- ]?up|ticket|entrevista|\binterview\b|documentary|explains?|announcement|\bshorts?\b|playlist/i;
  const CONCIERTOS_INCLUDE_RE = /\blive\b|\bconcert\b|\ben vivo\b/i; // fallback si no hay YOUTUBE_API_KEY

  function parseISO8601Duration(iso) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
    if (!m) return 0;
    const h = parseInt(m[1] || "0", 10), min = parseInt(m[2] || "0", 10), s = parseInt(m[3] || "0", 10);
    return h * 3600 + min * 60 + s;
  }
  async function fetchDurationsMap(videoIds) {
    const map = {};
    if (!YOUTUBE_API_KEY || !videoIds.length) return map;
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(",")}&key=${YOUTUBE_API_KEY}`);
        const data = await res.json();
        for (const v of data.items || []) map[v.id] = parseISO8601Duration(v.contentDetails?.duration);
      } catch (e) { console.error(`✗ Conciertos duración (lote): ${e.message}`); }
    }
    return map;
  }

  const conciertosPreFiltered = recentItems.filter(a => a.categoria !== "Conciertos" || !CONCIERTOS_EXCLUDE_RE.test(a.title));
  const conciertosVideoIds = conciertosPreFiltered.filter(a => a.categoria === "Conciertos" && a.videoId).map(a => a.videoId);
  const conciertosDurations = await fetchDurationsMap(conciertosVideoIds);
  const recentItemsFiltered = conciertosPreFiltered.filter(a => {
    if (a.categoria !== "Conciertos") return true;
    if (!YOUTUBE_API_KEY) return CONCIERTOS_INCLUDE_RE.test(a.title); // sin key, fallback al criterio de título
    if (!a.videoId) return false;
    const dur = conciertosDurations[a.videoId];
    return dur != null && dur >= CONCIERTOS_MIN_SECONDS;
  });
  const droppedConciertosCount = recentItems.length - recentItemsFiltered.length;
  if (droppedConciertosCount > 0) {
    console.log(`✓ Conciertos: ${droppedConciertosCount} video(s) descartados (trailers/clips cortos, o sin llegar a 30 min)`);
  }

  let extractionsUsed = 0;
  console.log(`Extrayendo texto completo (tope ${MAX_NEW_EXTRACTIONS_PER_RUN} nuevas esta corrida)...`);
  const withFullText = await mapWithConcurrency(recentItemsFiltered, EXTRACT_CONCURRENCY, async item => {
    if (item.tipo === "video") return item; // el link es la página de YouTube, no hay texto real que extraer ahí
    if (item.fullText) return item; // ya vino con content:encoded, hasListenEmbed/tipo/bandcamp/soundcloud ya seteados en fetchFeed
    const prev = previousByGuid.get(item.guid);
    if (prev?.fullText) {
      // ya se había extraído antes — se conservan también los embeds ya resueltos
      const carried = { ...item, fullText: prev.fullText, hasListenEmbed: prev.hasListenEmbed ?? item.hasListenEmbed };
      if (prev.tipo === "video" && prev.videoId) { carried.tipo = "video"; carried.videoId = prev.videoId; }
      if (prev.bandcampEmbedUrl) carried.bandcampEmbedUrl = prev.bandcampEmbedUrl;
      if (prev.soundcloudEmbedUrl) carried.soundcloudEmbedUrl = prev.soundcloudEmbedUrl;
      return carried;
    }
    if (extractionsUsed >= MAX_NEW_EXTRACTIONS_PER_RUN) return item; // se completa en la próxima corrida
    extractionsUsed++;
    const { sanitized, hasEmbed, videoId, bandcampEmbedUrl, soundcloudTrackUrl } = await extractFullText(item.link);
    const out = { ...item, fullText: sanitized, hasListenEmbed: item.hasListenEmbed || hasEmbed };
    if (videoId && !out.tipo) { out.tipo = "video"; out.videoId = videoId; }
    if (bandcampEmbedUrl && !out.bandcampEmbedUrl) out.bandcampEmbedUrl = bandcampEmbedUrl;
    if (soundcloudTrackUrl && !out.soundcloudTrackUrl) out.soundcloudTrackUrl = soundcloudTrackUrl;
    return out;
  });

  // Dark scene / Música: para noticias de "release" sin un embed reproducible
  // todavía, se prueba en orden: YouTube directo (ya resuelto arriba) → Bandcamp
  // (si el blog ya trae el iframe embebido, se reusa tal cual — Bandcamp no tiene
  // oEmbed, no hay forma de construirlo desde un link plano) → SoundCloud (oEmbed
  // público, solo necesita el link) → búsqueda de respaldo en YouTube. Recién si
  // las cuatro fallan se descarta. Heurística v1 de "es release" — ver comentario
  // junto a RELEASE_TITLE_RE arriba.
  const musicResolved = await mapWithConcurrency(withFullText, EXTRACT_CONCURRENCY, async item => {
    if (item.categoria !== MUSIC_CATEGORIA) return item;
    if (!looksLikeReleaseNews(item.title)) return item;
    if (item.tipo === "video" && item.videoId) return item; // ya resuelto (directo o de una corrida anterior)
    if (item.bandcampEmbedUrl) return { ...item, hasListenEmbed: true }; // ya trae el iframe, se usa tal cual
    if (item.soundcloudEmbedUrl) return item; // ya resuelto en una corrida anterior
    if (item.soundcloudTrackUrl) {
      const embedUrl = await resolveSoundcloudEmbed(item.soundcloudTrackUrl);
      if (embedUrl) return { ...item, soundcloudEmbedUrl: embedUrl, hasListenEmbed: true };
    }
    const videoId = await findMusicVideo(item.title);
    if (videoId) return { ...item, tipo: "video", videoId, hasListenEmbed: true };
    return item;
  });

  const musicFiltered = musicResolved.filter(item => {
    if (item.categoria !== MUSIC_CATEGORIA) return true;
    if (!looksLikeReleaseNews(item.title)) return true;
    return (item.tipo === "video" && !!item.videoId) || !!item.bandcampEmbedUrl || !!item.soundcloudEmbedUrl;
  });
  const droppedMusicCount = musicResolved.length - musicFiltered.length;
  if (droppedMusicCount > 0) {
    console.log(`✓ Dark scene/Música: ${droppedMusicCount} noticia(s) de release sin forma de escucharla (ni YouTube/Bandcamp/SoundCloud), descartadas`);
  }

  const finalItems = musicFiltered;

  const byCat = {};
  finalItems.forEach(item => {
    if (!byCat[item.categoria]) byCat[item.categoria] = [];
    byCat[item.categoria].push(item);
  });
  const categories = Object.entries(byCat).map(([cat, items]) => ({
    cat,
    items: items.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || "")),
  }));

  // Archivo liviano aparte para el banner/reproductor de Meta Pod (ver
  // fetchPodcastLatestEpisodes arriba) -- fuera de categories/feed.json.
  console.log("Bajando últimos episodios de Meta Pod...");
  const podcastEpisodes = await fetchPodcastLatestEpisodes();
  if (podcastEpisodes) {
    await writeFile(PODCAST_LATEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), episodes: podcastEpisodes }, null, 2));
    console.log(`✓ Meta Pod: ${podcastEpisodes.length} episodio(s) en la ventana`);
  } else {
    console.log("⚠ Meta Pod: fetch falló, se conserva podcast-latest.json de la corrida anterior");
  }

  const output = {
    generatedAt: new Date().toISOString(),
    categories,
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  const total = finalItems.length;
  const withText = finalItems.filter(i => i.fullText).length;
  console.log(`✓ ${total} items en ${categories.length} categorías · ${withText} con texto completo · ${extractionsUsed} extracciones nuevas esta corrida`);
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
