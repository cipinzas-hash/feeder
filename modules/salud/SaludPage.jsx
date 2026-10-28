// Salud — línea de tiempo familiar/individual de eventos de salud (schema v2).
// Pantalla colapsada según el lineamiento (docs/angst-lineamiento-y-handoff.md §4): sin título
// propio, sin scroll colapsada, expansión exclusiva inline, formularios y fichas como emergentes.
// Datos y reglas en saludModel.js; curva de crecimiento en GrowthView.jsx.
// El roster (nombres/fechas de nacimiento) vive en kidsHealth.family, editable
// desde la UI (onboarding) — nunca en el repo.
import GrowthView from "./GrowthView.jsx";
import { esTareaMedica } from "../../core/stress.js";
import {
  SYMPTOM_ZONES, FEVER_IDS, symptomLabel, calcHazard, calcAge, localDateKey, localTimeKey, addDaysKey, daysInclusive,
  migrateKidsHealth, activeIllness, upsertEvent, deleteEvent, closeIllness,
  addPerson, updatePerson, removePerson, personEventCount,
  buildSections, illnessLabel, buildSummary, citaLine,
} from "./saludModel.js";
import { makeSaludActions } from "./saludActions.js";

const F_HAND = "'Caveat',cursive";
const F_SANS = "'DM Sans',sans-serif";
const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DOW_ES = ["dom","lun","mar","mié","jue","vie","sáb"];
const HAZARD_CONFIG = {
  CLEAR:    {color:"#2a2a2a", bg:"#1a1a1a", text:"#fff",    label:"Clear",    emoji:"🟢", pulse:false},
  WATCH:    {color:"#b8860b", bg:"#2a2200", text:"#ffd700", label:"Watch",    emoji:"🟡", pulse:false},
  ADVISORY: {color:"#c05000", bg:"#2a1400", text:"#ff8c00", label:"Advisory", emoji:"🟠", pulse:false},
  WARNING:  {color:"#c0392b", bg:"#2a0800", text:"#ff4444", label:"Warning",  emoji:"🔴", pulse:true},
  CRITICAL: {color:"#7b0000", bg:"#1a0000", text:"#ff0000", label:"Critical", emoji:"⚫", pulse:true},
};
const TYPE_META = {
  enfermedad:{icon:"🤒",label:"Enfermedad"}, sintoma:{icon:"🩺",label:"Síntomas / fiebre"},
  diagnostico:{icon:"🩻",label:"Diagnóstico"},
  medicamento:{icon:"💊",label:"Medicamento"}, tratamiento:{icon:"🧴",label:"Tratamiento"}, cita:{icon:"🗓️",label:"Cita médica"},
};
const ADD_TYPES = ["sintoma","diagnostico","medicamento","tratamiento","cita"];
const REPEAT_OPTS = [{v:0,l:"no repite"},{v:1,l:"mensual"},{v:3,l:"c/3 meses"},{v:6,l:"semestral"},{v:12,l:"anual"},{v:24,l:"c/2 años"}];
const PAGE = {padding:"16px",maxWidth:480,margin:"0 auto"};
const INP = {border:"1px dashed #ddd",borderRadius:8,padding:"8px 10px",fontSize:14,fontFamily:F_SANS,outline:"none",background:"#fafafa",color:"#111",width:"100%",boxSizing:"border-box"};
const INP_DARK = {background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,padding:"10px 12px",fontFamily:F_SANS,fontSize:14,color:"#fff",outline:"none",width:"100%",boxSizing:"border-box",colorScheme:"dark"};
const LABEL_DARK = {fontFamily:F_SANS,fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,textTransform:"uppercase",marginBottom:6};
const nid = p => p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function fmtDay(dk){ const d=new Date(dk+"T12:00:00"); return `${DOW_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`; }
function nameOf(family,id){ return (family.find(f=>f.id===id)||{}).name||id; }
function iconOf(family,id){ return (family.find(f=>f.id===id)||{}).icon||"🙂"; }
function symptomsText(ids, n){
  const l = (ids||[]).filter(id=>!FEVER_IDS.includes(id)).map(symptomLabel);
  return l.length>n ? l.slice(0,n).join(", ")+` +${l.length-n}` : l.join(", ");
}
function maxTemp(temps){ const v=(temps||[]).map(t=>parseFloat(t.v)).filter(x=>!isNaN(x)); return v.length?Math.max(...v):null; }

// ── Barra de duración (medicamento/tratamiento con inicio y fin) ──
function SpanBar({start,end,spanStart,spanEnd,dark}){
  const total = Math.max(1,daysInclusive(spanStart,spanEnd));
  const left = Math.max(0,Math.min(100,(daysInclusive(spanStart,start)-1)/total*100));
  const width = Math.max(4,Math.min(100-left,daysInclusive(start,end)/total*100));
  return (
    <div style={{height:4,borderRadius:2,background:dark?"rgba(255,255,255,0.08)":"#eee",position:"relative",marginTop:4}}>
      <div style={{position:"absolute",left:left+"%",width:width+"%",top:0,bottom:0,borderRadius:2,background:"#4a90d9"}}/>
    </div>
  );
}

