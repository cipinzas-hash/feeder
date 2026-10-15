const { useState, useEffect, useRef } = React;


// ─── Fuente de datos: los JSON que arman los GitHub Actions ─────────────────
// Si tu rama por defecto no es "main", este es el único lugar que hay que tocar.
export const FEED_JSON_URL = "https://raw.githubusercontent.com/cipinzas-hash/feeder/main/modules/feed/data/feed.json";
export const CINE_JSON_URL = "https://raw.githubusercontent.com/cipinzas-hash/feeder/main/modules/feed/data/cine.json";
export const MELEE_JSON_URL = "https://raw.githubusercontent.com/cipinzas-hash/feeder/main/modules/feed/data/melee.json";
// Microdocumentales + Conciertos aparte (lo genera build-feed): la Vitrina no necesita bajar
// los ~5 MB de feed.json para leer ~60 KB.
export const VIDEOTECA_JSON_URL = "https://raw.githubusercontent.com/cipinzas-hash/feeder/main/modules/feed/data/videoteca.json";

// Destacados (vitrina audiovisual) — 3 categorías separadas, cada una su
// propio carrusel. Ya no participan del swipe round-robin de "Noticias".
export const CINE_CATEGORIAS = ["Películas", "Series", "Animación"];
// Microdocumentales vive en Vitrina también, pero NO es carrusel de posters
// (es un feed vertical de video+comentario) — por eso es una categoría aparte
// de CINE_CATEGORIAS aunque comparta la misma exclusión del round-robin.
export const VITRINA_CATEGORIAS = [...CINE_CATEGORIAS, "Microdocumentales", "Melee", "Conciertos"];
const NOTICIAS_CATEGORIA = "Noticias"; // RSS cine/TV/anime — vive en el área "Noticias", no en Vitrina
const MUSIC_CATEGORIA = "Dark scene / Música";

// Colores por categoría — reusa acentos que ya existen en Angst (melee/pokemon/gym/fadiman)
export const CAT_COLORS = {
  "Melee": "#ff6600",
  "Pokémon TCG": "#ffcc00",
  "Gaming": "#5c9cff",
  "Noticias": "#e91e8c",
  "Películas": "#e91e8c",
  "Series": "#e91e8c",
  "Animación": "#e91e8c",
  "Microdocumentales": "#26a69a",
  "Podcasts": "#ffcc00",
  "Dark scene / Música": "#7b4fd4",
  "Ciencia / Conocimiento": "#2e7d52",
  "Tecnología": "#26a69a",
  "Poliamor": "#aac756",
};

// ─── Discriminador "formato" → decide StoryCard/ExtendedView vs sus versiones
// de cine (CineStoryCard/CineExtendedView) o música (MusicStoryCard/
// MusicExtendedView). Deliberadamente distinto de "item.tipo" (que ya existe
// y controla video/podcast/texto DENTRO del mismo StoryCard) — son dos ejes
// distintos: "tipo" es la acción central de un item de lectura, "formato"
// decide qué layout completo de tarjeta se usa.
export const FORMATO_BY_CATEGORIA = {
  "Películas": "cine",
  "Series": "cine",
  "Animación": "cine",
  [MUSIC_CATEGORIA]: "musica",
};

// ─── Fetch de datos: dos JSON (feed de lectura + cine), fusionados por categoría ──
// Ambos Actions ya hicieron el trabajo pesado del lado del servidor. Acá solo
// se lee y se etiqueta con "formato" para que el render sepa qué layout de
// tarjeta usar (no confundir con "item.tipo", que sigue intacto para video/
// podcast/texto dentro del StoryCard normal). Si cine.json no existe todavía
// o falla, el feed de lectura sigue funcionando igual — no es fuente obligatoria.
export async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// Estado propio de Feed (cola/vistos/buzón/último refresh).
export const STORAGE_KEY = "angst-feed-proto-v1";
