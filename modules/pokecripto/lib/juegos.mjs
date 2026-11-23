// Otros juegos dentro de Pokécripto (lote multi-juego, 17-nov-2026). Sin React ni red: lo usan el bot, la pantalla de
// juegos y las pruebas.
//
// MODELO: Pokécripto sigue siendo UN inventario de ejemplares (pokeInventario). Cada fila gana el campo `juego`
// ("pokemon" por omisión: las filas existentes no se migran). Para Yu-Gi-Oh! y Digimon el CATÁLOGO es virtual (los
// JSON de tcgcrypto, que arma el bot de tcgcsv cada día) y una fila existe solo cuando la carta está marcada
// (la tengo, la busco, versión elegida, cantidad, costo o notas): así el inventario no se llena de miles de filas
// que nadie marcó (localStorage ya guarda ~1,8 MB de inventario).
//
// Una fila de otro juego es la MARCA de tcgcrypto con la forma de Pokécripto (misma regla: colección individual, la
// misma carta en dos colecciones son dos filas). Precios: del catálogo (src "csv"), sin consultas a ninguna API.
import { claveVersion, precioVersion, versionElegida, precioReferencia, etiquetaVersion, urlImagen, urlImagenGrande } from "../../tcgcrypto/logica.js";
import { addSnapshot, compactarHistorial } from "./pricing.mjs";
import { marcarCortes, extrasSnapshot } from "./historial.mjs";
import { describirVariante, ordenarVariantes } from "./variantes-comunes.mjs";

export const JUEGOS = [
  { id: "pokemon", nombre: "Pokémon", emoji: "🎴" },
  { id: "yugioh", nombre: "Yu-Gi-Oh!", emoji: "🃏" },
  { id: "digimon", nombre: "Digimon", emoji: "🐉" },
];
export const OTROS_JUEGOS = JUEGOS.filter(j => j.id !== "pokemon").map(j => j.id);
export const juegoDe = c => (c && typeof c.juego === "string" && c.juego) || "pokemon";
export const esPokemon = c => juegoDe(c) === "pokemon";
// Una fila por VARIANTE de la carta (cada variante es su propio ejemplar: costo, historial y gráfico propios). `vkey` = "pid|subtipo".
export const idFila = (juego, colecId, k, vkey) => (vkey ? `${juego}:${colecId}:${k}:${vkey}` : `${juego}:${colecId}:${k}`);

// ¿La tengo? (estado de Pokécripto: todo menos "hunting" y "vendida")
export const filaTiene = f => !!f && f.estado !== "hunting" && f.estado !== "vendida";

// Marca de tcgcrypto ({c,e,q,cu,nt}) que representa una fila. Sirve para reusar tal cual la lógica probada del módulo
// (filtrarCartas, resumenColeccion, precioReferencia).
export function marcaDeFila(f) {
  if (!f) return null;
  const m = {};
  if (filaTiene(f)) m.c = 1;
  if (f.tcgcsvKey) m.e = f.tcgcsvKey;
  if (f.cantidad > 1) m.q = f.cantidad;
  if (f.costoUSD) m.cu = f.costoUSD;
  if (f.notas) m.nt = f.notas;
  return m;
}
// { [k]: marca } de las filas de un juego en una colección (por nombre de carpeta). Una carta puede tener VARIAS filas (una por
// variante): la marca agregada dice "la tengo" si alguna lo está, suma cantidades y costos, y `e` es la variante que cuenta para el precio.
export function marcasDeFilas(filas, juego, carpeta) {
  const out = {};
  for (const f of filas || []) {
    if (juegoDe(f) !== juego || f.carpeta !== carpeta || !f.cardId) continue;
    const m = marcaDeFila(f), prev = out[f.cardId];
    if (!prev) { out[f.cardId] = m; continue; }
    const tiene = filaTiene(f);
    out[f.cardId] = { ...prev, c: prev.c || m.c, e: (prev.c && prev.e) || (tiene && m.e) || prev.e || m.e, q: (prev.q || (prev.c ? 1 : 0)) + (tiene ? (f.cantidad || 1) : 0) || undefined, cu: (prev.cu || 0) + (m.cu || 0) || undefined, nt: prev.nt || m.nt };
    if (!(out[f.cardId].q > 1)) delete out[f.cardId].q;
  }
  return out;
}
// Filas (una por variante) de una carta en una colección
export const filasDeCarta = (filas, juego, carpeta, k) => (filas || []).filter(f => juegoDe(f) === juego && f.carpeta === carpeta && f.cardId === k);
const marcaVacia = m => !m.c && !m.e && !(m.q > 1) && !m.cu && !m.nt;

