// build-cine.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Arma data/cine.json: descubrimiento + sinopsis (TMDb) + puntajes agregados
// (OMDb, solo para los ítems ya seleccionados) + reseñas de usuario (TMDb;
// Jikan para anime) + trailer (TMDb videos, con respaldo de búsqueda en YouTube
// si TMDb no trae ninguno) + cast (TMDb credits).
//
// Secrets requeridos en el repo (Settings → Secrets and variables → Actions):
//   TMDB_API_KEY
//   OMDB_API_KEY
//   YOUTUBE_API_KEY (ya existe — la usa también el módulo Melee)
//
// No requiere key: Jikan (MyAnimeList no oficial).
//
// Mismo criterio que build-feed.mjs: cache contra la corrida anterior por
// guid, no recalcula rating/reviews/trailer de ítems ya procesados.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import { tmdb, needsRetry, enrichMovieOrTv, findMovieTrailer, wikipediaFallback, CATEGORIA_PELICULAS, CATEGORIA_SERIES, CATEGORIA_ANIMACION } from "./lib/enrich.mjs";

const TMDB_KEY = process.env.TMDB_API_KEY;
const OUT_PATH = "data/cine.json";
const CACHE_PATH = "data/cine.json"; // se lee el propio output anterior como cache

const REGION = "CL";

// Destacados: catálogo "vitrina" — un ítem se conserva 30 días desde que el
// sistema lo descubrió por primera vez (firstSeenAt), sin importar si sigue
// en trending/now_playing esa corrida. Así se puede hojear el mes completo,
// no solo lo que trajo la corrida más reciente.
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

if (!TMDB_KEY) {
  console.error("Falta TMDB_API_KEY — abortando.");
  process.exit(1);
}

// ─── Utilidades propias de Cine (no compartidas -- Jikan/anime es exclusivo de acá) ──

async function jikanFetch(path) {
  try {
    const res = await fetch(`https://api.jikan.moe/v4${path}`);
    if (!res.ok) return null;
    await new Promise(r => setTimeout(r, 400)); // Jikan pide ~3 req/s máx
    return res.json();
  } catch (e) {
    return null;
  }
}

function pickJikanReviews(reviews) {
  const valid = (reviews || []).filter(r => r.score != null && r.review?.length > 150);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => b.score - a.score);
  return {
    top: { rating: sorted[0].score, text: sorted[0].review.slice(0, 800), author: sorted[0].user?.username || "MAL user" },
    bottom: sorted.length > 1
      ? { rating: sorted.at(-1).score, text: sorted.at(-1).review.slice(0, 800), author: sorted.at(-1).user?.username || "MAL user" }
      : null,
  };
}

// ─── Cache de la corrida anterior ──────────────────────────────────────────

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const data = JSON.parse(raw);
    const byGuid = {};
    for (const c of data.categories || []) {
      for (const it of c.items || []) byGuid[it.guid] = it;
    }
    return byGuid;
  } catch (e) {
    return {};
  }
}

async function enrichAnime(malId, cache, guid) {
  if (cache[guid] && !needsRetry(cache[guid])) return cache[guid];
  const firstSeenAt = cache[guid]?.firstSeenAt || new Date().toISOString();

  const [detailsRes, reviewsRes] = await Promise.all([
    jikanFetch(`/anime/${malId}/full`),
    jikanFetch(`/anime/${malId}/reviews`),
  ]);
  const d = detailsRes?.data;
  if (!d) return null;

  let trailerKey = d.trailer?.youtube_id || null;
  if (!trailerKey) {
    trailerKey = await findMovieTrailer(d.title);
  }

  // MAL suele tener sinopsis muy pobre para entradas de temporada
  // continuación (ej. "2nd Season") -- a veces solo dice "la nueva
  // temporada de X" en vez de describir la trama real. Mismo fallback
  // universal que ya usan películas/series: si es sospechosamente corta,
  // Wikipedia.
  let summary = d.synopsis || null;
  if (!summary || summary.trim().length < 80) {
    const wiki = await wikipediaFallback(d.title);
    if (wiki?.extract && wiki.extract.length > (summary?.trim().length || 0)) summary = wiki.extract;
  }

  return {
    guid,
    title: d.title,
    link: d.url,
    summary: summary || "",
    image: d.images?.jpg?.large_image_url || null,
    pubDate: d.aired?.from || null,
    source: "MyAnimeList",
    categoria: CATEGORIA_ANIMACION,
    firstSeenAt,
    fullText: null,
    rating: { imdb: null, rt: null, metascore: null, tmdb: d.score ?? null },
    // Jikan: Currently Airing / Finished Airing / Not yet aired
    status: d.status || null,
    nextEpisodeDate: null,
    reviews: pickJikanReviews(reviewsRes?.data),
    trailer: trailerKey ? { key: trailerKey, site: "YouTube" } : null,
    cast: [], // Jikan no trae reparto en /full; queda vacío, no bloquea el resto
  };
}

// ─── Descubrimiento ─────────────────────────────────────────────────────────

