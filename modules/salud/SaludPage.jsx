// Antes: roster hardcodeado acá (nombres/fechas de nacimiento reales en
// texto plano en el código fuente). Ahora vive en kidsHealth.family,
// editable desde la UI (ver onboarding más abajo) — nunca en el repo.

function calcAge(dob){
  const b=new Date(dob+"T12:00:00"),t=new Date();
  let a=t.getFullYear()-b.getFullYear();
  if(t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate()))a--;
  return a;
}

// ── Síntomas con peso para scoring ──
const SYMPTOM_ZONES = [
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

function calcHazard(sintomas) {
  if(!sintomas||!sintomas.length) return "CLEAR";
  let score = 0;
  for(const sId of sintomas){
    for(const zone of SYMPTOM_ZONES){
      const s = zone.symptoms.find(x=>x.id===sId);
      if(!s) continue;
      if(s.flag==="CRITICAL") return "CRITICAL";
      if(s.flag==="WARNING") { score = Math.max(score, 6); continue; }
      score += s.peso;
    }
  }
  if(score<=0) return "CLEAR";
  if(score<=2) return "WATCH";
  if(score<=5) return "ADVISORY";
  return "WARNING";
}

const HAZARD_CONFIG = {
  CLEAR:    {color:"#2a2a2a", bg:"#1a1a1a", text:"#fff", label:"Clear",    emoji:"🟢", pulse:false},
  WATCH:    {color:"#b8860b", bg:"#2a2200", text:"#ffd700", label:"Watch", emoji:"🟡", pulse:false},
  ADVISORY: {color:"#c05000", bg:"#2a1400", text:"#ff8c00", label:"Advisory",emoji:"🟠",pulse:false},
  WARNING:  {color:"#c0392b", bg:"#2a0800", text:"#ff4444", label:"Warning",emoji:"🔴",pulse:true},
  CRITICAL: {color:"#7b0000", bg:"#1a0000", text:"#ff0000", label:"Critical",emoji:"⚫",pulse:true},
};

// Percentiles OMS simplificados — talla cm por edad en meses, para niñas y niños
// P3, P15, P50, P85, P97
const WHO_HEIGHT = {
  f: {
    24:{p3:79.3,p15:81.5,p50:84.6,p85:87.7,p97:90.0},
    36:{p3:88.3,p15:90.9,p50:94.2,p85:97.6,p97:100.3},
    48:{p3:95.0,p15:97.9,p50:101.6,p85:105.4,p97:108.5},
    60:{p3:100.9,p15:104.1,p50:108.4,p85:112.7,p97:116.1},
    72:{p3:106.5,p15:109.9,p50:114.6,p85:119.4,p97:123.0},
    84:{p3:111.8,p15:115.6,p50:120.8,p85:126.1,p97:130.0},
    96:{p3:116.9,p15:121.0,p50:126.6,p85:132.4,p97:136.7},
    108:{p3:122.2,p15:126.4,p50:132.2,p85:138.3,p97:143.0},
    120:{p3:127.5,p15:131.9,p50:137.8,p85:144.2,p97:149.2},
    132:{p3:133.0,p15:137.4,p50:143.5,p85:150.0,p97:155.3},
    144:{p3:138.7,p15:143.1,p50:149.3,p85:155.9,p97:161.5},
  },
  m: {
    24:{p3:80.8,p15:83.1,p50:86.4,p85:89.7,p97:92.1},
    36:{p3:89.7,p15:92.3,p50:95.7,p85:99.0,p97:101.7},
    48:{p3:96.7,p15:99.5,p50:103.3,p85:107.0,p97:110.0},
    60:{p3:102.7,p15:105.8,p50:110.0,p85:114.2,p97:117.4},
    72:{p3:108.5,p15:111.8,p50:116.3,p85:120.9,p97:124.4},
    84:{p3:114.2,p15:117.7,p50:122.5,p85:127.4,p97:131.2},
    96:{p3:119.7,p15:123.5,p50:128.7,p85:133.9,p97:138.1},
    108:{p3:125.3,p15:129.3,p50:134.8,p85:140.4,p97:144.9},
    120:{p3:130.8,p15:135.0,p50:140.8,p85:146.8,p97:151.6},
    132:{p3:136.2,p15:140.7,p50:146.9,p85:153.3,p97:158.6},
    144:{p3:141.6,p15:146.4,p50:153.0,p85:159.9,p97:165.7},
  }
};

function getWHOPercentileKey(ageMonths) {
  const keys = [24,36,48,60,72,84,96,108,120,132,144];
  let best = keys[0];
  for(const k of keys){ if(k<=ageMonths) best=k; }
  return best;
}

function SaludPage({kidsHealth, saveKidsHealth, dayData, updateDay, calMarks, saveCalMarks}) {
  const family = kidsHealth.family || [];
  const today = new Date().toISOString().slice(0,10);
  const [dateKey, setDateKey] = React.useState(today);
  const [view, setView] = React.useState("home"); // home | ficha | perfil | crecimiento
  const [selPersonId, setSelPersonId] = React.useState(null);
  const [slideOpen, setSlideOpen] = React.useState(null); // personId
  const [slideMode, setSlideMode] = React.useState("update"); // update | nuevo
  const [sintomas, setSintomas] = React.useState([]);
  const [nota, setNota] = React.useState("");
  const [temperatura, setTemperatura] = React.useState("");
  const [editPerfilId, setEditPerfilId] = React.useState(null);
  const [perfilDraft, setPerfilDraft] = React.useState({});
  const [newCita, setNewCita] = React.useState({tipo:"",frecMeses:6,medico:"",hora:"09:00"});
  const [newMemberDraft, setNewMemberDraft] = React.useState({name:"",dob:"",icon:"🙂",sex:"m"});

  function addFamilyMember(){
    const d = newMemberDraft;
    if(!d.name.trim()||!d.dob) return;
    const id = d.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"") || ("p"+Date.now());
    const member = {id, name:d.name.trim(), dob:d.dob, icon:d.icon||"🙂", sex:d.sex||"m"};
    saveKidsHealth({...kidsHealth, family:[...family, member]});
    setNewMemberDraft({name:"",dob:"",icon:"🙂",sex:"m"});
  }

  function removeFamilyMember(id){
    saveKidsHealth({...kidsHealth, family: family.filter(f=>f.id!==id)});
  }

  const [addingCita, setAddingCita] = React.useState(false);
  const [growthInput, setGrowthInput] = React.useState({peso:"",talla:"",date:today});
  const [addingGrowth, setAddingGrowth] = React.useState(false);

  // Onboarding: primera vez que se abre Salud sin datos de familia cargados
  // (instalación nueva, o repo recién clonado sin el .json de backup restaurado).
  // Todos los hooks de arriba ya se llamaron — el early return es seguro acá.
  if (family.length === 0) {
    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#555",marginBottom:4}}>Familia</div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#999",marginBottom:16}}>
          Todavía no hay nadie cargado. Agregá cada persona una vez — queda guardado en tus datos, no en el código.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          <input value={newMemberDraft.name} onChange={e=>setNewMemberDraft({...newMemberDraft,name:e.target.value})}
            placeholder="Nombre" style={{border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14}}/>
          <input type="date" value={newMemberDraft.dob} onChange={e=>setNewMemberDraft({...newMemberDraft,dob:e.target.value})}
            style={{border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14}}/>
          <div style={{display:"flex",gap:8}}>
            <input value={newMemberDraft.icon} onChange={e=>setNewMemberDraft({...newMemberDraft,icon:e.target.value})}
              placeholder="Ícono" style={{width:70,border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,textAlign:"center"}}/>
            <select value={newMemberDraft.sex} onChange={e=>setNewMemberDraft({...newMemberDraft,sex:e.target.value})}
              style={{flex:1,border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14}}>
              <option value="m">m</option>
              <option value="f">f</option>
            </select>
          </div>
          <button onClick={addFamilyMember} style={{background:"#aac756",border:"none",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:"#111"}}>
            Agregar
          </button>
        </div>
      </div>
    );
  }

  // Helpers
  const episodes = kidsHealth.episodes||[];
  const dailyLog = kidsHealth.dailyLog||{};
  const profiles  = kidsHealth.profiles||{};

  function saveAll(updates) {
    saveKidsHealth({...kidsHealth, ...updates});
  }

  function getProfile(personId) {
    return profiles[personId]||{condicionesCronicas:[],alergias:[],medicacionHabitual:[],vacunas:[],citasRegulares:[],growthLog:[]};
  }

  function saveProfile(personId, data) {
    saveAll({profiles:{...profiles,[personId]:data}});
  }

  function getActiveEpisode(personId) {
    return episodes.filter(e=>e.kidId===personId&&!e.endDate).sort((a,b)=>b.startDate.localeCompare(a.startDate))[0]||null;
  }

  function getDayLog(personId, dk) {
    return (dailyLog[dk]||{})[personId]||null;
  }

  function hazardForPerson(personId) {
    const ep = getActiveEpisode(personId);
    if(!ep) {
      const dl = getDayLog(personId, dateKey);
      if(!dl) return null;
      if(dl.sinNovedad) return "CLEAR";
      return calcHazard(dl.sintomas||[]);
    }
    const dl = getDayLog(personId, dateKey);
    const sints = dl?.sintomas||ep.lastSintomas||[];
    return calcHazard(sints);
  }

  // Abrir slide-up
  function openSlide(personId) {
    const ep = getActiveEpisode(personId);
    const dl = getDayLog(personId, dateKey);
    setSintomas(dl?.sintomas||ep?.lastSintomas||[]);
    setNota(dl?.nota||"");
    setTemperatura(dl?.temperatura||"");
    setSlideMode(ep?"update":"nuevo");
    setSlideOpen(personId);
  }

  // Tap en card CLEAR — registra sin novedades directo
  function tapClear(personId) {
    const ep = getActiveEpisode(personId);
    if(ep) { openSlide(personId); return; }
    const dl = getDayLog(personId, dateKey);
    if(dl) { openSlide(personId); return; }
    // Registra sin novedades
    const newLog = {...(dailyLog[dateKey]||{}), [personId]:{sinNovedad:true, sintomas:[], hazardLevel:"CLEAR", nota:"", temperatura:""}};
    saveAll({dailyLog:{...dailyLog,[dateKey]:newLog}});
  }

  // Guardar registro del slide-up
  function saveSlide() {
    const personId = slideOpen;
    const hazard = calcHazard(sintomas);
    const logEntry = {sinNovedad:sintomas.length===0&&!nota&&!temperatura, sintomas, hazardLevel:hazard, nota, temperatura};
    const newDayLog = {...(dailyLog[dateKey]||{}), [personId]:logEntry};

    // Si hay síntomas y no hay episodio activo → crear episodio
    const ep = getActiveEpisode(personId);
    let newEpisodes = [...episodes];
    if(sintomas.length>0 && !ep) {
      const epNuevo = {
        id:Date.now().toString(), kidId:personId,
        startDate:dateKey, endDate:null,
        lastSintomas:sintomas, hazardLevel:hazard,
        notas:"", missedDays:0, days:[{date:dateKey, sintomas, hazardLevel:hazard, nota, temperatura}]
      };
      newEpisodes = [epNuevo, ...episodes];
      // Marcar doctor en calMarks si WARNING/CRITICAL
      if(hazard==="WARNING"||hazard==="CRITICAL") {
        addDoctorMark(dateKey);
      }
    } else if(ep) {
      // Actualizar episodio existente con nuevo log diario
      const newDay = {date:dateKey, sintomas, hazardLevel:hazard, nota, temperatura};
      const days = ep.days||[];
      const existIdx = days.findIndex(d=>d.date===dateKey);
      const newDays = existIdx>=0 ? days.map((d,i)=>i===existIdx?newDay:d) : [...days, newDay].sort((a,b)=>a.date.localeCompare(b.date));
      newEpisodes = episodes.map(e=>e.id===ep.id?{...e,lastSintomas:sintomas,hazardLevel:hazard,days:newDays}:e);
    }

    saveAll({dailyLog:{...dailyLog,[dateKey]:newDayLog}, episodes:newEpisodes});
    setSlideOpen(null);
    setSintomas([]); setNota(""); setTemperatura("");
  }

  // Marcar doctor en calMarks
  function addDoctorMark(dk) {
    if(!saveCalMarks) return;
    const cur = Array.isArray(calMarks?.[dk])?calMarks[dk]:(calMarks?.[dk]?[calMarks[dk]]:[]);
    if(!cur.includes("doctor")) {
      saveCalMarks({...calMarks, [dk]:[...cur,"doctor"]});
    }
  }

  // Proyectar cita recurrente en dayData + preparación día anterior + marcador
  function proyectarCita(personId, cita) {
    if(!updateDay||!cita.hora) return;
    const [h,m] = cita.hora.split(":").map(Number);
    const persona = family.find(f=>f.id===personId);
    const texto = `${cita.tipo} ${persona?.name||""} — ${cita.medico||""}`.trim();
    // Proyectar próximas 4 ocurrencias
    const hoy = new Date();
    let fechaBase = new Date(hoy);
    for(let i=0; i<4; i++) {
      const fechaStr = fechaBase.getFullYear()+"-"+String(fechaBase.getMonth()+1).padStart(2,"0")+"-"+String(fechaBase.getDate()).padStart(2,"0");
      // Tarea fija en el día de la cita
      const id = Date.now().toString()+Math.random().toString(36).slice(2);
      setDayDataWithCita(fechaStr, {id, text:texto, fixed:true, done:false, deadline:{h,m}});
      // Preparación el día anterior a las 21:30
      const prevDate = new Date(fechaBase);
      prevDate.setDate(prevDate.getDate()-1);
      const prevStr = prevDate.getFullYear()+"-"+String(prevDate.getMonth()+1).padStart(2,"0")+"-"+String(prevDate.getDate()).padStart(2,"0");
      const prepId = Date.now().toString()+Math.random().toString(36).slice(2)+"p";
      setDayDataWithCita(prevStr, {id:prepId, text:`preparar: ${texto}`, fixed:false, done:false, deadline:{h:21,m:30}});
      // Marcador doctor
      addDoctorMark(fechaStr);
      // Avanzar según frecuencia
      fechaBase.setMonth(fechaBase.getMonth()+(cita.frecMeses||6));
    }
  }

  function setDayDataWithCita(dk, task) {
    if(!updateDay) return;
    updateDay(dk, {tasks:[...((dayData?.[dk]?.tasks)||[]), task]});
  }

  // Guardar cita nueva en perfil y proyectar
  function saveCita(personId) {
    if(!newCita.tipo.trim()) return;
    const perfil = getProfile(personId);
    const citaConId = {...newCita, id:Date.now().toString()};
    const newPerfil = {...perfil, citasRegulares:[...(perfil.citasRegulares||[]),citaConId]};
    saveProfile(personId, newPerfil);
    proyectarCita(personId, citaConId);
    setNewCita({tipo:"",frecMeses:6,medico:"",hora:"09:00"});
    setAddingCita(false);
  }

  // Guardar medición de crecimiento
  function saveGrowth(personId) {
    if(!growthInput.talla&&!growthInput.peso) return;
    const perfil = getProfile(personId);
    const entry = {date:growthInput.date||today, peso:parseFloat(growthInput.peso)||null, talla:parseFloat(growthInput.talla)||null};
    const newLog = [...(perfil.growthLog||[]).filter(g=>g.date!==entry.date), entry].sort((a,b)=>a.date.localeCompare(b.date));
    saveProfile(personId, {...perfil, growthLog:newLog});
    // Proyectar recordatorio anual
    if(updateDay) {
      const nextYear = new Date(entry.date+"T12:00:00");
      nextYear.setFullYear(nextYear.getFullYear()+1);
      const nextStr = nextYear.getFullYear()+"-"+String(nextYear.getMonth()+1).padStart(2,"0")+"-"+String(nextYear.getDate()).padStart(2,"0");
      const persona = family.find(f=>f.id===personId);
      const rid = Date.now().toString()+Math.random().toString(36).slice(2);
      updateDay(nextStr, {tasks:[...((dayData?.[nextStr]?.tasks)||[]), {id:rid, text:`medir a ${persona?.name||personId}`, fixed:false, done:false}]});
      addDoctorMark(nextStr);
    }
    setGrowthInput({peso:"",talla:"",date:today});
    setAddingGrowth(false);
  }

  const shiftDate = (n) => {
    const d = new Date(dateKey+"T12:00:00"); d.setDate(d.getDate()+n);
    setDateKey(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"));
  };

  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const DOW_ES = ["dom","lun","mar","mié","jue","vie","sáb"];
  const dObj = new Date(dateKey+"T12:00:00");
  const dateLabel = dateKey===today?"hoy":`${DOW_ES[dObj.getDay()]} ${dObj.getDate()} ${MONTHS_ES[dObj.getMonth()]}`;

  const hazardActual = calcHazard(sintomas);
  const hCfg = HAZARD_CONFIG[hazardActual]||HAZARD_CONFIG.CLEAR;

  // ── VISTA: PERFIL ─────────────────────────────────────────────────────────
  if(view==="perfil" && selPersonId) {
    const persona = family.find(f=>f.id===selPersonId);
    const perfil = getProfile(selPersonId);
    const [draft, setDraft] = React.useState({...perfil});
    const [addingItem, setAddingItem] = React.useState(null); // "condicion"|"alergia"|"medicacion"|"vacuna"
    const [newItem, setNewItem] = React.useState("");

    function addToList(key) {
      if(!newItem.trim()) return;
      setDraft(d=>({...d,[key]:[...(d[key]||[]),newItem.trim()]}));
      setNewItem(""); setAddingItem(null);
    }
    function removeFromList(key, idx) {
      setDraft(d=>({...d,[key]:(d[key]||[]).filter((_,i)=>i!==idx)}));
    }
    function guardarPerfil() {
      saveProfile(selPersonId, draft);
      setView("home");
    }
    function deleteCita(idx) {
      setDraft(d=>({...d,citasRegulares:(d.citasRegulares||[]).filter((_,i)=>i!==idx)}));
    }

    const FREQ_OPTS = [{v:1,l:"mensual"},{v:3,l:"c/3 meses"},{v:6,l:"semestral"},{v:12,l:"anual"},{v:24,l:"c/2 años"}];
    const inpS = {border:"1px dashed #ddd",borderRadius:8,padding:"8px 10px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"#fafafa",color:"#111",width:"100%",boxSizing:"border-box"};

    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>{guardarPerfil();}} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
          <span style={{fontSize:22}}>{persona?.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111"}}>{persona?.name}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>perfil crónico · {calcAge(persona?.dob)} años</div>
          </div>
          <button onClick={()=>{setView("crecimiento");}} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888"}}>📏 crecer</button>
        </div>

        {/* Secciones del perfil */}
        {[
          {key:"condicionesCronicas",label:"Condiciones crónicas",icon:"♾️",placeholder:"ej: asma, TDAH, alergia al maní"},
          {key:"alergias",           label:"Alergias / contraindicaciones",icon:"⚠️",placeholder:"ej: amoxicilina, ibuprofeno"},
          {key:"medicacionHabitual", label:"Medicación habitual",icon:"💊",placeholder:"ej: salbutamol según necesidad"},
          {key:"vacunas",            label:"Vacunas",icon:"💉",placeholder:"ej: triple viral, hepatitis A"},
        ].map(({key,label,icon,placeholder})=>(
          <div key={key} style={{marginBottom:18}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:17,fontWeight:700,color:"#111",marginBottom:8}}>{icon} {label}</div>
            {(draft[key]||[]).map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px dashed #f0f0f0"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#111",flexShrink:0}}/>
                <div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333"}}>{item}</div>
                <button onClick={()=>removeFromList(key,i)} style={{background:"transparent",border:"none",color:"#ddd",fontSize:16,cursor:"pointer",lineHeight:1}}>×</button>
              </div>
            ))}
            {addingItem===key
              ?<div style={{display:"flex",gap:6,marginTop:6}}>
                <input autoFocus value={newItem} onChange={e=>setNewItem(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")addToList(key);if(e.key==="Escape")setAddingItem(null);}}
                  placeholder={placeholder} style={inpS}/>
                <button onClick={()=>addToList(key)} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>+</button>
                <button onClick={()=>setAddingItem(null)} style={{background:"transparent",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
              </div>
              :<button onClick={()=>{setAddingItem(key);setNewItem("");}} style={{marginTop:6,background:"transparent",border:"1px dashed #e0e0e0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa"}}>+ agregar</button>
            }
          </div>
        ))}

        {/* Citas regulares */}
        <div style={{marginBottom:18}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:17,fontWeight:700,color:"#111",marginBottom:8}}>🗓️ Citas regulares</div>
          {(draft.citasRegulares||[]).map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px dashed #f0f0f0"}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{c.tipo}</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa"}}>{c.medico} · cada {c.frecMeses} meses · {c.hora}</div>
              </div>
              <button onClick={()=>deleteCita(i)} style={{background:"transparent",border:"none",color:"#ddd",fontSize:16,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
          ))}
          {addingCita
            ?<div style={{background:"#fafafa",border:"1px dashed #ddd",borderRadius:10,padding:"12px",marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
              <input value={newCita.tipo} onChange={e=>setNewCita(c=>({...c,tipo:e.target.value}))} placeholder="tipo de cita (ej: control pediátrico)" style={inpS}/>
              <input value={newCita.medico} onChange={e=>setNewCita(c=>({...c,medico:e.target.value}))} placeholder="médico / especialista" style={inpS}/>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Frecuencia</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {FREQ_OPTS.map(({v,l})=>(
                      <button key={v} onClick={()=>setNewCita(c=>({...c,frecMeses:v}))}
                        style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"4px 10px",borderRadius:8,border:"1px dashed #ddd",background:newCita.frecMeses===v?"#111":"transparent",color:newCita.frecMeses===v?"#fff":"#555",cursor:"pointer"}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Hora</div>
                  <input type="time" value={newCita.hora} onChange={e=>setNewCita(c=>({...c,hora:e.target.value}))}
                    style={{border:"1px dashed #ddd",borderRadius:8,padding:"6px 8px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",color:"#111"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>saveCita(selPersonId)} disabled={!newCita.tipo.trim()}
                  style={{flex:1,background:newCita.tipo.trim()?"#111":"#eee",color:newCita.tipo.trim()?"#fff":"#bbb",border:"none",borderRadius:8,padding:"9px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600}}>
                  guardar y proyectar en agenda
                </button>
                <button onClick={()=>setAddingCita(false)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"9px 14px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#999"}}>cancelar</button>
              </div>
            </div>
            :<button onClick={()=>setAddingCita(true)} style={{marginTop:6,background:"transparent",border:"1px dashed #e0e0e0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa"}}>+ agregar cita</button>
          }
        </div>

        <button onClick={guardarPerfil} style={{width:"100%",background:"#111",border:"none",borderRadius:10,padding:"12px",fontFamily:"'Caveat',cursive",fontSize:17,color:"#fff",cursor:"pointer"}}>guardar perfil</button>
        <div style={{height:32}}/>
      </div>
    );
  }

  // ── VISTA: CRECIMIENTO ────────────────────────────────────────────────────
  if(view==="crecimiento" && selPersonId) {
    const persona = family.find(f=>f.id===selPersonId);
    const perfil = getProfile(selPersonId);
    const growthLog = (perfil.growthLog||[]).sort((a,b)=>a.date.localeCompare(b.date));
    const isCristopher = selPersonId==="cristopher";

    // SVG de curva de crecimiento
    const W=290, H=120, padL=28, padR=8, padT=8, padB=20;
    const hasData = growthLog.filter(g=>g.talla).length>=2;
    let svgChart = null;
    if(hasData&&!isCristopher) {
      const tallaPoints = growthLog.filter(g=>g.talla);
      const dobMs = new Date(persona.dob+"T12:00:00").getTime();
      function ageMos(dk) { return Math.round((new Date(dk+"T12:00:00")-dobMs)/(30.44*24*3600*1000)); }
      const ages = tallaPoints.map(g=>ageMos(g.date));
      const tallas = tallaPoints.map(g=>g.talla);
      const minAge = Math.min(...ages), maxAge = Math.max(...ages,minAge+12);
      const minT = Math.min(...tallas)*0.95, maxT = Math.max(...tallas)*1.05;
      const tRng = maxT-minT||1, aRng = maxAge-minAge||12;
      const px = a => padL+((a-minAge)/aRng)*(W-padL-padR);
      const py = t => padT+H-padB-((t-minT)/tRng)*(H-padT-padB);
      // Percentiles OMS en el rango de edad
      const sex = persona.sex||"m";
      const whoKeys = [24,36,48,60,72,84,96,108,120,132,144].filter(k=>k>=minAge-6&&k<=maxAge+6);
      const pLines = ["p3","p15","p50","p85","p97"];
      const pColors = {p3:"rgba(100,180,255,0.4)",p15:"rgba(100,180,255,0.5)",p50:"rgba(100,180,255,0.8)",p85:"rgba(100,180,255,0.5)",p97:"rgba(100,180,255,0.4)"};
      const pPath = (pKey) => {
        const pts = whoKeys.map(k=>WHO_HEIGHT[sex][k]?.[pKey]).filter(Boolean);
        if(pts.length<2) return "";
        return whoKeys.filter(k=>WHO_HEIGHT[sex][k]?.[pKey]).map((k,i)=>`${i===0?"M":"L"}${px(k).toFixed(1)},${py(WHO_HEIGHT[sex][k][pKey]).toFixed(1)}`).join(" ");
      };
      const dataPath = tallaPoints.map((g,i)=>`${i===0?"M":"L"}${px(ageMos(g.date)).toFixed(1)},${py(g.talla).toFixed(1)}`).join(" ");
      svgChart = (
        <svg width={W} height={H+padB} style={{display:"block",overflow:"visible"}}>
          {pLines.map(p=>{const path=pPath(p);return path?<path key={p} d={path} fill="none" stroke={pColors[p]} strokeWidth="1" strokeDasharray="3,2"/>:null;})}
          <path d={dataPath} fill="none" stroke="#2e7d52" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          {tallaPoints.map((g,i)=><circle key={i} cx={px(ageMos(g.date))} cy={py(g.talla)} r={3} fill="#2e7d52"/>)}
          {["P3","P50","P97"].map((p,i)=>{
            const pk=p.toLowerCase();
            const lastK=whoKeys[whoKeys.length-1];
            if(!WHO_HEIGHT[sex]?.[lastK]?.[pk]) return null;
            return <text key={p} x={W-padR+2} y={py(WHO_HEIGHT[sex][lastK][pk])} fontSize="7" fill={pColors[pk]} fontFamily="DM Sans,sans-serif">{p}</text>;
          })}
          <text x={padL} y={H+padB-2} fontSize="8" fill="#bbb" fontFamily="DM Sans,sans-serif">{Math.round(minAge)}m</text>
          <text x={W-padR} y={H+padB-2} textAnchor="end" fontSize="8" fill="#bbb" fontFamily="DM Sans,sans-serif">{Math.round(maxAge)}m</text>
        </svg>
      );
    }

    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setView("perfil")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
          <span style={{fontSize:22}}>{persona?.icon}</span>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111"}}>{persona?.name} · curva de crecimiento</div>
        </div>

        {/* Último registro */}
        {growthLog.length>0&&(()=>{
          const last = growthLog[growthLog.length-1];
          return(
            <div style={{background:"#111",borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",gap:20}}>
              {last.talla&&<div><div style={{fontFamily:"'Caveat',cursive",fontSize:28,fontWeight:700,color:"#fff",lineHeight:1}}>{last.talla}<span style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>cm</span></div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:2}}>talla</div></div>}
              {last.peso&&<div><div style={{fontFamily:"'Caveat',cursive",fontSize:28,fontWeight:700,color:"#fff",lineHeight:1}}>{last.peso}<span style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>kg</span></div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:2}}>peso</div></div>}
              <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)"}}>{last.date}</div></div>
            </div>
          );
        })()}

        {/* Gráfico */}
        {svgChart&&(
          <div style={{background:"#fafafa",border:"1px solid #eee",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>talla / edad · curvas OMS</div>
            {svgChart}
          </div>
        )}

        {/* Agregar medición */}
        {!isCristopher&&(
          addingGrowth
            ?<div style={{background:"#fafafa",border:"1px dashed #ddd",borderRadius:12,padding:"14px",marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Talla (cm)</div>
                  <input type="number" step="0.1" value={growthInput.talla} onChange={e=>setGrowthInput(g=>({...g,talla:e.target.value}))} autoFocus style={{width:"100%",border:"1px dashed #ccc",borderRadius:8,padding:"8px 10px",fontSize:16,fontFamily:"'Caveat',cursive",outline:"none",boxSizing:"border-box",color:"#111"}}/>
                </div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Peso (kg)</div>
                  <input type="number" step="0.1" value={growthInput.peso} onChange={e=>setGrowthInput(g=>({...g,peso:e.target.value}))} style={{width:"100%",border:"1px dashed #ccc",borderRadius:8,padding:"8px 10px",fontSize:16,fontFamily:"'Caveat',cursive",outline:"none",boxSizing:"border-box",color:"#111"}}/>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Fecha</div>
                <input type="date" value={growthInput.date} onChange={e=>setGrowthInput(g=>({...g,date:e.target.value}))} style={{border:"1px dashed #ddd",borderRadius:8,padding:"7px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",color:"#111"}}/>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>saveGrowth(selPersonId)} style={{flex:1,background:"#111",border:"none",borderRadius:8,padding:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",cursor:"pointer",fontWeight:600}}>guardar</button>
                <button onClick={()=>setAddingGrowth(false)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"9px 14px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#999"}}>cancelar</button>
              </div>
            </div>
            :<button onClick={()=>setAddingGrowth(true)} style={{width:"100%",background:"#111",border:"none",borderRadius:10,padding:"12px",fontFamily:"'Caveat',cursive",fontSize:17,color:"#fff",cursor:"pointer",marginBottom:14}}>+ registrar medición</button>
        )}

        {/* Historial de mediciones */}
        {growthLog.length>0&&(
          <div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>historial</div>
            {[...growthLog].reverse().map((g,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px dashed #f0f0f0"}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",minWidth:60}}>{g.date}</div>
                <div style={{flex:1,display:"flex",gap:10}}>
                  {g.talla&&<span style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#111"}}>{g.talla}cm</span>}
                  {g.peso&&<span style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#555"}}>{g.peso}kg</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{height:32}}/>
      </div>
    );
  }

  // ── VISTA: FICHA DE EPISODIO ──────────────────────────────────────────────
  if(view==="ficha" && selPersonId) {
    const persona = family.find(f=>f.id===selPersonId);
    const ep = getActiveEpisode(selPersonId);
    const allEps = episodes.filter(e=>e.kidId===selPersonId).sort((a,b)=>b.startDate.localeCompare(a.startDate));

    function closeEpisode(id) {
      saveAll({episodes:episodes.map(e=>e.id===id?{...e,endDate:today}:e)});
    }
    function deleteEpisode(id) {
      saveAll({episodes:episodes.filter(e=>e.id!==id)});
      setView("home");
    }
    function updMissed(id,n) {
      saveAll({episodes:episodes.map(e=>e.id===id?{...e,missedDays:Math.max(0,(e.missedDays||0)+n)}:e)});
    }

    const HAZARD_LABELS = {CLEAR:"Clear",WATCH:"Watch",ADVISORY:"Advisory",WARNING:"Warning",CRITICAL:"Critical"};

    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>setView("home")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
          <span style={{fontSize:22}}>{persona?.icon}</span>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111"}}>{persona?.name} · episodios</div>
        </div>

        {allEps.length===0&&<div style={{padding:"40px 0",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:17,color:"#ccc"}}>sin episodios registrados</div>}

        {allEps.map(ep=>{
          const cfg = HAZARD_CONFIG[ep.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR;
          const days = ep.days||[];
          const dur = ep.endDate?Math.round((new Date(ep.endDate+"T12:00:00")-new Date(ep.startDate+"T12:00:00"))/86400000)+1:null;
          return(
            <div key={ep.id} style={{background:"#1a1a1a",borderRadius:12,padding:"14px 16px",marginBottom:12,border:`1px solid ${cfg.color}33`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:cfg.text}}>{HAZARD_CONFIG[ep.hazardLevel||"CLEAR"].emoji} {ep.hazardLevel||"CLEAR"}</span>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",flex:1}}>{ep.startDate}{ep.endDate?` → ${ep.endDate}`:` · activo`}{dur?` · ${dur}d`:""}</span>
                {!ep.endDate
                  ?<button onClick={()=>closeEpisode(ep.id)} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,background:"#e53935",border:"none",borderRadius:6,padding:"4px 10px",color:"#fff",cursor:"pointer"}}>cerrar</button>
                  :<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>cerrado</span>
                }
              </div>

              {/* Síntomas del último log */}
              {(ep.lastSintomas||[]).length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  {ep.lastSintomas.map(sid=>{
                    const s = SYMPTOM_ZONES.flatMap(z=>z.symptoms).find(x=>x.id===sid);
                    return s?<span key={sid} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.08)",borderRadius:6,padding:"2px 7px"}}>{s.label}</span>:null;
                  })}
                </div>
              )}

              {/* Días sin colegio */}
              {selPersonId!=="cristopher"&&(
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)"}}>días sin colegio</span>
                  <button onClick={()=>updMissed(ep.id,-1)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:5,width:24,height:24,color:"#fff",cursor:"pointer",fontSize:13}}>−</button>
                  <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff",minWidth:20,textAlign:"center"}}>{ep.missedDays||0}</span>
                  <button onClick={()=>updMissed(ep.id,1)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:5,width:24,height:24,color:"#fff",cursor:"pointer",fontSize:13}}>+</button>
                </div>
              )}

              {/* Timeline de logs */}
              {days.length>0&&(
                <div style={{marginBottom:8}}>
                  {[...days].reverse().slice(0,5).map((d,i)=>{
                    const dc=HAZARD_CONFIG[d.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR;
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",minWidth:50}}>{d.date.slice(5)}</span>
                        <span style={{fontSize:11}}>{dc.emoji}</span>
                        {d.temperatura&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:parseFloat(d.temperatura)>=38?"#ff6b6b":"rgba(255,255,255,0.4)"}}>🌡️{d.temperatura}°</span>}
                        {d.nota&&<span style={{fontFamily:"'Caveat',cursive",fontSize:12,color:"rgba(255,255,255,0.5)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{d.nota}"</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={()=>{if(window.confirm("¿Eliminar este episodio?"))deleteEpisode(ep.id);}}
                style={{background:"transparent",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:6,padding:"4px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)",cursor:"pointer"}}>
                eliminar
              </button>
            </div>
          );
        })}
        <div style={{height:32}}/>
      </div>
    );
  }

  // ── VISTA HOME ────────────────────────────────────────────────────────────
  const checkedToday = family.filter(f=>getDayLog(f.id,dateKey)!==null).length;

  return (
    <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>

      {/* Animación de pulso para WARNING/CRITICAL */}
      <style>{`
        @keyframes hazardPulse {
          0%,100%{opacity:1;} 50%{opacity:0.7;}
        }
        .hazard-pulse { animation: hazardPulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Slide-up de registro */}
      {slideOpen&&(()=>{
        const persona = family.find(f=>f.id===slideOpen);
        const ep = getActiveEpisode(slideOpen);
        const perfil = getProfile(slideOpen);
        const haz = hazardActual;
        const hcfg = HAZARD_CONFIG[haz]||HAZARD_CONFIG.CLEAR;
        return(
          <div onClick={()=>setSlideOpen(null)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#0d0d0d",borderRadius:"16px 16px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Header slide */}
              <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:22}}>{persona?.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#fff"}}>{persona?.name}</div>
                    {ep&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)"}}>episodio activo desde {ep.startDate}</div>}
                  </div>
                  {/* Hazard badge — actualiza en tiempo real */}
                  <div style={{background:hcfg.bg,border:`1px solid ${hcfg.color}`,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16}}>{hcfg.emoji}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:hcfg.text,letterSpacing:1,textTransform:"uppercase",marginTop:2}}>{hcfg.label}</div>
                  </div>
                </div>
                {/* Alergias/contraindicaciones del perfil — visible al registrar */}
                {(perfil.alergias||[]).length>0&&(
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#e53935",letterSpacing:1}}>ALERGIAS:</span>
                    {perfil.alergias.map((a,i)=><span key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,100,100,0.8)",background:"rgba(255,100,100,0.1)",borderRadius:4,padding:"1px 6px"}}>{a}</span>)}
                  </div>
                )}
              </div>

              {/* Síntomas — scroll */}
              <div style={{overflowY:"auto",flex:1,padding:"12px 20px"}}>
                {SYMPTOM_ZONES.map(zone=>(
                  <div key={zone.id} style={{marginBottom:16}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>{zone.label}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {zone.symptoms.map(s=>{
                        const sel = sintomas.includes(s.id);
                        const isCritical = s.flag==="CRITICAL";
                        const isWarning  = s.flag==="WARNING";
                        return(
                          <div key={s.id} onClick={()=>setSintomas(prev=>sel?prev.filter(x=>x!==s.id):[...prev,s.id])}
                            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,cursor:"pointer",
                              background:sel?(isCritical?"#2a0000":isWarning?"#2a0800":"rgba(255,255,255,0.08)"):"transparent",
                              border:`1px solid ${sel?(isCritical?"#7b0000":isWarning?"#c0392b":"rgba(255,255,255,0.2)"):"rgba(255,255,255,0.06)"}`,
                              transition:"all 0.15s"}}>
                            <div style={{width:20,height:20,borderRadius:4,border:`1.5px solid ${sel?(isCritical?"#ff0000":isWarning?"#ff4444":"rgba(255,255,255,0.7)"):"rgba(255,255,255,0.2)"}`,background:sel?(isCritical?"#ff0000":isWarning?"#ff4444":"rgba(255,255,255,0.9)"):"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                              {sel&&<span style={{color:isCritical||isWarning?"#fff":"#111",fontSize:11,fontWeight:700,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:sel?(isCritical?"#ff6b6b":isWarning?"#ff8c00":"#fff"):"rgba(255,255,255,0.6)",flex:1,lineHeight:1.3}}>
                              {s.label}
                              {isCritical&&<span style={{marginLeft:6,fontSize:10,color:"#ff0000",letterSpacing:1}}> ⚫ CRÍTICO</span>}
                              {isWarning&&<span style={{marginLeft:6,fontSize:10,color:"#ff4444",letterSpacing:1}}> 🔴 ALERTA</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Temperatura — solo si hay fiebre seleccionada */}
                {sintomas.some(s=>s.startsWith("temp_"))&&(
                  <div style={{marginBottom:16}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>temperatura exacta</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <input type="number" step="0.1" value={temperatura} onChange={e=>setTemperatura(e.target.value)} placeholder="ej: 38.5"
                        style={{flex:1,background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,padding:"10px 12px",fontFamily:"'Caveat',cursive",fontSize:18,color:parseFloat(temperatura)>=38?"#ff6b6b":"#fff",outline:"none"}}/>
                      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"rgba(255,255,255,0.4)"}}>°C</span>
                      {parseFloat(temperatura)>=38&&<span style={{fontSize:16}}>⚠️</span>}
                    </div>
                  </div>
                )}

                {/* Nota libre */}
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>nota del día</div>
                  <textarea value={nota} onChange={e=>setNota(e.target.value)} rows={3} placeholder="observaciones, contexto, evolución..."
                    style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,padding:"10px 12px",fontFamily:"'Caveat',cursive",fontSize:15,color:"rgba(255,255,255,0.8)",outline:"none",resize:"none",lineHeight:1.5,boxSizing:"border-box"}}/>
                </div>
              </div>

              {/* Footer — guardar */}
              <div style={{padding:"12px 20px 32px",borderTop:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
                <button onClick={saveSlide}
                  style={{width:"100%",background:hcfg.color||"#333",border:"none",borderRadius:10,padding:"14px",fontFamily:"'Caveat',cursive",fontSize:18,color:"#fff",cursor:"pointer",fontWeight:700}}>
                  {sintomas.length===0?"registrar sin novedades":"registrar · "+hcfg.emoji+" "+hcfg.label}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Date nav */}
      <div style={{display:"grid",gridTemplateColumns:"44px 1fr 44px",alignItems:"center",gap:8,marginBottom:20}}>
        <button onClick={()=>shiftDate(-1)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"8px 14px",cursor:"pointer",color:"#888",fontSize:20}}>‹</button>
        <div style={{textAlign:"center"}}>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#555"}}>{dateLabel}</span>
          {checkedToday>0&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginTop:2}}>{checkedToday}/{family.length} registrados hoy</div>}
        </div>
        <button onClick={()=>shiftDate(1)} disabled={dateKey>=today} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"8px 14px",cursor:"pointer",color:dateKey>=today?"#ddd":"#888",fontSize:20}}>›</button>
      </div>

      {/* Cards de naipe — 4 en fila */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
        {family.map(persona=>{
          const hazard = hazardForPerson(persona.id)||"CLEAR";
          const cfg = HAZARD_CONFIG[hazard];
          const ep = getActiveEpisode(persona.id);
          const dl = getDayLog(persona.id, dateKey);
          const checked = dl!==null;
          const edad = calcAge(persona.dob);
          const isPulse = cfg.pulse;
          const isClear = hazard==="CLEAR"&&!ep;
          const dias = ep?Math.round((new Date(dateKey+"T12:00:00")-new Date(ep.startDate+"T12:00:00"))/86400000)+1:null;

          return(
            <div key={persona.id} className={isPulse?"hazard-pulse":""}
              style={{
                background:cfg.bg,
                border:`1.5px solid ${cfg.color}`,
                borderRadius:12,
                padding:"10px 6px",
                display:"flex",
                flexDirection:"column",
                alignItems:"center",
                gap:6,
                cursor:"pointer",
                transition:"all 0.2s",
                minHeight:isClear?130:150,
                position:"relative",
              }}
              onClick={()=>{
                if(isClear&&!dl) tapClear(persona.id);
                else openSlide(persona.id);
              }}>

              {/* Check de registro del día */}
              {checked&&<div style={{position:"absolute",top:5,right:5,width:14,height:14,borderRadius:"50%",background:"#2e7d52",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:"#fff",fontSize:8,fontWeight:700}}>✓</span>
              </div>}

              {/* Ícono persona */}
              <div style={{fontSize:24,lineHeight:1}}>{persona.icon}</div>

              {/* Nombre */}
              <div style={{fontFamily:"'Caveat',cursive",fontSize:15,fontWeight:700,color:cfg.text,textAlign:"center",lineHeight:1}}>{persona.name}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:isClear?"rgba(255,255,255,0.3)":cfg.text+"99",textAlign:"center"}}>{edad}a</div>

              {/* Estado */}
              {ep?(
                <>
                  <div style={{fontSize:16,lineHeight:1,marginTop:2}}>{cfg.emoji}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:cfg.text,textAlign:"center",letterSpacing:0.5,textTransform:"uppercase",lineHeight:1.2}}>{cfg.label}</div>
                  {dias&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>día {dias}</div>}
                  {/* Síntomas activos — máx 2 */}
                  {(ep.lastSintomas||[]).slice(0,2).map(sid=>{
                    const s=SYMPTOM_ZONES.flatMap(z=>z.symptoms).find(x=>x.id===sid);
                    return s?<div key={sid} style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"rgba(255,255,255,0.5)",textAlign:"center",lineHeight:1.2,padding:"0 2px"}}>{s.label}</div>:null;
                  })}
                </>
              ):(
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.2)",textAlign:"center",marginTop:4}}>
                  {checked?"sin nov.":"tap = ok"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Episodios activos — resumen debajo de las cards */}
      {family.some(f=>getActiveEpisode(f.id))&&(
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>activos</div>
          {family.filter(f=>getActiveEpisode(f.id)).map(persona=>{
            const ep = getActiveEpisode(persona.id);
            const cfg = HAZARD_CONFIG[ep.hazardLevel||"CLEAR"]||HAZARD_CONFIG.CLEAR;
            const dias = Math.round((new Date(dateKey+"T12:00:00")-new Date(ep.startDate+"T12:00:00"))/86400000)+1;
            return(
              <div key={persona.id} style={{background:"#1a1a1a",borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
                onClick={()=>{setSelPersonId(persona.id);setView("ficha");}}>
                <span style={{fontSize:18}}>{persona.icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",fontWeight:600}}>{persona.name}</span>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:cfg.text,background:cfg.bg,border:`1px solid ${cfg.color}`,borderRadius:5,padding:"1px 6px"}}>{cfg.emoji} {cfg.label}</span>
                  </div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>
                    día {dias} · {ep.startDate}
                  </div>
                </div>
                <span style={{color:"#555",fontSize:13}}>›</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Accesos rápidos por persona */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
        {family.map(persona=>(
          <div key={persona.id} style={{display:"flex",flexDirection:"column",gap:4}}>
            <button onClick={()=>{setSelPersonId(persona.id);setView("ficha");}}
              style={{background:"transparent",border:"1px dashed #e0e0e0",borderRadius:8,padding:"6px 4px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",textAlign:"center",lineHeight:1.3}}>
              📋<br/>historial
            </button>
            <button onClick={()=>{setSelPersonId(persona.id);setView("perfil");}}
              style={{background:"transparent",border:"1px dashed #e0e0e0",borderRadius:8,padding:"6px 4px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",textAlign:"center",lineHeight:1.3}}>
              ♾️<br/>perfil
            </button>
          </div>
        ))}
      </div>

      <div style={{height:32}}/>
    </div>
  );
}



export default SaludPage;
