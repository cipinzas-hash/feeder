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

// ── proporciones reales ──────────────────────────────────────────────────
// Todos los dibujos usan estas medidas (antropometría estándar, fracciones de la
// estatura H; Drillis & Contini). Los dibujos nuevos se construyen con estos
// helpers para que ninguna extremidad quede desproporcionada.
//   cabeza 0.13H · hombros a 0.818H del piso · cadera a 0.53H · rodilla a 0.285H
//   ancho de hombros 0.26H · brazo 0.186H · antebrazo 0.146H · mano 0.108H
//   muslo 0.245H · pierna 0.246H
const H = 72; // estatura en unidades del viewBox (pies en y=77, coronilla en y=5)
const PISO = 77;
const yAlt = (frac) => PISO - frac * H;
const LEN = { brazo: 0.186 * H, antebrazo: 0.146 * H, mano: 0.108 * H, muslo: 0.245 * H, pierna: 0.246 * H };
const SH_Y = yAlt(0.818), HIP_Y = yAlt(0.53);
const SH_DX = (0.26 * H) / 2; // medio ancho de hombros
const HIP_DX = 3.6;           // media separación de las articulaciones de cadera
// punto a `len` desde (x,y), con `deg` medido desde "hacia abajo" (0°) hacia afuera
// (90° = horizontal); lado -1 = izquierda del dibujo, +1 = derecha.
const polar = (x, y, side, deg, len) => {
  const r = (deg * Math.PI) / 180;
  return [x + side * Math.sin(r) * len, y + Math.cos(r) * len];
};
// disco de mancuerna visto de frente (el eje apunta hacia delante, así que se ve de canto como círculo)
const discoMancuerna = (x, y) => dot(x, y, 2.9, GEAR) + dot(x, y, 1.1, "#fff", 0.9);

// figura de frente: cabeza, cuello, tronco, pelvis y piernas (de pie, pies a ancho de cadera)
function frontalBase() {
  const chinY = 5 + 0.13 * H;
  let out = head(60, 5 + 0.065 * H);
  out += line(60, chinY, 60, SH_Y); // cuello
  out += line(60 - SH_DX, SH_Y, 60 + SH_DX, SH_Y); // hombros
  out += line(60, SH_Y, 60, HIP_Y); // tronco
  out += line(60 - HIP_DX, HIP_Y, 60 + HIP_DX, HIP_Y, { w: 2.2 }); // pelvis
  for (const side of [-1, 1]) {
    const hx = 60 + side * HIP_DX;
    const knee = [hx + side * 0.8, HIP_Y + LEN.muslo];
    const ankle = [hx + side * 2.2, HIP_Y + LEN.muslo + LEN.pierna];
    out += line(hx, HIP_Y, knee[0], knee[1]) + line(knee[0], knee[1], ankle[0], ankle[1]);
    out += line(ankle[0], PISO - 1.2, ankle[0] + side * 4.2, PISO - 1.2); // pie
  }
  return out + line(26, PISO, 94, PISO, { c: GUIDE, w: 0.8 }); // piso
}

// brazo de frente: `ab` = abducción del brazo (0° colgando, 90° horizontal), `ab2` = dirección del antebrazo.
// Devuelve el trazo y el punto de la mano (para la mancuerna).
function brazoFrontal(side, ab, ab2) {
  const sx = 60 + side * SH_DX;
  const [ex, ey] = polar(sx, SH_Y, side, ab, LEN.brazo);
  const [wx, wy] = polar(ex, ey, side, ab2, LEN.antebrazo * 0.97); // el antebrazo se acorta un poco por la flexión hacia delante
  const [hx, hy] = polar(wx, wy, side, ab2, LEN.mano * 0.5);
  return { svg: line(sx, SH_Y, ex, ey) + line(ex, ey, wx, wy), mano: [hx, hy], hombro: [sx, SH_Y] };
}

const laterales = (() => {
  const deltoide = (sx, side) => dot(sx + side * 2.4, SH_Y + 1.4, 3.9, HL, 0.9);
  // inicio: brazos colgando apenas separados del cuerpo, mancuernas junto a los muslos
  let ini = frontalBase();
  // final: brazos a la altura del hombro, codo apenas más alto que la mano
  let fin = line(8, SH_Y, 112, SH_Y, { c: GUIDE, w: 1, dash: "2 2.5" }) + frontalBase();
  for (const side of [-1, 1]) {
    const a0 = brazoFrontal(side, 7, 4);
    ini += deltoide(a0.hombro[0], side) + a0.svg + discoMancuerna(a0.mano[0], a0.mano[1]);
    const a1 = brazoFrontal(side, 92, 82);
    fin += deltoide(a1.hombro[0], side) + a1.svg + discoMancuerna(a1.mano[0], a1.mano[1]);
    fin += arrow(a1.mano[0] + side * -1, a1.mano[1] + 17, a1.mano[0] + side * -1, a1.mano[1] + 6);
  }
  return { inicio: ini, final: fin };
})();

// ── catálogo de dibujos por id de ejercicio ──────────────────────────────
// Ejercicios sin dibujo todavía (o que no tengan uno) se muestran solo con
// texto y mapa de músculos: la UI no depende de que exista.
export const DIBUJOS = {
  "elev-lateral": laterales,
};
