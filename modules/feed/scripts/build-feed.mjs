// build-feed.mjs
// Corre vía GitHub Action cada 4h. Baja los feeds definidos en feeds.json,
// extrae texto completo (Readability) solo para artículos nuevos que no
// vinieron ya con content:encoded, y escribe todo en data/feed.json.
//
// Angst (el prototipo/la app) solo hace fetch() a ese JSON servido por
// raw.githubusercontent.com — CORS nativo, sin proxy de ningún tipo.
//
// Melee: la categoría ya no viene de RSS (Start.gg Blog + r/SSBM se
// removieron de feeds.json). En vez de eso: se lee la lista pública de
// majors de meleemajors.gg, y por cada torneo:
//  - si ya terminó: se consulta start.gg para sacar seeds/sets, se detectan
//    upsets de top 10 seeds, y se busca el VOD en YouTube.
//  - si todavía no empieza (o está en curso): se genera un aviso de "se
//    viene" con cuenta regresiva, sin upsets ni VOD (todavía no existen).
// Ver fetchMeleeItems() más abajo.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import createDOMPurify from "dompurify";
import Parser from "rss-parser";

const FEEDS_PATH = new URL("../feeds.json", import.meta.url);
const OUTPUT_PATH = new URL("../data/feed.json", import.meta.url);
const SSBMRANK_PATH = new URL("../data/ssbmrank.json", import.meta.url);

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

// ================= Módulo Melee: upsets de top 10 seeds + VOD =================
//
// Melee no tiene una fuente RSS razonable (ver angst-feed-context.md §3.1 —
// "sin buena alternativa identificada"). En vez de una fuente en feeds.json,
// esto arma sus propios items directamente: lee meleemajors.gg (lista curada
// de majors, la misma que usa el Slippi Launcher), consulta start.gg para
// sacar seeds y sets de los torneos que ya terminaron, detecta upsets de
// top 10, y busca el VOD en YouTube con timestamp si la descripción lo trae.
//
// IMPORTANTE: la API de start.gg no está oficialmente versionada para
// terceros. Si algo de esto falla, comparar contra
// https://developer.start.gg/explorer antes de asumir que el código está mal.

const STARTGG_API_KEY = process.env.STARTGG_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const MELEEMAJORS_URL = "https://raw.githubusercontent.com/jtof-dev/meleemajors.gg/main/ssg/src/tournaments.json";
const STARTGG_ENDPOINT = "https://api.start.gg/gql/alpha";
const TOP_SEED_CUTOFF = 10;
const UPSET_SEED_DIFF_THRESHOLD = 5;
const VOD_UPSET_SEED_DIFF_THRESHOLD = 25; // umbral (más alto) para entrar al VOD permanente del archivo -- ver Fase 3b
const HYPE_WINDOW_DAYS = 14; // cuántos días antes de que empiece un major se genera el aviso de "se viene"
const PROJECTION_WINDOW_DAYS = 3; // el seeding suele cerrarse recién cerca del check-in, no 14 días antes
const PROJECTION_TOP_CUTOFF = 8; // solo nos interesan choques proyectados entre seeds de este rango

// Canales de producción conocidos para el VOD permanente del archivo (Fase 3b)
// -- se busca en estos, EN ORDEN, restringido por channelId (no búsqueda
// genérica): así el VOD que se cita es el de la empresa que efectivamente
// transmitió el torneo, no un resultado aproximado de búsqueda por título.
// Si ninguno tiene el torneo, no se arma vodClips (mejor nada que un video
// equivocado con timestamps que no corresponden).
const VOD_KNOWN_CHANNELS = [
  { name: "VGBootCamp Melee", channelId: "UCGOP2bXVg04Jvbu8tuiPoNg" },
  { name: "Galint Gaming VODs", channelId: "UCG-pxOMgCQ3AtsxVPWk3XuQ" },
  { name: "Beyond the Summit - Smash", channelId: "UCKJi-4lbB3EwpLpC82OWFjA" },
  { name: "Lucky 7s Melee", channelId: "UChVTbG58W1TpgoQZIDLyBqg" },
];

// ---- SSBMRank: criterio de upset combinado (seed local + ranking mundial) ----
//
// El seed de un torneo lo pone el TO en base a lo que sabe de la escena local
// -- en un regional chico eso puede no significar nada (o directamente faltar,
// ver el `continue` de abajo en detectUpsets cuando initialSeedNum es null).
// SSBMRank es un panel de votación externo y anual, no una API en vivo: se
// carga una vez del JSON estático en data/ssbmrank.json (mantenimiento manual,
// ver comentario en ese archivo). Sirve como señal independiente de qué tan
// fuerte es un jugador *en términos absolutos*, sin depender del seeding local.
const SSBMRANK_TOP_CUTOFF = 50; // un rankeado top 50 mundial perdiendo ya es noticia, sin importar seed
let ssbmrankByTag = null;

function normalizeTag(name) {
  if (!name) return "";
  // "C9 | Zain" / "C9|Zain" -> "Zain" -- gamertags en start.gg suelen traer
  // el tag del sponsor pegado adelante, SSBMRank lista solo el nombre solo.
  const sinSponsor = name.includes("|") ? name.split("|").pop() : name;
  return sinSponsor.trim().toLowerCase();
}

async function loadSSBMRank() {
  if (ssbmrankByTag) return ssbmrankByTag;
  try {
    const raw = JSON.parse(await readFile(SSBMRANK_PATH, "utf-8"));
    ssbmrankByTag = new Map(raw.jugadores.map(j => [normalizeTag(j.tag), j.rank]));
  } catch (e) {
    console.warn(`⚠ No se pudo cargar ssbmrank.json (${e.message}) -- upsets se detectan solo por seed esta corrida.`);
    ssbmrankByTag = new Map();
  }
  return ssbmrankByTag;
}

function ssbmrankOf(entrantName) {
  return ssbmrankByTag?.get(normalizeTag(entrantName)) ?? null;
}

