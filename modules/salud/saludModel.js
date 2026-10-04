// Modelo de datos de Salud (schema v2): una sola colección de eventos de
// salud (`kidsHealth.events`) en lugar de episodes / dailyLog / citasRegulares.
// Todo lo de este archivo es puro (sin React, sin storage) para poder probarlo
// con node — ver tests/salud-model.mjs.
//
// Evento = { id, personId, type, start:"YYYY-MM-DD", startTime?, end?, parentId?, ... }
//   enfermedad  : title?, hazardLevel, missedDays, note?      (episodio; agrupa hijos por parentId)
//   sintoma     : sintomas[], temps[{t,v}], hazardLevel, note  (registro; parentId = enfermedad)
//   medicamento : title, dosis?, freq?, end?, note?            (una toma, o un curso si trae end)
//   tratamiento : title, dosis?, end?, note?
//   cita        : title, medico?, repeatMonths?, markedDates[] (se proyecta al planner con healthEventId)
// La clave del estado sigue siendo `kidsHealth` (export/import y resto de App.jsx no cambian).

export const SCHEMA_VERSION = 2;
export const EVENT_TYPES = ["enfermedad","sintoma","medicamento","tratamiento","cita"];

export const SYMPTOM_ZONES = [
  { id:"temp", label:"Temperatura", symptoms:[
    {id:"temp_sub38",   label:"Fiebre leve <38°",      peso:1, flag:null},
    {id:"temp_38_39",   label:"Fiebre 38–39°",         peso:2, flag:null},
    {id:"temp_39_40",   label:"Fiebre 39–40°",         peso:3, flag:null},
    {id:"temp_sobre40", label:"Fiebre >40°",           peso:0, flag:"WARNING"},
    {id:"escalofrios",  label:"Escalofríos",           peso:1, flag:null},
  ]},
  { id:"resp", label:"Respiratorio", symptoms:[
    {id:"tos_seca",     label:"Tos seca",              peso:1, flag:null},
    {id:"tos_flema",    label:"Tos con flema",         peso:3, flag:null},
    {id:"congestion",   label:"Congestión nasal",      peso:1, flag:null},
    {id:"goteo",        label:"Goteo nasal",           peso:1, flag:null},
    {id:"dif_resp_leve",label:"Dificultad respiratoria leve", peso:2, flag:null},
    {id:"dif_resp_grave",label:"Dificultad respiratoria grave",peso:0,flag:"CRITICAL"},
    {id:"sibilancias",  label:"Sibilancias/silbidos",  peso:2, flag:null},
  ]},
  { id:"garganta", label:"Garganta y boca", symptoms:[
    {id:"garg_leve",    label:"Dolor de garganta leve",peso:1, flag:null},
    {id:"garg_intensa", label:"Dolor de garganta intenso",peso:2,flag:null},
    {id:"ronquera",     label:"Ronquera",              peso:1, flag:null},
    {id:"dif_tragar",   label:"Dificultad para tragar",peso:2, flag:null},
    {id:"aftas",        label:"Aftas / llagas",        peso:1, flag:null},
  ]},
  { id:"digest", label:"Digestivo", symptoms:[
    {id:"nauseas",      label:"Náuseas",               peso:1, flag:null},
    {id:"vomito",       label:"Vómito aislado",        peso:2, flag:null},
    {id:"vomito_rep",   label:"Vómito repetido (3+)",  peso:3, flag:null},
    {id:"diarrea",      label:"Diarrea",               peso:2, flag:null},
    {id:"diarrea_sangre",label:"Diarrea con sangre",   peso:3, flag:null},
    {id:"dolor_abd_leve",label:"Dolor abdominal leve", peso:1, flag:null},
    {id:"dolor_abd_intenso",label:"Dolor abdominal intenso",peso:3,flag:null},
    {id:"inapetencia",  label:"Inapetencia",           peso:1, flag:null},
  ]},
  { id:"oido_ojos", label:"Oído y ojos", symptoms:[
    {id:"dolor_oido",   label:"Dolor de oído",         peso:2, flag:null},
    {id:"sec_oido",     label:"Secreción de oído",     peso:2, flag:null},
    {id:"ojo_rojo",     label:"Ojo rojo",              peso:1, flag:null},
    {id:"conjuntivitis",label:"Conjuntivitis",         peso:2, flag:null},
  ]},
  { id:"piel", label:"Piel", symptoms:[
    {id:"erupcion",     label:"Erupción",              peso:1, flag:null},
    {id:"erupcion_fiebre",label:"Erupción + fiebre",  peso:0, flag:"WARNING"},
    {id:"urticaria",    label:"Urticaria",             peso:1, flag:null},
    {id:"manchas",      label:"Manchas",               peso:1, flag:null},
    {id:"palidez",      label:"Palidez marcada",       peso:2, flag:null},
  ]},
  { id:"general", label:"General", symptoms:[
    {id:"cansancio",    label:"Cansancio",             peso:1, flag:null},
    {id:"irritabilidad",label:"Irritabilidad marcada", peso:1, flag:null},
    {id:"decaimiento",  label:"Decaimiento general",   peso:2, flag:null},
    {id:"sangrado_anormal",label:"Sangrado anormal",   peso:0, flag:"WARNING"},
  ]},
  { id:"dolor", label:"Dolor", symptoms:[
    {id:"dolor_muscular",label:"Dolor muscular",       peso:1, flag:null},
    {id:"dolor_articular",label:"Dolor articular",     peso:2, flag:null},
    {id:"dolor_espalda",label:"Dolor de espalda",      peso:1, flag:null},
    {id:"dolor_cabeza", label:"Dolor de cabeza",       peso:2, flag:null},
    {id:"dolor_orinar", label:"Dolor al orinar",       peso:2, flag:null},
  ]},
  { id:"neuro_grave", label:"Neurológico grave", symptoms:[
    {id:"convulsion",   label:"Convulsión",            peso:0, flag:"CRITICAL"},
    {id:"rigidez_nuca", label:"Rigidez de nuca",       peso:0, flag:"CRITICAL"},
    {id:"perdida_conc", label:"Pérdida de consciencia",peso:0, flag:"CRITICAL"},
    {id:"dif_despertar",label:"Dificultad para despertar",peso:0,flag:"CRITICAL"},
  ]},
];

