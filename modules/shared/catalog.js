import { CINE_JSON_URL, FEED_JSON_URL, FORMATO_BY_CATEGORIA, GAME_ENHANCED_JSON_URL, MELEE_JSON_URL, MUSIC_CATEGORIA, MUSICA_JSON_URL, VIDEOTECA_JSON_URL, VITRINA_CATEGORIAS, fetchJsonSafe, tcgcryptoJsonUrl, DATA_BASES } from "./constants.js";

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
    // Música tiene su propio módulo (🎧): aunque un feed.json anterior aún la traiga, no entra a la cola.
    .filter(c => !VITRINA_CATEGORIAS.includes(c.cat) && c.cat !== MUSIC_CATEGORIA)
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

// Música: lanzamientos + fichas de artista (musica.json, lo escribe build-musica.mjs).
// Archivo propio: la música ya no viaja en feed.json.
// Game enhanced: decomps/ports e juegos nuevos de los estudios (game-enhanced.json, lo escribe
// modules/feed/scripts/build-game-enhanced.mjs una vez al día). Archivo propio.
export async function fetchGameEnhancedData() {
  const d = await fetchJsonSafe(GAME_ENHANCED_JSON_URL);
  if (!d || !Array.isArray(d.decomps) || !Array.isArray(d.estudios)) throw new Error("no se pudo leer game-enhanced.json");
  return { juegos: [...d.decomps, ...d.estudios], generatedAt: d.generatedAt || null, fuentes: d.fuentes || {} };
}

// tcgcrypto: catálogo + precios por set y versión de UN juego (tcgcrypto-<juego>.json). Archivo propio por juego.
// Archivos de datos del repo (pool, historial, catálogos): main primero y, si no está ahí, la rama de pruebas. Con `nuevo` consulta ambos y se
// queda con el más reciente (los que traen generatedAt). Cacheado por ruta: un archivo de letra o de grupo se baja una sola vez por sesión.
const _cacheData = new Map();
export function fetchDataJson(ruta, { nuevo = false } = {}) {
  const k = ruta + (nuevo ? "#n" : "");
  if (!_cacheData.has(k)) {
    _cacheData.set(k, (async () => {
      if (nuevo) {
        const rs = (await Promise.all(DATA_BASES.map(b => fetchJsonSafe(b + ruta)))).filter(Boolean);
        return rs.sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")))[0] || null;
      }
      for (const b of DATA_BASES) { const d = await fetchJsonSafe(b + ruta); if (d) return d; }
      return null;
    })().then(d => { if (!d) _cacheData.delete(k); return d; }));
  }
  return _cacheData.get(k);
}
// Pool completo de un juego: índice de nombres (se baja al primer tipeo), archivo por letra (al elegir la carta) y pasaportes (.ydk).
export const fetchPoolIndice = juego => fetchDataJson(`tcgcrypto-pool/${juego}-index.json`, { nuevo: true });
export const fetchPoolLetra = (juego, letra) => fetchDataJson(`tcgcrypto-pool/${juego}-${letra}.json`);
export const fetchPoolCodigos = () => fetchDataJson("tcgcrypto-pool/yugioh-codigos.json", { nuevo: true });

export async function fetchTcgCryptoData(tcg) {
  const d = await fetchDataJson(`tcgcrypto-${tcg}.json`, { nuevo: true }) || await fetchJsonSafe(tcgcryptoJsonUrl(tcg));
  if (!d || !Array.isArray(d.cartas) || !Array.isArray(d.colecciones) || !Array.isArray(d.sets)) throw new Error(`no se pudo leer tcgcrypto-${tcg}.json`);
  return d;
}

export async function fetchMusicaData() {
  const d = await fetchJsonSafe(MUSICA_JSON_URL);
  if (!d || !Array.isArray(d.lanzamientos)) throw new Error("no se pudo leer musica.json");
  return { lanzamientos: d.lanzamientos, artistas: d.artistas || {}, generatedAt: d.generatedAt || null };
}
