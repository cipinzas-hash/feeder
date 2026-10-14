import { CINE_JSON_URL, FEED_JSON_URL, FORMATO_BY_CATEGORIA, MELEE_JSON_URL, VIDEOTECA_JSON_URL, VITRINA_CATEGORIAS, fetchJsonSafe } from "./constants.js";

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

// Noticias (Feed): cola round-robin con todo lo que NO es Vitrina. Lee solo
// feed.json -- antes también bajaba cine.json y melee.json para descartarlos.
export async function fetchFeedData() {
  const feedData = await fetchJsonSafe(FEED_JSON_URL);
  if (!feedData) throw new Error("no se pudo leer feed.json");
  const feedCats = (feedData.categories || [])
    .filter(c => !VITRINA_CATEGORIAS.includes(c.cat))
    .map(c => {
      const formato = FORMATO_BY_CATEGORIA[c.cat] || "lectura";
      return { cat: c.cat, items: (c.items || []).map(it => ({ ...it, formato })) };
    });
  const diag = feedCats.map(c => ({
    cat: c.cat,
    count: c.items.length,
    withText: c.items.filter(i => (i.tipo === "video" && i.videoId) || i.fullText).length,
  }));
  return { queue: roundRobinMerge(feedCats), diag, generatedAt: feedData.generatedAt || null };
}

// Vitrina: cine.json + melee.json + videoteca.json (~0,4 MB en total). Si
// videoteca.json todavía no existe se cae a feed.json (pesado) para no dejar
// Docs y Conciertos vacíos. `fuentes` dice qué archivo llegó y de cuándo es,
// para que la pantalla pueda avisar en vez de mostrarse en blanco.
export async function fetchVitrinaData() {
  const [cineData, meleeData, videotecaData] = await Promise.all([
    fetchJsonSafe(CINE_JSON_URL),
    fetchJsonSafe(MELEE_JSON_URL),
    fetchJsonSafe(VIDEOTECA_JSON_URL),
  ]);
  let videoteca = videotecaData;
  let videotecaRespaldo = false;
  if (!videoteca) { videoteca = await fetchJsonSafe(FEED_JSON_URL); videotecaRespaldo = !!videoteca; }
  const fuentes = {
    cine: { ok: !!cineData, generatedAt: cineData?.generatedAt || null },
    melee: { ok: !!meleeData, generatedAt: meleeData?.generatedAt || null },
    videoteca: { ok: !!videoteca, generatedAt: videoteca?.generatedAt || null, respaldo: videotecaRespaldo },
  };
  if (!cineData && !meleeData && !videoteca) throw Object.assign(new Error("no se pudo leer cine.json, melee.json ni videoteca.json"), { fuentes });

  const vitrina = {};
  function ingest(data, formatoDefault) {
    if (!data) return;
    for (const c of (data.categories || [])) {
      if (!VITRINA_CATEGORIAS.includes(c.cat)) continue;
      const formato = FORMATO_BY_CATEGORIA[c.cat] || formatoDefault;
      vitrina[c.cat] = [...(vitrina[c.cat] || []), ...(c.items || []).map(it => ({ ...it, formato }))];
    }
  }
  ingest(videoteca, "lectura");
  ingest(cineData, "cine");
  ingest(meleeData, "lectura");
  const generatedAt = [cineData, meleeData, videoteca].map(d => d?.generatedAt).filter(Boolean).sort().pop() || null;
  return { vitrina, fuentes, generatedAt };
}
