// modules/pokecripto/lib/variantes.mjs  (8-nov-2026, issue #37)
// Elección de la variante de impresión de una carta en tcgpricelookup.com (una fila por variante: Normal / Holofoil /
// Reverse Holofoil...). Sin imports a propósito: lo usan pricing.mjs y discovery.mjs y no debe haber ciclos.
//
// Antes se tomaba "Normal, si no Holofoil" a ciegas. Eso fallaba de dos maneras (sonda del 8-nov-2026):
//  - la fila Normal existe pero NO tiene precio y la Holofoil sí (Chaos Rising: Mega Greninja ex 100 -> 7.63);
//  - la fila Normal es un fantasma sin rareza con un precio ralo/ajeno (30th Celebration: Pikachu 34 figuraba en
//    148 y la Holofoil real, con rareza "Pikachu Rare", vale 0.87).
// Por eso, antes de la regla de siempre: 1) si solo algunas filas tienen precio, se descartan las que no; 2) si solo
// algunas tienen rareza, se descartan las que no. Si ninguna fila trae esos datos (o todas los traen) no cambia nada.
// La API manda la rareza de la fila fantasma como el TEXTO "None" (verificado el 8-nov-2026 en 30th Celebration), no como null.
const tieneRareza = c => !!c.rarity && !/^(none|null|n\/a|-)?$/i.test(String(c.rarity).trim());
export function elegirVariante(cands) {
  let lista = cands || [];
  if (lista.length > 1) {
    const conPrecio = lista.filter(c => Number(c.market) > 0);
    if (conPrecio.length && conPrecio.length < lista.length) lista = conPrecio;
  }
  if (lista.length > 1) {
    const conRareza = lista.filter(tieneRareza);
    if (conRareza.length && conRareza.length < lista.length) lista = conRareza;
  }
  if (lista.length === 1) return lista[0];
  for (const v of ["normal", "holofoil"]) {
    const m = lista.filter(c => String(c.variant || "").toLowerCase() === v);
    if (m.length === 1) return m[0];
    if (m.length > 1) return null;
  }
  const noRev = lista.filter(c => !/reverse/i.test(String(c.variant || "")));
  return noRev.length === 1 ? noRev[0] : null;
}

// ¿Dos nombres de set son el mismo? Cada API los nombra distinto ("XY - Flashfire" / "Flashfire", "ME04: Chaos Rising" /
// "Chaos Rising"): se compara en forma plana, sin el prefijo de serie, y con "termina en" (el más corto >= 6 letras).
const plano = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sinSerie = s => String(s || "").replace(/^[A-Za-z]{1,5}\d{0,3}\s*[—–:-]\s*/, "");
export function nombreSetCompatible(a, b) {
  const x = plano(sinSerie(a)), y = plano(sinSerie(b));
  if (!x || !y) return false;
  if (x === y) return true;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  return corto.length >= 6 && largo.endsWith(corto);
}
