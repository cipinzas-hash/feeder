const DOCTOR_KEYWORDS = ["pediatra","dentista","oftalmólogo","oftalmologo","psicólogo","psicologo","doctor","médico","medico","consulta","control médico","control medico","examen médico","examen medico","urgencia","vacuna","fonoaudiólogo","otorrino","dermatólogo","cardiólogo","neurólogo"];
function esTareaMedica(text) {
  const txt = (text||"").toLowerCase();
  return DOCTOR_KEYWORDS.some(kw => txt.includes(kw));
}
const DEFAULT_HUMORS = [
  {id:"ansioso",    emoji:"😰", label:"Ansioso"},
  {id:"tranquilo",  emoji:"😌", label:"Tranquilo"},
  {id:"chill",      emoji:"😎", label:"Chill"},
  {id:"enojado",    emoji:"😤", label:"Enojado"},
  {id:"aburrido",   emoji:"😑", label:"Aburrido"},
  {id:"estresado",  emoji:"😫", label:"Estresado"},
  {id:"triste",     emoji:"😢", label:"Triste"},
  {id:"motivado",   emoji:"🔥", label:"Motivado"},
  {id:"agotado",    emoji:"🥱", label:"Agotado"},
  {id:"contento",   emoji:"😊", label:"Contento"},
];
function computeStressScore(dk, dayData, calMarks, kidsHealth) {
  const d = dayData[dk];
  if(!d) return 0;
  const marks = Array.isArray(calMarks[dk])?calMarks[dk]:(calMarks[dk]?[calMarks[dk]]:[]);
  const kh = kidsHealth||{};

  // Modelo viejo — días anteriores al 2026-04-28
  if(dk < "2026-04-28") {
    const postponed = (d.tasks||[]).filter(t=>t.notDone).length;
    const urgent    = (d.tasks||[]).filter(t=>t.urgent).length;
    const blocks    = (d.schedule||[]).length;
    const intensity = d.intensity||0;
    let s = 0;
    s += Math.min(postponed*1.5, 3);
    s += Math.min(urgent*2, 4);
    s += Math.min(blocks*0.7, 3);
    if(marks.includes("work")&&marks.includes("colegio")) s+=3;
    else if(marks.includes("work")||marks.includes("colegio")) s+=1.5;
    if(marks.includes("doctor")) s+=1;
    if(marks.includes("social")) s+=2;
    if(marks.includes("romantic")) s+=1.5;
    if(marks.includes("colegio")) s+=1.5;
    if(marks.includes("work")&&marks.includes("social")) s+=1;
    const activeKidEps = (kh.episodes||[]).filter(e=>e.kidId!=="cristopher"&&!e.endDate&&e.startDate<=dk);
    const closedKidEps = (kh.episodes||[]).filter(e=>e.kidId!=="cristopher"&&e.endDate&&e.startDate<=dk&&e.endDate>=dk);
    const sickKids = new Set([...activeKidEps,...closedKidEps].map(e=>e.kidId)).size;
    if(sickKids>0) s+=sickKids*1.5;
    if(intensity>0) s = s*0.6 + intensity*0.4;
    return Math.min(Math.round(s), 10);
  }

  // Modelo nuevo — desde 2026-04-28
  // Usa hazardLevel del episodio activo (calculado desde síntomas) en lugar de pain
  const HAZARD_STRESS = {CLEAR:0, WATCH:1, ADVISORY:2, WARNING:3, CRITICAL:4};
  let s = 0;
  const isWorkDay = marks.includes("work");
  if(isWorkDay) {
    const wl = d.workLevel||"normal";
    if(wl==="duro") s+=4; else if(wl==="relajado") s+=2; else s+=3;
  }
  if(marks.includes("colegio")) s+=1.5;
  if(isWorkDay && marks.includes("colegio")) s+=1;
  if(marks.includes("social")) s+=1;
  if(marks.includes("romantic")) s+=0.5;
  if(marks.includes("doctor")) s+=1;
  if(marks.includes("gym")) s+=1;
  // Fix triple conteo (sesión angst-57): si una tarea urgente es médica
  // (esTareaMedica), su baliza ya no suma aparte — esa carga ya entró por
  // el marcador "doctor" (+1, arriba) y por el hazard del episodio activo
  // (abajo). Balizas de tareas NO médicas siguen sumando su +0.5 normal.
  const urgentNoMedica = (d.tasks||[]).filter(t=>t.urgent&&!t.done&&!esTareaMedica(t.text)).length;
  s += Math.min(urgentNoMedica*0.5, 2);
  if((d.compras||[]).some(c=>!c.done)) s+=0.5;
  // Episodios activos de hijos — usa hazardLevel
  const activeKidEps = (kh.episodes||[]).filter(e=>e.kidId!=="cristopher"&&!e.endDate&&e.startDate<=dk);
  activeKidEps.forEach(ep=>{
    const hz = ep.hazardLevel||"CLEAR";
    s += HAZARD_STRESS[hz]||0;
  });
  // Episodios propios de Cristopher
  const selfEps = (kh.episodes||[]).filter(e=>e.kidId==="cristopher"&&!e.endDate&&e.startDate<=dk);
  selfEps.forEach(ep=>{
    const hz = ep.hazardLevel||"CLEAR";
    s += (HAZARD_STRESS[hz]||0) * 0.7;
  });
  // Condiciones crónicas — suma base fija desde perfil
  const profiles = kh.profiles||{};
  Object.values(profiles).forEach(perfil=>{
    const n = (perfil.condicionesCronicas||[]).length;
    if(n>0) s += Math.min(n*0.3, 1);
  });
  if((d.schedule||[]).length>2 && s>3) s+=0.5;
  return Math.min(Math.round(s*10)/10, 10);
}

export { esTareaMedica, computeStressScore, DEFAULT_HUMORS, DOCTOR_KEYWORDS };
