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

// ── figuras de perfil (miran hacia la derecha) ───────────────────────────
// Las articulaciones se resuelven por cinemática inversa con los largos reales
// de arriba: se define dónde están hombro/cadera y dónde van manos y pies, y el
// codo/rodilla se calculan. `flip` elige hacia qué lado se dobla la articulación
// (+1 = a la derecha del sentido raíz→extremo, -1 = a la izquierda; en pantalla
// con y hacia abajo, un miembro que apunta hacia abajo se dobla hacia atrás con +1).
const TORSO = HIP_Y - SH_Y;
const CAB = 8.4; // hombro → centro de la cabeza
const GRIP = LEN.mano * 0.5; // muñeca → centro del agarre
const gear = (x1, y1, x2, y2, w = 2) => line(x1, y1, x2, y2, { c: GEAR, w });
const rectG = (x, y, w, h) => rect(x, y, w, h, GEAR, 1);
const unit = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

function ik(a, t, l1, l2, flip) {
  const dx = t[0] - a[0], dy = t[1] - a[1];
  const d0 = Math.hypot(dx, dy) || 1;
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 0.05), (l1 + l2) * 0.999);
  const ux = dx / d0, uy = dy / d0;
  const aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa));
  return {
    mid: [a[0] + ux * aa - flip * uy * h, a[1] + uy * aa + flip * ux * h],
    end: [a[0] + ux * d, a[1] + uy * d],
  };
}
// cuerpo: tronco, cuello y cabeza. headC fija el centro de la cabeza; si no, sigue la línea del tronco.
function cuerpo(sh, hip, headC) {
  const c = headC || add(sh, unit(hip, sh), CAB);
  const n = unit(sh, c);
  return line(hip[0], hip[1], sh[0], sh[1]) + line(sh[0], sh[1], ...add(sh, n, CAB - 4.7)) + head(c[0], c[1]);
}
// brazo de hombro a muñeca (el agarre queda GRIP más allá, en la dirección del antebrazo)
function brazo(sh, wr, flip, extra = "") {
  const { mid, end } = ik(sh, wr, LEN.brazo, LEN.antebrazo, flip);
  return { svg: line(sh[0], sh[1], mid[0], mid[1]) + line(mid[0], mid[1], end[0], end[1]) + extra, codo: mid, muneca: end,
           grip: add(end, unit(mid, end), GRIP) };
}
function pierna(hip, ankle, flip, dir = 1) {
  const { mid, end } = ik(hip, ankle, LEN.muslo, LEN.pierna, flip);
  const huesos = line(hip[0], hip[1], mid[0], mid[1]) + line(mid[0], mid[1], end[0], end[1]);
  return { svg: huesos + (dir ? pie(end, dir) : ""), rodilla: mid, tobillo: end };
}
// pie plano en el piso mirando a la derecha (dir=1) o a la izquierda (dir=-1)
const pie = (a, dir = 1) => line(a[0] - dir * 3, a[1] + 2.4, a[0] + dir * 7.9, a[1] + 2.4);
// pie sobre una superficie inclinada: `td` = dirección unitaria de los dedos
const pieDir = (a, td) => { const n = [-td[1], td[0]]; const b = add(a, n, 2.4); return line(...add(b, td, -3), ...add(b, td, 7.9)); };
const musculo = (p, r = 4, op = 0.9) => dot(p[0], p[1], r, HL, op);
const placa = (x, y, r = 7) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#f2f2f2" stroke="${GEAR}" stroke-width="1.6"/>` + dot(x, y, 1.3, GEAR);
const banco = (x1, x2, top) => rectG(x1, top, x2 - x1, 3.2) + rectG(x1 + 3, top + 3.2, 2.2, PISO - top - 3.2) + rectG(x2 - 5.2, top + 3.2, 2.2, PISO - top - 3.2);
const kettlebell = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="4.4" fill="${GEAR}"/>` + `<path d="M ${f(x - 2.6)} ${f(y - 3.6)} Q ${f(x)} ${f(y - 10.2)} ${f(x + 2.6)} ${f(y - 3.6)}" fill="none" stroke="${GEAR}" stroke-width="1.8" stroke-linecap="round"/>`;
const suelo = () => line(6, PISO, 114, PISO, { c: GUIDE, w: 0.8 });

// ── press banca (Día A y Día B) ──────────────────────────────────────────
const bancaPress = (() => {
  const TOP = yAlt(0.245);
  const sh = [32, TOP - 4.3], hip = [52.7, TOP - 4.3], headC = [23.6, TOP - 4.7];
  const base = (barra) => suelo() + banco(14, 66, TOP) + barra;
  const pies = pierna(hip, [58.5, 74.2], -1);
  const fig = (wr) => { const a = brazo(sh, wr, 1); return { a }; };
  const ini = (() => { const a = brazo(sh, [32, 31.4], 1);
    return base(placa(32, 28.6)) + cuerpo(sh, hip, headC) + pies.svg + a.svg + musculo([38, sh[1] - 3.4], 4.2); })();
  const fin = (() => { const a = brazo(sh, [40, 52.4], 1);
    return base(placa(40, 49.6)) + cuerpo(sh, hip, headC) + pies.svg + a.svg + musculo([38, sh[1] - 3.4], 4.2) + arrow(56, 33, 56, 46); })();
  return { inicio: ini, final: fin };
})();

// ── dominadas asistidas (máquina de rodillas) ────────────────────────────
const dominadas = (() => {
  const BAR = [60, 12];
  const maquina = (padTop) => rectG(94, 3, 4, 72) + gear(94, padTop + 1, 70, padTop + 1, 2) + rect(44, padTop, 28, 2.4, "#6b6b6b", 1.2);
  const cuerpoKneel = (sh, hip, headC, wr, flipArm) => {
    const a = brazo(sh, wr, flipArm);
    const knee = add(hip, [0.28, 0.96], LEN.muslo);
    const ankle = [knee[0] - LEN.pierna * 0.98, knee[1] - 1.2];
    const pad = knee[1] + 1.2;
    return { pad, svg: maquina(pad) + a.svg + cuerpo(sh, hip, headC) + line(hip[0], hip[1], knee[0], knee[1]) + line(knee[0], knee[1], ankle[0], ankle[1]) + line(ankle[0], ankle[1], ankle[0] - 6.5, ankle[1] + 0.8) };
  };
  const barra = dot(BAR[0], BAR[1], 2.2, GEAR);
  const ini = (() => { const sh = [60.5, 38.8], hip = [62.5, 59.2];
    const k = cuerpoKneel(sh, hip, [61.6, 30.5], [60, 15.5], 1);
    return k.svg + barra + musculo([sh[0] - 3.2, sh[1] + 5.5], 4.2); })();
  const fin = (() => { const sh = [52, 19.5], hip = [53.5, 40.0];
    const k = cuerpoKneel(sh, hip, [55.3, 10.8], [60, 15.5], 1);
    return k.svg + barra + musculo([sh[0] - 3.2, sh[1] + 5.5], 4.2) + arrow(80, 56, 80, 34); })();
  return { inicio: ini, final: fin };
})();

// ── peso muerto rumano (barra) ───────────────────────────────────────────
const rumano = (() => {
  const ankle = [60, 74.2];
  const ini = (() => { const sh = [60.4, SH_Y], hip = [60.0, HIP_Y];
    const a = brazo(sh, [63.4, 41.6], 1); const p = pierna(hip, ankle, -1);
    return suelo() + placa(a.grip[0] + 1.2, a.grip[1] + 0.5) + cuerpo(sh, hip) + p.svg + a.svg + musculo([hip[0] - 3.2, hip[1] + 1], 4.4); })();
  const fin = (() => { const hip = [46, 44.5], dir = [Math.sin(50 * Math.PI / 180), -Math.cos(50 * Math.PI / 180)];
    const sh = add(hip, dir, TORSO); const wr = [sh[0] + 0.8, sh[1] + 22.4];
    const a = brazo(sh, wr, 1); const p = pierna(hip, ankle, -1);
    return suelo() + placa(a.grip[0] + 1.6, a.grip[1] + 0.5) + cuerpo(sh, hip) + p.svg + a.svg + musculo([hip[0] - 3, hip[1] + 0.5], 4.6) + musculo(add(hip, unit(hip, p.rodilla), 8.6), 3.3, 0.8) + arrow(90, 40, 90, 58); })();
  return { inicio: ini, final: fin };
})();

// ── prensa de piernas (45°) ──────────────────────────────────────────────
const prensa = (() => {
  const hip = [40, 64], t = [-0.707, -0.707], r = [0.707, -0.707], n = [0.707, 0.707];
  const sh = add(hip, t, TORSO), headC = add(sh, t, CAB);
  const estructura = () => {
    const back = [-0.707, 0.707];
    const a = add(hip, back, 4.6), b = add(headC, back, 4.6);
    return gear(a[0], a[1], b[0] - 3, b[1] - 3, 4.5) + gear(hip[0] - 5, hip[1] + 4.8, hip[0] + 10, hip[1] + 4.8, 3) +
      gear(...add(hip, n, 12).map(f), ...add(add(hip, n, 12), r, 52).map(f), 1.6);
  };
  const frame = (dist, ang, extra = "") => {
    const d = [Math.cos(ang * Math.PI / 180), Math.sin(ang * Math.PI / 180)];
    const ankle = add(hip, d, dist);
    const p = pierna(hip, ankle, -1, 0);
    const sole = add(ankle, r, 3.2);
    const plate = line(...add(sole, n, 13), ...add(sole, n, -13), { c: GEAR, w: 3.4 });
    const a = brazo(sh, add(hip, [0.1, -0.9], 7), 1);
    const foot = line(...add(ankle, r, 2.2), ...add(add(ankle, r, 2.2), [-0.707, -0.707], 8));
    return estructura() + plate + cuerpo(sh, hip, headC) + p.svg + foot + a.svg +
      musculo(add(hip, unit(hip, p.rodilla), 8.8), 4.6) + musculo([hip[0] - 3.4, hip[1] + 1.6], 4.2, 0.8) + extra;
  };
  const esc = (svg) => `<g transform="translate(-6 -12) scale(1.18)">${svg}</g>`;
  return { inicio: esc(frame(25, -35)), final: esc(frame(34.2, -45, arrow(62, 62, 74, 50))) };
})();

// ── dips asistidos (máquina de rodillas) ─────────────────────────────────
const dips = (() => {
  const barras = gear(44, 44, 80, 44, 2.6) + rectG(46, 44, 2.2, 33) + rectG(77, 44, 2.2, 33);
  const maquina = (padTop) => rectG(94, 3, 4, 72) + gear(94, padTop + 1, 70, padTop + 1, 2) + rect(44, padTop, 28, 2.4, "#6b6b6b", 1.2);
  const cuerpoKneel = (sh, hip, headC, wr) => {
    const a = brazo(sh, wr, 1);
    const knee = add(hip, [0.1, 0.99], LEN.muslo);
    const ankle = [knee[0] - LEN.pierna * 0.98, knee[1] - 1.2];
    const pad = knee[1] + 1.2;
    return maquina(pad) + barras + a.svg + cuerpo(sh, hip, headC) + line(hip[0], hip[1], knee[0], knee[1]) + line(knee[0], knee[1], ankle[0], ankle[1]) + line(ankle[0], ankle[1], ankle[0] - 6.5, ankle[1] + 0.8) + musculo(add(sh, unit(sh, a.codo), LEN.brazo * 0.5), 3.8);
  };
  const ini = cuerpoKneel([62, 20.5], [55, 40.0], [65.2, 12.7], [62.5, 44]);
  const fin = cuerpoKneel([60.5, 30.5], [53.5, 50.0], [63.7, 22.7], [62.5, 44]) + arrow(34, 26, 34, 40);
  return { inicio: ini, final: fin };
})();

// ── remo en polea sentado ────────────────────────────────────────────────
const remo = (() => {
  const hip = [34, 62.2];
  const maq = rectG(84, 8, 4, 69) + rectG(70, 52, 2.4, 25) + rectG(24, 66.5, 22, 2.6) + rectG(26, 69, 2.2, 8) + rectG(42, 69, 2.2, 8) + dot(86, 55, 2.6, GEAR);
  const legs = pierna(hip, [66, 68.6], -1);
  const frame = (lean, wr, extra = "") => {
    const sh = [hip[0] + Math.sin(lean * Math.PI / 180) * TORSO, hip[1] - Math.cos(lean * Math.PI / 180) * TORSO];
    const a = brazo(sh, wr, 1);
    return suelo() + maq + legs.svg + cuerpo(sh, hip) + a.svg + gear(86, 55, a.grip[0], a.grip[1], 1.2) + dot(a.grip[0], a.grip[1], 1.8, GEAR) +
      musculo([sh[0] - 3.4, sh[1] + 5.6], 4.4) + extra;
  };
  return { inicio: frame(16, [60.6, 45.4]), final: frame(-5, [41, 54.4], arrow(78, 47, 68, 47)) };
})();

// ── hip thrust con 2 kettlebells ─────────────────────────────────────────
const hipThrust = (() => {
  const TOP = yAlt(0.245);
  const bn = banco(10, 38, TOP);
  const frame = (hip, sh, ankle, extra = "") => {
    const headC = [sh[0] - 8.1, sh[1] - 1.8];
    const p = pierna(hip, ankle, -1);
    const kb = [hip[0] + 1.2, hip[1] - 8.6];
    const a = brazo(sh, [kb[0] - 1, kb[1] - 1.6], -1);
    return suelo() + bn + cuerpo(sh, hip, headC) + p.svg + kettlebell(kb[0], kb[1]) + a.svg +
      musculo([hip[0] - 1.2, hip[1] + 3.6], 4.8) + musculo(add(hip, unit(hip, p.rodilla), 6.5), 3.2, 0.8) + extra;
  };
  return {
    inicio: frame([48.3, 70.4], [34, 55.6], [63, 74.2]),
    final: frame([54.7, 56.2], [34, 56.4], [72.1, 74.2], arrow(66, 70, 66, 60)),
  };
})();

// ── extensión de tríceps en polea alta ───────────────────────────────────
const triceps = (() => {
  const hip = [47, HIP_Y], sh = [51.3, SH_Y + 0.5];
  const maq = rectG(84, 2, 4, 75) + rectG(80, 2, 8, 3) + `<circle cx="81.5" cy="7" r="2.6" fill="${GEAR}"/>`;
  const legs = pierna(hip, [50, 74.2], -1);
  const frame = (wr, extra = "") => {
    const el = [50.6, sh[1] + LEN.brazo];
    const dir = unit(el, wr), muneca = add(el, dir, LEN.antebrazo), mano = add(muneca, dir, GRIP);
    const arm = line(sh[0], sh[1], el[0], el[1]) + line(el[0], el[1], muneca[0], muneca[1]);
    const cuerda = line(mano[0] - 1.6, mano[1] - 1.6, mano[0] + 1.6, mano[1] + 1.6, { c: GEAR, w: 2 });
    return suelo() + maq + legs.svg + cuerpo(sh, hip) + arm + gear(81.5, 7, mano[0], mano[1], 1.2) + cuerda +
      musculo([(sh[0] + el[0]) / 2 - 3.2, (sh[1] + el[1]) / 2], 3.9) + extra;
  };
  return { inicio: frame([61, 31.6]), final: frame([52.6, 44.4], arrow(64, 35, 64, 46)) };
})();

// ── extensión de cuádriceps (máquina sentado) ────────────────────────────
const extCuad = (() => {
  const hip = [40, 55], sh = [37.1, 34.6];
  const maq = rectG(30, 60.2, 24, 2.8) + rectG(32, 63, 3, 14) + rectG(46, 63, 3, 14) + rectG(28, 31, 3.2, 29);
  const knee = [hip[0] + LEN.muslo, hip[1] + 0.5];
  const frame = (angDeg, extra = "") => {
    const d = [Math.cos(angDeg * Math.PI / 180), Math.sin(angDeg * Math.PI / 180)];
    const ankle = add(knee, d, LEN.pierna);
    const rod = add(knee, d, LEN.pierna * 0.86);
    const a = brazo(sh, [hip[0] + 5.5, hip[1] + 0.5], 1);
    return suelo() + maq + cuerpo(sh, hip) + a.svg + line(hip[0], hip[1], knee[0], knee[1]) + line(knee[0], knee[1], ankle[0], ankle[1]) +
      line(ankle[0], ankle[1] + 0.2, ankle[0] + 5.5, ankle[1] + 0.2) + gear(knee[0] - 2.5, knee[1] + 2.4, rod[0], rod[1], 1.8) + dot(rod[0], rod[1], 2.7, GEAR) +
      musculo([hip[0] + 8.8, hip[1] - 3.2], 5) + extra;
  };
  return { inicio: frame(88, 0), final: frame(-10, arrow(70, 66, 76, 54)) };
})();

// ── elevación de piernas en banco ────────────────────────────────────────
const elevPiernas = (() => {
  const TOP = yAlt(0.245);
  const sh = [36, TOP - 4.3], hip = [56.7, TOP - 4.3], headC = [27.6, TOP - 4.7];
  const bn = banco(12, 68, TOP);
  const arms = () => { const a = brazo(sh, [13.5, TOP - 3.2], -1); return a.svg; };
  const base = () => suelo() + bn + cuerpo(sh, hip, headC) + arms() + musculo([hip[0] - 5.2, hip[1] - 3.4], 4.2);
  const legAt = (deg) => { const d = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
    const kn = add(hip, d, LEN.muslo), an = add(kn, d, LEN.pierna);
    return line(hip[0], hip[1], kn[0], kn[1]) + line(kn[0], kn[1], an[0], an[1]) + line(an[0], an[1], ...add(an, [-d[1], d[0]], -7.5)); };
  return { inicio: base() + legAt(4), final: base() + legAt(-90) + arrow(70, 50, 70, 30) };
})();

// ── catálogo de dibujos por id de ejercicio ──────────────────────────────
// Ejercicios sin dibujo todavía (o que no tengan uno) se muestran solo con
// texto y mapa de músculos: la UI no depende de que exista.
export const DIBUJOS = {
  "elev-lateral": laterales,
  "press-banca": bancaPress,
  "press-banca-b": bancaPress,
  "dominadas": dominadas,
  "peso-muerto-rumano": rumano,
  "prensa": prensa,
  "dip-asistido": dips,
  "remo-polea": remo,
  "hip-thrust-kb": hipThrust,
  "ext-triceps": triceps,
  "ext-cuadriceps": extCuad,
  "elev-piernas-banco": elevPiernas,
};
