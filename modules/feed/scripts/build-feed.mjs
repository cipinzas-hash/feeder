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
import createDOMPurify from "dompurify";
import Parser from "rss-parser";
import { CATEGORIAS_VIDEOTECA, heredarVideoteca } from "./lib/videoteca.mjs";
import { extractBandcampEmbedUrl, extractSoundcloudTrackUrl, extractYoutubeId, hasListenEmbed } from "./lib/embeds.mjs";
import { parsearArticulo } from "./lib/extract-runner.mjs";

const FEEDS_PATH = new URL("../feeds.json", import.meta.url);
const OUTPUT_PATH = new URL("../data/feed.json", import.meta.url);
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
// Módulo de música (oct-2026): esta categoría ya NO se emite en feed.json. Sus noticias
// se escriben aparte y build-musica.mjs las convierte en lanzamientos + fichas de artista.
const MUSICA_NOTICIAS_PATH = new URL("../data/musica-noticias.json", import.meta.url);
const RELEASE_TITLE_RE = /\b(new (single|album|ep|track|song|video)|out now|video premiere|song premiere|premieres?\b|shares? (new )?(song|track|video)|announces? new (album|ep|single)|drops? new|unveils? new (song|track|video))\b/i;

function looksLikeReleaseNews(title) {
  return RELEASE_TITLE_RE.test(title || "");
}
async function resolveSoundcloudEmbed(trackUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.html || "").match(/src="([^"]+)"/);
    return m ? m[1] : null;
  } catch (e) {
    console.error(`✗ Música · oEmbed SoundCloud (${trackUrl}): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
// findMusicVideo se llamaba pero nunca estaba definida ni importada en este
// archivo -- vivía solo en build-melee.mjs. Si el gate de música (más abajo)
// llegaba a activarse de verdad, era un ReferenceError sin capturar que
// tiraba abajo TODA la corrida (no un timeout -- un crash inmediato). Copia
// local, con timeout real agregado (el original en build-melee.mjs tampoco
// lo tenía).
async function findMusicVideo(title) {
  if (!YOUTUBE_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const q = encodeURIComponent(`${title} official`);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`,
      { signal: controller.signal }
    );
    const data = await res.json();
    return data?.items?.[0]?.id?.videoId || null;
  } catch (e) {
    console.error(`✗ Música · búsqueda YouTube ("${title}"): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}


// ─── Diagnóstico de cuelgues (issue #13) ─────────────────────────────────────
// Varias corridas de este workflow se cancelaron por timeout (25 min) sin dejar
// pistas legibles. Se lleva la cuenta de las operaciones de red en vuelo y, si
// el step recibe SIGTERM (timeout del workflow), se vuelcan al log con cuánto
// llevaban abiertas -- así el siguiente cuelgue señala la fuente concreta.
const enVuelo = new Map();
let enVueloSeq = 0;
async function rastreado(etiqueta, fn) {
  const id = ++enVueloSeq;
  enVuelo.set(id, { etiqueta, desde: Date.now() });
  try { return await fn(); } finally { enVuelo.delete(id); }
}
function volcarEnVuelo(motivo) {
  console.error(`⚠ ${motivo}: ${enVuelo.size} operación(es) en vuelo`);
  for (const o of enVuelo.values()) console.error(`   · ${((Date.now() - o.desde) / 1000).toFixed(0)} s abierta: ${o.etiqueta}`);
}
// Tope duro por encima del timeout de socket de rss-parser (que es de inactividad,
// no total): un servidor que gotea bytes nunca lo dispara.
function conTope(promesa, ms, etiqueta) {
  let t;
  const tope = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`tope duro de ${ms / 1000}s: ${etiqueta}`)), ms); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(t));
}
const INICIO = Date.now();
process.on("SIGTERM", () => { volcarEnVuelo(`SIGTERM tras ${((Date.now() - INICIO) / 60000).toFixed(1)} min`); process.exit(143); });
setInterval(() => { if (enVuelo.size && Date.now() - INICIO > 12 * 60000) volcarEnVuelo("sigue corriendo pasados 12 min"); }, 60000).unref();

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
    const feed = await rastreado(`feed ${source.url}`, () => conTope(parser.parseURL(source.url), 45000, source.url));
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
    // JSDOM + Readability son 100% síncronos -- ningún AbortController ni
    // timeout de fetch los puede cortar una vez que arrancan a parsear.
    // Una página con HTML gigante o patológico puede colgar el parseo
    // durante minutos, bloqueando TODO el event loop (no solo este ítem) y
    // comiéndose el timeout-minutes del job entero. Tope defensivo: nada
    // de extracción para páginas absurdamente grandes, se degrada a "sin
    // texto completo" igual que cualquier otro fallo de esta función.
    const MAX_HTML_BYTES = 2_000_000;
    if (html.length > MAX_HTML_BYTES) {
      console.error(`✗ Extracción (${url}): HTML de ${html.length} bytes, supera el tope de ${MAX_HTML_BYTES}, se salta el parseo`);
      return { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null };
    }
    // JSDOM + Readability corren en un worker_thread aislado con tope duro
    // (lib/extract-runner.mjs): si una página los cuelga, se mata el worker y
    // se degrada a "sin texto completo" -- antes bloqueaban el event loop del
    // job entero hasta el timeout-minutes (corridas canceladas, issue #13).
    return await parsearArticulo(html, url, { sanitize, label: url });
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
  // Las noticias de música ya no viajan en feed.json (van a musica-noticias.json, que
  // lee build-musica.mjs): se reusa su texto completo de la corrida anterior igual.
  try {
    const prevMusica = JSON.parse(await readFile(MUSICA_NOTICIAS_PATH, "utf-8"));
    for (const item of prevMusica.items || []) previousByGuid.set(item.guid, item);
  } catch (e) { /* primera corrida con este archivo */ }

  const allSources = feedsConfig.flatMap(g => g.feeds.map(f => ({ ...f, cat: g.cat })));
  console.log(`Bajando ${allSources.length} feeds...`);
  const fetched = await mapWithConcurrency(allSources, FEED_CONCURRENCY, f => fetchFeed(f, f.cat));
  // addedAt: fecha de incorporación al Feed, distinta de pubDate (fecha real de
  // publicación/upload). Se sella la primera vez que un guid aparece nuevo
  // (no está en previousByGuid) y se conserva igual en corridas siguientes —
  // requisito de issue #8 (Micro Docs/Conciertos como videoteca persistente).
  const allItems = fetched.flat().map(item => ({
    ...item,
    addedAt: previousByGuid.get(item.guid)?.addedAt || new Date().toISOString(),
  }));

  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  // Podcasts (Meta Pod, Uncommon Energy), Microdocumentales y Conciertos quedan
  // fuera de la retención de 30 días: issue #8 pide que estas dos últimas sean
  // una videoteca persistente ("no introducir caducidad automática del
  // contenido"), mismo criterio que ya regía para Podcasts.
  const CATEGORIAS_SIN_RETENCION = new Set(["Podcasts", "Microdocumentales", "Conciertos"]);
  // Videoteca: lo que YouTube no devolvió esta corrida se conserva de la anterior.
  const heredados = heredarVideoteca(previous.categories, allItems);
  if (heredados.length > 0) {
    console.log(`✓ Videoteca: ${heredados.length} ítem(s) de Microdocumentales/Conciertos conservados de la corrida anterior (no vinieron en los feeds de ahora)`);
  }
  const recentItems = [...allItems, ...heredados].filter(a => CATEGORIAS_SIN_RETENCION.has(a.categoria) || !a.pubDate || new Date(a.pubDate).getTime() >= cutoff);

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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(",")}&key=${YOUTUBE_API_KEY}`, { signal: controller.signal });
        const data = await res.json();
        for (const v of data.items || []) map[v.id] = parseISO8601Duration(v.contentDetails?.duration);
      } catch (e) { console.error(`✗ Conciertos duración (lote): ${e.message}`); }
      finally { clearTimeout(timer); }
    }
    return map;
  }

  const conciertosPreFiltered = recentItems.filter(a => a.categoria !== "Conciertos" || !CONCIERTOS_EXCLUDE_RE.test(a.title));
  // Issue #8 sacó la purga de 30 días para Conciertos -- este acumulado ya
  // no tiene techo natural, así que pedirle a YouTube la duración de TODO
  // en cada corrida (como hacía antes) escala sin límite con el tiempo. La
  // duración de un video de YouTube no cambia nunca, así que se persiste en
  // el item (duracionSegundos) y solo se pide de nuevo lo que sea
  // genuinamente nuevo -- mismo criterio que ya usa fullText más abajo.
  const conciertosNuevosIds = conciertosPreFiltered
    .filter(a => a.categoria === "Conciertos" && a.videoId && previousByGuid.get(a.guid)?.duracionSegundos == null)
    .map(a => a.videoId);
  console.log(`Conciertos: pidiendo duración de ${conciertosNuevosIds.length} video(s) nuevo(s) a YouTube (lotes de 50) -- el resto ya la tenía de una corrida anterior`);
  const conciertosDurationsNuevas = await fetchDurationsMap(conciertosNuevosIds);
  const conciertosDurations = { ...conciertosDurationsNuevas };
  for (const a of conciertosPreFiltered) {
    if (a.categoria === "Conciertos" && a.videoId) {
      const prevDur = previousByGuid.get(a.guid)?.duracionSegundos;
      if (prevDur != null && conciertosDurations[a.videoId] == null) conciertosDurations[a.videoId] = prevDur;
    }
  }
  const recentItemsFiltered = conciertosPreFiltered.filter(a => {
    if (a.categoria !== "Conciertos") return true;
    if (!YOUTUBE_API_KEY) return CONCIERTOS_INCLUDE_RE.test(a.title); // sin key, fallback al criterio de título
    if (!a.videoId) return false;
    const dur = conciertosDurations[a.videoId];
    if (dur != null) a.duracionSegundos = dur; // se persiste para la próxima corrida
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
    console.log(`  → extrayendo (${extractionsUsed}/${MAX_NEW_EXTRACTIONS_PER_RUN}): ${item.link}`);
    const { sanitized, hasEmbed, videoId, bandcampEmbedUrl, soundcloudTrackUrl } = await extractFullText(item.link);
    console.log(`  ✓ listo (${extractionsUsed}/${MAX_NEW_EXTRACTIONS_PER_RUN}): ${item.link}`);
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
    try {
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
    } catch (e) {
      // cualquier error acá (incluido uno de programación) degrada a "sin
      // resolver" en vez de tirar abajo la corrida entera -- pasó una vez
      // con findMusicVideo indefinida, no debería poder volver a pasar.
      console.error(`✗ Música · resolución ("${item.title}"): ${e.message}`);
      return item;
    }
  });

  // Música: todas las noticias de la categoría salen de feed.json y van al módulo de
  // música, sin el descarte previo de "release sin embed": ahora lo decide build-musica
  // (una noticia sin reproductor puede resolverse desde la discografía de Bandcamp).
  const musicItems = musicResolved.filter(item => item.categoria === MUSIC_CATEGORIA);
  const finalItems = musicResolved.filter(item => item.categoria !== MUSIC_CATEGORIA);
  console.log(`✓ Música: ${musicItems.length} noticia(s) desviadas a musica-noticias.json (ya no van al feed)`);

  const byCat = {};
  finalItems.forEach(item => {
    if (!byCat[item.categoria]) byCat[item.categoria] = [];
    byCat[item.categoria].push(item);
  });
  const categories = Object.entries(byCat).map(([cat, items]) => ({
    cat,
    items: items.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || "")),
  }));

  // El fetch de podcasts (Meta Pod + lo que se sume a podcasts-config.json
  // en Angst-data) se movió a build-podcasts.mjs / update-podcasts.yml,
  // cron horario aparte -- no comparte más job/presupuesto con esta corrida
  // pesada de RSS+extracción (mismo criterio que la separación de Melee).

  const output = {
    generatedAt: new Date().toISOString(),
    categories,
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  await writeFile(
    MUSICA_NOTICIAS_PATH,
    JSON.stringify({ generatedAt: output.generatedAt, items: musicItems.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || "")) }, null, 2),
  );
  // La Vitrina solo necesita Microdocumentales y Conciertos: archivo aparte, ~1% del
  // peso de feed.json (que ronda los 5 MB y lo baja todo el que abre la Vitrina).
  await writeFile(
    new URL("../data/videoteca.json", import.meta.url),
    JSON.stringify({ generatedAt: output.generatedAt, categories: categories.filter(c => CATEGORIAS_VIDEOTECA.has(c.cat)) }, null, 2),
  );

  const total = finalItems.length;
  const withText = finalItems.filter(i => i.fullText).length;
  console.log(`✓ ${total} items en ${categories.length} categorías · ${withText} con texto completo · ${extractionsUsed} extracciones nuevas esta corrida`);
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
