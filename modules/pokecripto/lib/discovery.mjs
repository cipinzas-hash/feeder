// modules/pokecripto/lib/discovery.mjs  (12-oct-2026)
// Descubrimiento de tcgId por SET. Objetivo: que TODAS las cartas terminen con tcgId para que el bot las
// precie por lote (20 por consulta) en una sola fuente, en vez de 1 búsqueda por carta.
//
// Idea: una consulta de texto libre con el nombre del set devuelve hasta 100 cartas de ese set, cada una con
// su id y su precio. Una sola consulta puede entonces dar tcgId + precio a decenas de cartas del inventario.
// Lógica pura (emparejamiento, orden, presupuesto) separada de la red para probarla con node sin API.
//
// Supuestos NO verificados contra la API real (el sandbox no tiene salida a tcgpricelookup.com): que `q` con
// el nombre del set traiga cartas de ese set, y que acepte `page`. Por eso: si la paginación no aporta ids
// nuevos se corta sola, y si las primeras consultas no emparejan nada el bot desactiva el descubrimiento
// en esa corrida (ver build-pokecripto.mjs). Todo queda en el log.
import { normNum, normName, TCG_BASE } from "./pricing.mjs";
import { mismoSet, normSet, nombresCompatibles } from "./review.mjs";

export const POR_PAGINA = 100;

// Normaliza una carta devuelta por la API (misma forma que fetchTCGCandidatos).
export function normalizarResultado(c) {
  const best = c?.prices?.raw?.near_mint?.tcgplayer || c?.prices?.raw?.lightly_played?.tcgplayer;
  return {
    tcgId: c?.id || null,
    name: c?.name, number: c?.number,
    setId: c?.set?.id || null, setCode: c?.set?.ptcgoCode || null, setName: c?.set?.name || null,
    market: best?.market || null, low: best?.low || null, high: best?.high || null,
  };
}

