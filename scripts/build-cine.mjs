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

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const OUT_PATH = "data/cine.json";
const CACHE_PATH = "data/cine.json"; // se lee el propio output anterior como cache

const CATEGORIA = "Películas / Series / Animación";
const REGION = "CL";

if (!TMDB_KEY) {
  console.error("Falta TMDB_API_KEY — abortando.");
  process.exit(1);
}

// ─── Utilidades ────────────────────────────────────────────────────────────

// Búsqueda de respaldo cuando TMDb no trae ningún trailer oficial en /videos.
// Sin matching de duración/timestamp — alcanza con encontrar el video correcto.
async function findMovieTrailer(title) {
  if (!YOUTUBE_API_KEY) return null;
  try {
    const q = encodeURIComponent(`${title} trailer official`);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
    );
    const data = await res.json();
    return data?.items?.[0]?.id?.videoId || null;
  } catch (e) {
    console.error(`✗ Cine · búsqueda YouTube de trailer ("${title}"): ${e.message}`);
    return null;
  }
}

async function tmdb(path, params = {}, language = "es-CL") {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  if (language) url.searchParams.set("language", language);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${path} → http ${res.status}`);
  return res.json();
}

async function omdb(imdbId) {
  if (!OMDB_KEY || !imdbId) return null;
  try {
    const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`OMDb http ${res.status} para ${imdbId}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (data.Response === "False") {
      console.error(`OMDb Response=False para ${imdbId}: ${data.Error}`);
      return null;
    }
    const rt = (data.Ratings || []).find(r => r.Source === "Rotten Tomatoes");
    const mc = (data.Ratings || []).find(r => r.Source === "Metacritic");
    return {
      imdb: data.imdbRating && data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null,
      rt: rt ? parseInt(rt.Value) : null,
      metascore: mc ? parseInt(mc.Value) : (data.Metascore && data.Metascore !== "N/A" ? parseInt(data.Metascore) : null),
      plot: data.Plot && data.Plot !== "N/A" ? data.Plot : null,
      poster: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    };
  } catch (e) {
    console.error("OMDb error:", e.message);
    return null;
  }
}

// ── Wikipedia: relleno universal, último recurso después de TMDb (es/en) y OMDb ──
// API REST pública, sin key, contenido con licencia abierta (CC BY-SA) — no es
// scraping ni zona gris de ToS, a diferencia de RT/Metacritic. Intenta español
// primero (nuestro público), cae a inglés si no hay página o viene vacía.
async function wikipediaSummary(title, lang) {
  try {
    let res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) {
      const searchRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&format=json&origin=*`
      );
      const searchData = await searchRes.json();
      const hit = searchData?.query?.search?.[0]?.title;
      if (!hit) return null;
      res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit)}`);
      if (!res.ok) return null;
    }
    const data = await res.json();
    return {
      extract: data.extract || null,
      thumbnail: data.thumbnail?.source || data.originalimage?.source || null,
    };
  } catch (e) {
    console.error(`✗ Wikipedia (${lang}) para "${title}": ${e.message}`);
    return null;
  }
}
async function wikipediaFallback(title) {
  const es = await wikipediaSummary(title, "es");
  if (es && (es.extract || es.thumbnail)) return es;
  return wikipediaSummary(title, "en");
}

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

function pickUserReviews(reviews) {
  const valid = (reviews || []).filter(
    r => r.author_details?.rating != null && r.content?.length > 150
  );
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => b.author_details.rating - a.author_details.rating);
  return {
    top: { rating: sorted[0].author_details.rating, text: sorted[0].content.slice(0, 800), author: sorted[0].author },
    bottom: sorted.length > 1
      ? { rating: sorted.at(-1).author_details.rating, text: sorted.at(-1).content.slice(0, 800), author: sorted.at(-1).author }
      : null,
  };
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

// ─── Enriquecimiento por ítem (rating + reviews + trailer + cast) ─────────

function needsRetry(cached) {
  if (!cached) return true;
  const r = cached.rating || {};
  // si TMDb sí tiene voto propio pero los 3 campos de OMDb están vacíos,
  // asumimos que fue un fallo de OMDb (key inválida, rate limit, etc.) y reintentamos.
  // Mismo criterio para el trailer: si no quedó ninguno, reintentamos — puede que
  // antes no hubiera YOUTUBE_API_KEY seteada y ahora sí haya fallback disponible.
  const ratingMissing = r.imdb == null && r.rt == null && r.metascore == null;
  const trailerMissing = !cached.trailer;
  return ratingMissing || trailerMissing;
}

