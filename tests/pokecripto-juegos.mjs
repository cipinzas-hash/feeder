// Pruebas de lib/juegos.mjs y lib/variantes-comunes.mjs (multi-juego + variantes). Correr: node tests/pokecripto-juegos.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pendientesDeCambio, juegoDe, esPokemon, idFila, filaTiene, marcaDeFila, marcasDeFilas, filasDeCarta, aplicarMarca, actualizarPreciosFilas, precioDeCarta, cartaDe, JUEGOS, variantesDeImpresion, resumenFilas } from "../modules/pokecripto/lib/juegos.mjs";
import { describirVariante, ordenarVariantes, abreviarRareza, multiploSobreBase, resumenVariantes } from "../modules/pokecripto/lib/variantes-comunes.mjs";
import { resumenColeccion, filtrarCartas, claveVersion, precioVersion } from "../modules/tcgcrypto/logica.js";

const ygo = JSON.parse(readFileSync(new URL("../modules/feed/data/tcgcrypto-yugioh.json", import.meta.url), "utf-8"));
const dgm = JSON.parse(readFileSync(new URL("../modules/feed/data/tcgcrypto-digimon.json", import.meta.url), "utf-8"));
const dark = ygo.colecciones.find(c => c.id === "dark");
const zombie = ygo.colecciones.find(c => c.id === "zombie");
const numemon = dgm.colecciones[0];
const hoy = "2026-11-17", ayer = "2026-11-16";
let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
// una carta de Yu-Gi-Oh! con ≥2 versiones con precio distinto
const carta = ygo.cartas.find(c => c.c.includes("dark") && c.v.filter(v => v[5] != null).length >= 2 && new Set(c.v.map(v => v[5])).size >= 2);
const vk = (c, i) => claveVersion(c.v.filter(v => v[5] != null)[i]);
const marcar = (inv, parche, vkey, c = carta, col = dark, h = hoy) => aplicarMarca(inv, { juego: "yugioh", datos: ygo, col, k: c.k, vkey, parche, hoy: h });

