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
assert.deepEqual(L.CATEGORIAS.map(c => c[0]), ["todo", "d", "e", "p", "terminado", "jugando", "inconcluso", "quiero"]);
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
assert(!L.filasFicha({ ...J[0], inactivo: false }, AHORA).some(f => f[0] === "Estado" || f[0] === "Marca en la lista"), "activo: sin fila de estado engañosa");
assert.deepEqual(L.filasFicha({ ...J[0], inactivo: true }, AHORA).find(f => f[0] === "Marca en la lista"), ["Marca en la lista", "Inactivo o archivado"], "inactivo: la marca de la lista, con ese nombre");
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
assert.deepEqual(R.leerRegistro(), { v: 1, sembrado: null, juegos: {}, borrados: {} }, "sin datos previos: registro vacío");
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
assert.equal(R.leerRegistro().juegos[res.id].estado, "inconcluso", "el antiguo «pendiente» entra como «inconcluso»");
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
assert.deepEqual(R.leerRegistro(), { v: 1, sembrado: null, juegos: {}, borrados: {} }, "clave corrupta: registro vacío sin romper");
almacen.delete(KR);
R.rehidratarRegistro();

// ── lista del registro ──────────────────────────────────────────────────────
const REG = { v: 1, sembrado: 1, juegos: {
  "r-a": { id: "r-a", titulo: "Alfa", estado: "terminado", agregado: 1000, actualizado: 1000, fecha: "2026-10-01", plataforma: "PS5", nota: "Genial" },
  "r-b": { id: "r-b", titulo: "Beta", estado: "terminado", agregado: 1000, actualizado: 1000 },
  "r-c": { id: "r-c", titulo: "Gamma", estado: "terminado", agregado: 1000, actualizado: 1000, fecha: "2026-11-05" },
  "r-d": { id: "r-d", titulo: "Delta", estado: "quiero", agregado: AHORA - 3 * 86400000, actualizado: AHORA - 3 * 86400000 },
  "r-e": { id: "r-e", titulo: "Épsilon", estado: "inconcluso", agregado: AHORA - 86400000, actualizado: AHORA - 86400000 },
  "r-f": { id: "r-f", titulo: "Zeta", estado: "jugando", agregado: AHORA - 2 * 86400000, actualizado: AHORA - 2 * 86400000, empezado: "2026-11-09" },
} };
const ter = L.itemsDe([], "terminado", {}, REG, AHORA);
assert.deepEqual(ter.map(j => j.id), ["r-c", "r-a", "r-b"], "terminados: por fecha de término, los sin fecha al final");
assert(ter.every(j => j.tipo === "r"));
assert.deepEqual(L.itemsDe([], "quiero", {}, REG, AHORA).map(j => j.id), ["r-d"]);
assert.deepEqual(L.itemsDe([], "inconcluso", {}, REG, AHORA).map(j => j.id), ["r-e"]);
assert.deepEqual(L.itemsDe([], "jugando", {}, REG, AHORA).map(j => j.id), ["r-f"]);
assert.deepEqual(L.itemsDe([], "pendiente", {}, REG, AHORA), [], "«pendiente» ya no es una categoría");
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
assert.deepEqual([rs.terminados, rs.jugando, rs.inconclusos, rs.quiero], [3, 1, 1, 1], "conteos del registro");
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

