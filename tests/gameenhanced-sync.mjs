// Sincronización del registro de Game enhanced con Angst-data (fusión, tumbas, conflictos y orden de la semilla).
import assert from "node:assert/strict";

const almacen = new Map();
globalThis.localStorage = { getItem: k => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => { almacen.set(k, String(v)); }, removeItem: k => { almacen.delete(k); } };
const F = await import("../modules/gameenhanced/lib/fusion.mjs");
const R = await import("../modules/gameenhanced/registro.js");
const S = await import("../modules/gameenhanced/sync.js");

// ── fusión pura ─────────────────────────────────────────────────────────────
const e = (t, estado, act, extra = {}) => ({ id: "r-" + t, titulo: t, estado, agregado: 1, actualizado: act, ...extra });
const A = { sembrado: 5, juegos: { "r-a": e("a", "quiero", 100), "r-b": e("b", "terminado", 300) }, borrados: { "r-c": 250 } };
const B = { sembrado: null, juegos: { "r-a": e("a", "jugando", 200), "r-c": e("c", "quiero", 200), "r-d": e("d", "quiero", 10) }, borrados: { "r-b": 200 } };
const M = F.fusionarRegistros(A, B, 1000);
assert.equal(M.juegos["r-a"].estado, "jugando", "gana la entrada más reciente");
assert.equal(M.juegos["r-b"].estado, "terminado", "una entrada más nueva que la tumba sobrevive");
assert(!M.juegos["r-c"] && M.borrados["r-c"] === 250, "una tumba más nueva que la entrada gana: lo quitado no reaparece");
assert(M.juegos["r-d"] && M.sembrado === 5, "lo que solo está en un lado se conserva; sembrado = el que exista");
assert.equal(F.fusionarRegistros({ juegos: { x: e("x", "quiero", 50) }, borrados: { x: 50 } }, {}, 1000).juegos.x.id, "r-x", "empate: gana la entrada");
assert.deepEqual(F.fusionarRegistros({ borrados: { z: 1 } }, {}, 1 + 181 * 86400000).borrados, {}, "las tumbas se olvidan a los 180 días");
assert(F.registrosIguales(M, F.fusionarRegistros(B, A, 1000)), "la fusión es conmutativa");
assert(F.registrosIguales(M, F.fusionarRegistros(M, A, 1000)) && F.registrosIguales(M, F.fusionarRegistros(M, B, 1000)), "e idempotente");

// ── Worker simulado: un archivo con sha, como la API de contenidos de GitHub ───────────────────────────
let archivo = null, sha = 0, escrituras = 0, conflictoPendiente = null, lecturas = 0;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  assert(u.startsWith("https://angst-sync.angst-66394c52.workers.dev"));
  assert.equal(opts.headers["X-Angst-Auth"], "SECRETO");
  if (!opts.method || opts.method === "GET") { lecturas++; return new Response(JSON.stringify(archivo ? JSON.parse(archivo) : { found: false }), { status: 200 }); }
  const cuerpo = JSON.parse(opts.body);
  assert.equal(cuerpo.path, "game-enhanced-registro.json"); assert(!cuerpo.amend, "nunca amend en main");
  if (conflictoPendiente) { const c = conflictoPendiente; conflictoPendiente = null; archivo = JSON.stringify(c); sha++; return new Response(JSON.stringify({ error: "no se pudo commitear" }), { status: 502 }); }
  archivo = JSON.stringify(cuerpo.payload); sha++; escrituras++;
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

// sin AUTH_SECRET: no hace nada de red y avisa
await S.sincronizar();
assert.equal(S.estadoSync().fase, "sin-auth");
globalThis.localStorage.setItem(S.AUTH_KEY, "SECRETO");

// primer dispositivo: sin semilla y registro vacío NO crea el archivo
S._reiniciarSync();
await S.sincronizar();
assert.equal(archivo, null, "no se crea un archivo vacío antes de la semilla"); assert.equal(S.estadoSync().fase, "sincronizado");

