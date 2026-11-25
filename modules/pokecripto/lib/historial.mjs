// Utilidades del historial de precios (lote 1 "precios limpios", 16-nov-2026). Sin dependencias: las usan el bot, la
// página y las pruebas.
//
// Tres ideas:
// 1. CORTES: la unión entre dos fuentes / bases / tcgId distintos no es un movimiento del mercado. `marcarCortes` pone
//    `corte:true` en el snapshot que sigue a una costura GRANDE; gráfico y variaciones no cruzan un corte.
// 2. MERCADO DELGADO: con rango bajo-alto muy ancho el "market" salta ±15 % entre días sin que pase nada. Para esas
//    cartas el gráfico y los deltas usan la mediana móvil de 7 días; el dato crudo no se toca.
// 3. BASE NM: el precio es el Near Mint; si ese día la API no trae NM y venía de NM, se conserva el último NM
//    (hasta 14 días) en vez de caer a Lightly Played, que producía vaivenes entre dos niveles fijos.

export const UMBRAL_CORTE = { ratio: 1.25, abs: 0.10 };   // costura = cambio de ≥25 % y ≥ US$0,10
export const UMBRAL_DELGADO = 1.5;                       // (alto - bajo) / market ≥ 1,5
export const VENTANA_MEDIANA = 7;                        // puntos
export const DIAS_CONSERVAR_NM = 14;

const num = x => (typeof x === "number" && Number.isFinite(x) ? x : null);
const conPrecio = p => !!p && !!p.date && num(p.market) != null && p.market > 0;
const porFecha = (a, b) => String(a.date).localeCompare(String(b.date));
const dias = (a, b) => Math.abs(Date.parse(String(a).slice(0, 10) + "T12:00:00Z") - Date.parse(String(b).slice(0, 10) + "T12:00:00Z")) / 86400000;

// ¿Entre a (anterior) y b (siguiente) hay una costura de datos y no un movimiento de mercado?
// Costura = cambio grande Y (fuente distinta, o base NM/LP distinta, o tcgId distinto). Un snapshot sin `src` cuenta
// como fuente desconocida: sin src → tpl es una costura. Dos sin src seguidos no lo son.
export function esCostura(a, b) {
  const ma = num(a?.market), mb = num(b?.market);
  if (!ma || !mb || ma <= 0) return false;
  const r = mb / ma;
  if (!((r >= UMBRAL_CORTE.ratio || r <= 1 / UMBRAL_CORTE.ratio) && Math.abs(mb - ma) >= UMBRAL_CORTE.abs)) return false;
  const fuente = (a.src || "") !== (b.src || "");
  const base = !!a.base && !!b.base && a.base !== b.base;
  const tid = !!a.tid && !!b.tid && a.tid !== b.tid;
  return fuente || base || tid;
}

// Devuelve el historial con `corte:true` en cada snapshot que sigue a una costura. Idempotente, no quita marcas, no
// cambia el orden ni los demás campos. Si no hay nada que marcar devuelve el MISMO arreglo (comparable con ===).
export function marcarCortes(history) {
  const h = Array.isArray(history) ? history : [];
  if (h.length < 2) return h;
  const idx = h.map((p, i) => ({ p, i })).filter(x => conPrecio(x.p)).sort((x, y) => porFecha(x.p, y.p));
  const marcar = new Set();
  for (let k = 1; k < idx.length; k++) {
    if (!idx[k].p.corte && esCostura(idx[k - 1].p, idx[k].p)) marcar.add(idx[k].i);
  }
  return marcar.size ? h.map((p, i) => (marcar.has(i) ? { ...p, corte: true } : p)) : h;
}
export const contarCortes = history => (Array.isArray(history) ? history : []).filter(p => p && p.corte).length;

// Snapshots con precio, ordenados, desde el último corte (inclusive). Es la parte del historial comparable con el
// precio actual.
export function ultimoSegmento(history) {
  const pts = (Array.isArray(history) ? history : []).filter(conPrecio).sort(porFecha);
  let ini = 0;
  for (let i = 0; i < pts.length; i++) if (pts[i].corte) ini = i;
  return pts.slice(ini);
}

// ¿Hay un corte entre dos snapshots (después de `prev`, hasta `cur` inclusive)?
export function hayCorteEntre(history, prev, cur) {
  if (!prev || !cur) return false;
  return (Array.isArray(history) ? history : []).some(p => p && p.corte && p.date > prev.date && p.date <= cur.date);
}

// Mercado delgado: el último snapshot con bajo y alto tiene un rango ≥ 1,5 veces el market.
export function esMercadoDelgado(history) {
  const pts = (Array.isArray(history) ? history : []).filter(conPrecio).sort(porFecha);
  for (let i = pts.length - 1; i >= 0; i--) {
    const { low, high, market } = pts[i];
    if (num(low) != null && num(high) != null && low > 0 && high >= low) return (high - low) / market >= UMBRAL_DELGADO;
  }
  return false;
}

