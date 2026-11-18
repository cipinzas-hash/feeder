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
const R = await import("../modules/gameenhanced/registro.js");
const C = await import("../modules/gameenhanced/lib/claves.mjs");
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
assert.deepEqual(L.CATEGORIAS.map(c => c[0]), ["todo", "d", "e", "terminado", "quiero", "pendiente"]);
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
assert.deepEqual(fd.find(f => f[0] === "Última versión")[1], { href: "https://github.com/x/ec/releases/tag/v3", texto: "v3 (hace 5 d)" }, "la última versión enlaza a su release");
assert.deepEqual(fd.find(f => f[0] === "Todas las versiones")[1], { href: "https://github.com/x/ec/releases", texto: "Releases" });
assert.deepEqual(fe.find(f => f[0] === "Fuente")[1], { href: "https://igdb.example/2", texto: "IGDB" });
assert.equal(L.filasFicha({ ...J[0], url: "javascript:alert(1)" }, AHORA).find(f => f[0] === "Fuente"), undefined, "solo enlaces https (si no, la fila no aparece)");
assert(![...fd, ...fe].some(f => f[1] === "—" || f[1] === "Sin dato" || f[1] === undefined), "la ficha no muestra filas vacías");
const sinDatos = L.filasFicha({ ...J[0], jugableUrl: null, pideAssets: null, ia: false, release: null, plataforma: null, ultimoCommit: null }, AHORA).map(f => f[0]);
assert(!sinDatos.includes("Jugar en el navegador") && !sinDatos.includes("¿Pide tu ROM o archivos?") && !sinDatos.includes("Última versión") && !sinDatos.includes("Hecho con IA (según la fuente)") && !sinDatos.includes("Plataforma"), "sin dato → sin fila");

// ── disposición continua del XMB ────────────────────────────────────────────
const X = L.XMB;
assert.equal(L.anclaXmb(0), X.aire / 2, "al empezar, el enfocado queda arriba");
assert.equal(L.anclaXmb(-1), L.anclaXmb(0), "elasticidad por arriba: no se mueve el ancla");
assert(L.anclaXmb(1) > L.anclaXmb(0) && L.anclaXmb(2) > L.anclaXmb(1), "al avanzar deja ver filas anteriores…");
assert.equal(L.anclaXmb(9), L.anclaXmb(2), "…hasta X.arriba filas y ahí se queda");
const f0 = L.disposicion(0, 0);
assert.deepEqual([f0.t, f0.h, f0.op, f0.y], [1, X.foco, 1, X.aire / 2], "fila enfocada: grande, opaca, arriba");
const f1 = L.disposicion(1, 0);
assert.deepEqual([f1.t, f1.h, f1.y], [0, X.fila, X.aire / 2 + X.foco + X.aire], "la siguiente: chica, bajo el enfocado con aire");
assert.equal(f1.op, 0.85);
assert.equal(L.disposicion(9, 0).op, L.OPACIDAD[L.OPACIDAD.length - 1], "lejos: opacidad mínima");
let sinSolape = true, monotono = true;
for (let f = -0.35; f <= 12.35; f += 0.137) {
  for (let i = -2; i < 15; i++) {
    const a = L.disposicion(i, f), b = L.disposicion(i + 1, f);
    if (b.y < a.y + a.h - 1e-9) sinSolape = false;
    if (b.y <= a.y) monotono = false;
    assert(a.t >= 0 && a.t <= 1 && a.op >= 0.42 - 1e-9 && a.op <= 1 + 1e-9 && a.h >= X.fila - 1e-9 && a.h <= X.foco + 1e-9, "t, opacidad y alto dentro de rango");
  }
}
assert(sinSolape, "las filas nunca se pisan, en ninguna posición del arrastre");
assert(monotono, "el orden vertical se conserva en todo el arrastre");
const media = L.disposicion(1, 0.5);
assert(media.t === 0.5 && media.h === (X.fila + X.foco) / 2, "a medio camino: mitad de enfocada");
assert.equal(L.disposicion(3, 3).y, L.anclaXmb(3), "el enfocado siempre queda en el ancla");

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