// ── madurez, glosario ──────────────────────────────────────────────────────
const base = { tipo: "d", titulo: "T", subtipo: "static-recomp", inactivo: false, release: null, fechaRelease: null, jugableUrl: null, ultimoCommit: dias(72) };
const M = x => L.madurezDecomp({ ...base, ...x }, AHORA);
assert.equal(M({}).nivel, "construccion"); assert.equal(M({}).emoji, "🟡");
assert.match(M({}).razon, /Sin versión descargable todavía; último cambio hace 2 m/);
assert.equal(M({ release: "v1", fechaRelease: dias(5) }).nivel, "version"); assert.match(M({ release: "v1", fechaRelease: dias(5) }).razon, /Última versión v1 \(hace 5 d\)/);
assert.equal(M({ jugableUrl: "https://x.example/play" }).nivel, "jugable");
assert.equal(M({ ultimoCommit: dias(L.DETENIDO_DIAS + 1) }).nivel, "detenido"); assert.equal(M({ ultimoCommit: dias(L.DETENIDO_DIAS - 1) }).nivel, "construccion", "justo bajo el umbral: aún en construcción");
assert.equal(M({ inactivo: true }).nivel, "detenido"); assert.match(M({ inactivo: true }).razon, /inactivo o archivado/);
assert.equal(M({ inactivo: true, release: "v2" }).nivel, "version", "con versión publicada manda la versión…");
assert.match(M({ inactivo: true, release: "v2" }).razon, /inactivo o archivado/, "…pero avisa que el proyecto está inactivo");
assert.equal(M({ ultimoCommit: null }).nivel, "sin-datos");
assert.match(M({ release: "v1", fechaRelease: dias(5) }).etiqueta, /descargable/, "no promete que sea jugable");
for (const k of Object.keys(L.SUBTIPOS)) assert(L.GLOSARIO_SUBTIPO[k] && L.GLOSARIO_SUBTIPO[k].length > 40, "glosario para " + k);
assert.match(L.textoCompartir({ ...base, id: "d-x", plataforma: "PS3", estrellas: 17, url: "https://github.com/a/b" }, null, AHORA).texto, /🟡 En construcción/, "compartir incluye el estado");

