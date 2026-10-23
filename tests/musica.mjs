// tests/musica.mjs — pruebas del pipeline de música contra HTML REAL de Bandcamp
// (tests/fixtures/bandcamp/, capturado el 23-oct-2026) y casos de identidad.
// Sin red. Correr: node tests/musica.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import * as bc from "../modules/feed/scripts/lib/bandcamp.mjs";
import { extraerHeuristico, agruparLanzamientos, resolverBandcamp, armarSalida, playerDeNoticia, slug } from "../modules/feed/scripts/build-musica.mjs";

const F = new URL("./fixtures/bandcamp/", import.meta.url);
const rd = n => fs.readFileSync(new URL(n + ".html", F), "utf8");
let ok = 0;
const t = (nombre, fn) => Promise.resolve().then(fn).then(() => { ok++; console.log("  ✓", nombre); }, e => { console.error("  ✗", nombre, "\n   ", e.message); process.exitCode = 1; });

console.log("Parser de Bandcamp (HTML real)");
const mesh = bc.parsePaginaMusica(rd("artista-mesh"), bc.urlBase("mesh-uk"));
await t("artista: nombre, ubicación, bio y foto", () => {
  assert.equal(mesh.nombre, "Mesh"); assert.equal(mesh.ubicacion, "Bristol, UK");
  assert.ok(mesh.bio.length > 300 && !mesh.bio.includes("<"), "bio limpia"); assert.match(mesh.foto, /^https:\/\/f4\.bcbits\.com\/img\//);
});
await t("artista: discografía completa = HTML (16) + JSON (6), con título, carátula y URL", () => {
  assert.equal(mesh.items.length, 22); assert.equal(mesh.esSello, false);
  for (const i of mesh.items) { assert.ok(i.titulo, "título"); assert.match(i.arte, /bcbits\.com\/img\/a\d+_2\.jpg/); assert.match(i.url, /^https:\/\/mesh-uk\.bandcamp\.com\/(album|track)\//); }
  assert.equal(mesh.items[0].titulo, "Fallen Angel"); assert.equal(mesh.items[0].id, "3427997721");
});
await t("carátulas con carga diferida (data-original) también se extraen", () => assert.equal(mesh.items.filter(i => !i.arte).length, 0));
await t("sin duplicados entre HTML y JSON", () => assert.equal(new Set(mesh.items.map(i => `${i.tipo}-${i.id}`)).size, mesh.items.length));
const rep = bc.parsePaginaMusica(rd("artista-reptiletile"), bc.urlBase("reptiletile"));
await t("un disco en colaboración no convierte a una banda en sello", () => { assert.equal(rep.esSello, false); assert.ok(rep.items.some(i => /,/.test(i.artista || ""))); });
const metro = bc.parsePaginaMusica(rd("sello-metropolis"), bc.urlBase("metropolisrecords"));
await t("sello: se detecta y trae los 877 discos", () => { assert.equal(metro.esSello, true); assert.equal(metro.items.length, 877); });
await t("sello: filtra por artista y devuelve su página propia", () => {
  const r = bc.discosDeArtistaEnSello(metro, "Delerium");
  assert.ok(r.items.length >= 10); assert.deepEqual(r.hostsPropios, ["delerium-official"]);
  assert.ok(r.items.every(i => !i.url.includes("?")), "URL sin ?label=…");
});
await t("sello: artista cuyo catálogo vive en el propio sello (VNV Nation)", () => { const r = bc.discosDeArtistaEnSello(metro, "VNV Nation"); assert.ok(r.items.length >= 1); assert.ok(r.hostsPropios.includes("metropolisrecords")); });
const album = bc.parsePaginaAlbum(rd("album-mesh"));
await t("álbum: ID y tipo desde bc-page-properties", () => { assert.equal(album.id, "3427997721"); assert.equal(album.tipo, "album"); });
await t("embed: URL y hosts", () => {
  assert.match(bc.embedUrl("album", "3427997721"), /EmbeddedPlayer\/album=3427997721\//);
  assert.deepEqual(bc.idDesdeEmbed(bc.embedUrl("track", "55")), { tipo: "track", id: "55" });
  assert.deepEqual(bc.hostsEnTexto(rd("embed-mesh")), ["mesh-uk"]);
});

console.log("Resolver la página propia (con red simulada por fixtures)");
const PAGINAS = { "mesh-uk": "artista-mesh", "metropolisrecords": "sello-metropolis", "reptiletile": "artista-reptiletile", "ant-zen": "sello-antzen", "combichrist": "artista-combichrist" };
const traer = async host => PAGINAS[host] ? bc.parsePaginaMusica(rd(PAGINAS[host]), bc.urlBase(host)) : null;
await t("artista con página propia: se usa, no el sello", async () => {
  const r = await resolverBandcamp({ nombre: "Mesh", hostsCandidatos: ["mesh-uk"], hostMB: "mesh-uk", idsRelease: ["3427997721"], traerPagina: traer });
  assert.equal(r.tipo, "artista"); assert.equal(r.host, "mesh-uk"); assert.equal(r.items.length, 22);
});
await t("el embed apunta a un SELLO: se filtra por artista y no se muestran los 877 discos", async () => {
  const r = await resolverBandcamp({ nombre: "VNV Nation", hostsCandidatos: ["metropolisrecords"], hostMB: null, idsRelease: [], traerPagina: traer });
  assert.equal(r.tipo, "sello"); assert.ok(r.items.length < 20, `solo sus discos (${r.items.length})`);
});
const paginaFalsa = (nombre, ids) => ({ nombre, ubicacion: null, bio: null, foto: null, esSello: false, items: ids.map(id => ({ tipo: "album", id, titulo: "x", url: "u", arte: "a", artista: null, bandId: "1" })) });
await t("sello → sigue hasta la página propia del artista (Delerium)", async () => {
  const traerConPropia = async h => h === "delerium-official" ? paginaFalsa("Delerium", ["1446201211"]) : traer(h);
  const r = await resolverBandcamp({ nombre: "Delerium", hostsCandidatos: ["metropolisrecords"], hostMB: null, idsRelease: ["1446201211"], traerPagina: traerConPropia });
  assert.equal(r.tipo, "artista", "debe preferir la página propia"); assert.equal(r.host, "delerium-official");
});
await t("el sello declara el host del artista: se acepta aunque el nombre de la página difiera", async () => {
  const traerConPropia = async h => h === "delerium-official" ? paginaFalsa("DELERIUM (official)", []) : traer(h);
  const r = await resolverBandcamp({ nombre: "Delerium", hostsCandidatos: ["metropolisrecords"], hostMB: null, idsRelease: [], traerPagina: traerConPropia });
  assert.equal(r.tipo, "artista"); assert.equal(r.host, "delerium-official");
});
await t("página de otra banda con nombre parecido NO se acepta como propia", async () => {
  const r = await resolverBandcamp({ nombre: "Combichrist Tribute", hostsCandidatos: ["mesh-uk"], hostMB: null, idsRelease: [], traerPagina: traer });
  assert.equal(r, null);
});
await t("host sin página legible: devuelve null sin tirar", async () => assert.equal(await resolverBandcamp({ nombre: "X", hostsCandidatos: ["no-existe"], hostMB: null, idsRelease: [], traerPagina: traer }), null));

console.log("Extracción y agrupación");
await t("heurístico: formato 'Artista – Título (Formato – Sello)'", () => {
  const e = extraerHeuristico({ title: "Hocico – Sangre Hirviente (Digital Album – Out Of Line)" });
  assert.deepEqual([e.esLanzamiento, e.artista, e.disco, e.tipo], [true, "Hocico", "Sangre Hirviente", "album"]);
});
await t("heurístico: un festival no es lanzamiento", () => assert.equal(extraerHeuristico({ title: "Dark Force Fest 2027 Announces Full Lineup Including IAMX" }).esLanzamiento, false));
await t("slug estable con tildes y símbolos", () => { assert.equal(slug("Irîs"), "iris"); assert.equal(slug("Blood&Ink"), "blood-and-ink"); });
const items = [
  { guid: "a", title: "Mesh release video", source: "Side-Line", link: "l1", pubDate: "2026-10-20T00:00:00Z", image: "i1", bandcampEmbedUrl: bc.embedUrl("album", "3427997721") },
  { guid: "b", title: "Mesh – Fallen Angel (Single)", source: "Electrozombies", link: "l2", pubDate: "2026-10-22T00:00:00Z", image: "i2", tipo: "video", videoId: "yt1" },
  { guid: "c", title: "Festival lineup", source: "Post-Punk.com", link: "l3", pubDate: "2026-10-21T00:00:00Z" },
];
const ext = { a: { esLanzamiento: true, artista: "Mesh", disco: "Fallen Angel", tipo: "single" }, b: { esLanzamiento: true, artista: "Mesh", disco: "Fallen Angel", tipo: "single" }, c: { esLanzamiento: false } };
const grupos = agruparLanzamientos(items, ext);
await t("dos fuentes del mismo lanzamiento → una tarjeta con las dos fuentes", () => {
  assert.equal(grupos.length, 1); assert.equal(grupos[0].fuentes.length, 2); assert.equal(grupos[0].fecha, "2026-10-22T00:00:00Z");
});
await t("el reproductor de Bandcamp gana sobre YouTube", () => assert.deepEqual(grupos[0].player, { tipo: "bandcamp", kind: "album", id: "3427997721" }));
await t("playerDeNoticia: YouTube y sin reproductor", () => { assert.deepEqual(playerDeNoticia({ tipo: "video", videoId: "z" }), { tipo: "youtube", videoId: "z" }); assert.equal(playerDeNoticia({}), null); });

console.log("Salida");
const artistas = { mesh: { bandcamp: { discos: mesh.items.map(i => ({ tipo: i.tipo, id: i.id, titulo: i.titulo, url: i.url, arte: i.arte })) } } };
await t("la carátula del lanzamiento sale del disco de Bandcamp, no de la imagen de la noticia", () => {
  const l = armarSalida({ previo: {}, items, extracciones: ext, artistas, grupos });
  assert.equal(l.length, 1); assert.match(l[0].arte, /bcbits\.com/);
});
await t("sin reproductor en la noticia pero con el disco en Bandcamp: se usa el de Bandcamp", () => {
  const g = agruparLanzamientos([{ guid: "z", title: "Mesh – Fallen Angel", source: "S", link: "x", pubDate: "2026-10-22T00:00:00Z" }], { z: { esLanzamiento: true, artista: "Mesh", disco: "Fallen Angel", tipo: "single" } });
  const l = armarSalida({ previo: {}, items: [], extracciones: {}, artistas, grupos: g });
  assert.equal(l[0].player.id, "3427997721");
});
await t("sin forma de escucharlo no entra", () => {
  const g = agruparLanzamientos([{ guid: "z", title: "X", source: "S", link: "x" }], { z: { esLanzamiento: true, artista: "Nadie", disco: "Nada", tipo: "album" } });
  assert.equal(armarSalida({ previo: {}, items: [], extracciones: {}, artistas: {}, grupos: g }).length, 0);
});
await t("Deezer solo como respaldo cuando no hay Bandcamp", () => {
  const g = agruparLanzamientos([{ guid: "z", title: "X", source: "S", link: "x" }], { z: { esLanzamiento: true, artista: "Dir en grey", disco: "Phalaris", tipo: "album" } });
  const l = armarSalida({ previo: {}, items: [], extracciones: {}, artistas: { "dir-en-grey": { deezer: { trackId: 99 } } }, grupos: g });
  assert.deepEqual(l[0].player, { tipo: "deezer", trackId: 99 });
});
console.log(`\n${process.exitCode ? "FALLÓ" : "OK"}: ${ok} pruebas pasaron`);