// ── claves del registro ─────────────────────────────────────────────────────
assert.equal(C.idRegistro("Metroid Fusion"), "r-metroidfusion");
assert.equal(C.idRegistro("  metroid   FUSION! "), "r-metroidfusion", "mayúsculas, espacios y signos no importan");
assert.equal(C.idRegistro("Pokémon"), C.idRegistro("Pokemon"), "tildes no importan");
assert(C.idRegistro("ペルソナ5").startsWith("r-") && C.idRegistro("ペルソナ5") !== C.idRegistro("ニーア"), "títulos sin letras latinas tienen clave propia");
assert.equal(C.idRegistro("   "), null);

// ── registro (Angst es la fuente) ───────────────────────────────────────────
const KR = "angst-game-enhanced-registro-v1";
assert.deepEqual(R.leerRegistro(), { v: 1, sembrado: null, juegos: {} }, "sin datos previos: registro vacío");
R.sembrar([{ titulo: "Metroid Fusion", busqueda: "Metroid Fusion" }, { titulo: "Wolfenstein 3D", busqueda: "Wolfenstein 3D" }]);
assert.equal(Object.keys(R.leerRegistro().juegos).length, 2, "semilla: cada terminado entra al registro");
assert(Object.values(R.leerRegistro().juegos).every(j => j.estado === "terminado"), "la semilla son terminados");
assert(R.leerRegistro().sembrado, "queda marcada como sembrada");
assert(JSON.parse(almacen.get(KR)).juegos["r-metroidfusion"], "persiste en la clave declarada");
const sem1 = R.leerRegistro().sembrado;
R.quitarJuego("r-metroidfusion");
R.sembrar([{ titulo: "Metroid Fusion" }]);
assert.equal(R.leerRegistro().sembrado, sem1, "la semilla no se vuelve a cargar");
assert(!R.leerRegistro().juegos["r-metroidfusion"], "lo quitado no reaparece");

const res = R.agregarJuego({ titulo: "Hollow Knight", estado: "quiero", plataforma: "Switch" });
assert.equal(res.id, "r-hollowknight"); assert.equal(res.previo, null);
assert.equal(R.leerRegistro().juegos[res.id].estado, "quiero");
const res2 = R.agregarJuego({ titulo: "hollow knight!", estado: "pendiente" });
assert.equal(res2.previo.estado, "quiero", "mismo título: actualiza y devuelve lo previo para deshacer");
assert.equal(R.leerRegistro().juegos[res.id].estado, "pendiente");
assert.equal(R.leerRegistro().juegos[res.id].titulo, "Hollow Knight", "conserva el título original");
assert.equal(R.leerRegistro().juegos[res.id].plataforma, "Switch", "conserva lo ya anotado");
assert.equal(R.agregarJuego({ titulo: "  ", estado: "quiero" }), null, "título vacío: nada");
assert.equal(R.agregarJuego({ titulo: "X Y", estado: "otro" }), null, "estado inválido: nada");
R.editarJuego(res.id, { estado: "terminado", fecha: "2026-11-10", nota: "Muy bueno" });
const e1 = R.leerRegistro().juegos[res.id];
assert(e1.estado === "terminado" && e1.fecha === "2026-11-10" && e1.nota === "Muy bueno");
R.editarJuego(res.id, { nota: "", fecha: "no-es-fecha" });
assert(!("nota" in R.leerRegistro().juegos[res.id]) && !("fecha" in R.leerRegistro().juegos[res.id]), "vacío o inválido borra el campo");
const quitado = R.quitarJuego(res.id);
assert(!R.leerRegistro().juegos[res.id]);
R.restaurarJuego(quitado);
assert(R.leerRegistro().juegos[res.id], "restaurar devuelve el juego");