// ── ports nativos de clásicos ───────────────────────────────────────────────
const fuentePort = (o) => ({ id: "x", title: "T", type: "source-port", platform: "N64", stars: 500, release: "v1", release_date: dias(5), last_commit: dias(2), url: "https://github.com/a/b", ...o });
const portsDe = (lista, term = [], opts) => P.portsNativos(lista, term, AHORA, opts);
assert.equal(portsDe([fuentePort({ id: "a" })]).length, 1, "port nativo, clásico, con versión reciente y estrellas: entra");
assert.equal(portsDe([fuentePort({ type: "decompilation" })]).length, 0, "una decompilación no es un port jugable");
assert.equal(portsDe([fuentePort({ type: "disassembly" })]).length, 0);
for (const t of ["static-recomp", "engine-remake", "browser-port"]) assert.equal(portsDe([fuentePort({ type: t })]).length, 1, t + " cuenta como port nativo");
assert.equal(portsDe([fuentePort({ platform: "PS5" })]).length, 0, "solo plataformas de origen clásicas");
assert.equal(portsDe([fuentePort({ platform: "PC" })]).length, 0);
assert.equal(portsDe([fuentePort({ inactive: true })]).length, 0); assert.equal(portsDe([fuentePort({ archived: true })]).length, 0);
assert.equal(portsDe([fuentePort({ release: null })]).length, 0, "sin versión publicada: no es una novedad");
assert.equal(portsDe([fuentePort({ stars: 99 })]).length, 0, "mínimo 100 estrellas"); assert.equal(portsDe([fuentePort({ stars: 100 })]).length, 1);
assert.equal(portsDe([fuentePort({ stars: null })]).length, 0);
assert.equal(portsDe([fuentePort({ release_date: dias(91) })]).length, 0, "versión de hace más de 90 días: fuera"); assert.equal(portsDe([fuentePort({ release_date: dias(90) })]).length, 1);
assert.equal(portsDe([fuentePort({ release_date: null })]).length, 0, "sin fecha de versión: fuera");
const pp = portsDe([fuentePort({ id: "z1", title: "Zelda (Ship)", release_date: dias(10), stars: 900 }), fuentePort({ id: "z2", title: "Mario", release_date: dias(3), stars: 150 }), fuentePort({ id: "z3", title: "Metroid", release_date: dias(3), stars: 800 })]);
assert.deepEqual(pp.map(x => x.id), ["p-z3", "p-z2", "p-z1"], "primero la versión más reciente; a igual fecha, más estrellas");
assert.deepEqual([pp[0].tipo, pp[0].subtipo, pp[0].plataforma, pp[0].release, pp[0].dias, pp[0].estrellas, pp[0].inactivo], ["p", "source-port", "N64", "v1", 3, 800, false]);
const tu = portsDe([fuentePort({ id: "m", title: "Metroid Fusion (Fusion Port)" })], [{ titulo: "Metroid Fusion", busqueda: "Metroid Fusion" }]);
assert.deepEqual([tu[0].tuyos, tu[0].tuJuego], [["Metroid Fusion"], "Metroid Fusion"], "si ya lo terminaste, se marca (pero no se oculta)");
assert.deepEqual(portsDe([fuentePort({ id: "q", title: "Algo distinto" })], [{ titulo: "Metroid Fusion", busqueda: "Metroid Fusion" }])[0].tuyos, []);
assert(!("tuJuego" in portsDe([fuentePort({})])[0]), "sin coincidencia: sin tuJuego");
assert.equal(C.tituloLimpio("Mario Kart 64 (SpaghettiKart)"), "Mario Kart 64"); assert.equal(C.tituloLimpio("Sin paréntesis"), "Sin paréntesis");
// lista de Ports en el cliente
const PI = [
  { id: "p-1", tipo: "p", titulo: "Zelda (Ship)", subtipo: "source-port", plataforma: "N64", estrellas: 900, release: "v1", fechaRelease: dias(3), url: "https://github.com/a/zelda", tuyos: [], dias: 3 },
  { id: "p-2", tipo: "p", titulo: "Mario (PC)", subtipo: "static-recomp", plataforma: "SNES", estrellas: 300, release: "v2", fechaRelease: dias(20), url: "https://github.com/a/mario", tuyos: ["Super Mario World"], tuJuego: "Super Mario World", dias: 20 },
  { id: "p-3", tipo: "p", titulo: "Viejo", subtipo: "source-port", plataforma: "NES", estrellas: 900, release: "v1", fechaRelease: dias(60), url: "https://github.com/a/viejo", tuyos: [], dias: 60 },
];
const lp = L.itemsDe([...J, ...PI], "p", {}, null, AHORA);
assert.deepEqual(lp.map(j => j.id), ["p-1", "p-2"], "Ports: solo los últimos 30 días, lo más reciente primero");
assert.equal(L.itemsDe([...J, ...PI], "p", { "p-1": true }, null, AHORA).length, 1, "No me interesa también oculta ports");
assert.equal(L.itemsDe([...J, ...PI], "todo", {}, null, AHORA).some(j => j.tipo === "p"), false, "Novedades no se llena de ports");
assert.equal(L.itemsDe([...J, ...PI], "d", {}, null, AHORA).some(j => j.tipo === "p"), false, "ni Decomps");
assert.equal(L.motivoDe(PI[0]), "Clásico de N64"); assert.equal(L.motivoDe(PI[1]), "Ya terminaste Super Mario World");
assert.match(L.detalleDe(PI[0], AHORA), /Source port · N64 · ⭐ 900 · versión v1 hace 3 d/, "un port muestra su versión, no el último commit");
assert.equal(L.cuando(PI[0]), "hace 3 d");
const fp = L.filasFicha(PI[0], AHORA).map(f => f[0]);
assert(fp.includes("Última versión") && fp.includes("Todas las versiones") && fp.includes("Fuente"), "ficha de port: versión, releases y repositorio");
assert.equal(L.madurezDecomp(PI[0], AHORA).nivel, "version", "un port con versión publicada: 🟢");
assert.match(L.textoCompartir(PI[0], null, AHORA).texto, /🟢 Con versión descargable/);
assert.equal(L.esProyecto(PI[0]), true); assert.equal(L.esProyecto({ tipo: "e" }), false);
assert.equal(L.portadaDe(PI[1], { "r-supermarioworld": { portada: "coM" } }), "coM", "un port de un juego tuyo muestra su portada"); assert.equal(L.portadaDe(PI[0], {}), null);

