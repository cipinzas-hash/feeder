// Variantes con el MISMO formato en todos los juegos (lote variantes, 20-nov-2026).
//
// Una VARIANTE es una forma distinta de la misma carta, con su propio precio. Todas se describen igual: tipo, etiqueta larga,
// etiqueta corta, ícono y orden. Tipos:
//   acabado   Normal · Holo · Reverse · Foil                    (Pokémon, Digimon)
//   patrón    Poké Ball · Master Ball · Logo de tipo · Cosmos…  (Pokémon: reverse con dibujo)
//   sello     Liga · Campeonato · Prerelease · Staff · Torneo   (Pokémon y los demás: casi siempre MÁS CARAS que la base)
//   edición   1ª Edición · Unlimited · Limited                  (Yu-Gi-Oh!, Pokémon antiguo)
//   rareza    UR · SR · ScR · Starlight…                        (Yu-Gi-Oh!: una impresión por rareza en el mismo set/número)
// Sin dependencias (lo usan la pantalla, el bot y las pruebas).

export const TIPOS = {
  sello: { orden: 0, color: "#e6c229" },
  patron: { orden: 1, color: "#9c7cff" },
  acabado: { orden: 2, color: "#5c9cff" },
  rareza: { orden: 3, color: "#4caf80" },
  edicion: { orden: 4, color: "#999999" },
  base: { orden: 5, color: "#777777" },
};

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

// ── Sellos y promos (los que suelen costar más que la base) ────────────────────────────────────────────────
// Se reconocen por el texto entre paréntesis del producto o por el nombre del grupo/set. El orden importa: el primero que calza gana.
const SELLOS = [
  [/regional|national|world|championship|campeonato|top (4|8|16|32)|finalist|winner/, "campeonato", "Campeonato", "🏆"],
  [/league|liga|gym challenge|challenge/, "liga", "Liga", "🏅"],
  [/pre-?release/, "prerelease", "Prerelease", "🎟️"],
  [/staff/, "staff", "Staff", "🛡️"],
  [/play! ?pokemon|play ?pokemon|tournament|torneo|participant|promo winner/, "torneo", "Torneo", "🎖️"],
  [/build ?(&|and) ?battle|battle academy|trainer toolkit|holiday|stamp|sello/, "evento", "Evento", "🎫"],
];
// Patrones de reverse con dibujo
const PATRONES = [
  [/master ?ball/, "masterball", "Master Ball", "★"],
  [/poke ?ball/, "pokeball", "Poké Ball", "●"],
  [/energy symbol|energy|type symbol/, "logotipo", "Logo de tipo", "⚡"],
  [/dusk ball/, "duskball", "Dusk Ball", "◐"],
  [/friend ball/, "friendball", "Friend Ball", "♥"],
  [/cosmos/, "cosmos", "Cosmos Holo", "✺"],
  [/cracked ice/, "cracked", "Cracked Ice", "❄"],
  [/tinsel|mirror|galaxy|sunburst|crosshatch|swirl/, "patron", "Patrón", "◈"],
];
const ACABADOS = [
  [/reverse/, "reverse", "Reverse Holo", "⟡"],
  [/holo/, "holo", "Holo", "✦"],
  [/foil/, "foil", "Foil", "✦"],
  [/non-?holo|normal/, "normal", "Normal", "○"],
];
const EDICIONES = [
  [/1st edition|first edition/, "1ra", "1ª Edición", "1ª"],
  [/unlimited/, "unl", "Unlimited", "Unl"],
  [/limited/, "ltd", "Limited", "Ltd"],
];
const RAREZAS = {
  "common": "C", "uncommon": "U", "rare": "R", "super rare": "SR", "ultra rare": "UR", "secret rare": "ScR", "ultimate rare": "UtR", "ghost rare": "GR",
  "starlight rare": "StR", "quarter century secret rare": "QCScR", "platinum secret rare": "PScR", "prismatic secret rare": "PrScR", "gold rare": "GldR",
  "starfoil rare": "SfR", "shatterfoil rare": "ShR", "mosaic rare": "MR", "duel terminal": "DT", "collector's rare": "CR", "prismatic collector's rare": "PrCR",
  "prismatic ultimate rare": "PrUtR", "extra secret rare": "ExScR", "premium gold rare": "PGR", "ultra rare (pharaoh's rare)": "PhR", "double rare": "RR",
  "illustration rare": "IR", "special illustration rare": "SIR", "ace spec rare": "ACE", "hyper rare": "HR", "promo": "Promo", "super": "SR", "secret": "SEC",
};
export const abreviarRareza = r => {
  const k = norm(r);
  if (!k) return "";
  if (RAREZAS[k]) return RAREZAS[k];
  const ini = k.split(" ").filter(w => !["rare", "of", "the"].includes(w)).map(w => w[0].toUpperCase()).join("");
  return ini ? ini + "R" : r;
};
const busca = (lista, texto) => { for (const [re, id, largo, ico] of lista) if (re.test(texto)) return { id, largo, ico }; return null; };