const ALL_SYMPTOMS = SYMPTOM_ZONES.flatMap(z=>z.symptoms);
export function symptomLabel(id){ const s = ALL_SYMPTOMS.find(x=>x.id===id); return s?s.label:id; }
export const FEVER_IDS = ["temp_sub38","temp_38_39","temp_39_40","temp_sobre40"];

// ── Fechas (locales, nunca UTC: toISOString desfasa el día pasadas las 20-21 h en Chile) ──
export function localDateKey(d){
  d = d||new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
export function localTimeKey(d){
  d = d||new Date();
  return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}
function parseKey(dk){ const [y,m,d]=dk.split("-").map(Number); return new Date(y,m-1,d,12,0,0); }
export function addDaysKey(dk,n){ const d=parseKey(dk); d.setDate(d.getDate()+n); return localDateKey(d); }
export function addMonthsKey(dk,n){
  const [y,m,day]=dk.split("-").map(Number);
  const t = new Date(y,m-1+n,1,12,0,0);
  const last = new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  t.setDate(Math.min(day,last));
  return localDateKey(t);
}
export function daysInclusive(a,b){ return Math.round((parseKey(b)-parseKey(a))/86400000)+1; }
export function calcAge(dob){
  const b=parseKey(dob),t=new Date();
  let a=t.getFullYear()-b.getFullYear();
  if(t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate()))a--;
  return a;
}

// ── Hazard ──
function tempScore(temps){
  const vals=(temps||[]).map(t=>parseFloat(t.v)).filter(v=>!isNaN(v));
  if(!vals.length) return 0;
  const v=Math.max(...vals);
  if(v>=40) return 6;
  if(v>=39) return 3;
  if(v>=38) return 2;
  if(v>=37.5) return 1;
  return 0;
}
// Temperatura medida suma al score salvo que ya se haya marcado un nivel de fiebre
// como síntoma (datos migrados) — así no se cuenta doble.
export function calcHazard(sintomas, temps){
  let score = 0;
  for(const sId of (sintomas||[])){
    const s = ALL_SYMPTOMS.find(x=>x.id===sId);
    if(!s) continue;
    if(s.flag==="CRITICAL") return "CRITICAL";
    if(s.flag==="WARNING"){ score=Math.max(score,6); continue; }
    score += s.peso;
  }
  if(!(sintomas||[]).some(id=>FEVER_IDS.includes(id))) score += tempScore(temps);
  if(score<=0) return "CLEAR";
  if(score<=2) return "WATCH";
  if(score<=5) return "ADVISORY";
  return "WARNING";
}

