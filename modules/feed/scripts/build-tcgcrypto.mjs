// Datos de tcgcrypto (nov-2026, issue #42): catálogo + precios de Yu-Gi-Oh! y Digimon.
//
// Fuentes (ninguna necesita API key ni tiene cuota práctica):
//  · tcgcsv.com — espejo diario de TCGplayer: sets (groups), productos (cada arte/rareza es un producto) y precios por
//    subtipo (1st Edition / Unlimited / Normal / Foil…). Es la fuente de PRECIOS de los dos juegos y el catálogo de Digimon.
//  · db.ygoprodeck.com — SOLO para clasificar las cartas de Yu-Gi-Oh! (atributo, tipo, arquetipo, texto). Una sola llamada
//    con toda la base; no se hotlinkean sus imágenes (se usan las de cada producto de TCGplayer, una por arte).
//
// Salida (modules/feed/data/): tcgcrypto-yugioh.json, tcgcrypto-digimon.json y tcgcrypto-diag.json (diagnóstico de la
// última corrida: el sandbox de desarrollo no puede leer logs de Actions, así que el script deja el diagnóstico en un archivo).
// Un archivo de juego NO se pisa si la corrida de ese juego queda vacía (mejor datos de ayer que un módulo vacío).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(AQUI, "..", "data");
const TCGCSV = "https://tcgcsv.com/tcgplayer";
const YGOPRO = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const UA = { "User-Agent": "angst-feed-bot (github.com/cipinzas-hash/feeder)" };

const CONCURRENCIA = 6;
const TIMEOUT_MS = 30000;
const diag = { generatedAt: new Date().toISOString(), juegos: {}, avisos: [] };

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, intentos = 3) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { headers: UA, signal: ac.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      ultimo = e;
      await dormir(800 * (i + 1));
    } finally { clearTimeout(t); }
  }
  throw new Error(`${url}: ${ultimo && ultimo.message}`);
}

