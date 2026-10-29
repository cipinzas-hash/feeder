// Memoria de compras: lo que se compró de verdad, para sugerirlo al escribir en el carro y evitar duplicados que son lo mismo con
// dos nombres (Manzana / Manzanas, Plátano / Platano). Es un dato propio del planner (campo `comprasMemoria`, viaja en el respaldo):
// borrar un ítem de la lista con la × no la afecta.
//   { v: 1, items: { [clave]: { n: nombre, cat, p: último precio unitario, pp: [últimos precios], veces, ult: «AAAA-MM-DD», alias: [otros nombres] } } }
// El precio recordado es solo REFERENCIA: en el mundo real varía de semana a semana, así que al comprar se confirma el de hoy.
const sinTildes = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Mismo producto aunque cambien mayúsculas, tildes, signos o plural.
// Plural simple en español: «es» solo si lo que queda termina en l, n, r, d, z o j (papeles, limones, yogures); si no, solo la «s» (leches, tomates).
function singular(w) {
  if (w.length <= 3) return w;
  if (w.length > 4 && /es$/.test(w) && /[lnrdzj]$/.test(w.slice(0, -2))) return w.slice(0, -2);
  return /s$/.test(w) ? w.slice(0, -1) : w;
}
export function claveNombre(nombre) {
  return sinTildes(nombre).replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map(singular).join(" ");
}
export const memoriaVacia = () => ({ v: 1, items: {} });
export const tieneMemoria = m => !!(m && typeof m === "object" && m.items && typeof m.items === "object");

function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// Arma la memoria con lo ya comprado en las listas de todos los días (se hace una sola vez, al no existir aún). No toca las listas.
export function memoriaDesdeHistorial(dayData) {
  const grupos = new Map();
  Object.keys(dayData || {}).sort().forEach(dia => {
    ((dayData[dia] && dayData[dia].compras) || []).forEach(it => {
      if (!it || !it.done) return;
      const nombre = String(it.text || "").trim();
      const k = claveNombre(nombre);
      if (!k) return;
      let g = grupos.get(k);
      if (!g) { g = { nombres: new Map(), veces: 0, ult: "", cat: "", precios: [] }; grupos.set(k, g); }
      g.nombres.set(nombre, (g.nombres.get(nombre) || 0) + 1);
      g.veces++; g.ult = dia;
      if (it.categoria) g.cat = it.categoria;
      if (Number(it.precio) > 0) g.precios.push(Number(it.precio));
    });
  });
  const items = {};
  grupos.forEach((g, k) => {
    const nombres = [...g.nombres.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    items[k] = { n: nombres[0][0], cat: g.cat, p: g.precios.length ? g.precios[g.precios.length - 1] : 0, pp: g.precios.slice(-8), veces: g.veces, ult: g.ult, alias: nombres.slice(1).map(x => x[0]).slice(0, 8) };
  });
  return { v: 1, items };
}

// Sugerencias al escribir: [{ k, m, score, similar }]. score 3 = es el mismo producto; 2.5 = parecido (una letra de diferencia);
// 2 = empieza con lo escrito; 1 = lo contiene. `similar` marca los que solo son parecidos (se pregunta «¿quisiste decir…?»).
export function buscarSugerencias(mem, texto, limite = 4) {
  const q = claveNombre(texto);
  if (!q || !tieneMemoria(mem)) return [];
  const r = [];
  for (const [k, m] of Object.entries(mem.items)) {
    let sc = 0, parecido = true;
    for (const c of [m.n, ...(m.alias || [])].map(claveNombre)) {
      if (c === q) { sc = Math.max(sc, 3); parecido = false; }
      else if (c.startsWith(q)) { sc = Math.max(sc, 2); parecido = false; }
      else if (c.includes(q)) { sc = Math.max(sc, 1); parecido = false; }
      else if (q.length >= 4 && lev(c, q) <= 1) sc = Math.max(sc, 2.5);
    }
    if (sc) r.push({ k, m, score: sc, similar: parecido });
  }
  return r.sort((a, b) => b.score - a.score || b.m.veces - a.m.veces).slice(0, limite);
}

// Suma una compra confirmada a la memoria (sin mutar). El precio solo se aprende si fue confirmado (no una referencia sin confirmar).
export function recordarCompra(mem, { text, categoria, precio, fecha }) {
  const nombre = String(text || "").trim(), k = claveNombre(nombre);
  if (!k) return mem;
  const base = tieneMemoria(mem) ? mem : memoriaVacia();
  const prev = base.items[k] || { n: nombre, cat: "", p: 0, pp: [], veces: 0, ult: "", alias: [] };
  const sig = { ...prev, veces: prev.veces + 1, ult: fecha || prev.ult, cat: (categoria && String(categoria).trim()) || prev.cat };
  if (Number(precio) > 0) { sig.p = Number(precio); sig.pp = [...prev.pp, Number(precio)].slice(-8); }
  if (nombre !== prev.n && !(prev.alias || []).includes(nombre)) sig.alias = [...(prev.alias || []), nombre].slice(-8);
  return { ...base, items: { ...base.items, [k]: sig } };
}

// Rango de los últimos precios pagados (hasta 5), o null si aún no hay.
export function rangoPrecios(m) {
  const pp = ((m && m.pp) || []).slice(-5).filter(v => v > 0);
  return pp.length ? { min: Math.min(...pp), max: Math.max(...pp), n: pp.length } : null;
}