const indices = new WeakMap();
export function cartaDe(datos, k) {
  if (!datos || !Array.isArray(datos.cartas)) return null;
  let ix = indices.get(datos);
  if (!ix) { ix = new Map(datos.cartas.map(c => [c.k, c])); indices.set(datos, ix); }
  return ix.get(k) || null;
}

// Precio vigente de una carta según su marca: el de la versión elegida; sin elegir, la versión más barata con precio
// (lo que costaría completarla). Devuelve también el bajo/alto y qué versión usó.
export function precioDeCarta(carta, marca) {
  if (!carta) return null;
  const el = versionElegida(carta, marca);
  let v = el;
  if (!v) {
    let min = null;
    for (const x of carta.v) { const p = precioVersion(x); if (p != null && (min === null || p < min.p)) min = { p, x }; }
    v = min ? min.x : null;
  }
  if (!v) return null;
  const market = precioVersion(v);
  if (market == null) return null;
  return { market, low: v[6] != null ? v[6] : null, high: v[7] != null ? v[7] : null, tid: String(v[0]), variant: v[1] || null, version: v };
}
export const precioDeFila = (datos, fila) => precioDeCarta(cartaDe(datos, fila.cardId), marcaDeFila(fila));

// Snapshot del día con tcgId/variante (misma forma que el bot de Pokémon) y corte si cambió la versión.
export function conSnapshot(historial, p, hoy) {
  if (!p) return historial || [];
  return compactarHistorial(marcarCortes(addSnapshot(historial, p.market, p.low, p.high, hoy, "csv", extrasSnapshot({ tid: p.tid, variant: p.variant }))), hoy);
}

// Aplica un parche ({c,q,cu,nt}; null/""/0 = borrar el campo) a UNA variante (`vkey` = "pid|subtipo") de la carta k en una colección y
// devuelve el inventario nuevo. Si la fila queda sin nada marcado desaparece. Sin `vkey` usa la variante más barata con precio.
export function aplicarMarca(inventario, { juego, datos, col, k, vkey, parche, hoy, forzar }) {
  const inv = Array.isArray(inventario) ? inventario : [];
  const carta = cartaDe(datos, k);
  if (!carta) return inv;
  if (!vkey) { const p0 = precioDeCarta(carta, null); vkey = p0 ? claveVersion(p0.version) : claveVersion(carta.v[0]); }
  const v = carta.v.find(x => claveVersion(x) === vkey);
  if (!v) return inv;
  const id = idFila(juego, col.id, k, vkey);
  const prev = inv.find(f => f.id === id) || null;
  const m = { ...(prev ? { ...marcaDeFila(prev), e: undefined } : {}), ...parche };
  delete m.e;
  for (const campo of Object.keys(m)) if (m[campo] === undefined || m[campo] === null || m[campo] === "" || m[campo] === 0) delete m[campo];
  if (marcaVacia(m) && !forzar) return prev ? inv.filter(f => f.id !== id) : inv;   // `forzar`: alta sin marcas (carta que solo sigo, p. ej. Price Watch)
  const market = precioVersion(v);
  const p = market != null ? { market, low: v[6] != null ? v[6] : null, high: v[7] != null ? v[7] : null, tid: String(v[0]), variant: v[1] || null } : null;
  const tiene = !!m.c;
  const estado = tiene ? (prev && filaTiene(prev) ? prev.estado : "en_mano") : "hunting";
  const fila = {
    ...(prev || {}),
    id, juego, cardId: k, coleccion: col.id, carpeta: col.nombre,
    name: carta.n, set: (datos.sets && datos.sets[v[2]]) || "", setCode: "", number: v[3] || "", rarity: v[4] || "",
    image: urlImagen(datos.imgTpl, v[0], 200), imageHd: urlImagenGrande(v[0]),
    tcgcsvKey: vkey,
    varianteEtiqueta: describirVariante({ juego, sub: v[1], rareza: v[4], grupo: (datos.sets && datos.sets[v[2]]) || "" }).etiqueta,
    tcgMarket: p ? p.market : (prev ? prev.tcgMarket : null), tcgLow: p ? p.low : (prev ? prev.tcgLow : null), tcgHigh: p ? p.high : (prev ? prev.tcgHigh : null),
    tcgUpdated: p ? hoy : (prev ? prev.tcgUpdated : null),
    priceHistory: conSnapshot(prev ? prev.priceHistory : [], p, hoy),
    costoUSD: m.cu || 0, precioVentaUSD: prev ? prev.precioVentaUSD || 0 : 0, condicion: (prev && prev.condicion) || "NM",
    estado, cantidad: m.q || 1, notas: m.nt || "",
    fechaCompra: tiene ? (prev && prev.fechaCompra) || hoy : null, fechaVenta: null, precioVendidoUSD: null,
  };
  return prev ? inv.map(f => (f.id === id ? fila : f)) : [...inv, fila];
}

