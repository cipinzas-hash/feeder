// Acciones de Salud compartidas por la pestaña (SaludPage) y por la ventana de
// ➕ Registrar / pincel "Doctor" (SaludRegistro). Sin React: recibe los datos y los
// callbacks de persistencia y devuelve funciones.
import { calcHazard, activeIllness, addSymptomEntry, upsertEvent, deleteEvent, planCita } from "./saludModel.js";

const nid = p => p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const nameOf = (family,id) => (family.find(f=>f.id===id)||{}).name||id;

export function makeSaludActions({kh, persist, dayData, updateDay, calMarks, saveCalMarks, isMedicalTask}){
  const family = kh.family||[];
  const events = kh.events||[];

  function applyPlan(plan){
    if(updateDay) Object.entries(plan.dayPatches).forEach(([dk,tasks])=>updateDay(dk,{tasks}));
    if(plan.marks&&saveCalMarks) saveCalMarks(plan.marks);
  }

  // Devuelve {suggest}: si un episodio nuevo nace en WARNING/CRITICAL, sugiere agendar cita.
  function save({type,personId,f,editing}){
    let suggest = null;
    if(type==="sintoma"){
      if(editing){
        const temps = f.temps.filter(t=>!isNaN(parseFloat(t.v))).map(t=>({t:t.t||null,v:parseFloat(t.v)}));
        persist(upsertEvent(kh,{...editing,start:f.date,startTime:f.time||null,sintomas:f.sintomas,temps,hazardLevel:calcHazard(f.sintomas,temps),note:f.note}));
      } else {
        const r = addSymptomEntry(kh,{personId,date:f.date,time:f.time,sintomas:f.sintomas,temps:f.temps,note:f.note},{illness:nid("ep_"),entry:nid("sx_")});
        persist(r.kh);
        if(r.doctorMarkDate) suggest = {personId, date:r.doctorMarkDate};
      }
    } else if(type==="medicamento"||type==="tratamiento"){
      const ill = editing?null:activeIllness(events,personId);
      const parentId = editing?editing.parentId:(ill&&f.start>=ill.start?ill.id:undefined);
      persist(upsertEvent(kh,{...(editing||{}),id:editing?editing.id:nid(type==="medicamento"?"md_":"tr_"),personId,type,parentId,
        title:f.title.trim(),dosis:f.dosis.trim(),freq:f.freq.trim(),start:f.start,startTime:f.startTime||null,end:f.end||null,note:f.note.trim()}));
    } else if(type==="diagnostico"){
      const ill = editing?null:activeIllness(events,personId);
      const parentId = editing?editing.parentId:(ill&&f.start>=ill.start?ill.id:undefined);
      persist(upsertEvent(kh,{...(editing||{}),id:editing?editing.id:nid("dx_"),personId,type:"diagnostico",parentId,
        title:f.title.trim(),medico:f.medico.trim(),start:f.start,note:f.note.trim()}));
    } else if(type==="cita"){
      const ev = {id:editing?editing.id:nid("ct_"),personId,type:"cita",title:f.title.trim(),medico:f.medico.trim(),
        start:f.start,startTime:f.startTime,repeatMonths:f.repeatMonths||null,markedDates:(editing&&editing.markedDates)||[]};
      const plan = planCita({events:events.filter(e=>e.id!==ev.id),dayData,marks:calMarks,prevEv:editing,nextEv:ev,personName:nameOf(family,personId),isMedicalTask});
      persist(upsertEvent(kh,plan.ev));
      applyPlan(plan);
    } else if(type==="enfermedad"){
      persist(upsertEvent(kh,{...editing,title:f.title.trim(),start:f.start,end:f.end||null,note:f.note.trim()}));
    }
    return {suggest};
  }

  function remove(ev){
    if(ev.type==="cita"){
      const plan = planCita({events:events.filter(e=>e.id!==ev.id),dayData,marks:calMarks,prevEv:ev,nextEv:null,personName:nameOf(family,ev.personId),isMedicalTask});
      persist(deleteEvent(kh,ev.id));
      applyPlan(plan);
    } else persist(deleteEvent(kh,ev.id));
  }

  return {save, remove};
}
