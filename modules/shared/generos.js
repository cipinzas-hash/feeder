// ─── Géneros de un artista (Música) ─────────────────────────────────────────
// Módulo PURO (sin DOM ni Node): lo usan el pipeline (build-musica.mjs) y la interfaz (MusicaPage, megusta.js).
// Fuentes, de más a menos confiable:
//   1. MusicBrainz (rec.mb.tags, solo con identidad verificada)
//   2. Bandcamp    (rec.bandcamp.tags: tags de la página del lanzamiento)
//   3. Gemini      (rec.generosIA: SOLO si las fuentes 1 y 2 no dieron nada; se muestran marcados como "inferido")

const MAX_GENEROS = 8;

export function normalizarGenero(t) {
  const g = String(t == null ? "" : t).toLowerCase().replace(/\s+/g, " ").trim();
  if (!g || g.length > 32) return null;
  if (g.startsWith("zzz")) return null;   // tags internos de Bandcamp ("zzz no details delivery api")
  return g;
}

export function normalizarGeneros(lista, max = MAX_GENEROS) {
  const out = [];
  for (const t of Array.isArray(lista) ? lista : []) {
    const g = normalizarGenero(t);
    if (g && !out.includes(g)) out.push(g);
    if (out.length >= max) break;
  }
  return out;
}

// → { tags: string[], inferido: boolean }. `inferido` solo es true cuando TODO viene de Gemini.
export function generosDeArtista(artista) {
  const firmes = normalizarGeneros([...((artista && artista.mb && artista.mb.tags) || []), ...((artista && artista.bandcamp && artista.bandcamp.tags) || [])]);
  if (firmes.length) return { tags: firmes, inferido: false };
  const ia = normalizarGeneros((artista && artista.generosIA) || [], 3);
  return { tags: ia, inferido: ia.length > 0 };
}

// Respuesta de Gemini → lista de géneros. Acepta {"generos":[...]} con o sin ruido alrededor; ante cualquier duda, [].
export function parseGenerosIA(texto) {
  const m = String(texto || "").match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const j = JSON.parse(m[0]);
    return normalizarGeneros(Array.isArray(j.generos) ? j.generos : [], 3);
  } catch { return []; }
}