// Ejecuta `fn` sobre `items` con concurrencia acotada; los fallos individuales no cortan la corrida.
async function enLote(items, fn) {
  const salida = new Array(items.length);
  let i = 0, fallos = 0;
  async function obrero() {
    while (i < items.length) {
      const k = i++;
      try { salida[k] = await fn(items[k], k); } catch (e) { fallos++; salida[k] = null; if (fallos <= 5) diag.avisos.push(String(e.message).slice(0, 200)); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, obrero));
  return { salida, fallos };
}

// ── Normalización ───────────────────────────────────────────────────────────────────────────────────────────────────
const quitaParentesis = s => { let t = String(s || "").trim(), p; do { p = t; t = t.replace(/\s*[([][^)\]]*[)\]]\s*$/, "").trim(); } while (t !== p); return t; };
const norm = s => quitaParentesis(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[“”"'’`´]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const ext = (p, ...nombres) => {
  const lista = Array.isArray(p.extendedData) ? p.extendedData : [];
  for (const n of nombres) {
    const e = lista.find(x => String(x.name || x.displayName || "").toLowerCase() === n.toLowerCase());
    if (e && e.value != null && e.value !== "") return String(e.value);
  }
  return "";
};
const esCartaSuelta = p => !!(ext(p, "Number") || ext(p, "Rarity"));
const precioDe = r => r ? (r.marketPrice ?? r.midPrice ?? r.lowPrice ?? null) : null;
const r2 = n => (n == null ? null : Math.round(n * 100) / 100);

// ── Lectura de un juego en tcgcsv: sets → productos + precios ───────────────────────────────────────────────────────
async function leerCategoria(categoryId, etiqueta) {
  const t0 = Date.now();
  const g = await getJson(`${TCGCSV}/${categoryId}/groups`);
  const groups = (g.results || []).filter(x => x && x.groupId);
  const { salida, fallos } = await enLote(groups, async grp => {
    const [pr, pc] = await Promise.all([
      getJson(`${TCGCSV}/${categoryId}/${grp.groupId}/products`),
      getJson(`${TCGCSV}/${categoryId}/${grp.groupId}/prices`),
    ]);
    return { grp, productos: pr.results || [], precios: pc.results || [] };
  });
  const sets = salida.filter(Boolean);
  const d = diag.juegos[etiqueta] = { categoryId, sets: groups.length, setsLeidos: sets.length, setsFallidos: fallos, segundosLectura: Math.round((Date.now() - t0) / 1000) };
  d.productos = sets.reduce((a, s) => a + s.productos.length, 0);
  const muestra = sets.flatMap(s => s.productos).find(esCartaSuelta);
  if (muestra) { d.muestraImagen = muestra.imageUrl || null; d.muestraExtendedData = (muestra.extendedData || []).map(e => e.name).slice(0, 25); d.muestraNombre = muestra.name; }
  return sets;
}

// Plantilla de URL de imagen: se deduce de una imagen real de tcgcsv, reemplazando el productId por {id}.
function plantillaImagen(sets) {
  for (const s of sets) for (const p of s.productos) {
    if (p.imageUrl && String(p.imageUrl).includes(String(p.productId))) return String(p.imageUrl).replace(String(p.productId), "{id}");
  }
  return "https://tcgplayer-cdn.tcgplayer.com/product/{id}_200w.jpg";
}

// ── Yu-Gi-Oh!: clasificación con YGOPRODeck (respaldo: datos propios del producto en tcgcsv) ────────────────────────
async function mapaYgopro() {
  const d = await getJson(YGOPRO, 2);
  const porNombre = new Map(), porCodigo = new Map(), lista = [];
  for (const c of d.data || []) {
    const ficha = { nombre: c.name, atributo: c.attribute || "", tipo: c.race || "", arquetipo: c.archetype || "", texto: c.desc || "", cardType: c.type || "", nivel: c.level ?? null, atk: c.atk ?? null, def: c.def ?? null };
    ficha.impresiones = (c.card_sets || []).length;
    lista.push(ficha);
    porNombre.set(norm(c.name), ficha);
    for (const s of c.card_sets || []) if (s.set_code) porCodigo.set(String(s.set_code).toUpperCase(), ficha);
  }
  return { porNombre, porCodigo, lista, total: (d.data || []).length };
}

// Datos de carta para los filtros del módulo (biblioteca para armar mazos). Claves cortas; el archivo declara `filtros`.
const familiaYgo = ct => (/spell/i.test(ct) ? "Mágica" : /trap/i.test(ct) ? "Trampa" : /skill/i.test(ct) ? "Skill" : ct ? "Monstruo" : "");
const numONull = v => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
function metaYgo(f) {
  const m = { t: familiaYgo(f.cardType), ct: f.cardType || "", a: f.atributo || "", r: f.tipo || "", lv: numONull(f.nivel), atk: numONull(f.atk), def: numONull(f.def), ar: f.arquetipo || "" };
  for (const k of Object.keys(m)) if (m[k] === "" || m[k] === null) delete m[k];
  return m;
}
const FILTROS_YGO = [{ id: "t", nombre: "Tipo de carta" }, { id: "ct", nombre: "Categoría" }, { id: "a", nombre: "Atributo" }, { id: "r", nombre: "Tipo / subtipo" }, { id: "lv", nombre: "Nivel / rango" }];
const FILTROS_DIGIMON = [{ id: "t", nombre: "Tipo de carta" }, { id: "col", nombre: "Color" }, { id: "lv", nombre: "Nivel" }, { id: "f", nombre: "Forma" }];

const COLECCIONES_YGO = [
  { id: "dark", nombre: "Dark", emoji: "🌑", criterio: "Monstruos de atributo DARK" },
  { id: "zombie", nombre: "Zombie", emoji: "🧟", criterio: "Monstruos de tipo Zombie y cartas que mencionan Zombie en su texto (soporte)" },
  { id: "eldlich", nombre: "Eldlich", emoji: "💀", criterio: "Arquetipo Eldlich y su soporte (Golden Land), por arquetipo, nombre o texto" },
];
function coleccionesYgo(f) {
  const out = [];
  if (f.atributo === "DARK") out.push("dark");
  if (f.tipo === "Zombie" || /\bzombie\b/i.test(f.texto)) out.push("zombie");
  if (f.arquetipo === "Eldlich" || /eldlich|golden land/i.test(f.nombre) || /eldlich/i.test(f.texto)) out.push("eldlich");
  return out;
}

async function construirYugioh() {
  const sets = await leerCategoria(2, "yugioh");
  const d = diag.juegos.yugioh;
  let ygo = null;
  try { ygo = await mapaYgopro(); d.ygoproCartas = ygo.total; } catch (e) { diag.avisos.push("YGOPRODeck no respondió; se clasifica solo con datos de tcgcsv: " + e.message); }
  const nombresSets = [], setFechas = [], setIds = [], cartas = new Map();
  let sinClasificar = 0, porCodigo = 0, porNombre = 0, porExt = 0;
  const muestraSin = [], vistos = new Set();
  for (const s of sets) {
    const setIdx = nombresSets.push(s.grp.name) - 1;
    setFechas.push(String(s.grp.publishedOn || "").slice(0, 10)); setIds.push(s.grp.groupId);
    const precios = new Map();
    for (const r of s.precios) { if (!precios.has(r.productId)) precios.set(r.productId, []); precios.get(r.productId).push(r); }
    for (const p of s.productos) {
      if (!esCartaSuelta(p)) continue;
      const numero = ext(p, "Number"), rareza = ext(p, "Rarity");
      let f = null;
      if (ygo && numero) { f = ygo.porCodigo.get(numero.toUpperCase()) || null; if (f) porCodigo++; }
      if (!f && ygo) { f = ygo.porNombre.get(norm(p.name)) || null; if (f) porNombre++; }
      if (!f) {
        const atributo = ext(p, "Attribute"), tipo = ext(p, "MonsterType", "Monster Type", "Race", "Type"), texto = ext(p, "Description", "Card Text", "Text");
        if (atributo || tipo || texto) { f = { nombre: quitaParentesis(p.name), atributo: atributo.toUpperCase(), tipo, arquetipo: "", texto, cardType: ext(p, "Card Type", "CardType"), atk: ext(p, "Attack"), def: ext(p, "Defense") }; porExt++; }
      }
      if (!f) { sinClasificar++; if (muestraSin.length < 15) muestraSin.push(p.name + " [" + numero + "]"); continue; }
      if (/token|non-game/i.test(f.cardType || "")) continue;   // fichas y cartas fuera de juego: no son coleccionables
      vistos.add(norm(f.nombre || p.name));
      const colecs = coleccionesYgo(f);
      if (!colecs.length) continue;
      const k = norm(f.nombre || p.name);
      let c = cartas.get(k);
      if (!c) { c = { k, n: f.nombre || quitaParentesis(p.name), c: colecs, m: metaYgo(f), v: [] }; cartas.set(k, c); }
      const filas = precios.get(p.productId) || [null];
      for (const r of filas) {
        c.v.push([p.productId, r ? r.subTypeName || "" : "", setIdx, numero, rareza, r2(precioDe(r)), r2(r && r.lowPrice), r2(r && r.highPrice)]);
      }
    }
  }
  Object.assign(d, { cartas: cartas.size, versiones: [...cartas.values()].reduce((a, c) => a + c.v.length, 0), clasificadasPorCodigo: porCodigo, clasificadasPorNombre: porNombre, clasificadasPorTcgcsv: porExt, sinClasificar, muestraSinClasificar: muestraSin });
  d.porColeccion = Object.fromEntries(COLECCIONES_YGO.map(x => [x.id, [...cartas.values()].filter(c => c.c.includes(x.id)).length]));
  d.setsConFecha = setFechas.filter(Boolean).length;
  d.cartasDistintasEnTcgcsv = vistos.size;
  if (ygo) {
    // Cobertura frente a YGOPRODeck: ¿cuántas cartas de cada criterio existen allá, tienen impresiones y llegaron acá?
    const mide = (nombre, pred) => {
      const todas = ygo.lista.filter(pred);
      const conSets = todas.filter(f => f.impresiones > 0);
      const llegaron = conSets.filter(f => cartas.has(norm(f.nombre)));
      const vistasTcg = conSets.filter(f => vistos.has(norm(f.nombre)));
      d["cobertura_" + nombre] = { enYgopro: todas.length, conImpresiones: conSets.length, vistasEnTcgcsv: vistasTcg.length, enNuestroArchivo: llegaron.length, muestraNoVistas: conSets.filter(f => !vistos.has(norm(f.nombre))).slice(0, 20).map(f => f.nombre), muestraVistasPeroFuera: vistasTcg.filter(f => !cartas.has(norm(f.nombre))).slice(0, 10).map(f => f.nombre) };
    };
    mide("zombieTipo", f => f.tipo === "Zombie" && /monster/i.test(f.cardType));
    mide("zombieTexto", f => /\bzombie\b/i.test(f.texto));
    mide("dark", f => f.atributo === "DARK");
  }
  d.muestraMeta = [...cartas.values()].slice(0, 3).map(c => c.m);
  return { tcg: "yugioh", nombre: "Yu-Gi-Oh!", emoji: "🃏", agrupar: "nombre", imgTpl: plantillaImagen(sets), colecciones: COLECCIONES_YGO, filtros: FILTROS_YGO, sets: nombresSets, setFechas, setIds, cartas: [...cartas.values()].sort((a, b) => a.n.localeCompare(b.n)) };
}

// ── Digimon: el catálogo sale de tcgcsv (cada arte es un producto distinto) ─────────────────────────────────────────
const COLECCIONES_DIGIMON = [
  { id: "numemon", nombre: "Numemon", emoji: "💩", criterio: "Solo cartas de Numemon, en todas sus artes (cada producto es un arte distinto)" },
];
async function construirDigimon() {
  const sets = await leerCategoria(63, "digimon");
  const d = diag.juegos.digimon;
  const nombresSets = [], setFechas = [], setIds = [], cartas = new Map();
  for (const s of sets) {
    const setIdx = nombresSets.push(s.grp.name) - 1;
    setFechas.push(String(s.grp.publishedOn || "").slice(0, 10)); setIds.push(s.grp.groupId);
    const precios = new Map();
    for (const r of s.precios) { if (!precios.has(r.productId)) precios.set(r.productId, []); precios.get(r.productId).push(r); }
    for (const p of s.productos) {
      if (!esCartaSuelta(p) || !/\bnumemon\b/i.test(p.name || "")) continue;
      const numero = ext(p, "Number"), rareza = ext(p, "Rarity");
      const k = String(p.productId);
      const m = { t: ext(p, "CardType"), col: ext(p, "Color"), lv: ext(p, "LevelLv"), dp: ext(p, "DigimonPowerDP"), f: ext(p, "DigimonForm"), a: ext(p, "DigimonAttribute"), r: ext(p, "DigimonType") };
      for (const kk of Object.keys(m)) if (!m[kk]) delete m[kk];
      const c = { k, n: p.name, c: ["numemon"], m, v: [] };
      for (const r of precios.get(p.productId) || [null]) c.v.push([p.productId, r ? r.subTypeName || "" : "", setIdx, numero, rareza, r2(precioDe(r)), r2(r && r.lowPrice), r2(r && r.highPrice)]);
      cartas.set(k, c);
    }
  }
  d.cartas = cartas.size;
  d.setsConFecha = setFechas.filter(Boolean).length;
  d.muestraMeta = [...cartas.values()].slice(0, 3).map(c => c.m);
  d.versiones = [...cartas.values()].reduce((a, c) => a + c.v.length, 0);
  d.muestraNombres = [...cartas.values()].slice(0, 12).map(c => c.n);
  return { tcg: "digimon", nombre: "Digimon", emoji: "🐉", agrupar: "producto", imgTpl: plantillaImagen(sets), colecciones: COLECCIONES_DIGIMON, filtros: FILTROS_DIGIMON, sets: nombresSets, setFechas, setIds, cartas: [...cartas.values()].sort((a, b) => a.n.localeCompare(b.n)) };
}

// ── Escritura ───────────────────────────────────────────────────────────────────────────────────────────────────────
function escribir(nombreArchivo, obj) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, nombreArchivo), JSON.stringify(obj));
  return fs.statSync(path.join(DATA, nombreArchivo)).size;
}

async function juego(clave, construir) {
  try {
    const out = await construir();
    if (!out.cartas.length) { diag.avisos.push(`${clave}: 0 cartas; se conserva el archivo anterior`); return; }
    const bytes = escribir(`tcgcrypto-${clave}.json`, { generatedAt: new Date().toISOString(), ...out });
    diag.juegos[clave].bytesArchivo = bytes;
  } catch (e) {
    diag.avisos.push(`${clave} falló: ${e.message}`);
    diag.juegos[clave] = { ...(diag.juegos[clave] || {}), error: String(e.message).slice(0, 300) };
  }
}

await juego("yugioh", construirYugioh);
await juego("digimon", construirDigimon);
escribir("tcgcrypto-diag.json", diag);
console.log(JSON.stringify(diag, null, 1));
