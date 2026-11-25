// Importar un mazo de Yu-Gi-Oh! (Dueling Book, YGOPRO, YGOPRODeck…): lectura de .ydk y de listas de texto, y elección de variante por rareza.
// Sin red ni React: lo usan la pantalla de importar mazo y las pruebas.

// IDÉNTICA a la de build-tcgcrypto.mjs (la clave de cada carta del pool): sin «(…)» ni «[…]» finales, minúsculas, sin acentos ni comillas y todo lo no alfanumérico = espacio.
const quitaParentesis = s => { let t = String(s || "").trim(), p; do { p = t; t = t.replace(/\s*[([][^)\]]*[)\]]\s*$/, "").trim(); } while (t !== p); return t; };
export const normNombre = s => quitaParentesis(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[“”"'’`´]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Texto → { main, extra, side }, cada uno [{ id | nombre, copias }] con las copias sumadas.
//   .ydk:   "#main" / "#extra" / "!side" y un pasaporte por línea ("#created by …" y otros comentarios se ignoran)
//   texto:  "3 Ash Blossom & Joyous Spring", "3x Nombre", "Nombre x3"; secciones "Main Deck", "Extra Deck", "Side Deck" (opcionales)
export function parsearMazo(texto) {
  const sec = { main: new Map(), extra: new Map(), side: new Map() };
  let actual = "main";
  const suma = (mapa, k, v, n) => { const e = mapa.get(k); if (e) e.copias += n; else mapa.set(k, { ...v, copias: n }); };
  for (const crudo of String(texto || "").split(/\r?\n/)) {
    const l = crudo.trim(); if (!l) continue;
    const cab = /^[#!]?\s*(main|extra|side)(?:\s*deck)?\s*:?\s*(?:\(\d+\))?$/i.exec(l);
    if (cab) { actual = cab[1].toLowerCase(); continue; }
    if (/^#/.test(l) && !/^#\s*\d+\s*$/.test(l)) continue;                    // comentario del .ydk (#created by, #main sin más ya se trató arriba)
    if (/^!/.test(l)) { actual = "side"; continue; }
    const idm = /^#?\s*(\d{3,10})\s*$/.exec(l);
    if (idm) { suma(sec[actual], "id" + idm[1], { id: Number(idm[1]) }, 1); continue; }
    const m = /^(\d{1,2})\s*x?\s+(.+)$/i.exec(l) || /^(.+?)\s+x\s*(\d{1,2})$/i.exec(l);
    if (!m) continue;
    const [copias, nombre] = /^\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]];
    const nombreLimpio = nombre.replace(/\s*[\[(][A-Z0-9-]{3,12}[\])]\s*$/i, "").trim();            // "Nombre (LOB-001)" → "Nombre"
    suma(sec[actual], "n" + normNombre(nombreLimpio), { nombre: nombreLimpio }, copias);
  }
  return { main: [...sec.main.values()], extra: [...sec.extra.values()], side: [...sec.side.values()] };
}

// Versión elegida para una carta según la rareza pedida: la más barata de esa rareza; si no existe, la más barata de todas (marcada con `sinRareza`).
// `versiones` = tuplas de tcgcrypto [pid, subtipo, setIdx, numero, rareza, market, low, high].
export function elegirVersion(versiones, rareza) {
  const lista = (versiones || []).filter(v => v);
  if (!lista.length) return null;
  const barata = a => [...a].sort((x, y) => (x[5] == null ? 1e12 : x[5]) - (y[5] == null ? 1e12 : y[5]))[0];
  const r = String(rareza || "").toLowerCase();
  const iguales = r ? lista.filter(v => String(v[4] || "").toLowerCase() === r) : [];
  return iguales.length ? { version: barata(iguales), sinRareza: false } : { version: barata(lista), sinRareza: !!r };
}
export const rarezasDe = cartas => { const c = new Map(); for (const k of cartas) for (const v of k.v || []) { const r = v[4]; if (r) c.set(r, (c.get(r) || 0) + 1); } return [...c.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); };

// Archivo del pool donde vive una carta: la primera letra de su nombre normalizado (a-z) o "0". Igual que build-tcgcrypto.mjs.
export const letraDe = n => { const c = normNombre(n).charAt(0); return /[a-z]/.test(c) ? c : "0"; };
// Carta dentro del archivo de su letra: Yu-Gi-Oh! por clave (nombre normalizado); Digimon, donde cada arte es una carta, por nombre.
export const cartaEnLetra = (shard, nombre, juego) => { const cs = (shard && shard.cartas) || []; const k = normNombre(nombre); return juego === "yugioh" ? cs.find(c => c.k === k) || null : cs.find(c => c.n === nombre) || cs.find(c => normNombre(c.n) === k) || null; };
