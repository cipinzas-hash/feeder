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
import { mismoSet, normSet } from "./review.mjs";

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
    const rate = {};
    try { r.headers.forEach((v, k) => { if (/rate|limit|quota|remaining|reset/i.test(k)) rate[k] = v; }); } catch (e) { /* sin cabeceras */ }
    if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}`, cards: [], rate };
    const data = await r.json();
    return { ok: true, status: r.status, rate, cards: (data.data || []).map(normalizarResultado).filter(c => c.tcgId) };
  } catch (e) { return { ok: false, status: 0, error: e.message, cards: [] }; }
}

// ── Emparejar una carta del inventario con un resultado de la API ───────────────
// MISMA exigencia que la búsqueda carta por carta que ya funcionaba (fetchTCGPriceDiag): nombre normalizado IGUAL +
// número normalizado igual. Si hay varios así (reimpresiones), se prefiere el del mismo set (por código o por
// nombre); si ni así queda uno solo, no se empareja. La primera versión de esto (12-oct-2026) exigía además que el
// set coincidiera por nombre/código, pero tcgpricelookup.com nombra los sets distinto que pokemontcg.io y no
// emparejó NINGUNA carta en producción. Con designación manual (tcgOverride) se usa el nombre/número de la
// designación, que ya es tal como los devuelve esa API, y su id de set si lo tiene.
export function emparejarTcgId(carta, resultados) {
  const lista = resultados || [];
  const ov = carta?.tcgOverride;
  const nn = normName(ov ? ov.name : carta?.name), num = normNum(ov ? ov.number : carta?.number);
  if (!nn || !num) return null;
  const base = lista.filter(c => c.tcgId && normNum(c.number) === num && normName(c.name) === nn);
  if (!base.length) return null;
  if (ov) {
    const ids = [ov.setId, ov.setCode].filter(Boolean).map(x => String(x).toLowerCase());
    if (!ids.length) return base.length === 1 ? base[0] : null;
    const ok = base.filter(c => [c.setId, c.setCode].filter(Boolean).some(x => ids.includes(String(x).toLowerCase())));
    return ok.length === 1 ? ok[0] : null;
  }
  if (base.length === 1) return base[0];
  const porSet = base.filter(c => mismoSet(carta, c));
  return porSet.length === 1 ? porSet[0] : null;
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

// Cupo real que le queda a la key, leído de las cabeceras de la respuesta (x-ratelimit-remaining u otra parecida).
// null si la API no las manda.
export function cupoRestante(rate) {
  for (const [k, v] of Object.entries(rate || {})) {
    if (/remaining/i.test(k) && /day|daily|^x-ratelimit-remaining$|^ratelimit-remaining$/i.test(k.replace(/_/g, "-")) ) { const n = parseInt(v, 10); if (Number.isFinite(n)) return n; }
  }
  for (const [k, v] of Object.entries(rate || {})) if (/remaining/i.test(k)) { const n = parseInt(v, 10); if (Number.isFinite(n)) return n; }
  return null;
}

// Diagnóstico legible de una consulta de descubrimiento (los logs de Actions no se pueden leer desde fuera, el
// archivo de estado sí): qué trajo la API y, para las primeras cartas del grupo, por qué calzaron o no.
export function diagnosticarSet(grupo, respuesta) {
  const cards = respuesta?.cards || [];
  const sets = [...new Set(cards.map(c => `${c.setName || "?"} [${c.setId || "?"}/${c.setCode || "?"}]`))];
  return {
    consulta: grupo?.set, ok: !!respuesta?.ok, status: respuesta?.status ?? null, error: respuesta?.error || null, resultados: cards.length,
    setsEnRespuesta: sets.slice(0, 6), totalSetsDistintos: sets.length,
    muestra: cards.slice(0, 3).map(c => ({ name: c.name, number: c.number, setName: c.setName, setId: c.setId, setCode: c.setCode })),
    cartas: (grupo?.cartas || []).slice(0, 3).map(c => ({
      name: c.name, number: c.number, set: c.set, setCode: c.setCode,
      emparejada: !!emparejarTcgId(c, cards),
      mismoNumero: cards.filter(x => normNum(x.number) === normNum(c.number)).slice(0, 3).map(x => ({ name: x.name, number: x.number, setName: x.setName })),
    })),
  };
}
