const { useState, useEffect, useRef, useMemo, useCallback } = React;

function fmtTimer(secs) {
  const m = Math.floor(secs/60), s = secs%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ─── Routines ───────────────────────────────────────────────────────────────

function RoutinesPage({ routines, onSave, onAddToDay }) {
  const [view, setView]           = useState("list");   // "list" | "edit" | "run"
  const [activeId, setActiveId]   = useState(null);
  const [editName, setEditName]   = useState("");
  const [editSteps, setEditSteps] = useState([]);
  const [editEmoji, setEditEmoji] = useState("⚡");
  const [dragIdx, setDragIdx]     = useState(null);
  const [overIdx, setOverIdx]     = useState(null);

  // Execution state
  const [runStep,  setRunStep]    = useState(0);
  const [runSecs,  setRunSecs]    = useState(0);
  const [running,  setRunning]    = useState(false);
  const timerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const swipeRef = useRef({x:0, swiping:false});

  async function acquireWakeLock() {
    try {
      if("wakeLock" in navigator && wakeLockRef.current===null) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", ()=>{ wakeLockRef.current=null; });
      }
    } catch(e) { console.warn("WakeLock:", e); }
  }
  function releaseWakeLock() {
    if(wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current=null; }
  }

  // Re-acquire if page becomes visible again (browser auto-releases on hide)
  useEffect(()=>{
    function onVisible(){ if(view==="run"&&running) acquireWakeLock(); }
    document.addEventListener("visibilitychange", onVisible);
    return ()=>document.removeEventListener("visibilitychange", onVisible);
  }, [view, running]);

  // Swipe gesture
  function onTouchStart(e){ swipeRef.current = {x:e.touches[0].clientX, swiping:true}; }
  function onTouchEnd(e){
    if(!swipeRef.current.swiping) return;
    const dx = e.changedTouches[0].clientX - swipeRef.current.x;
    swipeRef.current.swiping = false;
    if(dx > 60) completeStep();
    if(dx < -60) pauseRun();
  }

  function activeRoutine() { return routines.find(r=>r.id===activeId)||null; }

  // ── Start / Resume ──
  function startRoutine(r) {
    setActiveId(r.id);
    const step = r.runState?.step ?? 0;
    const secs = r.runState?.secs ?? (r.steps[step]?.duration || 60);
    setRunStep(step);
    setRunSecs(secs);
    setRunning(true);
    setView("run");
    acquireWakeLock();
    // Notify at step start (now)
    const stepAtStart = r.runState?.step ?? 0;
    scheduleRoutineStepNotif(r, stepAtStart+1, Date.now() + ((r.steps[stepAtStart]?.duration||60)*1000));
  }

  function pauseRun() {
    setRunning(false);
    const r = activeRoutine();
    if(!r) return;
    const updated = routines.map(rt => rt.id===r.id
      ? {...rt, runState:{step:runStep, secs:runSecs}}
      : rt);
    onSave(updated);
  }

  function resumeRun() { setRunning(true); }

  function completeStep() {
    const r = activeRoutine();
    if(!r) return;
    const nextStep = runStep + 1;
    if(nextStep >= r.steps.length) {
      // Rutina terminada
      const updated = routines.map(rt => rt.id===r.id ? {...rt, runState:null} : rt);
      onSave(updated);
      setRunning(false);
      releaseWakeLock();
      setView("list");
      return;
    }
    setRunStep(nextStep);
    setRunSecs(r.steps[nextStep]?.duration || 60);
    setRunning(true);
    // Schedule notif for the step after next
    scheduleRoutineStepNotif(r, nextStep+1, Date.now() + ((r.steps[nextStep]?.duration||60)*1000));
  }

  function exitRun() {
    pauseRun();
    releaseWakeLock();
    setView("list");
  }

  // Ticker
  useEffect(()=>{
    if(running && view==="run") {
      timerRef.current = setInterval(()=>{
        setRunSecs(s => {
          if(s <= 1) { completeStep(); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return ()=>clearInterval(timerRef.current);
  }, [running, view, runStep]);

  // ── Edit ──
  function newRoutine() {
    setActiveId(null);
    setEditName("");
    setEditEmoji("⚡");
    setEditSteps([{id:Date.now().toString(), name:"", duration:300}]);
    setView("edit");
  }

  function editRoutine(r) {
    setActiveId(r.id);
    setEditName(r.name);
    setEditEmoji(r.emoji||"⚡");
    setEditSteps(r.steps.map(s=>({...s})));
    setView("edit");
  }

  function addStep() {
    setEditSteps(s=>[...s, {id:Date.now().toString(), name:"", duration:300}]);
  }

  function updateStep(id, field, val) {
    setEditSteps(s=>s.map(st=>st.id===id?{...st,[field]:val}:st));
  }

  function removeStep(id) {
    setEditSteps(s=>s.filter(st=>st.id!==id));
  }

  function saveRoutine() {
    if(!editName.trim() || editSteps.length===0) return;
    const steps = editSteps.filter(s=>s.name.trim()).map(s=>({
      ...s, duration: Math.max(5, parseInt(s.duration)||60)
    }));
    if(activeId) {
      onSave(routines.map(r=>r.id===activeId ? {...r, name:editName.trim(), emoji:editEmoji, steps} : r));
    } else {
      onSave([...routines, {id:Date.now().toString(), name:editName.trim(), emoji:editEmoji, steps, runState:null}]);
    }
    setView("list");
  }

  function deleteRoutine(id) {
    onSave(routines.filter(r=>r.id!==id));
  }

  // Drag-to-reorder
  function onDragStart(i){ setDragIdx(i); }
  function onDragOver(e,i){ e.preventDefault(); setOverIdx(i); }
  function onDrop(){
    if(dragIdx===null || overIdx===null || dragIdx===overIdx) { setDragIdx(null);setOverIdx(null); return; }
    const next = [...editSteps];
    const [moved] = next.splice(dragIdx,1);
    next.splice(overIdx,0,moved);
    setEditSteps(next);
    setDragIdx(null); setOverIdx(null);
  }

  const inp = {border:"1px dashed #ddd",borderRadius:4,padding:"6px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fafafa",outline:"none",boxSizing:"border-box"};

  // ── RUN VIEW ──
  if(view==="run") {
    const r = activeRoutine();
    if(!r) return null;
    const step = r.steps[runStep];
    const total = step?.duration || 60;
    const pct = Math.max(0, Math.min(100, (runSecs/total)*100));
    return (
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{position:"fixed",inset:0,background:"#0a0a0a",zIndex:999,display:"flex",flexDirection:"column",userSelect:"none"}}>
        {/* Header */}
        <div style={{padding:"20px 20px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={exitRun} style={{background:"transparent",border:"none",color:"#555",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",letterSpacing:1}}>✕ salir</button>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#444",letterSpacing:2,textTransform:"uppercase"}}>{r.emoji||"⚡"} {r.name.toLowerCase()}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#444"}}>{runStep+1}/{r.steps.length}</div>
        </div>
        {/* Step progress dots */}
        <div style={{display:"flex",gap:4,padding:"0 20px 24px",justifyContent:"center"}}>
          {r.steps.map((_,i)=>(
            <div key={i} style={{height:3,borderRadius:2,flex:1,background:i<runStep?"#fff":i===runStep?"#fff":"#333",transition:"background 0.3s"}}/>
          ))}
        </div>
        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:13,color:"#555",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>paso actual</div>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:36,color:"#fff",fontWeight:700,textAlign:"center",lineHeight:1.2,marginBottom:40}}>{step?.name}</div>
          {/* Timer ring */}
          <div style={{position:"relative",width:160,height:160,marginBottom:40}}>
            <svg width="160" height="160" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
              <circle cx="80" cy="80" r="70" fill="none" stroke="#1a1a1a" strokeWidth="6"/>
              <circle cx="80" cy="80" r="70" fill="none" stroke={running?"#fff":"#444"} strokeWidth="6"
                strokeDasharray={`${2*Math.PI*70}`}
                strokeDashoffset={`${2*Math.PI*70*(1-pct/100)}`}
                strokeLinecap="round"
                style={{transition:"stroke-dashoffset 0.9s linear,stroke 0.3s"}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:38,color:"#fff",fontWeight:700,letterSpacing:-1}}>{fmtTimer(runSecs)}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#555",letterSpacing:2}}>{running?"EN CURSO":"PAUSADO"}</div>
            </div>
          </div>
          {/* Controls */}
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <button onClick={running?pauseRun:resumeRun}
              style={{width:56,height:56,borderRadius:"50%",background:"#1a1a1a",border:"1px dashed #333",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {running?"⏸":"▶"}
            </button>
            <button onClick={completeStep}
              style={{width:72,height:72,borderRadius:"50%",background:"#fff",border:"none",color:"#111",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
              <span style={{fontSize:18}}>›</span>
              <span style={{fontSize:9}}>LISTO</span>
            </button>
          </div>
          <button onClick={()=>{setRunStep(0);setRunSecs(r.steps[0]?.duration||60);setRunning(false);const updated=routines.map(rt=>rt.id===r.id?{...rt,runState:null}:rt);onSave(updated);}}
            style={{marginTop:16,background:"transparent",border:"1px dashed #333",borderRadius:20,padding:"7px 24px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",letterSpacing:2}}>
            REINICIAR
          </button>
        </div>
        {/* Swipe hint */}
        <div style={{padding:"16px",textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#333",letterSpacing:2}}>
          SWIPE → PARA COMPLETAR PASO
        </div>
      </div>
    );
  }

  // ── EDIT VIEW ──
  if(view==="edit") {
    return (
      <div style={{padding:"16px",maxWidth:600,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setView("list")} style={{background:"transparent",border:"none",color:"#999",fontSize:20,cursor:"pointer",lineHeight:1}}>‹</button>
<input value={editEmoji} onChange={e=>setEditEmoji(e.target.value)} style={{...inp,width:44,fontSize:20,textAlign:"center",background:"transparent",border:"none",borderBottom:"1px dashed #ccc",borderRadius:0,padding:"4px 0"}}/>
          <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nombre de la rutina"
            style={{...inp,flex:1,fontSize:17,fontFamily:"'Caveat',cursive",fontWeight:700,background:"transparent",border:"none",borderBottom:"1px dashed #ccc",borderRadius:0,padding:"4px 0"}}/>
        </div>
        <div style={{marginBottom:8,fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:2,textTransform:"uppercase"}}>Pasos — arrastra para reordenar</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
          {editSteps.map((step,i)=>(
            <div key={step.id} draggable
              onDragStart={()=>onDragStart(i)}
              onDragOver={e=>onDragOver(e,i)}
              onDrop={onDrop}
              style={{display:"flex",gap:8,alignItems:"center",padding:"10px 12px",background:overIdx===i?"#f5f5f5":"#fafafa",border:"1px dashed #eee",borderRadius:8,cursor:"grab",transition:"background 0.15s",opacity:dragIdx===i?0.4:1}}>
              <span style={{color:"#ddd",fontSize:16,cursor:"grab",flexShrink:0}}>⠿</span>
              <input value={step.name} onChange={e=>updateStep(step.id,"name",e.target.value)}
                placeholder={`Paso ${i+1}`} style={{...inp,flex:1,background:"transparent",border:"none",borderBottom:"1px dashed #eee",borderRadius:0,padding:"2px 0",fontSize:13}}/>
              {/* Duration selector */}
              <select value={step.duration} onChange={e=>updateStep(step.id,"duration",parseInt(e.target.value))}
                style={{...inp,width:90,padding:"4px 6px",fontSize:12,background:"#fff"}}>
                {[[30,"30 seg"],[60,"1 min"],[120,"2 min"],[180,"3 min"],[300,"5 min"],[600,"10 min"],[900,"15 min"],[1200,"20 min"],[1800,"30 min"],[2700,"45 min"],[3600,"1 hora"]].map(([v,l])=>(
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button onClick={()=>removeStep(step.id)} style={{background:"transparent",border:"none",color:"#ddd",fontSize:16,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addStep} style={{width:"100%",background:"transparent",border:"1px dashed #ccc",borderRadius:8,padding:"9px",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:15,color:"#bbb",marginBottom:20}}>+ agregar paso</button>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setView("list")} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:6,padding:"7px 18px",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#999"}}>cancelar</button>
          <button onClick={saveRoutine} style={{background:"#111",border:"none",borderRadius:6,padding:"7px 22px",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#fff",fontWeight:600}}>guardar</button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div style={{padding:"16px",maxWidth:600,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#111",fontWeight:700}}>⏱️ rutinas</div>
        <button onClick={newRoutine} style={{background:"#111",border:"none",borderRadius:20,padding:"6px 18px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#fff",fontWeight:600}}>+ nueva</button>
      </div>
      {routines.length===0?(
        <div style={{padding:"48px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:17,color:"#ddd"}}>sin rutinas aún</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {routines.map(r=>{
            const hasState = r.runState != null;
            const totalMins = Math.round(r.steps.reduce((s,st)=>s+st.duration,0)/60);
            return (
              <div key={r.id} style={{border:"1px dashed #eee",borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:19,color:"#111",fontWeight:700}}>{r.emoji||"⚡"} {r.name}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",marginTop:2}}>
                      {r.steps.length} pasos · {totalMins} min
                      {hasState&&<span style={{color:"#888",marginLeft:8,fontStyle:"italic"}}>◌ pausada en paso {(r.runState.step||0)+1}</span>}
                    </div>
                  </div>
                  <button onClick={()=>editRoutine(r)} style={{background:"transparent",border:"none",color:"#ccc",fontSize:15,cursor:"pointer",padding:"4px 8px"}}>✎</button>
                  <button onClick={()=>deleteRoutine(r.id)} style={{background:"transparent",border:"none",color:"#e0e0e0",fontSize:18,cursor:"pointer",padding:"4px 4px",lineHeight:1}}>×</button>
                  {onAddToDay&&<button onClick={e=>{e.stopPropagation();onAddToDay(r.name,r.emoji);}} style={{background:"transparent",border:"1px dashed #ccc",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",flexShrink:0}}>+ hoy</button>}
                  <button onClick={()=>startRoutine(r)}
                    style={{background:"#111",border:"none",borderRadius:20,padding:"8px 18px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#fff",fontWeight:700,flexShrink:0}}>
                    {hasState?"retomar ▶":"iniciar ▶"}
                  </button>
                </div>
                {/* Step preview */}
                <div style={{padding:"0 16px 12px",display:"flex",gap:6,flexWrap:"wrap"}}>
                  {r.steps.map((s,i)=>(
                    <div key={s.id} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",background:"#f9f9f9",borderRadius:10,padding:"2px 8px",border:hasState&&r.runState.step===i?"1px dashed #111":"none"}}>
                      {s.name||`paso ${i+1}`}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoutinesPage;
