import { CINE_JSON_URL, FEED_JSON_URL, FORMATO_BY_CATEGORIA, MELEE_JSON_URL, VITRINA_CATEGORIAS, fetchJsonSafe } from "./constants.js";

const { useState, useEffect, useRef } = React;


// ─── Orden round-robin entre categorías (no cronológico puro) ──────────────
// Se mantiene igual — el JSON ya viene agrupado por categoría, esto solo
// decide el orden de aparición.
function roundRobinMerge(byCategoryArrays) {
  const queues = byCategoryArrays.map(c => ({ cat: c.cat, items: [...c.items] }));
  const out = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const q of queues) {
      if (q.items.length) { out.push(q.items.shift()); progressed = true; }
    }
  }
  return out;
}

export async function fetchFeedData() {
  const [feedData, cineData, meleeData] = await Promise.all([
    fetchJsonSafe(FEED_JSON_URL),
    fetchJsonSafe(CINE_JSON_URL),
    fetchJsonSafe(MELEE_JSON_URL),
  ]);
  if (!feedData && !cineData && !meleeData) throw new Error("no se pudo leer ni feed.json, cine.json ni melee.json");

  const merged = {}; // cat -> items[]
  function ingest(data, formatoDefault) {
    if (!data) return;
    for (const c of (data.categories || [])) {
      const formato = FORMATO_BY_CATEGORIA[c.cat] || formatoDefault;
      const items = (c.items || []).map(it => ({ ...it, formato }));
      merged[c.cat] = [...(merged[c.cat] || []), ...items];
    }
  }
  ingest(feedData, "lectura");
  ingest(cineData, "cine");
  ingest(meleeData, "lectura");

  // Vitrina (Películas/Series/Animación/Microdocumentales) sale del round-robin
  // de Noticias — es un catálogo aparte, siempre completo.
  const vitrina = {};
  const feedCats = [];
  for (const [cat, items] of Object.entries(merged)) {
    if (VITRINA_CATEGORIAS.includes(cat)) vitrina[cat] = items;
    else feedCats.push({ cat, items });
  }

  const diag = feedCats.map(c => ({
    cat: c.cat,
    count: c.items.length,
    withText: c.items.filter(i => (i.tipo === "video" && i.videoId) || i.fullText).length,
  }));
  const generatedAt = feedData?.generatedAt || cineData?.generatedAt || meleeData?.generatedAt || null;
  return { queue: roundRobinMerge(feedCats), vitrina, diag, generatedAt };
}

