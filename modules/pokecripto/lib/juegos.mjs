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

export const JUEGOS = [
  { id: "pokemon", nombre: "Pokémon", emoji: "🎴" },
  { id: "yugioh", nombre: "Yu-Gi-Oh!", emoji: "🃏" },
  { id: "digimon", nombre: "Digimon", emoji: "🐉" },
];
export const OTROS_JUEGOS = JUEGOS.filter(j => j.id !== "pokemon").map(j => j.id);
export const juegoDe = c => (c && typeof c.juego === "string" && c.juego) || "pokemon";
export const esPokemon = c => juegoDe(c) === "pokemon";
export const idFila = (juego, colecId, k) => `${juego}:${colecId}:${k}`;

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
// { [k]: marca } de las filas de un juego en una colección (por nombre de carpeta)
export function marcasDeFilas(filas, juego, carpeta) {
  const out = {};
  for (const f of filas || []) if (juegoDe(f) === juego && f.carpeta === carpeta && f.cardId) out[f.cardId] = marcaDeFila(f);
  return out;
}
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
function conSnapshot(historial, p, hoy) {
  if (!p) return historial || [];
  return compactarHistorial(marcarCortes(addSnapshot(historial, p.market, p.low, p.high, hoy, "csv", extrasSnapshot({ tid: p.tid, variant: p.variant }))), hoy);
}

// Aplica un parche de marca ({c,e,q,cu,nt}; null/""/0 = borrar el campo) a la carta k de una colección y devuelve el
// inventario nuevo. Si la marca queda vacía la fila desaparece. Mismas reglas que ponerMarca de tcgcrypto.
export function aplicarMarca(inventario, { juego, datos, col, k, parche, hoy }) {
  const inv = Array.isArray(inventario) ? inventario : [];
  const carta = cartaDe(datos, k);
  if (!carta) return inv;
  const id = idFila(juego, col.id, k);
  const prev = inv.find(f => f.id === id) || null;
  const m = { ...(marcaDeFila(prev) || {}), ...parche };
  for (const campo of Object.keys(m)) if (m[campo] === undefined || m[campo] === null || m[campo] === "" || m[campo] === 0) delete m[campo];
  if (marcaVacia(m)) return prev ? inv.filter(f => f.id !== id) : inv;
  const p = precioDeCarta(carta, m);
  const v = (p && p.version) || versionElegida(carta, m) || carta.v[0];
  const tiene = !!m.c;
  const estado = tiene ? (prev && filaTiene(prev) ? prev.estado : "en_mano") : "hunting";
  const fila = {
    ...(prev || {}),
    id, juego, cardId: k, coleccion: col.id, carpeta: col.nombre,
    name: carta.n, set: (datos.sets && datos.sets[v[2]]) || "", setCode: "", number: v[3] || "", rarity: v[4] || "",
    image: urlImagen(datos.imgTpl, v[0], 200), imageHd: urlImagenGrande(v[0]),
    tcgcsvKey: m.e || null,
    tcgMarket: p ? p.market : (prev ? prev.tcgMarket : null), tcgLow: p ? p.low : (prev ? prev.tcgLow : null), tcgHigh: p ? p.high : (prev ? prev.tcgHigh : null),
    tcgUpdated: p ? hoy : (prev ? prev.tcgUpdated : null),
    priceHistory: conSnapshot(prev ? prev.priceHistory : [], p, hoy),
    costoUSD: m.cu || 0, precioVentaUSD: prev ? prev.precioVentaUSD || 0 : 0, condicion: (prev && prev.condicion) || "NM",
    estado, cantidad: m.q || 1, notas: m.nt || "",
    fechaCompra: tiene ? (prev && prev.fechaCompra) || hoy : null, fechaVenta: null, precioVendidoUSD: null,
  };
  return prev ? inv.map(f => (f.id === id ? fila : f)) : [...inv, fila];
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

export { claveVersion, etiquetaVersion };
