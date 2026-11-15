// Lógica pura de tcgcrypto: sin React ni red (la prueba vive en tests/tcgcrypto-logica.mjs).
//
// Formato de datos (lo escribe build-tcgcrypto.mjs):
//   carta   = { k: clave, n: nombre, c: [ids de colección], v: [versión…] }
//   versión = [productId, subtipo, índiceDeSet, número, rareza, mercado, bajo, alto]   (precios en USD de TCGplayer)
// Yu-Gi-Oh! agrupa por NOMBRE (una carta, muchas impresiones: elegís la versión que te gusta);
// Digimon agrupa por PRODUCTO (cada arte es una carta distinta de la colección).

export const claveVersion = v => `${v[0]}|${v[1]}`;
export const precioVersion = v => (v && v[5] != null ? v[5] : v && v[6] != null ? v[6] : null);

export const versionElegida = (carta, marca) => {
  if (!carta || !marca || !marca.e) return null;
  return carta.v.find(v => claveVersion(v) === marca.e) || null;
};

// Precio de referencia de una carta: el de la versión elegida; sin elegir, la versión más barata con precio
// (es lo que costaría completarla). null si ninguna versión tiene precio.
export function precioReferencia(carta, marca) {
  const el = versionElegida(carta, marca);
  if (el) return precioVersion(el);
  let min = null;
  for (const v of carta.v) { const p = precioVersion(v); if (p != null && (min === null || p < min)) min = p; }
  return min;
}

export const tieneCarta = m => !!(m && m.c);
export const cartasDeColeccion = (datos, colec) => (datos ? datos.cartas : []).filter(c => c.c.includes(colec));

// Avance y valor de una colección: un solo cálculo para la fila, la cabecera y el resumen (no pueden divergir).
export function resumenColeccion(cartas, marcas) {
  let conseguidas = 0, valorTotal = 0, valorConseguido = 0, sinPrecio = 0;
  for (const c of cartas) {
    const m = marcas ? marcas[c.k] : null;
    const p = precioReferencia(c, m);
    if (p == null) sinPrecio++; else valorTotal += p;
    if (tieneCarta(m)) { conseguidas++; if (p != null) valorConseguido += p * Math.max(1, m.q || 1); }
  }
  const total = cartas.length;
  return {
    total, conseguidas, sinPrecio,
    pct: total ? Math.floor((conseguidas / total) * 100) : 0,
    valorTotal: Math.round(valorTotal * 100) / 100,
    valorConseguido: Math.round(valorConseguido * 100) / 100,
  };
}

// Barra por tramos (misma regla que Pokécripto, issue #40): rojo el primer cuarto, naranjo el segundo, amarillo el
// tercero, verde el cuarto y dorado al 100 %. El color de TODA la barra cambia según el nivel; no se van sumando.
export function tramoBarra(pct) {
  if (pct >= 100) return { color: "#d4af37", texto: "¡completada!" };
  if (pct >= 75) return { color: "#4caf50", texto: null };
  if (pct >= 50) return { color: "#e6c229", texto: null };
  if (pct >= 25) return { color: "#f08a24", texto: null };
  return { color: "#e5383b", texto: null };
}

const sinTildes = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

// modo: "todas" | "faltan" | "tengo". `texto` busca en nombre, número, set y rareza de cualquier versión.
export function filtrarCartas(cartas, marcas, { texto = "", modo = "todas" } = {}, sets = []) {
  const q = sinTildes(texto).trim();
  return cartas.filter(c => {
    const tiene = tieneCarta(marcas ? marcas[c.k] : null);
    if (modo === "faltan" && tiene) return false;
    if (modo === "tengo" && !tiene) return false;
    if (!q) return true;
    if (sinTildes(c.n).includes(q)) return true;
    return c.v.some(v => sinTildes(`${v[3]} ${v[4]} ${sets[v[2]] || ""}`).includes(q));
  });
}

export const usd = n => (n == null ? "—" : "$" + (n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)));

export function etiquetaVersion(v, sets) {
  return [sets[v[2]] || "", v[3], v[4], v[1]].filter(Boolean).join(" · ");
}

// Plantilla de imagen de tcgcsv ("…/product/{id}_200w.jpg"); `ancho` pide la variante grande si existe.
export function urlImagen(tpl, productId, ancho) {
  const u = String(tpl || "").replace("{id}", String(productId));
  return ancho ? u.replace(/_\d+w\./, `_${ancho}w.`) : u;
}

export function edadDatos(generatedAt, ahora) {
  const t = generatedAt ? Date.parse(generatedAt) : NaN;
  if (!Number.isFinite(t)) return { texto: "sin fecha", vieja: true };
  const h = Math.max(0, Math.floor((ahora - t) / 3600000));
  if (h < 1) return { texto: "recién", vieja: false };
  if (h < 48) return { texto: `hace ${h} h`, vieja: h > 36 };
  return { texto: `hace ${Math.floor(h / 24)} d`, vieja: true };
}