almacen.set(KR, JSON.stringify({ v: 1, sembrado: 5, juegos: { a: { titulo: "Zelda", estado: "quiero", agregado: 1 }, b: { titulo: "", estado: "quiero" }, c: { titulo: "Roto", estado: "xx" }, d: 7 } }));
R.rehidratarRegistro();
assert.deepEqual(Object.keys(R.leerRegistro().juegos), ["r-zelda"], "rehidrata y descarta entradas inválidas");
almacen.set(KR, "{no es json");
R.rehidratarRegistro();
assert.deepEqual(R.leerRegistro(), { v: 1, sembrado: null, juegos: {} }, "clave corrupta: registro vacío sin romper");
almacen.delete(KR);
R.rehidratarRegistro();

// ── lista del registro ──────────────────────────────────────────────────────
const REG = { v: 1, sembrado: 1, juegos: {
  "r-a": { id: "r-a", titulo: "Alfa", estado: "terminado", agregado: 1000, actualizado: 1000, fecha: "2026-10-01", plataforma: "PS5", nota: "Genial" },
  "r-b": { id: "r-b", titulo: "Beta", estado: "terminado", agregado: 1000, actualizado: 1000 },
  "r-c": { id: "r-c", titulo: "Gamma", estado: "terminado", agregado: 1000, actualizado: 1000, fecha: "2026-11-05" },
  "r-d": { id: "r-d", titulo: "Delta", estado: "quiero", agregado: AHORA - 3 * 86400000, actualizado: AHORA - 3 * 86400000 },
  "r-e": { id: "r-e", titulo: "Épsilon", estado: "pendiente", agregado: AHORA - 86400000, actualizado: AHORA - 86400000 },
} };
const ter = L.itemsDe([], "terminado", {}, REG, AHORA);
assert.deepEqual(ter.map(j => j.id), ["r-c", "r-a", "r-b"], "terminados: por fecha de término, los sin fecha al final");
assert(ter.every(j => j.tipo === "r"));
assert.deepEqual(L.itemsDe([], "quiero", {}, REG, AHORA).map(j => j.id), ["r-d"]);
assert.deepEqual(L.itemsDe([], "pendiente", {}, REG, AHORA).map(j => j.id), ["r-e"]);
assert.deepEqual(L.itemsDe([], "quiero", {}, null, AHORA), [], "sin registro: vacío");
assert.equal(L.itemsDe(J, "todo", {}, REG, AHORA).some(j => j.tipo === "r"), false, "Novedades no mezcla el registro");
assert.equal(L.cuando(ter[2]), "", "terminado sin fecha: sin texto de tiempo");
assert.match(L.cuando(ter[0]), /^hace [78] d$/, "terminado el 5-nov, medido el 12-nov (según la hora del día)");
assert.equal(L.cuando(L.itemsDe([], "quiero", {}, REG, AHORA)[0]), "hace 3 d");
assert.equal(L.motivoDe(ter[0]), "Terminado");
assert.match(L.detalleDe(ter[1], AHORA), /🏁 Terminado · PS5 · terminado el 1 oct 2026 · Genial/);
const fr = L.filasFicha(ter[1], AHORA, { generos: ["RPG"], lanzamiento: "2020-05-01", plataformas: ["PS5"], url: "https://igdb.example/x" });
assert(fr.some(f => f[0] === "Géneros" && f[1] === "RPG") && fr.some(f => f[0] === "Lanzamiento" && f[1] === "1 may 2020") && fr.some(f => f[0] === "Terminado el"));
const rs = L.resumen(J, {}, {}, REG);
assert.deepEqual([rs.terminados, rs.quiero, rs.pendientes], [3, 1, 1], "conteos del registro");
assert.deepEqual([L.esCategoriaRegistro("terminado"), L.esCategoriaRegistro("d"), L.esCategoriaRegistro("todo")], [true, false, false]);

