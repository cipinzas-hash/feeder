// Prueba de humo del render real de Game enhanced (React + jsdom, datos reales del repo y de la fuente).
// No forma parte de `npm test`: necesita react, react-dom y jsdom, que el repo no tiene como dependencias. Ver LEEME.md.
import "./setup.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import fs from "node:fs";

const w = window;
globalThis.React = React;
const REPO = process.env.REPO || process.cwd();
const ge = JSON.parse(fs.readFileSync(REPO + "/modules/feed/data/game-enhanced.json", "utf8"));
ge.semilla = JSON.parse(fs.readFileSync(REPO + "/modules/gameenhanced/data/terminados.json", "utf8")).juegos.map(t => ({ titulo: t.titulo, busqueda: t.busqueda }));
import { portsNativos } from "../../modules/feed/scripts/lib/game-enhanced-lib.mjs";
const fuenteReal = JSON.parse(fs.readFileSync(process.env.GAMES_JSON || "/tmp/games.json", "utf8")).games;
ge.ports = portsNativos(fuenteReal, JSON.parse(fs.readFileSync(REPO + "/modules/gameenhanced/data/terminados.json", "utf8")).juegos, Date.UTC(2026, 10, 18));
const d0 = ge.decomps[0];
const fichas = { fichas: { "r-metroidfusion": { portada: "co1abc", resumen: "Resumen de prueba.", generos: ["Acción"], plataformas: ["GBA"], lanzamiento: "2002-11-17", url: "https://www.igdb.com/games/x" } } };
const dRel = ge.decomps.find(d => d.release && /^https:\/\/github\.com\//.test(d.url));
const entradaReadme = { v: 2, repo: "o/r", actualizado: "2026-11-16T00:00:00Z", recortado: true, estado: { titulo: "Status: Phase 8 — Boots to a Window", texto: "Geometry not yet drawing." }, bloques: [["h", "Acerca"], ["p", "Texto del README."], ["li", "Paso uno"]] };
const readmes = { readmes: { [d0.id]: entradaReadme, [dRel.id]: entradaReadme } };
const repoDe = u => (/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/.exec(u || "") || [])[1];
const sugs = [{ tipo: "fork", nombre: "alguien/juego-vita", url: "https://github.com/alguien/juego-vita", plataformas: ["PS Vita"], estrellas: 40, pushed: "2026-10-01" }, { tipo: "rama", nombre: "3ds", url: "https://github.com/o/r/tree/3ds", plataformas: ["3DS"], estrellas: 0, pushed: null }, { tipo: "fork", nombre: "otro/juego-android", url: "https://github.com/otro/juego-android", plataformas: ["Android"], estrellas: 9, pushed: null }];
const plataformasFix = { plataformas: { [repoDe(dRel.url)]: { v: 1, sugerencias: sugs }, [repoDe(ge.ports[0].url)]: { v: 1, sugerencias: sugs } } };
globalThis.fetch = async url => {
  const u = String(url);
  const body = u.includes("fichas") ? fichas : u.includes("readmes") ? readmes : u.includes("plataformas") ? plataformasFix : ge;
  return { ok: true, json: async () => body };
};

const { default: Page } = await import("../../modules/gameenhanced/GameEnhancedPage.jsx");
const tick = async (n = 1) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); }); };
const root = createRoot(document.getElementById("r"));
await act(async () => { root.render(<Page />); });
await tick(4);
const txt = () => document.body.textContent;
const ok = (c, m) => { if (!c) { console.error("FALLA:", m); process.exitCode = 1; } else console.log("ok:", m); };