// Una página de resultados para una consulta de texto libre.
export async function fetchTCGPagina(q, apiKey, page = 1) {
  if (!apiKey) return { ok: false, status: 0, error: "sin API key", cards: [] };
  try {
    let r, intento = 0;
    while (true) {
      const url = `${TCG_BASE}/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=${POR_PAGINA}${page > 1 ? `&page=${page}` : ""}`;
      r = await fetch(url, { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(15000) });
      if (r.status !== 429 || intento >= 2) break;
      const ra = parseInt(r.headers.get("retry-after") || "", 10);
      await new Promise(res => setTimeout(res, Number.isFinite(ra) ? ra * 1000 : 2000 * Math.pow(2, intento)));
      intento++;
    }
    if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}`, cards: [] };
    const data = await r.json();
    return { ok: true, status: r.status, cards: (data.data || []).map(normalizarResultado).filter(c => c.tcgId) };
  } catch (e) { return { ok: false, status: 0, error: e.message, cards: [] }; }
}

// ── Emparejar una carta del inventario con un resultado de la API ───────────────
// Estricto: número igual + set coincidente (código o nombre normalizado) + nombre compatible. Sin datos de
// set en el resultado NO se empareja (en una búsqueda por set no hay con qué contrastar). Si la carta tiene una
// designación manual (tcgOverride, que ya es el candidato exacto elegido a mano en esa API), se empareja por
// ESA designación: nombre y número tal cual los devuelve la API, y el id/código de set guardado.
export function emparejarTcgId(carta, resultados) {
  const ov = carta?.tcgOverride;
  const lista = resultados || [];
  if (ov) {
    const on = normNum(ov.number), nn = normName(ov.name);
    const ok = lista.filter(c => normNum(c.number) === on && normName(c.name) === nn &&
      (!(ov.setId || ov.setCode) || [c.setId, c.setCode].filter(Boolean).some(x => [ov.setId, ov.setCode].filter(Boolean).some(y => String(x).toLowerCase() === String(y).toLowerCase()))));
    return ok.length === 1 ? ok[0] : null;
  }
  const num = normNum(carta?.number);
  if (!num || !normName(carta?.name)) return null;
  const ok = lista.filter(c => normNum(c.number) === num && (c.setId || c.setCode || c.setName) &&
    mismoSet(carta, c) && nombresCompatibles(carta.name, c.name));
  if (ok.length === 1) return ok[0];
  const exactos = ok.filter(c => normName(c.name) === normName(carta.name));
  return exactos.length === 1 ? exactos[0] : null;
}

// Asigna a cada carta sin tcgId su resultado, si lo hay. Devuelve Map(idCarta -> resultado).
export function asignarTcgIds(cartas, resultados) {
  const out = new Map();
  for (const c of cartas || []) {
    const m = emparejarTcgId(c, resultados);
    if (m) out.set(c.id, m);
  }
  return out;
}

// ── Grupos por set y orden de trabajo ───────────────────────────────────────
// Un grupo = las cartas SIN tcgId de un mismo set. Orden: primero los que tienen cartas de Price Watch o sin
// precio (urgentes), luego los más grandes (más cartas resueltas por consulta).
export function agruparPorSet(cartas) {
  const grupos = new Map();
  for (const c of cartas || []) {
    const clave = normSet(c.set) || String(c.setCode || "").toLowerCase();
    if (!clave || !c.set) continue; // sin nombre de set no hay con qué consultar
    if (!grupos.has(clave)) grupos.set(clave, { clave, set: c.set, cartas: [] });
    grupos.get(clave).cartas.push(c);
  }
  const urg = g => g.cartas.some(c => c.carpeta === "Price Watch") ? 2 : g.cartas.some(c => !c.tcgMarket) ? 1 : 0;
  return [...grupos.values()].sort((a, b) => urg(b) - urg(a) || b.cartas.length - a.cartas.length);
}

// Páginas necesarias para cubrir el número más alto del set que necesitamos (la API da hasta 100 por página).
export function paginasNecesarias(grupo, maxPaginas = 4) {
  const nums = grupo.cartas.map(c => parseInt(String(c.number).match(/\d+/)?.[0], 10)).filter(Number.isFinite);
  const mayor = nums.length ? Math.max(...nums) : POR_PAGINA;
  return Math.max(1, Math.min(maxPaginas, Math.ceil(mayor / POR_PAGINA)));
}

// Un set no se reintenta hasta `reintentarDespuesDe` (lo fija el bot al terminar cada intento: +7 días si quedaron
// cartas sin emparejar, +21 si ya van dos intentos sin encontrar NADA). Así las cartas que la API simplemente no
// tiene no gastan consultas todos los días.
export function sumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function debeSaltarse(estadoSet, hoy) {
  return !!(estadoSet && estadoSet.reintentarDespuesDe && hoy < estadoSet.reintentarDespuesDe);
}
export function actualizarEstadoSet(previo, { set, hoy, encontradas, restantes }) {
  const intentos = (previo?.intentos || 0) + 1;
  const acumuladas = (previo?.encontradas || 0) + encontradas;
  const dias = restantes <= 0 ? 0 : (encontradas === 0 && intentos >= 2 && acumuladas === 0 ? 21 : 7);
  return { set, fecha: hoy, intentos, encontradas: acumuladas, restantes, reintentarDespuesDe: dias ? sumarDias(hoy, dias) : null };
}

// Presupuesto de consultas de descubrimiento para esta corrida: lo que sobra del tope diario después de las
// consultas por lote que ya hacen falta y de una reserva para las búsquedas carta por carta.
export function presupuestoDescubrimiento({ reserva, cartasConTcgId, batchTam = 20, batchMax = 65, reservaIndividual = 8, tope = 40, sinTcgId = 0 }) {
  if (!sinTcgId) return 0;
  const lotes = Math.min(batchMax, Math.ceil(cartasConTcgId / batchTam));
  return Math.max(0, Math.min(tope, reserva - lotes - reservaIndividual));
}
