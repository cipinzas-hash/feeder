#!/usr/bin/env node
// build-musica.mjs — módulo de descubrimiento musical (oct-2026).
//
// Entrada : data/musica-noticias.json (lo escribe build-feed.mjs: las noticias de
//           Side-Line, Post-Punk.com y Electrozombies, que ya no viajan en feed.json).
// Salida  : data/musica.json  →  { lanzamientos[], artistas{} } (lo lee la app).
//
// Cadena (todo medido en las sondas del 22-oct, docs/sonda-musica*.md):
//   1. Gemini extrae {es_lanzamiento, tipo, artista, disco} de cada titular
//      (respaldo heurístico sin key). Se cachea por guid.
//   2. Se agrupan noticias del mismo lanzamiento (varias fuentes → una tarjeta).
//   3. Por artista, BANDCAMP es el ancla de identidad y de contenido: su página
//      entrega discografía completa (títulos, carátulas, IDs de reproductor),
//      bio, ubicación y foto. Las páginas de SELLO se filtran por artista.
//   4. MusicBrainz / Wikipedia / Deezer / TheAudioDB solo suman si la identidad
//      está VERIFICADA (el disco de la noticia aparece en su discografía, o el
//      Bandcamp coincide). Un nombre parecido no basta (SMILE, T.A.N.K., Irîs).
//
// Contrato: ninguna llamada de red tira excepción; todo degrada a "sin ese dato".
// Volumen acotado por corrida (MUSICA_MAX_ARTISTAS) y por tiempo (MUSICA_MAX_MIN).

import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { callGemini, geminiStatus } from "./lib/gemini.mjs";
import * as bc from "./lib/bandcamp.mjs";

const DATA = new URL("../data/", import.meta.url);
const IN_PATH = fileURLToPath(new URL("musica-noticias.json", DATA));
const OUT_PATH = fileURLToPath(new URL("musica.json", DATA));

const num = (k, d) => { const v = parseInt(process.env[k] || "", 10); return Number.isFinite(v) && v > 0 ? v : d; };
const MAX_ARTISTAS = num("MUSICA_MAX_ARTISTAS", 14);        // artistas nuevos/refrescados por corrida
const MAX_EXTRACCIONES = num("MUSICA_MAX_EXTRACCIONES", 80);  // llamadas a Gemini por corrida
const MAX_MS = num("MUSICA_MAX_MIN", 11) * 60 * 1000;        // tope de tiempo para enriquecer
const RETENCION_DIAS = 45;
const ARTISTA_TTL_DIAS = 14;
const MB_GAP_MS = num("MB_GAP_MS", 1100);
const GEMINI_GAP_MS = num("GEMINI_GAP_MS", 4500);
const MAX_DISCOS = 60;
const UA = "angst-feed-bot/1.0 ( https://github.com/cipinzas-hash/feeder )";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const { normalizar, mismoArtista } = bc;
export const slug = s => normalizar(s).replace(/ /g, "-").slice(0, 60);

// ── HTTP sin excepciones ─────────────────────────────────────────────────────
async function http(url, { json = true, timeoutMs = 25000, retries = 1 } = {}) {
  for (let a = 0; a <= retries; a++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: json ? "application/json" : "text/html,*/*" }, signal: ctrl.signal, redirect: "follow" });
      if ((res.status === 503 || res.status === 429) && a < retries) { clearTimeout(t); await sleep(2500 * (a + 1)); continue; }
      if (!res.ok) { clearTimeout(t); return { ok: false, status: res.status, data: null }; }
      const data = json ? await res.json() : await res.text();
      clearTimeout(t);
      return { ok: true, status: res.status, data };
    } catch (e) {
      clearTimeout(t);
      if (a < retries) { await sleep(1500); continue; }
      return { ok: false, status: 0, data: null };
    }
  }
  return { ok: false, status: 0, data: null };
}