// ── portadas ────────────────────────────────────────────────────────────────
assert.equal(L.portadaUrl("co1abc"), "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg");
assert.equal(L.portadaUrl("co1abc", "t_cover_small"), "https://images.igdb.com/igdb/image/upload/t_cover_small/co1abc.jpg");
assert.equal(L.portadaUrl("../x"), null, "solo ids de letras y números");
assert.equal(L.portadaUrl(null), null);
const FICHAS = { "r-wolfenstein3d": { portada: "co9" }, "r-a": { portada: "coA" } };
assert.equal(L.portadaDe(ter[1], FICHAS), "coA", "juego del registro: su ficha");
assert.equal(L.portadaDe({ tipo: "e", portada: "coE" }, FICHAS), "coE", "estudio: la suya");
assert.equal(L.portadaDe({ tipo: "d", tuJuego: "Wolfenstein 3D" }, FICHAS), "co9", "decomp: la del juego tuyo que lo motiva");
assert.equal(L.portadaDe({ tipo: "d", tuJuego: "Nada" }, FICHAS), null);

// ── releases y compartir ────────────────────────────────────────────────────
assert.deepEqual(L.enlacesRelease({ url: "https://github.com/x/ec", release: "v3" }), { version: "https://github.com/x/ec/releases/tag/v3", todas: "https://github.com/x/ec/releases" });
assert.equal(L.enlacesRelease({ url: "https://github.com/x/ec", release: null }), null, "sin versión publicada: sin enlaces");
assert.equal(L.enlacesRelease({ url: "https://gitlab.com/x/ec", release: "v3" }), null, "solo GitHub");
assert.equal(L.enlacesRelease({ url: "javascript:alert(1)", release: "v3" }), null);
assert.match(L.enlacesRelease({ url: "https://github.com/x/ec", release: "rel 1/2" }).version, /releases\/tag\/rel%201%2F2$/, "el tag se codifica");
const sinRel = L.filasFicha({ ...wolf, release: null, fechaRelease: null }, AHORA).map(f => f[0]);
assert(!sinRel.includes("Última versión") && !sinRel.includes("Todas las versiones"), "sin release: sin filas de versión");
const cd = L.textoCompartir(wolf, null, AHORA);
assert.equal(cd.titulo, wolf.titulo); assert.equal(cd.url, "https://github.com/x/ec");
assert(cd.texto.startsWith(wolf.titulo + "\n") && cd.texto.includes("Última versión v3: https://github.com/x/ec/releases/tag/v3"), "decomp: título, contexto y release");
const ce = L.textoCompartir({ tipo: "e", titulo: "Nuevo", estudio: "E", fecha: "2027-01-01", dias: -100, url: "https://igdb.example/5", tuyos: ["A"] }, null, AHORA);
assert.equal(ce.url, "https://igdb.example/5"); assert(ce.texto.startsWith("Nuevo\n"));
const cr = L.textoCompartir({ tipo: "r", titulo: "Alfa", estado: "terminado", plataforma: "PS5", nota: "mi nota privada" }, { url: "https://www.igdb.com/games/alfa" }, AHORA);
assert.equal(cr.texto, "Alfa\n🏁 Terminado · PS5", "juego del registro: sin la nota personal");
assert.equal(cr.url, "https://www.igdb.com/games/alfa");
assert.equal(L.textoCompartir({ tipo: "r", titulo: "Beta", estado: "quiero" }, null, AHORA).url, null, "sin ficha de IGDB: solo texto");
assert.equal(L.textoCompartir({ ...wolf, url: "javascript:alert(1)" }, null, AHORA).url, null, "solo enlaces https");

