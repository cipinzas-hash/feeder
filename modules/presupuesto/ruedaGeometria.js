// Geometría de la rueda de sobres (pura, con prueba): los centros de los círculos caen EXACTAMENTE sobre la pista.
export const TAM = 300, CEN = 150, R = 126;
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

// Los cuatro botones de las esquinas del cuadro de la rueda (los huecos que deja el círculo): lado y posición del botón visible.
// La zona táctil se extiende 16 px hacia afuera (nunca hacia la rueda) para que siga siendo fácil de tocar cuando la rueda se achica.
export const LADO_BTN = 40, EXT_BTN = 16;
export const BOTONES = [
  { k: "s", em: "✉️", nom: "Por sobre", x: 2, y: 2 },
  { k: "c", em: "🏷️", nom: "Por categoría", x: TAM - LADO_BTN - 2, y: 2 },
  { k: "p", em: "🧾", nom: "Por compra", x: 2, y: TAM - LADO_BTN - 2 },
  { k: "m", em: "📋", nom: "Todos los movimientos", x: TAM - LADO_BTN - 2, y: TAM - LADO_BTN - 2 },
];
