import assert from "node:assert/strict";
import {
  calcHazard, addSymptomEntry, deleteEvent, closeIllness, upsertEvent, activeIllness,
  migrateKidsHealth, planCita, citaDates, buildTimeline, buildSummary, illnessLabel,
  addMonthsKey, addDaysKey, daysInclusive, emptyKidsHealth, eventMatches,
  personIdFor, addPerson, updatePerson, removePerson, personEventCount,
  effectiveMarks, citasOnDay, citaLine, nextCitaDate, buildSections,
} from "../modules/salud/saludModel.js";
import { computeStressScore } from "../core/stress.js";

// ── fechas ──
assert.equal(addMonthsKey("2026-01-31", 1), "2026-02-28");
assert.equal(addMonthsKey("2026-08-15", 6), "2027-02-15");
assert.equal(addDaysKey("2026-03-01", -1), "2026-02-28");
assert.equal(daysInclusive("2026-09-28", "2026-10-04"), 7);

// ── hazard: temperatura medida suma; no se cuenta doble con síntoma de fiebre ──
assert.equal(calcHazard([], []), "CLEAR");
assert.equal(calcHazard([], [{v:38.4}]), "WATCH");
assert.equal(calcHazard(["tos_flema"], [{v:39.2}]), "WARNING");
assert.equal(calcHazard(["temp_38_39"], [{v:38.5}]), "WATCH");
assert.equal(calcHazard([], [{v:40.2}]), "WARNING");
assert.equal(calcHazard(["convulsion"], []), "CRITICAL");

// ── registro de síntomas ──
let kh = {...emptyKidsHealth(), family:[{id:"ana",name:"Ana",dob:"2019-05-01"}]};
let r = addSymptomEntry(kh, {personId:"ana", date:"2026-10-01", time:"20:00", sintomas:["tos_seca"], temps:[{t:"20:00",v:"38.6"}], note:"noche mala"}, {illness:"i1", entry:"s1"});
assert.equal(r.kh.events.length, 2);
assert.equal(r.doctorMarkDate, null);
assert.equal(activeIllness(r.kh.events, "ana").id, "i1");
r = addSymptomEntry(r.kh, {personId:"ana", date:"2026-10-02", sintomas:["tos_flema"], temps:[{t:null,v:"39.4"}], note:""}, {illness:"i2", entry:"s2"});
assert.equal(r.kh.events.filter(e=>e.type==="enfermedad").length, 1, "reusa el episodio activo");
assert.equal(r.kh.events.find(e=>e.id==="i1").hazardLevel, "WARNING", "nivel = último registro");
const retro = addSymptomEntry(r.kh, {personId:"ana", date:"2026-09-30", sintomas:["congestion"], temps:[]}, {illness:"iX", entry:"sX"});
assert.equal(retro.kh.events.filter(e=>e.type==="enfermedad").length, 1, "registro retroactivo no abre un segundo episodio");
assert.equal(retro.kh.events.find(e=>e.id==="i1").start, "2026-09-30");
const crit = addSymptomEntry(kh, {personId:"ana", date:"2026-10-03", sintomas:["convulsion"], temps:[]}, {illness:"i9", entry:"s9"});
assert.equal(crit.doctorMarkDate, "2026-10-03");
// sin síntomas ni temperatura el registro igual existe (solo nota)
const onlyNote = addSymptomEntry(kh, {personId:"ana", date:"2026-10-03", sintomas:[], temps:[], note:"decaída"}, {illness:"i8", entry:"s8"});
assert.equal(onlyNote.kh.events.length, 2);

// ── cierre y borrado en cascada ──
let closed = closeIllness(r.kh, "i1", "2026-10-05");
assert.equal(activeIllness(closed.events, "ana"), null);
const withMed = upsertEvent(r.kh, {id:"m1", personId:"ana", type:"medicamento", parentId:"i1", title:"Ibuprofeno", start:"2026-10-02"});
const del = deleteEvent(withMed, "i1");
assert.equal(del.events.length, 0, "borrar el episodio borra sus hijos");
const delLog = deleteEvent(r.kh, "s2");
assert.equal(delLog.events.find(e=>e.id==="i1").hazardLevel, "ADVISORY", "al borrar un registro se recalcula el nivel (tos seca 1 + 38.6 °C 2)");

