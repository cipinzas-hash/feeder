function FadimanPage({ data, saveData }) {
  const today = new Date().toISOString().slice(0,10);
  const [view, setView] = React.useState("home");
  const [logDate, setLogDate] = React.useState(today);
  const [showSetup, setShowSetup] = React.useState(false);
  const [setupDate, setSetupDate] = React.useState(today);

  const cfg = data?.fadiman || null;
  const logs = data?.fadimanLogs || {};

  function save(updates) { saveData({ ...data, ...updates }); }

  function initProtocol(startDate) {
    save({ fadiman: { startDate, active: true }, fadimanLogs: {} });
    setShowSetup(false);
    setView("home");
  }

  function getDayType(dateKey) {
    if(!cfg?.startDate) return null;
    const base = new Date(cfg.startDate+"T12:00:00");
    const d    = new Date(dateKey+"T12:00:00");
    const diff = Math.round((d - base) / 86400000);
    if(diff < 0) return null;
    const endDate = new Date(cfg.startDate+"T12:00:00");
    endDate.setDate(endDate.getDate() + 60);
    if(d > endDate) return "done";
    return diff % 3 === 0 ? "dose" : "rest";
  }

  function getDoseDays() {
    if(!cfg?.startDate) return [];
    const days = [];
    const base = new Date(cfg.startDate+"T12:00:00");
    for(let i=0; i<=60; i+=3) {
      const d = new Date(base); d.setDate(d.getDate()+i);
      days.push(d.toISOString().slice(0,10));
    }
    return days;
  }

  function saveLog(dateKey, field, val) {
    const newLogs = { ...logs, [dateKey]: { ...(logs[dateKey]||{}), [field]: val } };
    save({ fadimanLogs: newLogs });
  }

  function fmt(dk) { if(!dk) return ""; const [y,m,d]=dk.split("-").map(Number); const MES=["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]; return `${d} ${MES[m]}`; }

  const MES_LABELS = { estado:"Estado de ánimo", energia:"Energía", foco:"Foco / concentración", sueno:"Calidad sueño", sensaciones:"Sensaciones físicas", notas:"Notas" };
  const SCALE_FIELDS = ["estado","energia","foco","sueno"];
  const TEXT_FIELDS = ["sensaciones","notas"];

  const doseDays = getDoseDays();
  const upcomingDoses = doseDays.filter(d=>d>=today);
  const pastDoses = doseDays.filter(d=>d<today).reverse();
  const dayType = getDayType(today);
  const todayLog = logs[today] || {};
  const daysRemaining = cfg?.startDate ? Math.max(0, 60 - Math.round((new Date()-new Date(cfg.startDate+"T12:00:00"))/86400000)) : null;

  // ── SETUP ──
  if(showSetup || !cfg) return (
    <div style={{background:"#0d0d0d",minHeight:"100vh",color:"#fff",padding:"24px 16px"}}>
      <div style={{fontFamily:"'Caveat',cursive",fontSize:28,color:"#fff",fontWeight:700,marginBottom:8}}>🍄 protocolo fadiman</div>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",marginBottom:24,lineHeight:1.6}}>
        1 día dosis · 2 días descanso · repite por 60 días<br/>el inicio debe ser un sábado
      </div>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#444",letterSpacing:1,marginBottom:8}}>FECHA DE INICIO (sábado)</div>
      <input type="date" value={setupDate} onChange={e=>setSetupDate(e.target.value)}
        style={{fontFamily:"'DM Sans',sans-serif",fontSize:16,background:"#1a1a1a",border:"1px dashed #333",color:"#fff",borderRadius:8,padding:"10px 14px",outline:"none",display:"block",marginBottom:24}}/>
      {(()=>{const d=new Date(setupDate+"T12:00:00");const issat=d.getDay()===6;return(<>
        {!issat&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#e53935",marginBottom:12}}>elige un sábado</div>}
        <button onClick={()=>issat&&initProtocol(setupDate)} style={{background:issat?"#fff":"#2a2a2a",color:issat?"#111":"#555",border:"none",borderRadius:8,padding:"12px 24px",cursor:issat?"pointer":"default",fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700}}>
          iniciar protocolo
        </button>
      </>);})()}
      {cfg&&<button onClick={()=>setShowSetup(false)} style={{background:"transparent",border:"none",color:"#555",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer",marginTop:16,display:"block"}}>cancelar</button>}
    </div>
  );

  // ── LOG VIEW ──
  if(view==="log") {
    const dt = getDayType(logDate);
    const lg = logs[logDate] || {};
    return (
      <div style={{background:"#0d0d0d",minHeight:"100vh",color:"#fff"}}>
        <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #1a1a1a"}}>
          <button onClick={()=>setView("home")} style={{background:"transparent",border:"none",color:"#555",fontSize:20,cursor:"pointer",padding:0}}>←</button>
          <div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>{fmt(logDate)}</div>
            {dt==="dose"&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aac756",letterSpacing:1}}>DÍA DE DOSIS</div>}
          </div>
          <input type="date" value={logDate} onChange={e=>setLogDate(e.target.value)}
            style={{marginLeft:"auto",fontFamily:"'DM Sans',sans-serif",fontSize:11,background:"#1a1a1a",border:"1px dashed #333",color:"#666",borderRadius:6,padding:"4px 8px",outline:"none"}}/>
        </div>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
          {dt==="dose"&&(
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#1a2200",border:"1px solid #aac756",borderRadius:8,padding:"12px 14px"}}>
              <span style={{fontSize:20}}>🍄</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aac756"}}>dosis tomada</div>
              </div>
              <button onClick={()=>saveLog(logDate,"dosed",!(lg.dosed))} style={{background:lg.dosed?"#aac756":"transparent",border:`1px dashed #aac756`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:lg.dosed?"#111":"#aac756"}}>
                {lg.dosed?"✓ sí":"marcar"}
              </button>
            </div>
          )}
          {SCALE_FIELDS.map(f=>(
            <div key={f}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#444",letterSpacing:1,marginBottom:6}}>{MES_LABELS[f].toUpperCase()}</div>
              <div style={{display:"flex",gap:4}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>saveLog(logDate,f,n===(lg[f]||0)?0:n)}
                    style={{flex:1,background:(lg[f]||0)>=n?"#fff":"#1a1a1a",border:`1px dashed ${(lg[f]||0)>=n?"#fff":"#333"}`,borderRadius:6,padding:"8px 4px",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:18,color:(lg[f]||0)>=n?"#111":"#555",transition:"all 0.15s"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {TEXT_FIELDS.map(f=>(
            <div key={f}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#444",letterSpacing:1,marginBottom:6}}>{MES_LABELS[f].toUpperCase()}</div>
              <textarea value={lg[f]||""} onChange={e=>saveLog(logDate,f,e.target.value)}
                placeholder={f==="sensaciones"?"tensión, ligereza, temperatura...":"observaciones del día..."}
                style={{width:"100%",fontFamily:"'DM Sans',sans-serif",fontSize:13,background:"#1a1a1a",border:"1px dashed #333",color:"#ccc",borderRadius:8,padding:"10px 12px",outline:"none",boxSizing:"border-box",resize:"vertical",minHeight:70}}/>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── HOME VIEW ──
  return (
    <div style={{background:"#0d0d0d",minHeight:"100vh",color:"#fff"}}>
      <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1a1a1a"}}>
        <div>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#fff",fontWeight:700}}>🍄 fadiman</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#444"}}>inicio: {fmt(cfg.startDate)} · {daysRemaining>0?`${daysRemaining} días restantes`:"completado"}</div>
        </div>
        <button onClick={()=>setShowSetup(true)} style={{background:"transparent",border:"1px dashed #333",color:"#555",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:10}}>reiniciar</button>
      </div>

      {/* Hoy */}
      {dayType==="dose"&&(
        <div style={{margin:"14px 16px 0",background:"#1a2200",border:"1px solid #aac756",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🍄</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#aac756",fontWeight:700}}>hoy es día de dosis</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555"}}>registrá cómo fue el día</div>
          </div>
          <button onClick={()=>{setLogDate(today);setView("log");}} style={{background:"#aac756",color:"#111",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:15,fontWeight:700}}>registrar</button>
        </div>
      )}

      {/* Próximas dosis */}
      <div style={{padding:"14px 16px"}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#444",letterSpacing:1,marginBottom:10}}>PRÓXIMAS DOSIS</div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {upcomingDoses.slice(0,8).map(d=>{
            const lg=logs[d]||{};
            const isTod=d===today;
            return (
              <div key={d} onClick={()=>{setLogDate(d);setView("log");}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isTod?"#1a2200":"#111",border:isTod?"1px solid #aac756":"1px dashed #1a1a1a",borderRadius:8,cursor:"pointer"}}>
                <span style={{fontSize:16}}>🍄</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:17,color:isTod?"#aac756":"#fff",fontWeight:700}}>{fmt(d)}{isTod?" — hoy":""}</div>
                </div>
                {lg.dosed&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aac756"}}>✓</span>}
                <div style={{display:"flex",gap:3}}>
                  {["estado","energia","foco","sueno"].map(f=>lg[f]?<div key={f} style={{width:4,height:4,borderRadius:"50%",background:"#aac756"}}/>:<div key={f} style={{width:4,height:4,borderRadius:"50%",background:"#2a2a2a"}}/>)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Historial */}
        {pastDoses.length>0&&(
          <div style={{marginTop:20}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#333",letterSpacing:1,marginBottom:10}}>HISTORIAL</div>
            {pastDoses.slice(0,10).map(d=>{
              const lg=logs[d]||{};
              const avg=["estado","energia","foco","sueno"].filter(f=>lg[f]).reduce((s,f,_,arr)=>s+lg[f]/arr.length,0);
              return (
                <div key={d} onClick={()=>{setLogDate(d);setView("log");}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#111",borderRadius:6,marginBottom:3,cursor:"pointer",opacity:0.7}}>
                  <span style={{fontSize:14}}>🍄</span>
                  <span style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"#888",flex:1}}>{fmt(d)}</span>
                  {avg>0&&<span style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#aac756",fontWeight:700}}>{avg.toFixed(1)}</span>}
                  {lg.dosed&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#555"}}>✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FadimanPage;