async function discoverMovies() {
  const [trending, nowPlaying, upcoming] = await Promise.all([
    tmdb("/trending/movie/week"),
    tmdb("/movie/now_playing", { region: REGION }),
    tmdb("/movie/upcoming", { region: REGION }),
  ]);
  const trendingIds = new Set((trending.results || []).map(m => m.id));

  const seen = new Set();
  const out = [];
  function add(m) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    out.push({ ...m, _trending: trendingIds.has(m.id) });
  }

  // Cupo reservado por fuente -- antes now_playing solo ya llenaba el límite
  // de 15 antes de que trending tuviera oportunidad de aportar nada (bug
  // real: así fue como Coyote vs. Acme, trending pero sin estrenar, nunca
  // entraba al catálogo).
  (nowPlaying.results || []).slice(0, 10).forEach(add);
  (trending.results || []).slice(0, 10).forEach(add);
  // Upcoming solo entra si ADEMÁS está en trending esta semana -- así se
  // capta hype real de próximos estrenos, no cualquier estreno programado
  // sin ruido detrás.
  (upcoming.results || []).filter(m => trendingIds.has(m.id)).slice(0, 5).forEach(add);

  return out.slice(0, 25);
}

async function discoverTv() {
  const [trending, onAir] = await Promise.all([
    tmdb("/trending/tv/week"),
    tmdb("/tv/on_the_air"),
  ]);
  const seen = new Set();
  const out = [];
  for (const t of [...(onAir.results || []), ...(trending.results || [])]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out.slice(0, 15);
}

async function discoverAnime() {
  const res = await jikanFetch("/seasons/now");
  return (res?.data || []).slice(0, 15);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function isFresh(item) {
  if (!item.firstSeenAt) return false; // cache viejo, de antes de esta feature — no se arrastra
  return Date.now() - new Date(item.firstSeenAt).getTime() <= RETENTION_MS;
}

// Arrastra del cache lo que sigue vigente (dentro de RETENTION_DAYS) pero no
// fue redescubierto esta corrida — ej. una peli que ya salió del top de
// trending/now_playing pero todavía no cumple el mes en el catálogo.
// trending:false explícito -- por definición no viene de la corrida fresca.
function carryOverFresh(cache, guidPrefix, alreadyIncludedGuids) {
  const out = [];
  for (const [guid, item] of Object.entries(cache)) {
    if (!guid.startsWith(guidPrefix)) continue;
    if (alreadyIncludedGuids.has(guid)) continue;
    if (!isFresh(item)) continue;
    out.push({ ...item, trending: false });
  }
  return out;
}

async function main() {
  const cache = await loadCache();

  const [movies, tv, anime] = await Promise.all([discoverMovies(), discoverTv(), discoverAnime()]);

  const movieItems = [];
  const tvItems = [];
  const animeItems = [];

  for (const m of movies) {
    try {
      const enriched = await enrichMovieOrTv("movie", m.id, cache, `tmdb-movie-${m.id}`);
      if (enriched) { enriched.trending = !!m._trending; movieItems.push(enriched); }
    } catch (e) { console.error(`movie ${m.id} falló:`, e.message); }
  }
  for (const t of tv) {
    try {
      const enriched = await enrichMovieOrTv("tv", t.id, cache, `tmdb-tv-${t.id}`);
      if (!enriched) continue;
      // Solo producciones actuales en Series -- lo terminado/cancelado no
      // se descubre de nuevo (queda fuera desde la primera corrida en vez
      // de colarse y recién podarse a los 30 días).
      if (enriched.categoria === CATEGORIA_SERIES && (enriched.status === "Ended" || enriched.status === "Canceled")) continue;
      if (enriched.categoria === CATEGORIA_ANIMACION) animeItems.push(enriched);
      else tvItems.push(enriched);
    } catch (e) { console.error(`tv ${t.id} falló:`, e.message); }
  }
  for (const a of anime) {
    try {
      const enriched = await enrichAnime(a.mal_id, cache, `mal-${a.mal_id}`);
      if (enriched) animeItems.push(enriched);
    } catch (e) { console.error(`anime ${a.mal_id} falló:`, e.message); }
  }

  // Catálogo de 30 días: sumar lo que sigue vigente en cache y no se
  // redescubrió esta corrida (salió del top trending pero no cumplió el mes).
  const movieGuids = new Set(movieItems.map(i => i.guid));
  const animeGuids = new Set(animeItems.map(i => i.guid)); // incluye mal-* y tmdb-tv-* ya ruteados a Animación
  movieItems.push(...carryOverFresh(cache, "tmdb-movie-", movieGuids));
  // tmdb-tv-* puede haber quedado categorizado como Series o Animación en
  // una corrida anterior -- hay que respetar lo que diga el propio campo
  // `categoria` del ítem cacheado, no asumir que todo tmdb-tv-* es Series.
  const tvAlreadyIncluded = new Set([...tvItems, ...animeItems].filter(i => i.guid.startsWith("tmdb-tv-")).map(i => i.guid));
  for (const item of carryOverFresh(cache, "tmdb-tv-", tvAlreadyIncluded)) {
    if (item.categoria === CATEGORIA_ANIMACION) animeItems.push(item);
    else tvItems.push(item);
  }
  animeItems.push(...carryOverFresh(cache, "mal-", animeGuids));

  // Filtro final: aunque haya sido redescubierto esta corrida, si ya pasó el
  // mes desde firstSeenAt, se descarta igual (caso raro pero posible: algo
  // vuelve a trending justo el día que cumple 30 días).
  const finalMovies = movieItems.filter(isFresh);
  const finalTv = tvItems.filter(isFresh);
  const finalAnime = animeItems.filter(isFresh);

  const output = {
    generatedAt: new Date().toISOString(),
    categories: [
      { cat: CATEGORIA_PELICULAS, items: finalMovies },
      { cat: CATEGORIA_SERIES, items: finalTv },
      { cat: CATEGORIA_ANIMACION, items: finalAnime },
    ],
  };

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✓ cine.json: ${finalMovies.length} pelis, ${finalTv.length} series, ${finalAnime.length} anime (catálogo 30 días)`);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
