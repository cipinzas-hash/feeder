// Game enhanced: pipeline (cruce con decomps e IGDB), lógica de lista y estado persistente.
import assert from "node:assert/strict";

const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => { almacen.set(k, String(v)); },
  removeItem: (k) => { almacen.delete(k); },
};
const L = await import("../modules/gameenhanced/logica.js");
const P = await import("../modules/feed/scripts/lib/game-enhanced-lib.mjs");
const { alternarGuardado, ocultar, deshacerOcultar, leerEstado, rehidratarEstado } = await import("../modules/gameenhanced/estado.js");
const fs = await import("node:fs");
const TERMINADOS = JSON.parse(fs.readFileSync(new URL("../modules/gameenhanced/data/terminados.json", import.meta.url), "utf8")).juegos;
const KEY = "angst-game-enhanced-estado-v1";
const AHORA = Date.parse("2026-11-12T12:00:00Z");
const dias = n => new Date(AHORA - n * 86400000).toISOString();

// ── terminados ──────────────────────────────────────────────────────────────
assert.equal(TERMINADOS.length, 71, "los 71 terminados");
assert(TERMINADOS.every(t => t.titulo && t.busqueda && t.franquicia), "cada terminado con título, búsqueda y saga");
assert.equal(new Set(TERMINADOS.map(t => t.titulo)).size, 71, "títulos únicos");

// ── pipeline: cruce con decomps ─────────────────────────────────────────────
assert.equal(P.tituloLimpio("Wolfenstein 3D (ECWolf)"), "Wolfenstein 3D");
assert.equal(P.tituloLimpio("Marathon (Marathon (Android))"), "Marathon", "paréntesis anidado");
assert.equal(P.tituloLimpio("Metroid Fusion"), "Metroid Fusion");
const cs = (t, b) => P.casaConTerminado(t, b);
assert(cs("Wolfenstein 3D (ECWolf)", "Wolfenstein 3D"));
assert(cs("Metroid Fusion", "Metroid Fusion"));
assert(cs("The Last of Us Remastered (tlou-remaster)", "The Last of Us"), "edición Remastered cuenta");
assert(cs("Sonic Adventure (sa1-psp)", "Sonic Adventure"));
assert(cs("Kirby's Dream Land (kirbydreamland)", "Kirby's Dream Land"), "apóstrofe y mayúsculas no importan");
assert(!cs("Tekken Tag Tournament 2 (tekken-tag-to)", "Tekken Tag Tournament"), "secuela: no");
assert(!cs("Final Fantasy XI", "Final Fantasy"), "otro juego de la saga: no");
assert(!cs("Sonic Adventure 2: Battle (OpenSA2)", "Sonic Adventure"), "secuela: no");
assert(!cs("Crash Team Racing Nitro-Fueled (OCTR)", "Crash Team Racing"), "otro juego: no");
assert(!cs("The Journeyman Project Turbo!", "Journey"));
assert(!cs("", "Tekken") && !cs("Tekken", ""), "vacíos no casan");

const fuente = [
  { id: "a", title: "Metroid Fusion", game_key: "metroidfusion", type: "decompilation", platform: "GBA", stars: 83, last_commit: dias(2), url: "https://github.com/x/mf", needs_assets: null, ai_flag: false },
  { id: "b", title: "Wolfenstein 3D (ECWolf)", game_key: "x", type: "source-port", platform: "PC", stars: 1000, last_commit: dias(40), release: "v3", release_date: dias(5), url: "https://github.com/x/ec", play_url: "https://x.example/play", needs_assets: "byo" },
  { id: "c", title: "Tekken Tag Tournament 2 (x)", game_key: "tekkentagtournament2", type: "decompilation", last_commit: dias(1) },
  { id: "d", title: "Metroid Fusion (otra)", game_key: "x", type: "tool", last_commit: dias(1) },
  { id: "e", title: "Tekken 3 (Tekken3Recompiled)", game_key: "x", type: "static-recomp", last_commit: dias(900), archived: true, ai_flag: true },
  { id: "f", title: "Sin fechas", game_key: "x", type: "decompilation" },
];
const dd = P.proyectosDeDecomps(fuente, TERMINADOS, AHORA);
assert.deepEqual(dd.map(x => x.id), ["d-a", "d-b", "d-e"], "orden por actividad más reciente; sin secuelas ni herramientas");
const wolf = dd.find(x => x.id === "d-b");
assert.equal(wolf.dias, 5, "días = lo más reciente entre commit y release");
assert.equal(wolf.tuJuego, "Wolfenstein 3D");
assert.equal(wolf.jugableUrl, "https://x.example/play");
assert.equal(wolf.pideAssets, "byo");
assert(dd[2].inactivo && dd[2].ia, "archivado cuenta como inactivo; bandera de IA se conserva");
const doble = P.proyectosDeDecomps([{ id: "z", title: "Rhythm Heaven", game_key: "x", type: "decompilation", last_commit: dias(1) }], TERMINADOS, AHORA);
assert.deepEqual(doble[0].tuyos, ["Rhythm Heaven (DS)"], "un proyecto casa con los terminados que corresponden");

