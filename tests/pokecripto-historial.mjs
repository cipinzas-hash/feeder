// Pruebas de lib/historial.mjs (lote 1, 16-nov-2026). Correr: node tests/pokecripto-historial.mjs
import assert from "node:assert/strict";
import { marcarCortes, contarCortes, ultimoSegmento, hayCorteEntre, esMercadoDelgado, serieSuave, conservarNM, extrasSnapshot, esCostura } from "../modules/pokecripto/lib/historial.mjs";
import { addSnapshot, compactarHistorial } from "../modules/pokecripto/lib/pricing.mjs";

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const d = (i, market, extra = {}) => ({ date: `2026-11-${String(i).padStart(2, "0")}`, market, low: null, high: null, ...extra });

t("corte: sin fuente -> tpl con salto grande es una costura; un salto chico no", () => {
  const h = marcarCortes([d(1, 1), d(2, 5, { src: "tpl" }), d(3, 5.2, { src: "tpl" })]);
  assert.equal(h[1].corte, true); assert.ok(!h[2].corte); assert.ok(!h[0].corte);
  assert.deepEqual(marcarCortes([d(1, 1), d(2, 1.1, { src: "tpl" })]).map(x => x.corte), [undefined, undefined]);
});
t("corte: misma fuente no es costura aunque el precio salte (eso es mercado); dos sin fuente tampoco", () => {
  assert.equal(contarCortes(marcarCortes([d(1, 1, { src: "tpl" }), d(2, 9, { src: "tpl" })])), 0);
  assert.equal(contarCortes(marcarCortes([d(1, 1), d(2, 9)])), 0);
});
t("corte: ptcg -> tpl, cambio de base nm -> lp y cambio de tcgId son costuras; un cambio chico no", () => {
  assert.equal(esCostura(d(1, 1, { src: "ptcg" }), d(2, 3, { src: "tpl" })), true);
  assert.equal(esCostura(d(1, 3, { src: "tpl", base: "nm" }), d(2, 2, { src: "tpl", base: "lp" })), true);
  assert.equal(esCostura(d(1, 3, { src: "tpl", tid: "a" }), d(2, 5, { src: "tpl", tid: "b" })), true);
  assert.equal(esCostura(d(1, 3, { src: "tpl", tid: "a" }), d(2, 3.1, { src: "tpl", tid: "b" })), false);
  assert.equal(esCostura(d(1, 0.2, { src: "ptcg" }), d(2, 0.27, { src: "tpl" })), false); // +35 % pero solo US$0,07
});
t("corte: idempotente (mismo arreglo si no hay nada nuevo), no quita marcas y respeta el orden original", () => {
  const h1 = marcarCortes([d(1, 1), d(2, 5, { src: "tpl" })]);
  assert.equal(marcarCortes(h1), h1);
  const desordenado = [d(2, 5, { src: "tpl" }), d(1, 1)];
  const h2 = marcarCortes(desordenado);
  assert.equal(h2[0].date, "2026-11-02"); assert.equal(h2[0].corte, true);
  assert.equal(marcarCortes([d(1, 1)])?.length, 1); assert.deepEqual(marcarCortes(undefined), []);
});
t("compactar: un mes viejo conserva la marca de corte si su primer punto la tenía; el aggregate no pierde nada más", () => {
  const h = [
    { date: "2026-08-10", market: 1, low: null, high: null, corte: true }, { date: "2026-08-20", market: 3, low: null, high: null },
    { date: "2026-11-15", market: 2, low: null, high: null, src: "tpl" }, { date: "2026-11-16", market: 2.1, low: null, high: null, src: "tpl" },
  ];
  const c = compactarHistorial(h, "2026-11-16");
  const ago = c.find(x => x.agg); assert.equal(ago.corte, true); assert.equal(ago.market, 2);
  assert.deepEqual(compactarHistorial(c, "2026-11-16"), c);
});
t("segmento: ultimoSegmento arranca en el último corte; hayCorteEntre detecta la costura entre dos puntos", () => {
  const h = [d(1, 1), d(2, 1.1), d(3, 5, { corte: true }), d(4, 5.1)];
  assert.deepEqual(ultimoSegmento(h).map(x => x.market), [5, 5.1]);
  assert.deepEqual(ultimoSegmento([d(1, 1), d(2, 2)]).map(x => x.market), [1, 2]);
  assert.equal(hayCorteEntre(h, h[1], h[3]), true); assert.equal(hayCorteEntre(h, h[2], h[3]), false);
});
t("mercado delgado: rango bajo-alto ≥ 1,5 veces el market (usa el último snapshot con rango)", () => {
  assert.equal(esMercadoDelgado([d(1, 1, { low: 0.5, high: 3 })]), true);       // (3-0,5)/1 = 2,5
  assert.equal(esMercadoDelgado([d(1, 1, { low: 0.9, high: 1.2 })]), false);
  assert.equal(esMercadoDelgado([d(1, 1)]), false);                              // sin rango: no se puede saber
  assert.equal(esMercadoDelgado([d(1, 1, { low: 0.5, high: 3 }), d(2, 1)]), true);
});
t("suavizado: la mediana de 7 d aplana el vaivén, conserva el crudo y los demás campos, y no cruza un corte", () => {
  const vaiven = [1, 1.6, 1, 1.6, 1, 1.6, 1, 1.6].map((m, i) => d(i + 1, m, { src: "tpl" }));
  const s = serieSuave(vaiven);
  assert.equal(s.length, 8); assert.equal(s[7].crudo, 1.6); assert.ok(s[7].market >= 1 && s[7].market <= 1.6);
  assert.ok(Math.max(...s.slice(3).map(x => x.market)) - Math.min(...s.slice(3).map(x => x.market)) < 0.61);
  assert.equal(s[7].src, "tpl");
  const cortado = serieSuave([d(1, 1), d(2, 1), d(3, 1), d(4, 9, { corte: true }), d(5, 9), d(6, 9)]);
  assert.equal(cortado[4].market, 9); assert.equal(cortado[5].market, 9);        // el tramo nuevo no mezcla con el viejo
  assert.equal(serieSuave([d(1, 1), d(2, 2)])[1].market, 2);                    // menos de 3 vecinos: queda crudo
});
t("suavizado: los puntos mensuales (agg) no se tocan", () => {
  const s = serieSuave([{ date: "2026-08-31", market: 2, agg: true, n: 20 }, d(1, 1), d(2, 1), d(3, 1)]);
  assert.equal(s[0].market, 2); assert.equal(s[0].crudo, 2);
});
t("base NM: conserva el último NM si hoy solo hay LP y el precio tiene < 14 días; si ya era LP, o es viejo, o no es tpl, se acepta", () => {
  const nm = { priceHistory: [d(14, 3, { src: "tpl", base: "nm" })], tcgUpdated: "2026-11-14" };
  assert.equal(conservarNM(nm, { base: "lp" }, "2026-11-16"), true);
  assert.equal(conservarNM(nm, { base: "nm" }, "2026-11-16"), false);
  assert.equal(conservarNM(nm, { base: "lp" }, "2026-12-01"), false);          // 17 días
  assert.equal(conservarNM({ ...nm, priceHistory: [d(14, 3, { src: "tpl", base: "lp" })] }, { base: "lp" }, "2026-11-16"), false);
  assert.equal(conservarNM({ priceHistory: [d(14, 3, { src: "ptcg" })], tcgUpdated: "2026-11-14" }, { base: "lp" }, "2026-11-16"), false);
  assert.equal(conservarNM({ priceHistory: [], tcgUpdated: null }, { base: "lp" }, "2026-11-16"), false);
  assert.equal(conservarNM(nm, null, "2026-11-16"), false);
  assert.equal(conservarNM({ priceHistory: [d(14, 3, { src: "tpl" })], tcgUpdated: "2026-11-14" }, { base: "lp" }, "2026-11-16"), true); // snapshot viejo sin base cuenta como NM
});
t("extras de snapshot: addSnapshot guarda tid/var/base solo cuando existen, y el snapshot del mismo día los actualiza", () => {
  assert.deepEqual(extrasSnapshot({ tid: "x", variant: "Holofoil", base: "nm" }), { tid: "x", var: "Holofoil", base: "nm" });
  assert.deepEqual(extrasSnapshot({}), {}); assert.deepEqual(extrasSnapshot(), {});
  const h = addSnapshot([], 2, 1, 3, "2026-11-16", "tpl", extrasSnapshot({ tid: "x", base: "nm" }));
  assert.deepEqual(h, [{ date: "2026-11-16", market: 2, low: 1, high: 3, src: "tpl", tid: "x", base: "nm" }]);
  const h2 = addSnapshot(h, 2.5, 1, 3, "2026-11-16", "tpl", extrasSnapshot({ tid: "x", variant: "Normal", base: "nm" }));
  assert.equal(h2.length, 1); assert.equal(h2[0].var, "Normal"); assert.equal(h2[0].market, 2.5);
  assert.deepEqual(addSnapshot([], 1, null, null, "2026-11-16", "tpl"), [{ date: "2026-11-16", market: 1, low: null, high: null, src: "tpl" }]);
});
console.log(`\n${n} pruebas en verde`);