const mediana = v => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Serie suavizada: cada punto DIARIO pasa a la mediana de los últimos `ventana` puntos diarios del mismo tramo (sin
// cruzar un corte, y a ≤ 10 días de distancia). Los puntos mensuales (agg) y los que no tienen 3 vecinos quedan como
// están. Cada elemento conserva el dato crudo en `crudo` y todos los demás campos.
export function serieSuave(history, ventana = VENTANA_MEDIANA) {
  const pts = (Array.isArray(history) ? history : []).filter(conPrecio).sort(porFecha);
  const out = [];
  let tramo = [];
  for (const p of pts) {
    if (p.corte) tramo = [];
    if (p.agg) { out.push({ ...p, crudo: p.market }); tramo = []; continue; }
    tramo.push(p);
    const cola = tramo.slice(-ventana).filter(q => dias(q.date, p.date) <= 10);
    out.push({ ...p, crudo: p.market, market: cola.length >= 3 ? Math.round(mediana(cola.map(q => q.market)) * 100) / 100 : p.market });
  }
  return out;
}

// Regla de base NM. `m` = {base:"nm"|"lp"} del precio que acaba de traer la API para `carta`. Conserva el último precio
// (no escribe snapshot) si: la API solo trae LP hoy, el último snapshot es de tcgpricelookup y no era LP, y el último
// precio tiene menos de 14 días. Pasado ese plazo se acepta el LP (queda marcado base:"lp" y, si el salto es grande,
// con corte).
export function conservarNM(carta, m, hoyISO, diasMax = DIAS_CONSERVAR_NM) {
  if (!m || m.base !== "lp") return false;
  const pts = (Array.isArray(carta?.priceHistory) ? carta.priceHistory : []).filter(conPrecio).sort(porFecha);
  const ult = pts[pts.length - 1];
  if (!ult || ult.src !== "tpl" || ult.base === "lp") return false;
  const desde = carta.tcgUpdated || ult.date;
  return dias(hoyISO, desde) < diasMax;
}

// Campos extra que se guardan en cada snapshot nuevo para poder explicar un salto después.
export function extrasSnapshot({ tid, variant, base } = {}) {
  const e = {};
  if (tid) e.tid = tid;
  if (variant) e.var = variant;
  if (base) e.base = base;
  return e;
}

// Historial MENSUAL compacto de una fila. Régimen de 3 datos por mes (unificación de Pokécripto, 23-nov-2026): de cada mes se guarda la MEDIA, el MÍNIMO
// y el MÁXIMO del precio de mercado y nada más; solo los últimos días quedan como snapshots diarios.
//   fila.histMes = {m: "YYYY-MM" del primer mes, t: [[media, mínimo, máximo] | null, …]}   (un elemento por mes consecutivo; null = mes sin dato)
// El formato anterior {m, p:[precio, …]} (un precio por mes) se sigue leyendo. Se expande a puntos mensuales (agg) con src "csv-mes" al
// dibujar (market = media, low = mínimo, high = máximo); no se guarda expandido: así 34 meses pesan ~0,6 KB por carta en vez de ~3 KB.
const r2 = x => Math.round(x * 100) / 100;
const mesDe = d => String(d).slice(0, 7);
const sumaMes = (m, k) => { let [y, mo] = m.split("-").map(Number); mo += k; y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12 + 12) % 12 + 1; return `${y}-${String(mo).padStart(2, "0")}`; };
const difMeses = (a, b) => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return (yb - ya) * 12 + (mb - ma); };
const tri = t => (Array.isArray(t) && t.length >= 3 && t[0] != null && t[0] > 0 ? t : null);

