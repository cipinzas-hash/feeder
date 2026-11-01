// Geometría de la rueda de sobres y de sus cuatro botones de esquina (pura, con prueba).
// El cuadro de la rueda mide TAM×TAM. Los círculos de los sobres van sobre una pista de radio R centrada en el cuadro. Las cuatro esquinas
// que deja el círculo son los cuatro botones: piezas que abrazan el círculo (borde cóncavo de radio RB, casi tangente a los lados), sin
// tocarse entre sí, de modo que círculo + botones forman un rectángulo, como un control remoto.
export const TAM = 330, CEN = TAM / 2, R = 126;
export function geometriaRueda(n) {
  const paso = 360 / n;
  const nodo = Math.max(22, Math.min(34, Math.floor((2 * Math.PI * R) / n - 6)));
  const nodos = Array.from({ length: n }, (_, i) => {
    const p = (i * paso * Math.PI) / 180;
    return { i, cx: CEN + R * Math.sin(p), cy: CEN - R * Math.cos(p) };
  });
  const centro = Math.round(2 * (R - (nodo * 1.3) / 2 - 10));
  return { R, paso, nodo, nodos, centro, pista: { left: CEN - R, top: CEN - R, size: 2 * R } };
}

// Esquina «arriba-izquierda» en su propio sistema (0,0 = la esquina del cuadro); las otras tres son sus espejos.
export const RB = CEN + 2;                                           // radio del borde cóncavo (abraza el círculo)
export const X1 = CEN - Math.sqrt(RB * RB - CEN * CEN);              // dónde ese borde llega a los lados del cuadro (queda un hueco con la pieza vecina)
export const RADIO_ESQ = 16;                                         // redondeo de la esquina exterior
export const POS_EMOJI = 34;                                         // dónde va el emoji de la pieza (desde la esquina, en x e y)
export const RUTA_ESQUINA = `M${RADIO_ESQ},0 L${X1.toFixed(2)},0 A${RB},${RB} 0 0 0 0,${X1.toFixed(2)} L0,${RADIO_ESQ} Q0,0 ${RADIO_ESQ},0 Z`;
export const BOTONES = [
  { k: "s", em: "✉️", nom: "Por sobre", sx: 1, sy: 1 },
  { k: "c", em: "🏷️", nom: "Por categoría", sx: -1, sy: 1 },
  { k: "p", em: "🧾", nom: "Por compra", sx: 1, sy: -1 },
  { k: "m", em: "📋", nom: "Todos los movimientos", sx: -1, sy: -1 },
];
export const transformEsquina = b => `translate(${b.sx < 0 ? TAM : 0},${b.sy < 0 ? TAM : 0}) scale(${b.sx},${b.sy})`;
export const centroEmoji = b => ({ x: b.sx > 0 ? POS_EMOJI : TAM - POS_EMOJI, y: b.sy > 0 ? POS_EMOJI : TAM - POS_EMOJI });