// ── Estado ──
export function emptyKidsHealth(){ return {schemaVersion:SCHEMA_VERSION, family:[], profiles:{}, events:[]}; }

function sortKey(ev){ return (ev.start||"")+" "+(ev.startTime||"00:00"); }
const byStartAsc = (a,b)=>sortKey(a).localeCompare(sortKey(b));
const byStartDesc = (a,b)=>sortKey(b).localeCompare(sortKey(a));

export function activeIllness(events, personId){
  return (events||[]).filter(e=>e.type==="enfermedad"&&e.personId===personId&&!e.end).sort(byStartDesc)[0]||null;
}
export function childrenOf(events, parentId){
  return (events||[]).filter(e=>e.parentId===parentId&&e.type!=="enfermedad").sort(byStartAsc);
}
// El nivel del episodio es el del último registro de síntomas (por fecha y hora).
function recomputeIllness(events, illId){
  const logs = events.filter(e=>e.parentId===illId&&e.type==="sintoma").sort(byStartAsc);
  if(!logs.length) return events;
  const last = logs[logs.length-1];
  return events.map(e=>e.id===illId?{...e,hazardLevel:last.hazardLevel||"CLEAR"}:e);
}

export function upsertEvent(kh, ev){
  const events = kh.events||[];
  const exists = events.some(e=>e.id===ev.id);
  let next = exists ? events.map(e=>e.id===ev.id?ev:e) : [...events, ev];
  if(ev.type==="sintoma"&&ev.parentId) next = recomputeIllness(next, ev.parentId);
  return {...kh, events:next};
}

export function deleteEvent(kh, id){
  const events = kh.events||[];
  const ev = events.find(e=>e.id===id);
  if(!ev) return kh;
  let next = events.filter(e=>e.id!==id&&e.parentId!==id);
  if(ev.parentId&&ev.type==="sintoma") next = recomputeIllness(next, ev.parentId);
  return {...kh, events:next};
}

export function closeIllness(kh, id, endDate){
  return {...kh, events:(kh.events||[]).map(e=>e.id===id?{...e,end:endDate}:e)};
}

// Registro de síntomas: si la persona no tiene episodio activo, abre uno (mismo
// comportamiento que el registro anterior). Devuelve además si hay que marcar
// "doctor" en el calendario (episodio nuevo que nace en WARNING/CRITICAL).
export function addSymptomEntry(kh, form, ids){
  const events = kh.events||[];
  const temps = (form.temps||[]).filter(t=>!isNaN(parseFloat(t.v))).map(t=>({t:t.t||null,v:parseFloat(t.v)}));
  const hazard = calcHazard(form.sintomas, temps);
  let ill = activeIllness(events, form.personId);
  let created = false;
  let next = [...events];
  if(!ill){
    ill = {id:ids.illness, personId:form.personId, type:"enfermedad", start:form.date, end:null,
           title:"", hazardLevel:hazard, missedDays:0};
    next = [...next, ill];
    created = true;
  } else if(form.date<ill.start){
    // registro retroactivo: el episodio activo empieza antes (no se abre un segundo episodio)
    next = next.map(e=>e.id===ill.id?{...e,start:form.date}:e);
    ill = {...ill, start:form.date};
  }
  const log = {id:ids.entry, personId:form.personId, type:"sintoma", parentId:ill.id, start:form.date,
               startTime:form.time||null, sintomas:form.sintomas||[], temps, hazardLevel:hazard, note:form.note||""};
  next = [...next, log];
  next = recomputeIllness(next, ill.id);
  return {kh:{...kh, events:next}, illnessId:ill.id,
          doctorMarkDate: created&&(hazard==="WARNING"||hazard==="CRITICAL") ? form.date : null};
}

