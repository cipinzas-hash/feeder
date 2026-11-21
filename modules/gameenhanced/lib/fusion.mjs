// ─── Fusión del registro de juegos entre dispositivos (puro: lo usan registro.js, sync.js y los tests) ──────────
// El registro vive en Angst-data como `game-enhanced-registro.json`: { v: 1, sembrado, juegos: { id: entrada }, borrados: { id: marca } }.
// Cada entrada trae `actualizado` (ms) y cada borrado, la marca de cuándo se quitó (una «tumba»): sin tumbas, un juego quitado en un
// dispositivo reaparecería al fusionar con otro que aún lo tiene. Por id gana lo más reciente; en un empate gana la entrada (nunca se
// borra por un empate). Las tumbas se olvidan a los 180 días.
export const DIAS_TUMBA = 180;
const DIA = 86400000;
const num = v => (Number.isFinite(v) ? v : 0);

export function fusionarRegistros(a, b, ahora = Date.now()) {
  const ja = (a && a.juegos) || {}, jb = (b && b.juegos) || {}, ba = (a && a.borrados) || {}, bb = (b && b.borrados) || {};
  const ids = new Set([...Object.keys(ja), ...Object.keys(jb), ...Object.keys(ba), ...Object.keys(bb)]);
  const juegos = {}, borrados = {};
  for (const id of [...ids].sort()) {
    const ea = ja[id], eb = jb[id];
    const entrada = ea && eb ? (num(eb.actualizado) > num(ea.actualizado) ? eb : ea) : ea || eb || null;
    const tumba = Math.max(num(ba[id]), num(bb[id]));
    if (entrada && (!tumba || num(entrada.actualizado) >= tumba)) juegos[id] = entrada;
    else if (tumba && ahora - tumba < DIAS_TUMBA * DIA) borrados[id] = tumba;
  }
  const sembrados = [a && a.sembrado, b && b.sembrado].filter(Number.isFinite);
  return { v: 1, sembrado: sembrados.length ? Math.max(...sembrados) : null, juegos, borrados };
}

// Serialización estable (claves ordenadas) para saber si dos registros dicen lo mismo, sin importar el orden de las claves.
export function estable(v) {
  if (Array.isArray(v)) return "[" + v.map(estable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + estable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export const registrosIguales = (a, b) => estable({ s: a.sembrado ?? null, j: a.juegos, b: a.borrados }) === estable({ s: b.sembrado ?? null, j: b.juegos, b: b.borrados });
