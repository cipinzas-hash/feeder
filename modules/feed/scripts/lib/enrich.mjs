// lib/enrich.mjs
// Extraído de build-cine.mjs (30-ago/1-sep 2026) para que build-simkl.mjs
// pueda traer póster/sinopsis/rating de un ítem puntual sin duplicar todo
// el pipeline de enriquecimiento. Misma lógica exacta, sin cambios de
// comportamiento -- solo movida de lugar.
//
// Quien importe esto debe tener seteadas las mismas env vars que ya usaba
// build-cine.mjs: TMDB_API_KEY (obligatoria), OMDB_API_KEY y
// YOUTUBE_API_KEY (opcionales, degradan solo si faltan).

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export const CATEGORIA_PELICULAS = "Películas";
export const CATEGORIA_SERIES = "Series";
export const CATEGORIA_ANIMACION = "Animación";

// ─── Utilidades ────────────────────────────────────────────────────────────

// Búsqueda de respaldo cuando TMDb no trae ningún trailer oficial en /videos.
// Sin matching de duración/timestamp — alcanza con encontrar el video correcto.
export async function findMovieTrailer(title) {
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

export async function tmdb(path, params = {}, language = "es-CL") {
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
export { wikipediaFallback };

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

// ─── Enriquecimiento por ítem (rating + reviews + trailer + cast) ─────────

export function needsRetry(cached) {
  if (!cached) return true;
  const r = cached.rating || {};
  // si TMDb sí tiene voto propio pero los 3 campos de OMDb están vacíos,
  // asumimos que fue un fallo de OMDb (key inválida, rate limit, etc.) y reintentamos.
  // Mismo criterio para el trailer: si no quedó ninguno, reintentamos — puede que
  // antes no hubiera YOUTUBE_API_KEY seteada y ahora sí haya fallback disponible.
  const ratingMissing = r.imdb == null && r.rt == null && r.metascore == null;
  const trailerMissing = !cached.trailer;
  const statusMissing = cached.status === undefined;
  const seasonsMissing = cached.numberOfSeasons === undefined;
  return ratingMissing || trailerMissing || statusMissing || seasonsMissing;
}

export async function enrichMovieOrTv(mediaType, id, cache, guid) {
  if (cache[guid] && !needsRetry(cache[guid])) return cache[guid];
  const firstSeenAt = cache[guid]?.firstSeenAt || new Date().toISOString();

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
    categoria: (mediaType === "movie")
      ? CATEGORIA_PELICULAS
      // TV animada (género 16 de TMDb) va a Animación sin importar el país
      // de origen -- antes toda serie, animada o no, caía en Series por
      // default.
      : ((details.genres || []).some(g => g.id === 16) ? CATEGORIA_ANIMACION : CATEGORIA_SERIES),
    firstSeenAt,
    fullText: null,
    rating: {
      imdb: omdbData?.imdb ?? null,
      rt: omdbData?.rt ?? null,
      metascore: omdbData?.metascore ?? null,
      tmdb: details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
    },
    // TMDb: movies → Released/Post Production/In Production/Planned/Canceled/Rumored.
    // TV → Returning Series/Ended/Canceled/In Production/Planned/Pilot.
    status: details.status || null,
    nextEpisodeDate: mediaType === "tv" ? (details.next_episode_to_air?.air_date || null) : null,
    numberOfSeasons: mediaType === "tv" ? (details.number_of_seasons || null) : null,
    // "en curso" = la última temporada que emitió (no necesariamente la
    // última numerada — a veces TMDb cuenta specials como su propia
    // temporada). Si terminó, esto no se usa: se muestra el total.
    currentSeason: mediaType === "tv" ? (details.last_episode_to_air?.season_number || null) : null,
    reviews: pickUserReviews(reviewsRes.results),
    trailer: trailerKey ? { key: trailerKey, site: "YouTube" } : null,
    cast,
  };
}
