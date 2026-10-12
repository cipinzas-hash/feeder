// Utilidades puras de episodios (sin React, sin DOM) -- las usan tanto el
// cliente (modules/vitrina) como el script de Actions (build-simkl.mjs),
// así el formato guardado en Angst-data no puede divergir entre los dos.
//
// Formato compacto de "episodios vistos" por serie: { "1": "1-13", "2": "1-9,11" }
// (temporada -> rangos de episodios). Una serie de 300+ episodios ocupa
// unos pocos cientos de bytes en vez de una lista de timestamps.

export const keyEp = (t, e) => `${t}-${e}`;

export function encodeRangos(nums) {
  const a = [...new Set(nums.map(Number).filter(n => Number.isInteger(n) && n > 0))].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < a.length; ) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`);
    i = j + 1;
  }
  return out.join(",");
}

export function decodeRangos(str) {
  const out = [];
  for (const part of String(str || "").split(",")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let n = a; n <= b; n++) out.push(n);
  }
  return out;
}

// { "1": "1-3" } -> Set("1-1","1-2","1-3")
export function epMapToSet(epMap) {
  const set = new Set();
  for (const [t, rangos] of Object.entries(epMap || {})) {
    for (const e of decodeRangos(rangos)) set.add(keyEp(t, e));
  }
  return set;
}

// Set de "t-e" -> { "1": "1-3" }
export function setToEpMap(set) {
  const porTemporada = {};
  for (const k of set) {
    const [t, e] = k.split("-");
    (porTemporada[t] ||= []).push(Number(e));
  }
  const out = {};
  for (const t of Object.keys(porTemporada).sort((a, b) => a - b)) out[t] = encodeRangos(porTemporada[t]);
  return out;
}

// "S28E05" -> { t: 28, e: 5 }  (así devuelve Simkl last_watched / next_to_watch)
export function parseSxxExx(s) {
  const m = /^S(\d+)E(\d+)$/i.exec(String(s || ""));
  return m ? { t: Number(m[1]), e: Number(m[2]) } : null;
}

// Operaciones sobre episodios: { marcar: [[t,e],...], desmarcar: [[t,e],...] }.
// Al combinar dos tandas gana la más nueva (b) episodio por episodio:
// marcar y después desmarcar el mismo episodio termina en "desmarcar".
export function mergeEpisodeOps(a, b) {
  const estado = new Map(); // "t-e" -> true (marcar) | false (desmarcar)
  for (const ops of [a, b]) {
    for (const [t, e] of ops?.marcar || []) estado.set(keyEp(t, e), true);
    for (const [t, e] of ops?.desmarcar || []) estado.set(keyEp(t, e), false);
  }
  const marcar = [], desmarcar = [];
  for (const [k, v] of estado) {
    const [t, e] = k.split("-").map(Number);
    (v ? marcar : desmarcar).push([t, e]);
  }
  return { marcar, desmarcar };
}

export function opsVacias(ops) {
  return !(ops?.marcar?.length || ops?.desmarcar?.length);
}

// Aplica operaciones a un Set de "t-e" y devuelve un Set nuevo.
export function applyOps(set, ops) {
  const out = new Set(set);
  for (const [t, e] of ops?.marcar || []) out.add(keyEp(t, e));
  for (const [t, e] of ops?.desmarcar || []) out.delete(keyEp(t, e));
  return out;
}

// Agrupa [[t,e],...] por temporada para el payload de Simkl:
// [{ number: 1, episodes: [{number: 1}, ...] }]
export function agruparPorTemporada(pares) {
  const porT = new Map();
  for (const [t, e] of pares) {
    if (!porT.has(t)) porT.set(t, []);
    porT.get(t).push(e);
  }
  return [...porT.entries()].sort((a, b) => a[0] - b[0]).map(([t, es]) => ({
    number: t,
    episodes: [...new Set(es)].sort((x, y) => x - y).map(n => ({ number: n })),
  }));
}

// Vista lista para pintar de UNA serie a partir de su entrada en
// series-episodios.json.
//   entry:       { temporadas: [{ n, eps: [[numero, nombre, fecha], ...] }], ep: { "1": "1-13" }, ... }
//   overlayShow: marcas locales todavía no reflejadas por Simkl: { "t-e": { v: bool, ts } }
//   hoyISO:      "YYYY-MM-DD" -- un episodio cuenta como emitido si su fecha es <= hoy
// "pendientes" = emitidos y no vistos (los que todavía no salieron no cuentan).
export function armarVista(entry, overlayShow, hoyISO) {
  const vistos = epMapToSet(entry.ep);
  for (const [k, o] of Object.entries(overlayShow || {})) {
    if (o && o.v) vistos.add(k); else vistos.delete(k);
  }
  let total = 0, emitidos = 0, vistosCount = 0, pendientes = 0;
  let siguiente = null, proximo = null;
  const temporadas = [...(entry.temporadas || [])].sort((a, b) => a.n - b.n).map(t => {
    const eps = t.eps.map(([e, nombre, fecha]) => {
      const visto = vistos.has(keyEp(t.n, e));
      const emitido = !!fecha && fecha <= hoyISO;
      total++;
      if (emitido) emitidos++;
      if (visto) vistosCount++;
      if (emitido && !visto) {
        pendientes++;
        if (!siguiente) siguiente = { t: t.n, e, nombre, fecha };
      }
      if (!emitido && !proximo) proximo = { t: t.n, e, nombre, fecha };
      return { e, nombre, fecha, visto, emitido };
    });
    return {
      n: t.n,
      eps,
      total: eps.length,
      vistos: eps.filter(x => x.visto).length,
      pendientes: eps.filter(x => x.emitido && !x.visto).length,
    };
  });
  return { temporadas, total, emitidos, vistos: vistosCount, pendientes, siguiente, proximo };
}
