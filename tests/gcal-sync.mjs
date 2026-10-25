// Tests de la lógica pura del sync planner → Google Calendar (issue #26). Sin red.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDays, dayRange, recurrenceOccursOn, buildDesired, toBody, sigOf, planSync,
  verificarSeguridad, buildInbox, MARCAS, eventosAbsorbidos,
} from "../modules/feed/scripts/gcal-sync-lib.mjs";

const TZ = "America/Santiago";

// 1) recurrenceOccursOn == nextRecurDate de App.jsx (detecta deriva entre la copia y la original)
const src = readFileSync(new URL("../core/App.jsx", import.meta.url), "utf8");
const i0 = src.indexOf("function nextRecurDate(");
assert.ok(i0 > 0, "nextRecurDate no encontrada en App.jsx");
let depth = 0, i1 = src.indexOf("{", i0);
for (let i = i1; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) { i1 = i + 1; break; } }
const original = new Function(`${src.slice(i0, i1)}; return nextRecurDate;`)();
let comparadas = 0;
for (const created of ["2026-01-31", "2026-02-28", "2026-03-15", "2024-02-29"]) {
  for (const freq of ["daily", "every3", "every5", "weekly", "biweekly", "monthly", "yearly", "raro"]) {
    for (const d of dayRange("2026-01-01", "2027-03-31")) {
      assert.equal(recurrenceOccursOn(created, freq, d), original(created, freq, d), `${created} ${freq} ${d}`);
      comparadas++;
    }
  }
}

// 2) qué pasa y qué no
const from = "2026-10-23", to = "2026-11-03";
const D1 = addDays(from, 1), D8 = addDays(from, 7);
const state = {
  schemaVersion: 1,
  dayData: {
    [from]: {
      schedule: [{ id: "s1", label: "PERSONAL", start: "06:00", end: "07:00" }],
      tasks: [
        { id: 1, text: "  Llevar   libros ", deadline: { h: 9, m: 5 } },
        { id: 2, text: "Sin hora" },
        { id: 3, text: "Hecha", done: true },
        { id: 4, text: "Privada", privada: true },
        { id: 5, text: "preparar: ayuno", prepReminder: true },
        { id: 6, text: "Preparar: otra cosa" },
        { id: 7, text: "Viene de recurrente", recurringId: "R9" },
        { id: 8, text: "", postponed: true, recurringId: "RX" },
        { id: 9, text: "   " },
        { id: "a", text: "Con baliza", urgent: true },
        { id: "b", text: "Cita", healthEventId: "h1" },
      ],
    },
    [D1]: { tasks: [{ id: "c", text: "Baliza mañana", urgent: true, deadline: { h: 23, m: 50 } }] },
  },
  calMarks: { [from]: ["work", "romantic", "melee", "pokemon", "gym", "nuevo", "work", "colegio"], [D1]: ["doctor"] },
  recurring: [
    { id: "R1", text: "Semanal", freq: "weekly", createdAt: from },
    { id: "R2", text: "Privado", freq: "weekly", createdAt: from, privada: true },
    { id: "R3", text: "Diaria urgente", freq: "daily", createdAt: D1, urgent: true },
  ],
};
// R1 pospuesta en D8
state.dayData[D8] = { tasks: [{ id: "p", text: "", postponed: true, recurringId: "R1" }] };