// ── Fase 2a: reporte de seeds en curso ──────────────────────────────────
//
// Esto es lo que reemplaza al "quién le ganó a quién" genérico una vez que
// arranca el torneo. La pregunta real no es "qué sets se jugaron" sino "¿los
// 32 mejores seedeados siguen sosteniendo su seed o ya cayeron?" -- que es la
// misma lista de Destacados que se mostraba en Fase 1 (hype), pero ahora con
// estado.
//
// Elegibilidad: un set cuenta como derrota de X si X perdió (winnerId !=
// X.id) en cualquier fase del evento -- no distingue winners/losers bracket
// porque fetchCompletedSets no trae bracketType por set, así que "eliminado"
// acá es "tiene al menos una derrota registrada". En doble eliminación eso
// sub-cuenta eliminaciones reales (hace falta 2 derrotas), pero como señal
// de "¿le está costando sostener el seed?" ya es información útil, y evita
// inventar lógica de bracket que no se puede validar sin datos reales.
function buildSeedReportItem(slug, tournamentName, bracketUrl, top32Entrants, sets, liveInfo) {
  if (!top32Entrants.length) return null;

  // Última derrota registrada de cada entrant (si tiene más de una, la más
  // reciente es la que probablemente lo sacó del bracket).
  const derrotaPorEntrant = new Map();
  for (const set of sets) {
    if (!set.winnerId || !set.slots || set.slots.length !== 2) continue;
    const [a, b] = set.slots.map(s => s.entrant);
    if (!a || !b) continue;
    const winner = a.id === set.winnerId ? a : b;
    const loser = a.id === set.winnerId ? b : a;
    derrotaPorEntrant.set(loser.id, { rival: winner, ronda: set.fullRoundText, set });
  }

  const jugadores = top32Entrants.map(e => {
    const derrota = derrotaPorEntrant.get(e.id);
    const rivalRank = derrota ? ssbmrankOf(derrota.rival.name) : null;
    const cayoAnteMenorSeed = derrota && derrota.rival.initialSeedNum != null
      ? derrota.rival.initialSeedNum > e.initialSeedNum
      : derrota && rivalRank == null; // sin seed del rival, pero tampoco rankeado -> asumible que es sorpresa
    return {
      nombre: e.name,
      seed: e.initialSeedNum,
      foto: entrantFace(e),
      sostiene: !derrota,
      eliminadoPor: derrota ? { nombre: derrota.rival.name, seed: derrota.rival.initialSeedNum ?? null, ssbmrank: rivalRank } : null,
      ronda: derrota?.ronda ?? null,
      esUpset: derrota ? !!cayoAnteMenorSeed : false,
    };
  });

  const sostienen = jugadores.filter(j => j.sostiene).length;
  const caidos = jugadores.length - sostienen;

  return {
    guid: `melee-seedreport-${slug}`,
    title: `Reporte de seeds — ${tournamentName}`,
    link: bracketUrl,
    summary: `${sostienen}/${jugadores.length} del top ${jugadores.length} sostienen su seed. ${caidos} ya cayeron.`,
    image: null,
    pubDate: new Date().toISOString(), // se regenera cada corrida, no se acumula (mismo criterio que hype/top16/top8)
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    esSeedReport: true,
    jugadores,
    top8StartAt: liveInfo?.top8StartAt ?? null,
    streamUrl: liveInfo?.streamUrl ?? null,
  };
}

