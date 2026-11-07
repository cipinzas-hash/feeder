// ♥ de Música: guardado, directorio derivado, persistencia y rehidratación.
import assert from "node:assert/strict";

const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => { almacen.set(k, String(v)); },
  removeItem: (k) => { almacen.delete(k); },
};
const { alternarMegusta, leerMegusta, directorio, rehidratarMegusta } = await import("../modules/musica/megusta.js");

const KEY = "angst-musica-megusta-v1";
const lz = (id, slug, artista, disco, fecha, extra = {}) => ({ id, artista, artistaSlug: slug, disco, tipo: "album", fecha, arte: "x", player: { tipo: "bandcamp", kind: "album", id: "1" }, fuentes: [{ fuente: "f", titulo: "t", link: "l", fecha }], ...extra });
const ficha = (nombre, tags) => ({ nombre, foto: "foto.jpg", mb: { tags } });

assert.deepEqual(directorio(leerMegusta()), [], "sin ♥ no hay directorio");

// ♥ → entra el artista, con copia del lanzamiento y géneros
alternarMegusta(lz("a|uno", "a", "A", "Uno", "2026-11-01"), ficha("A", ["ebm", "dark wave"]));
let d = directorio(leerMegusta());
assert.equal(d.length, 1);
assert.deepEqual(d[0].tags, ["ebm", "dark wave"]);
assert.equal(d[0].foto, "foto.jpg");
assert.equal(JSON.parse(almacen.get(KEY))["a|uno"].lz.disco, "Uno", "se persiste con la copia del lanzamiento");

// un artista sin ficha (sin géneros) también entra
alternarMegusta(lz("b|dos", "b", "B", "Dos", "2026-11-02"), undefined);
d = directorio(leerMegusta());
assert.equal(d.length, 2);
assert.deepEqual(d.find(x => x.slug === "b").tags, []);
assert.equal(d.find(x => x.slug === "b").nombre, "B", "sin ficha el nombre sale del lanzamiento");

// dos ♥ del mismo artista → una sola entrada, lanzamientos más recientes primero, géneros sin duplicar
alternarMegusta(lz("a|tres", "a", "A", "Tres", "2026-11-05"), ficha("A", ["ebm", "futurepop"]));
d = directorio(leerMegusta());
assert.equal(d.length, 2);
const a = d.find(x => x.slug === "a");
assert.deepEqual(a.lanzamientos.map(l => l.disco), ["Tres", "Uno"]);
assert.deepEqual(a.tags, ["ebm", "dark wave", "futurepop"]);

// quitar un ♥ no saca al artista mientras le quede otro; quitar el último sí
alternarMegusta(lz("a|uno", "a", "A", "Uno", "2026-11-01"), undefined);
assert.equal(directorio(leerMegusta()).find(x => x.slug === "a").lanzamientos.length, 1);
alternarMegusta(lz("a|tres", "a", "A", "Tres", "2026-11-05"), undefined);
assert.equal(directorio(leerMegusta()).some(x => x.slug === "a"), false, "sin ♥ el artista sale del directorio");

// rehidratar: lo que cambió por debajo (restore de un export) se lee de nuevo
almacen.set(KEY, JSON.stringify({ "z|z": { lz: lz("z|z", "z", "Z", "Zeta", "2026-10-30"), nombre: "Z", foto: null, tags: ["goth"], at: 5 } }));
rehidratarMegusta();
assert.deepEqual(directorio(leerMegusta()).map(x => x.slug), ["z"]);

// datos corruptos no rompen
almacen.set(KEY, "{no es json");
rehidratarMegusta();
assert.deepEqual(directorio(leerMegusta()), []);
almacen.set(KEY, JSON.stringify([1, 2]));
rehidratarMegusta();
assert.deepEqual(directorio(leerMegusta()), []);

console.log("musica-megusta.mjs OK");