// ── migración v1 → v2 ──
const v1 = {
  family:[{id:"ana",name:"Ana",dob:"2019-05-01"}],
  episodes:[
    {id:"100", kidId:"ana", startDate:"2026-09-10", endDate:"2026-09-14", hazardLevel:"ADVISORY", missedDays:2, notas:"",
     lastSintomas:["tos_flema"], days:[{date:"2026-09-10", sintomas:["tos_seca"], hazardLevel:"WATCH", nota:"inicio", temperatura:"38.1"},
                                        {date:"2026-09-11", sintomas:["tos_flema"], hazardLevel:"ADVISORY", nota:"", temperatura:""}]},
    {id:"200", kidId:"ana", startDate:"2026-10-01", endDate:null, hazardLevel:"WATCH", lastSintomas:["congestion"], days:[]},
  ],
  dailyLog:{"2026-09-10":{ana:{sinNovedad:false}}, "2026-09-20":{ana:{sinNovedad:true}}},
  profiles:{ana:{alergias:["amoxicilina"], growthLog:[{date:"2026-01-01", peso:20, talla:110}],
                 citasRegulares:[{id:String(new Date(2026,3,10).getTime()), tipo:"control pediátrico", medico:"Dra. R", frecMeses:6, hora:"10:30"}]}},
};
const m = migrateKidsHealth(v1, "2026-10-04");
assert.equal(m.schemaVersion, 2);
assert.equal(m.episodes, undefined);
assert.equal(m.dailyLog, undefined);
assert.equal(m.legacy.episodes.length, 2, "lo original queda respaldado");
assert.equal(m.legacy.citasRegulares.ana.length, 1);
assert.equal(m.profiles.ana.citasRegulares, undefined);
assert.deepEqual(m.profiles.ana.alergias, ["amoxicilina"]);
assert.equal(m.events.filter(e=>e.type==="enfermedad").length, 2);
assert.equal(m.events.filter(e=>e.type==="sintoma").length, 3);
const mTemp = m.events.find(e=>e.id==="sx_100_2026-09-10");
assert.deepEqual(mTemp.temps, [{t:null,v:38.1}]);
const mCita = m.events.find(e=>e.type==="cita");
assert.equal(mCita.start, "2026-10-10", "primera ocurrencia >= hoy desde la fecha de creación");
assert.equal(mCita.legacy, true);
assert.equal(migrateKidsHealth(m, "2026-10-04"), m, "idempotente: v2 se devuelve igual");
assert.equal(migrateKidsHealth({episodes:[]}, "2026-10-04").legacy, undefined);
assert.equal(migrateKidsHealth(undefined, "2026-10-04").events.length, 0);

// ── citas ↔ planner ──
const cita = {id:"c1", personId:"ana", type:"cita", title:"pediatría", medico:"Dra. R", start:"2026-11-10", startTime:"10:30", repeatMonths:6};
assert.deepEqual(citaDates(cita), ["2026-11-10","2027-05-10","2027-11-10","2028-05-10"]);
const dayData = {"2026-11-10":{tasks:[{id:"x", text:"otra cosa"}]}};
const marks = {"2026-11-10":["social"]};
let p = planCita({events:[], dayData, marks, prevEv:null, nextEv:cita, personName:"Ana"});
assert.equal(Object.keys(p.dayPatches).length, 8, "4 citas + 4 preparaciones");
assert.equal(p.dayPatches["2026-11-10"].length, 2, "conserva la tarea existente y agrega la cita");
const main = p.dayPatches["2026-11-10"].find(t=>t.healthEventId==="c1");
assert.deepEqual(main.deadline, {h:10,m:30});
assert.equal(main.text, "pediatría Ana — Dra. R");
const prep = p.dayPatches["2026-11-09"][0];
assert.deepEqual(prep.deadline, {h:21,m:30});
assert.equal(prep.text, "preparar: pediatría Ana — Dra. R");
assert.equal(p.marks, null, "la marca 🏥 ya no se escribe: se deriva de las citas");
assert.deepEqual(p.ev.markedDates, []);

// marca derivada = guardada ∪ días con cita
const evsC = [cita];
const eff = effectiveMarks({"2026-11-10":["social"], "2026-12-01":["work"]}, evsC);
assert.deepEqual(eff["2026-11-10"], ["social","doctor"]);
assert.deepEqual(eff["2027-05-10"], ["doctor"]);
assert.deepEqual(eff["2026-12-01"], ["work"]);
assert.deepEqual(effectiveMarks({"2026-11-10":["doctor"]}, evsC)["2026-11-10"], ["doctor"], "sin duplicar si ya estaba guardada");
assert.deepEqual(effectiveMarks(undefined, []), {});
assert.equal(citasOnDay(evsC, "2026-11-10").length, 1);
assert.equal(citasOnDay(evsC, "2026-11-11").length, 0);
assert.equal(citaLine(cita, "Ana"), "Ana · pediatría · 10:30");
assert.equal(citaLine(cita, "Ana", true), "Ana · pediatría · 10:30 — Dra. R");
assert.equal(nextCitaDate(cita, "2026-11-11"), "2027-05-10");
assert.equal(nextCitaDate({...cita, repeatMonths:null}, "2026-11-11"), null);

