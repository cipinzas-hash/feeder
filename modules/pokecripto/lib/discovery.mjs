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
    variant: c?.variant || null, rarity: c?.rarity || null,
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
// La API devuelve UNA fila por variante de impresión (misma carta, mismo tcgplayer_id, `variant`: Normal / Holofoil /
// Reverse Holofoil...; diagnóstico del 26-oct-2026: Chaos Rising tiene 122 cartas pero 284 filas). Antes, dos filas con
// el mismo nombre+número dejaban la carta "ambigua" y sin tcgId: causa principal de que la búsqueda individual
// resolviera 3 de 66. La carta del inventario no distingue variantes, así que se toma la impresión base: Normal, si no
// Holofoil; si solo queda una que no sea Reverse Holofoil, esa; si no se puede decidir, no se empareja.
export function elegirVariante(cands) {
  const lista = cands || [];
  if (lista.length === 1) return lista[0];
  for (const v of ["normal", "holofoil"]) {
    const m = lista.filter(c => String(c.variant || "").toLowerCase() === v);
    if (m.length === 1) return m[0];
    if (m.length > 1) return null;
  }
  const noRev = lista.filter(c => !/reverse/i.test(String(c.variant || "")));
  return noRev.length === 1 ? noRev[0] : null;
}

// opts.setSeguro: los resultados vienen de una consulta filtrada por el set de la carta (`set=<slug>`), así que no hay
// que contrastar el set por nombre/código (cada API los nombra distinto).
export function emparejarTcgId(carta, resultados, opts = {}) {
  const lista = resultados || [];
  const ov = carta?.tcgOverride;
  const nn = normName(ov ? ov.name : carta?.name), num = normNum(ov ? ov.number : carta?.number);
  if (!nn || !num) return null;
  const base = lista.filter(c => c.tcgId && normNum(c.number) === num && normName(c.name) === nn);
  if (!base.length) return null;
  if (ov) {
    const ids = [ov.setId, ov.setCode].filter(Boolean).map(x => String(x).toLowerCase());
    if (!ids.length) return elegirVariante(base);
    const ok = base.filter(c => [c.setId, c.setCode].filter(Boolean).some(x => ids.includes(String(x).toLowerCase())));
    return elegirVariante(ok);
  }
  if (opts.setSeguro) return elegirVariante(base);
  if (base.length === 1) return base[0];
  const porSet = base.filter(c => mismoSet(carta, c));
  if (!porSet.length && new Set(base.map(c => c.setId || c.setName)).size === 1) return elegirVariante(base); // solo variantes de UN set
  return elegirVariante(porSet);
}

// Asigna a cada carta sin tcgId su resultado, si lo hay. Devuelve Map(idCarta -> resultado).
// Guarda (issue #27): un tcgId es UNA carta de UN set. Si ya lo tiene otra carta distinta (otro cardId) no se asigna;
// dos filas de inventario con el mismo cardId (misma carta en varias colecciones) sí comparten tcgId.
// opts.tomados: Map(tcgId -> cardId) con lo ya asignado en el inventario; se actualiza al asignar.
export function claveCarta(c) { return String(c?.cardId || c?.id || ""); }
export function asignarTcgIds(cartas, resultados, opts = {}) {
  const out = new Map();
  const tomados = opts.tomados || new Map();
  for (const c of cartas || []) {
    const m = emparejarTcgId(c, resultados, opts);
    if (!m) continue;
    const dueno = tomados.get(m.tcgId);
    if (dueno && dueno !== claveCarta(c)) continue;
    tomados.set(m.tcgId, claveCarta(c));
    out.set(c.id, m);
  }
  return out;
}

