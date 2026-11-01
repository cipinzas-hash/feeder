// Protocolo Fadiman: lógica pura (sin React). Mismos datos que siempre:
//   fadimanData.fadiman     = { startDate: "YYYY-MM-DD", active: true }
//   fadimanData.fadimanLogs = { "YYYY-MM-DD": { dosed, estado, energia, foco, sueno, sensaciones, notas } }
// Reglas sin cambios: 1 día dosis · 2 de descanso · 60 días desde el inicio (un sábado).
import { sumarDias } from "./diarioModel.js";

export const DURACION = 60;
export const CAMPOS_ESCALA = ["estado", "energia", "foco", "sueno"];
export const ETIQUETAS = { estado: "Estado de ánimo", energia: "Energía", foco: "Foco / concentración", sueno: "Calidad sueño", sensaciones: "Sensaciones físicas", notas: "Notas" };

// Días enteros entre dos claves YYYY-MM-DD (b - a).
export function diffDias(a, b) {
  return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
}
export function esSabado(clave) {
  return new Date(clave + "T12:00:00").getDay() === 6;
}
// null (antes del inicio / sin protocolo) | "dose" | "rest" | "done"
export function tipoDia(cfg, clave) {
  if (!cfg || !cfg.startDate) return null;
  const diff = diffDias(cfg.startDate, clave);
  if (diff < 0) return null;
  if (diff > DURACION) return "done";
  return diff % 3 === 0 ? "dose" : "rest";
}
export function diasDosis(cfg) {
  if (!cfg || !cfg.startDate) return [];
  const out = [];
  for (let i = 0; i <= DURACION; i += 3) out.push(sumarDias(cfg.startDate, i));
  return out;
}
export function diasRestantes(cfg, hoy) {
  if (!cfg || !cfg.startDate) return null;
  return Math.max(0, DURACION - diffDias(cfg.startDate, hoy));
}
export function proximaDosis(cfg, hoy) {
  return diasDosis(cfg).find((d) => d >= hoy) || null;
}

const MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export function etiquetaDia(clave, conSemana = false) {
  if (!clave) return "";
  const [, m, d] = clave.split("-").map(Number);
  const base = `${d} ${MES[m]}`;
  return conSemana ? `${DOW[new Date(clave + "T12:00:00").getDay()]} ${base}` : base;
}