let lastMb = 0;
async function mb(p) {
  const wait = lastMb + MB_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const r = await http(`https://musicbrainz.org/ws/2/${p}${p.includes("?") ? "&" : "?"}fmt=json`, { retries: 2 });
  lastMb = Date.now();
  return r;
}

// ── 1. Titular → {esLanzamiento, tipo, artista, disco} ───────────────────────
const stripHtml = s => bc.limpiarTexto(s);
const stripQuotes = s => (s || "").replace(/^[\s'"‘’“”«»]+|[\s'"‘’“”«»]+$/g, "").trim();
const VERBOS = /\s(?:releases?|announces?|sets|shares?|previews?|unveils?|premieres?|marks?|signs?|returns?|presents?|confirms?|drops?|streams?)\s/i;

export function extraerHeuristico(item) {
  const title = item.title || "";
  let m = title.match(/^(.+?)\s+[–—-]\s+(.+?)(?:\s+\((.+?)\))?$/);
  if (m && !VERBOS.test(` ${m[1]} `)) {
    const fmt = (m[3] || "").toLowerCase();
    const tipo = /\bep\b/.test(fmt) ? "ep" : /album|lp/.test(fmt) ? "album" : /single/.test(fmt) ? "single" : "otro";
    return { esLanzamiento: true, tipo, artista: stripQuotes(m[1]), disco: stripQuotes(m[2]) };
  }
  const v = title.match(VERBOS);
  if (v) {
    const artista = stripQuotes(title.slice(0, v.index));
    const q = title.match(/[‘'“"]([^’'”"]{2,80})[’'”"]/);
    const t = title.toLowerCase();
    const esLanz = /releases?|new album|debut album|single|video|\bep\b/.test(t);
    const tipo = /\bep\b/.test(t) ? "ep" : /album/.test(t) ? "album" : /single|video/.test(t) ? "single" : "otro";
    if (artista && artista.split(/\s+/).length <= 6) return { esLanzamiento: esLanz, tipo, artista, disco: q ? q[1] : null };
  }
  return { esLanzamiento: false, tipo: "otro", artista: null, disco: null };
}

async function extraerConGemini(item) {
  const texto = stripHtml(item.fullText || item.summary || "").slice(0, 700);
  const prompt =
    `Título: ${item.title}\nFuente: ${item.source}\nTexto: ${texto}\n\n` +
    `Responde SOLO un objeto JSON, sin markdown, con estas claves:\n` +
    `{"es_lanzamiento": boolean, "tipo": "album|ep|single|video|reedicion|anuncio|entrevista|festival|otro", "artista": string|null, "disco": string|null}\n` +
    `Reglas: usa únicamente lo que dice el título y el texto; no inventes. "es_lanzamiento" es true si la noticia trata de un álbum, EP, single, video o reedición concreto de una banda o artista. ` +
    `"artista" es el artista o banda principal (uno solo), con su grafía exacta (conserva símbolos como &, puntos y tildes). "disco" es el título del disco o canción tal como aparece, sin comillas. Si no consta, null.`;
  const out = await callGemini(prompt, {
    systemInstruction: "Extraes datos estructurados de noticias de música. Respondes únicamente JSON válido.",
    temperature: 0, maxOutputTokens: 300, timeoutMs: 30000,
  });
  if (!out) return null;
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    return { esLanzamiento: !!j.es_lanzamiento, tipo: typeof j.tipo === "string" ? j.tipo : "otro", artista: j.artista ? stripQuotes(String(j.artista)) : null, disco: j.disco ? stripQuotes(String(j.disco)) : null };
  } catch { return null; }
}

// ── 2. Agrupar noticias en lanzamientos ──────────────────────────────────────
export function playerDeNoticia(item) {
  const b = bc.idDesdeEmbed(item.bandcampEmbedUrl);
  if (b) return { tipo: "bandcamp", kind: b.tipo, id: b.id };
  if (item.tipo === "video" && item.videoId) return { tipo: "youtube", videoId: item.videoId };
  if (item.soundcloudEmbedUrl) return { tipo: "soundcloud", url: item.soundcloudEmbedUrl };
  return null;
}
const PRIORIDAD_PLAYER = { bandcamp: 3, youtube: 2, soundcloud: 1 };

export function agruparLanzamientos(items, extracciones) {
  const grupos = new Map();
  for (const it of items) {
    const ex = extracciones[it.guid];
    if (!ex || !ex.esLanzamiento || !ex.artista) continue;
    const clave = `${slug(ex.artista)}|${normalizar(ex.disco || it.title)}`;
    let g = grupos.get(clave);
    if (!g) { g = { id: clave, artista: ex.artista, artistaSlug: slug(ex.artista), disco: ex.disco || null, tipo: ex.tipo, fecha: it.pubDate || null, imagen: it.image || null, fuentes: [], player: null, bcIds: [] }; grupos.set(clave, g); }
    g.fuentes.push({ fuente: it.source, titulo: it.title, link: it.link, fecha: it.pubDate || null });
    if (it.pubDate && (!g.fecha || it.pubDate > g.fecha)) g.fecha = it.pubDate;
    if (!g.disco && ex.disco) g.disco = ex.disco;
    const p = playerDeNoticia(it);
    if (p && (!g.player || PRIORIDAD_PLAYER[p.tipo] > PRIORIDAD_PLAYER[g.player.tipo])) g.player = p;
    const b = bc.idDesdeEmbed(it.bandcampEmbedUrl);
    if (b && !g.bcIds.includes(b.id)) g.bcIds.push(b.id);
    g.noticias = [...(g.noticias || []), it];
  }
  return [...grupos.values()].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

// ── 3. Bandcamp: encontrar la página PROPIA del artista ──────────────────────
// `traerPagina(host)` es inyectable para probar con HTML guardado (tests/musica.mjs).
export async function resolverBandcamp({ nombre, hostsCandidatos, hostMB, idsRelease, traerPagina }) {
  const cola = [...new Set([hostMB, ...hostsCandidatos].filter(Boolean))].slice(0, 4);
  const probados = new Set();
  const hostsDeSello = new Set(); // el sello declara que ese disco es del artista y vive en ese host
  let propia = null, sello = null;
  while (cola.length && probados.size < 6) {
    const host = cola.shift();
    if (probados.has(host)) continue;
    probados.add(host);
    const p = await traerPagina(host);
    if (!p) continue;
    const contieneRelease = (idsRelease || []).some(id => p.items.some(i => i.id === id));
    if (!p.esSello) {
      // Página de banda: es la del artista si el nombre coincide, si MusicBrainz la
      // señala, o si contiene el disco de la noticia (evidencia fuerte de identidad).
      if (mismoArtista(p.nombre, nombre) || host === hostMB || contieneRelease || hostsDeSello.has(host)) { propia = { host, pagina: p }; break; }
      continue;
    }
    // Página de sello: se filtran sus discos por artista y se sigue a la página propia.
    const r = bc.discosDeArtistaEnSello(p, nombre);
    if (r.items.length) {
      sello = sello || { host, pagina: p, items: r.items };
      for (const h of r.hostsPropios.filter(h => h !== host && !probados.has(h))) { hostsDeSello.add(h); cola.unshift(h); }
    }
  }
  if (propia) return { host: propia.host, tipo: "artista", pagina: propia.pagina, items: propia.pagina.items };
  if (sello) return { host: sello.host, tipo: "sello", pagina: sello.pagina, items: sello.items };
  return null;
}

async function traerPaginaBandcamp(host) {
  const base = bc.urlBase(host);
  let r = await http(`${base}/music`, { json: false });
  if (!r.ok) r = await http(`${base}/`, { json: false });
  return r.ok ? bc.parsePaginaMusica(r.data, base) : null;
}

// ── 4. Fuentes de apoyo (solo con identidad verificada) ──────────────────────
async function mbBuscar(nombre, disco) {
  const esc = s => (s || "").replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
  const r = await mb(`artist/?query=${encodeURIComponent(`artist:"${esc(nombre)}"`)}&limit=6`);
  const cands = (r.data?.artists || []).filter(a => a.score >= 90 && normalizar(a.name) === normalizar(nombre));
  if (!cands.length) return null;
  if (cands.length === 1 || !disco) return cands[0].id;
  const rg = await mb(`release-group/?query=${encodeURIComponent(`releasegroup:"${esc(disco)}" AND artist:"${esc(nombre)}"`)}&limit=3`);
  const ids = new Set(cands.map(a => a.id));
  const hit = (rg.data?.["release-groups"] || []).find(g => g.score >= 90 && (g["artist-credit"] || []).some(c => ids.has(c.artist?.id)));
  return hit ? hit["artist-credit"].find(c => ids.has(c.artist?.id)).artist.id : cands[0].id;
}

async function mbFicha(mbid) {
  const f = await mb(`artist/${mbid}?inc=url-rels+tags`);
  if (!f.ok) return null;
  const a = f.data;
  const rels = (a.relations || []).filter(x => x.url?.resource).map(x => ({ tipo: x.type, url: x.url.resource }));
  const d = await mb(`release-group?artist=${mbid}&type=album|ep|single&limit=100`);
  const titulos = (d.data?.["release-groups"] || []).map(g => g.title);
  return {
    pais: a.country || null, desde: a["life-span"]?.begin || null,
    tags: (a.tags || []).sort((x, y) => y.count - x.count).slice(0, 4).map(t => t.name),
    rels, titulos,
  };
}

async function wikipediaDe(rels) {
  const q = rels.find(r => r.tipo === "wikidata")?.url.match(/(Q\d+)/)?.[1];
  if (!q) return null;
  const e = await http(`https://www.wikidata.org/wiki/Special:EntityData/${q}.json`);
  const sl = e.data?.entities?.[q]?.sitelinks || {};
  const lang = sl.eswiki ? "es" : sl.enwiki ? "en" : null;
  if (!lang) return null;
  const titulo = sl[`${lang}wiki`].title;
  const s = await http(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, "_"))}`);
  const extracto = s.data?.extract || "";
  return extracto ? { lang, extracto: extracto.slice(0, 900), url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, "_"))}` } : null;
}

