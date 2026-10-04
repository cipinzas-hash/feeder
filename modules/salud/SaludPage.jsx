// Salud — línea de tiempo familiar/individual de eventos de salud (schema v2).
// Datos y reglas en saludModel.js; curva de crecimiento en GrowthView.jsx.
// El roster (nombres/fechas de nacimiento) vive en kidsHealth.family, editable
// desde la UI (onboarding) — nunca en el repo.
import GrowthView from "./GrowthView.jsx";
import {
  SYMPTOM_ZONES, FEVER_IDS, symptomLabel, calcHazard, calcAge, localDateKey, localTimeKey, addDaysKey, daysInclusive,
  migrateKidsHealth, activeIllness, addSymptomEntry, upsertEvent, deleteEvent, closeIllness, planCita,
  buildTimeline, illnessLabel, buildSummary,
} from "./saludModel.js";

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
  medicamento:{icon:"💊",label:"Medicamento"}, tratamiento:{icon:"🧴",label:"Tratamiento"}, cita:{icon:"🗓️",label:"Cita médica"},
};
const ADD_TYPES = ["sintoma","medicamento","tratamiento","cita"];
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

function UpcomingRow({ev,family,showPerson,onOpen}){
  return (
    <div onClick={()=>onOpen(ev)} style={{background:"#f4f8ec",border:"1px solid #dfe9c6",borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
      <div style={{textAlign:"center",minWidth:48}}>
        <div style={{fontFamily:F_HAND,fontSize:17,fontWeight:700,color:"#111",lineHeight:1}}>{fmtDay(ev.start)}</div>
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
  const base = {date:today,time:now,sintomas:[],temps:[{t:now,v:""}],note:"",title:"",dosis:"",freq:"",start:today,startTime:now,end:"",medico:"",repeatMonths:0,missedDays:0};
  if(!ev) return base;
  if(ev.type==="sintoma") return {...base,date:ev.start,time:ev.startTime||"",sintomas:ev.sintomas||[],temps:(ev.temps||[]).map(t=>({t:t.t||"",v:String(t.v)})),note:ev.note||""};
  if(ev.type==="enfermedad") return {...base,title:ev.title||"",start:ev.start,end:ev.end||"",note:ev.note||"",missedDays:ev.missedDays||0};
  if(ev.type==="cita") return {...base,title:ev.title||"",medico:ev.medico||"",start:ev.start,startTime:ev.startTime||"09:00",repeatMonths:ev.repeatMonths||0};
  return {...base,title:ev.title||"",dosis:ev.dosis||"",freq:ev.freq||"",start:ev.start,startTime:ev.startTime||"",end:ev.end||"",note:ev.note||""};
}

function Field({label,children}){
  return <div style={{marginBottom:14}}><div style={LABEL_DARK}>{label}</div>{children}</div>;
}

function EntrySheet({init,family,kh,today,onSave,onDelete,onClose}){
  const editing = init.ev||null;
  const [type,setType] = React.useState(editing?editing.type:(init.type||null));
  const [personId,setPersonId] = React.useState(editing?editing.personId:(init.personId||null));
  const [f,setF] = React.useState(()=>initForm(init,today));
  const [openZone,setOpenZone] = React.useState(null);
  const set = (k,v)=>setF(x=>({...x,[k]:v}));
  // una cita nueva parte a las 09:00 (hora usual de control), no a la hora actual
  const chooseType = t => { setType(t); if(t==="cita") set("startTime","09:00"); };
  const perfil = (kh.profiles||{})[personId]||{};
  const hasTemp = f.temps.some(t=>!isNaN(parseFloat(t.v)));
  const hz = calcHazard(f.sintomas, f.temps.map(t=>({v:t.v})));
  const hcfg = HAZARD_CONFIG[hz];
  let ok = !!personId;
  if(type==="sintoma") ok = ok&&(f.sintomas.length>0||hasTemp||!!f.note.trim());
  else if(type==="medicamento"||type==="tratamiento") ok = ok&&!!f.title.trim()&&!!f.start;
  else if(type==="cita") ok = ok&&!!f.title.trim()&&!!f.start&&!!f.startTime;
  else if(type==="enfermedad") ok = ok&&!!f.start;
  const alergia = type==="medicamento"&&f.title.trim()
    ? (perfil.alergias||[]).find(a=>{const x=String(a).toLowerCase(),y=f.title.trim().toLowerCase();return x&&(x.includes(y)||y.includes(x));})
    : null;
  const zones = SYMPTOM_ZONES.map(z=>({...z,symptoms:z.symptoms.filter(s=>!FEVER_IDS.includes(s.id)||f.sintomas.includes(s.id))})).filter(z=>z.symptoms.length);
  const title = editing ? (TYPE_META[editing.type]||{}).label : (type?TYPE_META[type].label:"Agregar");

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#0d0d0d",borderRadius:"16px 16px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          {!editing&&type&&<button onClick={()=>setType(null)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:18,cursor:"pointer",padding:0}}>←</button>}
          <div style={{flex:1,fontFamily:F_HAND,fontSize:20,fontWeight:700,color:"#fff"}}>{title}</div>
          {type==="sintoma"&&<div style={{background:hcfg.bg,border:`1px solid ${hcfg.color}`,borderRadius:8,padding:"4px 10px",fontFamily:F_SANS,fontSize:9,color:hcfg.text,letterSpacing:1,textTransform:"uppercase"}}>{hcfg.emoji} {hcfg.label}</div>}
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
        </div>

        {!type&&(
          <div style={{padding:"16px 20px 32px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {ADD_TYPES.map(t=>(
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
              <Field label="tipo de cita"><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="ej: control pediátrico" style={INP_DARK}/></Field>
              <Field label="médico / especialista"><input value={f.medico} onChange={e=>set("medico",e.target.value)} style={INP_DARK}/></Field>
              <Field label="fecha y hora"><div style={{display:"flex",gap:8}}><input type="date" value={f.start} onChange={e=>set("start",e.target.value)} style={INP_DARK}/><input type="time" value={f.startTime} onChange={e=>set("startTime",e.target.value)} style={{...INP_DARK,width:120}}/></div></Field>
              <Field label="repetir">
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {REPEAT_OPTS.map(o=>(
                    <button key={o.v} onClick={()=>set("repeatMonths",o.v)} style={{fontFamily:F_SANS,fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer",border:"1px dashed rgba(255,255,255,0.2)",background:f.repeatMonths===o.v?"#fff":"transparent",color:f.repeatMonths===o.v?"#111":"rgba(255,255,255,0.6)"}}>{o.l}</button>
                  ))}
                </div>
              </Field>
              <div style={{fontFamily:F_SANS,fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.5,marginBottom:14}}>
                Se agrega al planner el día de la cita y una tarea de preparación el día anterior a las 21:30{f.repeatMonths?" (próximas 4 ocurrencias)":""}. Si editas o eliminas la cita, esas tareas se actualizan.
                {editing&&editing.legacy&&" Esta cita viene de la versión anterior: sus tareas ya agendadas no están ligadas; al guardar se crean nuevas."}
              </div>
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
function PerfilView({persona,perfil,onBack,onGrowth}){
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

// ── Onboarding: primera vez sin familia cargada ──
function Onboarding({kh,save}){
  const [d,setD] = React.useState({name:"",dob:"",icon:"🙂",sex:"m"});
  function add(){
    if(!d.name.trim()||!d.dob) return;
    const id = d.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"") || ("p"+Date.now());
    save({...kh, family:[...(kh.family||[]), {id,name:d.name.trim(),dob:d.dob,icon:d.icon||"🙂",sex:d.sex||"m"}]});
    setD({name:"",dob:"",icon:"🙂",sex:"m"});
  }
  const box = {border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",fontFamily:F_SANS,fontSize:14};
  return (
    <div style={PAGE}>
      <div style={{fontFamily:F_HAND,fontSize:22,color:"#555",marginBottom:4}}>Familia</div>
      <div style={{fontFamily:F_SANS,fontSize:12,color:"#999",marginBottom:16}}>Todavía no hay nadie cargado. Agregá cada persona una vez — queda guardado en tus datos, no en el código.</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <input value={d.name} onChange={e=>setD({...d,name:e.target.value})} placeholder="Nombre" style={box}/>
        <input type="date" value={d.dob} onChange={e=>setD({...d,dob:e.target.value})} style={box}/>
        <div style={{display:"flex",gap:8}}>
          <input value={d.icon} onChange={e=>setD({...d,icon:e.target.value})} placeholder="Ícono" style={{...box,width:70,textAlign:"center"}}/>
          <select value={d.sex} onChange={e=>setD({...d,sex:e.target.value})} style={{...box,flex:1}}><option value="m">m</option><option value="f">f</option></select>
        </div>
        <button onClick={add} style={{background:"#aac756",border:"none",borderRadius:8,padding:"10px 12px",fontFamily:F_SANS,fontSize:14,fontWeight:700,color:"#111"}}>Agregar</button>
      </div>
    </div>
  );
}

// ── Página ──
function SaludPage({kidsHealth, saveKidsHealth, dayData, updateDay, calMarks, saveCalMarks}) {
  const today = localDateKey();
  const kh = React.useMemo(()=>migrateKidsHealth(kidsHealth, today),[kidsHealth]);
  const family = kh.family||[];
  const [view,setView] = React.useState("timeline"); // timeline | perfil | crecimiento | resumen
  const [filterId,setFilterId] = React.useState(null); // null = familia
  const [selId,setSelId] = React.useState(null);       // persona de ficha / crecimiento
  const [sheet,setSheet] = React.useState(null);       // {ev?, type?, personId?}

  // Todos los hooks de arriba ya corrieron: el early return es seguro.
  if(family.length===0) return <Onboarding kh={kh} save={saveKidsHealth}/>;

  const events = kh.events||[];
  const persist = next => saveKidsHealth(next);

  function applyPlan(plan){
    if(updateDay) Object.entries(plan.dayPatches).forEach(([dk,tasks])=>updateDay(dk,{tasks}));
    if(plan.marks&&saveCalMarks) saveCalMarks(plan.marks);
  }
  function markDoctor(dk){
    if(!saveCalMarks) return;
    const cur = Array.isArray(calMarks&&calMarks[dk])?calMarks[dk]:((calMarks&&calMarks[dk])?[calMarks[dk]]:[]);
    if(!cur.includes("doctor")) saveCalMarks({...(calMarks||{}), [dk]:[...cur,"doctor"]});
  }

  function handleSave({type,personId,f,editing}){
    if(type==="sintoma"){
      if(editing){
        const temps = f.temps.filter(t=>!isNaN(parseFloat(t.v))).map(t=>({t:t.t||null,v:parseFloat(t.v)}));
        persist(upsertEvent(kh,{...editing,start:f.date,startTime:f.time||null,sintomas:f.sintomas,temps,hazardLevel:calcHazard(f.sintomas,temps),note:f.note}));
      } else {
        const r = addSymptomEntry(kh,{personId,date:f.date,time:f.time,sintomas:f.sintomas,temps:f.temps,note:f.note},{illness:nid("ep_"),entry:nid("sx_")});
        persist(r.kh);
        if(r.doctorMarkDate) markDoctor(r.doctorMarkDate);
      }
    } else if(type==="medicamento"||type==="tratamiento"){
      const ill = editing?null:activeIllness(events,personId);
      const parentId = editing?editing.parentId:(ill&&f.start>=ill.start?ill.id:undefined);
      persist(upsertEvent(kh,{...(editing||{}),id:editing?editing.id:nid(type==="medicamento"?"md_":"tr_"),personId,type,parentId,
        title:f.title.trim(),dosis:f.dosis.trim(),freq:f.freq.trim(),start:f.start,startTime:f.startTime||null,end:f.end||null,note:f.note.trim()}));
    } else if(type==="cita"){
      const ev = {id:editing?editing.id:nid("ct_"),personId,type:"cita",title:f.title.trim(),medico:f.medico.trim(),
        start:f.start,startTime:f.startTime,repeatMonths:f.repeatMonths||null,markedDates:(editing&&editing.markedDates)||[]};
      const plan = planCita({events:events.filter(e=>e.id!==ev.id),dayData,marks:calMarks,prevEv:editing,nextEv:ev,personName:nameOf(family,personId)});
      persist(upsertEvent(kh,plan.ev));
      applyPlan(plan);
    } else if(type==="enfermedad"){
      persist(upsertEvent(kh,{...editing,title:f.title.trim(),start:f.start,end:f.end||null,note:f.note.trim()}));
    }
    setSheet(null);
  }

  function handleDelete(ev){
    if(ev.type==="cita"){
      const plan = planCita({events:events.filter(e=>e.id!==ev.id),dayData,marks:calMarks,prevEv:ev,nextEv:null,personName:""});
      persist(deleteEvent(kh,ev.id));
      applyPlan(plan);
    } else persist(deleteEvent(kh,ev.id));
    setSheet(null);
  }
  const closeEpisode = id => persist(closeIllness(kh,id,today));
  const setMissed = (id,n) => persist({...kh,events:events.map(e=>e.id===id?{...e,missedDays:Math.max(0,(e.missedDays||0)+n)}:e)});
  const saveProfile = (pid,data) => persist({...kh,profiles:{...(kh.profiles||{}),[pid]:data}});

  function saveGrowth(pid,entry){
    const perfil = (kh.profiles||{})[pid]||{};
    const log = [...(perfil.growthLog||[]).filter(g=>g.date!==entry.date),entry].sort((a,b)=>a.date.localeCompare(b.date));
    saveProfile(pid,{...perfil,growthLog:log});
    if(updateDay){
      const nextStr = (entry.date.slice(0,4)*1+1)+entry.date.slice(4);
      const rid = nid("gr_");
      updateDay(nextStr,{tasks:[...((dayData&&dayData[nextStr]&&dayData[nextStr].tasks)||[]),{id:rid,text:`medir a ${nameOf(family,pid)}`,fixed:false,done:false}]});
      markDoctor(nextStr);
    }
  }

  // ── Vistas secundarias ──
  const selPerson = family.find(f=>f.id===selId);
  if(view==="perfil"&&selPerson){
    return <PerfilView key={selId} persona={selPerson} perfil={(kh.profiles||{})[selId]||{}}
      onBack={d=>{saveProfile(selId,d);setView("timeline");}} onGrowth={d=>{saveProfile(selId,d);setView("crecimiento");}}/>;
  }
  if(view==="crecimiento"&&selPerson){
    return <GrowthView key={selId} persona={selPerson} perfil={(kh.profiles||{})[selId]||{}} today={today}
      onBack={()=>setView("perfil")} onSave={e=>saveGrowth(selId,e)}/>;
  }
  if(view==="resumen"){
    return <ResumenView kh={kh} family={family} initialPersonId={filterId} today={today} onBack={()=>setView("timeline")}/>;
  }

  // ── Línea de tiempo ──
  const tl = buildTimeline(events,{personId:filterId,today});
  const showPerson = !filterId;
  const open = ev => setSheet({ev,personId:ev.personId});
  const chip = (active)=>({fontFamily:F_SANS,fontSize:12,padding:"6px 12px",borderRadius:16,cursor:"pointer",whiteSpace:"nowrap",border:"1px solid "+(active?"#111":"#ddd"),background:active?"#111":"transparent",color:active?"#fff":"#666"});

  return (
    <div style={PAGE}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <div style={{flex:1,fontFamily:F_HAND,fontSize:24,color:"#555"}}>Salud</div>
        {filterId&&<button onClick={()=>{setSelId(filterId);setView("perfil");}} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:F_SANS,fontSize:11,color:"#888"}}>♾️ ficha</button>}
        <button onClick={()=>setView("resumen")} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:F_SANS,fontSize:11,color:"#888"}}>📄 resumen</button>
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:10}}>
        <button onClick={()=>setFilterId(null)} style={chip(!filterId)}>Familia</button>
        {family.map(p=>{
          const ill = activeIllness(events,p.id);
          return <button key={p.id} onClick={()=>setFilterId(p.id)} style={chip(filterId===p.id)}>{p.icon} {p.name}{ill?" "+(HAZARD_CONFIG[ill.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR).emoji:""}</button>;
        })}
      </div>

      <button onClick={()=>setSheet({personId:filterId})} style={{width:"100%",background:"#111",border:"none",borderRadius:10,padding:"12px",fontFamily:F_HAND,fontSize:18,color:"#fff",cursor:"pointer",marginBottom:16}}>+ agregar</button>

      {tl.upcoming.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:F_SANS,fontSize:9,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>próximas citas</div>
          {tl.upcoming.map(ev=><UpcomingRow key={ev.id} ev={ev} family={family} showPerson={showPerson} onOpen={open}/>)}
        </div>
      )}

      {tl.items.length>0&&<div style={{fontFamily:F_SANS,fontSize:9,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>historial</div>}
      {tl.items.map(it=>it.kind==="illness"
        ?<IllnessCard key={it.ev.id} kh={kh} family={family} item={it} today={today} showPerson={showPerson}
            onOpen={open} onClose={closeEpisode} onMissed={setMissed} onDelete={ill=>persist(deleteEvent(kh,ill.id))}/>
        :<LooseRow key={it.ev.id} ev={it.ev} family={family} showPerson={showPerson} onOpen={open}/>)}

      {tl.items.length===0&&tl.upcoming.length===0&&(
        <div style={{padding:"40px 0",textAlign:"center",fontFamily:F_HAND,fontSize:17,color:"#ccc"}}>sin registros todavía</div>
      )}
      <div style={{height:32}}/>

      {sheet&&<EntrySheet key={sheet.ev?sheet.ev.id:"new"} init={sheet} family={family} kh={kh} today={today}
        onSave={handleSave} onDelete={handleDelete} onClose={()=>setSheet(null)}/>}
    </div>
  );
}

export default SaludPage;