const des = buildDesired(state, { from, to });
const keys = des.map(e => e.key).sort();
const tareas = keys.filter(k => k.startsWith("t:"));
assert.deepEqual(tareas.filter(k => !k.endsWith(">m")), [`t:${from}:1`, `t:${from}:2`, `t:${from}:a`, `t:${from}:b`, `t:${D1}:c`].sort());
assert.ok(!keys.some(k => /:(3|4|5|6|7|8|9)$/.test(k)), "no pasan hecha/privada/preparar/recurringId/postponed");
// marcadores: D-1 < from → no hay para las de `from`; sí para la de D1 (cae en `from`)
assert.deepEqual(keys.filter(k => k.endsWith(">m") && k.startsWith("t:")), [`t:${D1}:c>m`]);
const mc = des.find(e => e.key === `t:${D1}:c>m`);
assert.equal(mc.date, from); assert.equal(mc.summary, "Mañana: Baliza mañana"); assert.equal(mc.allDay, true);
// texto limpio y hora
const t1 = des.find(e => e.key === `t:${from}:1`);
assert.equal(t1.summary, "Llevar libros"); assert.equal(t1.allDay, false); assert.equal(t1.h, 9);
// calmarks: allowlist, sin duplicados, sin romantic/melee/pokemon/desconocidos
assert.deepEqual(keys.filter(k => k.startsWith(`c:${from}`)), [`c:${from}:colegio`, `c:${from}:gym`, `c:${from}:work`]);
// doctor: el calmark y su marcador el día anterior (cae en `from`); un calmark común no genera marcador
assert.deepEqual(keys.filter(k => k.startsWith(`c:${D1}`)), [`c:${D1}:doctor`, `c:${D1}:doctor>m`]);
const md = des.find(e => e.key === `c:${D1}:doctor>m`);
assert.equal(md.date, from); assert.equal(md.summary, "Mañana: Doctor");
assert.ok(!keys.some(k => k.endsWith(">m") && k.startsWith(`c:${from}`)), "work/gym/colegio no tienen marcador");
// recurrentes: R1 semanal en from (D8 pospuesta, lo demás fuera de ventana de 12 días salvo from+7=D8), R2 privada fuera, R3 diaria desde D1
const rec = keys.filter(k => k.startsWith("r:"));
assert.ok(rec.includes(`r:R1:${from}`) && !rec.includes(`r:R1:${D8}`), "pospuesta respeta la excepción");
assert.ok(!rec.some(k => k.startsWith("r:R2")), "recurrente privada no pasa");
assert.ok(!rec.includes(`r:R3:${from}`) && rec.includes(`r:R3:${D1}`), "recurrente no ocurre antes de createdAt");
assert.ok(keys.includes(`r:R3:${D1}>m`) && keys.includes(`r:R3:${addDays(D1, 1)}>m`), "marcador de recurrente urgente el día anterior");
assert.equal(des.find(e => e.key === `r:R3:${D1}>m`).date, from);
assert.ok(!keys.includes(`r:R3:${from}>m`), "sin ocurrencia no hay marcador");
// el horario personal jamás aparece
assert.ok(!des.some(e => /PERSONAL/.test(e.summary)));
// claves únicas
assert.equal(new Set(keys).size, keys.length);

// hora 00:00 = día completo; 00:01 sigue siendo con hora
const medianoche = buildDesired({ dayData: { [from]: { tasks: [{ id: "m", text: "Medianoche", deadline: { h: 0, m: 0 } }, { id: "n", text: "Casi", deadline: { h: 0, m: 1 } }] } } }, { from, to: from });
assert.equal(medianoche.find(e => e.key === `t:${from}:m`).allDay, true);
assert.equal(medianoche.find(e => e.key === `t:${from}:n`).allDay, false);

// 3) cuerpo Google: con hora, sin hora y cruce de medianoche
const b1 = toBody(t1, TZ);
assert.deepEqual(b1.start, { dateTime: `${from}T09:05:00`, timeZone: TZ });
assert.deepEqual(b1.end, { dateTime: `${from}T09:35:00`, timeZone: TZ });
assert.equal(b1.extendedProperties.private.angst, "1");
assert.equal(b1.extendedProperties.private.angstKey, t1.key);
const bn = toBody({ key: "k", summary: "x", allDay: false, date: from, h: 23, m: 50 }, TZ);
assert.equal(bn.end.dateTime, `${addDays(from, 1)}T00:20:00`);
const bd = toBody({ key: "k", summary: "x", allDay: true, date: from }, TZ);
assert.deepEqual(bd.start, { date: from }); assert.deepEqual(bd.end, { date: addDays(from, 1) });