// ── versiones en otras plataformas (sugeridas) ─────────────────────────────────
const pn = P.plataformasDeNombre;
assert.deepEqual(pn("ACGC-Vita-Port"), ["PS Vita"]); assert.deepEqual(pn("zelda-vita-3ds"), ["3DS", "PS Vita"], "varias plataformas, en el orden de la lista");
assert.deepEqual(pn("zelda-alttp-3ds"), ["3DS"]); assert.deepEqual(pn("dusklight-nx"), ["Switch"]); assert.deepEqual(pn("Nintendo Switch port"), ["Switch"]);
assert.deepEqual(pn("Wii-U port"), ["Wii U"], "Wii U con guion no se confunde con Wii"); assert.deepEqual(pn("wiiu"), ["Wii U"]);
assert.deepEqual(pn("melee-Vita"), ["PS Vita"]); assert.deepEqual(pn("PS Vita build"), ["PS Vita"]);
assert.deepEqual(pn("zelda3-android"), ["Android"], "Android incluido");
assert.deepEqual(pn("Advanced sourceport of Crash Team Racing for PSVita, PC and Web Browser."), ["PS Vita"], "la puntuación pegada a la palabra no impide detectarla");
assert.deepEqual(pn("Ports: 3DS/Wii U; (Switch)!"), ["3DS", "Wii U", "Switch"], "separadores y signos varios");
assert.deepEqual(pn("xbox 360 port"), ["Xbox 360"]); assert.deepEqual(pn("tlou-remastered-ps4"), ["PS4"]);
assert.deepEqual(pn("switchboard"), [], "una palabra que solo contiene «switch» no cuenta"); assert.deepEqual(pn("android-studio-fix").includes("Android"), true);
assert.deepEqual(pn("an nx build", { conNx: false }), [], "nx en una descripción no cuenta"); assert.deepEqual(pn("dusklight-nx", { conNx: true }), ["Switch"]);
assert.deepEqual(pn("sm64-ios-port"), [], "iOS no está entre las plataformas pedidas"); assert.deepEqual(pn(""), []); assert.deepEqual(pn(null), []);
const frk = (o) => ({ name: "x", full_name: "u/x", html_url: "https://github.com/u/x", stargazers_count: 10, description: null, topics: [], pushed_at: "2026-10-01T00:00:00Z", ...o });
const sg = (o) => P.sugerenciasDePlataformas({ repo: "o/r", plataformaOriginal: "N64", ...o });
let r1 = sg({ forks: [frk({ name: "game-vita", full_name: "a/game-vita", html_url: "https://github.com/a/game-vita", stargazers_count: 228 })] });
assert.deepEqual([r1[0].tipo, r1[0].nombre, r1[0].plataformas, r1[0].estrellas, r1[0].pushed, r1[0].url], ["fork", "a/game-vita", ["PS Vita"], 228, "2026-10-01", "https://github.com/a/game-vita"]);
assert.equal(sg({ forks: [frk({ name: "game-vita", stargazers_count: 2 })] }).length, 0, "forks con menos de 3 estrellas: fuera");
assert.equal(sg({ forks: [frk({ name: "game-vita", stargazers_count: 3 })] }).length, 1);
assert.equal(sg({ forks: [frk({ name: "tlou-ps4" })], plataformaOriginal: "PS4" }).length, 0, "la plataforma original del juego no se sugiere");
assert.equal(sg({ forks: [frk({ name: "burnout-xbox" })], plataformaOriginal: "Xbox" }).length, 0); assert.equal(sg({ forks: [frk({ name: "burnout-xbox" })], plataformaOriginal: "og xbox" }).length, 0);
assert.deepEqual(sg({ forks: [frk({ name: "acgc-vita-port" })], plataformaOriginal: "GameCube" })[0].plataformas, ["PS Vita"], "se descarta solo la original");
assert.equal(sg({ forks: [frk({ name: "mod-fix", description: "Port to 3DS homebrew" })] })[0].plataformas[0], "3DS", "también por la descripción");
assert.equal(sg({ forks: [frk({ name: "algo", topics: ["wiiu", "homebrew"] })] })[0].plataformas[0], "Wii U", "y por los topics");
assert.equal(sg({ forks: [frk({ name: "algo", html_url: "javascript:alert(1)", full_name: "u/algo", description: "vita" })] }).length, 0, "solo URLs de GitHub");
const rr = sg({ ramas: [{ name: "vita" }, { name: "feat/gen4-end-of-turn-switch" }, { name: "fix-3ds-crash" }, { name: "port/3ds-v2.7" }, { name: "main" }] });
assert.deepEqual(rr.map(x => x.nombre), ["port/3ds-v2.7", "vita"], "ramas de plataforma sí; ramas de trabajo (feat/, fix) y main no");
assert.equal(rr[1].url, "https://github.com/o/r/tree/vita"); assert.equal(rr[0].url, "https://github.com/o/r/tree/port/3ds-v2.7");
assert.equal(rr[0].tipo, "rama");
const mix = sg({ ramas: [{ name: "switch-port" }], forks: [frk({ name: "a-switch", full_name: "a/a-switch", html_url: "https://github.com/a/a-switch", stargazers_count: 50 })] });
assert.deepEqual(mix.map(x => x.tipo), ["rama", "fork"], "las ramas del propio repo van antes que los forks");
const muchos = sg({ forks: Array.from({ length: 6 }, (_, i) => frk({ name: "g-vita-" + i, full_name: "a/g-vita-" + i, html_url: "https://github.com/a/g-vita-" + i, stargazers_count: 100 - i })) });
assert.equal(muchos.length, 3, "máximo 3 por plataforma"); assert.deepEqual(muchos.map(x => x.estrellas), [100, 99, 98], "los más estrellados");
const todas = sg({ forks: P ? ["3ds", "vita", "wiiu", "switch", "psp", "wii", "ps3", "ps4", "ps5", "xbox", "dreamcast", "saturn", "android"].flatMap((p, i) => [frk({ name: "g-" + p, full_name: "a/g-" + p, html_url: "https://github.com/a/g-" + p, stargazers_count: 50 - i })]) : [] });
assert.equal(todas.length, 10, "tope total de 10 sugerencias");
assert.deepEqual(sg({}), []); assert.deepEqual(sg({ ramas: null, forks: null }).length, 0);