// ── pipeline: README, fichas, registro ──────────────────────────────────────
const md = "# Proyecto\n\n[![CI](https://x/badge.svg)](https://x) Una **decompilación** de [Zelda](https://z.example) <img src=\"a.png\">.\n\n<!-- oculto -->\n## Compilar\n\n- Instala `make`\n- Corre `make all`\n\n```sh\nmake all\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## Vacío\n## Licencia\n\nMIT";
const rm = P.readmeABloques(md);
assert.deepEqual(rm.bloques, [["h", "Proyecto"], ["p", "Una decompilación de Zelda ."], ["h", "Compilar"], ["li", "Instala make"], ["li", "Corre make all"], ["h", "Licencia"], ["p", "MIT"]], "README a texto plano: sin insignias, HTML, código, tablas ni títulos vacíos");
assert.equal(rm.recortado, false);
const largo = P.readmeABloques("# T\n\n" + Array.from({ length: 80 }, (_, i) => `Párrafo número ${i} con bastante texto para ocupar espacio en la ficha.`).join("\n\n"));
assert(largo.recortado && largo.bloques.reduce((n, [, x]) => n + x.length, 0) <= 3800, "README largo: recortado y acotado");
assert.deepEqual(P.readmeABloques("").bloques, []);
assert.equal(P.repoDeUrl("https://github.com/owner/repo"), "owner/repo");
assert.equal(P.repoDeUrl("https://github.com/owner/repo.git"), "owner/repo");
assert.equal(P.repoDeUrl("https://github.com/owner/repo/tree/main"), "owner/repo");
assert.equal(P.repoDeUrl("https://gitlab.com/owner/repo"), null);
assert.equal(P.repoDeUrl("javascript:alert(1)"), null);
const fi = P.fichaDeIgdb({ id: 7, name: "Zelda", summary: "x ".repeat(500), cover: { image_id: "co1x" }, genres: [{ name: "Aventura" }], platforms: [{ abbreviation: "Switch" }], first_release_date: 1488499200, url: "https://www.igdb.com/games/z" });
assert.equal(fi.portada, "co1x"); assert.equal(fi.lanzamiento, "2017-03-03"); assert(fi.resumen.length <= 701 && fi.resumen.endsWith("…"));
assert.deepEqual([fi.generos, fi.plataformas], [["Aventura"], ["Switch"]]);
assert.equal(P.fichaDeIgdb({ id: 1, name: "X", cover: { image_id: "../mal" }, url: "http://no-https" }).portada, null, "image_id inseguro se descarta");
assert.equal(P.fichaDeIgdb({ id: 1, name: "X", url: "http://no-https" }).url, null);
assert.equal(P.fichaDeIgdb(null), null);
const lista = P.listaDeRegistro({ gameEnhancedRegistro: { juegos: { a: { titulo: "A", estado: "terminado" }, b: { titulo: "B", estado: "quiero" }, c: { titulo: "", estado: "terminado" }, d: { titulo: "D", estado: "?" } } } });
assert.deepEqual(lista.map(e => e.titulo), ["A", "B"]);
assert.equal(P.listaDeRegistro({}), null, "estado sin registro: null (usa la semilla)");
assert.equal(P.listaDeRegistro({ gameEnhancedRegistro: null }), null);
assert.deepEqual(P.listaDeRegistro({ gameEnhancedRegistro: { juegos: {} } }), [], "registro vacío a propósito: lista vacía");
assert.deepEqual(P.terminadosDe(lista), [{ titulo: "A", busqueda: "A" }], "solo los terminados alimentan el cruce");
const ie = P.itemsDeEstudios([{ estudio: { nombre: "E", tuyos: ["A"] }, juegos: [{ id: 5, name: "Nuevo", game_type: 0, first_release_date: Date.UTC(2026, 10, 20) / 1000, summary: "Un juego.", cover: { image_id: "coN" }, genres: [{ name: "RPG" }], url: "https://igdb.example/5" }] }], AHORA);
assert(ie.length === 1 && ie[0].portada === "coN" && ie[0].resumen === "Un juego." && ie[0].generos[0] === "RPG", "estudios llevan portada, resumen y géneros");

console.log("OK gameenhanced: cruce con decomps e IGDB, lógica de lista, ficha limpia, XMB, registro y README");
