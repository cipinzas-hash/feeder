// lib/bandcamp.mjs — parser de páginas de Bandcamp para el módulo de música.
//
// Funciones PURAS (reciben HTML, devuelven datos): se prueban contra HTML real
// guardado en tests/fixtures/bandcamp/ (tests/musica.mjs), sin red.
//
// Marcado verificado el 23-oct-2026 contra muestras reales (artista, sello,
// álbum y reproductor embebido):
//  · Nombre y ubicación: <p id="band-name-location"> con <span class="title">
//    y <span class="location secondaryText">.
//  · Bio: <p id="bio-text"> (el tramo largo va en <span class="peekaboo-text">).
//  · Foto: <img src="…" class="band-photo">.
//  · Discografía: los primeros ~16 discos son <li class="music-grid-item"> en
//    el HTML; el resto viaja como JSON en el atributo data-client-items del
//    <ol id="music-grid"> ({id,type,title,page_url,art_id,band_id[,artist]}).
//    La unión de ambos es la discografía completa en UNA sola request.
//  · Páginas de SELLO: cada disco trae el nombre del artista (<span
//    class="artist-override"> o `artist` en el JSON) y el link a la página
//    PROPIA del artista (page_url absoluta, con ?label=…&tab=music).
//  · Álbum: <meta name="bc-page-properties" content='{"item_type":"a",
//    "item_id":N}'> y og:image. El reproductor se arma con ese ID.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodificarEntidades(s) {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

export function limpiarTexto(html) {
  return decodificarEntidades((html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\r\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const normalizar = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

// ── Hosts ────────────────────────────────────────────────────────────────────
const HOSTS_IGNORADOS = new Set(["www", "daily", "bandcamp", "f4", "t4", "s4", "isl"]);

export function hostDeUrl(url) {
  const m = (url || "").match(/^https?:\/\/([a-z0-9-]+)\.bandcamp\.com/i);
  const h = m && m[1].toLowerCase();
  return h && !HOSTS_IGNORADOS.has(h) ? h : null;
}

export function hostsEnTexto(texto) {
  const out = [];
  for (const m of (texto || "").matchAll(/https?:\/\/([a-z0-9-]+)\.bandcamp\.com/gi)) {
    const h = m[1].toLowerCase();
    if (!HOSTS_IGNORADOS.has(h) && !out.includes(h)) out.push(h);
  }
  return out;
}

export function urlBase(host) { return `https://${host}.bandcamp.com`; }

// ── Reproductor ──────────────────────────────────────────────────────────────
export function embedUrl(tipo, id) {
  const clave = tipo === "track" ? "track" : "album";
  return `https://bandcamp.com/EmbeddedPlayer/${clave}=${id}/size=large/bgcol=0a0a0a/linkcol=ffffff/tracklist=false/transparent=true/`;
}

export function idDesdeEmbed(url) {
  const a = (url || "").match(/album=(\d+)/), t = (url || "").match(/track=(\d+)/);
  return a ? { tipo: "album", id: a[1] } : t ? { tipo: "track", id: t[1] } : null;
}

// ── Página de álbum / track ──────────────────────────────────────────────────
export function parsePaginaAlbum(html) {
  const out = { tipo: null, id: null, imagen: null, titulo: null };
  const prop = html.match(/<meta\s+name="bc-page-properties"\s+content="([^"]+)"/i);
  if (prop) {
    try {
      const j = JSON.parse(decodificarEntidades(prop[1]));
      if (j.item_id) { out.id = String(j.item_id); out.tipo = j.item_type === "t" ? "track" : "album"; }
    } catch { /* se sigue con el respaldo */ }
  }
  if (!out.id) {
    const m = html.match(/EmbeddedPlayer\/(album|track)=(\d+)/);
    if (m) { out.tipo = m[1]; out.id = m[2]; }
  }
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (og) out.imagen = decodificarEntidades(og[1]);
  const t = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  if (t) out.titulo = decodificarEntidades(t[1]);
  return out;
}

// ── Página de música de un artista o sello ───────────────────────────────────
const ART = (id, tam = 2) => `https://f4.bcbits.com/img/a${id}_${tam}.jpg`;

function absolutizar(url, base) {
  if (!url) return null;
  const u = decodificarEntidades(url);
  const abs = /^https?:\/\//i.test(u) ? u : base + (u.startsWith("/") ? u : "/" + u);
  return abs.replace(/\?.*$/, ""); // sin ?label=…&tab=music
}

function itemsDeHtml(html, base) {
  const items = [];
  for (const m of html.matchAll(/<li\b[^>]*music-grid-item[\s\S]*?<\/li>/gi)) {
    const bloque = m[0];
    const id = bloque.match(/data-item-id="(album|track)-(\d+)"/i);
    if (!id) continue;
    const href = bloque.match(/<a\s+href="([^"]+)"/i)?.[1];
    // Los primeros discos traen la imagen en src; el resto, con carga diferida, en data-original.
    const img = bloque.match(/bcbits\.com\/img\/a(\d+)_\d+\.[a-z]+/i);
    const titulo = bloque.match(/<p\s+class="title">([\s\S]*?)(?:<br\s*\/?>|<\/p>)/i)?.[1];
    const artista = bloque.match(/<span\s+class="artist-override">([\s\S]*?)<\/span>/i)?.[1];
    items.push({
      tipo: id[1].toLowerCase(), id: id[2],
      titulo: limpiarTexto(titulo) || null,
      url: absolutizar(href, base),
      arte: img ? ART(img[1]) : null,
      artista: artista ? limpiarTexto(artista) : null,
      bandId: bloque.match(/data-band-id="(\d+)"/i)?.[1] || null,
    });
  }
  return items;
}

function itemsDeJson(html, base) {
  const m = html.match(/data-client-items="([^"]*)"/i);
  if (!m) return [];
  try {
    const arr = JSON.parse(decodificarEntidades(m[1]));
    return (Array.isArray(arr) ? arr : []).filter(x => x && x.id).map(x => ({
      tipo: x.type === "track" ? "track" : "album", id: String(x.id),
      titulo: x.title ? String(x.title) : null,
      url: absolutizar(x.page_url, base),
      arte: x.art_id ? ART(x.art_id) : null,
      artista: x.artist ? String(x.artist) : null,
      bandId: x.band_id ? String(x.band_id) : null,
    }));
  } catch { return []; }
}