// ── pipeline: IGDB ──────────────────────────────────────────────────────────
for (const [g, esperado, que] of [
  [{ name: "Nuevo", game_type: 0 }, true, "principal"], [{ name: "Nuevo", game_type: 4 }, true, "expansión independiente"], [{ name: "Nuevo", game_type: 8 }, true, "remake"],
  [{ name: "Nuevo", category: 8 }, true, "category (campo viejo)"], [{ name: "Nuevo", game_type: { id: 0 } }, true, "game_type expandido"], [{ name: "Nuevo" }, true, "sin tipo: principal"],
  [{ name: "X", game_type: 1 }, false, "DLC"], [{ name: "X", game_type: 9 }, false, "remaster"], [{ name: "X", game_type: 11 }, false, "port"], [{ name: "X", game_type: 3 }, false, "bundle"],
  [{ name: "X", game_type: 0, version_parent: 5 }, false, "edición hija"], [{ name: "Arcade Archives: Rave Racer", game_type: 0 }, false, "Arcade Archives"],
  [{ name: "Namco Master Collection Vol. 1", game_type: 0 }, false, "colección"],
]) assert.equal(P.esJuegoNuevoValido(g), esperado, que);
assert.equal(P.fechaAproximada(Date.UTC(2027, 11, 31) / 1000), true, "31-dic = solo se conoce el año");
assert.equal(P.fechaAproximada(Date.UTC(2027, 2, 14) / 1000), false);

const mapa = P.mapaDeEstudios([
  { titulo: "A", desarrolladoras: [{ id: 9, nombre: "Estudio Nueve" }, { id: 3, nombre: "Tres" }] },
  { titulo: "B", desarrolladoras: [{ id: 9, nombre: "Estudio Nueve" }] }, { titulo: "C", desarrolladoras: [] },
]);
assert.deepEqual(mapa.map(m => [m.id, m.tuyos]), [[3, ["A"]], [9, ["A", "B"]]], "estudios únicos con sus juegos tuyos, por id");
const u = d => Date.UTC(2026, 10, 12 + d) / 1000;
const items = P.itemsDeEstudios([
  { estudio: mapa[1], juegos: [{ id: 1, name: "Reciente", first_release_date: u(-20), game_type: 0, url: "https://igdb.example/1", platforms: [{ abbreviation: "PC" }] }, { id: 2, name: "Próximo", first_release_date: u(30), game_type: 0 }, { id: 3, name: "DLC", first_release_date: u(-1), game_type: 1 }, { id: 4, name: "Sin fecha", game_type: 0 }] },
  { estudio: mapa[0], juegos: [{ id: 2, name: "Próximo", first_release_date: u(30), game_type: 0 }, { id: 5, name: "Año", first_release_date: Date.UTC(2027, 11, 31) / 1000, game_type: 0 }] },
], AHORA - 12 * 3600000 + 0);
assert.deepEqual(items.map(x => x.id), ["e-1", "e-2", "e-5"], "los más cercanos a hoy primero, pasados y futuros por igual");
const prox = items[1];
assert.deepEqual(prox.estudios, ["Estudio Nueve", "Tres"], "un juego co-desarrollado no se repite");
assert.deepEqual(prox.tuyos, ["A", "B"], "…y junta los terminados de ambos estudios");
assert(prox.dias < 0 && items[0].dias > 0 && items[2].fechaAprox === true);
assert.equal(items[0].plataformas[0], "PC");