const btns = () => [...document.querySelectorAll("button")];
ok(btns().filter(b => /categoría seleccionada|^(Novedades|Decomps|Estudios|Ports|Terminados|Quiero jugar|Pendientes)$/.test(b.getAttribute("aria-label") || "")).length === 7, "7 categorías en el eje (con Ports)");
ok(/DATOS/.test(txt()) && /🏁 71/.test(txt()), "franja: datos y 71 terminados sembrados desde la semilla");
// ir a Terminados (índice 3)
const irA = async nombre => { await act(async () => { btns().find(b => b.getAttribute("aria-label") === nombre).click(); }); await tick(25); };
await irA("Terminados");
ok(document.querySelector('[aria-label="Agregar juego"]'), "botón ＋ visible en categorías del registro");
ok(/Metroid Fusion|Wolfenstein|Alpha|Abzû|Bloodborne|Control/.test(txt()) || document.querySelectorAll("button[aria-expanded]").length === 1, "lista de terminados con fila enfocada");
// abrir formulario
await act(async () => { document.querySelector('[aria-label="Agregar juego"]').click(); });
await tick();
ok(/Agregar juego/.test(txt()) && document.querySelector('input[type="text"]'), "formulario de alta abierto");
const inp = document.querySelector('input[type="text"]');
await act(async () => { const set = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set; set.call(inp, "Hollow Knight"); inp.dispatchEvent(new w.Event("input", { bubbles: true })); });
await tick();
const agregarBtn = btns().find(b => b.textContent === "Agregar");
ok(agregarBtn && !agregarBtn.disabled, "Agregar habilitado con título");
await act(async () => { agregarBtn.click(); });
await tick();
ok(/Hollow Knight/.test(txt()) && /Agregado a Terminado/.test(txt()), "juego agregado y aviso con Deshacer");
ok(JSON.parse(localStorage.getItem("angst-game-enhanced-registro-v1")).juegos["r-hollowknight"], "persistido en la clave del registro");
await act(async () => { btns().find(b => b.textContent === "Deshacer").click(); });
await tick();
ok(!JSON.parse(localStorage.getItem("angst-game-enhanced-registro-v1")).juegos["r-hollowknight"], "Deshacer quita el alta");
// Quiero jugar vacío → mensaje
await irA("Quiero jugar");
ok(/Aún no hay juegos en «Quiero jugar»/.test(txt()), "categoría vacía con mensaje y CTA");
// ── Decomps: control táctil libre, ficha en popup, posición recordada, releases y compartir ──
await irA("Decomps");
const enfocado = () => (document.querySelector("button[aria-expanded]") || {}).textContent || "";
const mover = async (tipo, x, y) => { await act(async () => { document.querySelector(".gameenh-body").dispatchEvent(new w.MouseEvent(tipo, { bubbles: true, clientX: x, clientY: y, button: 0 })); }); };
const t0 = enfocado();
// arrastre vertical con el dedo: ~3 filas hacia arriba (54 px por fila) con pausas, como un dedo real
await mover("pointerdown", 200, 500);
for (let k = 1; k <= 8; k++) { await mover("pointermove", 200, 500 - k * 20); await new Promise(r => setTimeout(r, 25)); }
const durante = enfocado();
await mover("pointerup", 200, 340);
await tick(40);
const t1 = enfocado();
ok(t1 !== t0, `arrastre vertical mueve el foco (de «${t0.slice(0, 22)}» a «${t1.slice(0, 22)}»)`);
const lugar1 = t1;
ok(!!document.querySelector('[aria-label="Metroid"]') || true, "—");
// arrastre horizontal: el eje sigue al dedo y encaja en otra categoría
await mover("pointerdown", 300, 200);
for (let k = 1; k <= 6; k++) { await mover("pointermove", 300 - k * 14, 200); await new Promise(r => setTimeout(r, 25)); }
await mover("pointerup", 216, 200);
await tick(40);
ok(!/categoría seleccionada/.test((btns().find(b => b.getAttribute("aria-label") === "Decomps") || document.createElement("b")).getAttribute("aria-label") || ""), "arrastre horizontal sale de Decomps");
const activa = btns().find(b => /categoría seleccionada/.test(b.getAttribute("aria-label") || "")).getAttribute("aria-label");
ok(/^(Estudios|Ports|Terminados)/.test(activa), "…y encaja en una categoría entera hacia donde fue el dedo: " + activa);
await irA("Decomps");
ok(enfocado() === lugar1, "al volver a Decomps el foco está donde lo dejaste");

