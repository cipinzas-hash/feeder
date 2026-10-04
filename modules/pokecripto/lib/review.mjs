// modules/pokecripto/lib/review.mjs
// Lógica pura (sin React ni red) del flujo "revisión de cartas sin precio"
// (3-oct-2026, a pedido de Cristopher: recorrer los candidatos de a uno,
// descartar con "No es" hasta que calce la numeración, y que la elección
// la use el bot todos los días). Vive acá, separada de PokecriptoPage.jsx,
// para poder probarla con node sin navegador (tests/pokecripto-review.mjs)
// y para que el bot (build-pokecripto.mjs) use exactamente la misma lógica
// de overrides que el cliente.
import { normNum, normName } from "./pricing.mjs";

// ── Precios del bot sobre el inventario local ───────────────────────────
// ANTES (bug encontrado 3-oct-2026): el cliente superponía los 5 campos de
// precio de TODAS las cartas del archivo del bot, incluso las que el bot no
// había podido preciar (tcgMarket null) -- eso borraba al abrir el módulo
// cualquier precio que Cristopher hubiera elegido a mano. AHORA: solo se
// superpone cuando el bot SÍ tiene precio para esa carta; si no, el local
// queda intacto.
export function mergePreciosBot(local, remote) {
  const porId = new Map();
  for (const c of (Array.isArray(remote) ? remote : [])) {
    if (!c || c.id == null || c.tcgMarket == null) continue;
    porId.set(c.id, {
      tcgMarket: c.tcgMarket,
      tcgLow: c.tcgLow ?? null,
      tcgHigh: c.tcgHigh ?? null,
      tcgUpdated: c.tcgUpdated ?? null,
      priceHistory: Array.isArray(c.priceHistory) ? c.priceHistory : [],
    });
  }
  return (Array.isArray(local) ? local : []).map(c => (porId.has(c.id) ? { ...c, ...porId.get(c.id) } : c));
}

