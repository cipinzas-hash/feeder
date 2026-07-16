// build-feed.mjs
// Corre vía GitHub Action cada 4h. Baja los feeds definidos en feeds.json,
// extrae texto completo (Readability) solo para artículos nuevos que no
// vinieron ya con content:encoded, y escribe todo en data/feed.json.
//
// Angst (el prototipo/la app) solo hace fetch() a ese JSON servido por
// raw.githubusercontent.com — CORS nativo, sin proxy de ningún tipo.

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
      .map(item => ({
        guid: item.guid || item.id || item.link,
        title: (item.title || "").trim(),
        link: item.link || "",
        summary: stripHtml(item.contentSnippet || item.summary || item.content || "").slice(0, 260),
        image: extractImage(item),
        pubDate: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null),
        source: source.name,
        categoria: cat,
        fullText: item.contentEncoded ? sanitize(item.contentEncoded) : null,
      }))
      .filter(a => a.title && a.link && a.guid);
  } catch (e) {
    console.error(`✗ ${cat} · ${source.name}: ${e.message}`);
    return [];
  }
}

async function extractFullText(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;
    return sanitize(article.content);
  } catch (e) {
    return null;
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
  const recentItems = allItems.filter(a => !a.pubDate || new Date(a.pubDate).getTime() >= cutoff);

  let extractionsUsed = 0;
  console.log(`Extrayendo texto completo (tope ${MAX_NEW_EXTRACTIONS_PER_RUN} nuevas esta corrida)...`);
  const withFullText = await mapWithConcurrency(recentItems, EXTRACT_CONCURRENCY, async item => {
    if (item.fullText) return item; // ya vino con content:encoded
    const prev = previousByGuid.get(item.guid);
    if (prev?.fullText) return { ...item, fullText: prev.fullText }; // ya se había extraído antes
    if (extractionsUsed >= MAX_NEW_EXTRACTIONS_PER_RUN) return item; // se completa en la próxima corrida
    extractionsUsed++;
    const fullText = await extractFullText(item.link);
    return { ...item, fullText };
  });

  const byCat = {};
  withFullText.forEach(item => {
    if (!byCat[item.categoria]) byCat[item.categoria] = [];
    byCat[item.categoria].push(item);
  });
  const categories = Object.entries(byCat).map(([cat, items]) => ({
    cat,
    items: items.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || "")),
  }));

  const output = { generatedAt: new Date().toISOString(), categories };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  const total = withFullText.length;
  const withText = withFullText.filter(i => i.fullText).length;
  console.log(`✓ ${total} items en ${categories.length} categorías · ${withText} con texto completo · ${extractionsUsed} extracciones nuevas esta corrida`);
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
