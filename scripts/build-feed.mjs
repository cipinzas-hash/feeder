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
        const base = {
          guid: item.guid || item.id || item.link,
          title: (item.title || "").trim(),
          link: item.link || "",
          summary: stripHtml(item.contentSnippet || item.summary || item.content || "").slice(0, 260),
          image: extractImage(item),
          pubDate: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null),
          source: source.name,
          categoria: cat,
          fullText: item.contentEncoded ? sanitize(item.contentEncoded) : null,
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
    if (!res.ok) return null;
    // el abort tiene que seguir armado durante res.text() también: fetch() resuelve
    // apenas llegan los headers, no cuando termina de bajar el body — si no, una
    // página que gotea el body muy lento (o se cuelga) queda leyendo sin límite.
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;
    return sanitize(article.content);
  } catch (e) {
    return null;
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
          nodes{ id fullRoundText winnerId slots{ entrant{ id name initialSeedNum } } }
        }
      }
    }`;
  const data = await startggQuery(query, { eventId });
  return data?.event?.sets?.nodes || [];
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
        ganador: { nombre: winner.name, seed: winner.initialSeedNum },
        perdedor: { nombre: loser.name, seed: loser.initialSeedNum },
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
function buildHypeItem(slug, tournamentName, bracketUrl, startAtSeconds) {
  const daysUntil = (startAtSeconds * 1000 - Date.now()) / 86400000;
  const cuando = daysUntil <= 0 ? "¡ya está en curso!" : `empieza en ${Math.ceil(daysUntil)} día(s)`;
  return {
    guid: `melee-hype-${slug}`,
    title: `Se viene ${tournamentName}`,
    link: bracketUrl,
    summary: `${cuando} Bracket en start.gg.`,
    image: null,
    pubDate: new Date().toISOString(), // se regenera cada corrida, no se acumula
    source: tournamentName,
    categoria: "Melee",
    fullText: null,
    esHype: true,
  };
}

// previousMeleeGuids: sets de guids de upsets ya generados en corridas anteriores
//   (para no duplicar). Los items de hype no entran acá — se regeneran siempre.
// previousProcessedEventIds: ids de evento de start.gg cuyo bracket ya se escaneó
//   completo — evita repetir llamadas a start.gg/YouTube por un torneo que ya
//   no va a cambiar (terminó y ya se sacaron sus upsets una vez).
async function fetchMeleeItems(previousMeleeGuids, previousProcessedEventIds) {
  if (!STARTGG_API_KEY) {
    console.error("✗ Melee · falta STARTGG_API_KEY, se omite esta categoría esta corrida");
    return { upsetItems: [], hypeItems: [], processedEventIds: previousProcessedEventIds };
  }

  let tournaments = [];
  try {
    const res = await fetch(MELEEMAJORS_URL);
    tournaments = await res.json();
  } catch (e) {
    console.error(`✗ Melee · no se pudo leer meleemajors.gg: ${e.message}`);
    return { upsetItems: [], hypeItems: [], processedEventIds: previousProcessedEventIds };
  }

  const upsetItems = [];
  const hypeItems = [];
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

    // Torneo todavía no termina: candidato a "hype", no a upsets.
    if (eventInfo.state !== "COMPLETED") {
      if (eventInfo.startAt) {
        const daysUntil = (eventInfo.startAt * 1000 - Date.now()) / 86400000;
        if (daysUntil <= HYPE_WINDOW_DAYS) {
          hypeItems.push(buildHypeItem(slug, tournamentName, t.bracketUrl, eventInfo.startAt));
        }
      }
      continue;
    }

    // Torneo ya terminado: detección de upsets (comportamiento de antes).
    if (previousProcessedEventIds.includes(eventInfo.id)) continue; // ya escaneado antes

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
      if (previousMeleeGuids.has(guid)) continue;

      const vod = await findVod(tournamentName, u.ganador.nombre, u.perdedor.nombre);

      upsetItems.push({
        guid,
        title: `${u.ganador.nombre} [${u.ganador.seed}] venció a ${u.perdedor.nombre} [${u.perdedor.seed}]`,
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
      });
    }

    processedEventIds.add(eventInfo.id);
  }

  return { upsetItems, hypeItems, processedEventIds: Array.from(processedEventIds) };
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
  const previousMeleeGuids = new Set(previousMeleeItems.map(i => i.guid));
  const previousProcessedEventIds = previous.meleeProcessedEvents || [];

  const allSources = feedsConfig.flatMap(g => g.feeds.map(f => ({ ...f, cat: g.cat })));
  console.log(`Bajando ${allSources.length} feeds...`);
  const fetched = await mapWithConcurrency(allSources, FEED_CONCURRENCY, f => fetchFeed(f, f.cat));
  const allItems = fetched.flat();

  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  const recentItems = allItems.filter(a => !a.pubDate || new Date(a.pubDate).getTime() >= cutoff);

  let extractionsUsed = 0;
  console.log(`Extrayendo texto completo (tope ${MAX_NEW_EXTRACTIONS_PER_RUN} nuevas esta corrida)...`);
  const withFullText = await mapWithConcurrency(recentItems, EXTRACT_CONCURRENCY, async item => {
    if (item.tipo === "video") return item; // el link es la página de YouTube, no hay texto real que extraer ahí
    if (item.fullText) return item; // ya vino con content:encoded
    const prev = previousByGuid.get(item.guid);
    if (prev?.fullText) return { ...item, fullText: prev.fullText }; // ya se había extraído antes
    if (extractionsUsed >= MAX_NEW_EXTRACTIONS_PER_RUN) return item; // se completa en la próxima corrida
    extractionsUsed++;
    const fullText = await extractFullText(item.link);
    return { ...item, fullText };
  });

  // Melee: se generan aparte (no vienen de feeds.json). Los upsets se acumulan
  // igual que antes (se combinan con lo ya generado en corridas previas); los
  // items de "hype" (torneo por venir) se regeneran frescos en cada corrida,
  // así que no se cargan del archivo anterior — se descartan los viejos y se
  // usan solo los que acaba de calcular esta corrida.
  console.log("Procesando Melee (meleemajors.gg + start.gg + YouTube)...");
  const previousUpsetItemsOnly = previousMeleeItems.filter(i => !i.esHype);
  const { upsetItems: newUpsetItems, hypeItems, processedEventIds } = await fetchMeleeItems(
    previousMeleeGuids,
    previousProcessedEventIds
  );
  console.log(`✓ Melee · ${newUpsetItems.length} upsets nuevos, ${hypeItems.length} torneo(s) generando hype esta corrida`);
  const allMeleeItems = [...previousUpsetItemsOnly, ...newUpsetItems, ...hypeItems].filter(
    a => !a.pubDate || new Date(a.pubDate).getTime() >= cutoff
  );

  const finalItems = [...withFullText, ...allMeleeItems];

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