// ── Citas ↔ planner ──
const norm = m => Array.isArray(m)?m:(m?[m]:[]);
export function citaDates(ev, count){
  const n = ev.repeatMonths ? (count||4) : 1;
  const out = [];
  for(let i=0;i<n;i++) out.push(i===0?ev.start:addMonthsKey(ev.start,(ev.repeatMonths||0)*i));
  return out;
}
function citaTasks(ev, personName){
  const [h,m] = (ev.startTime||"09:00").split(":").map(Number);
  const text = `${ev.title||"cita"} ${personName||""} — ${ev.medico||""}`.replace(/\s+/g," ").replace(/ — $/,"").trim();
  const out = [];
  citaDates(ev).forEach((dk,i)=>{
    out.push({dk, task:{id:`${ev.id}_${i}`, text, fixed:true, done:false, deadline:{h,m}, healthEventId:ev.id}});
    out.push({dk:addDaysKey(dk,-1), task:{id:`${ev.id}_${i}p`, text:`preparar: ${text}`, fixed:false, done:false, deadline:{h:21,m:30}, healthEventId:ev.id}});
  });
  return out;
}
// Sincroniza una cita con el planner. prevEv = versión anterior (o null si es nueva),
// nextEv = versión nueva (o null si se elimina). `events` = el resto de los eventos
// (sin esta cita), para no quitar un marcador "doctor" que otra cita sigue usando.
// Devuelve {ev, dayPatches:{dk:tasks[]}, marks}; marks=null si no cambian.
export function planCita({events, dayData, marks, prevEv, nextEv, personName}){
  const patches = {};
  const tasksOf = dk => patches[dk] || ((dayData&&dayData[dk]&&dayData[dk].tasks)||[]);
  // 1) quitar tareas ligadas a la versión anterior
  if(prevEv){
    Object.keys(dayData||{}).forEach(dk=>{
      const t = (dayData[dk].tasks||[]);
      if(t.some(x=>x.healthEventId===prevEv.id)) patches[dk] = t.filter(x=>x.healthEventId!==prevEv.id);
    });
  }
  // 2) agregar las nuevas
  let marksNext = {...(marks||{})};
  let marksChanged = false;
  let markedDates = [];
  if(nextEv){
    citaTasks(nextEv, personName).forEach(({dk,task})=>{ patches[dk] = [...tasksOf(dk), task]; });
    citaDates(nextEv).forEach(dk=>{
      const cur = norm(marksNext[dk]);
      if(!cur.includes("doctor")){ marksNext[dk]=[...cur,"doctor"]; marksChanged=true; markedDates.push(dk); }
      else if((prevEv&&prevEv.markedDates||[]).includes(dk)) markedDates.push(dk);
    });
  }
  // 3) soltar marcadores que esta cita puso y nadie más usa
  if(prevEv){
    const keep = new Set(markedDates);
    (prevEv.markedDates||[]).forEach(dk=>{
      if(keep.has(dk)) return;
      const usedByOther = (events||[]).some(e=>e.type==="cita"&&e.id!==prevEv.id&&citaDates(e).includes(dk));
      if(usedByOther) return;
      const cur = norm(marksNext[dk]).filter(x=>x!=="doctor");
      if(cur.length) marksNext[dk]=cur; else delete marksNext[dk];
      marksChanged = true;
    });
  }
  return {ev: nextEv?{...nextEv, markedDates}:null, dayPatches:patches, marks:marksChanged?marksNext:null};
}