// con datos: escribe una vez
R.sembrar([{ titulo: "Metroid Fusion", busqueda: "Metroid Fusion" }]);
R.agregarJuego({ titulo: "Hollow Knight", estado: "jugando", empezado: "2026-11-01", igdbId: 14593, portada: "co1abc", lanzamiento: "2017-02-24" });
await S.sincronizar();
const w1 = JSON.parse(archivo);
assert(w1.juegos["r-hollowknight"] && w1.juegos["r-metroidfusion"] && w1.sembrado, "el archivo trae el registro y la marca de semilla");
assert.equal(w1.juegos["r-hollowknight"].portada, "co1abc"); assert.equal(escrituras, 1);
await S.sincronizar();
assert.equal(escrituras, 1, "sin cambios no escribe de nuevo");

// otro dispositivo: localStorage vacío, trae el archivo y NO vuelve a sembrar
const copia = { ...w1 };
almacen.delete("angst-game-enhanced-registro-v1"); R.rehidratarRegistro();
await S.sincronizar();
assert.equal(Object.keys(R.leerRegistro().juegos).length, 2, "el segundo dispositivo recibe el registro");
R.sembrar([{ titulo: "Otro Terminado", busqueda: "Otro Terminado" }]);
assert(!R.leerRegistro().juegos["r-otroterminado"], "ya sembrado en el archivo: no se siembra otra vez");

// quitar = tumba que viaja; otro dispositivo con el juego no lo resucita
R.quitarJuego("r-hollowknight");
await S.sincronizar();
assert(!JSON.parse(archivo).juegos["r-hollowknight"] && JSON.parse(archivo).borrados["r-hollowknight"], "tumba en el archivo");
globalThis.localStorage.setItem("angst-game-enhanced-registro-v1", JSON.stringify({ v: 1, sembrado: 1, juegos: copia.juegos, borrados: {} })); R.rehidratarRegistro();
await S.sincronizar();
assert(!R.leerRegistro().juegos["r-hollowknight"], "lo quitado en otro dispositivo no reaparece");

// deshacer un quitado (restaurar) gana a la tumba
const prev = JSON.parse(archivo).juegos["r-metroidfusion"];
R.quitarJuego("r-metroidfusion"); R.restaurarJuego(prev);
await S.sincronizar();
assert(JSON.parse(archivo).juegos["r-metroidfusion"] && !JSON.parse(archivo).borrados["r-metroidfusion"], "restaurar gana a la tumba");

// conflicto de escritura: otro dispositivo escribe entre la lectura y la escritura → se repite y se fusiona
R.agregarJuego({ titulo: "Celeste", estado: "quiero" });
conflictoPendiente = { v: 1, sembrado: 1, juegos: { "r-otrodispositivo": e("otrodispositivo", "terminado", Date.now()) }, borrados: {} };
await S.sincronizar();
const fin = JSON.parse(archivo);
assert(fin.juegos["r-celeste"] && fin.juegos["r-otrodispositivo"], "tras el conflicto quedan ambos cambios");
assert.equal(S.estadoSync().fase, "sincronizado");

// los cambios locales disparan la sincronización con espera (ráfaga = un solo ciclo)
S._reiniciarSync();
const antes = lecturas;
await S.iniciarSync();
const l0 = lecturas;
R.agregarJuego({ titulo: "Uno", estado: "quiero" }); R.agregarJuego({ titulo: "Dos", estado: "quiero" });
assert.equal(S.estadoSync().fase, "pendiente");
await new Promise(r => setTimeout(r, S.ESPERA_CAMBIOS_MS + 400));
await new Promise(r => setTimeout(r, 50));
assert.equal(lecturas - l0, 1, "una ráfaga de dos cambios = un ciclo");
assert(JSON.parse(archivo).juegos["r-uno"] && JSON.parse(archivo).juegos["r-dos"]);
assert.equal(S.estadoSync().fase, "sincronizado");

// 401: se descarta el secreto guardado y se avisa
const bak = globalThis.fetch;
globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
await S.sincronizar();
assert.equal(S.estadoSync().fase, "error"); assert.equal(globalThis.localStorage.getItem(S.AUTH_KEY), null, "un secreto rechazado se borra");
globalThis.fetch = bak;
console.log("OK gameenhanced-sync: fusión, tumbas, semilla, conflictos y ráfagas");
process.exit(0);