export function parsePaginaMusica(html, base = "") {
  const nombre = limpiarTexto(html.match(/<p\s+id="band-name-location"[\s\S]*?<span\s+class="title">([\s\S]*?)<\/span>/i)?.[1]) || null;
  const ubicacion = limpiarTexto(html.match(/<span\s+class="location[^"]*">([\s\S]*?)<\/span>/i)?.[1]) || null;
  const bio = limpiarTexto(html.match(/<p\s+id="bio-text"[^>]*>([\s\S]*?)<\/p>/i)?.[1]) || null;
  let foto = null;
  for (const t of html.matchAll(/<img\b[^>]*>/gi)) {
    if (/class="[^"]*band-photo/i.test(t[0])) { foto = decodificarEntidades(t[0].match(/\bsrc="([^"]+)"/i)?.[1] || "") || null; break; }
  }
  const porClave = new Map();
  for (const it of [...itemsDeHtml(html, base), ...itemsDeJson(html, base)]) {
    const k = `${it.tipo}-${it.id}`;
    if (!porClave.has(k)) porClave.set(k, it);
    else { const prev = porClave.get(k); for (const f of Object.keys(it)) if (!prev[f] && it[f]) prev[f] = it[f]; }
  }
  const items = [...porClave.values()];
  // Sello: una parte relevante de los discos declara un artista que NO es el
  // dueño de la página. Un disco en colaboración ("Banda, Invitado") sigue
  // siendo de la banda, por eso se usa incluyeArtista y un umbral.
  const ajenos = items.filter(i => i.artista && !incluyeArtista(i.artista, nombre));
  const esSello = ajenos.length >= Math.max(3, Math.ceil(items.length * 0.25));
  return { nombre, ubicacion, bio, foto, items, esSello };
}

// ── ¿Este nombre es el artista buscado? ──────────────────────────────────────
export function mismoArtista(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const sx = x.split(" ").filter(w => w !== "the").join(" "), sy = y.split(" ").filter(w => w !== "the").join(" ");
  return sx === sy;
}

// ¿El campo "artista" de un disco (que puede ser "A, B", "A & B", "A feat. B"…) incluye a este artista?
export function incluyeArtista(campo, nombre) {
  if (mismoArtista(campo, nombre)) return true;
  return (campo || "").split(/\s*(?:,|&|\+|\/|\bfeat\.?|\bft\.?|\band\b|\bwith\b)\s*/i).some(p => mismoArtista(p, nombre));
}

// Discos de un artista dentro de una página de sello (con el host de su página propia).
export function discosDeArtistaEnSello(pagina, nombreArtista) {
  const propios = pagina.items.filter(i => i.artista && incluyeArtista(i.artista, nombreArtista));
  const hosts = [];
  for (const i of propios) { const h = hostDeUrl(i.url); if (h && !hosts.includes(h)) hosts.push(h); }
  return { items: propios, hostsPropios: hosts };
}

// Para un ítem sin título (no debería pasar): lo deduce del slug de la URL.
export function tituloDeSlug(url) {
  const s = (url || "").match(/\/(?:album|track)\/([^/?#]+)/)?.[1];
  return s ? decodeURIComponent(s).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;
}
