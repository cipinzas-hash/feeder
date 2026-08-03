import { computeStressScore, DEFAULT_HUMORS } from "./stress.js";
import { requestNotifPermission } from "./notifications.js";
import { MONTH_NAMES, getHoliday, addDays, fmtFull } from "./dates.js";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

function AnalogClock({ h, m, onSave, onClose }) {
  const svgRef = useRef(null);
  const [isPM, setIsPM] = useState(h>=12);
  const [time, setTime] = useState({h:h%12,m});
  const dragging = useRef(null);
  const CX=60, CY=60;
  function pxy(a,l){const r=a*Math.PI/180;return{x:CX+Math.cos(r)*l,y:CY+Math.sin(r)*l};}
  function aH(){return((time.h%12)/12)*360+(time.m/60)*30-90;}
  function aM(){return(time.m/60)*360-90;}
  function getAngle(e){const rect=svgRef.current.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX;const cy=e.touches?e.touches[0].clientY:e.clientY;const x=(cx-rect.left)*(120/rect.width)-CX;const y=(cy-rect.top)*(120/rect.height)-CY;let a=Math.atan2(y,x)*(180/Math.PI)+90;if(a<0)a+=360;return a;}
  function onMove(e){if(!dragging.current)return;const a=getAngle(e);if(dragging.current==='h')setTime(t=>({...t,h:Math.round((a/360)*12)%12}));else setTime(t=>({...t,m:Math.round((a/360)*60)%60}));}
  useEffect(()=>{const up=()=>{dragging.current=null;};window.addEventListener('mouseup',up);window.addEventListener('touchend',up);return()=>{window.removeEventListener('mouseup',up);window.removeEventListener('touchend',up);};},[]);
  const hE=pxy(aH(),28),mE=pxy(aM(),40);
  const full24=isPM?(time.h===0?12:time.h+12):time.h;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1002,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:12,padding:"24px 28px",width:"min(94vw,340px)",display:"flex",flexDirection:"column",alignItems:"center",gap:10,boxShadow:"5px 5px 0 #111"}}>
        <div style={{fontFamily:"'Caveat',cursive",fontSize:14,color:"#999"}}>arrastra las manijas</div>
        <svg ref={svgRef} width="220" height="220" viewBox="0 0 120 120" style={{cursor:"crosshair",userSelect:"none",touchAction:"none"}} onMouseMove={onMove} onTouchMove={onMove}>
          <circle cx={CX} cy={CY} r={50} fill="#fff" stroke="#111" strokeWidth="1.5"/>
          {[...Array(12)].map((_,i)=>{const a=(i/12)*360-90;const inn=pxy(a,42);const out=pxy(a,48);return (<line key={i} x1={inn.x} y1={inn.y} x2={out.x} y2={out.y} stroke="#ccc" strokeWidth={i%3===0?1.5:0.8}/>);} )}
          <line x1={CX} y1={CY} x2={mE.x} y2={mE.y} stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx={mE.x} cy={mE.y} r={5} fill="#fff" stroke="#555" strokeWidth="1.5" style={{cursor:"grab"}} onMouseDown={e=>{e.preventDefault();dragging.current='m';}} onTouchStart={()=>{dragging.current='m';}}/>
          <line x1={CX} y1={CY} x2={hE.x} y2={hE.y} stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx={hE.x} cy={hE.y} r={6} fill="#111" style={{cursor:"grab"}} onMouseDown={e=>{e.preventDefault();dragging.current='h';}} onTouchStart={()=>{dragging.current='h';}}/>
          <circle cx={CX} cy={CY} r={3} fill="#111"/>
        </svg>
        <div style={{fontFamily:"'Caveat',cursive",fontSize:34,color:"#111",letterSpacing:2}}>{String(full24).padStart(2,"0")}:{String(time.m).padStart(2,"0")}</div>
        <div style={{display:"flex",gap:4}}>
          {["AM","PM"].map(half=><button key={half} onClick={()=>setIsPM(half==="PM")} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,letterSpacing:2,padding:"3px 12px",cursor:"pointer",borderRadius:4,background:(half==="PM")===isPM?"#111":"transparent",border:(half==="PM")===isPM?"1px solid #111":"1px dashed #ccc",color:(half==="PM")===isPM?"#fff":"#bbb"}}>{half}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,letterSpacing:2,background:"transparent",border:"1px dashed #ccc",color:"#bbb",padding:"5px 14px",cursor:"pointer",borderRadius:4}}>cancelar</button>
          <button onClick={()=>{onSave({h:full24,m:time.m});onClose();}} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,letterSpacing:2,background:"#111",border:"1px solid #111",color:"#fff",padding:"5px 14px",cursor:"pointer",borderRadius:4}}>guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Modal ───