async function enrichMovieOrTv(mediaType, id, cache, guid) {
  if (cache[guid] && !needsRetry(cache[guid])) return cache[guid];

  const [details, credits, videos, reviewsRes, externalIds] = await Promise.all([
    tmdb(`/${mediaType}/${id}`),
    tmdb(`/${mediaType}/${id}/credits`),
    tmdb(`/${mediaType}/${id}/videos`),
    tmdb(`/${mediaType}/${id}/reviews`),
    tmdb(`/${mediaType}/${id}/external_ids`),
  ]);

  const omdbData = await omdb(externalIds.imdb_id);

  // ── Sinopsis: TMDb es-CL → TMDb en-US → OMDb Plot → Wikipedia (relleno universal) ──
  let summary = details.overview || null;
  if (!summary) {
    const detailsEn = await tmdb(`/${mediaType}/${id}`, {}, "en-US");
    summary = detailsEn.overview || null;
  }
  if (!summary) summary = omdbData?.plot || null;

  // ── Poster: TMDb (idioma pedido) → TMDb /images (todos los idiomas) → OMDb → Wikipedia ──
  let image = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
  if (!image) {
    const imagesRes = await tmdb(`/${mediaType}/${id}/images`, { include_image_language: "en,es,null" }, null);
    const anyPoster = imagesRes.posters?.[0]?.file_path;
    if (anyPoster) image = `https://image.tmdb.org/t/p/w500${anyPoster}`;
  }
  if (!image) image = omdbData?.poster || null;

  // ── Relleno universal: solo se llama a Wikipedia si todavía falta algo ──
  if (!summary || !image) {
    const wiki = await wikipediaFallback(details.title || details.name);
    if (!summary && wiki?.extract) summary = wiki.extract;
    if (!image && wiki?.thumbnail) image = wiki.thumbnail;
  }

  // Cero entradas incompletas: si ninguna de las 4 fuentes trajo sinopsis o
  // poster, se descarta el ítem en vez de publicarlo con huecos.
  if (!summary || !image) {
    console.log(`✗ Cine: "${details.title || details.name}" descartado — sin ${!summary ? "sinopsis" : ""}${!summary && !image ? " ni " : ""}${!image ? "poster" : ""} tras agotar TMDb/OMDb/Wikipedia`);
    return null;
  }

  let trailerKey = (videos.results || []).find(
    v => v.site === "YouTube" && v.type === "Trailer" && v.official
  )?.key || (videos.results || []).find(v => v.site === "YouTube" && v.type === "Trailer")?.key;
  if (!trailerKey) {
    trailerKey = await findMovieTrailer(details.title || details.name);
  }

  const cast = (credits.cast || [])
    .filter(c => c.known_for_department === "Acting")
    .sort((a, b) => a.order - b.order)
    .slice(0, 10)
    .map(c => ({ name: c.name, character: c.character, order: c.order }));

  return {
    guid,
    title: details.title || details.name,
    link: `https://www.themoviedb.org/${mediaType}/${id}`,
    summary,
    image,
    pubDate: details.release_date || details.first_air_date || null,
    source: "TMDb",
    categoria: CATEGORIA,
    fullText: null,
    rating: {
      imdb: omdbData?.imdb ?? null,
      rt: omdbData?.rt ?? null,
      metascore: omdbData?.metascore ?? null,
      tmdb: details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
    },
    reviews: pickUserReviews(reviewsRes.results),
    trailer: trailerKey ? { key: trailerKey, site: "YouTube" } : null,
    cast,
  };
}

async function enrichAnime(malId, cache, guid) {
  if (cache[guid] && !needsRetry(cache[guid])) return cache[guid];

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

  return {
    guid,
    title: d.title,
    link: d.url,
    summary: d.synopsis || "",
    image: d.images?.jpg?.large_image_url || null,
    pubDate: d.aired?.from || null,
    source: "MyAnimeList",
    categoria: CATEGORIA,
    fullText: null,
    rating: { imdb: null, rt: null, metascore: null, tmdb: d.score ?? null },
    reviews: pickJikanReviews(reviewsRes?.data),
    trailer: trailerKey ? { key: trailerKey, site: "YouTube" } : null,
    cast: [], // Jikan no trae reparto en /full; queda vacío, no bloquea el resto
  };
}

// ─── Descubrimiento ─────────────────────────────────────────────────────────

async function discoverMovies() {
  const [trending, nowPlaying] = await Promise.all([
    tmdb("/trending/movie/week"),
    tmdb("/movie/now_playing", { region: REGION }),
  ]);
  const seen = new Set();
  const out = [];
  for (const m of [...(nowPlaying.results || []), ...(trending.results || [])]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out.slice(0, 15); // límite razonable por corrida — no hace falta el catálogo completo
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

async function main() {
  const cache = await loadCache();

  const [movies, tv, anime] = await Promise.all([discoverMovies(), discoverTv(), discoverAnime()]);

  const items = [];

  for (const m of movies) {
    try {
      const enriched = await enrichMovieOrTv("movie", m.id, cache, `tmdb-movie-${m.id}`);
      if (enriched) items.push(enriched);
    } catch (e) { console.error(`movie ${m.id} falló:`, e.message); }
  }
  for (const t of tv) {
    try {
      const enriched = await enrichMovieOrTv("tv", t.id, cache, `tmdb-tv-${t.id}`);
      if (enriched) items.push(enriched);
    } catch (e) { console.error(`tv ${t.id} falló:`, e.message); }
  }
  for (const a of anime) {
    try {
      const enriched = await enrichAnime(a.mal_id, cache, `mal-${a.mal_id}`);
      if (enriched) items.push(enriched);
    } catch (e) { console.error(`anime ${a.mal_id} falló:`, e.message); }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    categories: [{ cat: CATEGORIA, items }],
  };

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✓ cine.json: ${items.length} items (${movies.length} pelis, ${tv.length} series, ${anime.length} anime)`);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
