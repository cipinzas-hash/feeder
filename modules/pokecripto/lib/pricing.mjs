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
    const r = await fetch(`${TCG_BASE}/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=20`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(8000) });
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
    const candidatos = cards.slice(0, 10).map(c => ({ name: c.name, number: c.number, setId: c.set?.id, setCode: c.set?.ptcgoCode, tieneRaw: !!c.prices?.raw }));
    if (!match) return { query: q, candidatos, matchEncontrado: false };
    const nm = match.prices?.raw?.near_mint?.tcgplayer, lp = match.prices?.raw?.lightly_played?.tcgplayer;
    const best = nm || lp;
    return {
      query: q, candidatos, matchEncontrado: true,
      matchNombre: match.name, matchNumero: match.number,
      preciosDisponibles: Object.keys(match.prices || {}),
      tienePrecioTcgplayer: !!best,
      match: best?.market ? true : false,
      market: best?.market, low: best?.low || null, high: best?.high || null,
    };
  } catch (e) { return { error: e.message }; }
}

export async function fetchTCGPrice(name, setName, number, setCode, apiKey) {
  const price = await fetchTCGPriceDiag(name, setName, number, setCode, apiKey);
  return price?.match ? { market: price.market, low: price.low, high: price.high } : null;
}

export function addSnapshot(history, market, low, high, dateISO) {
  const today = dateISO || new Date().toISOString().slice(0, 10);
  const h = history || [];
  if (h.length && h[h.length - 1].date === today)
    return h.map((x, i) => i === h.length - 1 ? { ...x, market, low, high } : x);
  return [...h, { date: today, market, low: low || null, high: high || null }];
}

// Un solo refresh de precio para una carta -- pokemontcg.io (gratis, sin
// key, primario) primero, tcgpricelookup.com (con key, cupo diario real)
// como respaldo solo si el primario no trajo nada. No persiste nada --
// eso lo decide quien llama (el bot arma el JSON completo, el cliente
// actualiza su propio estado React).
export async function refreshPrecio(carta, apiKey) {
  let market = null, low = null, high = null, fuente = null;
  if (carta.cardId) {
    try {
      const data = await fetchPoke(`${POKE_BASE}/cards/${carta.cardId}`);
      const pp = getPrimaryPrice(data.data);
      if (pp?.market) { market = pp.market; low = pp.low || null; high = pp.high || null; fuente = "pokemontcg"; }
    } catch (e) { /* cae a tcgpricelookup */ }
  }
  if (!market) {
    const p = await fetchTCGPrice(carta.name, carta.set, carta.number, carta.setCode, apiKey);
    if (p?.market) { market = p.market; low = p.low || null; high = p.high || null; fuente = "tcgpricelookup"; }
  }
  return { market, low, high, fuente };
}