// Describe una variante. Entrada: { juego, sub (subtipo/edición/acabado del producto), rareza, sufijo (texto entre paréntesis del
// nombre del producto), grupo (nombre del set/grupo), precio {market, low, high}, pid }. Devuelve siempre el mismo objeto.
export function describirVariante({ juego = "pokemon", sub = "", rareza = "", sufijo = "", grupo = "", market = null, low = null, high = null, pid = null } = {}) {
  const partes = [];                       // piezas de la etiqueta, de más a menos informativa
  const txt = norm(`${sufijo} ${grupo}`);
  let tipo = "base", clave = "base", icono = "○";
  const sello = busca(SELLOS, norm(sufijo) + " " + (/(league|championship|prerelease|staff|stamp|promo)/.test(norm(grupo)) ? norm(grupo) : ""));
  const patron = busca(PATRONES, norm(sufijo));
  const acabado = busca(ACABADOS, norm(sub));
  const edicion = busca(EDICIONES, norm(sub));
  if (sello) { tipo = "sello"; clave = sello.id; icono = sello.ico; partes.push(sello.largo); }
  if (patron) { if (tipo === "base") { tipo = "patron"; clave = patron.id; icono = patron.ico; } partes.push(patron.largo); }
  if (acabado && !(acabado.id === "normal" && partes.length)) { if (tipo === "base") { tipo = acabado.id === "normal" ? "base" : "acabado"; clave = acabado.id; icono = acabado.ico; } partes.push(acabado.largo); }
  const ab = abreviarRareza(rareza);
  if (juego === "yugioh" && ab) { if (tipo === "base") { tipo = "rareza"; clave = "r-" + ab; icono = "◆"; } partes.unshift(ab); }
  if (edicion) { if (tipo === "base") { tipo = "edicion"; clave = edicion.id; icono = edicion.ico; } partes.push(edicion.largo); }
  if (!partes.length) partes.push(sufijo || sub || "Normal");
  const etiqueta = [...new Set(partes)].join(" · ");
  const corta = [...new Set(partes.map(p => (p === "1ª Edición" ? "1ª" : p === "Reverse Holo" ? "Rev" : p === "Master Ball" ? "Master" : p === "Poké Ball" ? "Ball" : p === "Logo de tipo" ? "Tipo" : p === "Unlimited" ? "Unl" : p === "Limited" ? "Ltd" : p)))].slice(0, 2).join(" ");
  return { tipo, clave, icono, etiqueta, corta, color: TIPOS[tipo].color, orden: TIPOS[tipo].orden, sub, rareza, sufijo, pid, market, low, high, esSello: tipo === "sello" };
}

// Ordena variantes: sellos primero (lo más caro/raro), luego patrones, acabados, rarezas, ediciones; dentro, por precio descendente.
export function ordenarVariantes(vs) {
  return [...vs].sort((a, b) => a.orden - b.orden || (b.market ?? -1) - (a.market ?? -1) || String(a.etiqueta).localeCompare(String(b.etiqueta)));
}
// Resumen para la tarjeta: cuántas variantes, rango de precios y cuántas son sellos.
export function resumenVariantes(vs) {
  const ps = vs.map(v => v.market).filter(p => p != null);
  return { n: vs.length, min: ps.length ? Math.min(...ps) : null, max: ps.length ? Math.max(...ps) : null, sellos: vs.filter(v => v.esSello).length };
}
// Veces que cuesta la variante respecto de la base (la más barata sin sello). null si no se puede calcular.
export function multiploSobreBase(v, vs) {
  const base = vs.filter(x => !x.esSello && x.market != null).map(x => x.market);
  if (v.market == null || !base.length) return null;
  const b = Math.min(...base);
  return b > 0 ? Math.round(v.market / b * 10) / 10 : null;
}