async function deezerVerificado(nombre, disco) {
  const r = await http(`https://api.deezer.com/search/artist?q=${encodeURIComponent(nombre)}&limit=5`);
  const a = (r.data?.data || []).find(x => normalizar(x.name) === normalizar(nombre));
  if (!a) return null;
  // Identidad: el disco de la noticia debe estar entre sus discos en Deezer.
  const al = await http(`https://api.deezer.com/artist/${a.id}/albums?limit=100`);
  const d = normalizar(disco);
  const hay = !!d && (al.data?.data || []).some(x => { const t = normalizar(x.title); return t && (t === d || t.includes(d) || d.includes(t)); });
  if (!hay) return null;
  const top = await http(`https://api.deezer.com/artist/${a.id}/top?limit=3`);
  const t = (top.data?.data || []).find(x => x.preview);
  return { artistId: a.id, foto: a.picture_xl || a.picture_big || null, trackId: t ? t.id : null, trackTitulo: t ? t.title : null };
}

async function audiodbLogo(nombre, mbid) {
  const r = await http(`https://www.theaudiodb.com/api/v1/json/123/search.php?s=${encodeURIComponent(nombre)}`);
  // Identidad: solo se acepta si TheAudioDB declara el mismo MBID que ya verificamos.
  const a = (r.data?.artists || []).find(x => normalizar(x.strArtist) === normalizar(nombre) && mbid && x.strMusicBrainzID === mbid);
  if (!a) return null;
  return { logo: a.strArtistLogo || null, fanart: a.strArtistFanart || null };
}

