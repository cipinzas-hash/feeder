import { MONTH_NAMES } from "../../core/dates.js";
import { fmtCLP } from "../../core/format.js";
const { useState, useEffect, useRef, useMemo, useCallback } = React;


function PieChart({ data, total, annual }) {
  const CX = 100, CY = 100, R = 76;
  const GRAYS = ["#111","#333","#555","#777","#888","#999","#aaa","#bbb","#222","#444","#666","#ccc"];
  let cum = -Math.PI/2;
  const slices = data.filter(d=>d.monto>0).map((d,i) => {
    const pct = total>0 ? d.monto/total : 0;
    const angle = pct*2*Math.PI;
    const x1 = CX+R*Math.cos(cum), y1 = CY+R*Math.sin(cum);
    const mid = cum+angle/2;
    cum += angle;
    const x2 = CX+R*Math.cos(cum), y2 = CY+R*Math.sin(cum);
    return {
      path:`M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${angle>Math.PI?1:0},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
      color: GRAYS[i%GRAYS.length], label:d.label, emoji:d.emoji||"",
      pct:(pct*100).toFixed(1), monto:annual?d.monto*12:d.monto,
      ex: CX+R*0.63*Math.cos(mid), ey: CY+R*0.63*Math.sin(mid),
      big: pct>=0.07,
    };
  });
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {slices.map((s,i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5"/>)}
        {slices.map((s,i) => s.big && (
          <text key={`em${i}`} x={s.ex.toFixed(1)} y={s.ey.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize="12">{s.emoji}</text>
        ))}
        <circle cx={CX} cy={CY} r={34} fill="#fff"/>
        <text x={CX} y={CY-5} textAnchor="middle" dominantBaseline="middle" fontFamily="'Caveat',cursive" fontSize="12" fill="#111" fontWeight="700">{annual?"anual":"mensual"}</text>
        <text x={CX} y={CY+10} textAnchor="middle" dominantBaseline="middle" fontFamily="'DM Sans',sans-serif" fontSize="9" fill="#555">{fmtCLP(annual?total*12:total)}</text>
      </svg>
      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:4,padding:"0 4px"}}>
        {slices.map((s,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:9,height:9,borderRadius:2,background:s.color,flexShrink:0}}/>
            <div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#444"}}>{s.emoji} {s.label}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#111",fontWeight:600}}>{fmtCLP(s.monto)}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",width:32,textAlign:"right"}}>{s.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ingreso Chart Modal ───────────────────────────────────────────────────
function IngresoChartModal({ budgets, selYear, selMonth, onClose }) {
  const [view, setView] = useState(0); // 0=mensual pie, 1=anual barras
  const GRAYS = ["#111","#333","#555","#777","#aaa","#ccc"];
  const sources = [
    {k:"trabajo",    l:"Trabajo",       e:"🏢"},
    {k:"emprendimiento", l:"Emprend.", e:"🛠️"},
    {k:"reventa",    l:"Reventa",       e:"🔄"},
    {k:"otros",      l:"Otros",         e:"✨"},
  ];

  // Monthly pie data for current month
  const monthKey = `${selYear}-${String(selMonth+1).padStart(2,"0")}`;
  const bud = budgets[monthKey] || {ingresos:{trabajo:0,emprendimiento:0,reventa:0,otros:0}};
  const ing = bud.ingresos;
  const pieRows = sources.map(s=>({label:s.l,emoji:s.e,monto:ing[s.k]||0}));
  const pieTotal = pieRows.reduce((s,r)=>s+r.monto,0);

  // Annual bar chart - sum each month
  const months = Array.from({length:12},(_,i)=>{
    const mk = `${selYear}-${String(i+1).padStart(2,"0")}`;
    const b = budgets[mk];
    const total = b ? b.ingresos.trabajo+b.ingresos.emprendimiento+b.ingresos.reventa+b.ingresos.otros : 0;
    return {label:MONTH_NAMES[i].slice(0,3), total, mk};
  });
  const maxBar = Math.max(...months.map(m=>m.total), 1);

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:12,width:"min(96vw,420px)",maxHeight:"80vh",overflow:"auto"}}>
        <div style={{background:"#111",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"10px 10px 0 0"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>💵 Ingresos</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #eee"}}>
          {["Mensual","Anual"].map((lbl,idx)=>(
            <button key={idx} onClick={()=>setView(idx)} style={{flex:1,padding:"10px",fontFamily:"'Caveat',cursive",fontSize:15,background:"transparent",border:"none",borderBottom:view===idx?"2px solid #111":"2px solid transparent",cursor:"pointer",color:view===idx?"#111":"#aaa"}}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{padding:"16px"}}>
          {view===0 && <PieChart data={pieRows} total={pieTotal} annual={false}/>}
          {view===1 && (
            <div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#555",marginBottom:12,textAlign:"center"}}>{selYear} — total anual {fmtCLP(months.reduce((s,m)=>s+m.total,0))}</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {months.map((m,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",width:30,textAlign:"right"}}>{m.label}</div>
                    <div style={{flex:1,background:"#f5f5f5",borderRadius:4,height:20,overflow:"hidden"}}>
                      <div style={{width:`${maxBar>0?(m.total/maxBar*100):0}%`,height:"100%",background:i===selMonth?"#111":"#bbb",transition:"width 0.3s",borderRadius:4}}/>
                    </div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555",width:70,textAlign:"right"}}>{m.total>0?fmtCLP(m.total):"—"}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:4}}>
                {sources.map(s=>{
                  const annual = months.reduce((sum,m)=>{
                    const b=budgets[m.mk];
                    return sum+(b?b.ingresos[s.k]||0:0);
                  },0);
                  return annual>0?(
                    <div key={s.k} style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555"}}>
                      <span>{s.e} {s.l}</span><span style={{fontWeight:600,color:"#111"}}>{fmtCLP(annual)}</span>
                    </div>
                  ):null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chart Modal ───
function ChartModal({ title, emoji, rows, total, onClose }) {
  const [view, setView] = useState(0);
  return (
    <div style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:14,overflow:"hidden",boxShadow:"6px 6px 0 #111",width:320,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{background:"#111",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>{emoji} {title}</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#555",fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #eee"}}>
          {["Mensual","Anual"].map((lbl,idx) => (
            <button key={idx} onClick={()=>setView(idx)} style={{flex:1,padding:"10px",fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,cursor:"pointer",background:view===idx?"#111":"#fff",color:view===idx?"#fff":"#999",border:"none",transition:"all 0.15s"}}>{lbl}</button>
          ))}
        </div>
        <div style={{padding:"16px"}}>
          <PieChart data={rows} total={total} annual={view===1}/>
        </div>
      </div>
    </div>
  );
}

// ─── Month Selector ───
function MonthSelectorModal({ currentYear, currentMonth, onSelect, onClose }) {
  const [year, setYear] = useState(currentYear);
  return (
    <div style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:14,overflow:"hidden",boxShadow:"6px 6px 0 #111",width:300}}>
        <div style={{background:"#111",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>setYear(y=>y-1)} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",fontWeight:700}}>‹</button>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#fff",fontWeight:700}}>{year}</div>
          <button onClick={()=>setYear(y=>y+1)} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",fontWeight:700}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,padding:12}}>
          {MONTH_NAMES.map((m,i) => {
            const cur = i===currentMonth && year===currentYear;
            const nowDate=new Date(), isNow=i===nowDate.getMonth()&&year===nowDate.getFullYear()&&!cur;
            return (
              <button key={i} onClick={()=>{onSelect(year,i);onClose();}} style={{fontFamily:"'Caveat',cursive",fontSize:16,padding:"10px 6px",cursor:"pointer",background:cur?"#111":"transparent",color:cur?"#fff":isNow?"#111":"#555",border:cur?"none":isNow?"2px dashed #111":"1px dashed #eee",borderRadius:6,fontWeight:cur||isNow?700:400}}>{m.slice(0,3)}</button>
            );
          })}
        </div>
        <div style={{padding:"8px 12px 14px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:13,color:"#bbb"}}>presupuestos corren del 25 al 24</div>
      </div>
    </div>
  );
}
function AmountRow({ value, total, onSave }) {
  const [ed, setEd] = useState(false);
  const [txt, setTxt] = useState(String(value));
  function commit() { const n=parseInt(txt.replace(/\D/g,""))||0; onSave(n); setEd(false); }
  function nudge(d) { onSave(Math.max(0, value+d)); }
  const btnStyle = {background:"transparent",border:"1px dashed #e0e0e0",borderRadius:4,color:"#bbb",fontSize:13,width:22,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:700,lineHeight:1,padding:0,transition:"all 0.12s"};
  return (
    <div style={{display:"flex",alignItems:"center",gap:2,justifyContent:"flex-end"}}>
      <button style={btnStyle} onClick={()=>nudge(-1000)} onMouseEnter={e=>{e.currentTarget.style.borderColor="#888";e.currentTarget.style.color="#555";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#e0e0e0";e.currentTarget.style.color="#bbb";}}>‹</button>
      {ed
        ? <input autoFocus value={txt} onChange={e=>{const v=e.target.value;setTxt(v);onSave(parseInt(v.replace(/\D/g,""))||0);}} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")commit();}} style={{width:82,border:"1px dashed #aaa",background:"#fafafa",borderRadius:4,padding:"2px 5px",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#111",outline:"none",textAlign:"right"}}/>
        : <div onClick={()=>{setTxt(String(value));setEd(true);}} style={{width:82,cursor:"pointer",fontSize:13,color:"#333",fontFamily:"'DM Sans',sans-serif",textAlign:"right",padding:"2px 5px",border:"1px solid transparent",borderRadius:4}} onMouseEnter={e=>e.currentTarget.style.borderColor="#ddd"} onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}>{fmtCLP(value)}</div>
      }
      <button style={btnStyle} onClick={()=>nudge(1000)} onMouseEnter={e=>{e.currentTarget.style.borderColor="#888";e.currentTarget.style.color="#555";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#e0e0e0";e.currentTarget.style.color="#bbb";}}>›</button>
    </div>
  );
}

// ─── Budget Section ───
const COL = "minmax(90px,1fr) 130px 46px 82px 26px";

function BudgetSec({ title, emoji, rows, secKey, subtotal, totalIngreso, canEdit, checkable, onRowSave, onRowAdd, onRowDelete, onRowCheck, onChartOpen }) {
  const T = totalIngreso;
  const pct = T>0 ? ((subtotal/T)*100).toFixed(1) : "-";
  const [hover, setHover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("📌");
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  function confirmAdd() {
    if (!newLabel.trim()) return;
    onRowAdd(secKey, {id:Date.now().toString(), emoji:newEmoji, label:newLabel.trim(), monto:0});
    setNewLabel(""); setNewEmoji("📌"); setAdding(false);
  }

  return (
    <div style={{marginBottom:20}}>
      <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
        style={{background:hover?"#222":"#111",padding:"10px 14px",borderRadius:"8px 8px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",transition:"background 0.15s"}}>
        <div onClick={()=>onChartOpen({title,emoji,rows,total:subtotal})} style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700,flex:1}}>{emoji} {title}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666"}} onClick={()=>onChartOpen({title,emoji,rows,total:subtotal})}>{pct}% · {fmtCLP(subtotal)}</span>
          {canEdit && <button onClick={e=>{e.stopPropagation();setAdding(a=>!a);}} style={{background:"transparent",border:"1px dashed #555",borderRadius:4,color:"#aaa",fontSize:11,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",letterSpacing:1}}>+ agregar</button>}
        </div>
      </div>
      <div style={{border:"1px solid #eee",borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
        {/* Column headers inside section */}
        <div style={{display:"grid",gridTemplateColumns:checkable?"24px "+COL:COL,gap:4,padding:"6px 12px",background:"#f8f8f8",borderBottom:"1px solid #eee"}}>
          {checkable&&<div/>}
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase"}}>Fondo</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textAlign:"right",paddingRight:24}}>$ Mensual</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textAlign:"center"}}>%</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textAlign:"right"}}>Proy. anual</div>
          <div/>
        </div>
        {rows.map((row,i) => {
          const rp = T>0 ? ((row.monto/T)*100).toFixed(1) : "-";
          return (
            <div key={row.id} style={{display:"grid",gridTemplateColumns:checkable?"24px "+COL:COL,gap:4,padding:"9px 12px",borderBottom:i<rows.length-1?"1px dashed #f0f0f0":"none",alignItems:"center",background:i%2===0?"#fff":"#fafafa"}}>
              {checkable&&(
                <div onClick={()=>onRowCheck&&onRowCheck(secKey,row.id,!row.checked)} style={{display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                  <div style={{width:16,height:16,borderRadius:3,border:row.checked?"none":"1.5px dashed #ccc",background:row.checked?"#111":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",flexShrink:0}}>
                    {row.checked&&<span style={{color:"#fff",fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}
                  </div>
                </div>
              )}
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:row.checked?"#bbb":"#333",textDecoration:row.checked?"line-through":"none",display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                <span style={{flexShrink:0}}>{row.emoji}</span>
                {editId===row.id
                  ? <input autoFocus value={editLabel} onChange={e=>{const v=e.target.value;setEditLabel(v);if(v.trim())onRowSave(secKey,row.id,row.monto,v);}} onBlur={()=>{if(editLabel.trim())onRowSave(secKey,row.id,row.monto,editLabel);setEditId(null);}} onKeyDown={e=>{if(e.key==="Enter"){if(editLabel.trim())onRowSave(secKey,row.id,row.monto,editLabel);setEditId(null);}if(e.key==="Escape")setEditId(null);}} style={{fontSize:12,border:"1px dashed #aaa",borderRadius:4,padding:"1px 5px",outline:"none",background:"#fafafa",width:"100%"}}/>
                  : <span onClick={()=>{setEditLabel(row.label);setEditId(row.id);}} style={{cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title="clic para editar">{row.label}</span>
                }
              </div>
              <AmountRow value={row.monto} total={T} onSave={v=>onRowSave(secKey,row.id,v,row.label)}/>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",textAlign:"center"}}>{rp}%</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",textAlign:"right"}}>{fmtCLP(row.monto*12)}</div>
              {canEdit
                ? <button onClick={()=>onRowDelete(secKey,row.id)} style={{background:"transparent",border:"none",color:"#e0e0e0",fontSize:16,cursor:"pointer",lineHeight:1,padding:0,textAlign:"center"}} onMouseEnter={e=>e.currentTarget.style.color="#c00"} onMouseLeave={e=>e.currentTarget.style.color="#e0e0e0"}>×</button>
                : <div/>
              }
            </div>
          );
        })}
        {adding && (
          <div style={{padding:"10px 12px",borderTop:"1px dashed #eee",background:"#fafafa",display:"flex",gap:6,alignItems:"center"}}>
            <input value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} style={{width:34,textAlign:"center",border:"1px dashed #ccc",borderRadius:4,padding:"3px",fontSize:15,outline:"none"}} placeholder="📌"/>
            <input autoFocus value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAdd();if(e.key==="Escape")setAdding(false);}} placeholder="nombre del fondo..." style={{flex:1,border:"1px dashed #ccc",borderRadius:4,padding:"4px 8px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"#fff"}}/>
            <button onClick={confirmAdd} style={{background:"#111",color:"#fff",border:"none",borderRadius:4,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>✓</button>
            <button onClick={()=>setAdding(false)} style={{background:"transparent",border:"none",color:"#bbb",fontSize:18,cursor:"pointer"}}>×</button>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:COL,gap:4,padding:"9px 12px",background:"#f3f3f3",alignItems:"center"}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#111",fontWeight:700}}>Subtotal</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#111",fontWeight:700,textAlign:"right",paddingRight:24}}>{fmtCLP(subtotal)}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666",textAlign:"center",fontWeight:600}}>{pct}%</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666",textAlign:"right",fontWeight:600}}>{fmtCLP(subtotal*12)}</div>
          <div/>
        </div>
      </div>
    </div>
  );
}

// ─── Budget Page ───
function BudgetPage({ budgets, onSaveBudget }) {
  const [chartData, setChartData] = useState(null);
  const [ingChart, setIngChart] = useState(false);
  const [monthModal, setMonthModal] = useState(false);
  const now = new Date();
  // Period: 25th of selMonth → 24th of next month
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getDate()>=25?now.getMonth():(now.getMonth()-1+12)%12);

  // Month key: "YYYY-MM" using the start month of the period (the 25th month)
  const monthKey = `${selYear}-${String(selMonth+1).padStart(2,'0')}`;
  // Get budget for this month, falling back to default structure
  const budget = (budgets && budgets[monthKey]) ? budgets[monthKey] : makeDefaultBudget();

  const periodLabel = `25 ${MONTH_NAMES[selMonth].slice(0,3)} — 24 ${MONTH_NAMES[(selMonth+1)%12].slice(0,3)} ${selYear}`;
  const ing = budget.ingresos;
  const totalIngreso = ing.trabajo+ing.emprendimiento+ing.reventa+ing.otros;
  function save(updated){ onSaveBudget(monthKey, updated); }
  function updIng(k,v){save({...budget,ingresos:{...budget.ingresos,[k]:v}});}
  function updRow(sec,id,monto,label){save({...budget,[sec]:budget[sec].map(r=>r.id===id?{...r,monto,label}:r)});}
  function addRow(sec,row){save({...budget,[sec]:[...budget[sec],row]});}
  function delRow(sec,id){save({...budget,[sec]:budget[sec].filter(r=>r.id!==id)});}
  function checkRow(sec,id,checked){save({...budget,[sec]:budget[sec].map(r=>r.id===id?{...r,checked}:r)});}
  const sumBase=budget.gastos_base.reduce((s,r)=>s+r.monto,0);
  const sumPers=budget.personales.reduce((s,r)=>s+r.monto,0);
  const sumProp=budget.propositos.reduce((s,r)=>s+r.monto,0);
  const totalGasto=sumBase+sumPers+sumProp;
  const remainder=totalIngreso-totalGasto;
  const T=totalIngreso;
  return (
    <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
      {ingChart&&<IngresoChartModal budgets={budgets} selYear={selYear} selMonth={selMonth} onClose={()=>setIngChart(false)}/>}
      {chartData&&<ChartModal title={chartData.title} emoji={chartData.emoji} rows={chartData.rows} total={chartData.total} onClose={()=>setChartData(null)}/>}
      {monthModal&&<MonthSelectorModal currentYear={selYear} currentMonth={selMonth} onSelect={(y,m)=>{setSelYear(y);setSelMonth(m);}} onClose={()=>setMonthModal(false)}/>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>{const nm=selMonth===0?11:selMonth-1;const ny=selMonth===0?selYear-1:selYear;setSelMonth(nm);setSelYear(ny);}} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"6px 11px",cursor:"pointer",color:"#888",fontSize:16,lineHeight:1}}>‹</button>
          <button onClick={()=>setMonthModal(true)} style={{fontFamily:"'Caveat',cursive",fontSize:17,color:"#555",background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"7px 14px",cursor:"pointer"}}>📅 {periodLabel}</button>
          <button onClick={()=>{const nm=selMonth===11?0:selMonth+1;const ny=selMonth===11?selYear+1:selYear;setSelMonth(nm);setSelYear(ny);}} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"6px 11px",cursor:"pointer",color:"#888",fontSize:16,lineHeight:1}}>›</button>
        </div>
      </div>
      {/* Ingresos */}
      <div style={{marginBottom:20}}>
        <div style={{background:"#111",padding:"10px 14px",borderRadius:"8px 8px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div onClick={()=>setIngChart(true)} style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700,cursor:"pointer"}}>💵 Ingresos <span style={{fontSize:13,opacity:0.5}}>▸</span></div>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#fff",fontWeight:700}}>{fmtCLP(totalIngreso)}</div>
        </div>
        <div style={{border:"1px solid #eee",borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 115px",gap:4,padding:"6px 12px",background:"#f8f8f8",borderBottom:"1px solid #eee"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase"}}>Fuente</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textAlign:"right",paddingRight:24}}>$ Mensual</div>
          </div>
          {[{k:"trabajo",l:"Trabajo principal",e:"🏢"},{k:"emprendimiento",l:"Emprendimiento",e:"🛠️"},{k:"reventa",l:"Reventa",e:"♻️"},{k:"otros",l:"Otros",e:"➕"}].map((s,i)=>(
            <div key={s.k} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,padding:"9px 12px",borderBottom:i<3?"1px dashed #f0f0f0":"none",alignItems:"center",background:i%2===0?"#fff":"#fafafa"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",display:"flex",alignItems:"center",gap:6}}><span>{s.e}</span><span>{s.l}</span></div>
              <AmountRow value={ing[s.k]} total={0} onSave={v=>updIng(s.k,v)}/>
            </div>
          ))}
        </div>
      </div>
      <BudgetSec title="Gastos Base" emoji="🧱" rows={budget.gastos_base} secKey="gastos_base" checkable onRowCheck={checkRow} subtotal={sumBase} totalIngreso={T} canEdit onRowSave={updRow} onRowAdd={addRow} onRowDelete={delRow} onChartOpen={setChartData}/>
      <BudgetSec title="Fondos Personales" emoji="👤" rows={budget.personales} secKey="personales" checkable onRowCheck={checkRow} subtotal={sumPers} totalIngreso={T} canEdit={false} onRowSave={updRow} onRowAdd={addRow} onRowDelete={delRow} onChartOpen={setChartData}/>
      <BudgetSec title="Fondos por Propósito" emoji="📦" rows={budget.propositos} secKey="propositos" checkable onRowCheck={checkRow} subtotal={sumProp} totalIngreso={T} canEdit onRowSave={updRow} onRowAdd={addRow} onRowDelete={delRow} onChartOpen={setChartData}/>
      {/* Total */}
      <div style={{border:"2px solid #111",borderRadius:8,overflow:"hidden",marginBottom:8}}>
        <div style={{display:"grid",gridTemplateColumns:COL,gap:4,padding:"12px 12px",background:"#111",alignItems:"center"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#fff",fontWeight:700}}>Total distribuido</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#fff",fontWeight:700,textAlign:"right",paddingRight:24}}>{fmtCLP(totalGasto)}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#888",textAlign:"center"}}>{T>0?((totalGasto/T)*100).toFixed(1):"-"}%</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#888",textAlign:"right"}}>{fmtCLP(totalGasto*12)}</div>
          <div/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:COL,gap:4,padding:"10px 12px",background:remainder<0?"#fff5f5":"#f9f9f9",alignItems:"center"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:remainder<0?"#c00":"#555"}}>{remainder<0?"⚠️ Déficit":"Remanente"}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:remainder<0?"#c00":"#111",fontWeight:700,textAlign:"right",paddingRight:24}}>{fmtCLP(Math.abs(remainder))}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa",textAlign:"center"}}>{T>0?((Math.abs(remainder)/T)*100).toFixed(1):"-"}%</div>
          <div/><div/>
        </div>
      </div>
      <div style={{height:32}}/>
    </div>
  );
}

export default BudgetPage;