// editar: cambiar de fecha mueve las tareas
const dd2 = {}; Object.entries(p.dayPatches).forEach(([k,v])=>{dd2[k]={tasks:v};});
const moved = {...p.ev, start:"2026-11-12"};
let p2 = planCita({events:[], dayData:dd2, marks:{}, prevEv:p.ev, nextEv:moved, personName:"Ana"});
assert.equal(p2.dayPatches["2026-11-10"].some(t=>t.healthEventId==="c1"), false);
assert.equal(p2.dayPatches["2026-11-10"].some(t=>t.id==="x"), true, "no toca tareas ajenas");
assert.equal(p2.dayPatches["2026-11-12"].some(t=>t.healthEventId==="c1"), true);
// eliminar
let p3 = planCita({events:[], dayData:dd2, marks:{}, prevEv:p.ev, nextEv:null, personName:"Ana"});
assert.equal(p3.ev, null);
Object.values(p3.dayPatches).forEach(t=>assert.equal(t.some(x=>x.healthEventId==="c1"), false));

// limpieza de marcas guardadas que la cita dejó antes (versión previa de Salud o autoMarkDoctor)
const oldEv = {...cita, markedDates:["2026-11-10"]};
let c1 = planCita({events:[], dayData:dd2, marks:{"2026-11-10":["social","doctor"]}, prevEv:oldEv, nextEv:null, personName:"Ana"});
assert.deepEqual(c1.marks["2026-11-10"], ["social"], "se suelta la marca que Salud había guardado");
const isMed = t => /dentista|consulta/.test(t||"");
const dentist = {id:"c9", personId:"ana", type:"cita", title:"dentista", start:"2026-11-20", startTime:"09:00", repeatMonths:null, markedDates:[]};
let dd3 = planCita({events:[], dayData:{}, marks:{}, prevEv:null, nextEv:dentist, personName:"Ana", isMedicalTask:isMed}).dayPatches;
const ddd = {}; Object.entries(dd3).forEach(([k,v])=>{ddd[k]={tasks:v};});
let c2 = planCita({events:[], dayData:ddd, marks:{"2026-11-20":["doctor"]}, prevEv:dentist, nextEv:null, personName:"Ana", isMedicalTask:isMed});
assert.equal(c2.marks["2026-11-20"], undefined, "autoMarkDoctor dejó la marca por el texto de la tarea: se limpia al borrar la cita");
let c3 = planCita({events:[{id:"o", personId:"ana", type:"cita", title:"x", start:"2026-11-20", startTime:"11:00"}], dayData:ddd, marks:{"2026-11-20":["doctor"]}, prevEv:dentist, nextEv:null, personName:"Ana", isMedicalTask:isMed});
assert.equal(c3.marks, null, "otra cita el mismo día mantiene la marca");
let c4 = planCita({events:[], dayData:ddd, marks:{"2026-11-20":["doctor"]}, prevEv:{...cita,id:"zz",title:"kinesiología",start:"2026-11-20",markedDates:[]}, nextEv:null, personName:"Ana", isMedicalTask:isMed});
assert.equal(c4.marks, null, "una marca manual sin relación con la cita no se toca");

// ── línea de tiempo ──
const tl = buildTimeline([...m.events, cita, {id:"m9", personId:"ana", type:"medicamento", title:"Vitamina D", start:"2026-09-20"}], {personId:null, today:"2026-10-04"});
assert.equal(tl.upcoming.length, 2);
assert.equal(tl.upcoming[0].start <= tl.upcoming[1].start, true);
assert.equal(tl.items.filter(i=>i.kind==="illness").length, 2);
assert.equal(tl.items[0].ev.id, "ep_200", "más reciente primero");
assert.equal(tl.items.find(i=>i.ev.id==="ep_100").children.length, 2);
assert.equal(tl.items.some(i=>i.kind==="event"&&i.ev.id==="m9"), true);
assert.equal(buildTimeline(m.events, {personId:"otro", today:"2026-10-04"}).items.length, 0);

