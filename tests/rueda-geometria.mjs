// La rueda de sobres: los centros de los círculos caen sobre la pista (circunferencia centrada), sin solaparse entre vecinos.
import assert from "node:assert/strict";
import { geometriaRueda, TAM, CEN, R, BOTONES, LADO_BTN, EXT_BTN } from "../modules/presupuesto/ruedaGeometria.js";

for (const n of [1, 2, 3, 5, 8, 12, 16, 20, 24]) {
  const g = geometriaRueda(n);
  assert.equal(g.nodos.length, n);
  assert.equal(g.pista.left + g.pista.size / 2, CEN);                       // la pista está centrada en la rueda
  assert.equal(g.pista.top + g.pista.size / 2, CEN);
  assert.equal(g.pista.size / 2, R);
  g.nodos.forEach(p => assert.ok(Math.abs(Math.hypot(p.cx - CEN, p.cy - CEN) - R) < 1e-9, `n=${n}: el centro del nodo ${p.i} no está sobre la pista`));
  if (n > 1) {
    const d = Math.hypot(g.nodos[0].cx - g.nodos[1].cx, g.nodos[0].cy - g.nodos[1].cy);
    assert.ok(d >= g.nodo * (n === 2 ? 1 : 1.0) - 1e-9 || n <= 2, `n=${n}: nodos vecinos se solapan`);
  }
  assert.ok(g.nodo >= 22 && g.nodo <= 34);
  assert.ok(g.centro / 2 + (g.nodo * 1.3) / 2 < R, `n=${n}: el centro tapa los nodos`);   // el panel central no toca el nodo seleccionado
  assert.ok(CEN + R + (g.nodo * 1.3) / 2 <= TAM + 4, `n=${n}: la rueda se sale del contenedor`);
}
// Los cuatro botones de las esquinas no tocan la rueda: el punto más cercano al centro queda más lejos que cualquier nodo.
assert.equal(BOTONES.length, 4);
for (const n of [1, 4, 8, 16, 24]) {
  const g = geometriaRueda(n);
  for (const b of BOTONES) {
    const px = Math.min(Math.max(CEN, b.x), b.x + LADO_BTN), py = Math.min(Math.max(CEN, b.y), b.y + LADO_BTN);
    const d = Math.hypot(px - CEN, py - CEN);
    assert.ok(d >= R + g.nodo / 2 + 2, `n=${n}: el botón ${b.k} toca los círculos (distancia ${d.toFixed(1)})`);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + LADO_BTN <= TAM && b.y + LADO_BTN <= TAM, `el botón ${b.k} se sale del cuadro`);
  }
}
// Cada botón ocupa su propia esquina (arriba/abajo, izquierda/derecha) y la zona táctil crece solo hacia afuera.
assert.deepEqual(BOTONES.map(b => [b.x < TAM / 2, b.y < TAM / 2]), [[true, true], [false, true], [true, false], [false, false]]);
assert.ok(EXT_BTN > 0);
console.log("rueda-geometria: OK");
