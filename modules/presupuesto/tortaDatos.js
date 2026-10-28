// Datos de la torta de gasto (pura, con prueba). Tres vistas —por sobre, por categoría, por compra— y tres niveles:
//   por sobre:     sobres → categorías del sobre → compras de esa categoría
//   por categoría: categorías (de todos los sobres) → compras de esa categoría
//   por compra:    compras (individuales en mensual, juntas por producto en anual) → ficha de la compra
// Cada porción trae p (lo gastado en el período), y (lo gastado en los últimos 12 períodos) y d (el que corresponde al modo en vista).
export const SIN_CAT = "Sin categoría";
const sinTildes = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const EMO_CAT = { lacteos: "🥛", huevos: "🥚", prote: "🍗", snack: "🍿", verdura: "🥬", fruta: "🍎", aseo: "🧼", limpieza: "🧴", papel: "🧻" };
export function emojiCategoria(cat) { return EMO_CAT[sinTildes(cat).trim()] || "🏷️"; }

const EMO_PROD = [["manzana", "🍎"], ["platan", "🍌"], ["palta", "🥑"], ["huevo", "🥚"], ["jamon", "🥓"], ["hamburguesa", "🍔"], ["cebolla", "🧅"], ["papa", "🥔"],
  ["yogur", "🍦"], ["leche", "🥛"], ["pollo", "🍗"], ["pan", "🍞"], ["queso", "🧀"], ["tomate", "🍅"], ["lechuga", "🥬"], ["zapallo", "🎃"], ["zanahoria", "🥕"],
  ["arroz", "🍚"], ["fideo", "🍝"], ["pasta", "🍝"], ["atun", "🐟"], ["cloro", "🧴"], ["detergente", "🧼"], ["cafe", "☕"], ["agua", "💧"], ["aceite", "🫒"],
  ["uva", "🍇"], ["naranja", "🍊"], ["limon", "🍋"], ["frutilla", "🍓"], ["sandia", "🍉"], ["pera", "🍐"], ["durazno", "🍑"], ["cerveza", "🍺"], ["vino", "🍷"],
  ["carne", "🥩"], ["pizza", "🍕"], ["galleta", "🍪"], ["helado", "🍨"], ["chocolate", "🍫"], ["mantequilla", "🧈"], ["cereal", "🥣"], ["brocoli", "🥦"],
  ["choclo", "🌽"], ["pepino", "🥒"], ["ajo", "🧄"], ["pimenton", "🫑"], ["champi", "🍄"], ["confort", "🧻"], ["papel", "🧻"]];
export function emojiProducto(nombre, cat) {
  const toks = sinTildes(nombre).split(/[^a-z]+/).filter(Boolean);
  for (const [s, e] of EMO_PROD) {
    if (s.length >= 4 ? toks.some(t => t.startsWith(s)) : toks.some(t => t === s || t === s + "s" || t === s + "es")) return e;
  }
  const c = emojiCategoria(cat);
  return c === "🏷️" ? "🛒" : c;
}
// «2× Manzana» → «Manzana»
export function nombreProducto(nota) { return String(nota || "").replace(/^\s*[\d.,]+\s*[×x]\s*/i, "").trim() || "(sin nota)"; }
// Mismo producto aunque cambien mayúsculas, tildes o plural.
export function claveProducto(nota) {
  return sinTildes(nombreProducto(nota)).replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map(w => (w.length > 3 ? w.replace(/(es|s)$/, "") : w)).join(" ");
}
const fechaCorta = iso => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : ""; };

function agrupar(lista, keyFn, mk) {
  const mp = new Map();
  lista.forEach(m => {
    const k = keyFn(m);
    let o = mp.get(k);
    if (!o) { o = { ...mk(m, k), key: k, p: 0, y: 0, n: 0, ny: 0 }; mp.set(k, o); }
    o.y += m.monto || 0; o.ny++;
    if (m.enPeriodo) { o.p += m.monto || 0; o.n++; }
  });
  return [...mp.values()];
}