t("juego: sin campo es Pokémon; el registro tiene los tres juegos", () => {
  assert.equal(juegoDe({}), "pokemon"); assert.equal(juegoDe(null), "pokemon"); assert.equal(juegoDe({ juego: "yugioh" }), "yugioh");
  assert.ok(esPokemon({ id: "x" })); assert.ok(!esPokemon({ juego: "digimon" }));
  assert.deepEqual(JUEGOS.map(j => j.id), ["pokemon", "yugioh", "digimon"]);
});
t("variante: marcar una variante crea SU fila (en_mano) con el precio exacto de esa variante, historial csv con tcgId", () => {
  const key = vk(carta, 0), v = carta.v.find(x => claveVersion(x) === key);
  const inv = marcar([], { c: 1 }, key);
  assert.equal(inv.length, 1); const f = inv[0];
  assert.equal(f.id, idFila("yugioh", "dark", carta.k, key)); assert.equal(f.tcgcsvKey, key); assert.equal(f.estado, "en_mano"); assert.equal(f.tcgMarket, precioVersion(v));
  assert.equal(f.priceHistory.length, 1); assert.equal(f.priceHistory[0].src, "csv"); assert.equal(f.priceHistory[0].tid, String(v[0])); assert.equal(f.priceHistory[0].var, v[1]);
  assert.ok(filaTiene(f)); assert.equal(f.cantidad, 1);
});
t("variante: dos variantes de la misma carta son dos ejemplares (cada una con su costo, cantidad y notas)", () => {
  const k0 = vk(carta, 0), k1 = vk(carta, 1);
  assert.notEqual(k0, k1);
  let inv = marcar([], { c: 1, q: 2, cu: 1.5 }, k0);
  inv = marcar(inv, { c: 1, cu: 9, nt: "firmada" }, k1);
  assert.equal(inv.length, 2);
  const [a, b] = inv; assert.notEqual(a.id, b.id);
  assert.equal(a.cantidad, 2); assert.equal(a.costoUSD, 1.5); assert.equal(b.notas, "firmada"); assert.equal(b.costoUSD, 9);
  assert.equal(filasDeCarta(inv, "yugioh", "Dark", carta.k).length, 2);
  inv = marcar(inv, { c: 0, q: 0, cu: 0, nt: "" }, k0);                  // quitar una (todo) no toca la otra
  assert.equal(marcar(marcar([], { c: 1, q: 2 }, k0), { c: 0 }, k0)[0].estado, "hunting"); // solo desmarcar 'la tengo' conserva costo/cantidad como hunting
  assert.equal(inv.length, 1); assert.equal(inv[0].tcgcsvKey, k1);
});
t("variante: quitar todo lo marcado borra la fila; una variante inexistente o una carta inexistente no cambian nada", () => {
  const key = vk(carta, 0);
  let inv = marcar([], { cu: 3 }, key);                                  // solo costo: fila hunting
  assert.equal(inv.length, 1); assert.equal(inv[0].estado, "hunting");
  inv = marcar(inv, { cu: 0 }, key); assert.equal(inv.length, 0);
  const x = marcar([], { c: 1 }, key);
  assert.equal(marcar(x, { c: 1 }, "no|existe"), x);
  assert.equal(aplicarMarca(x, { juego: "yugioh", datos: ygo, col: dark, k: "no-existe", vkey: key, parche: { c: 1 }, hoy }), x);
});
t("variante: sin vkey usa la variante más barata con precio", () => {
  const inv = marcar([], { c: 1 }, undefined);
  const min = Math.min(...carta.v.map(v => precioVersion(v)).filter(p => p != null));
  assert.equal(inv[0].tcgMarket, min);
});
t("colección individual: la misma carta en dos colecciones son filas distintas y las de Pokémon no se tocan", () => {
  const poke = { id: "p1", cardId: "sv1-1", name: "Pikachu", estado: "en_mano" };
  const cz = ygo.cartas.find(c => c.c.includes("dark") && c.c.includes("zombie"));
  const key = claveVersion(cz.v[0]);
  let inv = marcar([poke], { c: 1 }, key, cz, dark);
  inv = marcar(inv, { c: 1 }, key, cz, zombie);
  assert.equal(inv.length, 3); assert.equal(inv[0], poke);
  assert.deepEqual(inv.filter(f => f.juego === "yugioh").map(f => f.carpeta).sort(), ["Dark", "Zombie"]);
});
t("marcasDeFilas agrega las variantes de una carta; resumenColeccion/filtrarCartas siguen funcionando sobre eso", () => {
  const cs = ygo.cartas.filter(c => c.c.includes("dark")).slice(0, 5);
  let inv = [];
  for (const c of cs.slice(0, 2)) inv = marcar(inv, { c: 1, q: 2 }, claveVersion(c.v[0]), c);
  inv = marcar(inv, { c: 1 }, claveVersion(cs[2].v[0]), cs[2]);
  if (cs[2].v.length > 1) inv = marcar(inv, { c: 1, q: 3 }, claveVersion(cs[2].v[1]), cs[2]); // 2ª variante de la misma carta
  const marcas = marcasDeFilas(inv, "yugioh", "Dark");
  assert.equal(Object.keys(marcas).length, 3); assert.ok(marcas[cs[2].k].c);
  if (cs[2].v.length > 1) assert.equal(marcas[cs[2].k].q, 4);            // 1 + 3
  const r = resumenColeccion(cs, marcas);
  assert.equal(r.total, 5); assert.equal(r.conseguidas, 3);
  assert.equal(filtrarCartas(cs, marcas, { modo: "tengo" }, ygo.sets).length, 3);
  assert.equal(filtrarCartas(cs, marcas, { modo: "faltan" }, ygo.sets).length, 2);
});
t("resumenFilas: valor conseguido = cada variante que tienes × cantidad; valor total = la más barata de cada carta", () => {
  const cs = ygo.cartas.filter(c => c.c.includes("dark") && c.v.some(v => v[5] != null)).slice(0, 4);
  const k0 = claveVersion(cs[0].v.find(v => v[5] != null));
  let inv = marcar([], { c: 1, q: 3 }, k0, cs[0]);
  const r = resumenFilas(cs, inv.filter(f => f.carpeta === "Dark"));
  const p0 = precioVersion(cs[0].v.find(v => claveVersion(v) === k0));
  assert.equal(r.conseguidas, 1); assert.equal(r.valorConseguido, Math.round(p0 * 3 * 100) / 100);
  assert.ok(r.valorTotal > 0 && r.total === 4);
});
t("Digimon: una fila por arte (producto), con su imagen y precio", () => {
  const c = dgm.cartas[0], key = claveVersion(c.v[0]);
  const inv = aplicarMarca([], { juego: "digimon", datos: dgm, col: numemon, k: c.k, vkey: key, parche: { c: 1 }, hoy });
  assert.equal(inv[0].juego, "digimon"); assert.equal(inv[0].id, idFila("digimon", "numemon", c.k, key)); assert.equal(inv[0].carpeta, numemon.nombre);
  assert.ok(inv[0].image.includes(String(c.v[0][0])));
});
t("actualizarPreciosFilas: reprecia cada fila con SU variante, agrega el snapshot del día, no toca Pokémon ni vendidas y es idempotente", () => {
  const key = vk(carta, 0), v = carta.v.find(x => claveVersion(x) === key);
  const inv = marcar([], { c: 1 }, key, carta, dark, ayer);
  const viejo = { ...inv[0], tcgMarket: 0.01, tcgUpdated: ayer };
  const poke = { id: "p1", cardId: "x", estado: "en_mano", tcgMarket: 5 };
  const vendida = { ...viejo, id: "v", estado: "vendida" };
  const r = actualizarPreciosFilas([poke, viejo, vendida], { yugioh: ygo }, hoy);
  assert.equal(r.cambiadas, 1); assert.equal(r.filas[0], poke); assert.equal(r.filas[2], vendida);
  assert.equal(r.filas[1].tcgMarket, precioVersion(v)); assert.equal(r.filas[1].priceHistory.at(-1).date, hoy);
  const otra = actualizarPreciosFilas(r.filas, { yugioh: ygo }, hoy);
  assert.equal(otra.cambiadas, 0); assert.equal(otra.filas, r.filas);
  assert.equal(actualizarPreciosFilas([viejo], {}, hoy).cambiadas, 0);
});
t("precioDeCarta: sin precio devuelve null; con la versión elegida sin precio no cae a otra", () => {
  assert.equal(precioDeCarta({ k: "a", n: "A", v: [[1, "N", 0, "1", "C", null, null, null]] }, null), null);
  assert.equal(precioDeCarta(null, null), null);
  const c = { k: "a", n: "A", v: [[1, "1st", 0, "1", "C", 5, 4, 6], [2, "Unl", 0, "1", "C", null, null, null]] };
  assert.equal(precioDeCarta(c, { e: "2|Unl" }), null); assert.equal(precioDeCarta(c, { e: "1|1st" }).market, 5); assert.equal(precioDeCarta(c, null).tid, "1");
});
t("variantesDeImpresion: junta rarezas y ediciones del mismo set y número, con el formato común y ordenadas", () => {
  const c = ygo.cartas.find(x => { const por = {}; x.v.forEach(v => { const k = v[2] + "|" + v[3]; por[k] = new Set([...(por[k] || []), v[0]]); }); return Object.values(por).some(s => s.size > 1); });
  const por = {}; c.v.forEach(v => { const k = v[2] + "|" + v[3]; por[k] = new Set([...(por[k] || []), v[0]]); });
  const [setIdx, num] = Object.entries(por).find(([, s]) => s.size > 1)[0].split("|");
  const vs = variantesDeImpresion(ygo, c, Number(setIdx), num, "yugioh");
  assert.ok(vs.length >= 2); assert.ok(new Set(vs.map(x => x.pid)).size > 1);
  for (const x of vs) { assert.ok(x.etiqueta && x.corta && x.key && x.tipo); assert.equal(x.key, claveVersion(x.v)); }
});