// ── Migración schema v1 → v2 (explícita y no destructiva) ──
// v1 guardaba kidsHealth.episodes[] (con days[]), dailyLog{} y profiles[p].citasRegulares[].
// Se convierten a eventos; lo original queda intacto en `legacy` (respaldo, ya no se lee).
// Las citas viejas no tenían fecha: se toma como base su fecha de creación (id = Date.now())
// y se avanza por su frecuencia hasta la primera ocurrencia >= hoy. Sus tareas ya
// proyectadas en el planner no estaban ligadas a nada, así que quedan como están
// (no se duplican ni se pueden borrar desde Salud).
export function migrateKidsHealth(kh, today){
  if(kh && kh.schemaVersion>=SCHEMA_VERSION) return kh;
  kh = kh||{};
  today = today||localDateKey();
  const events = [];
  (kh.episodes||[]).forEach(ep=>{
    if(!ep||!ep.id||!ep.startDate) return;
    const illId = "ep_"+ep.id;
    events.push({id:illId, personId:ep.kidId, type:"enfermedad", start:ep.startDate, end:ep.endDate||null,
                 title:"", hazardLevel:ep.hazardLevel||"CLEAR", missedDays:ep.missedDays||0, note:ep.notas||""});
    const days = ep.days||[];
    days.forEach(d=>{
      const v = parseFloat(d.temperatura);
      events.push({id:`sx_${ep.id}_${d.date}`, personId:ep.kidId, type:"sintoma", parentId:illId, start:d.date,
                   startTime:null, sintomas:d.sintomas||[], temps:isNaN(v)?[]:[{t:null,v}],
                   hazardLevel:d.hazardLevel||calcHazard(d.sintomas), note:d.nota||""});
    });
    if(!days.length&&(ep.lastSintomas||[]).length){
      events.push({id:`sx_${ep.id}_${ep.startDate}`, personId:ep.kidId, type:"sintoma", parentId:illId, start:ep.startDate,
                   startTime:null, sintomas:ep.lastSintomas, temps:[], hazardLevel:ep.hazardLevel||calcHazard(ep.lastSintomas), note:""});
    }
  });
  const profiles = {};
  const legacyCitas = {};
  Object.entries(kh.profiles||{}).forEach(([pid,p])=>{
    const {citasRegulares, ...rest} = p||{};
    profiles[pid] = rest;
    if((citasRegulares||[]).length){
      legacyCitas[pid] = citasRegulares;
      citasRegulares.forEach((c,i)=>{
        const freq = c.frecMeses||6;
        const created = new Date(parseInt(c.id,10)||Date.now());
        let dk = localDateKey(created);
        let guard = 0;
        while(dk<today && guard++<400) dk = addMonthsKey(dk, freq);
        events.push({id:`ct_${pid}_${c.id||i}`, personId:pid, type:"cita", title:c.tipo||"cita", medico:c.medico||"",
                     start:dk, startTime:c.hora||"09:00", repeatMonths:freq, markedDates:[], legacy:true});
      });
    }
  });
  const hadLegacy = (kh.episodes||[]).length||Object.keys(kh.dailyLog||{}).length||Object.keys(legacyCitas).length;
  const out = {schemaVersion:SCHEMA_VERSION, family:kh.family||[], profiles, events};
  if(hadLegacy) out.legacy = {episodes:kh.episodes||[], dailyLog:kh.dailyLog||{}, citasRegulares:legacyCitas, migratedAt:today};
  return out;
}

// ── Línea de tiempo ──
// upcoming: citas con fecha >= hoy (ascendente). items: episodios (con hijos) y eventos
// sueltos, del más reciente al más antiguo.
export function buildTimeline(events, {personId, today}){
  const evs = (events||[]).filter(e=>!personId||e.personId===personId);
  const ids = new Set(evs.filter(e=>e.type==="enfermedad").map(e=>e.id));
  const upcoming = evs.filter(e=>e.type==="cita"&&e.start>=today).sort(byStartAsc);
  const items = [];
  evs.forEach(e=>{
    if(e.type==="enfermedad") items.push({kind:"illness", ev:e, children:childrenOf(evs,e.id)});
    else if(e.parentId&&ids.has(e.parentId)) return;
    else if(e.type==="cita"&&e.start>=today) return;
    else items.push({kind:"event", ev:e});
  });
  items.sort((a,b)=>byStartDesc(a.ev,b.ev));
  return {upcoming, items};
}

export function illnessLabel(kh, ill){
  if(ill.title) return ill.title;
  const logs = childrenOf(kh.events||[], ill.id).filter(e=>e.type==="sintoma");
  const ids = [...new Set(logs.flatMap(l=>l.sintomas||[]))].filter(id=>!FEVER_IDS.includes(id));
  if(ids.length) return ids.slice(0,2).map(symptomLabel).join(", ");
  return "enfermedad";
}

// Línea corta de un evento (búsqueda global, listados)
export function eventLine(ev){
  const bits = {enfermedad:"enfermedad", sintoma:"síntomas", medicamento:"medicamento", tratamiento:"tratamiento", cita:"cita"};
  return `${bits[ev.type]||ev.type}${ev.title?" "+ev.title:""} · ${ev.start||""}`;
}
export function eventMatches(ev, q){
  const hay = [ev.title, ev.note, ev.medico, ev.dosis, ev.freq, ev.hazardLevel,
               ...(ev.sintomas||[]).map(symptomLabel), ...(ev.temps||[]).map(t=>String(t.v))];
  return hay.some(x=>x&&String(x).toLowerCase().includes(q));
}