// 4) plan: crear / mantener / actualizar (edición de un hijo) / borrar / duplicados / cancelados
const evA = { key: "A", summary: "A", allDay: true, date: from };
const evB = { key: "B", summary: "B", allDay: false, date: from, h: 10, m: 0 };
const evC = { key: "C", summary: "C", allDay: true, date: from };
const g = (ev, id, extra = {}) => ({ id, ...toBody(ev, TZ), ...extra });
// Google devuelve la hora con offset: sigOf lo normaliza
const gB = g(evB, "gB"); gB.start = { dateTime: `${from}T10:00:00-03:00`, timeZone: TZ }; gB.end = { dateTime: `${from}T10:30:00-03:00`, timeZone: TZ };
const plan = planSync(
  [evA, evB, evC, { key: "D", summary: "D", allDay: true, date: from }],
  [g(evA, "gA"), gB, { ...g(evC, "gC"), summary: "C editado por un hijo" }, g({ ...evA, key: "Z" }, "gZ"), g(evA, "gA2")],
  TZ,
);
assert.equal(plan.keep, 2, "A y B sin cambios");
assert.deepEqual(plan.update.map(u => u.key), ["C"], "la edición de un hijo se revierte");
assert.deepEqual(plan.create.map(c => c.key), ["D"]);
assert.deepEqual(plan.remove.map(r => r.id).sort(), ["gA2", "gZ"], "sobrante y duplicado se borran");
assert.equal(planSync([evA], [g(evA, "gA", { status: "cancelled" })], TZ).update.length, 1);
assert.equal(sigOf(gB), sigOf(toBody(evB, TZ)));

// 5) frenos de seguridad
assert.throws(() => verificarSeguridad({ remove: [] }, { desiredCount: 0, existingCount: 6 }), /vaciar/);
assert.throws(() => verificarSeguridad({ remove: new Array(41).fill(0) }, { desiredCount: 50, existingCount: 90 }), /aborta/);
verificarSeguridad({ remove: new Array(40).fill(0) }, { desiredCount: 50, existingCount: 90 });
verificarSeguridad({ remove: [] }, { desiredCount: 0, existingCount: 3 });

// 6) bandeja: solo eventos de otras manos, sin cancelados, ordenada
const inbox = buildInbox([
  g(evA, "x1"),
  { id: "k2", summary: "Tarea del colegio", start: { date: "2026-10-25" }, end: { date: "2026-10-26" }, creator: { email: "h@x.test" }, updated: "u" },
  { id: "k1", summary: "Dentista", start: { dateTime: "2026-10-24T10:00:00-03:00" }, end: { dateTime: "2026-10-24T11:00:00-03:00" } },
  { id: "k3", summary: "Borrado", status: "cancelled", start: { date: "2026-10-27" } },
]);
assert.deepEqual(inbox.map(e => e.id), ["k1", "k2"]);
assert.equal(inbox[1].allDay, true); assert.equal(inbox[1].creator, "h@x.test");
assert.ok(Object.keys(MARCAS).length >= 6);

// 7) absorbidos: solo si TODAS las tareas del evento ya están en el estado exportado
const estAbs = {
  dayData: { "2026-10-28": { tasks: [{ id: "t1" }, { id: 7 }] }, "2026-10-29": { tasks: [{ id: "t2" }] } },
  gcalInbox: { imported: {
    e1: { at: 1, items: [{ date: "2026-10-28", taskId: "t1" }] },
    e2: { at: 1, items: [{ date: "2026-10-28", taskId: "t1" }, { date: "2026-10-29", taskId: "t2" }] },
    e3: { at: 1, items: [{ date: "2026-10-30", taskId: "falta" }] },
    e4: { at: 1, items: [{ date: "2026-10-28", taskId: 7 }] },
    e5: { at: 1, items: [] },
  } },
};
const ext = ["e1", "e2", "e3", "e4", "e5", "e6"].map(id => ({ id }));
assert.deepEqual(eventosAbsorbidos(estAbs, ext).map(x => x.id), ["e1", "e2", "e4"], "e3 (tarea no llegó), e5 (sin items) y e6 (sin registro) se quedan");
assert.deepEqual(eventosAbsorbidos({ dayData: {} }, ext), [], "sin gcalInbox no se borra nada");
assert.deepEqual(eventosAbsorbidos({ gcalInbox: { imported: { e1: { items: [{ taskId: "t1" }] } } } }, ext), [], "sin dayData no se borra nada");

console.log(`OK gcal-sync: ${comparadas} comparaciones de recurrencia contra App.jsx, reglas, cuerpo, plan, frenos y bandeja`);