// ── variantes-comunes: el mismo formato para todos los juegos ─────────────────
t("describir (Pokémon): acabados, patrones y sellos con etiqueta, ícono y tipo; el sello pesa más que el acabado", () => {
  const rev = describirVariante({ juego: "pokemon", sub: "Reverse Holofoil" });
  assert.equal(rev.tipo, "acabado"); assert.equal(rev.etiqueta, "Reverse Holo"); assert.equal(rev.icono, "⟡");
  const holo = describirVariante({ sub: "Holofoil" }); assert.equal(holo.etiqueta, "Holo"); assert.equal(holo.icono, "✦");
  const normal = describirVariante({ sub: "Normal" }); assert.equal(normal.tipo, "base"); assert.equal(normal.etiqueta, "Normal");
  const pb = describirVariante({ sub: "Reverse Holofoil", sufijo: "Poke Ball Pattern" }); assert.equal(pb.tipo, "patron"); assert.equal(pb.clave, "pokeball"); assert.ok(/Poké Ball/.test(pb.etiqueta));
  const mb = describirVariante({ sub: "Reverse Holofoil", sufijo: "Master Ball Pattern" }); assert.equal(mb.clave, "masterball");
  const en = describirVariante({ sub: "Reverse Holofoil", sufijo: "Energy Symbol Pattern" }); assert.equal(en.clave, "logotipo"); assert.ok(/Logo de tipo/.test(en.etiqueta));
  const lg = describirVariante({ sub: "Holofoil", sufijo: "League Promo" }); assert.equal(lg.tipo, "sello"); assert.equal(lg.clave, "liga"); assert.ok(lg.esSello);
  assert.equal(describirVariante({ sufijo: "Pokemon League" }).clave, "liga");
  assert.equal(describirVariante({ sufijo: "League Challenge" }).clave, "liga");
  assert.equal(describirVariante({ sufijo: "Regional Championships" }).clave, "campeonato");
  assert.equal(describirVariante({ sufijo: "Prerelease" }).clave, "prerelease");
  assert.equal(describirVariante({ sufijo: "Staff" }).clave, "staff");
});
t("describir (Yu-Gi-Oh!/Digimon): edición y rareza con abreviaturas; Foil de Digimon", () => {
  const y = describirVariante({ juego: "yugioh", sub: "1st Edition", rareza: "Ultra Rare" }); assert.equal(y.etiqueta, "UR · 1ª Edición"); assert.equal(y.corta, "UR 1ª");
  assert.equal(describirVariante({ juego: "yugioh", sub: "Unlimited", rareza: "Quarter Century Secret Rare" }).etiqueta, "QCScR · Unlimited");
  assert.equal(describirVariante({ juego: "yugioh", sub: "Limited", rareza: "Common" }).etiqueta, "C · Limited");
  const d = describirVariante({ juego: "digimon", sub: "Foil", rareza: "Rare" }); assert.equal(d.tipo, "acabado"); assert.equal(d.etiqueta, "Foil");
  assert.equal(abreviarRareza("Starlight Rare"), "StR"); assert.equal(abreviarRareza("Zeta Rare"), "ZR"); assert.equal(abreviarRareza(""), "");
});
t("ordenar y comparar: sellos primero, luego por precio; múltiplo sobre la base (lo que importa de un sello de liga)", () => {
  const base = describirVariante({ sub: "Normal", market: 2 }), rev = describirVariante({ sub: "Reverse Holofoil", market: 4 }), liga = describirVariante({ sub: "Holofoil", sufijo: "League Promo", market: 30 });
  const o = ordenarVariantes([base, rev, liga]);
  assert.deepEqual(o.map(x => x.clave), ["liga", "reverse", "normal"]);
  assert.equal(multiploSobreBase(liga, o), 15); assert.equal(multiploSobreBase(rev, o), 2); assert.equal(multiploSobreBase(liga, []), null);
  const r = resumenVariantes(o); assert.equal(r.n, 3); assert.equal(r.min, 2); assert.equal(r.max, 30); assert.equal(r.sellos, 1);
});
t("pendientesDeCambio: fila nueva y modificada se encolan; la quitada va como baja; sin cambio no encola nada", () => {
  const k0 = vk(carta, 0), k1 = vk(carta, 1);
  const a = marcar([], { c: 1 }, k0);
  assert.deepEqual(pendientesDeCambio([], a).map(f => f.id), [a[0].id]);                       // alta
  assert.equal(pendientesDeCambio(a, a).length, 0);                                              // sin cambio
  const b = marcar(a, { c: 1, cu: 4 }, k0); assert.equal(pendientesDeCambio(a, b).length, 1);     // modificada
  const c2 = marcar(a, { c: 1 }, k1); assert.deepEqual(pendientesDeCambio(a, c2).map(f => f.tcgcsvKey), [k1]); // solo la nueva variante
  const quitada = marcar(a, { c: 0, q: 0, cu: 0, nt: "" }, k0);
  assert.deepEqual(pendientesDeCambio(a, quitada), [{ id: a[0].id, _baja: true }]);              // baja
});
console.log(`\n${n} pruebas en verde`);