// ── resumen ──
const evs = [...m.events, {id:"m2", personId:"ana", type:"medicamento", parentId:"ep_100", title:"Ibuprofeno", dosis:"5 ml", start:"2026-09-10", startTime:"21:10"}];
const txt = buildSummary({person:m.family[0], profile:m.profiles.ana, events:evs, from:"2026-09-01", to:"2026-10-04", today:"2026-10-04"});
assert.match(txt, /Resumen de salud — Ana \(\d+ años\)/);
assert.match(txt, /Alergias: amoxicilina/);
assert.match(txt, /2026-09-10 → 2026-09-14 \(5 días\)/);
assert.match(txt, /Temperatura máxima: 38\.1 °C \(2026-09-10\); días con ≥38 °C: 1/);
assert.match(txt, /Ibuprofeno 5 ml: 10\/09 21:10/);
assert.match(txt, /Días sin colegio: 2/);
assert.match(txt, /2026-10-01 → en curso \(4 días, aún activo\)/);
assert.match(buildSummary({person:m.family[0], profile:{}, events:[], from:"2026-01-01", to:"2026-01-31", today:"2026-10-04"}), /Sin registros/);

// ── etiquetas y búsqueda ──
assert.equal(illnessLabel(m, m.events.find(e=>e.id==="ep_100")), "Tos seca, Tos con flema");
assert.equal(eventMatches(mTemp, "inicio"), true);
assert.equal(eventMatches(mTemp, "38.1"), true);
assert.equal(eventMatches(mTemp, "nada"), false);


// ── personas ──
assert.equal(personIdFor("Sofía Pérez", []), "sofiaprez".replace("prez","perez"), "slug sin acentos");
assert.equal(personIdFor("", []), "persona");
let fam = emptyKidsHealth();
let a1 = addPerson(fam, {name:" Cristopher ", dob:"1990-01-01", icon:"🧔", sex:"m"});
assert.equal(a1.id, "cristopher", "se conserva el id que usa core/stress.js");
let a2 = addPerson(a1.kh, {name:"Ana", dob:"2019-05-01", icon:"👧", sex:"f"});
let a3 = addPerson(a2.kh, {name:"ana", dob:"2021-02-02"});
assert.deepEqual(a3.kh.family.map(p=>p.id), ["cristopher","ana","ana2"], "ids únicos para nombres repetidos");
assert.equal(a3.kh.family[2].icon, "🙂"); assert.equal(a3.kh.family[2].sex, "m");
const upd = updatePerson(a3.kh, "ana", {name:"Ana María", dob:"2019-05-02", icon:"👧", sex:"f"});
assert.equal(upd.family[1].name, "Ana María"); assert.equal(upd.family[1].id, "ana", "editar no cambia el id");
const withEv = {...a3.kh, profiles:{ana:{alergias:["x"]}, ana2:{}}, events:[{id:"e1", personId:"ana", type:"medicamento", title:"x", start:"2026-10-01"}]};
assert.equal(personEventCount(withEv,"ana"), 1);
assert.equal(removePerson(withEv,"ana"), null, "con registros no se borra");
const rem = removePerson(withEv,"ana2");
assert.deepEqual(rem.family.map(p=>p.id), ["cristopher","ana"]);
assert.equal(rem.profiles.ana2, undefined); assert.ok(rem.profiles.ana);

// ── diagnóstico ──
let dkh = {...emptyKidsHealth(), family:[{id:"ana",name:"Ana",dob:"2019-05-01"}]};
let dr = addSymptomEntry(dkh, {personId:"ana", date:"2026-10-01", sintomas:["tos_flema"], temps:[]}, {illness:"iD", entry:"sD"});
const dxEv = {id:"dx1", personId:"ana", type:"diagnostico", parentId:"iD", title:"Bronquitis aguda", medico:"Dra. R, pediatría", start:"2026-10-02", note:"reposo"};
const withDx = upsertEvent(dr.kh, dxEv);
assert.equal(illnessLabel(withDx, withDx.events.find(e=>e.id==="iD")), "Bronquitis aguda", "el diagnóstico nombra el episodio");
assert.equal(illnessLabel(dr.kh, dr.kh.events.find(e=>e.id==="iD")), "Tos con flema", "sin diagnóstico, por síntomas");
assert.equal(eventMatches(dxEv, "bronquitis"), true);
const dxTxt = buildSummary({person:withDx.family[0], profile:{}, events:withDx.events, from:"2026-09-01", to:"2026-10-31", today:"2026-10-04"});
assert.match(dxTxt, /Diagnóstico \(02\/10\): Bronquitis aguda — Dra\. R, pediatría · reposo/);
const looseDx = buildSummary({person:withDx.family[0], profile:{}, events:[{...dxEv, parentId:undefined}], from:"2026-09-01", to:"2026-10-31", today:"2026-10-04"});
assert.match(looseDx, /DIAGNÓSTICOS \(fuera de episodios\)/);
assert.equal(deleteEvent(withDx,"dx1").events.some(e=>e.id==="dx1"), false);