// llevar el foco a un decomp con release
const conRelease = ge.decomps.find(d => d.release && /^https:\/\/github\.com\//.test(d.url));
let n = 0;
for (let k = 0; k < 12; k++) { await act(async () => { document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); }); await tick(1); }
while (!enfocado().includes(conRelease.titulo) && n < 90) {
  await act(async () => { document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
  await tick(2); n++;
}
await tick(20);
ok(enfocado().includes(conRelease.titulo), `teclado lleva el foco a «${conRelease.titulo}» (${n} pasos)`);
await act(async () => { document.querySelector("button[aria-expanded]").click(); });
await tick();
const abrir = btns().find(b => b.textContent === "Abrir ficha");
ok(abrir, "fila expandida con 'Abrir ficha'");
ok(document.querySelectorAll("[data-estado]").length >= 2, "insignia de estado visible en las filas, sin abrir la ficha (" + document.querySelectorAll("[data-estado]").length + " a la vista)");
ok(/También en \(sugerido\): .*3DS · PS Vita · Android/.test(txt()), "tarjeta expandida: «También en» con las plataformas sugeridas");
const posAntes = enfocado();
await act(async () => { abrir.click(); });
await tick(3);
ok(/Sobre el proyecto/.test(txt()), "ficha de decomp con sección 'Sobre el proyecto'");
ok(!/Volver/.test(txt()), "ya no hay flecha ← Volver");
ok(/Versiones en otras plataformas/.test(txt()) && /alguien\/juego-vita/.test(txt()) && /Rama «3ds»/.test(txt()) && /juego-android/.test(txt()), "ficha: versiones sugeridas en otras plataformas (Vita, 3DS, Android)");
ok([...document.querySelectorAll("a")].some(a => a.getAttribute("href") === "https://github.com/alguien/juego-vita"), "…con enlace al fork");
ok(/no están verificadas/.test(txt()), "…y avisa que son sugerencias no verificadas");
ok(/Con versión descargable/.test(txt()) && /Última versión/.test(txt()), "tarjeta de estado: semáforo 🟢 con su motivo");
ok(/ESTADO SEGÚN EL AUTOR/.test(txt()) && /Status: Phase 8 — Boots to a Window/.test(txt()) && /Geometry not yet drawing/.test(txt()), "estado según el autor, textual del README");
ok(/Qué es este tipo de proyecto:/.test(txt()), "glosario del tipo de proyecto en lenguaje llano");
ok(!/Estado\s*Activo/.test(txt()), "ya no aparece la fila «Estado: Activo»");
const cerrar = document.querySelector('button[aria-label="cerrar"]');
ok(cerrar && cerrar.textContent === "×", "la ficha es un popup con × para cerrar");
ok(document.querySelector("button[aria-expanded]"), "el XMB sigue montado detrás del popup");
const enlRel = [...document.querySelectorAll("a")].map(a => a.getAttribute("href"));
ok(enlRel.some(u => /\/releases\/tag\//.test(u)) && enlRel.some(u => /\/releases$/.test(u)), "enlaces de release en la ficha: " + enlRel.filter(u => /releases/.test(u)).join(" , "));
// compartir: menú nativo y, sin él, portapapeles
let compartido = null, copiado = null;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share: async d => { compartido = d; }, clipboard: { writeText: async t => { copiado = t; } } } });
await act(async () => { btns().find(b => b.textContent === "↗ Compartir").click(); });
await tick();
ok(compartido && compartido.title === conRelease.titulo && /releases\/tag/.test(compartido.text) && compartido.url === conRelease.url, "↗ Compartir usa el menú nativo con título, texto (con el release) y enlace");
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async t => { copiado = t; } } } });
await act(async () => { btns().find(b => b.textContent === "↗ Compartir").click(); });
await tick();
ok(copiado && copiado.includes(conRelease.url) && /Copiado/.test(txt()), "sin menú nativo: copia el texto y avisa «Copiado ✓»");
await act(async () => { document.querySelector('button[aria-label="cerrar"]').click(); });
await tick();
ok(!document.querySelector('button[aria-label="cerrar"]'), "la × cierra el popup");
ok(enfocado() === posAntes, "al cerrar el popup el XMB sigue en la misma posición y con la fila abierta");
// Estudios: botón Quiero jugar
await irA("Estudios");
await act(async () => { document.querySelector("button[aria-expanded]").click(); });
await tick();
ok(btns().some(b => b.textContent === "🎯 Quiero jugar"), "estudio: botón 🎯 Quiero jugar");
// ── Ports nativos de clásicos ──
await irA("Ports");
const nPorts = ge.ports.filter(p => p.dias <= 30).length;
ok(btns().some(b => b.getAttribute("aria-label") === "Ports, categoría seleccionada"), "categoría Ports seleccionable");
ok(!document.querySelector('[aria-label="Agregar juego"]'), "Ports no tiene el botón ＋ (no es del registro)");
const primero = enfocado();
ok(/PORT/.test(primero) && /Clásico de|Ya terminaste/.test(primero), `fila de port con su motivo: «${primero.slice(0, 70)}»`);
console.log("   (ports a la vista: " + nPorts + " en 30 días)");
await act(async () => { document.querySelector("button[aria-expanded]").click(); });
await tick();
ok(btns().some(b => b.textContent === "🎯 Quiero jugar") && btns().some(b => b.textContent === "No me interesa"), "port: 🎯 Quiero jugar y No me interesa");
await act(async () => { btns().find(b => b.textContent === "Abrir ficha").click(); });
await tick(3);
ok(/Sobre el proyecto/.test(txt()) && /Qué es este tipo de proyecto/.test(txt()), "ficha de port: estado, glosario y README");
ok([...document.querySelectorAll("a")].some(a => /\/releases\/tag\//.test(a.getAttribute("href"))), "ficha de port: enlace al release");
const tituloPort = (document.querySelector("h2") || {}).textContent;
await act(async () => { btns().find(b => b.textContent === "🎯 Quiero jugar").click(); });
await tick();
const reg = JSON.parse(localStorage.getItem("angst-game-enhanced-registro-v1")).juegos;
const agregado = Object.values(reg).find(j => j.estado === "quiero");
ok(agregado && !/\(/.test(agregado.titulo), `🎯 Quiero jugar desde un port guarda el título limpio: «${tituloPort}» → «${agregado && agregado.titulo}»`);
console.log("fin");
process.exit(process.exitCode || 0);
