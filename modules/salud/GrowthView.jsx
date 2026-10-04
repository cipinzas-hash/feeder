// Curva de crecimiento (talla/peso) — movida tal cual desde SaludPage.jsx; la
// medición vive en profiles[p].growthLog y no pasa por la línea de tiempo.

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

function GrowthView({persona, perfil, today, onBack, onSave}) {
  const [growthInput, setGrowthInput] = React.useState({peso:"",talla:"",date:today});
  const [addingGrowth, setAddingGrowth] = React.useState(false);
  function submit(){
    if(!growthInput.talla&&!growthInput.peso) return;
    onSave({date:growthInput.date||today, peso:parseFloat(growthInput.peso)||null, talla:parseFloat(growthInput.talla)||null});
    setGrowthInput({peso:"",talla:"",date:today});
    setAddingGrowth(false);
  }

            const growthLog = [...(perfil.growthLog||[])].sort((a,b)=>a.date.localeCompare(b.date));
    const isCristopher = persona.id==="cristopher";

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
          <button onClick={()=>onBack()} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
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
                <button onClick={()=>submit()} style={{flex:1,background:"#111",border:"none",borderRadius:8,padding:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",cursor:"pointer",fontWeight:600}}>guardar</button>
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

export default GrowthView;