// ── lógica de lista ─────────────────────────────────────────────────────────
const J = [
  { ...wolf },
  ...dd.filter(x => x.id !== "d-b").map(x => ({ ...x })),
  { id: "e-2", tipo: "e", titulo: "Próximo", estudio: "E", tuJuego: "A", tuyos: ["A"], dias: -30, fecha: "2026-12-12", plataformas: ["PC"], url: "https://igdb.example/2" },
  { id: "e-9", tipo: "e", titulo: "Viejo", estudio: "E", tuJuego: "A", tuyos: ["A"], dias: 300, fecha: "2026-01-15" },
  { id: "e-8", tipo: "e", titulo: "Lejano", estudio: "E", tuJuego: "A", tuyos: ["A"], dias: -500, fecha: "2028-03-30" },
];
const todo = L.itemsDe(J, "todo");
assert.deepEqual(todo.map(j => j.id), ["d-b", "d-a", "e-2"].sort((a, b) => Math.abs(J.find(j => j.id === a).dias) - Math.abs(J.find(j => j.id === b).dias)), "Novedades: ventana y cercanía a hoy");
assert(!todo.some(j => j.id === "d-e" || j.id === "e-9" || j.id === "e-8"), "fuera de Novedades: inactivo, muy viejo, muy lejano");
assert.equal(L.itemsDe(J, "d").length, 3, "Decomps muestra todos, también el inactivo");
assert.equal(L.itemsDe(J, "e").length, 3, "Estudios muestra todos");
assert.equal(L.itemsDe(J, "todo", { "d-b": 1 }).some(j => j.id === "d-b"), false, "los ocultos no aparecen");
assert.deepEqual(L.CATEGORIAS.map(c => c[0]), ["todo", "d", "e"]);
assert.equal(L.motivoDe(J[0]), "Porque terminaste Wolfenstein 3D");
assert.equal(L.motivoDe(J.find(j => j.id === "e-2")), "Del estudio detrás de A");

assert.deepEqual([0, 1, 9, 59, 60, 300, 800].map(L.haceDias), ["hoy", "ayer", "hace 9 d", "hace 59 d", "hace 2 m", "hace 10 m", "hace 2 a"]);
assert.equal(L.cuando(J.find(j => j.id === "e-2")), "en 30 d");
assert.equal(L.cuando(J.find(j => j.id === "e-8")), "en 17 m");
assert.equal(L.cuando({ tipo: "e", dias: -400, fechaAprox: true, fecha: "2027-12-31" }), "en 2027");
assert.equal(L.cuando({ tipo: "d", dias: 9999 }), "—");
assert.equal(L.fechaLegible({ fecha: "2026-12-12" }), "12 dic 2026");
assert.equal(L.fechaLegible({ fecha: "2027-12-31", fechaAprox: true }), "2027 (fecha por confirmar)");
assert.match(L.detalleDe(J[0], AHORA), /Source port · PC · ⭐ 1\.000 · último commit hace 40 d/, "detalle de decomp");
assert.match(L.detalleDe(J.find(j => j.id === "e-2"), AHORA), /PC · sale 12 dic 2026/, "detalle de estudio");
const fd = L.filasFicha(J[0], AHORA), fe = L.filasFicha(J.find(j => j.id === "e-2"), AHORA);
assert.deepEqual(fd.find(f => f[0] === "Jugar en el navegador")[1], { href: "https://x.example/play", texto: "Abrir" });
assert.equal(fd.find(f => f[0] === "¿Pide tu ROM o archivos?")[1], "Sí, con tu propia copia");
assert.equal(fd.find(f => f[0] === "Última versión")[1], "v3 (hace 5 d)");
assert.deepEqual(fe.find(f => f[0] === "Fuente")[1], { href: "https://igdb.example/2", texto: "IGDB" });
assert.equal(L.filasFicha({ ...J[0], url: "javascript:alert(1)" }, AHORA).find(f => f[0] === "Fuente")[1], "—", "solo enlaces https");