// ── sugerencias en el cliente ───────────────────────────────────────────────
const PLAT = { "x/ec": { v: 1, sugerencias: [
  { tipo: "fork", nombre: "a/ec-vita", url: "https://github.com/a/ec-vita", plataformas: ["PS Vita"], estrellas: 40, pushed: "2026-10-01" },
  { tipo: "rama", nombre: "3ds", url: "https://github.com/x/ec/tree/3ds", plataformas: ["3DS"], estrellas: 0, pushed: null },
  { tipo: "fork", nombre: "a/ec-android", url: "https://github.com/a/ec-android", plataformas: ["Android"], estrellas: 9, pushed: null },
  { tipo: "fork", nombre: "mal", url: "javascript:alert(1)", plataformas: ["Switch"], estrellas: 99, pushed: null },
  { tipo: "fork", nombre: "sin-plat", url: "https://github.com/a/b", plataformas: [], estrellas: 5, pushed: null },
] } };
assert.deepEqual(L.sugerenciasDe(wolf, PLAT).map(x => x.nombre), ["a/ec-vita", "3ds", "a/ec-android"], "solo enlaces de GitHub y con plataforma");
assert.deepEqual(L.plataformasDe(L.sugerenciasDe(wolf, PLAT)), ["3DS", "PS Vita", "Android"], "plataformas distintas, en el orden fijo de la lista");
assert.deepEqual(L.sugerenciasDe({ ...wolf, url: "https://github.com/z/z" }, PLAT), [], "repo sin sugerencias");
assert.deepEqual(L.sugerenciasDe({ tipo: "e", titulo: "E", url: "https://github.com/x/ec" }, PLAT), [], "solo decomps y ports");
assert.deepEqual(L.sugerenciasDe(wolf, null), []); assert.deepEqual(L.sugerenciasDe(wolf, { "x/ec": {} }), []); assert.deepEqual(L.sugerenciasDe({ ...wolf, url: null }, PLAT), []);
assert.deepEqual(L.plataformasDe([]), []);

