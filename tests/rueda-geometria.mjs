// La rueda de sobres: los centros de los círculos caen sobre la pista (circunferencia centrada), sin solaparse entre vecinos.
import assert from "node:assert/strict";
import { geometriaRueda, TAM, CEN, R, RB, X1, BOTONES, RUTA_ESQUINA, POS_EMOJI, RADIO_ESQ, transformEsquina, centroEmoji } from "../modules/presupuesto/ruedaGeometria.js";

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
  assert.ok(CEN + R + (g.nodo * 1.3) / 2 <= TAM, `n=${n}: la rueda se sale del contenedor`);
}
// Los cuatro botones son las piezas de esquina que rellenan lo que deja el círculo: abrazan el círculo sin tocar los círculos de los sobres,
// no se tocan entre sí y, con el círculo, completan el rectángulo (como un control remoto).
assert.equal(BOTONES.length, 4);
assert.deepEqual(BOTONES.map(b => [b.sx, b.sy]), [[1, 1], [-1, 1], [1, -1], [-1, -1]]);                  // una por esquina
assert.equal(TAM, 2 * CEN); assert.ok(RB > CEN && RB < CEN + 8, "el borde cóncavo es casi tangente a los lados");
// el borde cóncavo cae sobre una circunferencia de radio RB centrada en el cuadro (sus dos extremos están a RB del centro)
assert.ok(Math.abs(Math.hypot(X1 - CEN, 0 - CEN) - RB) < 1e-9 && Math.abs(Math.hypot(0 - CEN, X1 - CEN) - RB) < 1e-9, "extremos del arco sobre el círculo");
for (const n of [1, 4, 8, 16, 24]) {
  const g = geometriaRueda(n);
  const maxExt = R + (g.nodo * 1.3) / 2 + 4;                               // el sobre seleccionado (escala 1,3) con su aro
  assert.ok(RB - maxExt >= 8, `n=${n}: las piezas tocan los círculos de los sobres (holgura ${(RB - maxExt).toFixed(1)})`);
}
// las piezas vecinas no se tocan: cada una termina antes del punto medio de los lados y queda un hueco entre sus puntas
assert.ok(CEN - X1 >= 8, "hueco entre piezas vecinas: " + (2 * (CEN - X1)).toFixed(1));
assert.ok(X1 > RADIO_ESQ * 2, "la pieza es más larga que su redondeo");
// el emoji de cada pieza cae dentro de ella: fuera del círculo, dentro del cuadro y lejos de los bordes de corte
for (const b of BOTONES) {
  const c = centroEmoji(b);
  assert.ok(Math.hypot(c.x - CEN, c.y - CEN) >= RB + 12, `el emoji de ${b.k} se mete en el círculo`);
  assert.ok(c.x > 12 && c.x < TAM - 12 && c.y > 12 && c.y < TAM - 12, `el emoji de ${b.k} se sale del cuadro`);
  assert.match(transformEsquina(b), /^translate\(\d+,\d+\) scale\(-?1,-?1\)$/);
}
assert.equal(POS_EMOJI, 34); assert.match(RUTA_ESQUINA, /^M16,0 L[\d.]+,0 A167,167 0 0 0 0,[\d.]+ L0,16 Q0,0 16,0 Z$/);
console.log("rueda-geometria: OK");