assert.deepEqual(L.ventana(19, 0, 8), { ini: 0, fin: 8 }, "foco arriba");
assert.deepEqual(L.ventana(19, 18, 8), { ini: 11, fin: 19 }, "cerca del final la ventana retrocede: sin hueco muerto");
assert.deepEqual(L.ventana(3, 2, 8), { ini: 0, fin: 3 });
assert.deepEqual(L.ventana(0, 0, 8), { ini: 0, fin: 0 });
assert.deepEqual(L.ventana(10, 4, 0), { ini: 4, fin: 5 }, "al menos una fila");
assert.equal(L.filasQueCaben(0), 1);
assert.equal(L.filasQueCaben(498), 8, "área libre de referencia (~457×810): 8 filas enteras");
assert.equal(L.filasQueCaben(116), 1);
assert.equal(L.filasQueCaben(117), 2);

const r = L.resumen(J, { "d-b": 1 }, { "d-a": 1, "d-b": 1 });
assert.equal(r.guardados, 1, "un guardado oculto no cuenta");
assert.equal(r.deEstudios, 1, "de tus estudios: solo los de Novedades");
assert.equal(r.semana, 1, "esta semana (±7 días): d-a ya pasó; e-2 está a 30");
assert.deepEqual(L.edadDatos(new Date(AHORA - 3 * 3600000).toISOString(), AHORA), { texto: "hace 3 h", vieja: false });
assert.deepEqual(L.edadDatos(new Date(AHORA - 40 * 3600000).toISOString(), AHORA), { texto: "hace 40 h", vieja: true });
assert.deepEqual(L.edadDatos(new Date(AHORA - 5 * 86400000).toISOString(), AHORA), { texto: "hace 5 d", vieja: true });
assert.deepEqual(L.edadDatos(null, AHORA), { texto: "sin fecha", vieja: true });

// ── estado ──────────────────────────────────────────────────────────────────
assert.deepEqual(leerEstado(), { guardados: {}, ocultos: {} }, "sin datos previos: vacío");
const a = "d-a", b = "d-b";
alternarGuardado(a);
assert(leerEstado().guardados[a], "guarda");
assert(JSON.parse(almacen.get(KEY)).guardados[a], "persiste en la clave declarada");
alternarGuardado(a);
assert.equal(leerEstado().guardados[a], undefined, "quita el guardado");
alternarGuardado(b);
const previo = ocultar(b);
assert(previo, "ocultar devuelve el guardado previo");
assert(leerEstado().ocultos[b] && !leerEstado().guardados[b], "oculto y sin guardado");
deshacerOcultar(b, previo);
assert(!leerEstado().ocultos[b] && leerEstado().guardados[b] === previo, "deshacer devuelve el guardado previo");
ocultar(a);
assert(leerEstado().ocultos[a]);
deshacerOcultar(a, null);
assert(!leerEstado().ocultos[a] && !leerEstado().guardados[a], "deshacer sin guardado previo no inventa uno");

almacen.set(KEY, JSON.stringify({ guardados: { z: 5 }, ocultos: { y: 6 } }));
rehidratarEstado();
assert.deepEqual(leerEstado(), { guardados: { z: 5 }, ocultos: { y: 6 } }, "rehidrata desde lo restaurado");
almacen.set(KEY, "{no es json");
rehidratarEstado();
assert.deepEqual(leerEstado(), { guardados: {}, ocultos: {} }, "clave corrupta: estado vacío sin romper");
almacen.set(KEY, JSON.stringify({ guardados: [1], ocultos: "x" }));
rehidratarEstado();
assert.deepEqual(leerEstado(), { guardados: {}, ocultos: {} }, "formas inválidas se descartan");
almacen.delete(KEY);
rehidratarEstado();

console.log("OK gameenhanced: cruce con decomps e IGDB, lógica de lista y estado persistente");
