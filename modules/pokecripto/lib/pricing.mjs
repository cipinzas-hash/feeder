// modules/pokecripto/lib/pricing.mjs
// Extraído de PokecriptoPage.jsx (7-sep-2026, issue #9) para que
// build-pokecripto.mjs (bot autónomo, corre en GitHub Actions) y el cliente
// usen exactamente la misma lógica de precio/matching -- mismo criterio que
// enrich.mjs para Vitrina/Simkl. Sin cambios de comportamiento respecto al
// código original, solo movida de lugar y sin JSX/React.

export const POKE_BASE = "https://api.pokemontcg.io/v2";
export const TCG_BASE = "https://api.tcgpricelookup.com/v1";

export async function fetchPoke(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

export function getPrimaryPrice(card) {
  const p = card?.tcgplayer?.prices;
  if (!p) return null;
  const priority = ["holofoil", "reverseHolofoil", "normal", "1stEditionHolofoil", "unlimitedHolofoil", "1stEdition", "unlimited"];
  for (const k of priority) { if (p[k]?.market) return { market: p[k].market, low: p[k].low, high: p[k].high }; }
  const first = Object.entries(p).find(([, v]) => v?.market);
  return first ? { market: first[1].market, low: first[1].low, high: first[1].high } : null;
}

// Normaliza un número de colección para comparar: pokemontcg.io da solo el
// número ("116"), tcgpricelookup.com lo manda con el total del set pegado
// ("116/084") -- nos quedamos solo con la parte antes de la barra. Después
// sacamos ceros a la izquierda y cualquier caracter no alfanumérico
// (letras de secret rare tipo "116a" quedan intactas).
export function normNum(n) {
  const antesDeBarra = String(n || "").trim().split("/")[0];
  return antesDeBarra.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^0+(?=\d)/, "");
}
// Mismo criterio para el nombre: pokemontcg.io y tcgpricelookup.com pueden
// diferir en espacios dobles, guiones (- vs – vs —), may/minúscula de "ex"/
// "EX", o acentos -- nada de eso debería impedir el match si el número ya
// lo ancla a la carta correcta. tcgpricelookup.com además le pega el número
// al nombre para distinguir variantes/alt-arts ("Mega Darkrai ex -
// 116/084"), así que primero se saca ese sufijo antes de normalizar.
export function normName(s) {
  return String(s || "")
    .replace(/\s*[-–—]\s*\d+\/\d+\s*$/, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Versión con diagnóstico completo -- devuelve además la query mandada, los
// candidatos que trajo tcgpricelookup.com, y por qué no matcheó ninguno.
export async function fetchTCGPriceDiag(name, setName, number, setCode, apiKey) {
  if (!apiKey) return { error: "sin API key" };
  try {
    // setCode (ej. "me4") es un ID interno de catálogo, no necesariamente
    // el código real que tcgpricelookup.com indexa como texto buscable --
    // meterlo en la query de texto libre puede degradar la relevancia en
    // vez de ayudar (encontrado 9-sep-2026 con cartas de sets nuevos tipo
    // Chaos Rising que TCGPlayer sí tenía con precio, pero acá no
    // matcheaban). Se sigue usando setCode más abajo, pero solo para
    // FILTRAR candidatos ya encontrados por nombre+número, nunca como
    // término de búsqueda.
    let q = number ? `${name} ${number}` : name;
    // Confirmado con el botón de diagnóstico del cliente (10-sep-2026,
    // Drapion 97 -> HTTP 429): tcgpricelookup.com rate-limitea más agresivo
    // que pokemontcg.io, y el bot le pega varias veces seguidas cuando hay
    // varias cartas consecutivas sin cardId resuelto (todas caen al
    // fallback, sin el respiro del throttle de pokemontcg.io que solo
    // corre cuando el primario responde). 3 intentos con backoff,
    // respetando Retry-After si lo manda.
    let r, intento = 0;
    while (true) {
      // limit=100 (4-oct-2026): con 20, los nombres comunes (Pikachu, Ultra Ball) llenaban los
      // resultados con otros sets y la carta buscada quedaba fuera. Es la misma 1 consulta del cupo.
      r = await fetch(`${TCG_BASE}/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=100`,
        { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(8000) });
      if (r.status !== 429 || intento >= 2) break;
      const retryAfter = parseInt(r.headers.get("retry-after") || "", 10);
      const esperaMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000 * Math.pow(2, intento);
      await new Promise(res => setTimeout(res, esperaMs));
      intento++;
    }
    if (!r.ok) return { error: `HTTP ${r.status}`, query: q };
    const data = await r.json();
    const cards = data.data || [];
    const nameNorm = normName(name), numNorm = normNum(number);
    const setCodeLow = (setCode || "").toLowerCase();
    // Solo matcheamos con nombre+número (+setCode si lo tenemos). Nada de
    // fallback por nombre solo o por prefijo de set -- eso generaba
    // snapshots de la variante equivocada. Preferimos no tener precio a
    // tener uno contaminado.
    const match =
      (number && setCode && cards.find(c => normName(c.name) === nameNorm && normNum(c.number) === numNorm && (c.set?.ptcgoCode?.toLowerCase() === setCodeLow || c.set?.id?.toLowerCase() === setCodeLow))) ||
      (number && cards.find(c => normName(c.name) === nameNorm && normNum(c.number) === numNorm));
    const candidatos = cards.slice(0, 10).map(c => {
      const nm = c.prices?.raw?.near_mint?.tcgplayer, lp = c.prices?.raw?.lightly_played?.tcgplayer;
      const best = nm || lp;
      return { name: c.name, number: c.number, setId: c.set?.id, setCode: c.set?.ptcgoCode, tieneRaw: !!best, market: best?.market || null, low: best?.low || null, high: best?.high || null };
    });
    if (!match) return { query: q, candidatos, matchEncontrado: false };
    const nm = match.prices?.raw?.near_mint?.tcgplayer, lp = match.prices?.raw?.lightly_played?.tcgplayer;
    const best = nm || lp;
    return {
      query: q, candidatos, matchEncontrado: true,
      matchNombre: match.name, matchNumero: match.number,
      tcgId: match.id || null, // UUID de la carta: permite precios por lote en las próximas corridas
      preciosDisponibles: Object.keys(match.prices || {}),
      tienePrecioTcgplayer: !!best,
      match: best?.market ? true : false,
      market: best?.market, low: best?.low || null, high: best?.high || null,
    };
  } catch (e) { return { error: e.message }; }
}

// ── Precios por lote (4-oct-2026) ───────────────────────────────────────
// La API de tcgpricelookup.com acepta `ids=a,b,c…` (hasta 20 UUID por consulta): con el tcgId guardado de
// cada carta, 20 cartas cuestan UNA consulta del cupo diario (100) en vez de veinte. Así los snapshots
// diarios de cientos de cartas caben en el cupo gratis.
// Si la API responde con error de plan/credencial (401/402/403) o de otro tipo, se devuelve {ok:false}
// y quien llama debe volver al método carta por carta sin reventar la corrida.
export function precioDeApi(c) {
  const nm = c?.prices?.raw?.near_mint?.tcgplayer, lp = c?.prices?.raw?.lightly_played?.tcgplayer;
  const best = nm || lp;
  return best?.market ? { market: best.market, low: best.low || null, high: best.high || null } : null;
}
export async function fetchTCGBatch(ids, apiKey) {
  const lista = [...new Set((ids || []).filter(Boolean))].slice(0, 20);
  if (!apiKey) return { ok: false, status: 0, error: "sin API key" };
  if (!lista.length) return { ok: true, porId: new Map(), pedidos: 0, status: 200, rate: {} };
  try {
    let r, intento = 0;
    while (true) {
      r = await fetch(`${TCG_BASE}/cards/search?ids=${encodeURIComponent(lista.join(","))}&game=pokemon&limit=20`,
        { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(15000) });
      if (r.status !== 429 || intento >= 2) break;
      const retryAfter = parseInt(r.headers.get("retry-after") || "", 10);
      await new Promise(res => setTimeout(res, Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000 * Math.pow(2, intento)));
      intento++;
    }
    // Cabeceras de cupo, para saber cuánto consume realmente una consulta por lote.
    const rate = {};
    try { r.headers.forEach((v, k) => { if (/rate|limit|quota|remaining|reset/i.test(k)) rate[k] = v; }); } catch (e) { /* sin cabeceras */ }
    if (!r.ok) {
      let detalle = "";
      try { detalle = (await r.text()).slice(0, 160); } catch (e) { /* sin cuerpo */ }
      return { ok: false, status: r.status, error: `HTTP ${r.status}${detalle ? " " + detalle : ""}`, rate };
    }
    const data = await r.json();
    const porId = new Map();
    for (const c of (data.data || [])) if (c?.id) porId.set(c.id, { ...(precioDeApi(c) || {}), tieneCarta: true, setKeys: c.set ? Object.keys(c.set) : [] });
    return { ok: true, porId, pedidos: lista.length, status: r.status, rate };
  } catch (e) { return { ok: false, status: 0, error: e.message }; }
}

// Búsqueda de candidatos para el flujo de revisión (3-oct-2026): devuelve
// TODOS los resultados de UNA consulta (hasta 100: el máximo que admite la API; con 20 los nombres
// comunes como Pikachu o Ultra Ball se llenaban de otros sets y la carta buscada quedaba fuera), ya normalizados. Una llamada = una de
// las 100 consultas diarias de tcgpricelookup.com; el reintento por 429
// respeta Retry-After igual que fetchTCGPriceDiag.
export async function fetchTCGCandidatos(q, apiKey) {
  if (!apiKey) return { error: "sin API key", candidatos: [] };
  try {
    let r, intento = 0;
    while (true) {
      r = await fetch(`${TCG_BASE}/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=100`,
        { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(8000) });
      if (r.status !== 429 || intento >= 2) break;
      const retryAfter = parseInt(r.headers.get("retry-after") || "", 10);
      await new Promise(res => setTimeout(res, Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000 * Math.pow(2, intento)));
      intento++;
    }
    if (!r.ok) return { error: `HTTP ${r.status}`, query: q, candidatos: [] };
    const data = await r.json();
    const candidatos = (data.data || []).map(c => {
      const best = c.prices?.raw?.near_mint?.tcgplayer || c.prices?.raw?.lightly_played?.tcgplayer;
      return {
        tcgId: c.id || null, // UUID de la carta en tcgpricelookup.com
        name: c.name, number: c.number,
        setId: c.set?.id || null, setCode: c.set?.ptcgoCode || null, setName: c.set?.name || null,
        market: best?.market || null, low: best?.low || null, high: best?.high || null,
        // Para diagnosticar "calzó nombre y número pero sin precio": qué precios sí trae la API
        // (ej. raw.moderately_played.tcgplayer). Solo informativo; el precio que se usa sigue siendo NM/LP.
        preciosDisponibles: Object.entries(c.prices || {}).flatMap(([grupo, v]) =>
          (v && typeof v === "object")
            ? Object.entries(v).flatMap(([cond, fuentes]) => (fuentes && typeof fuentes === "object")
                ? Object.keys(fuentes).map(f => `${grupo}.${cond}.${f}`) : [`${grupo}.${cond}`])
            : [grupo]).slice(0, 8),
        // la API no documenta si trae foto: si la trae se usa primero, si no se arma por set+número
        image: c.image || c.image_url || c.imageUrl || c.images?.small || c.images?.large || null,
      };
    });
    return { query: q, candidatos };
  } catch (e) { return { error: e.message, query: q, candidatos: [] }; }
}

export async function fetchTCGPrice(name, setName, number, setCode, apiKey) {
  const price = await fetchTCGPriceDiag(name, setName, number, setCode, apiKey);
  return price?.match ? { market: price.market, low: price.low, high: price.high, tcgId: price.tcgId || null } : null;
}

// src (12-oct-2026): fuente del precio. "tpl" = tcgpricelookup.com (Near Mint raw de TCGplayer),
// "ptcg" = pokemontcg.io (primer precio disponible: holofoil > reverse > normal...). Son criterios distintos:
// mezclados en un mismo historial producían alternancias falsas (0,06 -> 0,26 -> 0,06 en cartas comunes).
// Sin src = snapshot viejo, de fuente desconocida.
export function addSnapshot(history, market, low, high, dateISO, src) {
  const today = dateISO || new Date().toISOString().slice(0, 10);
  const h = history || [];
  const extra = src ? { src } : {};
  if (h.length && h[h.length - 1].date === today)
    return h.map((x, i) => i === h.length - 1 ? { ...x, market, low, high, ...extra } : x);
  return [...h, { date: today, market, low: low || null, high: high || null, ...extra }];
}
// Compactación del historial (issue #27, pedido de Cristopher 25-oct-2026): lo de los últimos `diasDiarios` días queda
// diario; cada mes anterior se reduce a UN punto = promedio del mes (market, ponderado por n), low mínimo, high máximo.
// `agg:true` marca el punto mensual y `n` cuántos snapshots resume; la fecha es la del último snapshot resumido.
// Idempotente: volver a correrla sobre un historial ya compactado no cambia nada, y si el mes sigue abierto en la
// frontera de los 30 días, los puntos diarios que entran a la ventana se suman al mensual con el peso correcto.
export function compactarHistorial(history, hoyISO, diasDiarios = 30) {
  const h = Array.isArray(history) ? history : [];
  if (h.length < 2) return h;
  const corte = new Date(hoyISO + "T12:00:00Z"); corte.setUTCDate(corte.getUTCDate() - diasDiarios);
  const corteISO = corte.toISOString().slice(0, 10);
  const recientes = [], porMes = new Map();
  const orden = [...h].filter(p => p && p.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const ultimo = orden[orden.length - 1];
  for (const p of orden) {
    // el último snapshot queda siempre tal cual (es el que respalda tcgMarket), aunque tenga más de 30 días
    if (p.date >= corteISO || (p === ultimo && !p.agg)) { recientes.push(p); continue; }
    const m = String(p.date).slice(0, 7);
    if (!porMes.has(m)) porMes.set(m, []);
    porMes.get(m).push(p);
  }
  const num = x => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const meses = [];
  for (const pts of porMes.values()) {
    if (pts.length === 1 && pts[0].agg) { meses.push(pts[0]); continue; }
    let n = 0, suma = 0, nPrecio = 0, low = null, high = null;
    const srcs = new Set();
    for (const p of pts) {
      const w = p.agg && p.n > 0 ? p.n : 1;
      const mk = num(p.market);
      if (mk != null) { suma += mk * w; nPrecio += w; }
      const lo = num(p.low), hi = num(p.high);
      if (lo != null && (low == null || lo < low)) low = lo;
      if (hi != null && (high == null || hi > high)) high = hi;
      n += w; srcs.add(p.src || "");
    }
    const agg = { date: pts[pts.length - 1].date, market: nPrecio ? Math.round((suma / nPrecio) * 100) / 100 : null, low, high, n, agg: true };
    if (srcs.size === 1 && [...srcs][0]) agg.src = [...srcs][0];
    meses.push(agg);
  }
  return [...meses, ...recientes];
}
// Dos snapshots son comparables si alguno es viejo (sin src, no se puede saber) o si vienen de la misma fuente.
export function fuenteCompatible(a, b) {
  return !a?.src || !b?.src || a.src === b.src;
}

// Un solo refresh de precio para una carta -- pokemontcg.io (gratis, sin
// key, primario) primero, tcgpricelookup.com (con key, cupo diario real)
// como respaldo solo si el primario no trajo nada. No persiste nada --
// eso lo decide quien llama (el bot arma el JSON completo, el cliente
// actualiza su propio estado React).
//
// tcgOverride (26-sep-2026, designación manual desde el panel de
// diagnóstico): si la carta tiene guardado el candidato exacto que
// Cristopher eligió a mano en tcgpricelookup.com (name/number/setId,
// tal como los devuelve esa API), se usa ESO en vez de carta.name/number/
// setCode para la búsqueda de respaldo -- evita depender del matching
// automático que ya sabemos que le falla a estas cartas puntuales.
//
// permitirFallback (28-sep-2026): el bot decidía de antemano si una
// carta iba a necesitar el respaldo mirando solo si tenía cardId --
// pero una carta CON cardId cuyo precio en pokemontcg.io viene vacío
// (bastante común en sets muy nuevos) también cae acá, sin que nada la
// frenara si el cupo real ya se había gastado. Ahora el bot puede cortar
// el respaldo desde afuera, carta por carta, según el cupo que le quede
// en ESE momento -- no según de antemano.
export async function refreshPrecio(carta, apiKey, permitirFallback = true, opts = {}) {
  let market = null, low = null, high = null, fuente = null, tcgId = null, usoTcg = false, src = null;
  // usarTcgId (12-oct-2026): el cliente, al refrescar UNA carta que ya tiene tcgId, la pide directo por id
  // (sin ambigüedad de matching). El bot NO lo usa: sus cartas con tcgId ya pasaron por la fase por lote.
  if (opts.usarTcgId && carta.tcgId && apiKey) {
    usoTcg = true;
    const r = await fetchTCGBatch([carta.tcgId], apiKey);
    const p = r.ok ? r.porId.get(carta.tcgId) : null;
    if (p?.market) { market = p.market; low = p.low || null; high = p.high || null; fuente = "tcgpricelookup(id)"; tcgId = carta.tcgId; src = "tpl"; }
    if (market) return { market, low, high, fuente, tcgId, usoTcg, src };
  }
  // soloTcg (15-oct-2026): pokemontcg.io solo da el PRIMER precio de una carta recién agregada. Una carta que ya tiene
  // snapshots de tcgpricelookup se refresca solo en esa fuente, para no volver a mezclar criterios en su historial.
  if (carta.cardId && !opts.soloTcg) {
    try {
      const data = await fetchPoke(`${POKE_BASE}/cards/${carta.cardId}`);
      const pp = getPrimaryPrice(data.data);
      if (pp?.market) { market = pp.market; low = pp.low || null; high = pp.high || null; fuente = "pokemontcg"; src = "ptcg"; }
    } catch (e) { /* cae a tcgpricelookup */ }
  }
  if (!market && permitirFallback) {
    // usoTcg: se hizo una búsqueda REAL a tcgpricelookup.com (gasta cupo aunque no encuentre nada).
    usoTcg = usoTcg || !!apiKey;
    const ov = carta.tcgOverride;
    const p = ov
      ? await fetchTCGPrice(ov.name, carta.set, ov.number, ov.setId || ov.setCode, apiKey)
      : await fetchTCGPrice(carta.name, carta.set, carta.number, carta.setCode, apiKey);
    if (p?.market) { market = p.market; low = p.low || null; high = p.high || null; fuente = ov ? "tcgpricelookup(override)" : "tcgpricelookup"; tcgId = p.tcgId || null; src = "tpl"; }
  }
  return { market, low, high, fuente, tcgId, usoTcg, src };
}