// ── Fila de un hijo dentro de un episodio ──
function ChildRow({ev,ill,today,onOpen}){
  const meta = TYPE_META[ev.type]||{icon:"•"};
  let text = "";
  if(ev.type==="sintoma"){
    const parts=[]; const s=symptomsText(ev.sintomas,3); if(s)parts.push(s);
    const mt=maxTemp(ev.temps); if(mt!==null)parts.push(mt+" °C");
    if(ev.note)parts.push(ev.note);
    text = parts.join(" · ")||"registro";
  } else if(ev.type==="diagnostico"){
    text = `${ev.title}${ev.medico?" — "+ev.medico:""}`;
  } else {
    text = `${ev.title}${ev.dosis?" · "+ev.dosis:""}${ev.freq?" · "+ev.freq:""}`;
  }
  const hot = ev.type==="sintoma"&&maxTemp(ev.temps)>=38;
  const spanEnd = ill.end||(ev.end&&ev.end>today?ev.end:today);
  return (
    <div onClick={()=>onOpen(ev)} style={{padding:"6px 0",borderTop:"1px solid rgba(255,255,255,0.05)",cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontFamily:F_SANS,fontSize:10,color:"rgba(255,255,255,0.35)",minWidth:58}}>{ev.start.slice(5)}{ev.startTime?" "+ev.startTime:""}</span>
        <span style={{fontSize:11}}>{meta.icon}</span>
        <span style={{fontFamily:F_SANS,fontSize:11,color:hot?"#ff6b6b":"rgba(255,255,255,0.65)",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{text}</span>
      </div>
      {ev.end&&<SpanBar start={ev.start} end={ev.end} spanStart={ill.start} spanEnd={spanEnd} dark/>}
    </div>
  );
}

// ── Tarjeta de episodio ──
function IllnessCard({kh,family,item,today,showPerson,onOpen,onClose,onDelete,onMissed}){
  const [all,setAll] = React.useState(false);
  const ill = item.ev;
  const cfg = HAZARD_CONFIG[ill.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR;
  const dur = daysInclusive(ill.start, ill.end||today);
  const kids = [...item.children].reverse();
  const shown = all?kids:kids.slice(0,5);
  return (
    <div style={{background:"#1a1a1a",borderRadius:12,padding:"14px 16px",marginBottom:12,border:`1px solid ${cfg.color}55`}}>
      <div onClick={()=>onOpen(ill)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer"}}>
        <span style={{fontSize:16}}>{cfg.emoji}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:F_HAND,fontSize:17,fontWeight:700,color:cfg.text,lineHeight:1.1}}>
            {showPerson&&<span style={{marginRight:6}}>{iconOf(family,ill.personId)} {nameOf(family,ill.personId)} ·</span>}
            {illnessLabel(kh,ill)}
          </div>
          <div style={{fontFamily:F_SANS,fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>
            {ill.start}{ill.end?` → ${ill.end} · ${dur}d`:` · activo · día ${dur}`}
          </div>
        </div>
        {!ill.end&&<button onClick={e=>{e.stopPropagation();onClose(ill.id);}} style={{fontFamily:F_SANS,fontSize:10,background:"#e53935",border:"none",borderRadius:6,padding:"4px 10px",color:"#fff",cursor:"pointer"}}>cerrar</button>}
      </div>
      {ill.personId!=="cristopher"&&(
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"6px 0"}}>
          <span style={{fontFamily:F_SANS,fontSize:10,color:"rgba(255,255,255,0.35)"}}>días sin colegio</span>
          <button onClick={()=>onMissed(ill.id,-1)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:5,width:24,height:24,color:"#fff",cursor:"pointer",fontSize:13}}>−</button>
          <span style={{fontFamily:F_HAND,fontSize:18,fontWeight:700,color:"#fff",minWidth:20,textAlign:"center"}}>{ill.missedDays||0}</span>
          <button onClick={()=>onMissed(ill.id,1)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:5,width:24,height:24,color:"#fff",cursor:"pointer",fontSize:13}}>+</button>
        </div>
      )}
      {shown.map(ev=><ChildRow key={ev.id} ev={ev} ill={ill} today={today} onOpen={onOpen}/>)}
      {kids.length>5&&<button onClick={()=>setAll(a=>!a)} style={{marginTop:6,background:"transparent",border:"none",fontFamily:F_SANS,fontSize:10,color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:0}}>{all?"ver menos":`ver todo (${kids.length})`}</button>}
      {kids.length===0&&<div style={{fontFamily:F_SANS,fontSize:10,color:"rgba(255,255,255,0.3)"}}>sin registros</div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
        <button onClick={()=>{if(window.confirm("¿Eliminar este episodio y todos sus registros?"))onDelete(ill);}}
          style={{background:"transparent",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:6,padding:"4px 10px",fontFamily:F_SANS,fontSize:10,color:"rgba(255,255,255,0.3)",cursor:"pointer"}}>eliminar</button>
      </div>
    </div>
  );
}

// ── Evento suelto (medicamento/tratamiento sin episodio, cita pasada) ──
function LooseRow({ev,family,showPerson,onOpen}){
  const meta = TYPE_META[ev.type]||{icon:"•",label:ev.type};
  return (
    <div onClick={()=>onOpen(ev)} style={{border:"1px dashed #e0e0e0",borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>{meta.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:F_SANS,fontSize:13,fontWeight:600,color:"#222"}}>
            {showPerson&&<span style={{fontWeight:400,color:"#888"}}>{nameOf(family,ev.personId)} · </span>}
            {ev.title||meta.label}{ev.dosis?` · ${ev.dosis}`:""}
          </div>
          <div style={{fontFamily:F_SANS,fontSize:10,color:"#aaa",marginTop:2}}>
            {ev.start}{ev.startTime?" "+ev.startTime:""}{ev.end?` → ${ev.end}`:""}{ev.medico?` · ${ev.medico}`:""}{ev.freq?` · ${ev.freq}`:""}
          </div>
        </div>
      </div>
      {ev.end&&<SpanBar start={ev.start} end={ev.end} spanStart={ev.start} spanEnd={ev.end}/>}
    </div>
  );
}

function UpcomingRow({ev,dk,family,showPerson,onOpen}){
  return (
    <div onClick={()=>onOpen(ev)} style={{background:"#f4f8ec",border:"1px solid #dfe9c6",borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
      <div style={{textAlign:"center",minWidth:48}}>
        <div style={{fontFamily:F_HAND,fontSize:17,fontWeight:700,color:"#111",lineHeight:1}}>{fmtDay(dk||ev.start)}</div>
        <div style={{fontFamily:F_SANS,fontSize:10,color:"#789"}}>{ev.startTime||""}</div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:F_SANS,fontSize:13,fontWeight:600,color:"#222"}}>{ev.title}</div>
        <div style={{fontFamily:F_SANS,fontSize:10,color:"#888"}}>{showPerson?nameOf(family,ev.personId):""}{ev.medico?`${showPerson?" · ":""}${ev.medico}`:""}{ev.repeatMonths?` · cada ${ev.repeatMonths} m`:""}</div>
      </div>
      <span style={{color:"#999",fontSize:13}}>›</span>
    </div>
  );
}

// ── Formulario de agregar / editar (hoja inferior) ──
function initForm(init, today){
  const now = localTimeKey();
  const ev = init.ev;
  const day = init.date||today;
  const base = {date:today,time:now,sintomas:[],temps:[{t:now,v:""}],note:"",title:"",dosis:"",freq:"",start:day,startTime:(init.type==="cita"?"09:00":now),end:"",medico:"",repeatMonths:0,missedDays:0};
  if(!ev) return base;
  if(ev.type==="diagnostico") return {...base,title:ev.title||"",medico:ev.medico||"",start:ev.start,note:ev.note||""};
  if(ev.type==="sintoma") return {...base,date:ev.start,time:ev.startTime||"",sintomas:ev.sintomas||[],temps:(ev.temps||[]).map(t=>({t:t.t||"",v:String(t.v)})),note:ev.note||""};
  if(ev.type==="enfermedad") return {...base,title:ev.title||"",start:ev.start,end:ev.end||"",note:ev.note||"",missedDays:ev.missedDays||0};
  if(ev.type==="cita") return {...base,title:ev.title||"",medico:ev.medico||"",start:ev.start,startTime:ev.startTime||"09:00",repeatMonths:ev.repeatMonths||0};
  return {...base,title:ev.title||"",dosis:ev.dosis||"",freq:ev.freq||"",start:ev.start,startTime:ev.startTime||"",end:ev.end||"",note:ev.note||""};
}

function Field({label,children}){
  return <div style={{marginBottom:14}}><div style={LABEL_DARK}>{label}</div>{children}</div>;
}

function EntrySheet({init,family,kh,today,onSave,onDelete,onClose,types,z}){
  const editing = init.ev||null;
  const [type,setType] = React.useState(editing?editing.type:(init.type||null));
  const [personId,setPersonId] = React.useState(editing?editing.personId:(init.personId||null));
  const [f,setF] = React.useState(()=>initForm(init,today));
  const [openZone,setOpenZone] = React.useState(null);
  const set = (k,v)=>setF(x=>({...x,[k]:v}));
  // una cita nueva parte a las 09:00 (hora usual de control), no a la hora actual
  const chooseType = t => { setType(t); if(t==="cita") set("startTime",(init&&init.type==="cita"&&init.ev)?f.startTime:"09:00"); };
  // si viene tipo y una sola persona posible, no hace falta elegirla
  React.useEffect(()=>{ if(!personId&&family.length===1) setPersonId(family[0].id); },[]);
  const perfil = (kh.profiles||{})[personId]||{};
  const hasTemp = f.temps.some(t=>!isNaN(parseFloat(t.v)));
  const hz = calcHazard(f.sintomas, f.temps.map(t=>({v:t.v})));
  const hcfg = HAZARD_CONFIG[hz];
  let ok = !!personId;
  if(type==="sintoma") ok = ok&&(f.sintomas.length>0||hasTemp||!!f.note.trim());
  else if(type==="medicamento"||type==="tratamiento") ok = ok&&!!f.title.trim()&&!!f.start;
  else if(type==="cita") ok = ok&&!!f.title.trim()&&!!f.start&&!!f.startTime;
  else if(type==="diagnostico") ok = ok&&!!f.title.trim()&&!!f.start;
  else if(type==="enfermedad") ok = ok&&!!f.start;
  const alergia = type==="medicamento"&&f.title.trim()
    ? (perfil.alergias||[]).find(a=>{const x=String(a).toLowerCase(),y=f.title.trim().toLowerCase();return x&&(x.includes(y)||y.includes(x));})
    : null;
  const zones = SYMPTOM_ZONES.map(z=>({...z,symptoms:z.symptoms.filter(s=>!FEVER_IDS.includes(s.id)||f.sintomas.includes(s.id))})).filter(z=>z.symptoms.length);
  const title = editing ? (TYPE_META[editing.type]||{}).label : (type?TYPE_META[type].label:"Agregar");

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:z||500,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#0d0d0d",borderRadius:"16px 16px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          {!editing&&type&&<button onClick={()=>setType(null)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:18,cursor:"pointer",padding:0}}>←</button>}
          <div style={{flex:1,fontFamily:F_HAND,fontSize:20,fontWeight:700,color:"#fff"}}>{title}</div>
          {type==="sintoma"&&<div style={{background:hcfg.bg,border:`1px solid ${hcfg.color}`,borderRadius:8,padding:"4px 10px",fontFamily:F_SANS,fontSize:9,color:hcfg.text,letterSpacing:1,textTransform:"uppercase"}}>{hcfg.emoji} {hcfg.label}</div>}
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
        </div>

        {!type&&(
          <div style={{padding:"16px 20px 32px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {(types||ADD_TYPES).map(t=>(
              <button key={t} onClick={()=>chooseType(t)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"18px 8px",cursor:"pointer",color:"#fff"}}>
                <div style={{fontSize:26}}>{TYPE_META[t].icon}</div>
                <div style={{fontFamily:F_SANS,fontSize:12,marginTop:6}}>{TYPE_META[t].label}</div>
              </button>
            ))}
          </div>
        )}

        {type&&(
          <div style={{overflowY:"auto",flex:1,padding:"14px 20px"}}>
            {!editing&&(
              <Field label="para">
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {family.map(p=>(
                    <button key={p.id} onClick={()=>setPersonId(p.id)}
                      style={{fontFamily:F_SANS,fontSize:12,padding:"6px 12px",borderRadius:16,cursor:"pointer",border:"1px solid "+(personId===p.id?"#aac756":"rgba(255,255,255,0.15)"),background:personId===p.id?"rgba(170,199,86,0.18)":"transparent",color:personId===p.id?"#dfeea8":"rgba(255,255,255,0.6)"}}>
                      {p.icon} {p.name}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {(perfil.alergias||[]).length>0&&(
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
                <span style={{fontFamily:F_SANS,fontSize:9,color:"#e53935",letterSpacing:1}}>ALERGIAS:</span>
                {perfil.alergias.map((a,i)=><span key={i} style={{fontFamily:F_SANS,fontSize:9,color:"rgba(255,100,100,0.85)",background:"rgba(255,100,100,0.1)",borderRadius:5,padding:"1px 6px"}}>{a}</span>)}
              </div>
            )}

            {type==="sintoma"&&(<>
              <Field label="cuándo">
                <div style={{display:"flex",gap:8}}>
                  <input type="date" value={f.date} max={today} onChange={e=>set("date",e.target.value)} style={INP_DARK}/>
                  <input type="time" value={f.time} onChange={e=>set("time",e.target.value)} style={{...INP_DARK,width:120}}/>
                </div>
              </Field>
              <Field label="temperatura">
                {f.temps.map((t,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                    <input type="number" step="0.1" value={t.v} placeholder="ej: 38.5" onChange={e=>set("temps",f.temps.map((x,j)=>j===i?{...x,v:e.target.value}:x))} style={INP_DARK}/>
                    <span style={{fontFamily:F_SANS,fontSize:13,color:"rgba(255,255,255,0.4)"}}>°C</span>
                    <input type="time" value={t.t} onChange={e=>set("temps",f.temps.map((x,j)=>j===i?{...x,t:e.target.value}:x))} style={{...INP_DARK,width:110}}/>
                    {parseFloat(t.v)>=38&&<span>⚠️</span>}
                    <button onClick={()=>set("temps",f.temps.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",fontSize:18,cursor:"pointer"}}>×</button>
                  </div>
                ))}
                <button onClick={()=>set("temps",[...f.temps,{t:localTimeKey(),v:""}])} style={{background:"transparent",border:"1px dashed rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 12px",fontFamily:F_SANS,fontSize:11,color:"rgba(255,255,255,0.5)",cursor:"pointer"}}>+ otra lectura</button>
              </Field>
              <Field label={`síntomas${f.sintomas.length?` · ${f.sintomas.length}`:" (opcional)"}`}>
                {zones.map(z=>{
                  const n = z.symptoms.filter(s=>f.sintomas.includes(s.id)).length;
                  const open = openZone===z.id||n>0;
                  return (
                    <div key={z.id} style={{marginBottom:6}}>
                      <div onClick={()=>setOpenZone(openZone===z.id?null:z.id)} style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.04)",cursor:"pointer"}}>
                        <span style={{fontFamily:F_SANS,fontSize:12,color:"rgba(255,255,255,0.7)"}}>{z.label}</span>
                        <span style={{fontFamily:F_SANS,fontSize:11,color:n?"#aac756":"rgba(255,255,255,0.3)"}}>{n?`${n} ✓`:(open?"−":"+")}</span>
                      </div>
                      {open&&z.symptoms.map(s=>{
                        const sel = f.sintomas.includes(s.id);
                        const crit = s.flag==="CRITICAL", warn = s.flag==="WARNING";
                        return (
                          <div key={s.id} onClick={()=>set("sintomas",sel?f.sintomas.filter(x=>x!==s.id):[...f.sintomas,s.id])}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",marginTop:4,borderRadius:8,cursor:"pointer",
                              background:sel?(crit?"#2a0000":warn?"#2a0800":"rgba(255,255,255,0.08)"):"transparent",
                              border:`1px solid ${sel?(crit?"#7b0000":warn?"#c0392b":"rgba(255,255,255,0.2)"):"rgba(255,255,255,0.06)"}`}}>
                            <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid rgba(255,255,255,0.4)",background:sel?"rgba(255,255,255,0.85)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {sel&&<span style={{color:"#111",fontSize:10,fontWeight:700}}>✓</span>}
                            </div>
                            <span style={{fontFamily:F_SANS,fontSize:13,color:sel?"#fff":"rgba(255,255,255,0.6)"}}>{s.label}{crit&&" ⚫ CRÍTICO"}{warn&&" 🔴 ALERTA"}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </Field>
              <Field label="nota"><textarea value={f.note} rows={3} onChange={e=>set("note",e.target.value)} placeholder="observaciones, contexto, evolución..." style={{...INP_DARK,resize:"none"}}/></Field>
            </>)}

            {(type==="medicamento"||type==="tratamiento")&&(<>
              <Field label={type==="medicamento"?"medicamento":"tratamiento"}><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder={type==="medicamento"?"ej: ibuprofeno":"ej: nebulizaciones, kinesiología"} style={INP_DARK}/></Field>
              {alergia&&<div style={{fontFamily:F_SANS,fontSize:12,color:"#ff6b6b",background:"rgba(255,100,100,0.1)",borderRadius:8,padding:"8px 10px",marginBottom:14}}>⚠️ Coincide con una alergia registrada: {alergia}</div>}
              <Field label="dosis"><input value={f.dosis} onChange={e=>set("dosis",e.target.value)} placeholder="ej: 5 ml" style={INP_DARK}/></Field>
              <Field label="frecuencia"><input value={f.freq} onChange={e=>set("freq",e.target.value)} placeholder="ej: cada 8 h" style={INP_DARK}/></Field>
              <Field label="inicio"><div style={{display:"flex",gap:8}}><input type="date" value={f.start} onChange={e=>set("start",e.target.value)} style={INP_DARK}/><input type="time" value={f.startTime} onChange={e=>set("startTime",e.target.value)} style={{...INP_DARK,width:120}}/></div></Field>
              <Field label="fin (si es un curso)"><input type="date" value={f.end} min={f.start} onChange={e=>set("end",e.target.value)} style={INP_DARK}/></Field>
              <Field label="nota"><input value={f.note} onChange={e=>set("note",e.target.value)} style={INP_DARK}/></Field>
            </>)}

            {type==="cita"&&(<>
              <Field label="especialidad"><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="ej: pediatría" style={INP_DARK}/></Field>
              <Field label="médico (opcional)"><input value={f.medico} onChange={e=>set("medico",e.target.value)} placeholder="ej: Dra. Rojas" style={INP_DARK}/></Field>
              <Field label="fecha y hora"><div style={{display:"flex",gap:8}}><input type="date" value={f.start} onChange={e=>set("start",e.target.value)} style={INP_DARK}/><input type="time" value={f.startTime} onChange={e=>set("startTime",e.target.value)} style={{...INP_DARK,width:120}}/></div></Field>
              <Field label="repetir">
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {REPEAT_OPTS.map(o=>(
                    <button key={o.v} onClick={()=>set("repeatMonths",o.v)} style={{fontFamily:F_SANS,fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer",border:"1px dashed rgba(255,255,255,0.2)",background:f.repeatMonths===o.v?"#fff":"transparent",color:f.repeatMonths===o.v?"#111":"rgba(255,255,255,0.6)"}}>{o.l}</button>
                  ))}
                </div>
              </Field>
              <div style={{fontFamily:F_SANS,fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.5,marginBottom:14}}>
                Se agrega al planner el día de la cita (paciente, especialidad y hora), se marca 🏥 en el calendario y se crea una tarea de preparación el día anterior a las 21:30{f.repeatMonths?" (próximas 4 ocurrencias)":""}. Si editas o eliminas la cita, todo eso se actualiza.
                {editing&&editing.legacy&&" Esta cita viene de la versión anterior: sus tareas ya agendadas no están ligadas; al guardar se crean nuevas."}
              </div>
            </>)}

            {type==="diagnostico"&&(<>
              <Field label="diagnóstico"><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="ej: bronquitis aguda" style={INP_DARK}/></Field>
              <Field label="quién lo dio (médico / especialidad)"><input value={f.medico} onChange={e=>set("medico",e.target.value)} placeholder="ej: Dra. Rojas, pediatría" style={INP_DARK}/></Field>
              <Field label="fecha"><input type="date" value={f.start} max={today} onChange={e=>set("start",e.target.value)} style={INP_DARK}/></Field>
              <Field label="nota"><textarea value={f.note} rows={3} onChange={e=>set("note",e.target.value)} placeholder="indicaciones, tratamiento indicado..." style={{...INP_DARK,resize:"none"}}/></Field>
            </>)}

            {type==="enfermedad"&&(<>
              <Field label="nombre del episodio (opcional)"><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="ej: bronquitis" style={INP_DARK}/></Field>
              <Field label="inicio / fin"><div style={{display:"flex",gap:8}}><input type="date" value={f.start} onChange={e=>set("start",e.target.value)} style={INP_DARK}/><input type="date" value={f.end} min={f.start} onChange={e=>set("end",e.target.value)} style={INP_DARK}/></div></Field>
              <Field label="nota"><textarea value={f.note} rows={3} onChange={e=>set("note",e.target.value)} style={{...INP_DARK,resize:"none"}}/></Field>
            </>)}
          </div>
        )}

        {type&&(
          <div style={{padding:"12px 20px 28px",borderTop:"1px solid rgba(255,255,255,0.08)",flexShrink:0,display:"flex",gap:8}}>
            {editing&&type!=="enfermedad"&&<button onClick={()=>{if(window.confirm("¿Eliminar este registro?"))onDelete(editing);}} style={{background:"transparent",border:"1px dashed rgba(255,255,255,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:F_SANS,fontSize:12,color:"rgba(255,255,255,0.5)",cursor:"pointer"}}>eliminar</button>}
            <button disabled={!ok} onClick={()=>onSave({type,personId,f,editing})}
              style={{flex:1,background:ok?(type==="sintoma"?(hcfg.color==="#2a2a2a"?"#333":hcfg.color):"#2e7d52"):"#222",border:"none",borderRadius:10,padding:"14px",fontFamily:F_HAND,fontSize:18,color:ok?"#fff":"#666",cursor:ok?"pointer":"default"}}>
              {editing?"guardar cambios":"guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ficha de la persona (condiciones, alergias, medicación habitual, vacunas) ──
const PERFIL_SECCIONES = [
  {key:"condicionesCronicas",label:"Condiciones crónicas",icon:"♾️",placeholder:"ej: asma, TDAH"},
  {key:"alergias",label:"Alergias / contraindicaciones",icon:"⚠️",placeholder:"ej: amoxicilina, ibuprofeno"},
  {key:"medicacionHabitual",label:"Medicación habitual",icon:"💊",placeholder:"ej: salbutamol según necesidad"},
  {key:"vacunas",label:"Vacunas",icon:"💉",placeholder:"ej: triple viral, hepatitis A"},
];
function PerfilView({persona,perfil,onBack,onGrowth,onEditPerson}){
  const [draft,setDraft] = React.useState({condicionesCronicas:[],alergias:[],medicacionHabitual:[],vacunas:[],...perfil});
  const [adding,setAdding] = React.useState(null);
  const [item,setItem] = React.useState("");
  function add(key){
    if(!item.trim()) return;
    setDraft(d=>({...d,[key]:[...(d[key]||[]),item.trim()]}));
    setItem(""); setAdding(null);
  }
  const rm = (key,i)=>setDraft(d=>({...d,[key]:(d[key]||[]).filter((_,j)=>j!==i)}));
  return (
    <div style={PAGE}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={()=>onBack(draft)} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
        <span style={{fontSize:22}}>{persona.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:F_HAND,fontSize:22,fontWeight:700,color:"#111"}}>{persona.name}</div>
          <div style={{fontFamily:F_SANS,fontSize:11,color:"#aaa"}}>ficha · {persona.dob?calcAge(persona.dob)+" años":""}</div>
        </div>
        <button onClick={()=>onEditPerson(draft)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:F_SANS,fontSize:11,color:"#888"}}>✏️ datos</button>
        <button onClick={()=>onGrowth(draft)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:F_SANS,fontSize:11,color:"#888"}}>📏 crecimiento</button>
      </div>
      {PERFIL_SECCIONES.map(({key,label,icon,placeholder})=>(
        <div key={key} style={{marginBottom:18}}>
          <div style={{fontFamily:F_HAND,fontSize:17,fontWeight:700,color:"#111",marginBottom:8}}>{icon} {label}</div>
          {(draft[key]||[]).map((it,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px dashed #f0f0f0"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#111",flexShrink:0}}/>
              <div style={{flex:1,fontFamily:F_SANS,fontSize:13,color:"#333"}}>{it}</div>
              <button onClick={()=>rm(key,i)} style={{background:"transparent",border:"none",color:"#ccc",fontSize:16,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
          ))}
          {adding===key
            ?<div style={{display:"flex",gap:6,marginTop:6}}>
              <input autoFocus value={item} onChange={e=>setItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")add(key);if(e.key==="Escape")setAdding(null);}} placeholder={placeholder} style={INP}/>
              <button onClick={()=>add(key)} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontFamily:F_SANS}}>+</button>
            </div>
            :<button onClick={()=>{setAdding(key);setItem("");}} style={{marginTop:6,background:"transparent",border:"1px dashed #e0e0e0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:F_SANS,fontSize:11,color:"#999"}}>+ agregar</button>}
        </div>
      ))}
      <button onClick={()=>onBack(draft)} style={{width:"100%",background:"#111",border:"none",borderRadius:10,padding:"12px",fontFamily:F_HAND,fontSize:17,color:"#fff",cursor:"pointer"}}>guardar ficha</button>
      <div style={{height:32}}/>
    </div>
  );
}

// ── Resumen para compartir con un médico ──
function ResumenView({kh,family,initialPersonId,today,onBack}){
  const [pid,setPid] = React.useState(initialPersonId||family[0].id);
  const [from,setFrom] = React.useState(addDaysKey(today,-30));
  const [to,setTo] = React.useState(today);
  const [copied,setCopied] = React.useState(false);
  const person = family.find(p=>p.id===pid)||family[0];
  const text = buildSummary({person,profile:(kh.profiles||{})[person.id],events:kh.events||[],from,to,today});
  function copy(){
    const done = ()=>{setCopied(true);setTimeout(()=>setCopied(false),1800);};
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done).catch(()=>fallback()); }
    else fallback();
    function fallback(){
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); done(); }catch(e){}
      document.body.removeChild(ta);
    }
  }
  return (
    <div style={PAGE}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
        <div style={{fontFamily:F_HAND,fontSize:22,fontWeight:700,color:"#111"}}>Resumen para compartir</div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {family.map(p=>(
          <button key={p.id} onClick={()=>setPid(p.id)} style={{fontFamily:F_SANS,fontSize:12,padding:"6px 12px",borderRadius:16,cursor:"pointer",border:"1px solid "+(pid===p.id?"#111":"#ddd"),background:pid===p.id?"#111":"transparent",color:pid===p.id?"#fff":"#666"}}>{p.icon} {p.name}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
        <input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)} style={INP}/>
        <span style={{color:"#aaa"}}>→</span>
        <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} style={INP}/>
      </div>
      <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:F_SANS,fontSize:12,lineHeight:1.55,color:"#222",background:"#fafafa",border:"1px solid #eee",borderRadius:10,padding:"12px 14px",margin:"0 0 12px"}}>{text}</pre>
      <div style={{display:"flex",gap:8}}>
        <button onClick={copy} style={{flex:1,background:copied?"#2e7d52":"#111",border:"none",borderRadius:10,padding:"12px",fontFamily:F_HAND,fontSize:17,color:"#fff",cursor:"pointer"}}>{copied?"copiado ✓":"copiar texto"}</button>
        {typeof navigator!=="undefined"&&navigator.share&&<button onClick={()=>navigator.share({text}).catch(()=>{})} style={{background:"transparent",border:"1px dashed #ccc",borderRadius:10,padding:"12px 16px",fontFamily:F_SANS,fontSize:12,color:"#666",cursor:"pointer"}}>compartir</button>}
      </div>
      <div style={{height:32}}/>
    </div>
  );
}

// ── Formulario de persona (alta y edición) ──
const PERSON_ICONS = ["👶","🧒","👧","👦","🧑","👩","👨","🧔","🙂"];
function PersonForm({init,submitLabel,onSubmit}){
  const [d,setD] = React.useState({name:"",dob:"",icon:"🙂",sex:"m",...(init||{})});
  const ok = !!d.name.trim()&&!!d.dob;
  const box = {border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",fontFamily:F_SANS,fontSize:14,background:"#fff",color:"#111",boxSizing:"border-box",width:"100%"};
  const pick = (active)=>({fontFamily:F_SANS,fontSize:12,padding:"8px 14px",borderRadius:8,cursor:"pointer",border:"1px solid "+(active?"#111":"#ddd"),background:active?"#111":"transparent",color:active?"#fff":"#666",flex:1});
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <input value={d.name} onChange={e=>setD({...d,name:e.target.value})} placeholder="Nombre" style={box}/>
      <div>
        <div style={{fontFamily:F_SANS,fontSize:10,color:"#aaa",marginBottom:4}}>fecha de nacimiento</div>
        <input type="date" value={d.dob} max={localDateKey()} onChange={e=>setD({...d,dob:e.target.value})} style={box}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setD({...d,sex:"m"})} style={pick(d.sex==="m")}>masculino</button>
        <button onClick={()=>setD({...d,sex:"f"})} style={pick(d.sex==="f")}>femenino</button>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {PERSON_ICONS.map(ic=>(
          <button key={ic} onClick={()=>setD({...d,icon:ic})} style={{fontSize:20,width:40,height:40,borderRadius:8,cursor:"pointer",border:"1px solid "+(d.icon===ic?"#111":"#ddd"),background:d.icon===ic?"#f0f0f0":"transparent"}}>{ic}</button>
        ))}
      </div>
      <button disabled={!ok} onClick={()=>onSubmit({name:d.name.trim(),dob:d.dob,icon:d.icon||"🙂",sex:d.sex})}
        style={{background:ok?"#111":"#ddd",border:"none",borderRadius:10,padding:"12px",fontFamily:F_HAND,fontSize:17,color:ok?"#fff":"#999",cursor:ok?"pointer":"default"}}>{submitLabel}</button>
    </div>
  );
}

// ── Alta / edición / baja de una persona ──
function PersonView({kh,persona,onBack,onSave,onDelete}){
  const count = persona?personEventCount(kh,persona.id):0;
  return (
    <div style={PAGE}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
        <div style={{fontFamily:F_HAND,fontSize:22,fontWeight:700,color:"#111"}}>{persona?`Datos de ${persona.name}`:"Nueva persona"}</div>
      </div>
      <PersonForm key={persona?persona.id:"new"} init={persona||null} submitLabel={persona?"guardar datos":"agregar"} onSubmit={onSave}/>
      {persona&&(
        <div style={{marginTop:28,paddingTop:16,borderTop:"1px dashed #e5e5e5"}}>
          {count>0
            ?<div style={{fontFamily:F_SANS,fontSize:12,color:"#999",lineHeight:1.5}}>No se puede eliminar a {persona.name} porque tiene {count} {count===1?"registro":"registros"} de salud. Elimina primero esos registros desde la línea de tiempo.</div>
            :<button onClick={()=>{if(window.confirm(`¿Eliminar a ${persona.name} de la familia?`))onDelete(persona);}} style={{background:"transparent",border:"1px dashed #e0b4b4",borderRadius:8,padding:"8px 14px",fontFamily:F_SANS,fontSize:12,color:"#c0392b",cursor:"pointer"}}>eliminar persona</button>}
        </div>
      )}
      <div style={{height:32}}/>
    </div>
  );
}

// ── Onboarding: primera vez sin familia cargada ──
function Onboarding({kh,save}){
  return (
    <div style={PAGE}>
      <div style={{fontFamily:F_HAND,fontSize:22,color:"#555",marginBottom:4}}>Familia</div>
      <div style={{fontFamily:F_SANS,fontSize:12,color:"#999",marginBottom:16}}>Todavía no hay nadie cargado. Agrega a cada persona una vez — queda guardado en tus datos, no en el código. Después puedes sumar más desde la línea de tiempo.</div>
      <PersonForm submitLabel="agregar" onSubmit={d=>save(addPerson(kh,d).kh)}/>
    </div>
  );
}

// ── Ventana emergente (ficha, crecimiento, resumen, datos de persona) ──
function ModalShell({children,onClose,z}){
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:z||600,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,width:"min(96vw,480px)",maxHeight:"92vh",overflowY:"auto",boxShadow:"5px 5px 0 #111",border:"2px dashed #111",position:"relative"}}>
        <div style={{display:"flex",justifyContent:"flex-end",padding:"6px 10px 0"}}>
          <button onClick={onClose} aria-label="cerrar" style={{background:"transparent",border:"none",fontSize:22,color:"#aaa",cursor:"pointer",lineHeight:1,padding:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const SECTIONS = [
  {id:"episodios", icon:"🤒", label:"Episodios"},
  {id:"citas", icon:"🗓️", label:"Citas"},
  {id:"medicacion", icon:"💊", label:"Medicación y tratamientos"},
  {id:"historial", icon:"📚", label:"Historial"},
];
const MONTH_LONG = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function SectionRow({sec,summary,open,onToggle}){
  return (
    <button onClick={onToggle} aria-expanded={open}
      style={{width:"100%",display:"flex",alignItems:"center",gap:10,minHeight:44,padding:"6px 12px",marginBottom:4,borderRadius:10,cursor:"pointer",textAlign:"left",
        background:open?"#111":"#fff",color:open?"#fff":"#111",border:"1px dashed "+(open?"#111":"#ddd"),flex:"none",boxSizing:"border-box"}}>
      <span style={{fontSize:16}}>{sec.icon}</span>
      <span style={{fontFamily:F_HAND,fontSize:17,fontWeight:700,whiteSpace:"nowrap"}}>{sec.label}</span>
      <span style={{flex:1,minWidth:0,fontFamily:F_SANS,fontSize:11,color:open?"rgba(255,255,255,0.55)":"#999",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}}>{summary}</span>
      <span style={{fontSize:12,color:open?"rgba(255,255,255,0.6)":"#bbb",transform:open?"rotate(90deg)":"none",transition:"transform .15s"}}>›</span>
    </button>
  );
}

function HistoryRow({it,label,family,showPerson,onOpen}){
  const ev = it.ev;
  const meta = TYPE_META[ev.type]||{icon:"•",label:ev.type};
  return (
    <div onClick={()=>onOpen(ev)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 4px",borderBottom:"1px dashed #eee",cursor:"pointer"}}>
      <span style={{fontFamily:F_SANS,fontSize:10,color:"#aaa",minWidth:42}}>{ev.start.slice(8)}/{ev.start.slice(5,7)}</span>
      <span style={{fontSize:13}}>{meta.icon}</span>
      <span style={{flex:1,minWidth:0,fontFamily:F_SANS,fontSize:12,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {showPerson&&<span style={{color:"#999"}}>{nameOf(family,ev.personId)} · </span>}{label}
      </span>
      <span style={{fontSize:11,color:"#ccc"}}>›</span>
    </div>
  );
}

// ── Página ──
function SaludPage({kidsHealth, saveKidsHealth, dayData, updateDay, calMarks, saveCalMarks}) {
  const today = localDateKey();
  const kh = React.useMemo(()=>migrateKidsHealth(kidsHealth, today),[kidsHealth]);
  const family = kh.family||[];
  const [modal,setModal] = React.useState(null);        // null | perfil | crecimiento | resumen | persona
  const [filterId,setFilterId] = React.useState(null);  // null = familia
  const [selId,setSelId] = React.useState(null);        // persona de ficha / crecimiento / datos
  const [sheet,setSheet] = React.useState(null);        // {ev?, type?, personId?}
  const [open,setOpen] = React.useState(null);          // sección expandida (exclusiva)
  const [suggest,setSuggest] = React.useState(null);    // {personId} → aviso "agendar cita"
  const bodyRef = React.useRef(null);

  // Válvula (lineamiento §4.3): si colapsado desborda, avisar en consola para ajustar.
  React.useEffect(()=>{
    const el = bodyRef.current;
    if(!el||open) return;
    const over = el.scrollHeight-el.clientHeight;
    if(over>1) console.warn(`[salud] desborda colapsado: ${over}px — revisar alturas (R2)`);
  });

  // Todos los hooks de arriba ya corrieron: el early return es seguro.
  if(family.length===0) return <Onboarding kh={kh} save={saveKidsHealth}/>;

  const events = kh.events||[];
  const persist = next => saveKidsHealth(next);
  const actions = makeSaludActions({kh,persist,dayData,updateDay,calMarks,saveCalMarks,isMedicalTask:esTareaMedica});

  function handleSave(args){
    const r = actions.save(args);
    if(r.suggest) setSuggest(r.suggest);
    setSheet(null);
  }
  function handleDelete(ev){ actions.remove(ev); setSheet(null); }
  const closeEpisode = id => persist(closeIllness(kh,id,today));
  const setMissed = (id,n) => persist({...kh,events:events.map(e=>e.id===id?{...e,missedDays:Math.max(0,(e.missedDays||0)+n)}:e)});
  const saveProfile = (pid,data) => persist({...kh,profiles:{...(kh.profiles||{}),[pid]:data}});

  function saveGrowth(pid,entry){
    const perfil = (kh.profiles||{})[pid]||{};
    const log = [...(perfil.growthLog||[]).filter(g=>g.date!==entry.date),entry].sort((a,b)=>a.date.localeCompare(b.date));
    saveProfile(pid,{...perfil,growthLog:log});
    if(updateDay){
      // recordatorio anual de medir: solo la tarea (ya no marca 🏥 — esa marca sale de las citas)
      const nextStr = (entry.date.slice(0,4)*1+1)+entry.date.slice(4);
      const rid = "gr_"+Date.now().toString(36);
      updateDay(nextStr,{tasks:[...((dayData&&dayData[nextStr]&&dayData[nextStr].tasks)||[]),{id:rid,text:`medir a ${nameOf(family,pid)}`,fixed:false,done:false}]});
    }
  }
  function savePerson(data){
    if(selPerson){ persist(updatePerson(kh,selPerson.id,data)); setModal("perfil"); }
    else { persist(addPerson(kh,data).kh); setModal(null); }
  }
  function deletePerson(p){
    const next = removePerson(kh,p.id);
    if(!next) return;
    persist(next); setFilterId(null); setSelId(null); setModal(null);
  }

  const selPerson = family.find(f=>f.id===selId);
  const sec = buildSections(events,{personId:filterId,today});
  const showPerson = !filterId;
  const openEv = ev => setSheet({ev,personId:ev.personId});
  const chip = (active)=>({fontFamily:F_SANS,fontSize:12,padding:"6px 12px",borderRadius:16,cursor:"pointer",whiteSpace:"nowrap",flex:"none",border:"1px solid "+(active?"#111":"#ddd"),background:active?"#111":"transparent",color:active?"#fff":"#666"});
  const toggle = id => setOpen(o=>o===id?null:id);

  // resúmenes de las filas
  const n = (k,one,many)=>`${k} ${k===1?one:many}`;
  const summaries = {
    episodios: sec.illnesses.length===0?"sin episodios":(sec.active.length?`${n(sec.active.length,"activo","activos")} · ${sec.illnesses.length} en total`:`${sec.illnesses.length} en total`),
    citas: sec.upcoming.length===0?"sin citas agendadas":`próxima ${fmtDay(sec.upcoming[0].dk)}${sec.upcoming[0].ev.startTime?" "+sec.upcoming[0].ev.startTime:""}${sec.upcoming.length>1?` · ${sec.upcoming.length} agendadas`:""}`,
    medicacion: sec.vigentes.length?n(sec.vigentes.length,"vigente","vigentes"):(sec.meds[0]?`última: ${sec.meds[0].title} ${sec.meds[0].start.slice(8)}/${sec.meds[0].start.slice(5,7)}`:"sin registros"),
    historial: sec.historyCount?n(sec.historyCount,"evento","eventos"):"sin registros",
  };

  // franja de estado: episodios activos + próxima cita (+ aviso de cita sugerida)
  const nextCita = sec.upcoming[0];
  const activeLines = sec.active.slice(0,2);
  const suggestName = suggest?nameOf(family,suggest.personId):null;

  return (
    <div style={{flex:"1 1 0",minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",padding:"10px 12px 8px",maxWidth:520,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:6,flex:"none",scrollbarWidth:"none"}}>
        <button onClick={()=>setFilterId(null)} style={chip(!filterId)}>Familia</button>
        {family.map(p=>{
          const ill = activeIllness(events,p.id);
          return <button key={p.id} onClick={()=>setFilterId(p.id)} style={chip(filterId===p.id)}>{p.icon} {p.name}{ill?" "+(HAZARD_CONFIG[ill.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR).emoji:""}</button>;
        })}
        <button onClick={()=>{setSelId(null);setModal("persona");}} style={{...chip(false),borderStyle:"dashed"}}>+ persona</button>
      </div>

      <div style={{background:"#1a1a1a",borderRadius:12,padding:"8px 12px",marginBottom:6,flex:"none",display:"flex",gap:8,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          {activeLines.length>0
            ?activeLines.map(ill=>{
              const cfg = HAZARD_CONFIG[ill.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR;
              return <div key={ill.id} style={{fontFamily:F_SANS,fontSize:12,lineHeight:"18px",color:cfg.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {cfg.emoji} {showPerson?nameOf(family,ill.personId)+" · ":""}{illnessLabel(kh,ill)} · día {daysInclusive(ill.start,today)}
              </div>;
            })
            :<div style={{fontFamily:F_SANS,fontSize:12,lineHeight:"18px",color:"rgba(255,255,255,0.45)"}}>🟢 sin episodios activos</div>}
          {sec.active.length>2&&<div style={{fontFamily:F_SANS,fontSize:10,lineHeight:"14px",color:"rgba(255,255,255,0.4)"}}>+{sec.active.length-2} más</div>}
          <div style={{fontFamily:F_SANS,fontSize:12,lineHeight:"18px",color:"rgba(255,255,255,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {nextCita
              ?`🗓️ ${fmtDay(nextCita.dk)}${nextCita.ev.startTime?" "+nextCita.ev.startTime:""} · ${showPerson?nameOf(family,nextCita.ev.personId)+" · ":""}${nextCita.ev.title}`
              :<span style={{color:"rgba(255,255,255,0.4)"}}>🗓️ sin citas próximas</span>}
          </div>
          {suggest&&(
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
              <span style={{flex:1,minWidth:0,fontFamily:F_SANS,fontSize:11,color:"#ffb74d"}}>⚠️ Nivel alto para {suggestName}: conviene ver a un médico</span>
              <button onClick={()=>{setSheet({type:"cita",personId:suggest.personId,date:today});setSuggest(null);}} style={{flex:"none",fontFamily:F_SANS,fontSize:10,background:"#ffb74d",border:"none",borderRadius:6,padding:"4px 8px",color:"#111",cursor:"pointer"}}>agendar cita</button>
              <button onClick={()=>setSuggest(null)} aria-label="descartar" style={{flex:"none",background:"transparent",border:"none",color:"rgba(255,255,255,0.4)",fontSize:16,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,flex:"none"}}>
          {filterId&&<button onClick={()=>{setSelId(filterId);setModal("perfil");}} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:6,padding:"3px 8px",fontFamily:F_SANS,fontSize:11,color:"rgba(255,255,255,0.8)",cursor:"pointer"}}>♾️ ficha</button>}
          <button onClick={()=>setModal("resumen")} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:6,padding:"3px 8px",fontFamily:F_SANS,fontSize:11,color:"rgba(255,255,255,0.8)",cursor:"pointer"}}>📄 resumen</button>
        </div>
      </div>

      <div ref={bodyRef} data-expandido={open?"true":"false"} style={{flex:"1 1 0",minHeight:0,overflowY:open?"auto":"hidden",overflowX:"hidden"}}>
        {SECTIONS.map(sc=>(
          <div key={sc.id}>
            <SectionRow sec={sc} summary={summaries[sc.id]} open={open===sc.id} onToggle={()=>toggle(sc.id)}/>
            {open===sc.id&&(
              <div style={{padding:"4px 2px 10px"}}>
                {sc.id==="episodios"&&(sec.illnesses.length
                  ?sec.illnesses.map(ill=><IllnessCard key={ill.id} kh={kh} family={family} item={sec.items.find(x=>x.ev.id===ill.id)||{ev:ill,children:[]}} today={today} showPerson={showPerson}
                      onOpen={openEv} onClose={closeEpisode} onMissed={setMissed} onDelete={x=>persist(deleteEvent(kh,x.id))}/>)
                  :<div style={{padding:"14px 0",textAlign:"center",fontFamily:F_HAND,fontSize:16,color:"#ccc"}}>sin episodios</div>)}
                {sc.id==="citas"&&(sec.upcoming.length
                  ?sec.upcoming.map(x=><UpcomingRow key={x.ev.id} ev={x.ev} dk={x.dk} family={family} showPerson={showPerson} onOpen={openEv}/>)
                  :<div style={{padding:"14px 0",textAlign:"center",fontFamily:F_HAND,fontSize:16,color:"#ccc"}}>sin citas agendadas</div>)}
                {sc.id==="medicacion"&&(sec.meds.length
                  ?sec.meds.map(m=><LooseRow key={m.id} ev={m} family={family} showPerson={showPerson} onOpen={openEv}/>)
                  :<div style={{padding:"14px 0",textAlign:"center",fontFamily:F_HAND,fontSize:16,color:"#ccc"}}>sin registros</div>)}
                {sc.id==="historial"&&(sec.months.length
                  ?sec.months.map(g=>(
                    <div key={g.month} style={{marginBottom:8}}>
                      <div style={{fontFamily:F_SANS,fontSize:9,color:"#aaa",letterSpacing:2,textTransform:"uppercase",margin:"4px 0"}}>{MONTH_LONG[parseInt(g.month.slice(5),10)-1]} {g.month.slice(0,4)}</div>
                      {g.items.map(it=><HistoryRow key={it.ev.id} it={it} label={it.kind==="illness"?`enfermedad · ${illnessLabel(kh,it.ev)}`:`${(TYPE_META[it.ev.type]||{label:it.ev.type}).label.toLowerCase()}${it.ev.title?" · "+it.ev.title:""}`} family={family} showPerson={showPerson} onOpen={openEv}/>)}
                    </div>))
                  :<div style={{padding:"14px 0",textAlign:"center",fontFamily:F_HAND,fontSize:16,color:"#ccc"}}>sin registros todavía</div>)}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={()=>setSheet({personId:filterId})} style={{flex:"none",width:"100%",background:"#111",border:"none",borderRadius:10,padding:"11px",fontFamily:F_HAND,fontSize:18,color:"#fff",cursor:"pointer",marginTop:6}}>+ agregar</button>

      {sheet&&<EntrySheet key={sheet.ev?sheet.ev.id:"new"} init={sheet} family={family} kh={kh} today={today}
        onSave={handleSave} onDelete={handleDelete} onClose={()=>setSheet(null)}/>}

      {modal==="persona"&&<ModalShell onClose={()=>setModal(selPerson?"perfil":null)}>
        <PersonView kh={kh} persona={selPerson||null} onBack={()=>setModal(selPerson?"perfil":null)} onSave={savePerson} onDelete={deletePerson}/>
      </ModalShell>}
      {modal==="perfil"&&selPerson&&<ModalShell onClose={()=>setModal(null)}>
        <PerfilView key={selId} persona={selPerson} perfil={(kh.profiles||{})[selId]||{}}
          onBack={d=>{saveProfile(selId,d);setModal(null);}} onGrowth={d=>{saveProfile(selId,d);setModal("crecimiento");}}
          onEditPerson={d=>{saveProfile(selId,d);setModal("persona");}}/>
      </ModalShell>}
      {modal==="crecimiento"&&selPerson&&<ModalShell onClose={()=>setModal("perfil")}>
        <GrowthView key={selId} persona={selPerson} perfil={(kh.profiles||{})[selId]||{}} today={today}
          onBack={()=>setModal("perfil")} onSave={e=>saveGrowth(selId,e)}/>
      </ModalShell>}
      {modal==="resumen"&&<ModalShell onClose={()=>setModal(null)}>
        <ResumenView kh={kh} family={family} initialPersonId={filterId} today={today} onBack={()=>setModal(null)}/>
      </ModalShell>}
    </div>
  );
}

// ── Ventana de ➕ Registrar y del pincel "Doctor" del calendario ──
// Misma hoja y mismas acciones que la pestaña, pero abierta desde fuera de ella.
export function SaludRegistro({kidsHealth, saveKidsHealth, dayData, updateDay, calMarks, saveCalMarks, initial, onClose, onGuardado}){
  const today = localDateKey();
  const kh = React.useMemo(()=>migrateKidsHealth(kidsHealth, today),[kidsHealth]);
  const family = kh.family||[];
  if(family.length===0){
    return (
      <ModalShell onClose={onClose} z={1100}>
        <div style={{padding:"28px 22px",fontFamily:F_SANS,fontSize:13,color:"#555",lineHeight:1.5}}>Primero agrega a la familia desde la pestaña <b>Salud</b> (chip "+ persona").</div>
      </ModalShell>
    );
  }
  const actions = makeSaludActions({kh,persist:saveKidsHealth,dayData,updateDay,calMarks,saveCalMarks,isMedicalTask:esTareaMedica});
  return <EntrySheet z={1100} types={["cita","diagnostico","sintoma"]} init={initial||{}} family={family} kh={kh} today={today}
    onSave={args=>{actions.save(args); if(onGuardado) onGuardado("Salud registrada ✓"); onClose();}}
    onDelete={()=>{}} onClose={onClose}/>;
}

export default SaludPage;