// ── Descubrimiento por `set` REAL (issue #27, verificado el 26-oct-2026 con diagnostico-tcg.mjs) ──────────────────────
// GET /sets?game=pokemon&limit=100&offset=N -> {data:[{id,slug,name,count}], total, limit, offset}; 225 sets, `slug` tipo
// "pokemon--me04-chaos-rising". GET /cards/search?set=<slug>&game=pokemon&limit=100&offset=N lista ESE set (no el texto
// libre `q`, que devolvía productos sellados). `count` incluye variantes y productos sellados. La API tiene un límite de
// ráfaga de 1 consulta a la vez (429 sin cabecera de cupo): pausa de PAUSA_RAFAGA_MS entre consultas y reintento por 429.
export const PAUSA_RAFAGA_MS = Number((typeof process !== "undefined" && process.env?.POKECRIPTO_PAUSA_RAFAGA_MS) ?? 2500);
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function getTCG(path, apiKey, timeoutMs = 20000) {
  let r, intento = 0;
  while (true) {
    r = await fetch(`${TCG_BASE}${path}`, { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(timeoutMs) });
    if (r.status !== 429 || intento >= 3) break;
    const ra = parseInt(r.headers.get("retry-after") || "", 10);
    await dormir(Number.isFinite(ra) ? ra * 1000 : PAUSA_RAFAGA_MS * (intento + 1));
    intento++;
  }
  const rate = {};
  try { r.headers.forEach((v, k) => { if (/rate|limit|quota|remaining|reset/i.test(k)) rate[k] = v; }); } catch (e) { /* sin cabeceras */ }
  if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}`, rate };
  return { ok: true, status: r.status, rate, json: await r.json() };
}
// Lista completa de sets (pagina de a 100). OJO (diagnóstico v4, 26-oct-2026): /sets es LENTO (20-30+ s por página, a veces
// agota 20-30 s) mientras /cards/search?set= responde en ~0,3 s. Por eso 75 s de espera y un reintento por página; si alguna
// página falla la lista NO se devuelve como buena (una lista parcial dejaría sets sin slug). Se pide 1 vez cada 7 días.
export async function fetchTCGSets(apiKey) {
  if (!apiKey) return { ok: false, error: "sin API key", sets: [], llamadas: 0 };
  const sets = []; let llamadas = 0, offset = 0, total = Infinity, rate = {};
  try {
    while (offset < total && llamadas < 8) {
      let r = null;
      for (let intento = 0; intento < 2 && !(r && r.ok); intento++) {
        try { r = await getTCG(`/sets?game=pokemon&limit=100${offset ? `&offset=${offset}` : ""}`, apiKey, 75000); }
        catch (e) { r = { ok: false, status: 0, error: e.message, rate: {} }; }
        llamadas++; rate = r.rate && Object.keys(r.rate).length ? r.rate : rate;
        if (!r.ok) await dormir(PAUSA_RAFAGA_MS);
      }
      if (!r.ok) return { ok: false, status: r.status, error: r.error, sets: [], llamadas, rate };
      const lote = r.json?.data || [];
      sets.push(...lote.map(s => ({ id: s.id, slug: s.slug, name: s.name, count: s.count ?? null })));
      total = r.json?.total ?? sets.length;
      if (!lote.length) break;
      offset += lote.length;
      await dormir(PAUSA_RAFAGA_MS);
    }
    return { ok: true, sets, llamadas, rate };
  } catch (e) { return { ok: false, error: e.message, sets: [], llamadas, rate }; }
}
// Una página de un set (hasta 100 filas, cada una una variante de impresión).
export async function fetchTCGSetPagina(slug, apiKey, offset = 0) {
  if (!apiKey || !slug) return { ok: false, status: 0, error: "sin API key o slug", cards: [] };
  try {
    const r = await getTCG(`/cards/search?set=${encodeURIComponent(slug)}&game=pokemon&limit=${POR_PAGINA}${offset ? `&offset=${offset}` : ""}`, apiKey);
    if (!r.ok) return { ok: false, status: r.status, error: r.error, cards: [], rate: r.rate };
    const data = r.json || {};
    return { ok: true, status: r.status, rate: r.rate, total: data.total ?? null, cards: (data.data || []).map(normalizarResultado).filter(c => c.tcgId) };
  } catch (e) { return { ok: false, status: 0, error: e.message, cards: [] }; }
}
// Nombre del set en la API ("ME04: Chaos Rising", "EX Delta Species") -> nombre del inventario (pokemontcg.io: "Chaos Rising").
function plano(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
const sinCodigo = n => String(n || "").replace(/^[A-Za-z]{1,5}\d{0,3}(?:pt\d+)?\s*:\s*/, "");
// Sets cuyo nombre en pokemontcg.io no se parece al de la API (primera corrida real, 27-oct-2026: 11 sets sin slug).
// Clave = nombre del inventario en forma plana; valor = slug exacto de la API (se ignora si ese slug no está en la lista).
const ALIAS_SETS = {
  expeditionbaseset: "pokemon--expedition",
  "151": "pokemon--sv-scarlet-and-violet-151",
  sunmoon: "pokemon--sm-base-set",
  xy: "pokemon--xy-base-set",
  scarletviolet: "pokemon--sv01-scarlet-and-violet-base-set",
  swordshield: "pokemon--swsh01-sword-and-shield-base-set",
  scarletvioletblackstarpromos: "pokemon--sv-scarlet-and-violet-promo-cards",
  bwblackstarpromos: "pokemon--black-and-white-promos",
};
const sinSerieInv = n => String(n || "").replace(/^[A-Za-z]{1,5}\d{0,3}\s*[—–]\s*/, ""); // "HS—Undaunted" -> "Undaunted"
export function slugParaSet(nombreSet, sets) {
  const lista = sets || [];
  const objetivo = plano(sinSerieInv(nombreSet));
  if (!objetivo) return null;
  const alias = ALIAS_SETS[plano(nombreSet)];
  if (alias) return lista.find(s => s.slug === alias) || null;
  const exactos = lista.filter(s => plano(sinCodigo(s.name)) === objetivo || plano(s.name) === objetivo);
  if (exactos.length === 1) return exactos[0];
  if (exactos.length > 1) return null; // ambiguo (dos sets con el mismo nombre): no se adivina
  const termina = lista.filter(s => plano(s.name).endsWith(objetivo) && objetivo.length >= 6);
  return termina.length === 1 ? termina[0] : null;
}
// Consultas que cuesta cubrir un set entero (cada página son hasta 100 filas, `count` incluye variantes y sellados).
export function paginasDeSet(set) { return Math.max(1, Math.ceil((set?.count || POR_PAGINA) / POR_PAGINA)); }

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
