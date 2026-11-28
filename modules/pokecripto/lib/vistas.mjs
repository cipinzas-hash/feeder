// Vistas de las colecciones, IGUALES en Pokémon, Yu-Gi-Oh! y Digimon (unificación de Pokécripto, 23-nov-2026): los mismos botones (S · M · L · XL · lista),
// los mismos tamaños de grilla y, por juego, la proporción real de la carta (Pokémon y Digimon 63×88 mm; Yu-Gi-Oh! 59×86 mm).
export const TAMANOS_VISTA = [["S", "S", 64, 3], ["M", "M", 96, 5], ["L", "L", 150, 6], ["XL", "XL", 250, 8]];
export const VISTAS = [...TAMANOS_VISTA.map(t => t[0]), "lista"];
// Las preferencias guardadas con los nombres antiguos de Pokémon siguen valiendo
export const normVista = v => (v === "grid_small" ? "S" : v === "grid_med" ? "M" : VISTAS.includes(v) ? v : "S");
export const gridDe = v => { const t = TAMANOS_VISTA.find(x => x[0] === normVista(v)); return t ? { cols: `repeat(auto-fill,minmax(${t[2]}px,1fr))`, gap: t[3] } : { cols: null, gap: 0 }; };
export const RATIO_CARTA = { pokemon: 63 / 88, yugioh: 59 / 86, digimon: 63 / 88 };
export const ratioDe = juego => RATIO_CARTA[juego] || RATIO_CARTA.pokemon;
export const alturaFicha = (juego, ancho = 126) => Math.round(ancho / ratioDe(juego));
// Los sets de las colecciones parten SIEMPRE desplegados en los tres juegos (el plegado queda disponible al tocar la cabecera)
export const abiertoPorDefecto = () => true;
