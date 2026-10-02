// Dibujos de ejecución (muñeco de palitos) para la rutina Día A / Día B.
//
// Contenido ESTÁTICO: no se guarda en el estado de la app ni en las
// exportaciones (issue #22). Cada ejercicio tiene dos posiciones, inicio y
// final, como strings SVG (viewBox 120x80) que EjercicioPage inyecta tal cual.
// Son strings y no JSX para poder renderizarlos también fuera del navegador
// (vista previa / validación del build).
//
// Convención de color: cuerpo oscuro, músculo que trabaja en naranjo, material
// (mancuerna, barra, banco, máquina) en gris, guías punteadas en gris claro.

export const FIG_VIEWBOX = "0 0 120 80";

const INK = "#222";
const HL = "#e8590c";
const GEAR = "#8a8a8a";
const GUIDE = "#c4c4c4";

// ── primitivas ───────────────────────────────────────────────────────────
const f = (n) => Math.round(n * 10) / 10;
const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${o.c || INK}" stroke-width="${o.w || 2.6}" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.op ? ` opacity="${o.op}"` : ""}/>`;
const dot = (cx, cy, r, fill, op) =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}"${op ? ` opacity="${op}"` : ""}/>`;
const head = (cx, cy) =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`;
const rect = (x, y, w, h, fill, rx = 1.5) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
// flecha de movimiento (línea + punta), de (x1,y1) a (x2,y2)
function arrow(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = 4.6;
  const p1 = [x2 - s * Math.cos(a - 0.5), y2 - s * Math.sin(a - 0.5)];
  const p2 = [x2 - s * Math.cos(a + 0.5), y2 - s * Math.sin(a + 0.5)];
  return (
    line(x1, y1, x2, y2, { c: HL, w: 1.6 }) +
    `<polygon points="${f(x2)},${f(y2)} ${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])}" fill="${HL}"/>`
  );
}
// mancuerna chica (barra horizontal + dos discos) centrada en (x,y)
const dumbbell = (x, y) =>
  line(x - 4, y, x + 4, y, { c: GEAR, w: 1.6 }) +
  rect(x - 5.5, y - 3, 2.6, 6, GEAR, 1) +
  rect(x + 2.9, y - 3, 2.6, 6, GEAR, 1);

// ── elevación lateral (vista de frente) ──────────────────────────────────
// Cuerpo de frente: cabeza, tronco, piernas ligeramente separadas.
function frontalBase() {
  return (
    head(60, 12) +
    line(60, 18.5, 60, 46) + // tronco
    line(50, 23, 70, 23) + // línea de hombros
    line(60, 46, 55, 62) + line(55, 62, 54, 77) + // pierna izquierda
    line(60, 46, 65, 62) + line(65, 62, 66, 77) // pierna derecha
  );
}

const laterales = {
  inicio:
    // brazos a los costados, mancuernas junto a los muslos
    frontalBase() +
    dot(46.5, 24, 4.6, HL, 0.9) + dot(73.5, 24, 4.6, HL, 0.9) + // deltoides lateral
    line(50, 23, 47.5, 35) + line(47.5, 35, 47, 45) +
    line(70, 23, 72.5, 35) + line(72.5, 35, 73, 45) +
    dumbbell(47, 46.5) + dumbbell(73, 46.5),
  final:
    // brazos a la altura del hombro, codo apenas doblado y un poco más alto que la mano
    line(6, 23, 114, 23, { c: GUIDE, w: 1, dash: "2 2.5" }) + // altura del hombro (detrás del cuerpo)
    frontalBase() +
    dot(46.5, 23.5, 4.6, HL, 0.9) + dot(73.5, 23.5, 4.6, HL, 0.9) +
    line(50, 23, 33, 22.2) + line(33, 22.2, 17, 24.6) +
    line(70, 23, 87, 22.2) + line(87, 22.2, 103, 24.6) +
    dumbbell(15.5, 25.4) + dumbbell(104.5, 25.4) +
    arrow(24, 42, 24, 30) + arrow(96, 42, 96, 30),
};

// ── catálogo de dibujos por id de ejercicio ──────────────────────────────
// Ejercicios sin dibujo todavía (o que no tengan uno) se muestran solo con
// texto y mapa de músculos: la UI no depende de que exista.
export const DIBUJOS = {
  "elev-lateral": laterales,
};
