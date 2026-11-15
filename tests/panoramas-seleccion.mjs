// Selección ⭐ de Panoramas (modules/panoramas/seleccion.js): persistencia, ventana de aviso de 7 días,
// día y texto de la tarea del planificador, y que el aviso entre al dashboard de Semana.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// localStorage falso ANTES de importar el módulo (lee la clave al cargarse)
const almacen = new Map();
globalThis.localStorage = { getItem: k => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)), removeItem: k => almacen.delete(k) };
const KEY = "angst-panoramas-seleccion-v1";

const S = await import("../modules/panoramas/seleccion.js");
const { textoCompartir, alternarEstrella, marcarTarea, sincronizarCon, leerSeleccion, rehidratarSeleccion, vigentes, diaDeTarea, textoTarea, avisosDelDia, diasEntre, sumarDias } = S;

const HOY = "2026-11-14";
const ev = (id, inicio, extra = {}) => ({ id, titulo: "Evento " + id, url: "https://x.cl/" + id, inicio, fin: extra.fin || inicio, hora: "19:00", lugar: "Teatro", comuna: "Santiago", visto: "2026-11-01", _dias: 3, ...extra });

// 1. ⭐ guarda una COPIA del evento (solo campos conocidos) y se puede quitar
alternarEstrella(ev("a", "2026-11-20", { detalle: "Texto largo del evento." }));
assert.equal(Object.keys(leerSeleccion().sel).length, 1);
const guardado = JSON.parse(almacen.get(KEY));
assert.equal(guardado.sel.a.ev.titulo, "Evento a");
assert.equal(guardado.sel.a.ev.detalle, "Texto largo del evento.", "la copia lleva la descripción");
assert(!("_dias" in guardado.sel.a.ev) && !("visto" in guardado.sel.a.ev), "no copia campos derivados ni internos");
assert.equal(guardado.sel.a.tarea, null);
alternarEstrella(ev("a", "2026-11-20"));
assert.equal(Object.keys(leerSeleccion().sel).length, 0, "segunda vez la quita");

// 2. tarea creada: se recuerda; marcarTarea sobre algo sin ⭐ no inventa entradas
alternarEstrella(ev("b", "2026-11-18"));
marcarTarea("b", { dia: "2026-11-17", id: 123 });
marcarTarea("zzz", { dia: "x", id: 1 });
assert.deepEqual(leerSeleccion().sel.b.tarea, { dia: "2026-11-17", id: 123 });
assert.equal(leerSeleccion().sel.zzz, undefined);

// 3. sobrevive a recargar (caché de módulo ← localStorage) y a un export/restore
rehidratarSeleccion();
assert.equal(leerSeleccion().sel.b.tarea.id, 123);
almacen.set(KEY, JSON.stringify({ sel: { q: { marca: 1, ev: { id: "q", titulo: "Q", inicio: "2026-12-01", fin: "2026-12-01" }, tarea: null }, rota: { ev: null } } }));
rehidratarSeleccion();
assert.deepEqual(Object.keys(leerSeleccion().sel), ["q"], "una entrada corrupta se descarta, no rompe");
almacen.set(KEY, "{no es json");
rehidratarSeleccion();
assert.deepEqual(leerSeleccion(), { sel: {} }, "clave corrupta = vacío");

// 4. sincronizarCon: refresca la copia con el dato fresco y borra lo terminado hace > 30 días
alternarEstrella(ev("c", "2026-11-25", { detalle: undefined }));
alternarEstrella(ev("vieja", "2026-09-01"));
sincronizarCon([ev("c", "2026-11-25", { hora: "20:30", detalle: "Llegó la descripción." })], HOY);
assert.equal(leerSeleccion().sel.c.ev.hora, "20:30");
assert.equal(leerSeleccion().sel.c.ev.detalle, "Llegó la descripción.");
assert.equal(leerSeleccion().sel.vieja, undefined, "terminado hace más de 30 días: se limpia");
alternarEstrella(ev("d", "2026-11-12", { fin: "2026-11-13" }));   // terminó hace 1 día: se conserva (30)
sincronizarCon([], HOY);
assert(leerSeleccion().sel.d, "un evento que salió del JSON conserva su copia");

// 5. vigentes: solo lo que no terminó, por fecha de inicio
alternarEstrella(ev("e", "2026-11-16"));
assert.deepEqual(vigentes(leerSeleccion(), HOY).map(x => x.ev.id), ["e", "c"]);