export function expandirHistMes(hm) {
  if (!hm || typeof hm.m !== "string") return [];
  const out = [];
  const lista = Array.isArray(hm.t) ? hm.t : Array.isArray(hm.p) ? hm.p : [];
  let [y, mo] = hm.m.split("-").map(Number);
  for (const e of lista.slice(0, 240)) {                      // 20 años: tope defensivo ante datos corruptos
    const f = Array.isArray(hm.t) ? tri(e) : (e != null && e > 0 ? [e, null, null] : null);
    if (f) out.push({ date: `${y}-${String(mo).padStart(2, "0")}-01`, market: f[0], low: f[1], high: f[2], src: "csv-mes", agg: true, n: 1 });
    mo++; if (mo > 12) { mo = 1; y++; }
  }
  return out;
}
// Media, mínimo y máximo de los precios de mercado de UN mes (puntos diarios o ya agregados). null si no hay precio.
export function triMensual(puntos) {
  let n = 0, suma = 0, mn = null, mx = null;
  for (const p of puntos || []) {
    const w = p.agg && p.n > 0 ? p.n : 1, mk = num(p.market);
    if (mk == null || mk <= 0) continue;
    suma += mk * w; n += w;
    const lo = p.agg ? (num(p.low) != null ? p.low : mk) : mk, hi = p.agg ? (num(p.high) != null ? p.high : mk) : mk;
    if (mn == null || lo < mn) mn = lo; if (mx == null || hi > mx) mx = hi;
  }
  return n ? [r2(suma / n), r2(mn), r2(mx)] : null;
}
// Mezcla `nuevo` (un histMes) dentro de `base`: para cada mes gana `base` salvo que le falte (o `pisar` sea true).
export function mezclarHistMes(base, nuevo, pisar = false) {
  const a = base && typeof base.m === "string" ? { m: base.m, t: expandirATri(base) } : null, b = nuevo && typeof nuevo.m === "string" ? { m: nuevo.m, t: expandirATri(nuevo) } : null;
  if (!a) return b; if (!b) return a;
  const ini = difMeses(a.m, b.m) < 0 ? b.m : a.m;
  const fin = [sumaMes(a.m, a.t.length - 1), sumaMes(b.m, b.t.length - 1)].sort().pop();
  const largo = difMeses(ini, fin) + 1, t = [];
  for (let i = 0; i < largo; i++) {
    const m = sumaMes(ini, i), ia = difMeses(a.m, m), ib = difMeses(b.m, m);
    const ea = ia >= 0 ? tri(a.t[ia]) : null, eb = ib >= 0 ? tri(b.t[ib]) : null;
    t.push(pisar ? (eb || ea) : (ea || eb));
  }
  while (t.length && !t[t.length - 1]) t.pop();
  return t.length ? { m: ini, t } : null;
}
function expandirATri(hm) { return Array.isArray(hm.t) ? hm.t : (Array.isArray(hm.p) ? hm.p.map(x => (x != null && x > 0 ? [x, x, x] : null)) : []); }

// PLIEGUE (lo corre el bot cada día, idempotente): los snapshots diarios de meses CERRADOS, y los puntos mensuales agg heredados del compactador
// anterior, salen de priceHistory y pasan a fila.histMes como [media, mínimo, máximo]. Se quedan como snapshots el mes en curso y los últimos
// `diasDiarios` días (el corte cae siempre en un inicio de mes, así cada mes se pliega completo). Los meses que ya tiene histMes (archivo de
// tcgcsv) se respetan; solo se rellenan los que faltan. Devuelve LA MISMA fila si no hay nada que plegar.
export function plegarMeses(fila, hoyISO, diasDiarios = 30) {
  const h = Array.isArray(fila && fila.priceHistory) ? fila.priceHistory : [];
  if (h.length < 2) return fila;
  const d = new Date(hoyISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - diasDiarios);
  const corte = mesDe(d.toISOString().slice(0, 10)) + "-01";           // inicio del mes que contiene (hoy − diasDiarios)
  const ult = [...h].filter(p => p && p.date).sort(porFecha).pop();
  const viejos = h.filter(p => p && p.date && p.date < corte && p !== ult);
  if (!viejos.length) return fila;
  const porMes = new Map();
  for (const p of viejos) { const m = mesDe(p.date); if (!porMes.has(m)) porMes.set(m, []); porMes.get(m).push(p); }
  const meses = [...porMes.keys()].sort();
  const t = Array.from({ length: difMeses(meses[0], meses[meses.length - 1]) + 1 }, () => null);
  for (const m of meses) t[difMeses(meses[0], m)] = triMensual(porMes.get(m));
  const propio = t.some(Boolean) ? { m: meses[0], t } : null;
  const histMes = mezclarHistMes(fila.histMes, propio);
  const quedan = h.filter(p => !viejos.includes(p));
  const nuevo = { ...fila, priceHistory: quedan };
  if (histMes) nuevo.histMes = histMes;
  return nuevo;
}
// priceHistory de la fila con los meses anteriores delante y las costuras marcadas. Si la fila no tiene histMes devuelve su priceHistory tal cual.
export function historialConMensual(fila) {
  const h = (fila && Array.isArray(fila.priceHistory)) ? fila.priceHistory : [];
  const pre = expandirHistMes(fila && fila.histMes);
  if (!pre.length) return h;
  const primero = h.filter(x => x && x.date && x.market > 0).map(x => x.date).sort()[0] || "9999-12-31";
  return marcarCortes([...pre.filter(x => x.date.slice(0, 7) < primero.slice(0, 7)), ...h]);
}