// ── Enriquecer un artista ────────────────────────────────────────────────────
async function enriquecerArtista(nombre, lanzamientos) {
  const rec = { nombre, slug: slug(nombre), actualizado: new Date().toISOString(), bandcamp: null, mb: null, wiki: null, deezer: null, logo: null, bio: null, foto: null };
  const idsRelease = [...new Set(lanzamientos.flatMap(l => l.bcIds))];
  const disco = lanzamientos.find(l => l.disco)?.disco || null;

  // Hosts de Bandcamp que la noticia ya conoce: el del reproductor embebido y los links del texto.
  const hostsCandidatos = [];
  for (const l of lanzamientos) {
    for (const n of l.noticias || []) {
      if (n.bandcampEmbedUrl) {
        const e = await http(n.bandcampEmbedUrl, { json: false, retries: 0 });
        if (e.ok) for (const h of bc.hostsEnTexto(e.data).slice(0, 2)) if (!hostsCandidatos.includes(h)) hostsCandidatos.push(h);
      }
      for (const h of bc.hostsEnTexto(`${n.link || ""} ${n.fullText || ""}`)) if (!hostsCandidatos.includes(h)) hostsCandidatos.push(h);
    }
  }

  // MusicBrainz (solo se USA si la identidad se verifica).
  const mbid = await mbBuscar(nombre, disco);
  const ficha = mbid ? await mbFicha(mbid) : null;
  const hostMB = ficha ? bc.hostDeUrl((ficha.rels.find(r => r.tipo === "bandcamp") || ficha.rels.find(r => /bandcamp\.com/i.test(r.url)))?.url) : null;

  // Bandcamp: ancla de identidad y de contenido.
  const resuelto = await resolverBandcamp({ nombre, hostsCandidatos, hostMB, idsRelease, traerPagina: traerPaginaBandcamp });
  if (resuelto) {
    const p = resuelto.pagina;
    rec.bandcamp = {
      host: resuelto.host, pagina: resuelto.tipo, url: bc.urlBase(resuelto.host),
      ubicacion: resuelto.tipo === "artista" ? p.ubicacion : null,
      bio: resuelto.tipo === "artista" && p.bio ? p.bio.slice(0, 1200) : null,
      foto: resuelto.tipo === "artista" ? p.foto : null,
      discos: resuelto.items.slice(0, MAX_DISCOS).map(i => ({ tipo: i.tipo, id: i.id, titulo: i.titulo || bc.tituloDeSlug(i.url), url: i.url, arte: i.arte })),
      totalDiscos: resuelto.items.length,
    };
  }

  // Puerta de identidad de MusicBrainz: (A) el disco de la noticia está en su discografía,
  // o (B) el Bandcamp registrado coincide con el que ya identificamos.
  let verificado = false;
  if (ficha) {
    const d = normalizar(disco);
    const A = !!d && ficha.titulos.some(t => { const x = normalizar(t); return x && Math.min(x.length, d.length) >= 3 && (x === d || x.includes(d) || d.includes(x)); });
    const conocidos = new Set([...hostsCandidatos, resuelto?.host].filter(Boolean));
    const B = !!hostMB && conocidos.has(hostMB);
    verificado = A || B;
    rec.mb = { id: mbid, verificado, ...(verificado ? { pais: ficha.pais, desde: ficha.desde, tags: ficha.tags, url: `https://musicbrainz.org/artist/${mbid}` } : {}) };
    if (verificado) {
      rec.wiki = await wikipediaDe(ficha.rels);
      const lg = await audiodbLogo(nombre, mbid);
      if (lg) { rec.logo = lg.logo; rec.fanart = lg.fanart; }
    }
  }

  // Deezer: foto y reproductor de respaldo (p. ej. vkei, que casi no usa Bandcamp).
  rec.deezer = await deezerVerificado(nombre, disco);

  rec.bio = rec.bandcamp?.bio || rec.wiki?.extracto || null;
  rec.foto = rec.bandcamp?.foto || rec.deezer?.foto || null;
  return rec;
}

