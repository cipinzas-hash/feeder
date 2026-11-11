// ─── Datos de Game enhanced ─────────────────────────────────────────────────
// ⚠️ SIMULADOS. Los títulos de proyectos, estudios y anuncios son inventados para probar la
// pantalla; los juegos de "motivo" sí son de la lista de terminados del usuario. Mientras
// SIMULADO sea true, la franja de estado muestra el sello "SIMULADO" y cada ficha lo repite.
// Cuando exista el pipeline real (decomps, ports web, estudios, sucesores) este archivo se
// reemplaza por la lectura de su JSON y SIMULADO pasa a false.
export const SIMULADO = true;

// [tipo, título, juego-de-tu-lista, plataforma, días desde la novedad, detalle, dato extra]
// dato extra: decomp → % de avance; web → "¿pide tu ROM?".
const FILAS = [
  ["d", "Torre de Aurelia", "Metroid Fusion", "GBA", 1, "Decomp al 100 %. Compila una ROM idéntica al original.", 100],
  ["d", "Nimbus Racers", "Crash Team Racing", "PS1", 3, "Decomp al 74 %. Avanza cerca de un 2 % por semana.", 74],
  ["d", "Cavernas de Ixtal", "Super Mario World", "SNES", 6, "Decomp al 91 %. Falta el motor de sonido.", 91],
  ["d", "Sombra Roja", "Tekken 3", "PS1", 9, "Decomp al 23 %. Proyecto nuevo con cuatro colaboradores.", 23],
  ["d", "Ciudad Cobalto", "Sonic Adventure", "Dreamcast", 15, "Decomp al 48 %. Sin avances hace dos semanas.", 48],
  ["d", "Arenas de Kheb", "Metal Slug X", "Neo Geo", 22, "Decomp al 8 %. Recién anunciado.", 8],
  ["w", "Cavernas de Ixtal Web", "Super Mario World", "Navegador (wasm)", 2, "Port a WebAssembly. Pide tu propia ROM para jugar.", "Sí"],
  ["w", "Nimbus Racers Web", "Crash Team Racing", "Navegador (wasm)", 5, "Port jugable con teclado y mando.", "Sí"],
  ["w", "Marathón Clásico", "Marathon 2: Durandal", "Navegador (JS)", 8, "Reimplementación en JavaScript. No necesita ROM.", "No"],
  ["w", "Muros de Azrael 3D", "Wolfenstein 3D", "Navegador (wasm)", 12, "Port del motor con datos de la versión shareware.", "No"],
  ["w", "Fábrica de Ritmos", "Rhythm Heaven", "Navegador (JS)", 19, "Juego de ritmo sin descargas.", "No"],
  ["e", "Banquete de Hojalata", "Cuphead", "PC · Switch", 4, "Anuncio de un juego nuevo del estudio. Fecha por confirmar.", null],
  ["e", "Pirata Medianoche", "Shantae and the Pirate’s Curse", "Switch · PC", 11, "Nueva aventura anunciada. Tráiler disponible.", null],
  ["e", "Eco de Bastión", "Bastion", "PC · PS5", 17, "Primer avance mostrado en un evento.", null],
  ["e", "Piedra y Rayo", "Guacamelee!", "PC · Switch", 26, "Entró en fase de pruebas cerradas.", null],
  ["s", "Hijo de Brumas", "Heavy Rain", "PC", 7, "Anunciado por parte del equipo original.", null],
  ["s", "Radio Nocturna", "Catherine", "PC · Switch", 14, "Sucesor anunciado con un estudio nuevo.", null],
  ["s", "Ritmo Celeste", "Rhythm Heaven", "Switch", 21, "Campaña de apoyo abierta.", null],
  ["s", "Caza de Ecos", "Killzone: Mercenary", "Portátil", 30, "Primer teaser publicado.", null],
];

export const JUEGOS = FILAS.map((f, i) => ({
  id: `sim-${f[0]}-${String(i + 1).padStart(2, "0")}`,
  tipo: f[0], titulo: f[1], juego: f[2], plataforma: f[3], dias: f[4], detalle: f[5],
  avance: f[0] === "d" ? f[6] : null,
  pideRom: f[0] === "w" ? f[6] : null,
}));