// ── Cola de cartas sin precio, ordenada por set y número ────────────────
function numOrden(n) {
  const m = String(n || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 999999;
}
export function colaSinPrecio(inv, excluirIds) {
  const excl = excluirIds instanceof Set ? excluirIds : new Set(excluirIds || []);
  return (Array.isArray(inv) ? inv : [])
    .filter(c => c && c.estado !== "vendida" && !c.tcgMarket && !excl.has(c.id))
    .sort((a, b) =>
      String(a.set || "").localeCompare(String(b.set || "")) ||
      numOrden(a.number) - numOrden(b.number) ||
      String(a.name || "").localeCompare(String(b.name || "")));
}

// ── Variantes del nombre para buscar ────────────────────────────────────
const PREFIJOS = /^(dark|light|shining|radiant|team\s+\S+'s|rocket's|brock's|misty's|erika's|giovanni's|lt\.\s*surge's|sabrina's|blaine's|koga's)\s+/i;
export function variantesNombre(name) {
  const base = String(name || "").trim();
  const out = [];
  const add = s => {
    const v = String(s || "").replace(/\s+/g, " ").trim();
    if (v.length >= 3 && !out.some(x => x.toLowerCase() === v.toLowerCase())) out.push(v);
  };
  // "limpio" = sin el sufijo de numeración pegado ("Mega Darkrai ex - 116/084");
  // las demás variantes se derivan de él para que se puedan combinar.
  const limpio = base.replace(/\s*[-–—]\s*\d+\/\d+\s*$/, "");
  add(base);
  add(limpio);
  add(limpio.replace(/\s+ex$/i, ""));                            // sin "ex" final
  add(limpio.replace(/^mega\s+/i, ""));                          // sin "Mega"
  add(limpio.replace(/^mega\s+/i, "").replace(/\s+ex$/i, ""));   // sin "Mega" ni "ex"
  add(limpio.replace(PREFIJOS, ""));                              // sin prefijo (Dark, Radiant, Team Rocket's…)
  add(limpio.replace(/\s+(V|VMAX|VSTAR|GX|EX)$/i, ""));          // sin sufijo de mecánica
  add(limpio.normalize("NFD").replace(/[\u0300-\u036f]/g, "")); // sin acentos
  add(limpio.replace(/[^a-zA-Z0-9\s]/g, " "));                   // sin puntuación
  return out;
}

// Plan de búsquedas: la primera ("nombre número") es la que ya se hace al
// abrir la carta; las siguientes se piden de a UNA por toque, porque cada
// búsqueda gasta una de las 100 consultas diarias de tcgpricelookup.com.
export function planBusquedas(carta) {
  const num = String(carta?.number || "").trim();
  const vars = variantesNombre(carta?.name);
  const plan = [];
  const add = q => { const s = q.replace(/\s+/g, " ").trim(); if (s && !plan.some(p => p.q.toLowerCase() === s.toLowerCase())) plan.push({ q: s }); };
  vars.forEach(v => add(num ? `${v} ${num}` : v));
  vars.forEach(v => add(v)); // sin número: por si la numeración "116/084" estropea la búsqueda
  return plan;
}

// ── Comparar sets: por código O por nombre (4-oct-2026) ─────────────────
// Bug encontrado con Cristopher (sets Aquapolis/Skyridge/Expedition): la carta y el candidato
// mostraban el MISMO nombre de set, pero tcgpricelookup.com indexa los sets con otro código que
// pokemontcg.io ("ecard2" vs el suyo) y yo exigía igualdad de código: ni se marcaba el set como
// coincidente ni se autodetectaba el match. Ahora el set coincide si el código calza O si el nombre
// del set, normalizado, es el mismo.
const SERIES = /^(sword\s*&?\s*shield|scarlet\s*&?\s*violet|sun\s*&?\s*moon|mega\s*evolution|black\s*&?\s*white|heartgold\s*&?\s*soulsilver|diamond\s*&?\s*pearl|xy|swsh|sv|sm)\s*[:\-–—]?\s*/i;
export function normSet(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/pok[eé]mon\s*(tcg)?/ig, "").replace(SERIES, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function mismoSet(carta, c) {
  const sc = String(carta?.setCode || "").toLowerCase();
  const porCodigo = !!sc && ((c?.setId || "").toLowerCase() === sc || (c?.setCode || "").toLowerCase() === sc);
  if (porCodigo) return "codigo";
  const a = normSet(carta?.set), b = normSet(c?.setName);
  if (a && b && a === b) return "nombre";
  return null;
}
// ¿El candidato trae algún dato de set? Si no trae ninguno no hay con qué contrastar.
export function tieneDatosDeSet(c) { return !!(c?.setId || c?.setCode || c?.setName); }

// ── Ordenar candidatos: primero los que más se parecen a la carta ───────
export function claveCandidato(c) {
  return `${(c.setId || c.setCode || "").toLowerCase()}|${normNum(c.number)}|${normName(c.name)}`;
}
export function rankCandidatos(carta, candidatos) {
  const num = normNum(carta?.number), nom = normName(carta?.name);
  return (candidatos || [])
    .map((c, i) => {
      let p = 0;
      if (num && normNum(c.number) === num) p += 100;
      if (mismoSet(carta, c)) p += 50;
      if (nom && normName(c.name) === nom) p += 20;
      if (c.market != null) p += 5;
      return { ...c, puntaje: p, _i: i };
    })
    .sort((a, b) => b.puntaje - a.puntaje || a._i - b._i)
    .map(({ _i, ...c }) => c);
}
// Mezcla candidatos nuevos con los ya vistos sin repetir, y los deja ordenados.
export function mezclarCandidatos(carta, vistos, nuevos) {
  const claves = new Set((vistos || []).map(claveCandidato));
  const agregados = (nuevos || []).filter(c => { const k = claveCandidato(c); if (claves.has(k)) return false; claves.add(k); return true; });
  return { agregados, todos: [...(vistos || []), ...rankCandidatos(carta, agregados)] };
}
// Match automático seguro: mismo nombre normalizado + mismo número + precio.
export function matchAutomatico(carta, candidatos) {
  const num = normNum(carta?.number), nom = normName(carta?.name);
  if (!num || !nom) return null;
  const conocemosSet = !!(carta?.setCode || carta?.set);
  return (candidatos || []).find(c =>
    c.market != null && normNum(c.number) === num && normName(c.name) === nom &&
    // el mismo nombre+número puede ser una reimpresión de otro set con otro precio (la "variante
    // equivocada" que el bot evita): si ambos lados traen datos de set, tienen que calzar (código o
    // nombre). Si el candidato no trae ningún dato de set, no hay con qué contrastar y se acepta.
    (!conocemosSet || !tieneDatosDeSet(c) || mismoSet(carta, c))) || null;
}

// ── Overrides (designaciones manuales) compartidos con el bot ───────────
// Archivo en Angst-data: pokecripto-overrides.json = { [idCarta]: {name, number, setId, setCode} }
export function normalizarOverridesRemotos(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const out = {};
  for (const [id, ov] of Object.entries(x)) {
    if (id === "found") continue; // el Worker responde {"found":false} si el archivo no existe
    if (ov && typeof ov === "object" && ov.name && ov.number != null) out[id] = ov;
  }
  return out;
}
export function mergeOverrides(actual, cartaId, ov) {
  return { ...normalizarOverridesRemotos(actual), [cartaId]: { name: ov.name, number: ov.number, setId: ov.setId || null, setCode: ov.setCode || null } };
}
// El bot aplica los overrides al inventario canónico antes de preciar.
export function aplicarOverrides(inventario, overrides) {
  const ovs = normalizarOverridesRemotos(overrides);
  return (Array.isArray(inventario) ? inventario : []).map(c => (ovs[c.id] ? { ...c, tcgOverride: ovs[c.id] } : c));
}

// ── Fotos sin gastar consultas (4-oct-2026) ─────────────────────────────
// Las fotos de los candidatos se buscaban por API en pokemontcg.io, que sin key corta con 429 y
// además NO tiene los sets más nuevos (justo los que no tienen precio): quedaban "sin foto".
// Las dos CDN que ya usa Angst tienen URL predecible por set+número, sin API:
//   pokemontcg.io -> https://images.pokemontcg.io/<set>/<número>.png
//   scrydex       -> https://images.scrydex.com/pokemon/<set>-<número>/small
// Se devuelve la lista ordenada para probar una por una (onError pasa a la siguiente).
export function numeroBase(n) {
  const b = String(n ?? "").split("/")[0].trim();
  return /^\d+$/.test(b) ? String(parseInt(b, 10)) : b; // "090/084" -> "90"; "TG05" queda igual
}
function urlsDeSetNumero(set, num) {
  if (!set || !num) return [];
  const s = String(set).toLowerCase();
  return [`https://images.pokemontcg.io/${s}/${num}.png`, `https://images.scrydex.com/pokemon/${s}-${num}/small`];
}
export function urlsFoto({ image, cardId, setId, setCode, number }) {
  const urls = [];
  if (image) urls.push(image);
  if (cardId && String(cardId).includes("-")) {
    const i = String(cardId).lastIndexOf("-");
    urls.push(...urlsDeSetNumero(String(cardId).slice(0, i), String(cardId).slice(i + 1)));
  }
  const num = numeroBase(number);
  for (const set of [setId, setCode]) urls.push(...urlsDeSetNumero(set, num));
  return [...new Set(urls)];
}
