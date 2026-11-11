// Game enhanced: lógica pura (filtro, orden, ventana, resumen) y estado persistente
// (guardar, ocultar, deshacer, rehidratar tras restaurar un export).
import assert from "node:assert/strict";

const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => { almacen.set(k, String(v)); },
  removeItem: (k) => { almacen.delete(k); },
};
const { itemsDe, ventana, filasQueCaben, resumen, haceDias, motivoDe, CATEGORIAS } = await import("../modules/gameenhanced/logica.js");
const { alternarGuardado, ocultar, deshacerOcultar, leerEstado, rehidratarEstado } = await import("../modules/gameenhanced/estado.js");
const { JUEGOS, SIMULADO } = await import("../modules/gameenhanced/datos.js");

const KEY = "angst-game-enhanced-estado-v1";

// ── datos ───────────────────────────────────────────────────────────────────
assert.equal(SIMULADO, true, "mientras los datos sean simulados el sello debe mostrarse");
assert.equal(new Set(JUEGOS.map(j => j.id)).size, JUEGOS.length, "ids únicos");
for (const j of JUEGOS) assert(["d", "w", "e", "s"].includes(j.tipo) && j.titulo && j.juego && j.detalle, `ítem completo: ${j.id}`);
assert(JUEGOS.filter(j => j.tipo === "d").every(j => typeof j.avance === "number"), "decomps con avance");
assert(JUEGOS.filter(j => j.tipo === "w").every(j => j.pideRom === "Sí" || j.pideRom === "No"), "webs con ¿pide ROM?");

// ── lógica ──────────────────────────────────────────────────────────────────
const todo = itemsDe(JUEGOS, "todo");
assert.equal(todo.length, JUEGOS.length, "Novedades mezcla todo");
assert(todo.every((j, i) => i === 0 || todo[i - 1].dias <= j.dias), "lo más nuevo primero");
assert.deepEqual(CATEGORIAS.map(c => c[0]), ["todo", "d", "w", "e", "s"]);
for (const t of ["d", "w", "e", "s"]) assert(itemsDe(JUEGOS, t).every(j => j.tipo === t) && itemsDe(JUEGOS, t).length > 0, `filtro ${t}`);
assert.equal(itemsDe(JUEGOS, "todo", { [todo[0].id]: 1 }).length, JUEGOS.length - 1, "los ocultos no aparecen");
assert.equal(motivoDe({ tipo: "e", juego: "Bastion" }), "Del estudio detrás de Bastion");
assert.equal(motivoDe({ tipo: "s", juego: "Heavy Rain" }), "Sucesor espiritual de Heavy Rain");
assert.deepEqual([haceDias(0), haceDias(1), haceDias(9)], ["hoy", "ayer", "hace 9 d"]);

assert.deepEqual(ventana(19, 0, 8), { ini: 0, fin: 8 }, "foco arriba");
assert.deepEqual(ventana(19, 5, 8), { ini: 5, fin: 13 });
assert.deepEqual(ventana(19, 18, 8), { ini: 11, fin: 19 }, "cerca del final la ventana retrocede: sin hueco muerto");
assert.deepEqual(ventana(3, 2, 8), { ini: 0, fin: 3 }, "menos ítems que filas");
assert.deepEqual(ventana(0, 0, 8), { ini: 0, fin: 0 }, "lista vacía");
assert.deepEqual(ventana(10, 4, 0), { ini: 4, fin: 5 }, "al menos una fila");
assert.equal(filasQueCaben(0), 1);
assert.equal(filasQueCaben(56), 1);
assert.equal(filasQueCaben(498), 8, "área libre de referencia (~457×810): 8 filas enteras");
assert.equal(filasQueCaben(116), 1, "dos filas necesitan 117 px: con 116 solo cabe una entera");
assert.equal(filasQueCaben(117), 2);

const r = resumen(JUEGOS, { [JUEGOS[0].id]: 1 }, { [JUEGOS[1].id]: 1, [JUEGOS[0].id]: 1 });
assert.equal(r.guardados, 1, "un guardado oculto no cuenta");
assert.equal(r.deEstudios, JUEGOS.filter(j => j.tipo === "e").length);

// ── estado ──────────────────────────────────────────────────────────────────
assert.deepEqual(leerEstado(), { guardados: {}, ocultos: {} }, "sin datos previos: vacío");
const a = JUEGOS[0].id, b = JUEGOS[1].id;
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
assert.equal(deshacerOcultar(a, null), undefined);
assert(!leerEstado().ocultos[a] && !leerEstado().guardados[a], "deshacer sin guardado previo no inventa uno");

// ── restaurar un export ─────────────────────────────────────────────────────
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
assert.deepEqual(leerEstado(), { guardados: {}, ocultos: {} });

console.log("OK gameenhanced: datos, lógica de lista y estado persistente");