// ── pipeline: README, fichas, registro ──────────────────────────────────────
const md = "# Proyecto\n\n[![CI](https://x/badge.svg)](https://x) Una **decompilación** de [Zelda](https://z.example) <img src=\"a.png\">.\n\n<!-- oculto -->\n## Compilar\n\n- Instala `make`\n- Corre `make all`\n\n```sh\nmake all\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## Vacío\n## Licencia\n\nMIT";
const rm = P.readmeABloques(md);
assert.deepEqual(rm.bloques, [["h", "Proyecto"], ["p", "Una decompilación de Zelda ."], ["h", "Compilar"], ["li", "Instala make"], ["li", "Corre make all"], ["h", "Licencia"], ["p", "MIT"]], "README a texto plano: sin insignias, HTML, código, tablas ni títulos vacíos");
assert.equal(rm.recortado, false);
const largo = P.readmeABloques("# T\n\n" + Array.from({ length: 80 }, (_, i) => `Párrafo número ${i} con bastante texto para ocupar espacio en la ficha.`).join("\n\n"));
assert(largo.recortado && largo.bloques.reduce((n, [, x]) => n + x.length, 0) <= 3800, "README largo: recortado y acotado");
assert.deepEqual(P.readmeABloques("").bloques, []);
const cont = P.readmeABloques("## Hecho\n\n- Una ventana con los píxeles del juego, el comando de limpieza llega\n  al backend D3D12 y la pantalla cambia\n- Segundo ítem\ncontinuación pegada\n\nPárrafo aparte.\n\n- Otro\n\n  con párrafo sangrado");
assert.deepEqual(cont.bloques, [["h", "Hecho"], ["li", "Una ventana con los píxeles del juego, el comando de limpieza llega al backend D3D12 y la pantalla cambia"], ["li", "Segundo ítem continuación pegada"], ["p", "Párrafo aparte."], ["li", "Otro con párrafo sangrado"]], "las continuaciones de viñeta se quedan en su viñeta");
// estado según el autor
const eT = P.estadoDeReadme("# Proyecto\n\nIntro.\n\n## Status: Phase 8 — Boots to a Window, Geometry Not Yet Drawing\n\nThe game boots end-to-end but nothing is drawn yet.\n\n- detalle\n\n## Build\n\nmake");
assert.deepEqual(eT, { titulo: "Status: Phase 8 — Boots to a Window, Geometry Not Yet Drawing", texto: "The game boots end-to-end but nothing is drawn yet." });
assert.deepEqual(P.estadoDeReadme("## Estado\n\n- Menús: listo\n- Audio: pendiente"), { titulo: "Estado", texto: "Menús: listo" }, "sin párrafo: la primera viñeta");
assert.deepEqual(P.estadoDeReadme("## Progress\n\n## Otro\n\ntexto"), { titulo: "Progress", texto: "" }, "sección vacía: solo el título");
assert.equal(P.estadoDeReadme("## Build status\n\n[![CI](x)](y)\n\n## Uso\n\ntexto"), null, "badges de CI no son el estado del proyecto");
assert.equal(P.estadoDeReadme("# Proyecto\n\n```\n## Status\n```\n\ntexto"), null, "un título dentro de un bloque de código no cuenta");
assert.equal(P.estadoDeReadme("## Instalación\n\ntexto"), null);
assert.equal(P.estadoDeReadme(""), null);
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

