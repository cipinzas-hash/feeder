// Pruebas del régimen de 3 datos por mes (media, mínimo, máximo): plegar snapshots, mezclar con el archivo de tcgcsv y expandir para el gráfico.
// Correr: node tests/pokecripto-historial-3datos.mjs
import assert from "node:assert/strict";
import { plegarMeses, triMensual, mezclarHistMes, expandirHistMes, historialConMensual } from "../modules/pokecripto/lib/historial.mjs";
let n = 0; const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const dia = (date, market, low = null, high = null) => ({ date, market, low, high, src: "tpl" });

t("triMensual: media, mínimo y máximo del market diario (ignora días sin precio)", () => {
  assert.deepEqual(triMensual([dia("2026-08-01", 2), dia("2026-08-02", 4), dia("2026-08-03", 6), dia("2026-08-04", null)]), [4, 2, 6]);
  assert.equal(triMensual([dia("2026-08-01", null)]), null);
});
t("plegarMeses: los meses cerrados salen de priceHistory y quedan como [media, mín, máx] en histMes; el mes en curso y la ventana se quedan", () => {
  const h = [dia("2026-08-05", 10), dia("2026-08-20", 20), dia("2026-09-10", 5), dia("2026-09-12", 7), dia("2026-11-10", 8), dia("2026-11-20", 9)];
  const f = plegarMeses({ id: "1", priceHistory: h }, "2026-11-23");
  assert.deepEqual(f.histMes, { m: "2026-08", t: [[15, 10, 20], [6, 5, 7]] });
  assert.deepEqual(f.priceHistory.map(p => p.date), ["2026-11-10", "2026-11-20"]);
  assert.equal(plegarMeses(f, "2026-11-23"), f);                      // idempotente: misma fila
});
t("plegarMeses: los puntos agg del compactador anterior también se pliegan (market→media, low→mín, high→máx)", () => {
  const h = [{ date: "2026-07-31", market: 3, low: 1, high: 9, n: 20, agg: true, src: "tpl" }, dia("2026-11-20", 8), dia("2026-11-22", 8)];
  const f = plegarMeses({ id: "1", priceHistory: h }, "2026-11-23");
  assert.deepEqual(f.histMes, { m: "2026-07", t: [[3, 1, 9]] }); assert.equal(f.priceHistory.length, 2);
});
t("mezclarHistMes: el archivo de tcgcsv manda en los meses que tiene; los propios rellenan los que faltan; también lee el formato viejo {p}", () => {
  const archivo = { m: "2026-01", t: [[1, 1, 1], null, [3, 2, 4]] }, propio = { m: "2026-02", t: [[9, 8, 10], [7, 6, 8], [5, 5, 5]] };
  assert.deepEqual(mezclarHistMes(archivo, propio), { m: "2026-01", t: [[1, 1, 1], [9, 8, 10], [3, 2, 4], [5, 5, 5]] });
  assert.deepEqual(mezclarHistMes({ m: "2026-01", p: [2, null, 4] }, null), { m: "2026-01", t: [[2, 2, 2], null, [4, 4, 4]] });
});
t("expandirHistMes: un punto agg por mes con media, mínimo y máximo; el gráfico lo concatena delante del historial propio", () => {
  const pts = expandirHistMes({ m: "2026-01", t: [[2, 1, 3], null, [4, 3, 5]] });
  assert.equal(pts.length, 2); assert.deepEqual([pts[0].market, pts[0].low, pts[0].high, pts[0].date], [2, 1, 3, "2026-01-01"]);
  const g = historialConMensual({ priceHistory: [dia("2026-11-20", 8)], histMes: { m: "2026-01", t: [[2, 1, 3], [4, 3, 5]] } });
  assert.equal(g.length, 3); assert.ok(g[0].agg);
});
t("peso: 34 meses de 3 datos ≈ 0,6 KB por carta (el formato viejo, un objeto por mes, ≈ 2,9 KB)", () => {
  const tt = Array.from({ length: 34 }, (_, i) => [1.23 + i / 10, 0.9, 2.5]);
  const nuevo = JSON.stringify({ m: "2024-02", t: tt }).length, viejo = JSON.stringify(tt.map((x, i) => ({ date: "2024-02-28", market: x[0], low: x[1], high: x[2], n: 28, agg: true, src: "tpl" }))).length;
  assert.ok(nuevo < 700 && viejo > 4 * nuevo, `${nuevo} vs ${viejo}`);
});
console.log(`${n} pruebas en verde`);
