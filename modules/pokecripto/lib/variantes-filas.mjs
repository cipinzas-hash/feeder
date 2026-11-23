// Variantes de Pokémon como EJEMPLARES (unificación de Pokécripto, 22-nov-2026). Sin React ni red: lo usan la pantalla, el bot y las pruebas.
//
// Regla: cada variante (holo, reverse, Poké Ball, logo de tipo, sello de liga…) que tienes es su propia fila del inventario, con costo,
// cantidad, notas, historial y gráfico propios, igual que en Yu-Gi-Oh!/Digimon. Las filas que ya existían NO se migran: una fila sin
// `tcgcsvKey` sigue siendo «la carta» tal como hasta hoy (precio de la API de la carta base).
//
//   fila con variante  → `tcgcsvKey` = "pid|subtipo", `tcgcsvGrupo` (grupo de tcgcsv donde vive el producto), `tcgcsvPid`, `tcgcsvSub`,
//                        `varianteEtiqueta`. Se repreciea desde tcgcsv (no entra a las fases de la API de Pokémon).
//   fila EXTRA         → además `baseCardId` (la carta de la que sale) y un `cardId` propio (`<carta>~<pid>`), para que la lógica de
//                        colecciones, que busca por cardId, siga viendo UNA fila por carta.
//   fila PROMOVIDA     → la fila «hunting» de la carta que pasa a ser la variante que conseguiste (`variantePromovida`): así la
//                        colección cuenta la carta como conseguida sin crear una fila de más.
import { juegoDe, filaTiene, conSnapshot } from "./juegos.mjs";

export const esFilaVariante = f => !!f && !!f.tcgcsvKey && juegoDe(f) === "pokemon";
export const cardIdRaiz = f => (f && (f.baseCardId || f.cardId)) || null;
const CAMPOS_VARIANTE = ["tcgcsvKey", "tcgcsvGrupo", "tcgcsvPid", "tcgcsvSub", "varianteEtiqueta", "varianteTipo", "variantePromovida"];

// Filas (no vendidas) de la misma carta en la misma carpeta que la fila `fila`: la base y sus variantes
export function hermanasDe(inv, fila) {
  if (!fila) return [];
  const raiz = cardIdRaiz(fila);
  return (inv || []).filter(r => r && juegoDe(r) === "pokemon" && cardIdRaiz(r) === raiz && r.carpeta === fila.carpeta && r.estado !== "vendida");
}
// La fila original de la carta que aún no tiene variante asignada (la de siempre)
export const baseSinVariante = hermanas => hermanas.find(r => !r.tcgcsvKey && !r.baseCardId) || null;
export const filaDeVariante = (hermanas, key) => hermanas.find(r => r.tcgcsvKey === key) || null;

const precioDe = v => (v && v.market != null ? { market: v.market, low: v.low != null ? v.low : null, high: v.high != null ? v.high : null, tid: String(v.pid), variant: v.sub || null } : null);
const datosVariante = v => ({ tcgcsvKey: v.key, tcgcsvGrupo: v.grupoId || null, tcgcsvPid: v.pid, tcgcsvSub: v.sub || "", varianteEtiqueta: v.etiqueta, varianteTipo: v.tipo });
function conVariante(fila, v, hoy, extra = {}) {
  const p = precioDe(v);
  return {
    ...fila, ...datosVariante(v), ...extra,
    ...(p ? { tcgMarket: p.market, tcgLow: p.low, tcgHigh: p.high, tcgUpdated: hoy, priceHistory: conSnapshot(fila.priceHistory, p, hoy) } : {}),
  };
}
const sinVariante = fila => { const o = { ...fila }; for (const c of CAMPOS_VARIANTE) delete o[c]; return o; };