function CalendarModal({ weekStart, marks, onMark, onWeekSelect, onClose, dayData, calMarks, kidsHealth }) {
  // Use the month that contains the most days of this week (or today if in week)
  const _initMonth = (()=>{ const today=new Date(); const wd=[...Array(7)].map((_,i)=>addDays(weekStart,i)); const inWeek=wd.some(d=>d.toDateString()===today.toDateString()); if(inWeek) return new Date(today.getFullYear(),today.getMonth(),1); const counts={}; wd.forEach(d=>{const k=d.getFullYear()+"-"+d.getMonth(); counts[k]=(counts[k]||{n:0,d:new Date(d.getFullYear(),d.getMonth(),1)}); counts[k].n++;}); return Object.values(counts).sort((a,b)=>b.n-a.n)[0].d; })();
  const [vm, setVm] = useState(_initMonth);
  const [dragY, setDragY] = useState(0);
  const [tearing, setTearing] = useState(false);
  const [activeMark, setActiveMark] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const ds = useRef(null);
  const wd = [...Array(7)].map((_,i)=>addDays(weekStart,i));
  function inW(date){return wd.some(d=>d.getDate()===date.getDate()&&d.getMonth()===date.getMonth()&&d.getFullYear()===date.getFullYear());}
  const yr=vm.getFullYear(), mo=vm.getMonth();
  const fd=new Date(yr,mo,1), dim=new Date(yr,mo+1,0).getDate();
  const cells=[...Array((fd.getDay()+1)%7).fill(null),...Array(dim).fill(0).map((_,i)=>new Date(yr,mo,i+1))];
  function isoW(d){const u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dn=u.getUTCDay()||7;u.setUTCDate(u.getUTCDate()+4-dn);const ys=new Date(Date.UTC(u.getUTCFullYear(),0,1));return Math.ceil((((u-ys)/86400000)+1)/7);}
  const wN=isoW(weekStart), wT=isoW(new Date(weekStart.getFullYear(),11,28));
  function tear(){setTearing(true);setTimeout(()=>{setVm(new Date(yr,mo-1,1));setDragY(0);setTearing(false);},300);}

  // Count days for active marker: this month and year-to-date
  function countMark(markKey) {
    const now = new Date();
    let month = 0, ytd = 0;
    Object.entries(marks).forEach(([k,v]) => {
      const d = new Date(k);
      const arr = Array.isArray(v)?v:(v?[v]:[]);
      if(!arr.includes(markKey)) return;
      if(d.getFullYear()===yr && d.getMonth()===mo) month++;
      // Compare by date string to avoid UTC/local timezone mismatch
      const todayStr = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
      if(k<=todayStr && d.getFullYear()===now.getFullYear()) ytd++;
    });
    return {month, ytd};
  }
  const markStats = activeMark ? countMark(activeMark) : null;

  const MARK_COLORS = { social:"#4caf50", romantic:"#e91e8c", work:"#5c7a99", melee:"#ff6600", pokemon:"#ffcc00", colegio:"#7b4fd4", doctor:"#e53935", medico:"#00897b", gym:"#26a69a" };
  const MARK_BG = { social:"#e8f5e9", romantic:"#fce4ec", work:"#e3eaf0", melee:"#fff3e0", pokemon:"#fffde7", colegio:"#ede7f6", doctor:"#ffebee", medico:"#e0f2f1", gym:"#e0f2f1" };
  const DOW = ["S","D","L","M","X","J","V"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:12,overflow:"hidden",boxShadow:"5px 5px 0 #111",width:"min(96vw,460px)",width:320,userSelect:"none"}}>
        <div style={{background:"#111",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>setVm(new Date(yr,mo-1,1))} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",fontWeight:700}}>‹</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>{MONTH_NAMES[mo]} {yr}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#555",letterSpacing:2,marginTop:1}}>semana {wN} de {wT}</div>
          </div>
          <button onClick={()=>setVm(new Date(yr,mo+1,1))} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",fontWeight:700}}>›</button>
        </div>
        {/* Mark tools */}
        <div style={{background:"#f9f9f9",borderBottom:"1px solid #eee",padding:"7px 12px",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:2}}>MARCAR</span>
          {[
            {k:"social",  label:"Social",    icon:<span style={{fontSize:11}}>🟢</span>},
            {k:"romantic",label:"Romántico", icon:<span style={{fontSize:11}}>🌸</span>},
            {k:"work",    label:"Trabajo",   icon:<span style={{fontSize:11}}>💼</span>},
            {k:"colegio", label:"Colegio",   icon:<span style={{fontSize:11}}>🎒</span>},
            {k:"doctor",  label:"Doctor",    icon:<span style={{fontSize:11}}>🏥</span>},
            {k:"gym",     label:"Gym",        icon:(<svg width="11" height="11" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="currentColor"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="currentColor"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor"/></svg>)},
            {k:"melee",   label:"Melee",     icon:(
              <svg width="11" height="11" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="currentColor" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>
            )},
            {k:"pokemon", label:"Pokémon",   icon:(
              <svg width="11" height="11" viewBox="0 0 12 12" style={{display:"inline-block",verticalAlign:"middle"}}>
                <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
              </svg>
            )},
          ].map(({k,label,icon})=>(
            <button key={k} onClick={()=>setActiveMark(activeMark===k?null:k)} style={{display:"flex",alignItems:"center",gap:4,fontFamily:"'Caveat',cursive",fontSize:13,padding:"3px 9px",borderRadius:20,cursor:"pointer",background:activeMark===k?MARK_COLORS[k]:"transparent",color:activeMark===k?"#fff":MARK_COLORS[k],border:`1.5px solid ${MARK_COLORS[k]}`,transition:"all 0.15s"}}>{icon} {label}</button>
          ))}
        </div>
        {activeMark && markStats && (
          <div style={{background:MARK_BG[activeMark]||"#f5f5f5",padding:"6px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #eee",flexWrap:"wrap"}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:MARK_COLORS[activeMark],fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{activeMark}</span>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",fontWeight:600}}>
              {MONTH_NAMES[mo].toLowerCase()}: <strong style={{color:MARK_COLORS[activeMark]}}>{markStats.month}</strong>
            </span>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>·</span>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",fontWeight:600}}>
              {new Date().getFullYear()} hasta hoy: <strong style={{color:MARK_COLORS[activeMark]}}>{markStats.ytd}</strong>
            </span>
          </div>
        )}
        <div
          onMouseDown={e=>{ds.current=e.clientY;}}
          onMouseMove={e=>{if(ds.current===null)return;const dy=e.clientY-ds.current;if(dy>0)setDragY(dy);}}
          onMouseUp={()=>{if(dragY>80)tear();else setDragY(0);ds.current=null;}}
          onTouchStart={e=>{ds.current=e.touches[0].clientY;}}
          onTouchMove={e=>{const dy=e.touches[0].clientY-ds.current;if(dy>0)setDragY(dy);}}
          onTouchEnd={()=>{if(dragY>80)tear();else setDragY(0);ds.current=null;}}
          style={{padding:"12px 14px 14px",transform:dragY>0?`translateY(${Math.min(dragY*0.4,40)}px) rotate(${dragY*0.02}deg)`:"none",transition:dragY===0?"transform 0.25s":"none",userSelect:"none",position:"relative"}}>
          {dragY>30&&<div style={{position:"absolute",top:4,left:"50%",transform:"translateX(-50%)",fontFamily:"'Caveat',cursive",fontSize:11,color:"#bbb"}}>↓ mes anterior</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
            {DOW.map(d=><div key={d} style={{textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1,padding:"2px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((date,i)=>{
              if(!date) return <div key={`e${i}`}/>;
              const iw=inW(date),today=new Date();
              const isT=date.getDate()===today.getDate()&&date.getMonth()===today.getMonth()&&date.getFullYear()===today.getFullYear();
              const hol=getHoliday(date),isWE=hol?.type==="weekend";
              const isCL=hol?.type==="cl"||hol?.type==="both",isUS=hol?.type==="us"||hol?.type==="both";
              const key=fmtFull(date);
              const dayMarks=Array.isArray(marks[key])?marks[key]:(marks[key]?[marks[key]]:[]);
              return (
                <div key={i} onClick={()=>{
                    if(activeMark) onMark(key,activeMark);
                    else setSelectedDay(selectedDay===key?null:key);
                  }}
                  style={{
                    textAlign:"center",padding:"5px 2px 3px",
                    fontFamily:"'DM Sans',sans-serif",fontSize:12,
                    background:(()=>{
                      if(isT && !activeMark) return "#111";
                      if(activeMark) {
                        if(dayMarks.includes(activeMark)) return MARK_COLORS[activeMark];
                        return "transparent";
                      }
                      const bg=['work','romantic','social','colegio','doctor','gym'].find(p=>dayMarks.includes(p));
                      return bg?MARK_BG[bg]:isWE?"#f5f5f5":"transparent";
                    })(),
                    color:(()=>{
                      if(activeMark) {
                        if(dayMarks.includes(activeMark)) return "#fff";
                        return isWE?"#ddd":"#ccc";
                      }
                      return isT?"#fff":iw?"#111":isWE?"#bbb":"#555";
                    })(),
                    opacity: activeMark && !dayMarks.includes(activeMark) ? 0.35 : 1,
                    borderRadius:4,
                    fontWeight: activeMark ? (dayMarks.includes(activeMark)?700:400) : (iw||isT?700:400),
                    border: activeMark
                      ? (dayMarks.includes(activeMark) ? `2px solid ${MARK_COLORS[activeMark]}` : "none")
                      : iw
                        ? (isCL?"2px solid #111":(isUS?"2px solid #111":"1.5px solid #111"))
                        : isCL
                          ? "1.5px solid #e53935"
                          : isUS
                            ? "1.5px solid #1565c0"
                            : "none",
                    outline: !activeMark && iw && isCL ? "1.5px solid #e53935"
                           : !activeMark && iw && isUS ? "1.5px solid #1565c0"
                           : "none",
                    outlineOffset: iw ? "1px" : "0",
                    position:"relative",
                    cursor:"pointer",
                    transition:"all 0.15s",
                    transform: activeMark && dayMarks.includes(activeMark) ? "scale(1.08)" : "scale(1)",
                  }}>
                  {date.getDate()}
                  <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:1,marginTop:1,width:"100%"}}>
                    {dayMarks.map((m,mi)=><div key={`${m}-${mi}`} style={{width:4,height:4,borderRadius:"50%",background:MARK_COLORS[m],flexShrink:0}}/>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10,display:"flex",gap:8,justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
            {[
              {c:"#e53935",l:"CL",type:"border"},{c:"#1565c0",l:"US",type:"border"},
              {c:"#4caf50",l:"Social"},{c:"#e91e8c",l:"Romántico"},
              {c:"#5c7a99",l:"Trabajo"},{c:"#7b4fd4",l:"Colegio"},{c:"#e53935",l:"Doctor"},{c:"#00897b",l:"Médico"},{c:"#26a69a",l:"Gym"},
              {c:"#ff6600",l:"Melee"},{c:"#ffcc00",l:"Pokémon"},
            ].map(({c,l,type})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:type==="border"?"transparent":c,border:type==="border"?`1.5px solid ${c}`:"none"}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#999",letterSpacing:1}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Day detail panel */}
        {selectedDay&&(()=>{
          const MARK_ICONS_CAL = {work:"💼",social:"🟢",romantic:"🌸",colegio:"🎒",doctor:"🏥",medico:"🏥",gym:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="#26a69a"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="#26a69a"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="#26a69a"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="#26a69a"/><rect x="20" y="9" width="3" height="6" rx="1" fill="#26a69a"/></svg>),melee:(<svg width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="#ff6600" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>),pokemon:(<svg width="13" height="13" viewBox="0 0 12 12" style={{display:"inline-block",verticalAlign:"middle"}}><circle cx="6" cy="6" r="5" fill="none" stroke="#ffcc00" strokeWidth="1.3"/><line x1="1" y1="6" x2="11" y2="6" stroke="#ffcc00" strokeWidth="1.3"/><circle cx="6" cy="6" r="1.8" fill="#ffcc00"/></svg>)};
          const sd = dayData?.[selectedDay]||{};
          const sdMarks = Array.isArray(marks[selectedDay])?marks[selectedDay]:(marks[selectedDay]?[marks[selectedDay]]:[]);
          const sdTasks = (sd.tasks||[]).filter(t=>!t.notDone);
          const doneTasks = sdTasks.filter(t=>t.done).length;
          const pendTasks = sdTasks.filter(t=>!t.done&&!t.fixed).length;
          const fixedTasks = sdTasks.filter(t=>t.fixed).length;
          const sdLoad = kidsHealth?computeStressScore(selectedDay,dayData||{},marks,kidsHealth):0;
          const [d,m,y]=selectedDay.split("-").map(Number);
          const sdDate=new Date(selectedDay+"T12:00:00");
          const DOW_ES2=["dom","lun","mar","mié","jue","vie","sáb"];
          const MONTHS2=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
          const activeKidEps=(kidsHealth?.episodes||[]).filter(e=>!e.endDate&&e.startDate<=selectedDay&&e.kidId!=="cristopher");
          return (
            <div style={{margin:"10px 16px 0",background:"#1a1a1a",borderRadius:12,padding:"14px 16px",color:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff"}}>
                  {DOW_ES2[sdDate.getDay()]} {d} {MONTHS2[m-1]}
                </div>
                <button onClick={()=>{if(onWeekSelect){onWeekSelect(sdDate);onClose();}}}
                  style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,background:"rgba(255,255,255,0.12)",border:"none",borderRadius:6,padding:"4px 10px",color:"rgba(255,255,255,0.6)",cursor:"pointer",letterSpacing:1}}>
                  ir al día →
                </button>
              </div>
              {/* Marcadores */}
              {sdMarks.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {sdMarks.map(mk=>(
                  <div key={mk} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.1)",borderRadius:6,padding:"3px 8px"}}>
                    <span style={{fontSize:13,display:"flex",alignItems:"center"}}>{MARK_ICONS_CAL[mk]||"📌"}</span>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.55)"}}>{mk}</span>
                  </div>
                ))}
              </div>}
              {/* Carga */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:99,height:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${sdLoad/10*100}%`,background:sdLoad<=2?"rgba(255,255,255,0.3)":sdLoad<=5?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.9)",borderRadius:99}}/>
                </div>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:14,color:"rgba(255,255,255,0.5)",minWidth:36}}>carga {sdLoad}</span>
              </div>
              {/* Tareas */}
              {sdTasks.length>0&&<div style={{marginBottom:8}}>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {fixedTasks>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.06)",borderRadius:5,padding:"2px 7px"}}>{fixedTasks} fija{fixedTasks!==1?"s":""}</span>}
                  {doneTasks>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.06)",borderRadius:5,padding:"2px 7px"}}>✓ {doneTasks} hecha{doneTasks!==1?"s":""}</span>}
                  {pendTasks>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,100,100,0.7)",background:"rgba(255,100,100,0.08)",borderRadius:5,padding:"2px 7px"}}>⏳ {pendTasks} pendiente{pendTasks!==1?"s":""}</span>}
                </div>
              </div>}
              {/* Salud activa */}
              {activeKidEps.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {activeKidEps.map(ep=><span key={ep.id} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,150,150,0.8)",background:"rgba(255,100,100,0.1)",borderRadius:5,padding:"2px 7px"}}>🤒 {ep.kidId} · {ep.label}</span>)}
              </div>}
              {/* Cierre */}
              {sd.summary&&<div style={{fontFamily:"'Caveat',cursive",fontSize:14,color:"rgba(255,255,255,0.4)",marginTop:8,lineHeight:1.5,fontStyle:"italic"}}>"{sd.summary}"</div>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
function EF({ value, placeholder, multiline, onSave, dark, small }) {
  const [ed, setEd] = useState(false);
  const [txt, setTxt] = useState(value);
  function commit() { onSave(txt); setEd(false); }
  const fs = small ? 13 : 15;
  const s = {width:"100%",border:dark?"1px solid #333":"1px dashed #aaa",background:dark?"#222":"#fafafa",borderRadius:6,padding:"6px 10px",fontSize:fs,fontFamily:"'DM Sans',sans-serif",color:dark?"#fff":"#111",outline:"none",resize:"none",lineHeight:1.5};
  if (ed) {
    return multiline
      ? <textarea autoFocus value={txt} rows={3} onChange={e=>setTxt(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Escape")commit();}} style={s}/>
      : <input autoFocus type="text" value={txt} onChange={e=>setTxt(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")commit();}} style={s}/>;
  }
  return (
    <div onClick={()=>{setTxt(value);setEd(true);}} style={{cursor:"pointer",fontSize:fs,lineHeight:1.5,color:value?(dark?"#ccc":"#333"):(dark?"#555":"#bbb"),fontStyle:value?"normal":"italic",padding:"6px 10px",border:dark?"1px solid #222":"1px dashed #e8e8e8",borderRadius:6,minHeight:multiline?60:38,whiteSpace:"pre-wrap",transition:"border-color 0.15s",background:dark?"#1a1a1a":"transparent"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=dark?"#555":"#aaa"}
      onMouseLeave={e=>e.currentTarget.style.borderColor=dark?"#222":"#e8e8e8"}>
      {value||placeholder}
    </div>
  );
}
function HumorSelector({ value, custom, onSave }) {
  // value is now an array of humor ids
  const vals = Array.isArray(value) ? value : (value ? [value] : []);
  const [editing, setEditing] = useState(false);
  const [newEmoji, setNewEmoji] = useState("😶");
  const [newLabel, setNewLabel] = useState("");
  const newLabelRef = React.useRef("");
  const all = [...DEFAULT_HUMORS, ...(custom||[])];
  function toggle(id) {
    const next = vals.includes(id) ? vals.filter(v=>v!==id) : [...vals, id];
    onSave(next.length>0?next:[], custom);
  }
  function addCustom() {
    const lbl = newLabelRef.current||newLabel;
    if (!lbl.trim()) return;
    const nc = [...(custom||[]), {id:"c_"+Date.now(), emoji:newEmoji, label:lbl.trim()}];
    onSave(vals, nc);
    newLabelRef.current=""; setNewEmoji("😶"); setNewLabel(""); setEditing(false);
  }
  return (
    <div className="brow">
      <div className="slbl" style={{marginBottom:8}}>Humor del día</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
        {all.map(h => {
          const on = vals.includes(h.id);
          return (
            <button key={h.id} onClick={() => toggle(h.id)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",
                borderRadius:10,border:`1.5px solid ${on?"#fff":"#333"}`,
                background:on?"#222":"transparent",cursor:"pointer",transition:"all 0.15s"}}>
              <span style={{fontSize:16,lineHeight:1}}>{h.emoji}</span>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:on?700:400,
                color:on?"#fff":"#666",letterSpacing:0.3}}>{h.label}</span>
            </button>
          );
        })}
        <button onClick={() => setEditing(e=>!e)} title="Agregar estado"
          style={{width:36,height:36,borderRadius:10,border:"1.5px dashed #333",background:"transparent",cursor:"pointer",fontSize:18,color:"#555",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
      </div>
      {editing && (
        <div style={{marginTop:8,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <input value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} style={{width:36,textAlign:"center",fontSize:18,border:"1px dashed #ddd",borderRadius:6,padding:"4px",background:"transparent",outline:"none",color:"#111"}}/>
          <input autoFocus value={newLabel} onChange={e=>{setNewLabel(e.target.value);newLabelRef.current=e.target.value;}} onKeyDown={e=>{if(e.key==="Enter")addCustom();if(e.key==="Escape")setEditing(false);}} placeholder="etiqueta..." style={{flex:1,border:"1px dashed #ddd",borderRadius:6,padding:"5px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",background:"transparent",color:"#111",outline:"none"}}/>
          <button onClick={addCustom} style={{background:"#fff",color:"#111",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>+ agregar</button>
          <button onClick={()=>setEditing(false)} style={{background:"transparent",border:"none",color:"#555",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
        </div>
      )}
    </div>
  );
}
function NotifPickerFixed({ value, onChange }) {
  // value = array of minutes (multi-select), e.g. [5, 30, 60]
  const vals = Array.isArray(value) ? value : (value!=null ? [value] : []);
  const chips = [
    [0,  "ya"],
    [5,  "5m"],
    [15, "15m"],
    [30, "30m"],
    [60, "1h"],
    [120,"2h"],
    [1440,"1d"],
  ];
  function toggle(v) {
    const next = vals.includes(v) ? vals.filter(x=>x!==v) : [...vals, v];
    onChange(next.length===0 ? null : next);
  }
  return (
    <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
      <span style={{fontSize:12,opacity:vals.length>0?1:0.3}}>🔔</span>
      {chips.map(([v,l])=>{
        const on = vals.includes(v);
        return (
          <button key={v} onClick={()=>{
            if(!on) requestNotifPermission();
            toggle(v);
          }} style={{
            background:on?"#111":"transparent",
            color:on?"#fff":"#bbb",
            border:"1px solid",
            borderColor:on?"#111":"#ddd",
            borderRadius:10,
            padding:"1px 6px",
            fontSize:10,
            cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",
            transition:"all 0.15s",
          }}>{l}</button>
        );
      })}
    </div>
  );
}
function NotifPickerUrgent({ value, onChange, onOpenClock }) {
  const parts = value ? value.split(":") : null;
  const display = parts ? `${parts[0]}:${parts[1]}` : null;
  return (
    <div style={{display:"flex",alignItems:"center",gap:4,background:value?"#fffdf0":"transparent",borderRadius:4,padding:"1px 4px",border:value?"1px dashed #ddd":"none"}}>
      <span style={{fontSize:12,opacity:value?1:0.35,cursor:"pointer"}} onClick={()=>onChange(value?null:"08:00")}>🔔</span>
      {value && (
        <span onClick={()=>onOpenClock&&onOpenClock()} style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#555",cursor:"pointer",padding:"2px 4px",borderBottom:"1px dashed #ccc"}}>
          {display}
        </span>
      )}
    </div>
  );
}
function FixedNotifBtn({ menuId, openMenu, setOpenMenu, dateKey, value, onChange }) {
  const open = openMenu===menuId;
  const vals = Array.isArray(value) ? value : (value!=null ? [value] : []);
  const chips = [[0,"ya"],[5,"5m"],[15,"15m"],[30,"30m"],[60,"1h"],[120,"2h"],[1440,"1d"]];
  const active = vals.length > 0;
  return (
    <div style={{position:"relative",display:"inline-flex"}}>
      <button onClick={()=>setOpenMenu(open?null:menuId)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:12,opacity:active?1:0.2,padding:"0 1px",lineHeight:1,transition:"opacity 0.15s"}} title="notificación">🔔</button>
      {open && (
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:400,
          background:"#fff",border:"1.5px dashed #bbb",borderRadius:8,
          padding:"6px 8px",boxShadow:"2px 2px 0 #eee",display:"flex",gap:4,flexWrap:"wrap",minWidth:160,
        }}>
          {chips.map(([v,l])=>{
            const on=vals.includes(v);
            return <button key={v} onClick={()=>{
              const next=on?vals.filter(x=>x!==v):[...vals,v];
              onChange(next.length===0?null:next);
            }} style={{
              background:on?"#111":"transparent",color:on?"#fff":"#bbb",
              border:"1px solid",borderColor:on?"#111":"#ddd",
              borderRadius:10,padding:"2px 7px",fontSize:10,cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",
            }}>{l}</button>;
          })}
          <button onClick={()=>setOpenMenu(null)} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#ccc",fontSize:14,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}
    </div>
  );
}
function FixedFreqBtn({ menuId, openMenu, setOpenMenu, value, onSetFreq, onClear }) {
  const open = openMenu===menuId;
  const active = !!value;
  const FREQ_LABELS = {daily:"diaria",every3:"día/medio",every5:"c/5d",weekly:"semanal",biweekly:"quincenal",monthly:"mensual",yearly:"anual"};
  const groups = [
    {emoji:"🔁", opts:[{k:"daily",l:"cada día"},{k:"every3",l:"día por medio"},{k:"every5",l:"cada 5 días"}]},
    {emoji:"📅", opts:[{k:"weekly",l:"semanal"},{k:"biweekly",l:"quincenal"}]},
    {emoji:"🗓️", opts:[{k:"monthly",l:"mensual"},{k:"yearly",l:"anual"}]},
  ];
  const [grp, setGrp] = React.useState(null);
  return (
    <div style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
      <button onClick={()=>{setOpenMenu(open?null:menuId);setGrp(null);}} style={{
        background:"transparent",border:"none",cursor:"pointer",fontSize:12,
        opacity:active?1:0.2,padding:"0 1px",lineHeight:1,transition:"opacity 0.15s",
      }} title="repetir">🔁</button>
      {active && <span style={{fontSize:8,color:"#bbb",marginLeft:1}}>{FREQ_LABELS[value.freq]}</span>}
      {open&&(
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:400,
          background:"#fff",border:"1.5px dashed #bbb",borderRadius:8,
          padding:"8px",boxShadow:"2px 2px 0 #eee",minWidth:150,
        }}>
          {active && <button onClick={()=>{onClear();setOpenMenu(null);}} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",color:"#e55",fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",padding:"2px 4px",marginBottom:6}}>× quitar repetición</button>}
          <div style={{display:"flex",gap:4,marginBottom:grp?6:0}}>
            {groups.map((g,i)=>(
              <button key={i} onClick={()=>setGrp(grp===i?null:i)} style={{
                flex:1,padding:"5px",fontSize:15,border:"1.5px solid",cursor:"pointer",borderRadius:6,
                borderColor:grp===i?"#111":"#eee",background:grp===i?"#111":"#fafafa",
              }}>{g.emoji}</button>
            ))}
          </div>
          {grp!==null && groups[grp].opts.map(o=>(
            <button key={o.k} onClick={()=>{onSetFreq(o.k);setOpenMenu(null);setGrp(null);}} style={{
              display:"block",width:"100%",textAlign:"left",padding:"5px 8px",
              border:"none",borderBottom:"1px solid #f5f5f5",background:value?.freq===o.k?"#f0f0f0":"#fff",
              fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",cursor:"pointer",
            }}>{o.l}</button>
          ))}
        </div>
      )}
    </div>
  );
}
function RecurringCreator({ dateKey, onSave }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [group, setGroup] = React.useState(null); // null | "daily" | "weekly" | "long"
  const [freq, setFreq] = React.useState(null);

  const groups = {
    daily: { emoji:"🔁", label:"ritmo diario", opts:[
      {k:"daily",  l:"cada día"},
      {k:"every3", l:"día por medio"},
      {k:"every5", l:"cada 5 días"},
    ]},
    weekly: { emoji:"📅", label:"ritmo semanal", opts:[
      {k:"weekly",   l:"una vez a la semana"},
      {k:"biweekly", l:"cada dos semanas"},
    ]},
    long: { emoji:"🗓️", label:"ciclo largo", opts:[
      {k:"monthly", l:"una vez al mes"},
      {k:"yearly",  l:"una vez al año"},
    ]},
  };

  function save() {
    if(!text.trim()||!freq) return;
    onSave({id:Date.now().toString(), text:text.trim(), freq, createdAt:dateKey});
    setText(""); setGroup(null); setFreq(null); setOpen(false);
  }

  if(!open) return (
    <button onClick={()=>setOpen(true)}
      style={{background:"transparent",border:"none",color:"#555",fontSize:13,cursor:"pointer",padding:"0 4px",lineHeight:1}}
      title="tarea recurrente">🔁</button>
  );

  return (
    <div onClick={e=>e.stopPropagation()} style={{
      position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:300,
      background:"#fff",border:"2px dashed #111",borderRadius:10,
      width:"min(90vw,260px)",padding:"10px 12px",boxShadow:"3px 3px 0 #eee",
    }}>
      <input autoFocus value={text} onChange={e=>setText(e.target.value)}
        onKeyDown={e=>e.key==="Escape"&&setOpen(false)}
        placeholder="nombre de la tarea..."
        style={{width:"100%",border:"1px dashed #ddd",borderRadius:6,padding:"6px 8px",
          fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box",marginBottom:8}}/>
      <div style={{display:"flex",gap:6,marginBottom:group?8:0}}>
        {Object.entries(groups).map(([k,g])=>(
          <button key={k} onClick={()=>{setGroup(group===k?null:k);setFreq(null);}} style={{
            flex:1,padding:"6px 4px",fontSize:16,border:"1.5px solid",cursor:"pointer",borderRadius:8,
            borderColor:group===k?"#111":"#eee",
            background:group===k?"#111":"#fafafa",
            transition:"all 0.15s",
          }} title={g.label}>{g.emoji}</button>
        ))}
      </div>
      {group && (
        <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:8}}>
          {groups[group].opts.map(o=>(
            <button key={o.k} onClick={()=>setFreq(o.k)} style={{
              padding:"6px 10px",textAlign:"left",border:"1px solid",cursor:"pointer",borderRadius:6,
              borderColor:freq===o.k?"#111":"#eee",
              background:freq===o.k?"#111":"#fff",
              color:freq===o.k?"#fff":"#555",
              fontFamily:"'DM Sans',sans-serif",fontSize:12,
              transition:"all 0.12s",
            }}>{o.l}</button>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
        <button onClick={()=>setOpen(false)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,color:"#aaa",fontFamily:"'DM Sans',sans-serif"}}>cancelar</button>
        <button onClick={save} disabled={!text.trim()||!freq} style={{
          background:text.trim()&&freq?"#111":"#eee",color:text.trim()&&freq?"#fff":"#bbb",
          border:"none",borderRadius:6,padding:"5px 12px",cursor:text.trim()&&freq?"pointer":"default",
          fontSize:12,fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s",
        }}>+ crear</button>
      </div>
    </div>
  );
}
function ModeMenu({ value, opts, placeholder, accent, onSelect, onAddOpt, compact }) {
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [newOpt, setNewOpt] = React.useState("");
  const active = value && value !== "";
  // In compact mode: show only emoji placeholder + active label shortened
  const label = compact
    ? (active ? value.split(" ").slice(0,2).join(" ") : placeholder)
    : (active ? value : placeholder);
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        fontFamily:"'DM Sans',sans-serif",fontSize:compact?12:14,
        background:active ? accent : "transparent",
        color: active ? "#fff" : "#aaa",
        border:`1.5px ${active?"solid":"dashed"} ${active?accent:"#ccc"}`,
        borderRadius:20,padding:compact?"3px 8px":"4px 10px",cursor:"pointer",
        display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap",
        transition:"all 0.15s",maxWidth:compact?120:200,overflow:"hidden",
      }}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
        <span style={{fontSize:8,opacity:0.6,flexShrink:0}}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:200,
          background:"#fff",border:"1.5px dashed #bbb",borderRadius:10,
          minWidth:160,boxShadow:"3px 3px 0 #eee",overflow:"hidden",
        }}>
          {opts.map(opt => (
            <button key={opt} onClick={()=>{onSelect(opt===value?"":opt);setOpen(false);}} style={{
              display:"block",width:"100%",textAlign:"left",
              padding:"8px 12px",border:"none",borderBottom:"1px solid #f0f0f0",
              background:opt===value?"#f5f5f5":"#fff",
              fontFamily:"'DM Sans',sans-serif",fontSize:13,
              color:opt===value?"#111":"#555",cursor:"pointer",
            }}>{opt===value?"✓ ":""}{opt}</button>
          ))}
          {adding
            ? <div style={{display:"flex",padding:"6px 8px",gap:4}}>
                <input autoFocus value={newOpt} onChange={e=>setNewOpt(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&newOpt.trim()){onAddOpt(newOpt.trim());onSelect(newOpt.trim());setAdding(false);setNewOpt("");setOpen(false);}if(e.key==="Escape")setAdding(false);}}
                  style={{flex:1,border:"1px dashed #ccc",borderRadius:6,padding:"3px 6px",fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:"none"}}
                  placeholder="nueva opción..."/>
                <button onClick={()=>{if(newOpt.trim()){onAddOpt(newOpt.trim());onSelect(newOpt.trim());setAdding(false);setNewOpt("");setOpen(false);}}} style={{background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:12}}>+</button>
              </div>
            : <button onClick={()=>setAdding(true)} style={{display:"block",width:"100%",textAlign:"left",padding:"7px 12px",border:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#bbb",cursor:"pointer"}}>+ agregar opción</button>
          }
        </div>
      )}
    </div>
  );
}
function ComprasModal({ items, onSave, onClose, onMoveToNext }) {
  const [list, setList] = React.useState(items||[]);
  const [newItem, setNewItem] = React.useState("");
  const [heldIdx, setHeldIdx] = React.useState(null);
  const [dragTarget, setDragTarget] = React.useState(null);
  const holdTimer = React.useRef(null);
  const touchStartX = React.useRef(0);
  const touchStartY = React.useRef(0);
  // Save on every change
  function update(newList) { setList(newList); onSave(newList); }
  function add(){if(!newItem.trim())return;update([...list,{id:Date.now().toString(),text:newItem.trim(),done:false}]);setNewItem("");}
  function toggle(id){if(heldIdx!==null)return;update(list.map(i=>i.id===id?{...i,done:!i.done}:i));}
  function del(id){update(list.filter(i=>i.id!==id));}
  function close(){ onClose(); }
  return (
    <div onClick={close} style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:12,width:"min(95vw,400px)",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:"#111",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>🛒 Compras</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>update(list.filter(i=>!i.done))} style={{background:"transparent",border:"1px dashed #555",borderRadius:8,color:"#aaa",fontSize:11,padding:"3px 8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>limpiar ✓</button>
            <button onClick={close} style={{background:"transparent",border:"none",color:"#aaa",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 14px"}}>
          {list.length===0&&<div style={{color:"#ccc",fontFamily:"'DM Sans',sans-serif",fontSize:13,textAlign:"center",padding:"20px 0"}}>lista vacía</div>}
          {list.map((item,idx)=>{
            const isHeld = heldIdx===idx;
            const showDropLine = dragTarget===idx && heldIdx!==null && heldIdx!==idx;
            return <React.Fragment key={item.id}>
            {showDropLine && <div style={{height:2,background:"#111",borderRadius:1,margin:"2px 0",transition:"opacity 0.1s"}}/>}
            <div key={item.id+"_row"}
              onTouchStart={e=>{
                holdTimer.current=setTimeout(()=>setHeldIdx(idx),350);
                touchStartX.current=e.touches[0].clientX;
                touchStartY.current=e.touches[0].clientY;
              }}
              onTouchMove={e=>{
                const dx=e.touches[0].clientX-touchStartX.current;
                const dy=e.touches[0].clientY-touchStartY.current;
                if(heldIdx===idx && Math.abs(dy)>10){
                  // drag vertically - find target by position
                  const els=[...e.currentTarget.parentNode.children];
                  const my=e.touches[0].clientY;
                  let ti=els.findIndex(el=>{const r=el.getBoundingClientRect();return my>=r.top&&my<=r.bottom;});
                  if(ti>=0&&ti!==idx) setDragTarget(ti);
                } else if(dx>5){
                  clearTimeout(holdTimer.current);
                }
              }}
              onTouchEnd={e=>{
                clearTimeout(holdTimer.current);
                const dx=e.changedTouches[0].clientX-touchStartX.current;
                if(heldIdx===idx){
                  if(dragTarget!==null&&dragTarget!==idx){
                    const next=[...list];const[m]=next.splice(idx,1);next.splice(dragTarget,0,m);
                    update(next);
                  } else if(dx>60){
                    // swipe right → move to next day's compras
                    onMoveToNext(item);
                    update(list.filter(i=>i.id!==item.id));
                  }
                }
                setHeldIdx(null);setDragTarget(null);
              }}
              style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",
                borderBottom:`1px solid ${isHeld?"#111":"#f5f5f5"}`,
                background:isHeld?"#111":(dragTarget===idx?"#f0f0f0":"transparent"),
                borderRadius:isHeld?6:0,
                transition:"background 0.15s",userSelect:"none",touchAction:"pan-x"}}>
              <span style={{color:isHeld?"#fff":"#ccc",fontSize:12,padding:"0 2px"}}>⠿</span>
              <div onClick={()=>toggle(item.id)} style={{width:18,height:18,borderRadius:4,border:`1.5px dashed ${item.done?"#111":"#bbb"}`,background:item.done?"#111":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                {item.done&&<span style={{color:"#fff",fontSize:12,lineHeight:1}}>✓</span>}
              </div>
              <div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:14,color:item.done?"#bbb":"#333",textDecoration:item.done?"line-through":"none"}}>{item.text}</div>
              <button onClick={e=>{e.stopPropagation();if(!heldIdx)del(item.id);}} style={{background:"transparent",border:"none",color:isHeld?"#555":"#ddd",fontSize:15,cursor:"pointer",padding:"0 2px"}}>×</button>
            </div>
            </React.Fragment>;
          })}
        </div>
        <div style={{padding:"10px 14px",borderTop:"1px solid #f0f0f0",display:"flex",gap:6}}>
          <input value={newItem} onChange={e=>setNewItem(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")add();}}
            placeholder="agregar ítem..."
            style={{flex:1,border:"1px dashed #ddd",borderRadius:8,padding:"8px 10px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
          <button onClick={add} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:16}}>+</button>
        </div>
      </div>
    </div>
  );
}

function SearchModal({ dayData, nutria, kidsHealth, routines, onClose }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all"); // all | tareas | cierres | comida | compras | salud | rutinas | ventas
  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const fmtKey = dk => { const [,m,d]=dk.split("-").map(Number); return `${d} ${MONTHS_ES[m-1]}`; };
  const DOW_ES = ["dom","lun","mar","mié","jue","vie","sáb"];

  const results = React.useMemo(() => {
    if(!q.trim()) return [];
    const norm = q.toLowerCase().trim();
    const hits = [];
    // Tareas, cierres, comida, compras
    Object.keys(dayData).sort().reverse().forEach(dk => {
      const day = dayData[dk];
      if(cat==="all"||cat==="tareas") {
        (day.tasks||[]).forEach(t => {
          if((t.text||"").toLowerCase().includes(norm))
            hits.push({ dk, type:"tarea", task:t });
        });
      }
      if(cat==="all"||cat==="cierres") {
        if((day.summary||"").toLowerCase().includes(norm))
          hits.push({ dk, type:"cierre", text:day.summary });
      }
      if(cat==="all"||cat==="comida") {
        if((day.menu||"").toLowerCase().includes(norm))
          hits.push({ dk, type:"comida", text:day.menu });
        if((day.abasto||"").toLowerCase().includes(norm))
          hits.push({ dk, type:"abasto", text:day.abasto });
      }
      if(cat==="all"||cat==="compras") {
        (day.compras||[]).forEach(c => {
          if((c.name||c.text||"").toLowerCase().includes(norm))
            hits.push({ dk, type:"compra", item:c });
        });
      }
    });
    // Salud — schema nuevo: kidsHealth.episodes[]
    if(cat==="all"||cat==="salud") {
      const familyNames = Object.fromEntries((kidsHealth?.family||[]).map(f=>[f.id,f.name]));
      (kidsHealth?.episodes||[]).forEach(ep => {
        const hayMatch =
          (ep.hazardLevel||"").toLowerCase().includes(norm) ||
          (ep.notas||"").toLowerCase().includes(norm) ||
          (ep.lastSintomas||[]).some(sid=>sid.toLowerCase().includes(norm)) ||
          (ep.days||[]).some(d=>(d.nota||"").toLowerCase().includes(norm)||(d.temperatura||"").includes(norm));
        if(hayMatch) hits.push({ type:"salud", persona:familyNames[ep.kidId]||ep.kidId, ep });
      });
    }
    // Rutinas
    if(cat==="all"||cat==="rutinas") {
      (routines||[]).forEach(r => {
        const hayMatch =
          (r.name||"").toLowerCase().includes(norm) ||
          (r.steps||[]).some(s=>(s.name||"").toLowerCase().includes(norm));
        if(hayMatch) hits.push({ type:"rutina", rutina:r });
      });
    }
    // Ventas/emprendimientos
    if(cat==="all"||cat==="ventas") {
      (nutria?.ventas||[]).forEach(v => {
        const hayMatch =
          (v.producto||"").toLowerCase().includes(norm) ||
          (v.nombre_tapa||"").toLowerCase().includes(norm) ||
          (v.diseno||"").toLowerCase().includes(norm) ||
          (v.tipo_agenda||"").toLowerCase().includes(norm);
        if(hayMatch) hits.push({ type:"venta", venta:v });
      });
    }
    return hits;
  }, [q, cat, dayData, kidsHealth, routines, nutria]);

  React.useEffect(() => {
    const esc = e => { if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const CATS = [
    {id:"all",label:"Todo"},
    {id:"tareas",label:"Tareas"},
    {id:"cierres",label:"Cierres"},
    {id:"comida",label:"Comida"},
    {id:"compras",label:"Compras"},
    {id:"salud",label:"Salud"},
    {id:"rutinas",label:"Rutinas"},
    {id:"ventas",label:"Ventas"},
  ];

  const typeColors = {tarea:"#111",cierre:"#5c7a99",comida:"#2e7d52",abasto:"#2e7d52",compra:"#795548",salud:"#e53935",rutina:"#7b4fd4",venta:"#00897b"};
  const typeLabels = {tarea:"tarea",cierre:"cierre",comida:"menú",abasto:"abasto",compra:"compra",salud:"salud",rutina:"rutina",venta:"venta"};

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",alignItems:"center",paddingTop:60}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",display:"flex",flexDirection:"column",maxHeight:"82vh"}}>
        <div style={{padding:"16px 16px 0",borderBottom:"1px solid #f0f0f0"}}>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
            placeholder="buscar en todo..."
            style={{width:"100%",border:"none",fontSize:18,fontFamily:"'Caveat',cursive",outline:"none",padding:"4px 0 10px",boxSizing:"border-box",color:"#111"}}/>
          <div style={{display:"flex",gap:6,paddingBottom:10,overflowX:"auto"}}>
            {CATS.map(c=>(
              <button key={c.id} onClick={()=>setCat(c.id)}
                style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"4px 10px",borderRadius:99,
                  border:"1.5px solid",cursor:"pointer",flexShrink:0,transition:"all 0.12s",
                  background:cat===c.id?"#111":"transparent",
                  color:cat===c.id?"#fff":"#888",
                  borderColor:cat===c.id?"#111":"#e0e0e0"}}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {q.trim()&&results.length===0&&(
            <div style={{padding:"32px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:17,color:"#ccc"}}>sin resultados</div>
          )}
          {q.trim()&&results.length>0&&(
            <div style={{padding:"8px 16px 4px",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>
              {results.length} resultado{results.length!==1?"s":""}
            </div>
          )}
          {results.map((hit, i) => {
            const color = typeColors[hit.type]||"#111";
            const label = typeLabels[hit.type]||hit.type;
            let mainText = "";
            let meta = null;
            if(hit.dk) {
              const d = new Date(hit.dk+"T12:00:00");
              meta = <div style={{fontFamily:"'Caveat',cursive",fontSize:13,color:"#aaa",minWidth:64,paddingTop:2,flexShrink:0}}>{DOW_ES[d.getDay()]} {fmtKey(hit.dk)}</div>;
            }
            if(hit.task) mainText = hit.task.text||"";
            else if(hit.text) mainText = hit.text;
            else if(hit.item) mainText = hit.item.name||hit.item.text||"";
            else if(hit.type==="salud") mainText = `${hit.persona} — ${hit.ep.hazardLevel||"episodio"} · ${hit.ep.startDate||""}`;
            else if(hit.type==="rutina") mainText = hit.rutina.name||"";
            else if(hit.type==="venta") mainText = `${hit.venta.producto||""}${hit.venta.nombre_tapa?" / "+hit.venta.nombre_tapa:""}`;
            return (
              <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid #f8f8f8",display:"flex",gap:10,alignItems:"flex-start"}}>
                {meta||<div style={{minWidth:64}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#fff",background:color,borderRadius:4,padding:"1px 5px",letterSpacing:0.5,textTransform:"uppercase",flexShrink:0}}>{label}</span>
                    {hit.type==="tarea"&&hit.task?.done&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#aaa",background:"#f0f0f0",borderRadius:4,padding:"1px 5px"}}>hecha</span>}
                    {hit.type==="tarea"&&hit.task?.notDone&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#e55",background:"#fff0f0",borderRadius:4,padding:"1px 5px"}}>no hecha</span>}
                    {hit.type==="tarea"&&hit.task?.carried&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#f90",background:"#fff8f0",borderRadius:4,padding:"1px 5px"}}>arrastrada</span>}
                    {hit.type==="venta"&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#555",background:"#f0f0f0",borderRadius:4,padding:"1px 5px"}}>{hit.venta.emprendimiento}</span>}
                  </div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:hit.task?.done?"#bbb":"#111",textDecoration:hit.task?.done?"line-through":"none",lineHeight:1.4,wordBreak:"break-word"}}>
                    {mainText}
                  </div>
                  {hit.type==="venta"&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",marginTop:2}}>{hit.venta.tamano&&`${hit.venta.tamano} · `}{hit.venta.precio?`$${hit.venta.precio.toLocaleString("es-CL")}`:""}</div>}
                  {hit.type==="rutina"&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",marginTop:2}}>{(hit.rutina.steps||[]).length} pasos</div>}
                </div>
              </div>
            );
          })}
          {!q.trim()&&(
            <div style={{padding:"32px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:17,color:"#ddd"}}>escribe para buscar</div>
          )}
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid #f0f0f0",textAlign:"right"}}>
          <button onClick={onClose} style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,background:"transparent",border:"1px dashed #ddd",borderRadius:6,padding:"6px 16px",cursor:"pointer",color:"#999",letterSpacing:1}}>cerrar</button>
        </div>
      </div>
    </div>
  );
}
function ScheduleModal({ dateKey, day, isWork, isColegio, onSave, onClose, onNavigate }) {
  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const DOW_ES = ["dom","lun","mar","mié","jue","vie","sáb"];
  const fmtDate = dk => { const [,m,d]=dk.split("-").map(Number); const dt=new Date(dk+"T12:00:00"); return `${DOW_ES[dt.getDay()]} ${d} ${MONTHS_ES[m-1]}`; };
  const addDaysKey = (dk, n) => { const d=new Date(dk+"T12:00:00"); d.setDate(d.getDate()+n); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

  const PX_PER_MIN = 0.65;
  const START_HOUR = 5;
  const END_HOUR   = 23;
  const totalHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;

  function toMin(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
  function topPx(t){ return (toMin(t)-START_HOUR*60)*PX_PER_MIN; }
  function heightPx(s,e){ return Math.max((toMin(e)-toMin(s))*PX_PER_MIN, 16); }

  const PRESET_COLORS = [
    "#111","#222","#1a3a5c","#2d4a2d","#5c7a99","#2e7d52",
    "#8b4e8e","#7b4fd4","#a05c20","#c0392b","#7a3a3a","#e91e8c",
    "#00695c","#0288d1","#f57c00","#5d4037","#37474f","#1b5e20",
  ];

  const SYSTEM_BLOCKS = [
    {id:"s-morning",  name:"mañana",          start:"05:15", end:"06:30", color:"#1a1a2e", dashed:false},
    {id:"s-work",     name:"trabajo",          start:"07:30", end:"12:30", color:"#0a1628", dashed:false, onlyIf:"work"},
    {id:"s-transport1",name:"transporte →",   start:"07:00", end:"07:30", color:"#111",   dashed:true,  onlyIf:"work"},
    {id:"s-transport2",name:"← transporte",   start:"12:30", end:"13:00", color:"#111",   dashed:true,  onlyIf:"work"},
    {id:"s-colegio1", name:"llevar niños",    start:"07:30", end:"08:00", color:"#1a0f2e", dashed:true, onlyIf:"colegio"},
    {id:"s-colegio2", name:"buscar niños",    start:"15:30", end:"16:00", color:"#1a0f2e", dashed:true, onlyIf:"colegio"},
    {id:"s-plan",     name:"planear y registrar", start:"21:30", end:"22:30", color:"#1a1a1a", dashed:false},
  ];

  const schedule = day.schedule || [];
  const [selectedBlock, setSelectedBlock] = React.useState(null);
  const [newColor, setNewColor] = React.useState(PRESET_COLORS[4]);
  const [addingBlock, setAddingBlock] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newStart, setNewStart] = React.useState("09:00");
  const [newEnd,   setNewEnd]   = React.useState("10:00");

  const deadlineTasks = (day.tasks||[]).filter(t=>t.deadline&&!t.done&&!t.notDone);

  const systemBlocks = SYSTEM_BLOCKS.filter(b=>{
    if(b.onlyIf==="work") return isWork;
    if(b.onlyIf==="colegio") return isColegio;
    return true;
  });

  function addBlock() {
    if(!newLabel.trim()) return;
    const id = Date.now().toString();
    const next = [...schedule, {id, label:newLabel.trim(), start:newStart, end:newEnd, color:newColor, steps:[]}];
    onSave(next);
    setNewLabel(""); setAddingBlock(false);
  }

  function deleteBlock(id) {
    onSave(schedule.filter(b=>b.id!==id));
    if(selectedBlock===id) setSelectedBlock(null);
  }

  // Now line
  const now = new Date();
  const nowMin = now.getHours()*60+now.getMinutes();
  const nowTop = (nowMin - START_HOUR*60)*PX_PER_MIN;
  const showNow = nowTop>=0 && nowTop<=totalHeight;

  const HOURS = Array.from({length:24},(_,i)=>i);
  const MINS = [0,15,30,45];

  const today = new Date().toISOString().slice(0,10);
  const isToday = dateKey === today;

  return (
    <div onClick={()=>{ setSelectedBlock(null); onClose(); }}
      style={{position:"fixed",inset:0,zIndex:1001,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()}
        style={{width:"100%",background:"#fff",borderRadius:"16px 16px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.3)"}}>

        {/* Header */}
        <div style={{padding:"14px 20px 10px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>onNavigate(addDaysKey(dateKey,-1))} style={{background:"transparent",border:"none",color:"#bbb",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>‹</button>
            <div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111"}}>{fmtDate(dateKey)}</div>
              <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                {isWork&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#5c7a99",background:"#e3eaf0",borderRadius:4,padding:"1px 6px"}}>💼 embajada</span>}
                {isColegio&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#7b4fd4",background:"#ede7f6",borderRadius:4,padding:"1px 6px"}}>🎒 colegio</span>}
              </div>
            </div>
            <button onClick={()=>onNavigate(addDaysKey(dateKey,1))} style={{background:"transparent",border:"none",color:"#bbb",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>›</button>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setAddingBlock(a=>!a)}
              style={{background:"#111",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",
                fontFamily:"'Caveat',cursive",fontSize:15,color:"#fff"}}>+ bloque</button>
            <button onClick={onClose} style={{background:"transparent",border:"none",color:"#bbb",fontSize:22,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
          </div>
        </div>

        {/* Add block form */}
        {addingBlock&&<div style={{padding:"10px 20px",background:"#fafafa",borderBottom:"1px solid #f0f0f0",flexShrink:0}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
              autoFocus placeholder="nombre del bloque"
              onKeyDown={e=>{ if(e.key==="Enter") addBlock(); if(e.key==="Escape") setAddingBlock(false); }}
              style={{flex:1,minWidth:120,border:"1px dashed #ddd",borderRadius:6,padding:"6px 10px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"#fff"}}/>
            <select value={newStart} onChange={e=>setNewStart(e.target.value)}
              style={{border:"1px dashed #ddd",borderRadius:6,padding:"5px 6px",fontSize:12,fontFamily:"'DM Sans',sans-serif",background:"#fff",outline:"none"}}>
              {HOURS.map(h=>MINS.map(m=>{const t=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");return <option key={t} value={t}>{t}</option>;})).flat()}
            </select>
            <span style={{color:"#ccc",fontSize:11}}>→</span>
            <select value={newEnd} onChange={e=>setNewEnd(e.target.value)}
              style={{border:"1px dashed #ddd",borderRadius:6,padding:"5px 6px",fontSize:12,fontFamily:"'DM Sans',sans-serif",background:"#fff",outline:"none"}}>
              {HOURS.map(h=>MINS.map(m=>{const t=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");return <option key={t} value={t}>{t}</option>;})).flat()}
            </select>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
            {PRESET_COLORS.map(c=>(
              <button key={c} onClick={()=>setNewColor(c)}
                style={{width:22,height:22,borderRadius:4,background:c,border:newColor===c?"2px solid #111":"1.5px solid transparent",cursor:"pointer",flexShrink:0}}/>
            ))}
            <button onClick={addBlock} disabled={!newLabel.trim()}
              style={{marginLeft:"auto",background:"#111",border:"none",borderRadius:6,padding:"6px 16px",cursor:newLabel.trim()?"pointer":"default",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#fff",fontWeight:600,opacity:newLabel.trim()?1:0.4}}>
              agregar
            </button>
          </div>
        </div>}

        {/* Timeline */}
        <div style={{overflowY:"auto",flex:1,position:"relative"}} onClick={()=>setSelectedBlock(null)}>
          <div style={{display:"flex",minHeight:totalHeight+40}}>

            {/* Hour labels */}
            <div style={{width:36,flexShrink:0,position:"relative",borderRight:"1px solid #f0f0f0"}}>
              {Array.from({length:END_HOUR-START_HOUR+1},(_,i)=>START_HOUR+i).map(h=>(
                <div key={h} style={{position:"absolute",top:(h-START_HOUR)*60*PX_PER_MIN-8,left:0,right:0,
                  textAlign:"right",paddingRight:6,fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#ccc",userSelect:"none"}}>
                  {String(h).padStart(2,"0")}
                </div>
              ))}
            </div>

            {/* Blocks area */}
            <div style={{flex:1,position:"relative",paddingLeft:4}}>
              {/* Hour tick lines */}
              {Array.from({length:END_HOUR-START_HOUR+1},(_,i)=>START_HOUR+i).map(h=>(
                <div key={h} style={{position:"absolute",top:(h-START_HOUR)*60*PX_PER_MIN,left:0,right:0,
                  borderTop:"1px solid #f5f5f5",pointerEvents:"none"}}/>
              ))}
              {/* 30-min ticks */}
              {Array.from({length:(END_HOUR-START_HOUR)*2},(_,i)=>i).map(i=>(
                <div key={i} style={{position:"absolute",top:i*30*PX_PER_MIN,left:0,width:8,
                  borderTop:"1px solid #f0f0f0",pointerEvents:"none"}}/>
              ))}

              {/* System blocks */}
              {systemBlocks.map(b=>{
                const h = heightPx(b.start,b.end);
                const compact = h < 50;
                return (
                  <div key={b.id} style={{
                    position:"absolute",top:topPx(b.start),left:2,right:2,height:h,
                    background:b.color,borderRadius:4,
                    border:b.dashed?"1.5px dashed #555":"none",
                    display:"flex",alignItems:"center",paddingLeft:10,paddingRight:6,
                    overflow:"hidden",gap:6,zIndex:1,
                  }}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:compact?14:17,color:"#fff",fontWeight:700,lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:compact?"0 1 auto":1}}>{b.name}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",whiteSpace:"nowrap",flexShrink:0}}>{b.start} – {b.end}</div>
                  </div>
                );
              })}

              {/* User blocks */}
              {schedule.map(b=>{
                const isSelected = selectedBlock===b.id;
                const bh = heightPx(b.start||"09:00", b.end||"10:00");
                const compact = bh < 50;
                return (
                  <div key={b.id} onClick={e=>{e.stopPropagation();setSelectedBlock(isSelected?null:b.id);}}
                    style={{
                      position:"absolute",
                      top:topPx(b.start||"09:00"),left:2,right:2,height:bh,
                      background:b.color||b.label&&"#5c7a99"||"#5c7a99",
                      borderRadius:4,
                      border:isSelected?"1.5px solid #fff":"1.5px dashed rgba(255,255,255,0.3)",
                      display:"flex",flexDirection:"column",justifyContent:"flex-start",
                      paddingLeft:8,paddingRight:4,paddingTop:compact?0:4,
                      cursor:"pointer",overflow:"hidden",
                      boxShadow:isSelected?"0 0 0 2px rgba(255,255,255,0.3)":"none",
                      transition:"box-shadow 0.15s",
                      alignItems:compact?"center":"flex-start",
                      zIndex:2,
                    }}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:compact?6:0,flexDirection:compact?"row":"column",flex:1,minWidth:0,
                        alignItems:compact?"center":"flex-start"}}>
                        <div style={{fontFamily:"'Caveat',cursive",fontSize:compact?14:16,color:"#fff",fontWeight:700,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.label||b.name||"bloque"}</div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.55)",whiteSpace:"nowrap",flexShrink:0}}>{b.start} – {b.end}</div>
                      </div>
                    </div>
                    {!compact&&(b.steps||[]).slice(0,2).map((s,si)=>(
                      <div key={s.id||si} style={{display:"flex",alignItems:"center",gap:4,marginTop:2,paddingLeft:2}}>
                        <div style={{width:4,height:4,borderRadius:"50%",background:"rgba(255,255,255,0.5)",flexShrink:0}}/>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.75)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Deadline task pins */}
              {deadlineTasks.map(t=>{
                const tStr = String(t.deadline.h).padStart(2,"0")+":"+String(t.deadline.m).padStart(2,"0");
                const top = topPx(tStr);
                if(top<0||top>totalHeight) return null;
                return (
                  <div key={t.id} style={{position:"absolute",left:0,right:0,top,zIndex:8,display:"flex",alignItems:"center",gap:4,paddingLeft:4}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:t.urgent?"#ff3b30":"#888",flexShrink:0}}/>
                    <div style={{background:t.urgent?"rgba(255,59,48,0.12)":"rgba(0,0,0,0.06)",borderRadius:4,padding:"1px 6px",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:t.urgent?"#ff3b30":"#666",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"80%"}}>
                      {tStr} · {t.text}
                    </div>
                  </div>
                );
              })}

              {/* Now line */}
              {isToday&&showNow&&(
                <div style={{position:"absolute",top:nowTop,left:0,right:0,zIndex:9,pointerEvents:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#ff3b30",flexShrink:0,marginLeft:-4}}/>
                    <div style={{flex:1,height:1.5,background:"#ff3b30",opacity:0.7}}/>
                  </div>
                </div>
              )}

              <div style={{height:40}}/>
            </div>
          </div>
        </div>

        {/* Block popup */}
        {(()=>{
          const b = selectedBlock ? schedule.find(bl=>bl.id===selectedBlock) : null;
          if(!b) return null;
          const color = b.color||"#5c7a99";
          return (
            <div onClick={e=>e.stopPropagation()} style={{
              position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
              width:"min(96vw,420px)",zIndex:2200,
              background:color,borderRadius:"16px 16px 0 0",
              boxShadow:"0 -4px 32px rgba(0,0,0,0.4)",
              maxHeight:"55vh",display:"flex",flexDirection:"column",overflow:"hidden",
            }}>
              <div style={{display:"flex",justifyContent:"center",padding:"8px 0 4px"}}>
                <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.3)"}}/>
              </div>
              <div style={{padding:"6px 16px 10px",display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#fff",fontWeight:700,lineHeight:1.1}}>{b.label||b.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.55)"}}>{b.start} – {b.end}</div>
                </div>
                <button onClick={()=>setSelectedBlock(null)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
              </div>
              <div style={{overflowY:"auto",flex:1,padding:"0 16px 12px"}}>
                {(b.steps||[]).length===0&&(
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.35)",paddingBottom:8}}>sin pasos aún</div>
                )}
                {(b.steps||[]).map((s,si)=>(
                  <div key={s.id||si} style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.1)",marginBottom:10}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.6)",flexShrink:0}}/>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"rgba(255,255,255,0.9)",flex:1}}>{s.name}</span>
                    <button onClick={()=>{
                      const next=schedule.map(bl=>bl.id===b.id?{...bl,steps:(bl.steps||[]).filter((_,i)=>i!==si)}:bl);
                      onSave(next);
                    }} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",fontSize:14,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:6,alignItems:"center",paddingTop:4}}>
                  <div style={{width:6,height:6,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.4)",flexShrink:0}}/>
                  <input
                    placeholder="+ agregar paso..."
                    onKeyDown={e=>{
                      if(e.key==="Enter"&&e.target.value.trim()){
                        const step={id:Date.now().toString(),name:e.target.value.trim()};
                        onSave(schedule.map(bl=>bl.id===b.id?{...bl,steps:[...(bl.steps||[]),step]}:bl));
                        e.target.value="";
                      }
                    }}
                    style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.3)",padding:"4px 0",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",color:"rgba(255,255,255,0.8)"}}
                  />
                </div>
              </div>
              <div style={{padding:"10px 16px 24px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
                <button onClick={()=>{deleteBlock(b.id);setSelectedBlock(null);}}
                  style={{background:"rgba(0,0,0,0.2)",border:"none",borderRadius:8,padding:"8px 16px",color:"rgba(255,255,255,0.6)",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer",width:"100%"}}>
                  eliminar bloque
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
export { AnalogClock, CalendarModal, EF, HumorSelector, NotifPickerFixed, NotifPickerUrgent, FixedNotifBtn, FixedFreqBtn, RecurringCreator, ModeMenu, ComprasModal, SearchModal, ScheduleModal };