// ── secciones de la pantalla colapsada ──
const secEvents = [
  {id:"i1", personId:"ana", type:"enfermedad", start:"2026-10-01", end:null, hazardLevel:"WATCH", title:""},
  {id:"s1", personId:"ana", type:"sintoma", parentId:"i1", start:"2026-10-01", sintomas:["tos_seca"], temps:[], hazardLevel:"WATCH"},
  {id:"i0", personId:"ana", type:"enfermedad", start:"2026-08-01", end:"2026-08-05", hazardLevel:"CLEAR", title:"resfrío"},
  {id:"c1", personId:"ana", type:"cita", title:"pediatría", start:"2026-10-20", startTime:"10:30", repeatMonths:null},
  {id:"c0", personId:"ana", type:"cita", title:"dentista", start:"2026-09-01", startTime:"09:00", repeatMonths:null},
  {id:"m1", personId:"ana", type:"medicamento", title:"Amoxicilina", start:"2026-10-02", end:"2026-10-09"},
  {id:"m2", personId:"ana", type:"medicamento", title:"Vitamina D", start:"2026-09-15"},
  {id:"x1", personId:"otro", type:"enfermedad", start:"2026-10-03", end:null},
];
const secAll = buildSections(secEvents, {personId:null, today:"2026-10-04"});
assert.equal(secAll.illnesses.length, 3);
assert.equal(secAll.active.length, 2);
assert.equal(secAll.upcoming.length, 1);
assert.equal(secAll.upcoming[0].dk, "2026-10-20");
assert.equal(secAll.vigentes.map(m=>m.id).join(), "m1");
const secAna = buildSections(secEvents, {personId:"ana", today:"2026-10-04"});
assert.equal(secAna.illnesses.length, 2);
assert.equal(secAna.active.length, 1);
assert.equal(secAna.meds.length, 2);
assert.ok(secAna.months.length>=2, "historial agrupado por mes");
assert.equal(secAna.months[0].month >= secAna.months[secAna.months.length-1].month, true, "más reciente primero");
assert.equal(secAna.items.find(i=>i.ev.id==="i1").children.length >= 1, true);
assert.equal(buildSections([], {personId:null, today:"2026-10-04"}).historyCount, 0);

// ── carga de estrés (core/stress.js lee los eventos nuevos) ──
const dd = {"2026-10-02":{tasks:[]}};
const base = computeStressScore("2026-10-02", dd, {}, {events:[]});
const khSick = {events:[{id:"i",personId:"ana",type:"enfermedad",start:"2026-10-01",end:null,hazardLevel:"WARNING"}]};
assert.equal(computeStressScore("2026-10-02", dd, {}, khSick) - base, 3, "episodio activo de un hijo suma según hazard (WARNING=3)");
const khSelf = {events:[{id:"j",personId:"cristopher",type:"enfermedad",start:"2026-10-01",end:null,hazardLevel:"WARNING"}]};
assert.equal(Math.round((computeStressScore("2026-10-02", dd, {}, khSelf) - base)*10)/10, 2.1, "episodio propio pesa 0.7");
const khClosed = {events:[{id:"k",personId:"ana",type:"enfermedad",start:"2026-09-20",end:"2026-09-25",hazardLevel:"CRITICAL"}]};
assert.equal(computeStressScore("2026-10-02", dd, {}, khClosed), base, "episodio cerrado no suma");
assert.equal(computeStressScore("2026-10-02", dd, {}, {episodes:[{kidId:"ana",startDate:"2026-10-01",hazardLevel:"CRITICAL"}]}), base, "el campo viejo ya no se lee");
const khCita = {events:[{id:"cx", personId:"ana", type:"cita", title:"pediatría", start:"2026-10-02", startTime:"10:30"}]};
assert.equal(computeStressScore("2026-10-02", dd, {}, khCita) - base, 1, "una cita suma +1 como la marca doctor");
assert.equal(computeStressScore("2026-10-02", dd, {"2026-10-02":["doctor"]}, khCita) - base, 1, "marca guardada + cita no cuenta doble");

console.log("salud model: ok");