// 6. día y texto de la tarea: la víspera; si ya pasó, hoy
assert.equal(diaDeTarea(ev("x", "2026-11-20"), HOY), "2026-11-19", "víspera");
assert.equal(diaDeTarea(ev("x", "2026-11-15"), HOY), "2026-11-14", "mañana → víspera = hoy");
assert.equal(diaDeTarea(ev("x", "2026-11-14"), HOY), "2026-11-14", "hoy → hoy (la víspera ya pasó)");
assert.equal(diaDeTarea(ev("x", "2026-10-01", { fin: "2027-01-03" }), HOY), "2026-11-14", "ya empezó → hoy");
assert.equal(textoTarea(ev("x", "2026-11-20"), "2026-11-19"), "🗓️ Mañana: Evento x · 19:00 · Teatro");
assert.equal(textoTarea(ev("x", "2026-11-14"), "2026-11-14"), "🗓️ Hoy: Evento x · 19:00 · Teatro");
assert.equal(textoTarea(ev("x", "2026-11-14", { hora: null, lugar: null }), "2026-11-14"), "🗓️ Hoy: Evento x");
assert(textoTarea(ev("x", "2026-12-01"), "2026-11-14").startsWith("🗓️ ") && textoTarea(ev("x", "2026-12-01"), "2026-11-14").includes("1 dic"), "lejano: lleva la fecha");

// 7. aviso en Semana: SOLO el día de inicio y SOLO desde 7 días antes (la baliza normal mira 60)
const est = { sel: { f: { marca: 1, ev: ev("f", "2026-11-21", { hora: "10:00–17:30" }), tarea: null } } };
assert.equal(avisosDelDia(est, "2026-11-21", HOY).length, 1, "faltan 7 días: aparece");
assert.equal(avisosDelDia(est, "2026-11-21", "2026-11-13").length, 0, "faltan 8: todavía no");
assert.equal(avisosDelDia(est, "2026-11-21", "2026-11-21").length, 1, "el mismo día: aparece");
assert.equal(avisosDelDia(est, "2026-11-21", "2026-11-22").length, 0, "ya pasó");
assert.equal(avisosDelDia(est, "2026-11-20", HOY).length, 0, "otro día: nada");
const av = avisosDelDia(est, "2026-11-21", HOY)[0];
assert.deepEqual(av, { icono: "⭐", texto: "Evento f", hora: "10:00", detalle: "Teatro" }, "hora de inicio del rango");
assert.equal(avisosDelDia({ sel: { g: { ev: ev("g", "2026-11-21", { hora: null }) } } }, "2026-11-21", HOY)[0].hora, null, "sin hora no inventa una");

// 7b. texto para compartir: título + (cuándo · hora · lugar) + enlace al original
assert.deepEqual(textoCompartir(ev("s", "2026-11-22")), { titulo: "Evento s", texto: "Evento s\ndom 22 nov · 19:00 · Teatro", url: "https://x.cl/s" });
assert(textoCompartir(ev("s", "2026-11-22", { fin: "2026-11-24" })).texto.includes("dom 22 nov → mar 24 nov"), "rango");
assert(textoCompartir(ev("s", "2026-10-01", { fin: "2027-01-03", enCurso: true })).texto.includes("en curso hasta dom 3 ene"), "en curso");
assert.equal(textoCompartir(ev("s", "2026-11-22", { hora: null, lugar: null })).texto, "Evento s\ndom 22 nov", "sin hora ni lugar no deja separadores sueltos");

// 8. fechas
assert.equal(diasEntre("2026-11-14", "2026-11-21"), 7);
assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");

// 9. El dashboard de Semana muestra el aviso (buildResumen real, no una copia)
{
  const src = readFileSync(new URL("../core/SemanaDashboard.jsx", import.meta.url), "utf8");
  assert(/panoramasDe\(k\)/.test(src) && /\.\.\.salud, \.\.\.panoramas/.test(src), "buildResumen suma panoramasDe a las balizas");
  const app = readFileSync(new URL("../core/App.jsx", import.meta.url), "utf8");
  assert(/panoramasDe=\{k=>avisosPanoramas\(selPanoramas, k, fmtFull\(new Date\(\)\)\)\}/.test(app), "App pasa panoramasDe al dashboard");
  assert(/rehidratarPanoramas\(\)/.test(app), "restoreFromPayload rehidrata la selección");
  assert(/crearTareaPanorama/.test(app) && !/crearTareaPanorama[\s\S]{0,400}privada/.test(app.split("const agregarTareaRapida")[0].slice(-700)), "la tarea desde Panoramas va visible (sin privada)");
}
console.log("OK panoramas-seleccion");
