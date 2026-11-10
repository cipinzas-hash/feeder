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

// ── Avance y valor (issue #40, 10-nov-2026) ─────────────────────────────────────────────────────────────────────────
// Un mismo cálculo para el menú Colecciones, la cabecera de cada colección y la de cada set: así los tres niveles
// no pueden divergir. `items` son entradas del catálogo ya unidas con su carta de inventario (tcgMarket, estado);
// `esConseguida(d)` dice si la tenés. El % de completitud es por cantidad de cartas; el % del valor va aparte.
export function resumenAvance(items, esConseguida) {
  let total = 0, conseguidas = 0, valorTotal = 0, valorConseguido = 0, conPrecio = 0;
  for (const d of items || []) {
    total++;
    const tiene = d?.tcgMarket != null && Number.isFinite(Number(d.tcgMarket));
    const v = tiene ? Number(d.tcgMarket) : 0;
    if (tiene) conPrecio++;
    valorTotal += v;
    if (esConseguida(d)) { conseguidas++; valorConseguido += v; }
  }
  return {
    total, conseguidas, valorTotal, valorConseguido, conPrecio,
    pct: total ? Math.round(conseguidas / total * 100) : 0,
    pctValor: valorTotal > 0 ? Math.round(valorConseguido / valorTotal * 100) : 0,
  };
}

// Suma de varios avances (el total del menú "Colecciones": cada colección cuenta sus propias cartas).
export function sumarAvances(lista) {
  const s = (lista || []).reduce((a, r) => ({
    total: a.total + r.total, conseguidas: a.conseguidas + r.conseguidas,
    valorTotal: a.valorTotal + r.valorTotal, valorConseguido: a.valorConseguido + r.valorConseguido,
    conPrecio: a.conPrecio + r.conPrecio,
  }), { total: 0, conseguidas: 0, valorTotal: 0, valorConseguido: 0, conPrecio: 0 });
  return {
    ...s,
    pct: s.total ? Math.round(s.conseguidas / s.total * 100) : 0,
    pctValor: s.valorTotal > 0 ? Math.round(s.valorConseguido / s.valorTotal * 100) : 0,
  };
}

// ── Snapshots mensuales del valor de cada colección ─────────────────────────────────────────────────────────────────
// historial: [{ mes:"2026-11", fecha:"2026-11-10", colecciones:{ [nombre]:{ v, vc, n, c, p } } }] ordenado por mes.
//   v = valor de la colección completa, vc = valor de lo conseguido, n = cartas, c = conseguidas, p = cartas con precio.
// "*" es el total de todas las colecciones. Un snapshot por colección y mes: mientras el mes está en curso se va
// actualizando (queda el último valor del mes). Devuelve el MISMO array si nada cambió (no genera escrituras de más).
export const TOTAL_COLECCIONES = "*";
export const mesDe = fecha => String(fecha || "").slice(0, 7);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export function snapshotDeAvance(r) {
  return { v: r2(r.valorTotal), vc: r2(r.valorConseguido), n: r.total, c: r.conseguidas, p: r.conPrecio };
}
const igualSnap = (a, b) => !!a && !!b && a.v === b.v && a.vc === b.vc && a.n === b.n && a.c === b.c && a.p === b.p;

// avances: { [nombre]: resumenAvance(...) }. Solo se registran colecciones con cartas y al menos un precio
// (con el catálogo recién escaneándose o sin precios, un valor 0 falso no debe quedar como "el valor del mes").
export function registrarSnapshotMes(historial, fecha, avances) {
  const mes = mesDe(fecha);
  if (!/^\d{4}-\d{2}$/.test(mes)) return historial || [];
  const base = Array.isArray(historial) ? historial : [];
  const nuevos = {};
  for (const [nombre, r] of Object.entries(avances || {})) {
    if (r && r.total > 0 && r.conPrecio > 0) nuevos[nombre] = snapshotDeAvance(r);
  }
  if (!Object.keys(nuevos).length) return base;
  const previo = base.find(h => h.mes === mes);
  const cambia = !previo || Object.entries(nuevos).some(([n, s]) => !igualSnap(previo.colecciones?.[n], s));
  if (!cambia) return base;
  const entrada = { mes, fecha, colecciones: { ...(previo?.colecciones || {}), ...nuevos } };
  return [...base.filter(h => h.mes !== mes), entrada].sort((a, b) => a.mes.localeCompare(b.mes));
}

// Serie de una colección: [{mes, ...snap}] en orden cronológico (solo los meses donde existe).
export function serieColeccion(historial, nombre) {
  return (historial || []).filter(h => h.colecciones?.[nombre]).map(h => ({ mes: h.mes, ...h.colecciones[nombre] }));
}

// Variación del mes en curso contra el mes anterior con snapshot (no tiene por qué ser el inmediato).
// Devuelve null si no hay un mes anterior que comparar. `cambioCartas` avisa que el total de cartas cambió
// (set nuevo, cartas dadas de baja): ahí parte de la variación es del catálogo y no del precio.
export function variacionMensual(historial, nombre, mesActual) {
  const serie = serieColeccion(historial, nombre);
  const actual = serie.find(s => s.mes === mesActual) || null;
  if (!actual) return null;
  const anterior = [...serie].reverse().find(s => s.mes < mesActual) || null;
  if (!anterior) return null;
  const pct = (a, b) => (b > 0 ? Math.round((a - b) / b * 1000) / 10 : null);
  return {
    desde: anterior.mes,
    delta: r2(actual.v - anterior.v), pct: pct(actual.v, anterior.v),
    deltaConseguido: r2(actual.vc - anterior.vc), pctConseguido: pct(actual.vc, anterior.vc),
    cambioCartas: actual.n !== anterior.n, nAntes: anterior.n, nAhora: actual.n,
  };
}

// ── Avance de TODAS las colecciones desde el inventario (lo usa el bot de snapshots, issue #41) ─────────────────────
// Las colecciones automáticas del menú, en el orden del menú. tests/pokecripto-colecciones.mjs verifica que coincidan con
// COLECCIONES_ILUSTRADOR de PokecriptoPage.jsx (el menú las deriva de ahí): si se agrega una colección, falla hasta sumarla acá.
export const NOMBRES_COLECCIONES = ["Dark Collection", "tayu", "Sachiko Adachi", "Tomokazu Komiya", "Yuka Morii", "Asako Ito", "Mega", "Tera", "Pikachu 30", "ACE SPEC"];

// El inventario tiene una fila por colección y carta (las que faltan nacen en "hunting"), así que el avance de una
// colección sale de sus filas: conseguida = estado distinto de "hunting"; valor = tcgMarket de cada fila.
export function avancesDeInventario(inv) {
  const filas = Array.isArray(inv) ? inv : [];
  const porColeccion = {};
  for (const nombre of NOMBRES_COLECCIONES) {
    const items = filas.filter(c => carpetaDeInv(c) === nombre).map(c => ({ estado: c.estado, tcgMarket: c.tcgMarket ?? null }));
    porColeccion[nombre] = resumenAvance(items, x => x.estado !== "hunting");
  }
  return { porColeccion, total: sumarAvances(Object.values(porColeccion)) };
}
