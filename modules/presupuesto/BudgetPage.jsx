import { MONTH_NAMES } from "../../core/dates.js";
import { fmtCLP } from "../../core/format.js";
import { resolverPeriodo, inicioSobres, sumaSubs, puedeEliminar, quitarGasto, puedeQuitarGasto, puedeGenerarPeriodo, proyeccionAnual, FILAS_CARTERABLES, datosRueda, gastosSinCategoria } from "../../core/presupuesto-modelo.js";
import { AmountRow, GRID, COL, GAP, FUENTE, PAD_MONTO, celdaTitulo } from "./grilla.jsx";
import CarteraVentana from "./CarteraVentana.jsx";
import GastoModal from "./GastoModal.jsx";
import GuiaSobres from "./GuiaSobres.jsx";
import ArqueoModal from "./ArqueoModal.jsx";
import PresupuestoRueda from "./PresupuestoRueda.jsx";
import MovimientosModal from "./MovimientosModal.jsx";
import TortaModal from "./TortaModal.jsx";
import PorCategorizarModal from "./PorCategorizarModal.jsx";
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// La lógica de períodos, sub-partidas, saldos y gastos vive en core/presupuesto-modelo.js (issue #24).
const getBudgetForPeriod = resolverPeriodo;
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
    return {path:`M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${angle>Math.PI?1:0},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,color:GRAYS[i%GRAYS.length],label:d.label,emoji:d.emoji||"",pct:(pct*100).toFixed(1),monto:annual?d.monto*12:d.monto,ex:CX+R*0.63*Math.cos(mid),ey:CY+R*0.63*Math.sin(mid),big:pct>=0.07};
  });
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}><svg width="200" height="200" viewBox="0 0 200 200">{slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5"/>)}{slices.map((s,i)=>s.big&&<text key={`em${i}`} x={s.ex.toFixed(1)} y={s.ey.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize="12">{s.emoji}</text>)}<circle cx={CX} cy={CY} r={34} fill="#fff"/><text x={CX} y={CY-5} textAnchor="middle" dominantBaseline="middle" fontFamily="'Caveat',cursive" fontSize="12" fill="#111" fontWeight="700">{annual?"anual":"mensual"}</text><text x={CX} y={CY+10} textAnchor="middle" dominantBaseline="middle" fontFamily="'DM Sans',sans-serif" fontSize="9" fill="#555">{fmtCLP(annual?total*12:total)}</text></svg><div style={{width:"100%",display:"flex",flexDirection:"column",gap:4,padding:"0 4px"}}>{slices.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:9,height:9,borderRadius:2,background:s.color,flexShrink:0}}/><div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#444"}}>{s.emoji} {s.label}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#111",fontWeight:600}}>{fmtCLP(s.monto)}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",width:32,textAlign:"right"}}>{s.pct}%</div></div>)}</div></div>;
}

function IngresoChartModal({ budgets, selYear, selMonth, onClose }) {
  const [view, setView] = useState(0);
  const GRAYS = ["#111","#333","#555","#777","#aaa","#ccc"];
  const sources = [{k:"trabajo",l:"Trabajo",e:"🏢"},{k:"emprendimiento",l:"Emprend.",e:"🛠️"},{k:"reventa",l:"Reventa",e:"🔄"},{k:"otros",l:"Otros",e:"✨"}];
  const monthKey=`${selYear}-${String(selMonth+1).padStart(2,"0")}`;
  const bud=budgets[monthKey]||{ingresos:{trabajo:0,emprendimiento:0,reventa:0,otros:0}};
  const ing=bud.ingresos;
  const pieRows=sources.map(s=>({label:s.l,emoji:s.e,monto:ing[s.k]||0}));
  const pieTotal=pieRows.reduce((s,r)=>s+r.monto,0);
  const months=Array.from({length:12},(_,i)=>{const mk=`${selYear}-${String(i+1).padStart(2,"0")}`;const b=budgets[mk];const total=b?b.ingresos.trabajo+b.ingresos.emprendimiento+b.ingresos.reventa+b.ingresos.otros:0;return {label:MONTH_NAMES[i].slice(0,3),total,mk};});
  const maxBar=Math.max(...months.map(m=>m.total),1);
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)"}}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:12,width:"min(96vw,420px)",maxHeight:"80vh",overflow:"auto"}}><div style={{background:"#111",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"10px 10px 0 0"}}><div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>💵 Ingresos</div><button onClick={onClose} style={{background:"transparent",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>×</button></div><div style={{display:"flex",borderBottom:"1px solid #eee"}}>{["Mensual","Anual"].map((lbl,idx)=><button key={idx} onClick={()=>setView(idx)} style={{flex:1,padding:"10px",fontFamily:"'Caveat',cursive",fontSize:15,background:"transparent",border:"none",borderBottom:view===idx?"2px solid #111":"2px solid transparent",cursor:"pointer",color:view===idx?"#111":"#aaa"}}>{lbl}</button>)}</div><div style={{padding:"16px"}}>{view===0&&<PieChart data={pieRows} total={pieTotal} annual={false}/>} {view===1&&<div><div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#555",marginBottom:12,textAlign:"center"}}>{selYear} — total anual {fmtCLP(months.reduce((s,m)=>s+m.total,0))}</div><div style={{display:"flex",flexDirection:"column",gap:6}}>{months.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",width:30,textAlign:"right"}}>{m.label}</div><div style={{flex:1,background:"#f5f5f5",borderRadius:4,height:20,overflow:"hidden"}}><div style={{width:`${maxBar>0?(m.total/maxBar*100):0}%`,height:"100%",background:i===selMonth?"#111":"#bbb",transition:"width 0.3s",borderRadius:4}}/></div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555",width:70,textAlign:"right"}}>{m.total>0?fmtCLP(m.total):"—"}</div></div>)}</div><div style={{marginTop:16,display:"flex",flexDirection:"column",gap:4}}>{sources.map(s=>{const annual=months.reduce((sum,m)=>{const b=budgets[m.mk];return sum+(b?b.ingresos[s.k]||0:0);},0);return annual>0?<div key={s.k} style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555"}}><span>{s.e} {s.l}</span><span style={{fontWeight:600,color:"#111"}}>{fmtCLP(annual)}</span></div>:null;})}</div></div>}</div></div></div>;
}

function ChartModal({ title, emoji, rows, total, onClose }) { const [view,setView]=useState(0); return <div style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:14,overflow:"hidden",boxShadow:"6px 6px 0 #111",width:320,maxHeight:"90vh",overflowY:"auto"}}><div style={{background:"#111",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>{emoji} {title}</div><button onClick={onClose} style={{background:"transparent",border:"none",color:"#555",fontSize:24,cursor:"pointer",lineHeight:1}}>×</button></div><div style={{display:"flex",borderBottom:"1px solid #eee"}}>{["Mensual","Anual"].map((lbl,idx)=><button key={idx} onClick={()=>setView(idx)} style={{flex:1,padding:"10px",fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,cursor:"pointer",background:view===idx?"#111":"#fff",color:view===idx?"#fff":"#999",border:"none",transition:"all 0.15s"}}>{lbl}</button>)}</div><div style={{padding:"16px"}}><PieChart data={rows} total={total} annual={view===1}/></div></div></div>; }

function MonthSelectorModal({ currentYear, currentMonth, onSelect, onClose }) { const [year,setYear]=useState(currentYear); return <div style={{position:"fixed",inset:0,zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"2px dashed #111",borderRadius:14,overflow:"hidden",boxShadow:"6px 6px 0 #111",width:300}}><div style={{background:"#111",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><button onClick={()=>setYear(y=>y-1)} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",fontWeight:700}}>‹</button><div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#fff",fontWeight:700}}>{year}</div><button onClick={()=>setYear(y=>y+1)} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",fontWeight:700}}>›</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,padding:12}}>{MONTH_NAMES.map((m,i)=>{const cur=i===currentMonth&&year===currentYear;const nowDate=new Date(),isNow=i===nowDate.getMonth()&&year===nowDate.getFullYear()&&!cur;return <button key={i} onClick={()=>{onSelect(year,i);onClose();}} style={{fontFamily:"'Caveat',cursive",fontSize:16,padding:"10px 6px",cursor:"pointer",background:cur?"#111":"transparent",color:cur?"#fff":isNow?"#111":"#555",border:cur?"none":isNow?"2px dashed #111":"1px dashed #eee",borderRadius:6,fontWeight:cur||isNow?700:400}}>{m.slice(0,3)}</button>})}</div><div style={{padding:"8px 12px 14px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:13,color:"#bbb"}}>presupuestos corren del 25 al 24</div></div></div>; }


const celda = (extra) => ({ fontFamily: FUENTE, ...extra });

function BudgetSec({ title, emoji, rows, secKey, subtotal, totalIngreso, canEdit, onRowSave, onRowAdd, onRowDelete, onRowCheck, onChartOpen, onOpenCartera, onToggleCartera, anual }) {
  const T = totalIngreso;
  const pct = T > 0 ? ((subtotal / T) * 100).toFixed(1) : "-";
  const [hover, setHover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("📌");
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  function confirmAdd() {
    if (!newLabel.trim()) return;
    onRowAdd(secKey, { id: Date.now().toString(), emoji: newEmoji, label: newLabel.trim(), monto: 0 });
    setNewLabel(""); setNewEmoji("📌"); setAdding(false);
  }
  const abrirGrafico = () => onChartOpen({ title, emoji, rows, total: subtotal });
  const anualSub = rows.reduce((t, r) => t + ((anual && anual[r.id] != null) ? anual[r.id] : r.monto * 12), 0);

  return (
    <div style={{ marginBottom: 20 }}>
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ background: hover ? "#222" : "#111", padding: "10px 14px", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "background 0.15s" }}>
        <div onClick={abrirGrafico} style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: "#fff", fontWeight: 700, flex: 1 }}>{emoji} {title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={celda({ fontSize: 11, color: "#666" })} onClick={abrirGrafico}>{pct}% · {fmtCLP(subtotal)}</span>
          {canEdit && <button onClick={e => { e.stopPropagation(); setAdding(a => !a); }} style={{ background: "transparent", border: "1px dashed #555", borderRadius: 4, color: "#aaa", fontSize: 11, padding: "2px 8px", cursor: "pointer", fontFamily: FUENTE, letterSpacing: 1 }}>+ agregar</button>}
        </div>
      </div>
      <div style={{ border: "1px solid #eee", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: GAP, padding: "7px 12px", background: "#f8f8f8", borderBottom: "1px solid #eee" }}>
          <div/>
          <div style={{ ...celdaTitulo, letterSpacing: 2, textTransform: "uppercase" }}>Fondo</div>
          <div style={{ ...celdaTitulo, textAlign: "right", paddingRight: PAD_MONTO }}>$ Mensual</div>
          <div style={{ ...celdaTitulo, textAlign: "right" }}>%</div>
          <div style={{ ...celdaTitulo, textAlign: "right" }}>Proy. anual</div>
          <div/>
        </div>
        {rows.map((row, i) => {
          const rp = T > 0 ? ((row.monto / T) * 100).toFixed(1) : "-";
          return (
            <div key={row.id} style={{ borderBottom: i < rows.length - 1 ? "1px dashed #f0f0f0" : "none", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, gap: GAP, padding: "11px 12px", alignItems: "center" }}>
                <div onClick={() => onRowCheck && onRowCheck(secKey, row.id, !row.checked)} style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, border: row.checked ? "none" : "1.5px dashed #ccc", background: row.checked ? "#111" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}>{row.checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}</div>
                </div>
                <div style={celda({ fontSize: 13, color: row.checked ? "#bbb" : "#333", textDecoration: row.checked ? "line-through" : "none", display: "flex", alignItems: "center", gap: 5, minWidth: 0 })}>
                  {onOpenCartera
                    ? <span onClick={() => onOpenCartera(secKey, row.id)} title="Abrir cartera" style={{ flexShrink: 0, cursor: "pointer", border: "1px dashed #ccc", borderRadius: 6, padding: "1px 4px", lineHeight: 1.3 }}>{row.emoji}</span>
                    : <span style={{ flexShrink: 0 }}>{row.emoji}</span>}
                  {editId === row.id
                    ? <input autoFocus value={editLabel} onChange={e => { const v = e.target.value; setEditLabel(v); if (v.trim()) onRowSave(secKey, row.id, row.monto, v); }}
                        onBlur={() => { if (editLabel.trim()) onRowSave(secKey, row.id, row.monto, editLabel); setEditId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { if (editLabel.trim()) onRowSave(secKey, row.id, row.monto, editLabel); setEditId(null); } if (e.key === "Escape") setEditId(null); }}
                        style={{ fontSize: 12, border: "1px dashed #aaa", borderRadius: 4, padding: "1px 5px", outline: "none", background: "#fafafa", width: "100%", minWidth: 0 }}/>
                    : <span onClick={() => { setEditLabel(row.label); setEditId(row.id); }} style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="clic para editar">{row.label}</span>}
                </div>
                <AmountRow value={row.monto} min={sumaSubs(row)} onSave={v => onRowSave(secKey, row.id, v, row.label)}/>
                <div onClick={onOpenCartera ? () => onOpenCartera(secKey, row.id) : undefined} style={celda({ fontSize: 11, color: "#aaa", textAlign: "right", cursor: onOpenCartera ? "pointer" : "default" })}>{rp}%</div>
                <div onClick={onOpenCartera ? () => onOpenCartera(secKey, row.id) : undefined} style={celda({ fontSize: 11, color: "#bbb", textAlign: "right", cursor: onOpenCartera ? "pointer" : "default" })}>{fmtCLP((anual && anual[row.id] != null) ? anual[row.id] : row.monto * 12)}</div>
                {canEdit
                  ? <button onClick={() => onRowDelete(secKey, row.id)} style={{ background: "transparent", border: "none", color: "#e0e0e0", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0, textAlign: "center" }} onMouseEnter={e => e.currentTarget.style.color = "#c00"} onMouseLeave={e => e.currentTarget.style.color = "#e0e0e0"}>×</button>
                  : <div/>}
              </div>
              {onToggleCartera && (FILAS_CARTERABLES.includes(row.id) || row.aCartera) && (
                <div style={{ padding: "0 12px 9px 40px" }}>
                  <button onClick={() => onToggleCartera(row.id)} title="Un sobre propio con saldo, gastos y compras que se descuentan" style={{ background: row.aCartera ? "#fffaf0" : "transparent", border: `1px dashed ${row.aCartera ? "#e0b070" : "#ccc"}`, borderRadius: 6, color: row.aCartera ? "#8a5a00" : "#888", fontFamily: FUENTE, fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>
                    {row.aCartera ? "🧾 Será cartera desde el período siguiente · deshacer" : "🧾 Pasar a cartera (sobre propio) desde el período siguiente"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {adding && (
          <div style={{ padding: "10px 12px", borderTop: "1px dashed #eee", background: "#fafafa", display: "flex", gap: 6, alignItems: "center" }}>
            <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} style={{ width: 34, textAlign: "center", border: "1px dashed #ccc", borderRadius: 4, padding: 3, fontSize: 15, outline: "none" }} placeholder="📌"/>
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmAdd(); if (e.key === "Escape") setAdding(false); }} placeholder="nombre del fondo..." style={{ flex: 1, border: "1px dashed #ccc", borderRadius: 4, padding: "4px 8px", fontSize: 13, fontFamily: FUENTE, outline: "none", background: "#fff" }}/>
            <button onClick={confirmAdd} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>✓</button>
            <button onClick={() => setAdding(false)} style={{ background: "transparent", border: "none", color: "#bbb", fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: GAP, padding: "10px 12px", background: "#f3f3f3", alignItems: "center" }}>
          <div/>
          <div style={celda({ fontSize: 12, color: "#111", fontWeight: 700 })}>Subtotal</div>
          <div style={celda({ fontSize: 13, color: "#111", fontWeight: 700, textAlign: "right", paddingRight: PAD_MONTO })}>{fmtCLP(subtotal)}</div>
          <div style={celda({ fontSize: 11, color: "#666", textAlign: "right", fontWeight: 600 })}>{pct}%</div>
          <div style={celda({ fontSize: 11, color: "#666", textAlign: "right", fontWeight: 600 })}>{fmtCLP(anualSub)}</div>
          <div/>
        </div>
      </div>
    </div>
  );
}

function BudgetPage({ budgets, onSaveBudget }) {
  const [chartData, setChartData] = useState(null);
  const [ingChart, setIngChart] = useState(false);
  const [monthModal, setMonthModal] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ventana, setVentana] = useState(null);   // {sec,rowId} de la cartera abierta
  const [gastoDesde, setGastoDesde] = useState(null);
  const [guia, setGuia] = useState(false);
  const [cierre, setCierre] = useState(null);   // {periodo, tab} del cierre abierto
  const [vista, setVista] = useState("rueda");   // «rueda» (cómo voy) o «asignar» (ingresos, gastos base y fondos)
  const [modo, setModo] = useState("m");          // interruptor global: m = mensual, a = anual
  const [movsOpen, setMovsOpen] = useState(false);
  const [porCat, setPorCat] = useState(false);
  const [torta, setTorta] = useState(null);       // null o la vista de la torta abierta: s (por sobre), c (por categoría), p (por compra)
  const avisoRef = useRef(null);
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getDate() >= 25 ? now.getMonth() : (now.getMonth() - 1 + 12) % 12);
  const monthKey = `${selYear}-${String(selMonth + 1).padStart(2, "0")}`;
  const budget = getBudgetForPeriod(budgets, monthKey);
  const periodLabel = `25 ${MONTH_NAMES[selMonth].slice(0, 3)} — 24 ${MONTH_NAMES[(selMonth + 1) % 12].slice(0, 3)} ${selYear}`;
  const ing = budget.ingresos;
  const totalIngreso = ing.trabajo + ing.emprendimiento + ing.reventa + ing.otros;
  const inicio = inicioSobres(budgets);
  const sobresOn = !!inicio && monthKey >= inicio;
  const finPeriodo = new Date(selYear + (selMonth === 11 ? 1 : 0), (selMonth + 1) % 12, 24);
  const arqueoVence = sobresOn && !budget.arqueo && new Date() >= finPeriodo;   // llegó el día 24 y falta el arqueo
  function mostrarAviso(msg) {
    setAviso(msg);
    clearTimeout(avisoRef.current);
    avisoRef.current = setTimeout(() => setAviso(""), 6000);
  }
  // Un período nuevo no se genera mientras falte el arqueo del anterior.
  const compuerta = puedeGenerarPeriodo(budgets, monthKey);
  function save(updated) {
    if (!compuerta.ok) { mostrarAviso(`${compuerta.motivo} Toca 🔍 cierre.`); return; }
    onSaveBudget(monthKey, updated);
  }
  function updIng(k, v) { save({ ...budget, ingresos: { ...budget.ingresos, [k]: v } }); }
  function updRow(sec, id, monto, label) {
    save({ ...budget, [sec]: budget[sec].map(r => r.id === id ? { ...r, monto: Math.max(monto, sumaSubs(r)), label } : r) });
  }
  function addRow(sec, row) { save({ ...budget, [sec]: [...budget[sec], row] }); }
  function delRow(sec, id) {
    const row = budget[sec].find(r => r.id === id);
    if (row && sec !== "gastos_base") {
      const p = puedeEliminar(budgets, monthKey, sec, row);
      if (!p.ok) { mostrarAviso(`No se puede eliminar «${row.label}». ${p.motivo}`); return; }
    }
    save({ ...budget, [sec]: budget[sec].filter(r => r.id !== id) });
  }
  function checkRow(sec, id, checked) { save({ ...budget, [sec]: budget[sec].map(r => r.id === id ? { ...r, checked } : r) }); }
  function toggleCartera(id) { save({ ...budget, gastos_base: budget.gastos_base.map(r => r.id === id ? { ...r, aCartera: !r.aCartera } : r) }); }
  function patchRow(sec, id, patch) { save({ ...budget, [sec]: budget[sec].map(r => r.id === id ? { ...r, ...patch } : r) }); }
  function delGasto(id) {
    const g = (budget.gastos || []).find(x => x.id === id);
    const p = puedeQuitarGasto(budgets, g);
    if (!p.ok) return p.motivo;          // la ventana de la cartera muestra el motivo
    save(quitarGasto(budget, id));
  }
  function setApertura(clave, v) { save({ ...budget, apertura: { ...(budget.apertura || {}), [clave]: v } }); }
  function iniciarSobres() { save({ ...budget, apertura: budget.apertura || {} }); }

  const sumBase = budget.gastos_base.reduce((s, r) => s + r.monto, 0);
  const sumPers = budget.personales.reduce((s, r) => s + r.monto, 0);
  const sumProp = budget.propositos.reduce((s, r) => s + r.monto, 0);
  const totalGasto = sumBase + sumPers + sumProp;
  const proy = proyeccionAnual(budgets, monthKey, budget);
  const anualTotal = ["gastos_base", "personales", "propositos"].reduce((t, sec) => t + Object.values(proy.filas[sec]).reduce((a, b) => a + b, 0), 0);
  const remainder = totalIngreso - totalGasto;
  const T = totalIngreso;
  // Carteras en el orden en que se ven en pantalla; la ventana navega entre ellas con ‹ ›.
  const carteras = [...budget.personales.map(r => ({ sec: "personales", row: r })), ...budget.propositos.map(r => ({ sec: "propositos", row: r }))];
  const idxVentana = ventana ? carteras.findIndex(c => c.sec === ventana.sec && c.row.id === ventana.rowId) : -1;
  const abrirCartera = (sec, rowId) => setVentana({ sec, rowId });
  const datos = useMemo(() => datosRueda(budgets, monthKey), [budgets, monthKey]);
  const nSinCat = useMemo(() => gastosSinCategoria(budgets).length, [budgets]);
  const irPeriodo = d => { const m = selMonth + d; setSelYear(selYear + Math.floor(m / 12)); setSelMonth(((m % 12) + 12) % 12); };
  const secProps = { totalIngreso: T, onRowSave: updRow, onRowAdd: addRow, onRowDelete: delRow, onRowCheck: checkRow, onChartOpen: setChartData };
  const navBtn = { background: "transparent", border: "1px dashed #ddd", borderRadius: 8, padding: "6px 11px", cursor: "pointer", color: "#888", fontSize: 16, lineHeight: 1 };

  return (
    <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", overflowY: vista === "asignar" ? "auto" : "hidden" }}>
      {ingChart && <IngresoChartModal budgets={budgets} selYear={selYear} selMonth={selMonth} onClose={() => setIngChart(false)}/>}
      {chartData && <ChartModal title={chartData.title} emoji={chartData.emoji} rows={chartData.rows} total={chartData.total} onClose={() => setChartData(null)}/>}
      {idxVentana >= 0 && <CarteraVentana carteras={carteras} index={idxVentana} onIndex={i => setVentana({ sec: carteras[i].sec, rowId: carteras[i].row.id })} onClose={() => setVentana(null)}
        budgets={budgets} budget={budget} periodo={monthKey} sobresOn={sobresOn} esInicio={monthKey === inicio}
        onPatchRow={patchRow} onDeleteGasto={delGasto} onApertura={setApertura} onGasto={(sec, id) => setGastoDesde(`${sec}|${id}`)}/>}
      {cierre && <ArqueoModal budgets={budgets} periodo={cierre.periodo} tabInicial={cierre.tab} onSaveBudget={onSaveBudget} onClose={() => setCierre(null)}/>}
      {guia && <GuiaSobres budgets={budgets} periodo={monthKey} etiquetaPeriodo={periodLabel} onClose={() => setGuia(false)}/>}
      {gastoDesde && <GastoModal budgets={budgets} inicial={gastoDesde} onSaveBudget={onSaveBudget} onClose={() => setGastoDesde(null)}/>}
      {porCat && <PorCategorizarModal budgets={budgets} onSaveBudget={onSaveBudget} onClose={() => setPorCat(false)}/>}
      {torta && <TortaModal datos={datos} modo={modo} onModo={setModo} periodLabel={periodLabel} onPrev={() => irPeriodo(-1)} onNext={() => irPeriodo(1)} tabInicial={torta} onClose={() => setTorta(null)}/>}
      {movsOpen && <MovimientosModal movs={datos.movs} filas={datos.filas} anual={modo === "a"} periodLabel={periodLabel} onClose={() => setMovsOpen(false)}/>}
      {monthModal && <MonthSelectorModal currentYear={selYear} currentMonth={selMonth} onSelect={(y, m) => { setSelYear(y); setSelMonth(m); }} onClose={() => setMonthModal(false)}/>}
      {vista === "rueda" && <PresupuestoRueda datos={datos} periodLabel={periodLabel} sobresOn={sobresOn} hayInicio={!!inicio} modo={modo} onModo={setModo}
        onPrev={() => irPeriodo(-1)} onNext={() => irPeriodo(1)} aviso={aviso} cierreVence={arqueoVence}
        bloqueo={compuerta.ok ? null : { motivo: compuerta.motivo, etiqueta: "🔍 cierre", accion: () => setCierre({ periodo: compuerta.requiere, tab: undefined }) }}
        onAsignar={() => setVista("asignar")} onCierre={() => setCierre({ periodo: compuerta.ok ? monthKey : compuerta.requiere, tab: undefined })}
        onGuia={() => setGuia(true)} onIniciarSobres={iniciarSobres}
        onAbrir={abrirCartera} onRegistrar={(sec, id) => setGastoDesde(`${sec}|${id}`)} onTodos={() => setMovsOpen(true)} onTorta={setTorta} sinCategoria={nSinCat} onPorCategorizar={() => setPorCat(true)}/>}
      {vista === "asignar" && <div style={{ padding: "16px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 12 }}><button onClick={() => setVista("rueda")} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontFamily: "'Caveat',cursive", fontSize: 17, fontWeight: 700, cursor: "pointer" }}>‹ Presupuesto</button></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => { const nm = selMonth === 0 ? 11 : selMonth - 1; const ny = selMonth === 0 ? selYear - 1 : selYear; setSelMonth(nm); setSelYear(ny); }} style={navBtn}>‹</button>
          <button onClick={() => setMonthModal(true)} style={{ fontFamily: "'Caveat',cursive", fontSize: 17, color: "#555", background: "transparent", border: "1px dashed #ddd", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>📅 {periodLabel}</button>
          <button onClick={() => { const nm = selMonth === 11 ? 0 : selMonth + 1; const ny = selMonth === 11 ? selYear + 1 : selYear; setSelMonth(nm); setSelYear(ny); }} style={navBtn}>›</button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {sobresOn && <button onClick={() => setCierre({ periodo: compuerta.ok ? monthKey : compuerta.requiere, tab: undefined })} title="Arqueo y rendición del período" style={{ ...navBtn, fontFamily: "'Caveat',cursive", fontSize: 15, color: arqueoVence ? "#a60" : "#555", padding: "7px 12px", borderColor: arqueoVence ? "#e0b070" : "#ddd" }}>🔍 cierre{arqueoVence ? " ●" : ""}</button>}
          {inicio
            ? <button onClick={() => setGuia(true)} title="Cuánto debe haber en cada sobre" style={{ ...navBtn, fontFamily: "'Caveat',cursive", fontSize: 15, color: "#555", padding: "7px 12px" }}>🧾 sobres{sobresOn ? "" : " (desde " + MONTH_NAMES[parseInt(inicio.slice(5)) - 1].slice(0, 3) + ")"} ▸</button>
            : <button onClick={iniciarSobres} title="Activa saldos, gastos y sobrantes por cartera a partir de este período" style={{ ...navBtn, fontFamily: "'Caveat',cursive", fontSize: 15, color: "#555", padding: "7px 12px" }}>🧾 iniciar sobres</button>}
        </div>
      </div>
      {!compuerta.ok && <div style={celda({ fontSize: 12, color: "#8a5a00", background: "#fffaf0", border: "1px dashed #e0b070", borderRadius: 6, padding: "8px 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" })}><span style={{ flex: 1 }}>🔒 Este período aún no existe: {compuerta.motivo.toLowerCase()}</span><button onClick={() => setCierre({ periodo: compuerta.requiere })} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>Hacer el arqueo</button></div>}
      {aviso && <div style={celda({ fontSize: 12, color: "#c00", background: "#fff5f5", border: "1px dashed #e0b0b0", borderRadius: 6, padding: "8px 10px", marginBottom: 14 })}>{aviso}</div>}
      <div style={{ marginBottom: 20 }}>
        <div style={{ background: "#111", padding: "10px 14px", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div onClick={() => setIngChart(true)} style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: "#fff", fontWeight: 700, cursor: "pointer" }}>💵 Ingresos <span style={{ fontSize: 13, opacity: 0.5 }}>▸</span></div>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>{fmtCLP(totalIngreso)}</div>
        </div>
        <div style={{ border: "1px solid #eee", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: GAP, padding: "7px 12px", background: "#f8f8f8", borderBottom: "1px solid #eee" }}>
            <div style={{ ...celdaTitulo, letterSpacing: 2, textTransform: "uppercase" }}>Fuente</div>
            <div style={{ ...celdaTitulo, textAlign: "right", paddingRight: PAD_MONTO, width: 120 - PAD_MONTO }}>$ Mensual</div>
          </div>
          {[{ k: "trabajo", l: "Trabajo principal", e: "🏢" }, { k: "emprendimiento", l: "Emprendimiento", e: "🛠️" }, { k: "reventa", l: "Reventa", e: "♻️" }, { k: "otros", l: "Otros", e: "➕" }].map((s, i) => (
            <div key={s.k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: GAP, padding: "11px 12px", borderBottom: i < 3 ? "1px dashed #f0f0f0" : "none", alignItems: "center", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <div style={celda({ fontSize: 13, color: "#333", display: "flex", alignItems: "center", gap: 6 })}><span>{s.e}</span><span>{s.l}</span></div>
              <AmountRow value={ing[s.k]} onSave={v => updIng(s.k, v)}/>
            </div>
          ))}
        </div>
      </div>
      <BudgetSec title="Gastos Base" emoji="🧱" rows={budget.gastos_base} secKey="gastos_base" subtotal={sumBase} canEdit onToggleCartera={toggleCartera} anual={proy.filas.gastos_base} {...secProps}/>
      <BudgetSec title="Fondos Personales" emoji="👤" rows={budget.personales} secKey="personales" subtotal={sumPers} canEdit={false} onOpenCartera={abrirCartera} anual={proy.filas.personales} {...secProps}/>
      <BudgetSec title="Fondos por Propósito" emoji="📦" rows={budget.propositos} secKey="propositos" subtotal={sumProp} canEdit onOpenCartera={abrirCartera} anual={proy.filas.propositos} {...secProps}/>
      <div style={{ border: "2px solid #111", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: GAP, padding: "12px 12px", background: "#111", alignItems: "center" }}>
          <div/>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: "#fff", fontWeight: 700 }}>Total distribuido</div>
          <div style={celda({ fontSize: 14, color: "#fff", fontWeight: 700, textAlign: "right", paddingRight: PAD_MONTO })}>{fmtCLP(totalGasto)}</div>
          <div style={celda({ fontSize: 12, color: "#888", textAlign: "right" })}>{T > 0 ? ((totalGasto / T) * 100).toFixed(1) : "-"}%</div>
          <div style={celda({ fontSize: 12, color: "#888", textAlign: "right" })}>{fmtCLP(anualTotal)}</div>
          <div/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: GAP, padding: "10px 12px", background: remainder < 0 ? "#fff5f5" : "#f9f9f9", alignItems: "center" }}>
          <div/>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: remainder < 0 ? "#c00" : "#555" }}>{remainder < 0 ? "⚠️ Déficit" : "Remanente"}</div>
          <div style={celda({ fontSize: 14, color: remainder < 0 ? "#c00" : "#111", fontWeight: 700, textAlign: "right", paddingRight: PAD_MONTO })}>{fmtCLP(Math.abs(remainder))}</div>
          <div style={celda({ fontSize: 12, color: "#aaa", textAlign: "right" })}>{T > 0 ? ((Math.abs(remainder) / T) * 100).toFixed(1) : "-"}%</div>
          <div/><div/>
        </div>
      </div>
      <div style={celda({ fontSize: 10, color: "#aaa", lineHeight: 1.5, padding: "4px 4px 0" })}>Proy. anual: los próximos 12 períodos con el monto asignado en cada mes. Los meses que aún no existen usan el promedio de {proy.mesesPromedio > 0 ? `los últimos ${proy.mesesPromedio} mes${proy.mesesPromedio > 1 ? "es" : ""} en registro` : "este mes (aún no hay registro)"}, contando como cero los meses sin presupuesto.</div>
      <div style={{ height: 32 }}/>
      </div>}
    </div>
  );
}

export default BudgetPage;