// Aplica una acción sobre la variante `v` ({key,pid,sub,etiqueta,tipo,market,low,high,grupoId}) de la carta de `fila` y devuelve el
// inventario nuevo (el MISMO arreglo si no hay nada que hacer).
//   agregar → la tengo: promueve la fila «hunting» de la carta, o crea un ejemplar nuevo
//   asignar → la fila original que ya tengo ES esta variante (no crea filas)
//   quitar  → ya no la tengo: desasigna / vuelve a hunting / quita el ejemplar extra
export function aplicarVariantePoke(inventario, { fila, v, accion, hoy }) {
  const inv = Array.isArray(inventario) ? inventario : [];
  if (!fila || !v || !v.key) return inv;
  const hs = hermanasDe(inv, fila);
  const existente = filaDeVariante(hs, v.key);
  const base = baseSinVariante(hs) || (fila.tcgcsvKey || fila.baseCardId ? null : fila);
  const reemplazar = (id, nueva) => inv.map(r => (r.id === id ? nueva : r));
  if (accion === "quitar") {
    if (!existente) return inv;
    if (existente.baseCardId) return inv.filter(r => r.id !== existente.id);                       // ejemplar extra: se va
    if (existente.variantePromovida) return reemplazar(existente.id, { ...sinVariante(existente), estado: "hunting", cantidad: 1, fechaCompra: null });
    return reemplazar(existente.id, sinVariante(existente));                                       // la fila de siempre: solo pierde la variante
  }
  if (accion === "asignar") {
    if (existente || !base || !filaTiene(base)) return inv;
    return reemplazar(base.id, conVariante(base, v, hoy));
  }
  // agregar
  if (existente) return filaTiene(existente) ? inv : reemplazar(existente.id, { ...existente, estado: "en_mano", fechaCompra: existente.fechaCompra || hoy });
  if (base && !filaTiene(base)) return reemplazar(base.id, conVariante(base, v, hoy, { estado: "en_mano", cantidad: 1, fechaCompra: hoy, variantePromovida: true }));
  const raiz = cardIdRaiz(fila);
  const o = base || fila;
  const nueva = {
    ...sinVariante(o), id: `v:${raiz}:${v.pid}:${o.carpeta}`, cardId: `${raiz}~${v.pid}`, baseCardId: raiz,
    tcgId: undefined, tcgOverride: undefined, tcgIntento: undefined, histMes: undefined, precioObjetivo: undefined,
    priceHistory: [], tcgMarket: null, tcgLow: null, tcgHigh: null, tcgUpdated: null,
    costoUSD: 0, precioVentaUSD: 0, condicion: "NM", estado: "en_mano", cantidad: 1, notas: "", fechaCompra: hoy, fechaVenta: null, precioVendidoUSD: null,
  };
  for (const k of Object.keys(nueva)) if (nueva[k] === undefined) delete nueva[k];
  return [...inv, conVariante(nueva, v, hoy)];
}

// Campos que el bot debe conocer de una fila existente cuya variante cambió ({id, _patch}); las filas nuevas se encolan enteras.
export function parcheVariante(antes, despues) {
  const out = [];
  const a = new Map((antes || []).map(f => [f.id, f]));
  for (const f of despues || []) {
    const p = a.get(f.id);
    if (!p || juegoDe(f) !== "pokemon") continue;
    if (CAMPOS_VARIANTE.slice(0, 5).some(c => (p[c] || null) !== (f[c] || null))) {
      const _patch = {}; for (const c of CAMPOS_VARIANTE.slice(0, 5)) _patch[c] = f[c] != null ? f[c] : null;
      out.push({ id: f.id, _patch });
    }
  }
  return out;
}

// ── Precios diarios desde tcgcsv (bot) ─────────────────────────────────────────────────────────
// `resultados` = lo que devuelve tcgcsv `/tcgplayer/3/{grupo}/prices` (results[]): {productId, subTypeName, marketPrice, lowPrice, highPrice}.
export function precioDeResultados(resultados, pid, sub) {
  const rs = (Array.isArray(resultados) ? resultados : []).filter(r => r && Number(r.productId) === Number(pid));
  const r = rs.find(x => (x.subTypeName || "") === (sub || "")) || (rs.length === 1 ? rs[0] : null);
  if (!r || r.marketPrice == null) return null;
  return { market: r.marketPrice, low: r.lowPrice != null ? r.lowPrice : null, high: r.highPrice != null ? r.highPrice : null, tid: String(pid), variant: sub || null };
}
export const gruposDeVariantes = inv => [...new Set((inv || []).filter(f => esFilaVariante(f) && f.estado !== "vendida" && f.tcgcsvGrupo).map(f => f.tcgcsvGrupo))];
export function actualizarPreciosPokeVariantes(inventario, porGrupo, hoy) {
  const inv = Array.isArray(inventario) ? inventario : [];
  let cambiadas = 0;
  const filas = inv.map(f => {
    if (!esFilaVariante(f) || f.estado === "vendida" || !f.tcgcsvGrupo || !porGrupo || !porGrupo[f.tcgcsvGrupo]) return f;
    const p = precioDeResultados(porGrupo[f.tcgcsvGrupo], f.tcgcsvPid, f.tcgcsvSub);
    if (!p) return f;
    const ult = (f.priceHistory || []).filter(h => h && h.date).sort((a, b) => a.date.localeCompare(b.date)).pop();
    if (f.tcgMarket === p.market && f.tcgLow === p.low && f.tcgHigh === p.high && f.tcgUpdated === hoy && ult && ult.date === hoy && ult.tid === p.tid) return f;
    cambiadas++;
    return { ...f, tcgMarket: p.market, tcgLow: p.low, tcgHigh: p.high, tcgUpdated: hoy, priceHistory: conSnapshot(f.priceHistory, p, hoy) };
  });
  return { filas: cambiadas ? filas : inv, cambiadas };
}
