// sonda-musica-2.mjs
// ─────────────────────────────────────────────────────────────────────────────
// SONDA 2 del módulo de música (22-oct-2026). Continúa a sonda-musica.mjs con
// lo que la primera no pudo medir. Sin llaves nuevas. Mide:
//
//  1. PUERTA DE IDENTIDAD: ¿la ficha de MusicBrainz es realmente de esa banda?
//     verificado si (A) el disco de la noticia está en su discografía MB, o
//     (B) el Bandcamp que MB tiene registrado coincide con el que hospeda el
//     embed de la noticia. Debe rechazar a SMILE / T.A.N.K. / Irîs.
//  2. RIQUEZA DE LA PÁGINA DE BANDCAMP: bio, ubicación, foto de la banda, y si
//     la grilla de /music entrega los IDs y carátulas de TODOS los discos
//     (discografía con reproductor en 1 sola request por artista).
//  3. DEEZER (sin llave): foto del artista y preview de 30 s.
//  4. WIKIDATA: logo oficial (P154) e imagen (P18), vía el Q de MusicBrainz.
//  5. THEAUDIODB por nombre (el lookup por MBID dio 404 en la sonda 1).
//  6. GRUPO DE CONTROL vkei / goth metal conocidos, sin ninguna noticia: mide
//     qué tan bien funciona la cadena en escenas que los blogs actuales no
//     cubren.
//
// Entrada: data/sonda-musica.json (salida de la sonda 1). Salida:
// data/sonda-musica-2.json y docs/sonda-musica-2.md. Mismo contrato que la 1:
// nada tira excepción, volumen bajo, 1 req/s a MusicBrainz.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");
const IN_JSON = process.env.SONDA2_IN || path.join(DATA, "sonda-musica.json");
const OUT_JSON = process.env.SONDA2_OUT_JSON || path.join(DATA, "sonda-musica-2.json");
const OUT_MD = process.env.SONDA2_OUT_MD || path.join(__dirname, "..", "..", "..", "docs", "sonda-musica-2.md");
const MB_GAP_MS = parseInt(process.env.MB_GAP_MS || "1100", 10);
const UA = "angst-feed-sonda/1.0 ( https://github.com/cipinzas-hash/feeder )";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const luceneEsc = s => (s || "").replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
const stripHtml = s => (s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const decodeEntities = s => (s || "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Grupo de control: bandas conocidas de vkei y goth metal, sin noticia asociada.
const CONTROL = [
  ["Dir en grey", "vkei"], ["the GazettE", "vkei"], ["Versailles", "vkei"], ["Moi dix Mois", "vkei"],
  ["Alice Nine", "vkei"], ["Malice Mizer", "vkei"], ["DIAURA", "vkei"], ["Kamijo", "vkei"],
  ["Lacuna Coil", "goth metal"], ["Sirenia", "goth metal"], ["Tristania", "goth metal"], ["Draconian", "goth metal"],
  ["Theatre of Tragedy", "goth metal"], ["Leaves' Eyes", "goth metal"], ["Type O Negative", "goth metal"],
  ["Paradise Lost", "goth metal"], ["Gothminister", "goth metal"], ["Moonspell", "goth metal"],
];

async function http(url, { json = true, timeoutMs = 20000, retries = 1 } = {}) {
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
      return { ok: false, status: 0, error: e.message, data: null };
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

// ── Bloques reutilizables ────────────────────────────────────────────────────
async function mbDiscografiaCompleta(mbid) {
  const r = await mb(`release-group?artist=${mbid}&type=album|ep|single&limit=100`);
  return (r.data?.["release-groups"] || []).map(g => g.title);
}

const BC_HOST = /https?:\/\/([a-z0-9-]+)\.bandcamp\.com/gi;
function hostsBandcamp(html) {
  const s = new Set();
  for (const m of (html || "").matchAll(BC_HOST)) { const h = m[1].toLowerCase(); if (!["www", "daily", "bandcamp", "f4", "t4"].includes(h)) s.add(h); }
  return [...s];
}
const hostDeRel = rels => {
  const r = (rels || []).find(x => x.tipo === "bandcamp") || (rels || []).find(x => /bandcamp\.com/i.test(x.url));
  const m = r && r.url.match(/https?:\/\/([a-z0-9-]+)\.bandcamp\.com/i);
  return m ? m[1].toLowerCase() : null;
};

// Página de artista de Bandcamp: bio, ubicación, foto y grilla de discos.
function parsearArtistaBandcamp(html) {
  const out = { bioChars: 0, ubicacion: null, foto: false, itemsGrilla: 0, idsGrilla: 0, conCaratula: 0 };
  const bio = html.match(/<p[^>]*id="bio-text"[^>]*>([\s\S]*?)<\/p>/i);
  if (bio) out.bioChars = stripHtml(bio[1]).length;
  const loc = html.match(/<span[^>]*class="location[^"]*"[^>]*>([^<]+)<\/span>/i);
  if (loc) out.ubicacion = decodeEntities(loc[1]).trim();
  out.foto = /class="band-photo"/i.test(html) || /<img[^>]+class="[^"]*band-photo/i.test(html);
  // Grilla HTML: <li data-item-id="album-123" class="music-grid-item">
  const ids = new Set([...html.matchAll(/data-item-id="(album|track)-(\d+)"/gi)].map(m => `${m[1]}-${m[2]}`));
  // Grilla "client items" (los que no entran en el HTML inicial): JSON en un atributo.
  const ci = html.match(/data-client-items="([^"]+)"/i);
  let cover = 0;
  if (ci) {
    try {
      const arr = JSON.parse(decodeEntities(ci[1]));
      for (const it of arr) { if (it.id && it.type) ids.add(`${it.type === "t" || it.type === "track" ? "track" : "album"}-${it.id}`); if (it.art_id) cover++; }
    } catch { /* se sigue con lo que haya */ }
  }
  cover += new Set([...html.matchAll(/bcbits\.com\/img\/a(\d+)_\d+\.(?:jpg|png)/gi)].map(m => m[1])).size;
  out.idsGrilla = ids.size;
  out.itemsGrilla = Math.max(ids.size, (html.match(/music-grid-item/gi) || []).length);
  out.conCaratula = Math.min(cover, out.itemsGrilla || cover);
  return out;
}

async function bandcampArtista(host) {
  if (!host) return null;
  const base = `https://${host}.bandcamp.com`;
  let r = await http(`${base}/music`, { json: false });
  if (!r.ok) r = await http(`${base}/`, { json: false });
  return r.ok ? { host, ...parsearArtistaBandcamp(r.data) } : { host, error: `http-${r.status}` };
}

async function deezer(nombre) {
  const r = await http(`https://api.deezer.com/search/artist?q=${encodeURIComponent(nombre)}&limit=5`);
  const a = (r.data?.data || []).find(x => norm(x.name) === norm(nombre));
  if (!a) return { encontrado: false, estado: r.ok ? "sin-match" : `error-${r.status}` };
  const top = await http(`https://api.deezer.com/artist/${a.id}/top?limit=3`);
  const tr = top.data?.data || [];
  return { encontrado: true, foto: !!a.picture_xl, fans: a.nb_fan || 0, discos: a.nb_album || 0, preview: tr.some(t => t.preview), caratulaTop: tr.some(t => t.album?.cover_xl) };
}

async function wikidata(rels) {
  const q = (rels || []).find(r => r.tipo === "wikidata")?.url.match(/(Q\d+)/)?.[1];
  if (!q) return { enMB: false };
  const r = await http(`https://www.wikidata.org/wiki/Special:EntityData/${q}.json`);
  const c = r.data?.entities?.[q]?.claims || {};
  const sl = r.data?.entities?.[q]?.sitelinks || {};
  return { enMB: true, q, logo: !!c.P154?.length, imagen: !!c.P18?.length, wikipedia: sl.eswiki ? "es" : sl.enwiki ? "en" : null };
}

async function audiodbPorNombre(nombre) {
  for (const key of ["2", "123"]) {
    const r = await http(`https://www.theaudiodb.com/api/v1/json/${key}/search.php?s=${encodeURIComponent(nombre)}`);
    if (!r.ok) { if (key === "123") return { encontrado: false, estado: `error-${r.status}` }; continue; }
    const a = (r.data?.artists || []).find(x => norm(x.strArtist) === norm(nombre));
    if (!a) return { encontrado: false, estado: "sin-match", key };
    return { encontrado: true, key, logo: !!a.strArtistLogo, thumb: !!a.strArtistThumb, fanart: !!a.strArtistFanart, banner: !!a.strArtistBanner, bioEn: (a.strBiographyEN || "").length, bioEs: (a.strBiographyES || "").length };
  }
  return { encontrado: false, estado: "sin-respuesta" };
}

// ── Parte 1: artistas de la sonda 1, con puerta de identidad ─────────────────
async function procesarSonda1(a) {
  const rec = { artista: a.artista, disco: a.disco, matchMB: a.mb?.match || null };
  const rels = a.ficha?.rels || [];
  rec.mbid = a.mb?.mbid || null;

  // Puerta A: el disco de la noticia está en la discografía de MB.
  if (rec.mbid) {
    const titulos = (await mbDiscografiaCompleta(rec.mbid)).map(norm);
    const d = norm(a.disco);
    rec.puertaA = !!d && titulos.some(t => t && (t === d || t.includes(d) || d.includes(t)) && Math.min(t.length, d.length) >= 3);
  } else rec.puertaA = false;

  // Puerta B: el Bandcamp registrado en MB == el que hospeda el embed de la noticia.
  const hostMB = hostDeRel(rels);
  const id = a.bandcamp?.detalle;
  let hostsEmbed = [];
  if (id?.id) {
    const e = await http(`https://bandcamp.com/EmbeddedPlayer/${id.tipo === "track" ? "track" : "album"}=${id.id}/size=large/`, { json: false });
    if (e.ok) hostsEmbed = hostsBandcamp(e.data);
  }
  rec.puertaB = !!(hostMB && hostsEmbed.includes(hostMB));
  rec.hostMB = hostMB; rec.hostsEmbed = hostsEmbed;
  rec.veredicto = rec.puertaA || rec.puertaB ? "verificado" : rec.mbid ? "SIN-VERIFICAR" : "sin-MB";

  // Riqueza de Bandcamp: se usa el host del embed (el más confiable) o el de MB.
  const host = hostsEmbed[0] || hostMB || (a.bandcamp?.base || "").match(/https?:\/\/([a-z0-9-]+)\.bandcamp\.com/i)?.[1] || null;
  rec.bandcamp = await bandcampArtista(host);

  rec.deezer = await deezer(a.artista);
  rec.wikidata = await wikidata(rels);
  rec.audiodb = await audiodbPorNombre(a.artista);
  return rec;
}

// ── Parte 2: grupo de control ────────────────────────────────────────────────
async function procesarControl([nombre, escena]) {
  const rec = { artista: nombre, escena };
  const s = await mb(`artist/?query=${encodeURIComponent(`artist:"${luceneEsc(nombre)}"`)}&limit=5`);
  const exactos = (s.data?.artists || []).filter(x => x.score >= 95 && norm(x.name) === norm(nombre));
  if (!exactos.length) { rec.mb = s.ok ? "sin-resultado" : `error-${s.status}`; }
  else {
    rec.mb = exactos.length === 1 ? "exacto" : "ambiguo";
    rec.mbid = exactos[0].id;
    const f = await mb(`artist/${rec.mbid}?inc=url-rels+tags`);
    const rels = (f.data?.relations || []).filter(x => x.url?.resource).map(x => ({ tipo: x.type, url: x.url.resource }));
    rec.tags = (f.data?.tags || []).sort((a, b) => b.count - a.count).slice(0, 4).map(t => t.name);
    const disc = await mb(`release-group?artist=${rec.mbid}&type=album|ep|single&limit=100`);
    rec.discos = (disc.data?.["release-groups"] || []).length;
    rec.hostBandcampMB = hostDeRel(rels);
    rec.bandcamp = await bandcampArtista(rec.hostBandcampMB);
    rec.wikidata = await wikidata(rels);
    if (rec.wikidata.wikipedia) {
      const sl = (await http(`https://www.wikidata.org/wiki/Special:EntityData/${rec.wikidata.q}.json`)).data?.entities?.[rec.wikidata.q]?.sitelinks || {};
      const lang = sl.eswiki ? "es" : "en";
      const t = sl[`${lang}wiki`]?.title;
      if (t) { const w = await http(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`); rec.wikiChars = (w.data?.extract || "").length; }
    }
  }
  rec.deezer = await deezer(nombre);
  rec.audiodb = await audiodbPorNombre(nombre);
  return rec;
}

// ── Reporte ──────────────────────────────────────────────────────────────────
const pct = (n, d) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : "n/a");
const out = { meta: { inicio: new Date().toISOString() }, sonda1: [], control: [] };

function escribir(parcial = false) {
  out.meta.fin = new Date().toISOString(); out.meta.parcial = parcial;
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 1));
  const S = out.sonda1, C = out.control;
  const conMB = S.filter(r => r.mbid);
  const ver = S.filter(r => r.veredicto === "verificado");
  const sinVer = S.filter(r => r.veredicto === "SIN-VERIFICAR");
  const bc = S.filter(r => r.bandcamp && !r.bandcamp.error);
  const L = [];
  L.push(`# Sonda 2 del módulo de música — ${out.meta.inicio.slice(0, 10)}${parcial ? " (PARCIAL)" : ""}`, "");
  L.push("## 1. Puerta de identidad (artistas de la sonda 1)", "");
  L.push(`- Con ficha de MusicBrainz: ${conMB.length}/${S.length}`);
  L.push(`- Verificados (A: disco de la noticia en su discografía MB, o B: Bandcamp de MB = Bandcamp del embed): ${pct(ver.length, conMB.length)}`);
  L.push(`  - Solo por A: ${S.filter(r => r.puertaA && !r.puertaB).length} · solo por B: ${S.filter(r => r.puertaB && !r.puertaA).length} · ambas: ${S.filter(r => r.puertaA && r.puertaB).length}`);
  L.push(`- Con ficha MB pero SIN verificar (se ocultaría su ficha): ${sinVer.length}`, "");
  L.push("| Artista | Match MB | A (disco) | B (Bandcamp) | Veredicto |", "|---|---|---|---|---|");
  for (const r of S) L.push(`| ${r.artista} | ${r.matchMB || "—"} | ${r.puertaA ? "sí" : "no"} | ${r.puertaB ? "sí" : "no"} | ${r.veredicto} |`);
  L.push("", "## 2. Página de artista de Bandcamp", "");
  L.push(`Páginas leídas: ${bc.length}/${S.length}`);
  L.push(`- Con bio: ${pct(bc.filter(r => r.bandcamp.bioChars > 0).length, bc.length)}`);
  L.push(`- Con ubicación: ${pct(bc.filter(r => r.bandcamp.ubicacion).length, bc.length)}`);
  L.push(`- Con foto de banda: ${pct(bc.filter(r => r.bandcamp.foto).length, bc.length)}`);
  L.push(`- Con IDs de discos en la grilla (discografía reproducible en 1 request): ${pct(bc.filter(r => r.bandcamp.idsGrilla > 0).length, bc.length)}`);
  L.push(`- Con carátulas en la grilla: ${pct(bc.filter(r => r.bandcamp.conCaratula > 0).length, bc.length)}`, "");
  L.push("## 3. Imágenes, logos y previews (artistas de la sonda 1)", "");
  L.push(`- Deezer: foto ${pct(S.filter(r => r.deezer?.foto).length, S.length)} · preview 30 s ${pct(S.filter(r => r.deezer?.preview).length, S.length)}`);
  L.push(`- Wikidata: logo (P154) ${pct(S.filter(r => r.wikidata?.logo).length, S.length)} · imagen (P18) ${pct(S.filter(r => r.wikidata?.imagen).length, S.length)}`);
  const ad = S.filter(r => r.audiodb?.encontrado);
  L.push(`- TheAudioDB por nombre: encontrados ${pct(ad.length, S.length)} · con logo ${pct(ad.filter(r => r.audiodb.logo).length, S.length)} · con fanart ${pct(ad.filter(r => r.audiodb.fanart).length, S.length)} · con bio ${pct(ad.filter(r => r.audiodb.bioEn + r.audiodb.bioEs > 0).length, S.length)}`);
  L.push(`  - Estados: ${JSON.stringify(S.reduce((m, r) => { const k = r.audiodb?.encontrado ? `ok(key ${r.audiodb.key})` : r.audiodb?.estado; m[k] = (m[k] || 0) + 1; return m; }, {}))}`, "");
  L.push("## 4. Grupo de control: vkei y goth metal conocidos", "");
  L.push("| Banda | Escena | MB | Discos | Bandcamp (MB) | Grilla IDs | Wiki | Logo WD | Deezer foto/preview | AudioDB logo |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const r of C) L.push(`| ${r.artista} | ${r.escena} | ${r.mb} | ${r.discos ?? "—"} | ${r.hostBandcampMB ? (r.bandcamp?.error ? "error" : "sí") : "no"} | ${r.bandcamp?.idsGrilla ?? "—"} | ${r.wikiChars ? r.wikiChars + "c" : "no"} | ${r.wikidata?.logo ? "sí" : "no"} | ${r.deezer?.foto ? "sí" : "no"}/${r.deezer?.preview ? "sí" : "no"} | ${r.audiodb?.logo ? "sí" : "no"} |`);
  for (const esc of ["vkei", "goth metal"]) {
    const g = C.filter(r => r.escena === esc);
    L.push("", `**${esc}** (${g.length}): MB confiable ${pct(g.filter(r => r.mb === "exacto").length, g.length)} · Bandcamp vía MB ${pct(g.filter(r => r.hostBandcampMB).length, g.length)} · Wikipedia ${pct(g.filter(r => r.wikiChars).length, g.length)} · logo Wikidata ${pct(g.filter(r => r.wikidata?.logo).length, g.length)} · Deezer foto ${pct(g.filter(r => r.deezer?.foto).length, g.length)} · Deezer preview ${pct(g.filter(r => r.deezer?.preview).length, g.length)}`);
  }
  L.push("");
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, L.join("\n"));
}

async function main() {
  const s1 = JSON.parse(fs.readFileSync(IN_JSON, "utf8"));
  const artistas = s1.artistas || [];
  log(`Sonda 2: ${artistas.length} artistas de la sonda 1 + ${CONTROL.length} del grupo de control`);
  process.on("SIGTERM", () => { log("SIGTERM: guardando parcial"); escribir(true); process.exit(1); });

  for (const [i, a] of artistas.entries()) {
    log(`[S1 ${i + 1}/${artistas.length}] ${a.artista}`);
    try { const r = await procesarSonda1(a); out.sonda1.push(r); log(`  · ${r.veredicto} | A=${r.puertaA} B=${r.puertaB} | bc grilla=${r.bandcamp?.idsGrilla ?? "—"} bio=${r.bandcamp?.bioChars ?? "—"} | deezer=${r.deezer?.encontrado} | wd-logo=${r.wikidata?.logo}`); }
    catch (e) { log(`  ✗ ${e.message}`); out.sonda1.push({ artista: a.artista, error: e.message }); }
  }
  for (const [i, c] of CONTROL.entries()) {
    log(`[CTRL ${i + 1}/${CONTROL.length}] ${c[0]} (${c[1]})`);
    try { const r = await procesarControl(c); out.control.push(r); log(`  · MB=${r.mb} discos=${r.discos ?? "—"} bc=${r.hostBandcampMB || "no"} deezer=${r.deezer?.encontrado}`); }
    catch (e) { log(`  ✗ ${e.message}`); out.control.push({ artista: c[0], escena: c[1], mb: "error", error: e.message }); }
  }
  escribir(false);
  log(`Listo. Reporte: ${OUT_MD}`);
}

main().catch(e => { console.error("Sonda 2 abortada:", e); try { escribir(true); } catch {} process.exit(1); });