// Variantes de una impresión: todas las versiones de la carta con el mismo set y número (distintas rarezas, ediciones, acabados),
// descritas con el formato común. `key` = "pid|subtipo".
export function variantesDeImpresion(datos, carta, setIdx, numero, juego = "yugioh") {
  const vs = carta.v.filter(v => v[2] === setIdx && (v[3] || "") === (numero || ""));
  return ordenarVariantes(vs.map(v => ({ ...describirVariante({ juego, sub: v[1], rareza: v[4], grupo: datos.sets[v[2]], market: precioVersion(v), low: v[6], high: v[7], pid: v[0] }), key: claveVersion(v), v })));
}

// Resumen de una colección sobre FILAS: cartas conseguidas (alguna variante), valor conseguido (cada variante que tienes × cantidad)
// y valor total (la variante más barata de cada carta).
export function resumenFilas(cartas, filasCol) {
  const porCarta = new Map();
  for (const f of filasCol) if (filaTiene(f)) { const a = porCarta.get(f.cardId) || []; a.push(f); porCarta.set(f.cardId, a); }
  let conseguidas = 0, valorConseguido = 0, valorTotal = 0, sinPrecio = 0;
  for (const c of cartas) {
    const p = precioDeCarta(c, null);
    if (p) valorTotal += p.market; else sinPrecio++;
    const mias = porCarta.get(c.k);
    if (mias) { conseguidas++; for (const f of mias) valorConseguido += (f.tcgMarket || 0) * Math.max(1, f.cantidad || 1); }
  }
  const total = cartas.length;
  return { total, conseguidas, pct: total ? Math.floor(conseguidas / total * 100) : 0, valorTotal: Math.round(valorTotal * 100) / 100, valorConseguido: Math.round(valorConseguido * 100) / 100, sinPrecio };
}

// Refresca los precios de TODAS las filas de otros juegos desde sus catálogos ({ yugioh: datos, digimon: datos }).
// Devuelve { filas, cambiadas }; las filas que no cambian conservan su identidad. Sin consultas a ninguna API.
export function actualizarPreciosFilas(inventario, catalogos, hoy) {
  const inv = Array.isArray(inventario) ? inventario : [];
  let cambiadas = 0;
  const filas = inv.map(f => {
    const j = juegoDe(f);
    if (j === "pokemon" || f.estado === "vendida") return f;
    const datos = catalogos && catalogos[j];
    if (!datos) return f;
    const p = precioDeFila(datos, f);
    if (!p) return f;
    const ult = (f.priceHistory || []).filter(h => h && h.date).sort((a, b) => a.date.localeCompare(b.date)).pop();
    const igual = f.tcgMarket === p.market && f.tcgLow === p.low && f.tcgHigh === p.high && f.tcgUpdated === hoy && ult && ult.date === hoy && ult.tid === p.tid;
    if (igual) return f;
    cambiadas++;
    return { ...f, tcgMarket: p.market, tcgLow: p.low, tcgHigh: p.high, tcgUpdated: hoy, priceHistory: conSnapshot(f.priceHistory, p, hoy) };
  });
  return { filas: cambiadas ? filas : inv, cambiadas };
}

// Entradas que hay que encolar al bot tras un cambio de inventario: las filas nuevas o modificadas (cualquier campo) y la baja de las que
// desaparecieron ({id, _baja:true}). Sin esto el bot no se entera de las filas de otros juegos (nacen en el navegador) y no acumula su historial.
export function pendientesDeCambio(antes, despues) {
  const a = new Map((antes || []).map(f => [f.id, f])), d = new Map((despues || []).map(f => [f.id, f]));
  const out = [];
  for (const [id, fila] of d) { const p = a.get(id); if (!p || p !== fila && JSON.stringify(p) !== JSON.stringify(fila)) out.push(fila); }
  for (const id of a.keys()) if (!d.has(id)) out.push({ id, _baja: true });
  return out;
}

export { claveVersion, etiquetaVersion };