// ── B (nov-2026): jugando / inconcluso, empezado y relaciones del pipeline ───────────────────────
assert.deepEqual(C.ESTADOS_REGISTRO, ["terminado", "jugando", "inconcluso", "quiero"]);
assert.equal(C.normalizarEstado("pendiente"), "inconcluso");
const rj = R.agregarJuego({ titulo: "Celeste", estado: "jugando", empezado: "2026-11-01" });
assert.equal(R.leerRegistro().juegos[rj.id].empezado, "2026-11-01");
R.editarJuego(rj.id, { estado: "inconcluso" });
assert.equal(R.leerRegistro().juegos[rj.id].empezado, "2026-11-01", "cambiar de estado conserva la fecha de inicio");
R.editarJuego(rj.id, { empezado: "" });
assert.equal(R.leerRegistro().juegos[rj.id].empezado, undefined, "texto vacío borra la fecha");
globalThis.localStorage.setItem("angst-game-enhanced-registro-v1", JSON.stringify({ v: 1, sembrado: 1, juegos: { "r-viejo": { id: "r-viejo", titulo: "Viejo", estado: "pendiente", agregado: 1, actualizado: 1 } } }));
R.rehidratarRegistro();
assert.equal(R.leerRegistro().juegos["r-viejo"].estado, "inconcluso", "migración al leer un registro guardado");
const lreg = P.listaDeRegistro({ gameEnhancedRegistro: { juegos: { a: { titulo: "A", estado: "pendiente" }, b: { titulo: "B", estado: "jugando" }, c: { titulo: "C", estado: "quiero" }, d: { titulo: "D", estado: "terminado" } } } });
assert.deepEqual(lreg.map(x => x.estado), ["inconcluso", "jugando", "quiero", "terminado"], "pipeline: pendiente → inconcluso");
assert.deepEqual(P.jugadosDe(lreg).map(x => x.titulo), ["A", "B", "D"], "estudios: solo lo jugado (terminado, jugando, inconcluso)");
assert.deepEqual(P.relacionadosDe(lreg).map(x => x.titulo), ["A", "B", "C", "D"], "decomps y ports: también lo que quieres jugar");
const fuenteB = [{ id: "m1", title: "Celeste Classic (celeste64)", type: "decompilation", platform: "PC", last_commit: dias(2) }, { id: "m2", title: "Mario Kart 64 (SpaghettiKart)", type: "source-port", platform: "N64", stars: 900, release: "v1", release_date: dias(3), last_commit: dias(1) }];
const rel = [{ titulo: "Celeste Classic", busqueda: "Celeste Classic", estado: "jugando" }, { titulo: "Mario Kart 64", busqueda: "Mario Kart 64", estado: "quiero" }];
const dB = P.proyectosDeDecomps(fuenteB, rel, AHORA).filter(x => x.id === "d-m1"), pB = P.portsNativos(fuenteB, rel, AHORA);
assert.equal(dB[0].relacion, "jugando"); assert.equal(dB[0].tuJuego, "Celeste Classic");
assert.equal(pB[0].relacion, "quiero"); assert.equal(pB[0].tuJuego, "Mario Kart 64");
assert.equal(L.motivoDe(dB[0]), "Porque estás jugando Celeste Classic");
assert.equal(L.motivoDe({ ...dB[0], relacion: "inconcluso" }), "Porque lo dejaste a medias: Celeste Classic");
assert.equal(L.motivoDe({ ...dB[0], relacion: "quiero" }), "Porque quieres jugar Celeste Classic");
assert.equal(L.motivoDe({ ...dB[0], relacion: undefined }), "Porque terminaste Celeste Classic", "sin relación: terminado (datos viejos)");
assert.equal(L.motivoDe(pB[0]), "Quieres jugar Mario Kart 64");
const mapaB = P.mapaDeEstudios([{ titulo: "Celeste", estado: "jugando", desarrolladoras: [{ id: 7, nombre: "Maddy" }] }]);
const ieB = P.itemsDeEstudios([{ estudio: mapaB[0], juegos: [{ id: 50, name: "Nuevo", game_type: 0, first_release_date: Date.UTC(2026, 10, 20) / 1000 }] }], AHORA);
assert.equal(ieB[0].relacion, "jugando"); assert.equal(ieB[0].tuJuego, "Celeste");
assert(L.filasFicha({ tipo: "r", id: "r-x", titulo: "X", estado: "jugando", empezado: "2026-11-01" }, AHORA).some(f => f[0] === "Empezado el"));
console.log("B ok");

