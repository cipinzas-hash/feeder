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
          summary: stripHtml(item.contentSnippet || item.summary || item.content || "")