// ── Orquestación ─────────────────────────────────────────────────────────────
function leerJson(p, defecto) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return defecto; } }

export function armarSalida({ previo, items, extracciones, artistas, grupos }) {
  const lanzamientos = [];
  for (const g of grupos) {
    const art = artistas[g.artistaSlug];
    const discos = art?.bandcamp?.discos || [];
    let player = g.player;
    let discoMatch = null;
    if (player?.tipo === "bandcamp") discoMatch = discos.find(d => d.id === player.id) || null;
    if (!discoMatch && g.disco) { const n = normalizar(g.disco); discoMatch = discos.find(d => normalizar(d.titulo) === n) || null; }
    // Sin reproductor en la noticia, pero el disco existe en Bandcamp → se usa ese.
    if ((!player || player.tipo !== "bandcamp") && discoMatch) player = { tipo: "bandcamp", kind: discoMatch.tipo, id: discoMatch.id };
    // Vkei y otros que casi no usan Bandcamp: reproductor de Deezer, solo si la identidad quedó verificada.
    if (!player && art?.deezer?.trackId) player = { tipo: "deezer", trackId: art.deezer.trackId };
    if (!player && !discos.length) continue; // sin forma de escucharlo, no entra (audio primero)
    lanzamientos.push({
      id: g.id, artista: g.artista, artistaSlug: g.artistaSlug, disco: g.disco, tipo: g.tipo, fecha: g.fecha,
      arte: discoMatch?.arte || g.imagen || null, player, fuentes: g.fuentes,
    });
  }
  return lanzamientos;
}