async function startggQuery(query, variables) {
  const res = await fetch(STARTGG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${STARTGG_API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// Trae todos los entrants con seed de un evento, paginando (los majors grandes
// pasan de 100 entrants). Descarta los que todavía no tienen seed asignado
// (el seeding suele cerrarse recién cerca del check-in del torneo).
async function fetchAllEntrants(eventId) {
  const perPage = 100;
  let page = 1;
  let all = [];
  while (page <= 10) { // salvaguarda: tope de 1000 entrants, ningún major llega a eso
    const query = `
      query($eventId: ID!, $page: Int!, $perPage: Int!){
        event(id:$eventId){
          entrants(query:{ page:$page, perPage:$perPage }){
            nodes{ id name initialSeedNum }
          }
        }
      }`;
    const data = await startggQuery(query, { eventId, page, perPage });
    const nodes = data?.event?.entrants?.nodes || [];
    all = all.concat(nodes);
    if (nodes.length < perPage) break;
    page++;
  }
  return all; // sin filtrar: el conteo total de inscritos necesita a todos,
              // tengan seed asignado todavía o no. Quien necesite solo los
              // seedeados filtra initialSeedNum != null en el call site.
}

function parseSlugFromBracketUrl(bracketUrl) {
  const m = (bracketUrl || "").match(/tournament\/([^/]+)\/event\/([^/]+)/);
  return m ? `tournament/${m[1]}/event/${m[2]}` : null;
}

// Slug de TORNEO (a diferencia del de evento) -- timezone y streams viven en
// el objeto Tournament de start.gg, no en Event.
function parseTournamentSlugFromBracketUrl(bracketUrl) {
  const m = (bracketUrl || "").match(/tournament\/([^/]+)/);
  return m ? `tournament/${m[1]}` : null;
}

async function fetchEventInfo(slug) {
  const query = `query($slug: String){ event(slug:$slug){ id name state startAt tournament{ name } } }`;
  const data = await startggQuery(query, { slug });
  return data?.event || null;
}

// timezone (IANA) + streams del torneo -- mismos dos campos que usa
// meleemajors.gg (confirmado contra su fuente: ssg/src/main.rs y
// getTournamentInfo.gql) para renderizar hora local y el link de stream.
// Se piden juntos porque "top8-start-time" de meleemajors.gg viene sin
// timezone propio -- está pensado para interpretarse en el timezone del
// torneo, no en uno fijo.
async function fetchTournamentInfo(tournamentSlug) {
  const query = `
    query($slug: String){
      tournament(slug:$slug){
        timezone
        streams{ streamName streamSource }
      }
    }`;
  const data = await startggQuery(query, { slug: tournamentSlug });
  return data?.tournament || null;
}

// Mismo criterio que resolve_stream_url() de meleemajors.gg: override manual
// en tournaments.json gana si existe; si no, el primer stream de start.gg
// que sea Twitch o YouTube (otras plataformas -- Hitbox, StreamMe, Mixer --
// están deprecadas y se ignoran, igual que en la fuente).
function resolveStreamUrl(streams, manualOverride) {
  if (manualOverride) return manualOverride;
  for (const s of streams || []) {
    if (!s.streamName) continue;
    if (s.streamSource === "TWITCH") return `https://www.twitch.tv/${s.streamName}`;
    if (s.streamSource === "YOUTUBE") return `https://www.youtube.com/${s.streamName}`;
  }
  return null;
}

// ── Conversión de "top8-start-time" (hora de pared en el timezone del
// torneo) a epoch UTC, sin librerías de timezone -- Intl.DateTimeFormat con
// timeZoneName:"shortOffset" ya trae el offset real (con DST incluido) para
// cualquier IANA tz soportado por el runtime de Node. Dos pasadas: la
// primera adivina el offset tratando la hora de pared como si fuera UTC: la
// segunda recalcula con el offset ya encontrado, por si la primera pasada
// cayó justo en un borde de horario de verano.
const TOP8_START_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

function tzOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(date);
  const tzPart = parts.find(p => p.type === "timeZoneName")?.value || "GMT+0";
  const m = /GMT([+-]\d+)(?::(\d+))?/.exec(tzPart);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + (h < 0 ? -min : min);
}

function parseTop8StartTime(raw, timezone) {
  if (!raw || !timezone) return null;
  const m = TOP8_START_TIME_RE.exec(String(raw).trim());
  if (!m) return null;
  const [, y, mo, d, hRaw, mi, ap] = m;
  let h = parseInt(hRaw, 10);
  if (/pm/i.test(ap) && h !== 12) h += 12;
  if (/am/i.test(ap) && h === 12) h = 0;
  try {
    const guessUTC = Date.UTC(+y, +mo - 1, +d, h, +mi);
    let offsetMin = tzOffsetMinutes(new Date(guessUTC), timezone);
    let utc = guessUTC - offsetMin * 60000;
    offsetMin = tzOffsetMinutes(new Date(utc), timezone); // segunda pasada, refina cerca de bordes DST
    utc = guessUTC - offsetMin * 60000;
    return Math.floor(utc / 1000);
  } catch (e) {
    return null; // timezone inválido para Intl -- no debería pasar con datos de start.gg
  }
}

// Junta timezone+streams (start.gg) con top8-start-time (meleemajors.gg) en
// un solo objeto {top8StartAt, streamUrl} para pasarle a los builders de
// hype/top8/top16. Un solo punto de entrada así no se repite la lógica en
// cada fase que lo necesita.
async function fetchLiveInfo(t) {
  try {
    const tournamentSlug = parseTournamentSlugFromBracketUrl(t.bracketUrl);
    if (!tournamentSlug) return { top8StartAt: null, streamUrl: null };
    const info = await fetchTournamentInfo(tournamentSlug);
    return {
      top8StartAt: parseTop8StartTime(t["top8-start-time"], info?.timezone),
      streamUrl: resolveStreamUrl(info?.streams, t["stream-url"]),
    };
  } catch (e) {
    console.error(`✗ Melee · info de torneo (timezone/streams) (${t.bracketUrl}): ${e.message}`);
    return { top8StartAt: null, streamUrl: null };
  }
}

// Todos los sets jugados del evento -- pagina completo (no solo los últimos
// 60) porque el reporte de seeds (Fase 2a) necesita el historial completo de
// cada uno de los top 32 para saber si siguen en pie, no solo lo más reciente.
async function fetchCompletedSets(eventId) {
  const perPage = 60;
  let page = 1;
  let all = [];
  while (page <= 20) { // salvaguarda: 1200 sets tope, cubre cualquier major
    const query = `
      query($eventId: ID!, $page: Int!, $perPage: Int!){
        event(id:$eventId){
          sets(perPage:$perPage, page:$page, sortType: RECENT){
            nodes{
              id fullRoundText winnerId
              phaseGroup{ phase{ id name } }
              slots{
                entrant{
                  id name initialSeedNum
                  participants{ player{ user{ images{ url type } } } }
                }
              }
              games{ selections{ entrant{ id } character{ name } } }
            }
          }
        }
      }`;
    const data = await startggQuery(query, { eventId, page, perPage });
    const nodes = data?.event?.sets?.nodes || [];
    all = all.concat(nodes);
    if (nodes.length < perPage) break;
    page++;
  }
  return all;
}

// De un entrant saca la primera foto de perfil "profile" que haya subido el
// jugador a start.gg. No todos tienen — muchos amateurs nunca la suben, y
// ahí queda null (el frontend muestra un placeholder genérico).
function entrantFace(entrant) {
  const images = entrant?.participants?.[0]?.player?.user?.images || [];
  const profile = images.find(img => img.type === "profile") || images[0];
  return profile?.url || null;
}

// El personaje "representativo" del set: el más jugado entre los games
// reportados para ese entrant (no siempre es fijo — hay quien cambia de PJ
// entre games de un mismo set). Si el TO no reportó con auto-report de
// Slippi, games/selections viene vacío y esto da null sin romper nada.
function entrantCharacter(games, entrantId) {
  const counts = {};
  for (const g of games || []) {
    for (const sel of g.selections || []) {
      if (sel.entrant?.id === entrantId && sel.character?.name) {
        counts[sel.character.name] = (counts[sel.character.name] || 0) + 1;
      }
    }
  }
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function detectUpsets(sets) {
  const out = [];
  for (const set of sets) {
    if (!set.winnerId || !set.slots || set.slots.length !== 2) continue;
    const [a, b] = set.slots.map(s => s.entrant);
    if (!a || !b) continue;
    const winner = a.id === set.winnerId ? a : b;
    const loser = a.id === set.winnerId ? b : a;

    const winnerRank = ssbmrankOf(winner.name);
    const loserRank = ssbmrankOf(loser.name);

    // Criterio 1 (existente): diferencia de seed local. Requiere que ambos
    // tengan seed asignado -- en regionales chicos esto suele faltar.
    let seedDiff = null, seedUpset = false, top10Involved = false;
    if (a.initialSeedNum && b.initialSeedNum) {
      seedDiff = loser.initialSeedNum - winner.initialSeedNum;
      top10Involved = winner.initialSeedNum <= TOP_SEED_CUTOFF || loser.initialSeedNum <= TOP_SEED_CUTOFF;
      seedUpset = seedDiff >= UPSET_SEED_DIFF_THRESHOLD;
    }

    // Criterio 2 (SSBMRank): señal independiente del seeding del torneo.
    // Upset si el perdedor está rankeado top 50 mundial y el ganador no está
    // rankeado (o está rankeado bastante peor). No depende de que el TO haya
    // seedeado bien -- por eso corre incluso cuando initialSeedNum falta.
    let rankDiff = null, rankUpset = false;
    if (loserRank != null && loserRank <= SSBMRANK_TOP_CUTOFF) {
      if (winnerRank == null) {
        rankUpset = true; // ganador ni siquiera está en el top 100 mundial
      } else if (winnerRank > loserRank) {
        rankDiff = winnerRank - loserRank;
        rankUpset = true;
      }
    }

    if (!seedUpset && !top10Involved && !rankUpset) continue;

    out.push({
      ronda: set.fullRoundText,
      ganador: {
        nombre: winner.name,
        seed: winner.initialSeedNum ?? null,
        ssbmrank: winnerRank,
        pj: entrantCharacter(set.games, winner.id),
        foto: entrantFace(winner),
      },
      perdedor: {
        nombre: loser.name,
        seed: loser.initialSeedNum ?? null,
        ssbmrank: loserRank,
        pj: entrantCharacter(set.games, loser.id),
        foto: entrantFace(loser),
      },
      esUpset: seedUpset ? winner.initialSeedNum > loser.initialSeedNum : rankUpset,
      seedDiff, // null si no había seed en ambos -- ver VOD_UPSET_SEED_DIFF_THRESHOLD en Fase 3b
      rankDiff, // diferencia de puestos SSBMRank cuando aplica (null si el ganador no estaba rankeado)
      viaSSBMRank: rankUpset && !seedUpset, // para distinguir en el título/summary qué criterio disparó esto
    });
  }
  return out;
}

function timestampToSeconds(ts) {
  const p = ts.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return 0;
}

// Búsqueda de respaldo para Dark scene/Música: cuando un post de "release" no
// trae ningún embed reproducible (ni YouTube directo, ni Bandcamp/SoundCloud/
// Spotify que igual no sabemos renderizar todavía), se busca en YouTube por el
// título de la noticia. Sin matching de timestamp (a diferencia de findVod para
// Melee) — acá alcanza con encontrar el video, no un momento puntual dentro de él.
async function findMusicVideo(title) {
  if (!YOUTUBE_API_KEY) return null;
  try {
    const q = encodeURIComponent(`${title} official`);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
    );
    const data = await res.json();
    return data?.items?.[0]?.id?.videoId || null;
  } catch (e) {
    console.error(`✗ Música · búsqueda YouTube ("${title}"): ${e.message}`);
    return null;
  }
}

async function findVod(tournamentName, ganadorNombre, perdedorNombre) {
  if (!YOUTUBE_API_KEY) return { videoId: null, startSeconds: 0 };
  try {
    const q = encodeURIComponent(`${tournamentName} melee singles top 8 VOD`);
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=3&key=${YOUTUBE_API_KEY}`
    );
    const searchData = await searchRes.json();
    const candidate = searchData?.items?.[0];
    if (!candidate) return { videoId: null, startSeconds: 0 };
    const videoId = candidate.id.videoId;

    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    const detailsData = await detailsRes.json();
    const description = detailsData?.items?.[0]?.snippet?.description || "";
    const tsRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/;
    let startSeconds = 0;
    for (const line of description.split("\n")) {
      const lower = line.toLowerCase();
      if (
        (lower.includes(ganadorNombre.toLowerCase()) || lower.includes(perdedorNombre.toLowerCase())) &&
        tsRegex.test(line)
      ) {
        startSeconds = timestampToSeconds(line.match(tsRegex)[1]);
        break;
      }
    }
    return { videoId, startSeconds };
  } catch (e) {
    console.error(`✗ Melee · búsqueda de VOD (${tournamentName}): ${e.message}`);
    return { videoId: null, startSeconds: 0 };
  }
}

// Búsqueda del VOD del torneo restringida a canales de producción conocidos
// (VOD_KNOWN_CHANNELS), UNA sola búsqueda de YouTube en total (no por
// partido) -- se prueba canal por canal en orden hasta encontrar un video,
// se trae su descripción completa una sola vez, y de ahí se sacan localmente
// todos los timestamps de los partidos del archivo permanente (ver
// findTimestampForMatchup). Sin esto, cubrir Top 16 completo + upsets≥25
// implicaría 15-20 búsquedas de YouTube por torneo -- inviable con la cuota
// diaria (10.000 unidades, 100 por búsqueda).
async function findTournamentVodDescription(tournamentName) {
  if (!YOUTUBE_API_KEY) return null;
  for (const ch of VOD_KNOWN_CHANNELS) {
    try {
      const q = encodeURIComponent(`${tournamentName} melee singles`);
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ch.channelId}&q=${q}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
      );
      const searchData = await searchRes.json();
      const candidate = searchData?.items?.[0];
      if (!candidate) continue;
      const videoId = candidate.id.videoId;
      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
      );
      const detailsData = await detailsRes.json();
      const description = detailsData?.items?.[0]?.snippet?.description || "";
      return { videoId, description, channel: ch.name };
    } catch (e) {
      console.error(`✗ Melee · VOD en ${ch.name} (${tournamentName}): ${e.message}`);
    }
  }
  return null; // ningún canal conocido tenía el torneo -- no se arma vodClips esta vez
}

function findTimestampForMatchup(description, nombreA, nombreB) {
  const tsRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/;
  for (const line of description.split("\n")) {
    const lower = line.toLowerCase();
    if ((lower.includes(nombreA.toLowerCase()) || lower.includes(nombreB.toLowerCase())) && tsRegex.test(line)) {
      return timestampToSeconds(line.match(tsRegex)[1]);
    }
  }
  return 0;
}

// Candidatos al VOD permanente: unión de (a) sets de la fase Top 16 (todos,
// sin importar seed) y (b) upsets con seedDiff >= VOD_UPSET_SEED_DIFF_THRESHOLD
// en cualquier fase -- deduplicados por id de set (un mismo set puede
// cumplir ambos criterios).
function buildVodCandidateMatches(sets, top16PhaseId) {
  const out = [];
  for (const set of sets) {
    if (!set.winnerId || !set.slots || set.slots.length !== 2) continue;
    const [a, b] = set.slots.map(s => s.entrant);
    if (!a || !b) continue;
    const winner = a.id === set.winnerId ? a : b;
    const loser = a.id === set.winnerId ? b : a;
    const esTop16 = top16PhaseId != null && set.phaseGroup?.phase?.id === top16PhaseId;

    let esBigUpset = false;
    if (a.initialSeedNum && b.initialSeedNum) {
      const seedDiff = loser.initialSeedNum - winner.initialSeedNum;
      esBigUpset = seedDiff >= VOD_UPSET_SEED_DIFF_THRESHOLD;
    }
    // Mismo criterio SSBMRank que detectUpsets: un top 50 mundial cayendo
    // ante alguien sin ranking (o muy por debajo) es VOD-worthy sin importar
    // si el torneo tenía seeding confiable.
    const loserRank = ssbmrankOf(loser.name);
    const winnerRank = ssbmrankOf(winner.name);
    const esBigUpsetPorRank = loserRank != null && loserRank <= SSBMRANK_TOP_CUTOFF
      && (winnerRank == null || winnerRank > loserRank);

    if (!esTop16 && !esBigUpset && !esBigUpsetPorRank) continue;
    out.push({
      setId: set.id,
      ronda: set.fullRoundText,
      ganador: { nombre: winner.name, seed: winner.initialSeedNum ?? null, ssbmrank: winnerRank, pj: entrantCharacter(set.games, winner.id), foto: entrantFace(winner) },
      perdedor: { nombre: loser.name, seed: loser.initialSeedNum ?? null, ssbmrank: loserRank, pj: entrantCharacter(set.games, loser.id), foto: entrantFace(loser) },
      esUpset: (a.initialSeedNum && b.initialSeedNum) ? winner.initialSeedNum > loser.initialSeedNum : esBigUpsetPorRank,
      esTop16,
    });
  }
  return out;
}

// Arma el item de "se viene tal torneo" para un evento que todavía no termina.
// Sin video, sin upsets — es solo un aviso con cuenta regresiva. Se recalcula
// desde cero en cada corrida (no se guarda entre corridas): el guid es estable
// por torneo, así que simplemente se reemplaza a sí mismo con la cuenta
// regresiva actualizada cada vez, y desaparece solo una vez que el torneo deja
// de estar "por venir" (pasa a generar sus propios upsets en vez de esto).
function buildHypeItem(slug, tournamentName, bracketUrl, startAtSeconds, entrants, liveInfo) {
  const daysUntil = (startAtSeconds * 1000 - Date.now()) / 86400000;
  const cuando = daysUntil <= 0 ? "¡ya está en curso!" : `empieza en ${Math.ceil(daysUntil)} día(s)`;
  const totalEntrants = entrants ? entrants.length : null;
  // "Destacados" = los primeros 32 por seed. Si todavía no cerró el seeding
  // (entrants sin initialSeedNum), simplemente no hay nada que mostrar acá
  // todavía — no es un error, es que es muy pronto.
  const notableEntrants = entrants
    ? entrants
        .filter(e => e.initialSeedNum != null)
        .sort((a, b) => a.initialSeedNum - b.initialSeedNum)
        .slice(0, 32)
        .map(e => ({ nombre: e.name, seed: e.initialSeedNum }))
    : [];
  return {
    guid: `melee-hype-${slug}`,
    title: `Se viene ${tournamentName}`,
    link: bracketUrl,
    summary: `${cuando} Bracket en start.gg.${totalEntrants != null ? ` ${totalEntrants} inscritos hasta ahora.` : ""}`,
    image: null,
    pubDate: new Date().toISOString(), // se regenera cada corrida, no se acumula
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    esHype: true,
    startAt: startAtSeconds, // epoch segundos — el frontend lo formatea en horario local
    totalEntrants,
    notableEntrants,
    top8StartAt: liveInfo?.top8StartAt ?? null, // epoch segundos, hora del Top 8/bracket final -- de meleemajors.gg + timezone real de start.gg
    streamUrl: liveInfo?.streamUrl ?? null,
  };
}

// ── Proyección de bracket: sorteo estándar + choques anticipados ───────────
//
// Bajo la asunción de "cero upsets" (el seed más alto siempre gana), el top 8
// final es trivialmente los seeds 1 al 8 — no depende de si es simple o doble
// eliminación, y no es contenido interesante para hype. Lo que sí vale la pena
// proyectar es CUÁNDO se cruzan dos seeds específicos según el sorteo real del
// bracket: si dos favoritos quedan del mismo lado, pueden chocar mucho antes
// de lo esperado, y eso sí genera hype real ("choque de titanes en ronda 2").
//
// Método de sorteo estándar (reflection seeding), el mismo que usa cualquier
// generador de brackets: para un bracket de tamaño N, seeds(N) da el orden en
// que se ubican los seeds en el array de posiciones (posición 0-indexed).
function standardSeedOrder(bracketSize) {
  function seeds(n) {
    if (n === 1) return [1];
    const prev = seeds(n / 2);
    const out = [];
    for (const s of prev) out.push(s, n + 1 - s);
    return out;
  }
  return seeds(bracketSize);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

// Posición (0-indexed) de cada seed dentro del sorteo — para saber en qué
// "rama" del bracket cae cada uno.
function seedPositions(bracketSize) {
  const order = standardSeedOrder(bracketSize);
  const pos = {};
  order.forEach((seed, idx) => { pos[seed] = idx; });
  return pos;
}

// Ronda de winners bracket en la que dos seeds colisionarían si ambos ganan
// todo lo anterior — la más chica posible (ronda 1 = primera ronda del
// bracket). null si algún seed no tiene posición (no debería pasar si ambos
// vienen de la misma lista de entrants).
function collisionRound(seedA, seedB, bracketSize, positions) {
  const pA = positions[seedA], pB = positions[seedB];
  if (pA == null || pB == null || pA === pB) return null;
  let r = 1;
  while (Math.floor(pA / Math.pow(2, r)) !== Math.floor(pB / Math.pow(2, r))) r++;
  return r;
}

function roundLabel(r, totalRounds) {
  const fromFinal = totalRounds - r;
  if (fromFinal <= 0) return "la gran final de winners";
  if (fromFinal === 1) return "semifinal de winners";
  if (fromFinal === 2) return "cuartos de winners";
  return `ronda ${r} de winners`;
}

// Arma el item de "proyección de bracket" para un torneo cuyo seeding ya
// cerró (a diferencia del hype item de countdown, este necesita entrants con
// seed real, así que solo se intenta cerca de la fecha — ver PROJECTION_WINDOW_DAYS).
// Devuelve null si no hay suficientes seeds top 8 para decir algo interesante.
function buildBracketProjectionItem(slug, tournamentName, bracketUrl, entrants) {
  if (entrants.length < 4) return null;

  const bracketSize = nextPowerOfTwo(entrants.length);
  const totalRounds = Math.log2(bracketSize);
  const positions = seedPositions(bracketSize);
  const bySeed = {};
  for (const e of entrants) if (e.initialSeedNum != null) bySeed[e.initialSeedNum] = e;

  const topSeeds = Object.keys(bySeed).map(Number).filter(s => s <= PROJECTION_TOP_CUTOFF).sort((a, b) => a - b);
  if (topSeeds.length < 2) return null;

  // Choques anticipados entre favoritos: para cada par de top 8, la ronda en
  // la que se cruzarían si ambos ganan todo antes. Nos interesan los que
  // colisionan MÁS TEMPRANO de lo que uno esperaría (cualquier ronda antes de
  // semifinal/final ya es noticia).
  const earlyCollisions = [];
  for (let i = 0; i < topSeeds.length; i++) {
    for (let j = i + 1; j < topSeeds.length; j++) {
      const r = collisionRound(topSeeds[i], topSeeds[j], bracketSize, positions);
      if (r != null && totalRounds - r >= 2) { // más de 2 rondas antes de la final = "temprano"
        earlyCollisions.push({ seedA: topSeeds[i], seedB: topSeeds[j], round: r });
      }
    }
  }
  earlyCollisions.sort((a, b) => a.round - b.round);

  // Primera ronda: buscar el matchup más desparejo que involucre un top 8
  // (posible upset temprano — el favorito puede caer antes de lo esperado).
  const order = standardSeedOrder(bracketSize);
  let biggestMismatch = null;
  for (let i = 0; i < order.length; i += 2) {
    const seedA = order[i], seedB = order[i + 1];
    const a = bySeed[seedA], b = bySeed[seedB];
    if (!a || !b) continue; // bye
    const favorito = seedA < seedB ? a : b;
    const rival = seedA < seedB ? b : a;
    const favoritoSeed = Math.min(seedA, seedB), rivalSeed = Math.max(seedA, seedB);
    if (favoritoSeed > PROJECTION_TOP_CUTOFF) continue;
    if (!biggestMismatch || (rivalSeed - favoritoSeed) < (biggestMismatch.rivalSeed - biggestMismatch.favoritoSeed)) {
      biggestMismatch = { favorito: favorito.name, favoritoSeed, rival: rival.name, rivalSeed };
    }
  }

  if (earlyCollisions.length === 0 && !biggestMismatch) return null;

  const partes = [];
  if (earlyCollisions.length > 0) {
    const c = earlyCollisions[0];
    const nombreA = bySeed[c.seedA].name, nombreB = bySeed[c.seedB].name;
    partes.push(`si ambos ganan todo antes, ${nombreA} [${c.seedA}] y ${nombreB} [${c.seedB}] chocarían en ${roundLabel(c.round, totalRounds)} — antes de lo esperado.`);
  }
  if (biggestMismatch) {
    partes.push(`ojo con primera ronda: ${biggestMismatch.rival} [${biggestMismatch.rivalSeed}] enfrenta a ${biggestMismatch.favorito} [${biggestMismatch.favoritoSeed}], candidato a upset temprano.`);
  }

  return {
    guid: `melee-proyeccion-${slug}`,
    title: `Proyección de bracket: ${tournamentName}`,
    link: bracketUrl,
    summary: partes.join(" "),
    image: null,
    pubDate: new Date().toISOString(), // se recalcula cada corrida, no se acumula (mismo criterio que buildHypeItem)
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    esProyeccion: true,
  };
}

// ── Fase 3: preview de Top 8 y archivo permanente del torneo ───────────────
//
// start.gg no tiene un campo "es Top 8" directo, pero los TOs de Melee casi
// siempre nombran la fase final "Top 8" (a veces "Top 8 Bracket") — se
// detecta por nombre de fase, mismo criterio informal que usa el resto de la
// escena para esto. Si un torneo nombra su fase distinto, simplemente no se
// genera preview (no rompe nada, solo no hay ese aviso puntual).
const TOP8_PHASE_NAME_RE = /top\s*8/i;
const TOP16_PHASE_NAME_RE = /top\s*16/i;

async function fetchEventPhases(eventId) {
  const query = `
    query($eventId: ID!){
      event(id:$eventId){
        phases{
          id name state
          seeds(query:{ page:1, perPage:16 }){
            nodes{
              seedNum
              entrant{ name participants{ player{ user{ images{ url type } } } } }
            }
          }
        }
      }
    }`;
  const data = await startggQuery(query, { eventId });
  return data?.event?.phases || [];
}

function findTop8Phase(phases) {
  return phases.find(p => TOP8_PHASE_NAME_RE.test(p.name || "")) || null;
}

function findTop16Phase(phases) {
  return phases.find(p => TOP16_PHASE_NAME_RE.test(p.name || "")) || null;
}

// Se regenera fresco cada corrida mientras la fase exista y no haya cerrado
// — mismo criterio que buildHypeItem/buildBracketProjectionItem, no se
// acumula entre corridas. guidPrefix/tituloFase/flagField parametrizan entre
// Top 8 y Top 16, que comparten toda la lógica salvo esos tres valores.
function buildPhasePreviewItem(slug, tournamentName, bracketUrl, phase, { guidPrefix, tituloFase, flagField }, liveInfo) {
  const seeds = (phase.seeds?.nodes || [])
    .filter(s => s.entrant)
    .sort((a, b) => (a.seedNum ?? 99) - (b.seedNum ?? 99));
  if (seeds.length < 2) return null;
  const jugadores = seeds.map(s => ({
    nombre: s.entrant.name,
    seed: s.seedNum ?? null,
    foto: entrantFace(s.entrant),
  }));
  const lista = jugadores.map(j => `${j.nombre}${j.seed ? ` [${j.seed}]` : ""}`).join(", ");
  return {
    guid: `melee-${guidPrefix}-${slug}`,
    title: `${tituloFase} de ${tournamentName}`,
    link: bracketUrl,
    summary: `Quedaron: ${lista}.`,
    image: null,
    pubDate: new Date().toISOString(),
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    [flagField]: true,
    jugadores,
    top8StartAt: liveInfo?.top8StartAt ?? null,
    streamUrl: liveInfo?.streamUrl ?? null,
  };
}

function buildTop8PreviewItem(slug, tournamentName, bracketUrl, top8Phase, liveInfo) {
  return buildPhasePreviewItem(slug, tournamentName, bracketUrl, top8Phase, { guidPrefix: "top8", tituloFase: "Top 8", flagField: "esTop8Preview" }, liveInfo);
}

function buildTop16PreviewItem(slug, tournamentName, bracketUrl, top16Phase, liveInfo) {
  return buildPhasePreviewItem(slug, tournamentName, bracketUrl, top16Phase, { guidPrefix: "top16", tituloFase: "Top 16", flagField: "esTop16Preview" }, liveInfo);
}

async function fetchFinalStandings(eventId) {
  const query = `
    query($eventId: ID!){
      event(id:$eventId){
        standings(query:{ page:1, perPage:8 }){ nodes{ placement entrant{ name } } }
      }
    }`;
  const data = await startggQuery(query, { eventId });
  return (data?.event?.standings?.nodes || []).filter(n => n.entrant);
}

// El registro permanente del torneo: se arma UNA sola vez, en la misma
// corrida en la que el evento pasa a COMPLETED por primera vez (justo antes
// de que processedEventIds lo excluya de futuros escaneos). A diferencia de
// los upsets sueltos — que sí expiran a los 30 días como el resto del feed,
// ver RETENTION_DAYS más abajo — este item queda exento para siempre (mismo
// criterio que Podcasts): es el resumen final del torneo, no un aviso
// puntual que pierde sentido con el tiempo.
function buildTournamentArchiveItem(slug, tournamentName, bracketUrl, standings, tournamentUpsets, vod, vodClips) {
  if (!standings.length) return null;
  const top8Line = [...standings]
    .sort((a, b) => a.placement - b.placement)
    .map(s => `${s.placement}° ${s.entrant.name}`)
    .join(" · ");
  const upsetsLine = tournamentUpsets.length
    ? ` Upsets destacados: ${tournamentUpsets.slice(0, 5).map(u => u.title).join("; ")}.`
    : "";
  return {
    guid: `melee-archivo-${slug}`,
    title: `Resultado final: ${tournamentName}`,
    link: bracketUrl,
    summary: `${top8Line}.${upsetsLine}`,
    image: null,
    pubDate: new Date().toISOString(),
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    tipo: vod?.videoId ? "video" : undefined,
    videoId: vod?.videoId || null,
    startSeconds: vod?.startSeconds || 0,
    esArchivo: true,
    // VOD permanente (Fase 3b): upsets de seedDiff>=25 + todos los sets de la
    // fase Top 16, con timestamp dentro del VOD real de un canal de
    // producción conocido (ver VOD_KNOWN_CHANNELS). Vacío si ninguno de esos
    // canales tenía el torneo -- no se arma con una búsqueda genérica acá,
    // a diferencia del `vod` de arriba (ese sí es de búsqueda genérica, pero
    // es solo el clip de la final, mucho menor riesgo de un match erróneo).
    vodClips: vodClips || [],
  };
}

// previousUpsetItemsByGuid: Map guid→item de upsets ya generados en corridas
//   anteriores (para no duplicar, y para reintentar el VOD de los que
//   quedaron sin uno mientras el torneo estaba ACTIVE). Los items de hype no
//   entran acá — se regeneran siempre.
// previousProcessedEventIds: ids de evento de start.gg cuyo bracket ya
//   terminó y ya se escaneó del todo (COMPLETED) — evita repetir llamadas a
//   start.gg por un torneo que ya no va a cambiar. Mientras el torneo está
//   ACTIVE (día 1 en curso) nunca entra acá, así que se re-escanea cada
//   corrida hasta que cierra.
async function fetchMeleeItems(previousUpsetItemsByGuid, previousProcessedEventIds, previousTrackedTournaments = []) {
  if (!STARTGG_API_KEY) {
    console.error("✗ Melee · falta STARTGG_API_KEY, se omite esta categoría esta corrida");
    return { upsetItems: [], hypeItems: [], projectionItems: [], seedReportItems: [], top16Items: [], top8Items: [], archiveItems: [], processedEventIds: previousProcessedEventIds, trackedTournaments: previousTrackedTournaments };
  }

  await loadSSBMRank();

  let tournaments = [];
  try {
    const res = await fetch(MELEEMAJORS_URL);
    tournaments = await res.json();
  } catch (e) {
    console.error(`✗ Melee · no se pudo leer meleemajors.gg: ${e.message}`);
    tournaments = []; // seguir igual con lo rastreado de corridas anteriores (ver abajo)
  }

  // meleemajors.gg deja de listar un torneo apenas termina (o incluso antes,
  // por su propia lógica de retención). Si eso pasa justo antes de que esta
  // corrida detecte el cambio a COMPLETED, el torneo nunca se vuelve a
  // visitar y el archivo permanente (esArchivo) no se llega a construir --
  // se pierde para siempre, sin aviso (esto es lo que pasó con GOML26).
  // Fix: se combina el listado fresco con los torneos "rastreados" de la
  // corrida anterior (cualquiera que llegó a ACTIVE/COMPLETED pero todavía
  // no quedó en processedEventIds) -- así se los sigue consultando directo
  // contra start.gg aunque el listado externo ya no los mencione.
  const seenSlugs = new Set();
  const combinedTournaments = [];
  for (const t of tournaments) {
    const slug = parseSlugFromBracketUrl(t.bracketUrl);
    if (slug && !seenSlugs.has(slug)) { seenSlugs.add(slug); combinedTournaments.push(t); }
  }
  let recoveredCount = 0;
  for (const t of previousTrackedTournaments) {
    const slug = parseSlugFromBracketUrl(t.bracketUrl);
    if (slug && !seenSlugs.has(slug)) { seenSlugs.add(slug); combinedTournaments.push(t); recoveredCount++; }
  }
  if (recoveredCount > 0) {
    console.log(`✓ Melee · ${recoveredCount} torneo(s) ya no listado(s) en meleemajors.gg pero recuperado(s) del rastreo previo`);
  }

  const upsetItems = [];
  const hypeItems = [];
  const projectionItems = [];
  const seedReportItems = [];
  const top16Items = [];
  const top8Items = [];
  const archiveItems = [];
  const processedEventIds = new Set(previousProcessedEventIds);
  const trackedTournaments = [];

  for (const t of combinedTournaments) {
    const slug = parseSlugFromBracketUrl(t.bracketUrl);
    if (!slug) continue;

    let eventInfo;
    try {
      eventInfo = await fetchEventInfo(slug);
    } catch (e) {
      console.error(`✗ Melee · ${slug}: ${e.message}`);
      continue;
    }
    if (!eventInfo) continue;
    const tournamentName = t.name || eventInfo.tournament?.name || eventInfo.name;
    const state = eventInfo.state;

    // Fase 1 (hype): el torneo todavía no arrancó (CREATED/READY/QUEUED/etc).
    // Nada de sets todavía — solo countdown + proyección de bracket cerca de
    // la fecha.
    if (state !== "ACTIVE" && state !== "COMPLETED") {
      if (eventInfo.startAt) {
        const daysUntil = (eventInfo.startAt * 1000 - Date.now()) / 86400000;
        // Entrants: solo cerca de la fecha, porque el seeding real recién
        // cierra cerca del check-in — pedirlo 14 días antes daría una lista
        // vacía o incompleta la mayoría de las veces.
        let entrants = null;
        if (daysUntil <= PROJECTION_WINDOW_DAYS) {
          try {
            entrants = await fetchAllEntrants(eventInfo.id);
          } catch (e) {
            console.error(`✗ Melee · entrants (${tournamentName}): ${e.message}`);
          }
        }
        if (daysUntil <= HYPE_WINDOW_DAYS) {
          const liveInfo = await fetchLiveInfo(t);
          hypeItems.push(buildHypeItem(slug, tournamentName, t.bracketUrl, eventInfo.startAt, entrants, liveInfo));
        }
        if (entrants) {
          const projectionItem = buildBracketProjectionItem(slug, tournamentName, t.bracketUrl, entrants);
          if (projectionItem) projectionItems.push(projectionItem);
        }
      }
      continue;
    }

    // Fase 2 (día 1 en adelante): el torneo ya está ACTIVE o COMPLETED —
    // se escanean los sets ya jugados y se detectan upsets por seeding en
    // ambos casos. La diferencia es solo el manejo del VOD y de
    // processedEventIds: mientras está ACTIVE puede volver a escanearse en
    // la próxima corrida (todavía puede haber sets nuevos), y no tiene
    // sentido buscar el VOD de top 8 porque normalmente se sube recién
    // terminado el torneo — se busca/reintenta una vez que pasa a COMPLETED.
    if (state === "COMPLETED" && previousProcessedEventIds.includes(eventInfo.id)) continue; // ya escaneado y cerrado

    let sets = [];
    try {
      sets = await fetchCompletedSets(eventInfo.id);
    } catch (e) {
      console.error(`✗ Melee · sets de ${tournamentName}: ${e.message}`);
      continue;
    }

    const upsets = detectUpsets(sets);
    for (const u of upsets) {
      const guid = `melee-${slug}-${u.ganador.nombre}-vs-${u.perdedor.nombre}-${u.ronda}`
        .toLowerCase()
        .replace(/\s+/g, "-");

      const already = previousUpsetItemsByGuid.get(guid);
      if (already) {
        // Ya existe de una corrida anterior (probablemente generado durante
        // ACTIVE, sin VOD todavía). Si ahora el torneo está COMPLETED y
        // sigue sin VOD, se reintenta la búsqueda; si no, se deja tal cual.
        if (state === "COMPLETED" && !already.videoId) {
          const vod = await findVod(tournamentName, u.ganador.nombre, u.perdedor.nombre);
          if (vod.videoId) upsetItems.push({ ...already, videoId: vod.videoId, startSeconds: vod.startSeconds });
        }
        continue;
      }

      // Durante ACTIVE no se busca VOD — el video de top 8 normalmente sube
      // recién terminado el torneo, así que sería gastar cuota de YouTube
      // buscando algo que casi seguro no existe todavía.
      const vod = state === "COMPLETED" ? await findVod(tournamentName, u.ganador.nombre, u.perdedor.nombre) : { videoId: null, startSeconds: 0 };
      const pjGanador = u.ganador.pj ? ` (${u.ganador.pj})` : "";
      const pjPerdedor = u.perdedor.pj ? ` (${u.perdedor.pj})` : "";
      // Etiqueta: seed si el torneo lo tenía, si no SSBMRank, si no nada --
      // evita el "[null]" cuando el upset se detectó solo por SSBMRank en un
      // torneo sin seeding cerrado.
      const etiqueta = (seed, rank) => seed != null ? `[seed ${seed}]` : rank != null ? `[SSBMRank #${rank}]` : "";
      const etGanador = etiqueta(u.ganador.seed, u.ganador.ssbmrank);
      const etPerdedor = etiqueta(u.perdedor.seed, u.perdedor.ssbmrank);
      const notaSSBMRank = u.viaSSBMRank ? " (upset por SSBMRank, seeding local no lo reflejaba)" : "";

      upsetItems.push({
        guid,
        title: `${u.ganador.nombre}${pjGanador}${etGanador ? ` ${etGanador}` : ""} venció a ${u.perdedor.nombre}${pjPerdedor}${etPerdedor ? ` ${etPerdedor}` : ""}`,
        link: t.bracketUrl,
        summary: `${u.ronda} de ${tournamentName}.${notaSSBMRank}`,
        image: null,
        pubDate: eventInfo.startAt ? new Date(eventInfo.startAt * 1000).toISOString() : null,
        source: tournamentName,
        categoria: "Melee",
        fullText: null,
        tipo: "video",
        videoId: vod.videoId,
        startSeconds: vod.startSeconds, // opcional — el prototipo lo ignora si no lo usa todavía
        esUpset: u.esUpset,
        viaSSBMRank: u.viaSSBMRank,
        ganador: { nombre: u.ganador.nombre, seed: u.ganador.seed, ssbmrank: u.ganador.ssbmrank, pj: u.ganador.pj, foto: u.ganador.foto },
        perdedor: { nombre: u.perdedor.nombre, seed: u.perdedor.seed, ssbmrank: u.perdedor.ssbmrank, pj: u.perdedor.pj, foto: u.perdedor.foto },
      });
    }

    // Fase 3a: preview de Top 16 y Top 8, solo mientras el torneo sigue
    // ACTIVE (una vez COMPLETED ya no aportan nada — el archivo permanente
    // los reemplaza). Se agrega hora Chile del Top 8 + link de stream a
    // ambos, vía fetchLiveInfo (timezone/streams de start.gg + top8-start-time
    // de meleemajors.gg).
    if (state === "ACTIVE") {
      try {
        const phases = await fetchEventPhases(eventInfo.id);
        const liveInfo = await fetchLiveInfo(t);
        // Fase 2a: reporte de seeds -- reemplaza al "quién le ganó a quién"
        // genérico como vista principal mientras el torneo está en curso.
        // Usa los mismos entrants/orden que Fase 1 (hype), pero cruzados
        // contra los sets ya jugados para saber quién sostiene y quién cayó.
        try {
          const entrants = await fetchAllEntrants(eventInfo.id);
          const top32 = entrants
            .filter(e => e.initialSeedNum != null)
            .sort((a, b) => a.initialSeedNum - b.initialSeedNum)
            .slice(0, 32);
          const seedReport = buildSeedReportItem(slug, tournamentName, t.bracketUrl, top32, sets, liveInfo);
          if (seedReport) seedReportItems.push(seedReport);
        } catch (e) {
          console.error(`✗ Melee · reporte de seeds (${tournamentName}): ${e.message}`);
        }
        const top16Phase = findTop16Phase(phases);
        if (top16Phase && top16Phase.state !== "COMPLETED") {
          const preview16 = buildTop16PreviewItem(slug, tournamentName, t.bracketUrl, top16Phase, liveInfo);
          if (preview16) top16Items.push(preview16);
        }
        const top8Phase = findTop8Phase(phases);
        if (top8Phase && top8Phase.state !== "COMPLETED") {
          const preview8 = buildTop8PreviewItem(slug, tournamentName, t.bracketUrl, top8Phase, liveInfo);
          if (preview8) top8Items.push(preview8);
        }
      } catch (e) {
        console.error(`✗ Melee · preview de Top 16/8 (${tournamentName}): ${e.message}`);
      }
    }

    // Fase 3b: archivo permanente — se arma una sola vez, justo en la corrida
    // donde el torneo pasa a COMPLETED por primera vez (antes de que
    // processedEventIds lo excluya de futuros escaneos).
    if (state === "COMPLETED" && !previousProcessedEventIds.includes(eventInfo.id)) {
      try {
        const standings = await fetchFinalStandings(eventInfo.id);
        const tournamentUpsets = [...upsetItems, ...previousUpsetItemsByGuid.values()].filter(
          i => i.source === tournamentName && i.esUpset
        );
        const finalistNames = [...standings].sort((a, b) => a.placement - b.placement).slice(0, 2).map(s => s.entrant.name);
        const vod = finalistNames.length === 2
          ? await findVod(tournamentName, finalistNames[0], finalistNames[1])
          : { videoId: null, startSeconds: 0 };

        // VOD permanente (Fase 3b): Top 16 completo + upsets≥25, buscado en
        // los canales de producción conocidos -- ver buildVodCandidateMatches
        // y findTournamentVodDescription más arriba.
        let vodClips = [];
        try {
          const phasesForArchive = await fetchEventPhases(eventInfo.id);
          const top16Phase = findTop16Phase(phasesForArchive);
          const candidateMatches = buildVodCandidateMatches(sets, top16Phase?.id ?? null);
          if (candidateMatches.length) {
            const vodSource = await findTournamentVodDescription(tournamentName);
            if (vodSource) {
              vodClips = candidateMatches.map(m => ({
                guid: `melee-vodclip-${slug}-${m.setId}`,
                ronda: m.ronda,
                ganador: m.ganador,
                perdedor: m.perdedor,
                esUpset: m.esUpset,
                esTop16: m.esTop16,
                videoId: vodSource.videoId,
                startSeconds: findTimestampForMatchup(vodSource.description, m.ganador.nombre, m.perdedor.nombre),
              }));
            }
          }
        } catch (e) {
          console.error(`✗ Melee · VOD permanente (${tournamentName}): ${e.message}`);
        }

        const archiveItem = buildTournamentArchiveItem(slug, tournamentName, t.bracketUrl, standings, tournamentUpsets, vod, vodClips);
        if (archiveItem) archiveItems.push(archiveItem);
      } catch (e) {
        console.error(`✗ Melee · archivo final (${tournamentName}): ${e.message}`);
      }
    }

    if (state === "COMPLETED") processedEventIds.add(eventInfo.id);

    // Se sigue rastreando mientras no quede completamente cerrado -- una vez
    // en processedEventIds (COMPLETED + archivo ya construido) ya no hace
    // falta, el bloque de arriba (línea ~779) lo salta directo la próxima vez.
    if (!processedEventIds.has(eventInfo.id)) {
      trackedTournaments.push({ bracketUrl: t.bracketUrl, name: tournamentName });
    }
  }

  return { upsetItems, hypeItems, projectionItems, seedReportItems, top16Items, top8Items, archiveItems, processedEventIds: Array.from(processedEventIds), trackedTournaments };
}
// ================= Fin módulo Melee =================

async function main() {
  const feedsConfig = JSON.parse(await readFile(FEEDS_PATH, "utf-8"));

  // Corrida anterior — para reusar fullText ya extraído y no repetir trabajo,
  // y (nuevo) para conservar los items de Melee ya generados + qué torneos
  // ya se escanearon.
  let previous = { categories: [] };
  try {
    previous = JSON.parse(await readFile(OUTPUT_PATH, "utf-8"));
  } catch (e) { /* primera corrida, no hay archivo previo todavía */ }
  const previousByGuid = new Map();
  for (const cat of previous.categories || []) {
    for (const item of cat.items || []) previousByGuid.set(item.guid, item);
  }
  const previousMeleeItems = (previous.categories || []).find(c => c.cat === "Melee")?.items || [];
  const previousProcessedEventIds = previous.meleeProcessedEvents || [];
  const previousTrackedTournaments = previous.meleeTrackedTournaments || [];

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

  // Melee: se generan aparte (no vienen de feeds.json). Los upsets se acumulan
  // igual que antes (se combinan con lo ya generado en corridas previas); los
  // items de "hype" (torneo por venir), "proyección de bracket" y "preview de
  // Top 8" se regeneran frescos en cada corrida, así que no se cargan del
  // archivo anterior. El archivo permanente por torneo (esArchivo) es lo
  // único que sí se carga y se conserva para siempre, exento de
  // RETENTION_DAYS — es el registro final, no un aviso que caduca.
  console.log("Procesando Melee (meleemajors.gg + start.gg + YouTube)...");
  const previousUpsetItemsOnly = previousMeleeItems.filter(
    i => !i.esHype && !i.esProyeccion && !i.esSeedReport && !i.esTop16Preview && !i.esTop8Preview && !i.esArchivo
  );
  const previousArchiveItems = previousMeleeItems.filter(i => i.esArchivo);
  const previousUpsetItemsByGuid = new Map(previousUpsetItemsOnly.map(i => [i.guid, i]));
  const { upsetItems: newUpsetItems, hypeItems, projectionItems, seedReportItems, top16Items, top8Items, archiveItems: newArchiveItems, processedEventIds, trackedTournaments } = await fetchMeleeItems(
    previousUpsetItemsByGuid,
    previousProcessedEventIds,
    previousTrackedTournaments
  );
  console.log(`✓ Melee · ${newUpsetItems.length} upset(s) nuevo(s)/actualizado(s), ${hypeItems.length} torneo(s) generando hype, ${projectionItems.length} proyección(es) de bracket, ${seedReportItems.length} reporte(s) de seeds en curso, ${top16Items.length} preview(s) de Top 16, ${top8Items.length} preview(s) de Top 8, ${newArchiveItems.length} archivo(s) final(es) nuevo(s) esta corrida`);
  // newUpsetItems puede traer versiones actualizadas (VOD recién encontrado)
  // de items que ya estaban en previousUpsetItemsOnly — hay que reemplazarlos,
  // no duplicarlos.
  const newUpsetGuids = new Set(newUpsetItems.map(i => i.guid));
  const carriedUpsetItems = previousUpsetItemsOnly.filter(i => !newUpsetGuids.has(i.guid));
  const allArchiveItems = [...previousArchiveItems, ...newArchiveItems]; // permanente, sin filtro de cutoff
  const cutoffFilteredMeleeItems = [...carriedUpsetItems, ...newUpsetItems, ...hypeItems, ...projectionItems, ...seedReportItems, ...top16Items, ...top8Items].filter(
    a => !a.pubDate || new Date(a.pubDate).getTime() >= cutoff
  );
  const allMeleeItems = [...cutoffFilteredMeleeItems, ...allArchiveItems];

  const finalItems = [...musicFiltered, ...allMeleeItems];

  const byCat = {};
  finalItems.forEach(item => {
    if (!byCat[item.categoria]) byCat[item.categoria] = [];
    byCat[item.categoria].push(item);
  });
  const categories = Object.entries(byCat).map(([cat, items]) => ({
    cat,
    items: items.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || "")),
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    categories,
    meleeProcessedEvents: processedEventIds, // solo control interno, la app no necesita leer esto
    meleeTrackedTournaments: trackedTournaments, // idem -- torneos ACTIVE/COMPLETED aún sin archivo, se re-consultan aunque desaparezcan de meleemajors.gg
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
