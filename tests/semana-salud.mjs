// Dashboard de Semana: las citas del día y los tratamientos en curso entran como balizas (con su detalle).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { saludDelDia } from "../modules/salud/saludModel.js";

const out = join(tmpdir(), "semana-salud-dashboard.mjs");
await build({ entryPoints: [fileURLToPath(new URL("../core/SemanaDashboard.jsx", import.meta.url))], bundle: true, format: "esm",
  outfile: out, loader: { ".jsx": "jsx" }, logLevel: "silent" });
const { buildResumen } = await import(pathToFileURL(out).href);

const kh = { family: [{ id: "luna", name: "Luna" }], events: [
  { id: "c1", personId: "luna", type: "cita", title: "Pediatría", medico: "Dra. Soto", start: "2026-11-10", startTime: "15:30" },
  { id: "c0", personId: "luna", type: "cita", title: "Control", start: "2026-11-02", startTime: "09:00" },
  { id: "t1", personId: "luna", type: "tratamiento", title: "Kinesiología", dosis: "3 sesiones", freq: "diaria", start: "2026-11-09", startTime: "10:00", end: "2026-11-11" },
] };
const weekKeys = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];
const dayData = { "2026-11-12": { tasks: [{ id: "t", text: "pagar", urgent: true, done: false, deadline: { h: 9, m: 0 } }] },
  "2026-11-07": { tasks: [{ id: "p", text: "atrasada", urgent: true, done: false }] } };
const base = { todayKey: "2026-11-08", ahoraMin: 600, weekKeys, dayData, calMarks: {}, eventos: [], stressFor: () => 0, conNinosEn: () => false, ejercicioHoy: false, kcalHoy: 0 };

const r = buildResumen({ ...base, saludDe: k => saludDelDia(kh, k) });
assert.deepEqual(r.semana.map(c => c.balizas), [0, 1, 2, 1, 1, 0, 0], "cuenta citas y tratamientos como balizas, junto a las tareas con 🚨");
assert.equal(r.balizasSemana, 5);
assert.deepEqual(r.proxima, { dateKey: "2026-11-09", dias: 1, dow: 1, icono: "🧴", texto: "Kinesiología · Luna", hora: "10:00", extra: 0 });
const d10 = r.agenda.find(d => d.k === "2026-11-10");
assert.deepEqual(d10.balizas.map(b => [b.icono, b.hora, b.texto]), [["🏥", "15:30", "Pediatría · Luna"], ["🧴", null, "Kinesiología · Luna"]], "por hora; sin hora al final");
assert.equal(d10.balizas[0].detalle, "con Dra. Soto");
assert.equal(r.agenda.find(d => d.k === "2026-11-12").balizas[0].icono, "🚨", "las tareas siguen con 🚨");

// días pasados: solo tareas (una cita ya ocurrida no es una baliza pendiente)
const pas = buildResumen({ ...base, todayKey: "2026-11-12", weekKeys: ["2026-11-02", "2026-11-07", "2026-11-12"], saludDe: k => saludDelDia(kh, k) });
assert.deepEqual(pas.semana.map(c => c.balizas), [0, 1, 1], "2-nov: la cita pasada no cuenta; 7-nov: la tarea atrasada sí");

// sin saludDe, todo igual que antes (solo tareas)
const sin = buildResumen(base);
assert.equal(sin.balizasSemana, 1); assert.equal(sin.proxima.icono, "🚨"); assert.equal(sin.proxima.texto, "pagar");

console.log("semana-salud: OK");
