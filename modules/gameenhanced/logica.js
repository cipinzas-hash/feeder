// ─── Lógica pura de Game enhanced (sin React, probada en tests/gameenhanced.mjs) ────────────────
export const TIPO = {
  d: { etiqueta: "DECOMP", emoji: "🧩", motivo: "Porque terminaste " },
  w: { etiqueta: "WEB", emoji: "🌐", motivo: "Porque terminaste " },
  e: { etiqueta: "ESTUDIO", emoji: "🏢", motivo: "Del estudio detrás de " },
  s: { etiqueta: "SUCESOR", emoji: "👻", motivo: "Sucesor espiritual de " },
};

// [clave de filtro, emoji, nombre]. "todo" = Novedades (mezcla todo, lo más nuevo primero).
export const CATEGORIAS = [
  ["todo", "✨", "Novedades"],
  ["d", "🧩", "Decomps"],
  ["w", "🌐", "Versiones web"],
  ["e", "🏢", "Estudios"],
  ["s", "👻", "Sucesores"],
];

export const motivoDe = j => TIPO[j.tipo].motivo + j.juego;

export function haceDias(n) {
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} d`;
}

// Ítems de una categoría, sin los ocultos, lo más nuevo primero (empate: por id, estable).
export function itemsDe(juegos, clave, ocultos = {}) {
  return juegos
    .filter(j => !ocultos[j.id] && (clave === "todo" || j.tipo === clave))
    .sort((a, b) => a.dias - b.dias || (a.id < b.id ? -1 : 1));
}

// Ventana de filas visibles: el enfocado va arriba, salvo cerca del final, donde la ventana se
// recorre hacia atrás para no dejar hueco muerto debajo (N3).
export function ventana(total, foco, cabe) {
  const n = Math.max(1, cabe | 0);
  const ini = Math.min(Math.max(0, foco), Math.max(0, total - n));
  return { ini, fin: Math.min(total, ini + n) };
}

// Cuántas filas enteras caben en `alto` px (fila + separación).
export function filasQueCaben(alto, fila = 56, sep = 5) {
  return Math.max(1, Math.floor((alto + sep) / (fila + sep)));
}

// Franja de estado: lo que se consulta a diario.
export function resumen(juegos, ocultos = {}, guardados = {}) {
  const v = juegos.filter(j => !ocultos[j.id]);
  return {
    semana: v.filter(j => j.dias <= 7).length,
    deEstudios: v.filter(j => j.tipo === "e").length,
    guardados: v.filter(j => guardados[j.id]).length,
  };
}
