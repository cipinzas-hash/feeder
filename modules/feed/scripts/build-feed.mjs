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
const HYPE_WINDOW_DAYS = 14; // cuántos días antes de que empiece un major se genera el aviso de "se viene"
const PROJECTION_WINDOW_DAYS = 3; // el seeding suele cerrarse recién cerca del check-in, no 14 días antes
const PROJECTION_TOP_CUTOFF = 8; // solo nos interesan choques proyectados entre seeds de este rango

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

async function fetchEventInfo(slug) {
  const query = `query($slug: String){ event(slug:$slug){ id name state startAt tournament{ name } } }`;
  const data = await startggQuery(query, { slug });
  return data?.event || null;
}

async function fetchCompletedSets(eventId) {
  const query = `
    query($eventId: ID!){
      event(id:$eventId){
        sets(perPage:60, page:1, sortType: RECENT){
          nodes{
            id fullRoundText winnerId
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
  const data = await startggQuery(query, { eventId });
  return data?.event?.sets?.nodes || [];
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
    if (!a || !b || !a.initialSeedNum || !b.initialSeedNum) continue;
    const winner = a.id === set.winnerId ? a : b;
    const loser = a.id === set.winnerId ? b : a;
    const seedDiff = loser.initialSeedNum - winner.initialSeedNum;
    const top10Involved = winner.initialSeedNum <= TOP_SEED_CUTOFF || loser.initialSeedNum <= TOP_SEED_CUTOFF;
    const bigUpset = seedDiff >= UPSET_SEED_DIFF_THRESHOLD;
    if (top10Involved || bigUpset) {
      out.push({
        ronda: set.fullRoundText,
        ganador: {
          nombre: winner.name,
          seed: winner.initialSeedNum,
          pj: entrantCharacter(set.games, winner.id),
          foto: entrantFace(winner),
        },
        perdedor: {
          nombre: loser.name,
          seed: loser.initialSeedNum,
          pj: entrantCharacter(set.games, loser.id),
          foto: entrantFace(loser),
        },
        esUpset: winner.initialSeedNum > loser.initialSeedNum,
      });
    }
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

// Arma el item de "se viene tal torneo" para un evento que todavía no termina.
// Sin video, sin upsets — es solo un aviso con cuenta regresiva. Se recalcula
// desde cero en cada corrida (no se guarda entre corridas): el guid es estable
// por torneo, así que simplemente se reemplaza a sí mismo con la cuenta
// regresiva actualizada cada vez, y desaparece solo una vez que el torneo deja
// de estar "por venir" (pasa a generar sus propios upsets en vez de esto).
function buildHypeItem(slug, tournamentName, bracketUrl, startAtSeconds, entrants) {
  const daysUntil = (startAtSeconds * 1000 - Date.now()) / 86400000;
  const cuando = daysUntil <= 0 ? "¡ya está en curso!" : `empieza en ${Math.ceil(daysUntil)} día(s)`;
  const totalEntrants = entrants ? entrants.length : null;
  // "Destacados" = los primeros 16 por seed. Si todavía no cerró el seeding
  // (entrants sin initialSeedNum), simplemente no hay nada que mostrar acá
  // todavía — no es un error, es que es muy pronto.
  const notableEntrants = entrants
    ? entrants
        .filter(e => e.initialSeedNum != null)
        .sort((a, b) => a.initialSeedNum - b.initialSeedNum)
        .slice(0, 16)
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

async function fetchEventPhases(eventId) {
  const query = `
    query($eventId: ID!){
      event(id:$eventId){
        phases{
          id name state
          seeds(query:{ page:1, perPage:8 }){
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

// Se regenera fresco cada corrida mientras la fase Top 8 exista y no haya
// cerrado — mismo criterio que buildHypeItem/buildBracketProjectionItem, no
// se acumula entre corridas.
function buildTop8PreviewItem(slug, tournamentName, bracketUrl, top8Phase) {
  const seeds = (top8Phase.seeds?.nodes || [])
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
    guid: `melee-top8-${slug}`,
    title: `Top 8 de ${tournamentName}`,
    link: bracketUrl,
    summary: `Quedaron: ${lista}.`,
    image: null,
    pubDate: new Date().toISOString(),
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    esTop8Preview: true,
    jugadores,
  };
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
function buildTournamentArchiveItem(slug, tournamentName, bracketUrl, standings, tournamentUpsets, vod) {
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
async function fetchMeleeItems(previousUpsetItemsByGuid, previousProcessedEventIds) {
  if (!STARTGG_API_KEY) {
    console.error("✗ Melee · falta STARTGG_API_KEY, se omite esta categoría esta corrida");
    return { upsetItems: [], hypeItems: [], projectionItems: [], top8Items: [], archiveItems: [], processedEventIds: previousProcessedEventIds };
  }

  let tournaments = [];
  try {
    const res = await fetch(MELEEMAJORS_URL);
    tournaments = await res.json();
  } catch (e) {
    console.error(`✗ Melee · no se pudo leer meleemajors.gg: ${e.message}`);
    return { upsetItems: [], hypeItems: [], projectionItems: [], top8Items: [], archiveItems: [], processedEventIds: previousProcessedEventIds };
  }

  const upsetItems = [];
  const hypeItems = [];
  const projectionItems = [];
  const top8Items = [];
  const archiveItems = [];
  const processedEventIds = new Set(previousProcessedEventIds);

  for (const t of tournaments) {
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
          hypeItems.push(buildHypeItem(slug, tournamentName, t.bracketUrl, eventInfo.startAt, entrants));
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

      upsetItems.push({
        guid,
        title: `${u.ganador.nombre}${pjGanador} [${u.ganador.seed}] venció a ${u.perdedor.nombre}${pjPerdedor} [${u.perdedor.seed}]`,
        link: t.bracketUrl,
        summary: `${u.ronda} de ${tournamentName}.`,
        image: null,
        pubDate: eventInfo.startAt ? new Date(eventInfo.startAt * 1000).toISOString() : null,
        source: tournamentName,
        categoria: "Melee",
        fullText: null,
        tipo: "video",
        videoId: vod.videoId,
        startSeconds: vod.startSeconds, // opcional — el prototipo lo ignora si no lo usa todavía
        esUpset: u.esUpset,
        ganador: { nombre: u.ganador.nombre, seed: u.ganador.seed, pj: u.ganador.pj, foto: u.ganador.foto },
        perdedor: { nombre: u.perdedor.nombre, seed: u.perdedor.seed, pj: u.perdedor.pj, foto: u.perdedor.foto },
      });
    }

    // Fase 3a: preview de Top 8, solo mientras el torneo sigue ACTIVE (una
    // vez COMPLETED ya no aporta nada — el archivo permanente lo reemplaza).
    if (state === "ACTIVE") {
      try {
        const phases = await fetchEventPhases(eventInfo.id);
        const top8Phase = findTop8Phase(phases);
        if (top8Phase && top8Phase.state !== "COMPLETED") {
          const preview = buildTop8PreviewItem(slug, tournamentName, t.bracketUrl, top8Phase);
          if (preview) top8Items.push(preview);
        }
      } catch (e) {
        console.error(`✗ Melee · preview de Top 8 (${tournamentName}): ${e.message}`);
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
        const archiveItem = buildTournamentArchiveItem(slug, tournamentName, t.bracketUrl, standings, tournamentUpsets, vod);
        if (archiveItem) archiveItems.push(archiveItem);
      } catch (e) {
        console.error(`✗ Melee · archivo final (${tournamentName}): ${e.message}`);
      }
    }

    if (state === "COMPLETED") processedEventIds.add(eventInfo.id);
  }

  return { upsetItems, hypeItems, projectionItems, top8Items, archiveItems, processedEventIds: Array.from(processedEventIds) };
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
  // MagentaTV). Se filtra por título para quedarse solo con presentaciones
  // en vivo de bandas puntuales, no cobertura genérica del festival.
  const CONCIERTOS_EXCLUDE_RE = /\btrailer\b|\baftermovie\b|\bvlog\b|subscribers?|line[- ]?up|ticket|entrevista|\binterview\b|documentary|explains?|announcement|winter nights|full metal cruise/i;
  const CONCIERTOS_INCLUDE_RE = /\blive\b|\bconcert\b|\ben vivo\b/i;
  const recentItemsFiltered = recentItems.filter(a => {
    if (a.categoria !== "Conciertos") return true;
    if (CONCIERTOS_EXCLUDE_RE.test(a.title)) return false;
    return CONCIERTOS_INCLUDE_RE.test(a.title);
  });
  const droppedConciertosCount = recentItems.length - recentItemsFiltered.length;
  if (droppedConciertosCount > 0) {
    console.log(`✓ Conciertos: ${droppedConciertosCount} video(s) descartados (no parecen presentación en vivo de una banda)`);
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
    i => !i.esHype && !i.esProyeccion && !i.esTop8Preview && !i.esArchivo
  );
  const previousArchiveItems = previousMeleeItems.filter(i => i.esArchivo);
  const previousUpsetItemsByGuid = new Map(previousUpsetItemsOnly.map(i => [i.guid, i]));
  const { upsetItems: newUpsetItems, hypeItems, projectionItems, top8Items, archiveItems: newArchiveItems, processedEventIds } = await fetchMeleeItems(
    previousUpsetItemsByGuid,
    previousProcessedEventIds
  );
  console.log(`✓ Melee · ${newUpsetItems.length} upset(s) nuevo(s)/actualizado(s), ${hypeItems.length} torneo(s) generando hype, ${projectionItems.length} proyección(es) de bracket, ${top8Items.length} preview(s) de Top 8, ${newArchiveItems.length} archivo(s) final(es) nuevo(s) esta corrida`);
  // newUpsetItems puede traer versiones actualizadas (VOD recién encontrado)
  // de items que ya estaban en previousUpsetItemsOnly — hay que reemplazarlos,
  // no duplicarlos.
  const newUpsetGuids = new Set(newUpsetItems.map(i => i.guid));
  const carriedUpsetItems = previousUpsetItemsOnly.filter(i => !newUpsetGuids.has(i.guid));
  const allArchiveItems = [...previousArchiveItems, ...newArchiveItems]; // permanente, sin filtro de cutoff
  const cutoffFilteredMeleeItems = [...carriedUpsetItems, ...newUpsetItems, ...hypeItems, ...projectionItems, ...top8Items].filter(
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
