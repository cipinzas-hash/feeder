// Planner domain primitives — Angst Planner 0.0
// These functions are intentionally UI-independent. During migration, core/App.jsx
// remains the runtime owner; this file establishes the future module boundary.

export const BASE_DATE = new Date(2026, 1, 21);

export const DAY_NAMES = [
  "Sábado",
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
];

export const DEFAULT_COOKING_OPTS = [
  "cocino hoy 🍳",
  "sobras ♻️",
  "pedir 🍔",
  "ayuno 🌿",
  "red de apoyo 🤝",
];

export const DEFAULT_ASEO_OPTS = [
  "aseo básico 🧹",
  "aseo profundo 🫧",
  "mantenimiento 🧼",
  "superficies 🪣",
  "vivir en la mugre 💀",
];

export const CYNICAL_SUBTITLES = [
  "otra semana de fingir que todo está bien",
  "sobrevive. eso es suficiente.",
  "el caos también puede tener horario",
  "planificar no cura la existencia, pero ayuda",
  "otra oportunidad de decepcionarte a ti mismo (o no)",
  "la semana no se va a organizar sola, lamentablemente",
  "no tienes que querer hacerlo para hacerlo",
  "lo hiciste la semana pasada. puedes volver a hacerlo.",
  "un día a la vez, aunque el día sea un desastre",
  "el orden es temporal. el caos, permanente. organízate igual.",
];

export const STOIC_PHRASES = [
  "el universo no tiene plan, pero tú tienes planilla.",
  "disciplina: hacer lo que dijiste que ibas a hacer.",
  "memento mori. pero primero anota las compras.",
  "ama fati: quiere incluso los días sin tareas completadas.",
  "lo que no se registra, no existió.",
  "el estoico no se queja. el estoico presupuesta.",
  "todo es temporal. el caos más que el orden.",
  "no busques sentido. construye rutina.",
  "la virtud está en el proceso, no en terminar la lista.",
  "vivir bien es la mejor venganza contra el caos.",
  "considera el obstáculo como el camino.",
  "el tiempo es el único activo que no se recupera.",
];

export function makeEmptyDay() {
  return {
    tasks: [],
    abasto: "",
    cookingMode: "",
    aseoMode: "",
    menu: "",
    summary: "",
    humors: [],
    humorCustom: [],
    compras: [],
    schedule: [],
  };
}

export function isWithKids(dateKey, custody) {
  if (!custody) return true;
  if (custody.overrides && custody.overrides[dateKey] !== undefined) {
    return custody.overrides[dateKey];
  }
  const base = new Date(custody.baseDate + "T12:00:00");
  const day = new Date(dateKey + "T12:00:00");
  const diffWeeks = Math.floor((day - base) / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks % 2 === 0
    ? custody.withKids !== false
    : !(custody.withKids !== false);
}

export function fmtTime(deadline) {
  if (!deadline) return "--:--";
  return `${String(deadline.h).padStart(2, "0")}:${String(deadline.m).padStart(2, "0")}`;
}