// ── C (nov-2026): portadas de todos los proyectos ───────────────────────────────────────────────
assert.equal(L.portadaDe({ tipo: "d", id: "d-z", tuJuego: "Zelda" }, {}, { "d-z": { imagen: "coPROY" } }), "coPROY", "decomp sin juego tuyo con ficha: la portada buscada por el pipeline");
assert.equal(L.portadaDe({ tipo: "d", id: "d-z", tuJuego: "Zelda" }, { "r-zelda": { portada: "coFICHA" } }, { "d-z": { imagen: "coPROY" } }), "coFICHA", "la ficha del juego tuyo manda");
assert.equal(L.portadaDe({ tipo: "p", id: "p-q" }, {}, {}), null);
assert.equal(L.portadaDe({ tipo: "r", id: "r-x", portada: "coALTA" }, {}), "coALTA", "juego dado de alta con IGDB: portada al instante");
assert.deepEqual(L.imagenesDe({ tipo: "d", id: "d-z", imagenRepo: "https://repository-images.githubusercontent.com/1/abc" }, {}, { "d-z": { imagen: "coPROY" } }, "t_cover_small"),
  ["https://images.igdb.com/igdb/image/upload/t_cover_small/coPROY.jpg", "https://repository-images.githubusercontent.com/1/abc"], "IGDB primero, imagen del repo de respaldo");
assert.deepEqual(L.imagenesDe({ tipo: "d", id: "d-z", imagenRepo: "http://evil.example/x.png" }, {}, {}), [], "solo https de repository-images.githubusercontent.com");
assert.deepEqual(L.imagenesDe({ tipo: "e", id: "e-1" }), [], "sin imagen: lista vacía (emoji)");
assert.equal(P.imagenRepoOk("https://repository-images.githubusercontent.com/1106809206/8ca7b8b8-a77b-4a02-a76a-ddb959872328"), "https://repository-images.githubusercontent.com/1106809206/8ca7b8b8-a77b-4a02-a76a-ddb959872328");
assert.equal(P.imagenRepoOk("https://example.com/a.png"), null);
const proyOg = P.proyectosDeDecomps([{ id: "o1", title: "Celeste Classic (celeste64)", type: "decompilation", og_image: "https://repository-images.githubusercontent.com/9/zz", last_commit: dias(1) }], [{ titulo: "Celeste Classic", busqueda: "Celeste Classic", estado: "jugando" }], AHORA);
assert.equal(proyOg[0].imagenRepo, "https://repository-images.githubusercontent.com/9/zz");
const sel = P.elegirCoincidencia([{ name: "Zelda II", version_parent: null }, { name: "Zelda", version_parent: 5 }, { name: "Zelda" }], "zelda");
assert.equal(sel.version_parent, undefined, "prefiere el juego base a una versión");
assert.equal(P.elegirCoincidencia([{ name: "Otro" }], "zelda"), null);
const itemsP = [{ id: "d-1", titulo: "Zelda (oot)", tuJuego: "Zelda" }, { id: "d-2", titulo: "Rareza Oscura (x)" }, { id: "d-3", titulo: "Vieja (y)" }, { id: "p-4", titulo: "Nueva (z)" }];
const plan = P.planPortadas(itemsP, { "r-zelda": { portada: "coZ" } }, {
  "d-3": { v: 1, imagen: "coV", busqueda: "Vieja", buscado: new Date(AHORA - 3 * 86400000).toISOString() },
  "d-2": { v: 1, imagen: null, busqueda: "Rareza Oscura", buscado: new Date(AHORA - 9 * 86400000).toISOString() },
}, AHORA);
assert.equal(plan.resueltos["d-1"].imagen, "coZ", "resuelto por la ficha, sin consultar");
assert.equal(plan.resueltos["d-3"].imagen, "coV", "caché de 30 días para las encontradas");
assert.deepEqual(plan.pendientes.map(x => x.id).sort(), ["d-2", "p-4"], "sin resultado hace >7 días: se reintenta; las nuevas se consultan");
console.log("C ok");
