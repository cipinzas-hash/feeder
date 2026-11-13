// ─── Lógica pura de Game enhanced (sin React ni red, probada en tests/gameenhanced.mjs) ─────────
// Tipos que hoy tienen fuente real: d (decomps, ports y recompilaciones) y e (juegos nuevos de los
// estudios). Versiones web y sucesores espirituales quedaron fuera hasta tener fuente (sonda 11-nov-2026).
export const TIPO = {
  d: { etiqueta: "DECOMP", emoji: "🧩", motivo: "Porque terminaste " },
  e: { etiqueta: "ESTUDIO", emoji: "🏢", motivo: "Del estudio detrás de " },
};

// [clave de filtro, emoji, nombre]. "todo" = Novedades: lo que se movió hace poco, mezclado.
export const CATEGORIAS = [
  ["todo", "✨", "Novedades"],
  ["d", "🧩", "Decomps"],
  ["e", "🏢", "Estudios"],
];

export const SUBTIPOS = {
  decompilation: "Decompilación", "static-recomp": "Recompilación estática", "source-port": "Source port",
  "engine-remake": "Reimplementación del motor", disassembly: "Desensamblado", "browser-port": "Port web",
};
const ASSETS = { byo: "Sí, con tu propia copia", instant: "No, se juega al instante", demo: "Solo la demo", unknown: "Sin dato" };

// Ventana de "Novedades": decomps con actividad en los últimos 90 días (y no inactivos); juegos de
// estudios lanzados hace ≤120 días o que salen en ≤240. Las categorías Decomps y Estudios muestran todo.
const VENTANA = { decompDias: 90, pasadoEstudio: 120, futuroEstudio: 240 };
export const enNovedades = j => (j.tipo === "d" ? !j.inactivo && j.dias <= VENTANA.decompDias : j.dias >= -VENTANA.futuroEstudio && j.dias <= VENTANA.pasadoEstudio);

export const motivoDe = j => TIPO[j.tipo].motivo + j.tuJuego;

export function haceDias(n) {
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  if (n < 60) return `hace ${n} d`;
  if (n < 730) return `hace ${Math.round(n / 30)} m`;
  return `hace ${Math.round(n / 365)} a`;
}

export function diasDesdeIso(iso, ahora) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.round((ahora - t) / 86400000) : null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaLegible(j) {
  if (!j.fecha) return "—";
  if (j.fechaAprox) return `${j.fecha.slice(0, 4)} (fecha por confirmar)`;
  const [a, m, d] = j.fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

// Texto corto a la derecha de cada fila.
export function cuando(j) {
  if (j.tipo === "e" && j.dias < 0) return j.fechaAprox ? `en ${j.fecha.slice(0, 4)}` : j.dias < -60 ? `en ${Math.round(-j.dias / 30)} m` : `en ${-j.dias} d`;
  return j.dias >= 9999 ? "—" : haceDias(j.dias);
}

const miles = n => (typeof n === "number" ? n.toLocaleString("es-CL") : "—");

// Línea de detalle de la tarjeta expandida.
export function detalleDe(j, ahora) {
  if (j.tipo === "d") {
    const c = diasDesdeIso(j.ultimoCommit, ahora);
    return [SUBTIPOS[j.subtipo] || j.subtipo, j.plataforma, `⭐ ${miles(j.estrellas)}`, c === null ? null : `último commit ${haceDias(c)}`, j.inactivo ? "inactivo" : null, j.ia ? "hecho con IA según la fuente" : null].filter(Boolean).join(" · ");
  }
  return [j.plataformas && j.plataformas.length ? j.plataformas.join(" · ") : null, j.dias < 0 ? `sale ${j.fechaAprox ? "en " + j.fecha.slice(0, 4) : fechaLegible(j)}` : `salió ${fechaLegible(j)}`].filter(Boolean).join(" · ");
}

// Filas de la ficha: [etiqueta, texto | { href, texto }].
export function filasFicha(j, ahora) {
  const enlace = (href, texto) => (typeof href === "string" && href.startsWith("https://") ? { href, texto } : "—");
  if (j.tipo === "d") {
    const c = diasDesdeIso(j.ultimoCommit, ahora), r = diasDesdeIso(j.fechaRelease, ahora);
    return [
      ["Tipo", TIPO.d.etiqueta], ["Proyecto", SUBTIPOS[j.subtipo] || j.subtipo], ["Por qué lo ves", motivoDe(j)],
      ["Tus juegos", j.tuyos.join(", ")], ["Plataforma", j.plataforma || "—"], ["Estrellas", miles(j.estrellas)],
      ["Último commit", c === null ? "—" : haceDias(c)],
      ["Última versión", j.release ? `${j.release}${r === null ? "" : " (" + haceDias(r) + ")"}` : "Sin versión publicada"],
      ["Jugar en el navegador", j.jugableUrl ? enlace(j.jugableUrl, "Abrir") : "No"],
      ["¿Pide tu ROM o archivos?", ASSETS[j.pideAssets] || "Sin dato"],
      ["Hecho con IA (según la fuente)", j.ia ? "Sí" : "No"], ["Estado", j.inactivo ? "Inactivo o archivado" : "Activo"],
      ["Fuente", enlace(j.url, "Repositorio")],
    ];
  }
  return [
    ["Tipo", TIPO.e.etiqueta], ["Estudio", j.estudio || "—"], ["Por qué lo ves", motivoDe(j)], ["Tus juegos", j.tuyos.join(", ")],
    ["Plataformas", j.plataformas && j.plataformas.length ? j.plataformas.join(" · ") : "—"], ["Fecha", fechaLegible(j)],
    ["Fuente", enlace(j.url, "IGDB")],
  ];
}

// Ítems de una categoría, sin los ocultos, los más cercanos a hoy primero (pasados y futuros por igual).
export function itemsDe(juegos, clave, ocultos = {}) {
  return juegos
    .filter(j => !ocultos[j.id] && TIPO[j.tipo] && (clave === "todo" ? enNovedades(j) : j.tipo === clave))
    .sort((a, b) => Math.abs(a.dias) - Math.abs(b.dias) || (a.id < b.id ? -1 : 1));
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
  const v = juegos.filter(j => TIPO[j.tipo] && !ocultos[j.id]);
  return {
    semana: v.filter(j => Math.abs(j.dias) <= 7).length,
    deEstudios: v.filter(j => j.tipo === "e" && enNovedades(j)).length,
    guardados: v.filter(j => guardados[j.id]).length,
  };
}

// Antigüedad de los datos para el sello de la franja.
export function edadDatos(generatedAt, ahora) {
  const t = generatedAt ? new Date(generatedAt).getTime() : NaN;
  if (!Number.isFinite(t)) return { texto: "sin fecha", vieja: true };
  const h = Math.max(0, Math.round((ahora - t) / 3600000));
  return { texto: h < 1 ? "hace <1 h" : h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`, vieja: h > 36 };
}
