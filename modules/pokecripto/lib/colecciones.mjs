// Colecciones automáticas de Pokécripto (Dark, ilustradores, Mega, Tera, Pikachu 30, ACE SPEC): lógica pura, sin React ni red.
// Regla de fondo (9-nov-2026, issue #39): cada colección es INDIVIDUAL. La misma carta en dos colecciones (una Mega que también
// es Dark) son dos cartas de inventario, una por colección: hay que tener un ejemplar para cada una, y lo que tengas en una
// no cuenta en la otra. Antes el escaneo deduplicaba por cardId en TODO el inventario y el avance miraba cualquier carpeta.

export const DARK = "Dark Collection";

export const esDoubleRare = c => String(c?.rarity || "").trim().toLowerCase() === "double rare";
// ACE SPEC desde que existen: la rareza dice "ACE SPEC Rare" (o "ACE SPEC") y el subtipo "ACE SPEC".
export const esAceSpec = c => /^ace spec/i.test(String(c?.rarity || "").trim())
  || (c?.subtypes || []).some(t => String(t).trim().toLowerCase() === "ace spec");

// Carpeta de una carta de inventario / de una entrada del catálogo (el catálogo de Dark no guarda carpeta).
export const carpetaDeInv = c => c?.carpeta || (c?.isDark ? DARK : "");
export const carpetaDeCat = d => d?.carpeta || DARK;

// La carta de inventario de UNA colección. Sin respaldo en otra carpeta: lo que tengas en otra colección no cuenta aquí.
export function invEnCarpeta(inv, cardId, carpeta) {
  return (inv || []).find(c => c.cardId === cardId && carpetaDeInv(c) === carpeta) || null;
}
// Con colección abierta, la de esa colección; sin colección (historial, zoom suelto), la primera que no sea Price Watch.
export function invDeCarta(inv, cardId, carpeta) {
  if (carpeta) return invEnCarpeta(inv, cardId, carpeta);
  return (inv || []).find(c => c.cardId === cardId && c.carpeta !== "Price Watch") || null;
}

// Rareza de una entrada del catálogo: la suya o la de cualquier carta de inventario con el mismo cardId ("" si no se sabe).
export function rarezaConocida(d, inv) {
  return d?.rarity || (inv || []).find(c => c.cardId === d?.cardId && c.rarity)?.rarity || "";
}
// Mega y Tera: solo Double Rare. Con rareza desconocida no se da de baja nada (no se adivina).
export function sobraPorRareza(carpeta, rareza) {
  return (carpeta === "Mega" || carpeta === "Tera") && !!rareza && !esDoubleRare({ rarity: rareza });
}

// Cartas de inventario que faltan: entradas del catálogo sin carta propia en SU colección. Nacen en hunting; heredan de la
// carta hermana (otra colección) lo que es de la carta y no de la colección: rareza, ilustrador, imágenes, último precio y tcgId.
// No copian historial (lo junta el bot por cada fila) ni estado/costo/notas (eso es de cada colección).
export function entradasFaltantes(catalogo, inv, nuevoId) {
  const hechas = new Set();
  const out = [];
  for (const d of catalogo || []) {
    if (!d || d.manual || !d.cardId) continue;
    const carpeta = carpetaDeCat(d);
    const clave = carpeta + "::" + d.cardId;
    if (hechas.has(clave) || invEnCarpeta(inv, d.cardId, carpeta)) continue;
    hechas.add(clave);
    const h = (inv || []).find(c => c.cardId === d.cardId && c.carpeta !== "Price Watch") || null;
    out.push({
      id: nuevoId(d), cardId: d.cardId, name: d.name,
      set: d.setName || h?.set || "", setCode: d.setCode || d.setId || h?.setCode || "",
      number: d.number || h?.number || "", rarity: h?.rarity || d.rarity || "", artist: h?.artist || d.artist || "",
      image: h?.image || d.image || "", imageHd: h?.imageHd || h?.image || d.image || "",
      tcgMarket: h?.tcgMarket ?? null, tcgLow: h?.tcgLow ?? null, tcgHigh: h?.tcgHigh ?? null, tcgUpdated: h?.tcgUpdated ?? null,
      ...(h?.tcgId ? { tcgId: h.tcgId } : {}), ...(h?.tcgOverride ? { tcgOverride: h.tcgOverride } : {}),
      priceHistory: [],
      costoUSD: 0, precioVentaUSD: 0, condicion: "NM", estado: "hunting",
      carpeta, fechaCompra: null, cantidad: 1, fechaVenta: null, precioVendidoUSD: null,
      notas: "", isDark: carpeta === DARK,
    });
  }
  return out;
}
