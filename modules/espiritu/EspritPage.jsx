import { computeStressScore, DEFAULT_HUMORS } from "../../core/stress.js";

function EspritPage({ dayData, calMarks, updateDay, kidsHealth }) {
  const fmtKey = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const today = new Date();
  const todayKey = fmtKey(today);
  const [selectedKey, setSelectedKey] = React.useState(todayKey);
  const [view, setView]     = React.useState("registro");
  const [cycleOff, setCycleOff] = React.useState(0);
  const [liteDay, setLiteDay]   = React.useState(null);
  const [showPend, setShowPend] = React.useState(false);
  const [calPickOpen, setCalPickOpen] = React.useState(false);
  const [pickMo, setPickMo]     = React.useState(()=>{ const t=new Date(); return new Date(t.getFullYear(),t.getMonth(),1); });


  const day = dayData[selectedKey] || { tasks:[], humors:[], schedule:[] };
  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const fmtShort = dk => { const [,m,d]=dk.split("-").map(Number); return `${d} ${MONTHS_ES[m-1]}`; };

  function getCycle(off=0) {
    const t = new Date();
    let baseYear = t.getFullYear(), baseMon = t.getMonth();
    if(t.getDate() < 25) baseMon -= 1;
    baseMon += off;
    while(baseMon < 0)  { baseMon += 12; baseYear--; }
    while(baseMon > 11) { baseMon -= 12; baseYear++; }
    const start = new Date(baseYear, baseMon, 25);
    let endYear = baseYear, endMon = baseMon+1;
    if(endMon > 11) { endMon = 0; endYear++; }
    const end = new Date(endYear, endMon, 24);
    const days = [];
    const cur = new Date(start);
    while(cur <= end) { days.push(fmtKey(new Date(cur))); cur.setDate(cur.getDate()+1); }
    const label = `${MONTHS_ES[endMon]} ${endYear}`;
    return { days, start, end, label };
  }
  const cycle = getCycle(cycleOff);

  function stressScore(dk){ return computeStressScore(dk, dayData, calMarks, kidsHealth); }


  const cycleData = cycle.days.map(dk=>({
    dk, stress:stressScore(dk),
    energy:dayData[dk]?.energy||0,
    concentration:dayData[dk]?.concentration||0,
    intensity:dayData[dk]?.intensity||0,
    sleep:dayData[dk]?.sleep||0,
    humors:dayData[dk]?.humors||[],
    marks:Array.isArray(calMarks[dk])?calMarks[dk]:(calMarks[dk]?[calMarks[dk]]:[]),
  }));

  const withEnergy = cycleData.filter(d=>d.energy>0);
  const withConc   = cycleData.filter(d=>d.concentration>0);
  const withSleep  = cycleData.filter(d=>d.sleep>0);
  const avgEnergy  = withEnergy.length?(withEnergy.reduce((s,d)=>s+d.energy,0)/withEnergy.length).toFixed(1):"—";
  const avgConc    = withConc.length?(withConc.reduce((s,d)=>s+d.concentration,0)/withConc.length).toFixed(1):"—";
  const avgSleep   = withSleep.length?(withSleep.reduce((s,d)=>s+d.sleep,0)/withSleep.length).toFixed(1):"—";
  const tranquilDays = cycleData.filter(d=>d.stress<=2).length;
  const stressedDays = cycleData.filter(d=>d.stress>=6).length;
  const markCounts = {};
  cycleData.forEach(d=>d.marks.forEach(m=>{ markCounts[m]=(markCounts[m]||0)+1; }));
  const withData = cycleData.filter(d=>dayData[d.dk]);
  const busiest  = [...withData].sort((a,b)=>b.stress-a.stress)[0];
  const calmest  = [...withData].sort((a,b)=>a.stress-b.stress)[0];

  function RayScale({ value, onChange, icon }) {
    return (
      <div style={{display:"flex",gap:8}}>
        {Array.from({length:5}).map((_,i)=>(
          <span key={i} onClick={()=>onChange(i+1===value?0:i+1)}
            style={{fontSize:28,cursor:"pointer",opacity:i<value?1:0.15,filter:i<value?"none":"grayscale(1)",transition:"all 0.15s",userSelect:"none"}}>
            {icon}
          </span>
        ))}
      </div>
    );
  }

  const ALL_HUMORS = [...DEFAULT_HUMORS, ...(day.humorCustom||[])];
  const curHumors  = Array.isArray(day.humors)&&day.humors.length>0?day.humors:(day.humor?[day.humor]:[]);
  const dayOptions = Array.from({length:31}).map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return fmtKey(d); });
  const score = stressScore(selectedKey);
  const SL = {fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:10};
  const SL_LIGHT = {fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:10};
  const CARD = {background:"#1a1a1a",borderRadius:12,padding:"16px",marginBottom:18,color:"#fff"};

  return (
    <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",gap:0,marginBottom:22,border:"1.5px solid #111",borderRadius:10,overflow:"hidden"}}>
        {[["registro","✍️ registro"],["wrapped","✨ wrapped"]].map(([v,label])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{flex:1,padding:"10px 0",background:view===v?"#111":"transparent",color:view===v?"#fff":"#999",
              border:"none",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Cuadro: cómo se viene el día — siempre visible ── */}
      {(()=>{
        const previewKey = view==="registro" ? selectedKey : fmtKey(new Date());
        const previewDay = dayData[previewKey] || {};
        const previewMarks = Array.isArray(calMarks[previewKey])?calMarks[previewKey]:(calMarks[previewKey]?[calMarks[previewKey]]:[]);
        const previewScore = stressScore(previewKey);
        const hasSocial = previewMarks.includes("social")||previewMarks.includes("romantic")||previewMarks.includes("colegio");
        const hasWork   = previewMarks.includes("work");
        const hasColegio= previewMarks.includes("colegio");
        const pendientes= (previewDay.tasks||[]).filter(t=>!t.done&&!t.notDone&&!t.fixed).length;
        const bloques   = (previewDay.schedule||[]).length;
        const MARK_ICONS_MAP = {work:"💼",social:"🟢",romantic:"🌸",colegio:"🎒",doctor:"🏥",gym:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="currentColor"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor"/></svg>),
          melee:(<svg width="12" height="12" viewBox="0 0 24 24"><path fillRule="evenodd" fill="rgba(255,255,255,0.7)" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>),
          pokemon:(<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><line x1="1" y1="6" x2="11" y2="6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.8" fill="rgba(255,255,255,0.7)"/></svg>),
        };
        const label = previewScore<=2?"día tranquilo":previewScore<=4?"día moderado":previewScore<=6?"día cargado":previewScore<=8?"día intenso":"día brutal";
        const barColor = previewScore<=2?"rgba(255,255,255,0.3)":previewScore<=5?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.95)";
        return (
          <div style={{background:"#111",borderRadius:12,padding:"14px 16px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase"}}>
                {view==="registro" ? fmtShort(previewKey) : "hoy"}
              </div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#fff"}}>{label}</div>
            </div>
            {/* Barra de carga */}
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:99,height:7,overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",width:`${previewScore/10*100}%`,background:barColor,borderRadius:99,transition:"width 0.3s"}}/>
            </div>
            {/* Factores */}
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:previewMarks.length>0?10:0}}>
              {pendientes>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.08)",borderRadius:6,padding:"3px 8px"}}>
                {pendientes} pendiente{pendientes!==1?"s":""}
              </span>}
              {bloques>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.08)",borderRadius:6,padding:"3px 8px"}}>
                {bloques} bloque{bloques!==1?"s":""}
              </span>}
              {hasSocial&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.7)",background:"rgba(255,255,255,0.12)",borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:4}}>
                👥 exposición social
              </span>}
            </div>
            {/* Marcadores del día */}
            {previewMarks.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {previewMarks.map(m=>(
                  <span key={m} style={{fontSize:13,background:"rgba(255,255,255,0.08)",borderRadius:6,padding:"3px 7px",display:"flex",alignItems:"center",gap:3}}>
                    {MARK_ICONS_MAP[m]||"📌"}
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)"}}>{m}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {view==="registro"&&<>
        {/* Selector de día — abre calendario */}
        <button onClick={()=>setCalPickOpen(true)}
          style={{width:"100%",border:"none",borderBottom:"2px solid #111",padding:"6px 2px",fontSize:20,
            fontFamily:"'Caveat',cursive",outline:"none",background:"transparent",cursor:"pointer",
            marginBottom:26,textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>{fmtShort(selectedKey)}{selectedKey===todayKey?" · hoy":""}</span>
          <span style={{fontSize:14,color:"#aaa"}}>📅</span>
        </button>
        {calPickOpen&&<div onClick={()=>setCalPickOpen(false)}
          style={{position:"fixed",inset:0,zIndex:1001,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:"100%",background:"#fff",borderRadius:"16px 16px 0 0",maxHeight:"70vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}}>
            <div style={{padding:"12px 20px 6px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #f0f0f0"}}>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700}}>seleccionar día</span>
              <button onClick={()=>setCalPickOpen(false)} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer"}}>×</button>
            </div>
            {(()=>{
              const MONTHS2=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
              const DOW2=["lun","mar","mié","jue","vie","sáb","dom"];
              const today=new Date();
              const yr=pickMo.getFullYear(), mo=pickMo.getMonth();
              const fd=new Date(yr,mo,1), dim=new Date(yr,mo+1,0).getDate();
              const cells=[...Array((fd.getDay()+6)%7).fill(null),...Array(dim).fill(0).map((_,i)=>new Date(yr,mo,i+1))];
              return (
                <div style={{padding:"12px 16px 24px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <button onClick={()=>setPickMo(new Date(yr,mo-1,1))} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer"}}>‹</button>
                    <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700}}>{MONTHS2[mo]} {yr}</span>
                    <button onClick={()=>setPickMo(new Date(yr,mo+1,1))} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",opacity:new Date(yr,mo+1,1)>today?0.3:1}} disabled={new Date(yr,mo+1,1)>today}>›</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
                    {DOW2.map(d=><div key={d} style={{textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>{d}</div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                    {cells.map((date,i)=>{
                      if(!date) return <div key={`e${i}`}/>;
                      const dk=fmtKey(date);
                      const isToday=date.toDateString()===today.toDateString();
                      const isSel=dk===selectedKey;
                      const isFuture=date>today;
                      return (
                        <div key={i} onClick={()=>{if(!isFuture){setSelectedKey(dk);setCalPickOpen(false);}}}
                          style={{textAlign:"center",padding:"7px 2px",borderRadius:6,cursor:isFuture?"default":"pointer",
                            background:isSel?"#111":isToday?"#f0f0f0":"transparent",
                            color:isFuture?"#ddd":isSel?"#fff":"#333",
                            fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:isSel||isToday?700:400}}>
                          {date.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>}

        <div style={{marginBottom:24}}>
          <div style={SL_LIGHT}>humor</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {ALL_HUMORS.map(h=>{
              const on=curHumors.includes(h.id);
              return (
                <button key={h.id} onClick={()=>{
                  const next=on?curHumors.filter(v=>v!==h.id):[...curHumors,h.id];
                  updateDay(selectedKey,{humors:next});
                }} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 12px",
                  borderRadius:10,border:`1.5px ${on?"solid":"dashed"} ${on?"#111":"#ddd"}`,
                  background:on?"#111":"transparent",cursor:"pointer",transition:"all 0.15s"}}>
                  <span style={{fontSize:24}}>{h.emoji}</span>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:on?"#fff":"#aaa"}}>{h.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{marginBottom:24}}>
          <div style={SL_LIGHT}>energía del día</div>
          <RayScale value={day.energy||0} icon="⚡" onChange={v=>updateDay(selectedKey,{energy:v})}/>
        </div>

        <div style={{marginBottom:24}}>
          <div style={SL_LIGHT}>concentración</div>
          <RayScale value={day.concentration||0} icon="🧠" onChange={v=>updateDay(selectedKey,{concentration:v})}/>
        </div>

        <div style={{marginBottom:24}}>
          <div style={SL_LIGHT}>horas de sueño</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {[4,5,6,7,8,9,10].map(h=>{
              const sel = (day.sleep||0)===h;
              return (
                <button key={h} onClick={()=>updateDay(selectedKey,{sleep: sel?0:h})}
                  style={{fontFamily:"'Caveat',cursive",fontSize:19,fontWeight:700,
                    padding:"5px 10px",borderRadius:8,border:"1.5px solid",cursor:"pointer",
                    background:sel?"#111":"transparent",
                    color:sel?"#fff":"#bbb",
                    borderColor:sel?"#111":"#e0e0e0",transition:"all 0.15s"}}>
                  {h}h
                </button>
              );
            })}
            {(day.sleep||0)>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",marginLeft:2}}>
              {(day.sleep||0)<6?"😵 poco sueño":(day.sleep||0)>=8?"😌 bien descansado":"😐 regular"}
            </span>}
          </div>
        </div>

        <div style={{marginBottom:24}}>
          <div style={SL_LIGHT}>intensidad del día</div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <input type="range" min={0} max={10} value={day.intensity||0}
              onChange={e=>updateDay(selectedKey,{intensity:Number(e.target.value)})}
              style={{flex:1,accentColor:"#111",cursor:"pointer"}}/>
            <span style={{fontFamily:"'Caveat',cursive",fontSize:30,fontWeight:700,minWidth:32,textAlign:"right",color:"#111"}}>
              {day.intensity||0}
            </span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#ccc"}}>calma total</span>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#ccc"}}>brutal</span>
          </div>
        </div>

        <div style={{marginBottom:24}}>
          <div style={SL_LIGHT}>cierre del día</div>
          <textarea value={day.summary||""} onChange={e=>updateDay(selectedKey,{summary:e.target.value})}
            placeholder="¿cómo fue el día? ¿qué te dejó?"
            rows={4}
            style={{width:"100%",border:"1.5px solid #e0e0e0",borderRadius:10,padding:"10px 12px",fontSize:17,
              fontFamily:"'Caveat',cursive",outline:"none",background:"#fafafa",resize:"none",
              color:"#111",lineHeight:1.7,boxSizing:"border-box",marginTop:2}}/>
        </div>

        <div style={CARD}>
          <div style={SL}>carga calculada</div>
          <div style={{display:"flex",gap:3,marginBottom:8}}>
            {Array.from({length:10}).map((_,i)=>(
              <div key={i} style={{flex:1,height:10,borderRadius:2,
                background:i<score?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.1)",transition:"background 0.2s"}}/>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"rgba(255,255,255,0.8)"}}>
              {score<=2?"día tranquilo":score<=5?"día moderado":score<=7?"día cargado":"día brutal"} · {score}/10
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
              {(()=>{
                const marks2 = Array.isArray(calMarks[selectedKey])?calMarks[selectedKey]:(calMarks[selectedKey]?[calMarks[selectedKey]]:[]);
                const mi2 = {work:"💼",social:"🟢",romantic:"🌸",colegio:"🎒",doctor:"🏥",gym:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="currentColor"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor"/></svg>),
                  melee:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="rgba(255,255,255,0.75)" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>),
                  pokemon:(<svg width="13" height="13" viewBox="0 0 12 12" style={{display:"inline-block",verticalAlign:"middle"}}><circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2"/><line x1="1" y1="6" x2="11" y2="6" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.8" fill="rgba(255,255,255,0.75)"/></svg>),
                };
                return marks2.map(m=><span key={m} style={{fontSize:14,display:"inline-flex",alignItems:"center"}}>{mi2[m]||"📌"}</span>);
              })()}
            </div>
          </div>
        </div>
      </>}

      {view==="wrapped"&&<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
          <button onClick={()=>setCycleOff(o=>o-1)}
            style={{background:"#1a1a1a",border:"none",borderRadius:10,padding:"8px 18px",
              fontFamily:"'Caveat',cursive",fontSize:22,cursor:"pointer",color:"#fff",lineHeight:1}}>‹</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:24,fontWeight:700,color:"#111"}}>{cycle.label}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa"}}>
              {fmtShort(cycle.days[0])} → {fmtShort(cycle.days[cycle.days.length-1])}
            </div>
          </div>
          <button onClick={()=>setCycleOff(o=>Math.min(0,o+1))}
            style={{background:"#1a1a1a",border:"none",borderRadius:10,padding:"8px 18px",
              fontFamily:"'Caveat',cursive",fontSize:22,cursor:"pointer",color:cycleOff>=0?"#555":"#fff",lineHeight:1}}>›</button>
        </div>

        {/* Barra de completación del ciclo */}
        {(()=>{
          const total = cycle.days.length;
          const todayKey2 = fmtKey(new Date());
          const elapsed = cycle.days.filter(dk=>dk<=todayKey2).length;
          const pct = cycleOff < 0 ? 100 : Math.round(elapsed/total*100);
          const daysLeft = cycleOff < 0 ? 0 : total - elapsed;
          return (
            <div style={{background:"#1a1a1a",borderRadius:12,padding:"14px 16px",marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase"}}>
                  completación del ciclo
                </div>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#fff"}}>{pct}%</div>
              </div>
              <div style={{background:"rgba(255,255,255,0.1)",borderRadius:99,height:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:"#fff",borderRadius:99,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:6}}>
                {cycleOff<0
                  ? `ciclo cerrado · ${total} días`
                  : daysLeft===0
                    ? "mañana llega el income 🎉"
                    : `${elapsed} de ${total} días · faltan ${daysLeft} para el income`}
              </div>
            </div>
          );
        })()}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18}}>
          {[
            {label:"días tranquilos",value:tranquilDays,icon:"🌿"},
            {label:"días intensos",  value:stressedDays,icon:"💪"},
            {label:"energía media",  value:avgEnergy,   icon:"⚡"},
            {label:"concentración",  value:avgConc,     icon:"🧠"},
            {label:"sueño medio",    value:avgSleep==="—"?avgSleep:avgSleep+"h", icon:"🌙"},
          ].map(({label,value,icon})=>(
            <div key={label} style={{background:"#1a1a1a",borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:38,fontWeight:700,lineHeight:1,color:"#fff"}}>{value}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6,letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
            </div>
          ))}
        </div>

        {Object.keys(markCounts).length>0&&<div style={CARD}>
          <div style={SL}>actividad del ciclo</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(markCounts).sort((a,b)=>b[1]-a[1]).map(([m,n])=>{
              const iconMap = {
                work:"💼", social:"🟢", romantic:"🌸", colegio:"🎒",
                doctor:"🏥",  gym:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="currentColor"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor"/></svg>),
                melee:(<svg width="14" height="14" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="rgba(255,255,255,0.7)" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>),
                pokemon:(<svg width="14" height="14" viewBox="0 0 12 12" style={{display:"inline-block",verticalAlign:"middle"}}><circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><line x1="1" y1="6" x2="11" y2="6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.8" fill="rgba(255,255,255,0.7)"/></svg>),
              };
              return (
                <div key={m} style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 12px",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,display:"flex",alignItems:"center"}}>{iconMap[m]||"📌"}</span>
                  <span style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#fff"}}>{n}</span>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)"}}>{m}</span>
                </div>
              );
            })}
          </div>
        </div>}

        {(withEnergy.length>0||withConc.length>0)&&<div style={CARD}>
          <div style={SL}>energía · concentración</div>
          <div style={{display:"flex",gap:1,alignItems:"flex-end",height:72}}>
            {cycleData.map(({dk,energy,concentration})=>(
              <div key={dk} style={{flex:1,display:"flex",flexDirection:"column",gap:1,justifyContent:"flex-end",height:"100%",position:"relative"}}>
                {energy>0&&<div style={{position:"relative",width:"100%",background:"rgba(255,255,255,0.9)",borderRadius:"2px 2px 0 0",height:`${energy/5*85}%`,minHeight:14,display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"rgba(0,0,0,0.5)",lineHeight:1,paddingTop:2,fontWeight:700}}>{energy}</span>
                </div>}
                {concentration>0&&<div style={{position:"relative",width:"100%",background:"rgba(255,255,255,0.35)",borderRadius:"2px 2px 0 0",height:`${concentration/5*85}%`,minHeight:14,display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"rgba(255,255,255,0.7)",lineHeight:1,paddingTop:2,fontWeight:700}}>{concentration}</span>
                </div>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:14,marginTop:8}}>
            {[["rgba(255,255,255,0.9)","energía (⚡)"],["rgba(255,255,255,0.35)","concentración (🧠)"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",gap:5,alignItems:"center"}}>
                <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>}

        {(()=>{
          const MARK_ICONS_LITE = {work:"💼",social:"🟢",romantic:"🌸",colegio:"🎒",doctor:"🏥",gym:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="currentColor"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor"/></svg>),melee:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="rgba(255,255,255,0.75)" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>),pokemon:(<svg width="13" height="13" viewBox="0 0 12 12" style={{display:"inline-block",verticalAlign:"middle"}}><circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2"/><line x1="1" y1="6" x2="11" y2="6" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.8" fill="rgba(255,255,255,0.75)"/></svg>)};
          return (
            <div style={CARD}>
              <div style={SL}>carga diaria</div>
              <div style={{display:"flex",gap:1,alignItems:"flex-end",height:56,cursor:"pointer"}}>
                {cycleData.map(({dk,stress})=>{
                  const isSelected = liteDay===dk;
                  return (
                    <div key={dk} onClick={()=>setLiteDay(liteDay===dk?null:dk)}
                      title={fmtShort(dk)}
                      style={{flex:1,height:`${Math.max(stress/10*100,5)}%`,minHeight:3,
                        background:isSelected?"#fff":stress<=2?"rgba(255,255,255,0.2)":stress<=5?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.9)",
                        borderRadius:"3px 3px 0 0",transition:"background 0.15s",
                        outline:isSelected?"2px solid rgba(255,255,255,0.6)":"none"}}/>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.3)"}}>{fmtShort(cycle.days[0])}</span>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.3)"}}>{fmtShort(cycle.days[cycle.days.length-1])}</span>
              </div>
              {liteDay&&(()=>{
                const ld = dayData[liteDay]||{};
                const lmarks = Array.isArray(calMarks[liteDay])?calMarks[liteDay]:(calMarks[liteDay]?[calMarks[liteDay]]:[]);
                const ls = stressScore(liteDay);
                const lhumors = (ld.humors||[]).map(hid=>[...DEFAULT_HUMORS,...(ld.humorCustom||[])].find(h=>h.id===hid)).filter(Boolean);
                const lpendTasks = (ld.tasks||[]).filter(t=>!t.done&&!t.notDone&&!t.fixed);
                const lpend = lpendTasks.length;
                const lblocks = (ld.schedule||[]).length;
                return (
                  <div style={{marginTop:10,borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff"}}>{fmtShort(liteDay)}</span>
                      <span style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"rgba(255,255,255,0.6)"}}>
                        {ls<=2?"tranquilo":ls<=5?"moderado":ls<=7?"cargado":"brutal"} · {ls}/10
                      </span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:lhumors.length>0?6:0}}>
                      {lmarks.map(m=><span key={m} style={{fontSize:14,background:"rgba(255,255,255,0.1)",borderRadius:5,padding:"2px 6px"}}>{MARK_ICONS_LITE[m]||"📌"}</span>)}
                      {lpend>0&&<span onClick={()=>setShowPend(s=>!s)}
                        style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,150,100,0.8)",background:"rgba(255,100,50,0.12)",borderRadius:5,padding:"2px 7px",cursor:"pointer",userSelect:"none"}}>
                        ⏳ {lpend} pendiente{lpend!==1?"s":""} {showPend?"▴":"▾"}
                      </span>}
                      {lblocks>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 6px"}}>{lblocks} bloques</span>}
                      {ld.energy>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 6px"}}>⚡{ld.energy}</span>}
                      {ld.concentration>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 6px"}}>🧠{ld.concentration}</span>}
                    </div>
                    {showPend&&lpendTasks.length>0&&<div style={{marginBottom:6,paddingLeft:4}}>
                      {lpendTasks.map(t=>(
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                          <div style={{width:5,height:5,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.3)",flexShrink:0}}/>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.3}}>{t.text}</span>
                          {t.carried&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,180,80,0.6)",flexShrink:0}}>arrastrada</span>}
                        </div>
                      ))}
                    </div>}
                    {lhumors.length>0&&<div style={{display:"flex",gap:4}}>{lhumors.map(h=><span key={h.id} style={{fontSize:18}}>{h.emoji}</span>)}</div>}
                    {ld.summary&&<div style={{fontFamily:"'Caveat',cursive",fontSize:14,color:"rgba(255,255,255,0.5)",marginTop:6,lineHeight:1.5,fontStyle:"italic"}}>"{ld.summary}"</div>}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {(()=>{
          const MARK_ICO = {work:"💼",social:"🟢",romantic:"🌸",colegio:"🎒",doctor:"🏥",gym:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="currentColor"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor"/></svg>),melee:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="rgba(255,255,255,0.75)" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>),pokemon:(<svg width="13" height="13" viewBox="0 0 12 12" style={{display:"inline-block",verticalAlign:"middle"}}><circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2"/><line x1="1" y1="6" x2="11" y2="6" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.8" fill="rgba(255,255,255,0.75)"/></svg>)};
          function DayHighlight({entry, label, borderOp}) {
            if(!entry) return null;
            const d = dayData[entry.dk]||{};
            const marks = Array.isArray(calMarks[entry.dk])?calMarks[entry.dk]:(calMarks[entry.dk]?[calMarks[entry.dk]]:[]);
            const pending = (d.tasks||[]).filter(t=>!t.done&&!t.notDone&&!t.fixed).length;
            const blocks = (d.schedule||[]).length;
            return (
              <div style={{...CARD,marginBottom:8,borderLeft:`3px solid rgba(255,255,255,${borderOp})`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff"}}>{label}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)"}}>{fmtShort(entry.dk)} · {entry.stress}/10</div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {marks.map(m=><span key={m} style={{fontSize:14,background:"rgba(255,255,255,0.1)",borderRadius:5,padding:"2px 6px"}}>{MARK_ICO[m]||"📌"}</span>)}
                  {pending>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 6px"}}>{pending} pendientes</span>}
                  {blocks>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 6px"}}>{blocks} bloques</span>}
                  {d.intensity>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 6px"}}>intensidad {d.intensity}/10</span>}
                </div>
              </div>
            );
          }
          return (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <DayHighlight entry={busiest} label="💪 día más intenso" borderOp="0.9"/>
              <DayHighlight entry={calmest} label="🌿 día más tranquilo" borderOp="0.3"/>
            </div>
          );
        })()}

        {/* ── Consistencia + totales ── */}
        {(()=>{
          const registeredDays = cycle.days.filter(dk=>dayData[dk]).length;
          const totalTasks = cycle.days.reduce((sum,dk)=>{
            return sum + (dayData[dk]?.tasks||[]).filter(t=>t.done).length;
          }, 0);
          const totalBlocks = cycle.days.reduce((sum,dk)=>{
            return sum + (dayData[dk]?.schedule||[]).length;
          }, 0);
          const total = cycle.days.length;
          const consPct = Math.round(registeredDays/total*100);
          return (
            <div style={CARD}>
              <div style={SL}>consistencia del ciclo</div>
              <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
                <div style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${consPct}%`,background:"rgba(255,255,255,0.7)",borderRadius:99}}/>
                </div>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff",minWidth:40,textAlign:"right"}}>{consPct}%</span>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {[
                  {icon:"📒",val:`${registeredDays} / ${total}`,label:"días con registro"},
                  {icon:"✅",val:totalTasks,label:"tareas completadas"},
                  {icon:"📦",val:totalBlocks,label:"bloques creados"},
                ].map(({icon,val,label})=>(
                  <div key={label} style={{flex:"1 1 0",minWidth:80,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:16,marginBottom:3}}>{icon}</div>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:24,fontWeight:700,color:"#fff",lineHeight:1}}>{val}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Top exposiciones ── */}
        {(()=>{
          const EXPO_MARKS = ["work","social","colegio","romantic","doctor","compras"];
          const EXPO_ICONS = {
            work:"💼", social:"🟢", colegio:"🎒", romantic:"🌸", doctor:"🏥", compras:"🛒"
          };
          const EXPO_LABELS = {
            work:"trabajo", social:"social", colegio:"colegio", romantic:"romántico", doctor:"doctor", compras:"compras"
          };
          const expos = EXPO_MARKS.map(m=>({m, n:markCounts[m]||0})).filter(e=>e.n>0).sort((a,b)=>b.n-a.n);
          if(expos.length===0) return null;
          const maxN = expos[0].n;
          const nCompras = markCounts["compras"]||0;
          const comprasDays = cycleData.filter(d=>d.marks.includes("compras"));
          const totalItems = comprasDays.reduce((s,d)=>{ const day=dayData[d.dk]; return s+(day?.compras||[]).filter(c=>c.done).length; },0);
          const promItems = comprasDays.length>0?(totalItems/comprasDays.length).toFixed(1):0;
          return (
            <>
            <div style={CARD}>
              <div style={SL}>top exposiciones</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {expos.map(({m,n})=>(
                  <div key={m} style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,width:20,textAlign:"center"}}>{EXPO_ICONS[m]}</span>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)",width:70,textTransform:"uppercase",letterSpacing:1}}>{EXPO_LABELS[m]}</span>
                    <div style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:99,height:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${n/maxN*100}%`,background:m==="compras"?"rgba(255,200,0,0.7)":"rgba(255,255,255,0.6)",borderRadius:99}}/>
                    </div>
                    <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff",minWidth:28,textAlign:"right"}}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
            {nCompras>0&&(
              <div style={CARD}>
                <div style={SL}>🛒 compras del ciclo</div>
                <div style={{display:"flex",gap:10,marginBottom:10}}>
                  <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:32,fontWeight:700,color:"#fff",lineHeight:1}}>{nCompras}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,marginTop:4}}>SALIDAS</div>
                  </div>
                  <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:32,fontWeight:700,color:"#fff",lineHeight:1}}>{promItems}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,marginTop:4}}>ITEMS / SALIDA</div>
                  </div>
                </div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>
                  {nCompras<=4?"pocas salidas — buen ritmo de compras grandes":nCompras<=8?"ritmo moderado — hay espacio para consolidar viajes":"muchas salidas — intentá hacer canastas más grandes y salir menos"}
                </div>
              </div>
            )}
            </>
          );
        })()}

        {/* ── Weekly score ── */}
        {(()=>{
          const weeks = [];
          let wk = [];
          cycle.days.forEach((dk,i)=>{
            wk.push(dk);
            if(wk.length===7||i===cycle.days.length-1){ weeks.push(wk); wk=[]; }
          });
          const wScores = weeks.map((days,wi)=>{
            const avgLoad = days.reduce((acc,dk)=>acc+stressScore(dk),0)/days.length;
            const loadFactor = Math.min(avgLoad/5, 1);
            const done = days.reduce((a,dk)=>a+(dayData[dk]?.tasks||[]).filter(t=>t.done).length,0);
            const all  = days.reduce((a,dk)=>a+(dayData[dk]?.tasks||[]).filter(t=>!t.fixed).length,0);
            const taskR = all>0?done/all:0.5;
            const taskScore = taskR*(0.6+0.4*loadFactor);
            const regDays = days.filter(dk=>dayData[dk]).length;
            const presence = days.length>0?regDays/days.length:0.5;
            const withEw = days.filter(dk=>dayData[dk]?.energy>0);
            const withCw = days.filter(dk=>dayData[dk]?.concentration>0);
            const eS = withEw.length?(withEw.reduce((a,dk)=>a+(dayData[dk]?.energy||0),0)/withEw.length)/5:null;
            const cS = withCw.length?(withCw.reduce((a,dk)=>a+(dayData[dk]?.concentration||0),0)/withCw.length)/5:null;
            const vital = (eS!==null||cS!==null)?((eS||0.5)+(cS||0.5))/2:0.5;
            const raw = Math.round(presence*45 + taskScore*35 + vital*20);
            return {wi, raw:Math.round(raw), label:`sem ${wi+1}`, days};
          });
          const maxW = Math.max(...wScores.map(w=>w.raw), 1);
          const rankLetter = r => r>=85?"S":r>=70?"A":r>=55?"B":r>=40?"C":"D";
          return (
            <div style={CARD}>
              <div style={SL}>score semanal</div>
              <div style={{display:"flex",gap:6,alignItems:"flex-end",height:56}}>
                {wScores.map(({wi,raw,label})=>(
                  <div key={wi} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end"}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:13,color:"rgba(255,255,255,0.5)"}}>{rankLetter(raw)}</div>
                    <div style={{width:"100%",background:`rgba(255,255,255,${0.2+0.7*(raw/maxW)})`,borderRadius:"3px 3px 0 0",height:`${Math.max(raw/100*80,6)}%`}}/>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Weekday patterns ── */}
        {(()=>{
          const DOW = ["lun","mar","mié","jue","vie","sáb","dom"];
          const buckets = Array.from({length:7},()=>({sum:0,count:0}));
          cycle.days.forEach(dk=>{
            const d = new Date(dk+"T12:00:00");
            const dow = (d.getDay()+6)%7; // 0=lun
            const s = stressScore(dk);
            buckets[dow].sum += s;
            buckets[dow].count++;
          });
          const avgs = buckets.map(b=>b.count?+(b.sum/b.count).toFixed(1):null);
          const valid = avgs.filter(v=>v!==null);
          if(valid.length===0) return null;
          const maxA = Math.max(...valid);
          const minA = Math.min(...valid);
          return (
            <div style={CARD}>
              <div style={SL}>patrones por día</div>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:52}}>
                {avgs.map((avg,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end"}}>
                    {avg!==null&&<div style={{width:"100%",
                      background:avg===maxA?"rgba(255,255,255,0.95)":avg===minA?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.5)",
                      borderRadius:"3px 3px 0 0",height:`${avg/maxA*80}%`,minHeight:3}}/>}
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>{DOW[i]}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>
                  más tranquilo: <span style={{color:"rgba(255,255,255,0.6)"}}>{DOW[avgs.indexOf(minA)]}</span>
                </span>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>
                  más cargado: <span style={{color:"rgba(255,255,255,0.6)"}}>{DOW[avgs.indexOf(maxA)]}</span>
                </span>
              </div>
            </div>
          );
        })()}

        {/* ── Streaks ── */}
        {(()=>{
          // Racha de registro consecutivo
          let curStreak=0, maxStreak=0, tmp=0;
          const todayKey2=fmtKey(new Date());
          [...cycle.days].reverse().forEach(dk=>{
            if(dayData[dk]){ tmp++; if(dk<=todayKey2) curStreak=Math.max(curStreak,tmp); }
            else tmp=0;
          });
          tmp=0;
          cycle.days.forEach(dk=>{ if(dayData[dk]){tmp++;maxStreak=Math.max(maxStreak,tmp);}else tmp=0; });
          // Racha gym
          let gymStreak=0,tmpG=0;
          cycle.days.forEach(dk=>{
            const marks=Array.isArray(calMarks[dk])?calMarks[dk]:(calMarks[dk]?[calMarks[dk]]:[]);
            if(marks.includes("gym")){tmpG++;gymStreak=Math.max(gymStreak,tmpG);}else tmpG=0;
          });
          return (
            <div style={CARD}>
              <div style={SL}>rachas</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[
                  {icon:"📒",label:"racha actual",val:curStreak,unit:"días"},
                  {icon:"🏆",label:"mejor racha",val:maxStreak,unit:"días"},
                  ...(gymStreak>1?[{icon:"🏋",label:"gym consecutivo",val:gymStreak,unit:"días"}]:[]),
                ].map(({icon,label,val,unit})=>(
                  <div key={label} style={{flex:"1 1 0",minWidth:80,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:28,fontWeight:700,color:"#fff",lineHeight:1}}>{val}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Balance marks ── */}
        {(()=>{
          const DEMAND = ["work","social","colegio","doctor"];
          const RECOV  = ["gym","melee","pokemon","romantic"];
          const dCount = DEMAND.reduce((s,m)=>s+(markCounts[m]||0),0);
          const rCount = RECOV.reduce((s,m)=>s+(markCounts[m]||0),0);
          const total2 = dCount+rCount;
          if(total2===0) return null;
          const dPct = Math.round(dCount/total2*100);
          const rPct = 100-dPct;
          const balanced = dPct>=35&&dPct<=65;
          const msg = dPct>70?"ciclo muy demandante — poco espacio de recuperación"
            :dPct<30?"ciclo liviano — poca demanda"
            :"buen equilibrio entre demanda y recuperación";
          return (
            <div style={CARD}>
              <div style={SL}>balance demanda · recuperación</div>
              <div style={{display:"flex",borderRadius:6,overflow:"hidden",height:10,marginBottom:12}}>
                <div style={{width:`${dPct}%`,background:"rgba(255,255,255,0.8)",transition:"width 0.4s"}}/>
                <div style={{flex:1,background:"rgba(255,255,255,0.2)"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>{dPct}%</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1}}>demanda</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.4)"}}>{rPct}%</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1}}>recuperación</div>
                </div>
              </div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.4}}>{msg}</div>
            </div>
          );
        })()}

        {/* ── RANK DEL CICLO ── */}
        {(()=>{
          const registeredDays = cycle.days.filter(dk=>dayData[dk]).length;
          const total = cycle.days.length;
          const consPct = registeredDays/total;

          // Tareas completadas relativo a la carga media del ciclo
          const allTasks   = cycle.days.reduce((s,dk)=>s+(dayData[dk]?.tasks||[]).filter(t=>!t.fixed).length,0);
          const doneTasks  = cycle.days.reduce((s,dk)=>s+(dayData[dk]?.tasks||[]).filter(t=>t.done).length,0);
          const avgLoad    = cycleData.filter(d=>d.stress>0).reduce((s,d)=>s+d.stress,0) / Math.max(cycleData.filter(d=>d.stress>0).length,1);
          // Ratio tareas ajustado por carga — hacer 3 tareas con carga 8 vale más que con carga 2
          const loadFactor = Math.min(avgLoad/5, 1); // 0-1, donde 1 = carga máxima
          const taskRaw    = allTasks>0 ? doneTasks/allTasks : 0.5;
          const taskScore  = taskRaw * (0.6 + 0.4*loadFactor); // más mérito cuando más carga

          // Presencia: consistencia de registro — lo único que depende solo de vos
          const presenceScore = consPct;

          // Vitalidad: energía y concentración registradas (si no hay datos, neutro)
          const withE = cycleData.filter(d=>d.energy>0);
          const withC = cycleData.filter(d=>d.concentration>0);
          const eScore = withE.length ? (withE.reduce((s,d)=>s+d.energy,0)/withE.length)/5 : null;
          const cScore = withC.length ? (withC.reduce((s,d)=>s+d.concentration,0)/withC.length)/5 : null;
          const vitalScore = (eScore!==null||cScore!==null)
            ? ((eScore||0.5)+(cScore||0.5))/2
            : 0.5; // neutro si no hay datos

          // Score final — ponderado, sin penalizar por estrés alto
          // Presencia 45% | Tareas ajustadas 35% | Vitalidad 20%
          const raw = (presenceScore*45 + taskScore*35 + vitalScore*20);
          const cycleScore = Math.round(raw);

          const rank = cycleScore>=85?"S":cycleScore>=70?"A":cycleScore>=55?"B":cycleScore>=40?"C":"D";
          const rankColors = {S:"#fff",A:"rgba(255,255,255,0.9)",B:"rgba(255,255,255,0.7)",C:"rgba(255,255,255,0.5)",D:"rgba(255,255,255,0.3)"};

          const MESSAGES = {
            S: avgLoad>=7
              ? `Ciclo brutal y lo sostuviste igual. Eso no es suerte.`
              : `Ciclo sólido. Presencia alta, ritmo claro.`,
            A: consPct>=0.8
              ? `Ciclo bien llevado. El registro no se cortó.`
              : `Buenas métricas. Más días de registro y sube.`,
            B: avgLoad>=6
              ? `Ciclo cargado. Que hayas seguido registrando ya es algo.`
              : `Ciclo estable. Hay margen para más consistencia.`,
            C: registeredDays<7
              ? `Pocos días registrados este ciclo. Sin datos no hay mapa.`
              : `Ciclo difícil o irregular. Algo a revisar.`,
            D: `Ciclo pesado. Pero estás acá, eso ya cuenta.`,
          };

          // Cambio 11: No mostrar rank antes del 50% del ciclo
          const todayKeyR = fmtKey(new Date());
          const elapsed = cycleOff < 0 ? total : cycle.days.filter(dk=>dk<=todayKeyR).length;
          const elapsedPct = elapsed/total;

          if(elapsedPct < 0.5 && cycleOff === 0) {
            return (
              <div style={{...CARD,textAlign:"center",padding:"24px 16px",marginBottom:8}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.35)",letterSpacing:3,textTransform:"uppercase",marginBottom:12}}>rank del ciclo</div>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>
                  ciclo en curso
                </div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:8}}>
                  {elapsed} de {total} días · disponible al 50%
                </div>
              </div>
            );
          }

          return (
            <div style={{...CARD,textAlign:"center",padding:"24px 16px",marginBottom:8}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.35)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>rank del ciclo</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:96,fontWeight:700,lineHeight:1,color:rankColors[rank],textShadow:rank==="S"?"0 0 40px rgba(255,255,255,0.4)":"none",marginBottom:4}}>
                {rank}
              </div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:20,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
                <span>presencia {Math.round(presenceScore*100)}%</span>
                <span>·</span>
                <span>tareas {Math.round(taskScore*100)}%</span>
                <span>·</span>
                <span>vitalidad {Math.round(vitalScore*100)}%</span>
              </div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"rgba(255,255,255,0.65)",lineHeight:1.5,maxWidth:280,margin:"0 auto"}}>
                {MESSAGES[rank]}
              </div>
            </div>
          );
        })()}
      </>}
    </div>
  );
}

export default EspritPage;