async function main() {
  const t0 = Date.now();
  const entrada = leerJson(IN_PATH, null);
  if (!entrada || !Array.isArray(entrada.items)) { console.error(`✗ falta ${IN_PATH} (lo escribe build-feed.mjs)`); process.exit(1); }
  const previo = leerJson(OUT_PATH, { extracciones: {}, artistas: {} });
  const corte = Date.now() - RETENCION_DIAS * 86400000;
  const items = entrada.items.filter(i => !i.pubDate || new Date(i.pubDate).getTime() >= corte);
  log(`Música: ${items.length} noticias (${entrada.items.length} en el archivo) · Gemini ${process.env.GEMINI_API_KEY ? "sí" : "NO (heurístico)"}`);

  // 1. Extracción (cache por guid; lo resuelto con heurístico se reintenta con Gemini)
  const extracciones = {};
  let usadasGemini = 0;
  const hayGemini = !!process.env.GEMINI_API_KEY;
  for (const it of items) {
    const c = previo.extracciones?.[it.guid];
    if (c && (c.metodo === "gemini" || !hayGemini)) { extracciones[it.guid] = c; continue; }
    let ex = null, metodo = null;
    if (hayGemini && usadasGemini < MAX_EXTRACCIONES) { ex = await extraerConGemini(it); usadasGemini++; await sleep(GEMINI_GAP_MS); if (ex) metodo = "gemini"; }
    if (!ex) { ex = c || extraerHeuristico(it); metodo = c?.metodo || "heuristico"; }
    extracciones[it.guid] = { ...ex, metodo };
  }
  const nGem = Object.values(extracciones).filter(e => e.metodo === "gemini").length;
  log(`✓ extracción: ${Object.keys(extracciones).length} noticias (${nGem} con Gemini, ${usadasGemini} llamadas esta corrida)${geminiStatus.lastError ? " · último error Gemini: " + geminiStatus.lastError : ""}`);

  // 2. Lanzamientos agrupados
  const grupos = agruparLanzamientos(items, extracciones);
  log(`✓ ${grupos.length} lanzamientos (de ${items.filter(i => extracciones[i.guid]?.esLanzamiento).length} noticias de lanzamiento)`);

  // 3. Artistas: reusar caché, enriquecer los nuevos / vencidos / con disco nuevo
  const artistas = {};
  const porArtista = new Map();
  for (const g of grupos) { if (!porArtista.has(g.artistaSlug)) porArtista.set(g.artistaSlug, []); porArtista.get(g.artistaSlug).push(g); }
  const pendientes = [];
  for (const [s, lz] of porArtista) {
    const c = previo.artistas?.[s];
    const venc = !c || (Date.now() - new Date(c.actualizado).getTime()) > ARTISTA_TTL_DIAS * 86400000;
    const idsCache = new Set((c?.bandcamp?.discos || []).map(d => d.id));
    const discoNuevo = !!c && lz.some(g => g.bcIds.some(id => !idsCache.has(id)));
    if (c && !venc && !discoNuevo) { artistas[s] = c; continue; }
    if (c) artistas[s] = c; // mientras tanto se conserva la ficha anterior
    pendientes.push({ s, nombre: lz[0].artista, lz, fecha: lz[0].fecha });
  }
  pendientes.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  log(`Artistas: ${porArtista.size} · en caché ${Object.keys(artistas).length} · por enriquecer ${pendientes.length} (tope ${MAX_ARTISTAS} por corrida)`);

  let hechos = 0;
  const guardar = () => escribir(previo, items, extracciones, artistas, grupos, false);
  process.on("SIGTERM", () => { log("SIGTERM: guardando lo avanzado"); escribir(previo, items, extracciones, artistas, grupos, true); process.exit(1); });
  for (const p of pendientes) {
    if (hechos >= MAX_ARTISTAS || Date.now() - t0 > MAX_MS) { log(`… quedan ${pendientes.length - hechos} artistas para la próxima corrida`); break; }
    log(`[${hechos + 1}] ${p.nombre}`);
    try {
      const rec = await enriquecerArtista(p.nombre, p.lz);
      artistas[p.s] = rec;
      log(`   bandcamp=${rec.bandcamp ? rec.bandcamp.pagina + ":" + rec.bandcamp.host + " (" + rec.bandcamp.totalDiscos + " discos)" : "no"} · mb=${rec.mb ? (rec.mb.verificado ? "verificado" : "SIN verificar") : "no"} · wiki=${rec.wiki ? rec.wiki.lang : "no"} · deezer=${rec.deezer ? "sí" : "no"} · logo=${rec.logo ? "sí" : "no"}`);
    } catch (e) { log(`   ✗ ${nombreSeguro(e)}`); }
    hechos++;
  }
  guardar();
  log(`✓ listo en ${Math.round((Date.now() - t0) / 1000)} s`);
}
const nombreSeguro = e => (e && e.message) || String(e);

function escribir(previo, items, extracciones, artistas, grupos, parcial) {
  const lanzamientos = armarSalida({ previo, items, extracciones, artistas, grupos }).slice(0, 90);
  const usados = new Set(lanzamientos.map(l => l.artistaSlug));
  const artistasOut = {};
  for (const [s, a] of Object.entries(artistas)) if (usados.has(s)) artistasOut[s] = a;
  // Caché de extracciones: solo lo que sigue dentro de la ventana.
  const guids = new Set(items.map(i => i.guid));
  const extOut = {};
  for (const [g, e] of Object.entries(extracciones)) if (guids.has(g)) extOut[g] = e;
  const out = { generatedAt: new Date().toISOString(), parcial, lanzamientos, artistas: artistasOut, extracciones: extOut };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  log(`✓ ${OUT_PATH.split("/").pop()}: ${lanzamientos.length} lanzamientos, ${Object.keys(artistasOut).length} artistas, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB${parcial ? " (PARCIAL)" : ""}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error("Error fatal en build-musica:", e); process.exit(1); });
}