// ── Resumen para compartir (texto plano, por persona y rango) ──
const shortDate = dk => dk.slice(8)+"/"+dk.slice(5,7);
export function buildSummary({person, profile, events, from, to, today}){
  profile = profile||{};
  const L = [];
  const evs = (events||[]).filter(e=>e.personId===person.id);
  const edad = person.dob?` (${calcAge(person.dob)} años)`:"";
  L.push(`Resumen de salud — ${person.name}${edad}`);
  L.push(`Período: ${from} a ${to}`);
  const list = (k,t)=>{ if((profile[k]||[]).length) L.push(`${t}: ${profile[k].join(", ")}`); };
  list("alergias","Alergias"); list("condicionesCronicas","Condiciones crónicas"); list("medicacionHabitual","Medicación habitual");
  const gl = (profile.growthLog||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(gl.length){ const g=gl[gl.length-1]; L.push(`Última medición (${g.date}): ${[g.peso?g.peso+" kg":null,g.talla?g.talla+" cm":null].filter(Boolean).join(" · ")}`); }

  const ills = evs.filter(e=>e.type==="enfermedad"&&e.start<=to&&(e.end||today)>=from).sort(byStartAsc);
  if(ills.length) L.push("", "EPISODIOS");
  ills.forEach(ill=>{
    const logs = childrenOf(evs, ill.id);
    const sx = logs.filter(l=>l.type==="sintoma");
    const dur = daysInclusive(ill.start, ill.end||today);
    L.push(`• ${ill.start} → ${ill.end||"en curso"} (${dur} ${dur===1?"día":"días"}${ill.end?"":", aún activo"})${ill.title?" — "+ill.title:""}`);
    const readings = sx.flatMap(l=>(l.temps||[]).map(t=>({v:t.v, dk:l.start, t:t.t||l.startTime})));
    if(readings.length){
      const max = readings.reduce((a,b)=>b.v>a.v?b:a);
      const feverDays = new Set(readings.filter(r=>r.v>=38).map(r=>r.dk)).size;
      L.push(`  Temperatura máxima: ${max.v} °C (${max.dk}${max.t?" "+max.t:""}); días con ≥38 °C: ${feverDays}`);
    }
    const all = [...new Set(sx.flatMap(l=>l.sintomas||[]))].filter(id=>!FEVER_IDS.includes(id)).map(symptomLabel);
    if(all.length) L.push(`  Síntomas: ${all.join(", ")}`);
    if(sx.length){
      L.push("  Evolución:");
      sx.forEach(l=>{
        const parts = [];
        const sl = (l.sintomas||[]).filter(id=>!FEVER_IDS.includes(id)).map(symptomLabel);
        if(sl.length) parts.push(sl.join(", "));
        if((l.temps||[]).length) parts.push(l.temps.map(t=>t.v+" °C"+(t.t?" ("+t.t+")":"")).join(", "));
        if(l.note) parts.push(l.note);
        L.push(`  - ${shortDate(l.start)}${l.startTime?" "+l.startTime:""}: ${parts.join(" · ")||"sin detalle"}`);
      });
    }
    const meds = logs.filter(l=>l.type==="medicamento"||l.type==="tratamiento");
    if(meds.length){
      L.push("  Medicación y tratamientos:");
      meds.forEach(m=>L.push(`  - ${m.title}${m.dosis?" "+m.dosis:""}${m.freq?" ("+m.freq+")":""}: ${shortDate(m.start)}${m.startTime?" "+m.startTime:""}${m.end?" → "+shortDate(m.end):""}${m.note?" · "+m.note:""}`));
    }
    if(ill.missedDays) L.push(`  Días sin colegio: ${ill.missedDays}`);
    if(ill.note) L.push(`  Nota: ${ill.note}`);
  });

  const ids = new Set(ills.map(i=>i.id));
  const loose = evs.filter(e=>e.type!=="enfermedad"&&e.type!=="sintoma"&&!(e.parentId&&ids.has(e.parentId))&&e.start>=from&&e.start<=to).sort(byStartAsc);
  const meds = loose.filter(e=>e.type==="medicamento"||e.type==="tratamiento");
  const citas = loose.filter(e=>e.type==="cita");
  if(meds.length){ L.push("", "MEDICACIÓN Y TRATAMIENTOS (fuera de episodios)");
    meds.forEach(m=>L.push(`- ${m.title}${m.dosis?" "+m.dosis:""}${m.freq?" ("+m.freq+")":""}: ${m.start}${m.end?" → "+m.end:""}${m.note?" · "+m.note:""}`)); }
  if(citas.length){ L.push("", "CITAS");
    citas.forEach(c=>L.push(`- ${c.start}${c.startTime?" "+c.startTime:""} · ${c.title}${c.medico?" — "+c.medico:""}`)); }
  if(!ills.length&&!loose.length) L.push("", "Sin registros en el período.");
  return L.join("\n");
}
