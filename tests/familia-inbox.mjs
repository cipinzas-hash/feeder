// Tests de la bandeja Familia → Angst (core/familiaInbox.js, issue #26). Sin red ni navegador.
import assert from "node:assert/strict";
import {
  FAMILIA_KEY, MAX_DIAS, fechasDeEvento, horaDeEvento, pendientes, tareaDesdeEvento,
  registrarImportado, registrarIgnorado, podar, leerDecisiones, guardarDecisiones, normalizarDecisiones,
} from "../core/familiaInbox.js";
import { LOCAL_KEY_FIELDS } from "../core/persistence.js";

// el contrato del export apunta a la misma clave que usa la bandeja
assert.equal(LOCAL_KEY_FIELDS.gcalInbox, FAMILIA_KEY);

// fechas
assert.deepEqual(fechasDeEvento({ allDay: true, start: "2026-10-25", end: "2026-10-26" }), ["2026-10-25"]);
assert.deepEqual(fechasDeEvento({ allDay: true, start: "2026-10-30", end: "2026-11-02" }), ["2026-10-30", "2026-10-31", "2026-11-01"]);
assert.equal(fechasDeEvento({ allDay: true, start: "2026-01-01", end: "2026-03-01" }).length, MAX_DIAS);
assert.deepEqual(fechasDeEvento({ allDay: false, start: "2026-10-28T23:30:00-03:00", end: "2026-10-29T01:00:00-03:00" }), ["2026-10-28"]);
assert.deepEqual(fechasDeEvento({ allDay: true, start: "2026-10-25" }), ["2026-10-25"]);
assert.deepEqual(fechasDeEvento({ start: "basura" }), []);
assert.deepEqual(fechasDeEvento(null), []);

// hora
assert.deepEqual(horaDeEvento({ allDay: false, start: "2026-10-28T14:05:00-03:00" }), { h: 14, m: 5 });
assert.equal(horaDeEvento({ allDay: true, start: "2026-10-28" }), null);
assert.equal(horaDeEvento({ allDay: false, start: "2026-10-28T00:00:00-03:00" }), null, "00:00 = sin hora, igual que el sync");

// pendientes: sin decidir, no pasados, ordenados
const evs = [
  { id: "c", summary: "C", allDay: true, start: "2026-10-31", end: "2026-11-01" },
  { id: "a", summary: "A", allDay: false, start: "2026-10-28T09:00:00-03:00", end: "2026-10-28T10:00:00-03:00" },
  { id: "b", summary: "B", allDay: true, start: "2026-10-28", end: "2026-10-29" },
  { id: "old", summary: "Viejo", allDay: true, start: "2026-10-20", end: "2026-10-21" },
  { id: "imp", summary: "Ya importado", allDay: true, start: "2026-10-29", end: "2026-10-30" },
  { id: "ign", summary: "Ignorado", allDay: true, start: "2026-10-29", end: "2026-10-30" },
  { id: "multi", summary: "Largo", allDay: true, start: "2026-10-22", end: "2026-10-27" }, // empezó antes, termina después de hoy
];
const dec = { imported: { imp: { at: 1, items: [] } }, ignored: { ign: 1 } };
assert.deepEqual(pendientes(evs, dec, "2026-10-24").map(x => x.ev.id), ["multi", "b", "a", "c"]);
assert.deepEqual(pendientes(null, dec, "2026-10-24"), []);

// tarea
assert.deepEqual(tareaDesdeEvento({ summary: "  Reunión   grupo ", allDay: false, start: "2026-10-28T16:30:00-03:00" }, "n1"),
  { id: "n1", text: "Reunión grupo", fixed: false, done: false, deadline: { h: 16, m: 30 } });
assert.deepEqual(tareaDesdeEvento({ summary: "", allDay: true, start: "2026-10-28" }, "n2"),
  { id: "n2", text: "(sin título)", fixed: false, done: false });

// registrar
let d = registrarImportado(normalizarDecisiones(null), "e1", [{ date: "2026-10-28", taskId: "n1" }], 1000);
d = registrarIgnorado(d, "e2", 2000);
assert.deepEqual(d.imported.e1, { at: 1000, items: [{ date: "2026-10-28", taskId: "n1" }] });
assert.equal(d.ignored.e2, 2000);

// poda: lo viejo que ya no está en la bandeja se va; lo que sigue vivo o es reciente se queda
const DIA = 86400000, ahora = 100 * DIA;
const p = podar({
  imported: { vivo: { at: 1 }, viejoMuerto: { at: ahora - 60 * DIA }, recienteMuerto: { at: ahora - 5 * DIA } },
  ignored: { ignVivo: 1, ignViejoMuerto: ahora - 90 * DIA, ignRecienteMuerto: ahora - DIA },
}, [{ id: "vivo" }, { id: "ignVivo" }], ahora);
assert.deepEqual(Object.keys(p.imported).sort(), ["recienteMuerto", "vivo"]);
assert.deepEqual(Object.keys(p.ignored).sort(), ["ignRecienteMuerto", "ignVivo"]);

// storage: ida y vuelta y tolerancia a basura
const mem = new Map();
const store = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
assert.deepEqual(leerDecisiones(store), { imported: {}, ignored: {} });
assert.equal(guardarDecisiones(d, store), true);
assert.deepEqual(leerDecisiones(store), d);
mem.set(FAMILIA_KEY, "{no es json");
assert.deepEqual(leerDecisiones(store), { imported: {}, ignored: {} });
mem.set(FAMILIA_KEY, JSON.stringify({ imported: [], ignored: "x" }));
assert.deepEqual(leerDecisiones(store), { imported: {}, ignored: {} }, "tipos raros se normalizan");

console.log("OK familia-inbox: fechas, hora, pendientes, tarea, decisiones, poda y storage");