// movs: gastos de los últimos 12 períodos ({id,fecha,sec,rowId,monto,nota,categoria,enPeriodo}); filas: carteras ({sec,row})
// sel: {tab:'s'|'c'|'p', sobre, cat, prod}  →  {nivel, items, total, ficha, titulo}
export function rebanadas({ movs, filas, modo, tab, sobre, cat, prod }) {
  const fila = new Map(filas.map(f => [`${f.sec}|${f.row.id}`, f]));
  const sk = m => `${m.sec}|${m.rowId}`;
  const catDe = m => (m.categoria && String(m.categoria).trim()) || SIN_CAT;
  const sobreInfo = k => { const f = fila.get(k); return { l: f ? f.row.label : "Sobre", e: f ? (f.row.emoji || "📦") : "📦" }; };
  const anual = modo === "a";
  const fin = items => {
    items.forEach(x => { x.d = anual ? x.y : x.p; });
    return items.filter(x => x.d > 0).sort((a, b) => b.d - a.d);
  };
  // compras de una (sobre, categoría)
  const compras = (sobreKey, categoria) => {
    const base = movs.filter(m => sk(m) === sobreKey && catDe(m) === categoria);
    const prods = agrupar(base, m => claveProducto(m.nota), m => ({ l: nombreProducto(m.nota), e: emojiProducto(m.nota, categoria), sub: "" }));
    if (anual) return prods;
    const y12 = new Map(prods.map(x => [x.key, x.y]));
    return base.filter(m => m.enPeriodo).map(m => ({ key: m.id, l: nombreProducto(m.nota), e: emojiProducto(m.nota, categoria), sub: fechaCorta(m.fecha), p: m.monto || 0, y: y12.get(claveProducto(m.nota)) || 0, n: 1, ny: 1 }));
  };

  if (tab === "s") {
    if (!sobre) return { nivel: 0, items: fin(agrupar(movs, sk, (m, k) => ({ ...sobreInfo(k), sub: "" }))) };
    if (!cat) return { nivel: 1, items: fin(agrupar(movs.filter(m => sk(m) === sobre), catDe, m => ({ l: catDe(m), e: emojiCategoria(catDe(m)), sub: "" }))) };
    return { nivel: 2, items: fin(compras(sobre, cat)) };
  }
  if (tab === "c") {
    if (!cat) return { nivel: 0, items: fin(agrupar(movs, m => `${sk(m)}|${catDe(m)}`, m => ({ l: catDe(m), e: emojiCategoria(catDe(m)), sub: sobreInfo(sk(m)).l, sobre: sk(m), cat: catDe(m) }))) };
    return { nivel: 2, items: fin(compras(sobre, cat)) };
  }
  // por compra
  const clave = m => `${sk(m)}|${claveProducto(m.nota)}`;
  const mkProd = m => ({ l: nombreProducto(m.nota), e: emojiProducto(m.nota, catDe(m)), sub: `${catDe(m)} · ${sobreInfo(sk(m)).l}`, sobre: sk(m), cat: catDe(m) });
  if (!prod) {
    const prods = agrupar(movs, clave, mkProd);
    let items;
    if (anual) items = prods;
    else {
      const y12 = new Map(prods.map(x => [x.key, x.y]));
      items = movs.filter(m => m.enPeriodo).map(m => ({ ...mkProd(m), key: m.id, sub: `${catDe(m)} · ${sobreInfo(sk(m)).l} · ${fechaCorta(m.fecha)}`, p: m.monto || 0, y: y12.get(clave(m)) || 0, n: 1, ny: 1, _clave: clave(m) }));
    }
    items = fin(items);
    if (items.length > 9) {
      const resto = items.slice(9);
      const otras = { key: "__otras", l: `Otras (${resto.length})`, e: "🧾", sub: "compras más chicas", otras: true, p: 0, y: 0, d: 0 };
      resto.forEach(x => { otras.p += x.p; otras.y += x.y; otras.d += x.d; });
      items = [...items.slice(0, 9), otras];
    }
    return { nivel: 0, items };
  }
  // ficha: todas las compras del mismo producto (en el mismo sobre)
  const ref = movs.find(m => m.id === prod) || movs.find(m => clave(m) === prod);
  if (!ref) return { nivel: 1, items: [], ficha: null };
  const mismas = movs.filter(m => clave(m) === clave(ref));
  const montos = mismas.map(m => m.monto || 0);
  const ficha = {
    l: nombreProducto(ref.nota), e: emojiProducto(ref.nota, catDe(ref)), sobre: sobreInfo(sk(ref)).l, categoria: catDe(ref),
    periodo: mismas.filter(m => m.enPeriodo).reduce((t, m) => t + (m.monto || 0), 0), anual: montos.reduce((t, v) => t + v, 0), veces: mismas.length,
    min: Math.min(...montos), max: Math.max(...montos), prom: montos.reduce((t, v) => t + v, 0) / montos.length,
    fechas: mismas.filter(m => m.enPeriodo).map(m => fechaCorta(m.fecha)),
  };
  return { nivel: 1, items: [], ficha };
}
