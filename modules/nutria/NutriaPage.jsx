import { DEFAULT_INSUMOS, FORMULAS_PRODUCTOS, FORMULAS_ANGSTPOP, makeDefaultNutria, SALE_SIZES, FEE_CODICE } from "./defaults.js";
import { MONTH_NAMES } from "../../core/dates.js";
import { fmtCLP } from "../../core/format.js";
const { useState, useEffect, useRef, useMemo, useCallback } = React;


function NutriaPage({ data, saveData, budgets, onSaveBudget }) {
  const now = new Date();
  const [selEmp, setSelEmp] = useState(data.emprendimientos[0]||"Nutria Papelería");
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [subPage, setSubPage] = useState("ventas"); // "ventas" | "stats" | "costos"
  const [adding, setAdding] = useState(false);
  const EMPTY_NS = {producto:"",tamano:"",precio:"",nombre_tapa:"",tipo_agenda:"",diseno:"",tipo_despacho:"entrega",envio:{nombre:"",rut:"",direccion:"",correo:"",telefono:""},entrega:{nombre:"",direccion:"",telefono:""}};
  const [ns, setNs] = useState(EMPTY_NS);
  const [editingEmp, setEditingEmp] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editV, setEditV] = useState({});

  const monthV = data.ventas.filter(v=>{const d=new Date(v.fecha);return v.emprendimiento===selEmp&&d.getFullYear()===selYear&&d.getMonth()===selMonth;});
  const total = monthV.reduce((s,v)=>s+(v.precio||0),0);
  const yearV = data.ventas.filter(v=>{const d=new Date(v.fecha);return v.emprendimiento===selEmp&&d.getFullYear()===selYear;});

  function addVenta() {
    if (!ns.producto.trim()) return;
    const v = {id:Date.now().toString(), emprendimiento:selEmp, producto:ns.producto, tamano:ns.tamano, precio:parseInt(ns.precio)||0, fecha:new Date().toISOString(), nombre_tapa:ns.nombre_tapa, tipo_agenda:ns.tipo_agenda, diseno:ns.diseno, tipo_despacho:ns.tipo_despacho, envio:ns.tipo_despacho==="envio"?{...ns.envio}:{}, entrega:ns.tipo_despacho==="entrega"?{...ns.entrega}:{}};
    saveData({...data, ventas:[...data.ventas,v]});
    // Sync to presupuesto - add precio to emprendimiento income of that month
    if(onSaveBudget && v.precio && !isNaN(parseFloat(v.precio))) {
      const vDate = new Date(v.fecha||Date.now());
      const mk = `${vDate.getFullYear()}-${String(vDate.getMonth()+1).padStart(2,"0")}`;
      const existing = (budgets&&budgets[mk]) || makeDefaultBudget();
      const updatedBud = {
        ...existing,
        ingresos:{...existing.ingresos, emprendimiento:(existing.ingresos.emprendimiento||0)+parseFloat(v.precio)}
      };
      onSaveBudget(mk, updatedBud);
    }
    setNs(EMPTY_NS); setAdding(false);
  }
  function delVenta(id){saveData({...data,ventas:data.ventas.filter(v=>v.id!==id)});}
  function addEmp(){if(!newEmpName.trim())return;saveData({...data,emprendimientos:[...data.emprendimientos,newEmpName.trim()]});setNewEmpName("");setEditingEmp(false);}
  function saveEdit(id){saveData({...data,ventas:data.ventas.map(v=>v.id===id?{...v,...editV,envio:editV.envio||v.envio||{}}:v)});setEditId(null);setEditV({});}

  const prevMonth=()=>{const m=selMonth===0?11:selMonth-1;const y=selMonth===0?selYear-1:selYear;setSelMonth(m);setSelYear(y);};
  const nextMonth=()=>{const m=selMonth===11?0:selMonth+1;const y=selMonth===11?selYear+1:selYear;setSelMonth(m);setSelYear(y);};

  // ── Stats helpers ──
  function countBy(arr, key) {
    const map = {};
    arr.forEach(v=>{const k=v[key]||"—";map[k]=(map[k]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }
  function sumBy(arr, key) {
    const map = {};
    arr.forEach(v=>{const k=v[key]||"—";map[k]=(map[k]||0)+(v.precio||0);});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }

  // ── Costos helpers ──
  const costosData = data.costos || makeDefaultNutria().costos;
  const insumos = costosData.insumos || {};
  const preciosVenta = costosData.precios_venta || {};
  const preciosPop = costosData.precios_pop || {};
  const [editInsumoId, setEditInsumoId] = useState(null);
  const [editInsumoV, setEditInsumoV] = useState({});
  const [costosView, setCostosView] = useState("productos"); // "productos" | "angstpop" | "insumos" | "guia"
  const [openProducto, setOpenProducto] = useState(null);
  const [editPrecioId, setEditPrecioId] = useState(null);
  const [editPrecioV, setEditPrecioV] = useState("");

  function getUnitCost(id) {
    const ins = insumos[id] || DEFAULT_INSUMOS[id];
    if(!ins) return 0;
    const p = Number(ins.precio)||0;
    const d = Number(ins.divisor)||1;
    return d > 0 ? p / d : 0;
  }

  function calcCosto(formulas, formatoKey) {
    const formula = formulas[formatoKey];
    if(!formula) return { total:0, breakdown:[] };
    const breakdown = Object.entries(formula.materiales).map(([matId, qty]) => {
      const unitCost = getUnitCost(matId);
      const subtotal = unitCost * qty;
      const def = DEFAULT_INSUMOS[matId];
      return { matId, label:def?.label||matId, qty, unitCost, subtotal };
    });
    const total = breakdown.reduce((s,b)=>s+b.subtotal, 0);
    return { total, breakdown };
  }

  function saveInsumoEdit(id) {
    const current = insumos[id] || {};
    const updated = { ...current };
    if(editInsumoV.precio !== undefined) updated.precio = Number(editInsumoV.precio)||0;
    if(editInsumoV.divisor !== undefined) updated.divisor = Number(editInsumoV.divisor)||1;
    const newCostos = { ...costosData, insumos: { ...insumos, [id]: updated } };
    saveData({ ...data, costos: newCostos });
    setEditInsumoId(null); setEditInsumoV({});
  }

  function savePrecioVenta(formatoKey) {
    const newCostos = { ...costosData, precios_venta: { ...preciosVenta, [formatoKey]: Number(editPrecioV)||0 } };
    saveData({ ...data, costos: newCostos });
    setEditPrecioId(null); setEditPrecioV("");
  }

  function savePrecioPop(formatoKey, field, val) {
    const cur = preciosPop[formatoKey] || {};
    const newCostos = { ...costosData, precios_pop: { ...preciosPop, [formatoKey]: { ...cur, [field]: Number(val)||0 } } };
    saveData({ ...data, costos: newCostos });
  }

  const inpS = {border:"1px dashed #ddd",borderRadius:4,padding:"5px 8px",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fafafa",outline:"none",width:"100%",boxSizing:"border-box"};
  const TIPO_AGENDA = {
    "Angst Papelería": ["Agenda personalizada","Planner","Moi Memoir","Cuaderno"],
    "Nutria Papelería": ["Agenda pediátrica","Libro de recuerdos del bebé","Planner","Agenda docente","Mis recuerdos baby shower","Agenda mi embarazo"],
  };
  const AGENDA_SIZES = {
    "Libro de recuerdos del bebé": ["19x25"],
    "Mis recuerdos baby shower": ["19x25"],
    "Moi Memoir": ["19x25"],
  };
  const tipoAgendaOpts = TIPO_AGENDA[selEmp] || ["Agenda","Planner","Cuaderno","Otro"];

  return (
    <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
      {/* Emprendimiento tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {data.emprendimientos.map(emp=>(
          <button key={emp} onClick={()=>setSelEmp(emp)} style={{fontFamily:"'Caveat',cursive",fontSize:17,padding:"5px 14px",borderRadius:20,cursor:"pointer",background:selEmp===emp?"#111":"transparent",color:selEmp===emp?"#fff":"#555",border:selEmp===emp?"none":"1px dashed #ddd",transition:"all 0.15s"}}>{emp.toLowerCase()}</button>
        ))}
        {editingEmp ? (
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input autoFocus value={newEmpName} onChange={e=>setNewEmpName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addEmp();}} placeholder="nombre..." style={{...inpS,width:130}}/>
            <button onClick={addEmp} style={{background:"#111",color:"#fff",border:"none",borderRadius:4,padding:"5px 10px",cursor:"pointer",fontSize:12}}>✓</button>
            <button onClick={()=>setEditingEmp(false)} style={{background:"transparent",border:"none",color:"#999",fontSize:18,cursor:"pointer"}}>×</button>
          </div>
        ) : (
          <button onClick={()=>setEditingEmp(true)} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",background:"transparent",border:"1px dashed #eee",borderRadius:12,padding:"4px 10px",cursor:"pointer"}}>+ emprendimiento</button>
        )}
      </div>

      {/* Sub-page nav */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[{k:"ventas",label:"📋 Ventas"},{k:"stats",label:"📊 Estadísticas"},{k:"costos",label:"🧮 Costos"}].map(({k,label})=>(
          <button key={k} onClick={()=>setSubPage(k)} style={{fontFamily:"'Caveat',cursive",fontSize:15,padding:"6px 16px",borderRadius:20,cursor:"pointer",background:subPage===k?"#111":"transparent",color:subPage===k?"#fff":"#555",border:subPage===k?"none":"1px dashed #ccc",transition:"all 0.15s"}}>{label}</button>
        ))}
      </div>

      {/* ══════════════ VENTAS ══════════════ */}
      {subPage==="ventas"&&(
        <>
          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,background:"#fafafa",borderRadius:10,padding:"8px 14px",border:"1px dashed #eee"}}>
            <button onClick={prevMonth} style={{background:"transparent",border:"none",color:"#999",fontSize:22,cursor:"pointer",lineHeight:1}}>‹</button>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#555",fontWeight:700}}>{MONTH_NAMES[selMonth]} {selYear}</div>
            <button onClick={nextMonth} style={{background:"transparent",border:"none",color:"#999",fontSize:22,cursor:"pointer",lineHeight:1}}>›</button>
          </div>
          {/* Summary header */}
          <div style={{background:"#111",borderRadius:"8px 8px 0 0",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#fff",fontWeight:700}}>{selEmp.toLowerCase()}</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666",letterSpacing:1}}>{monthV.length} ventas</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#fff",fontWeight:700}}>{fmtCLP(total)}</div>
            </div>
          </div>
          {/* Sales list */}
          <div style={{border:"1px solid #eee",borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden",marginBottom:8}}>
            {/* Header */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 68px 80px 26px",padding:"7px 12px",background:"#f9f9f9",borderBottom:"1px solid #f0f0f0"}}>
              {["Producto","Tamaño","Precio",""].map((h,i)=><div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",textAlign:i>1?"right":"left"}}>{h}</div>)}
            </div>
            {monthV.length===0&&!adding&&(
              <div style={{padding:"32px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:17,color:"#ddd"}}>sin ventas este mes</div>
            )}
            {monthV.map((v,i)=>(
              <div key={v.id} style={{borderBottom:i<monthV.length-1||adding?"1px dashed #f5f5f5":"none"}}>
                {editId===v.id ? (
                  <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:6}}>
                      <input value={editV.producto??v.producto} onChange={e=>setEditV(ev=>({...ev,producto:e.target.value}))} style={inpS} placeholder="Producto"/>
                      <input value={editV.precio??v.precio} onChange={e=>setEditV(ev=>({...ev,precio:e.target.value}))} style={inpS} placeholder="Precio"/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <input value={editV.nombre_tapa??v.nombre_tapa??""} onChange={e=>setEditV(ev=>({...ev,nombre_tapa:e.target.value}))} style={inpS} placeholder="Nombre en tapa"/>
                      <select value={editV.tipo_agenda??v.tipo_agenda??""} onChange={e=>setEditV(ev=>({...ev,tipo_agenda:e.target.value}))} style={inpS}>
                        <option value="">— tipo de agenda —</option>
                        {tipoAgendaOpts.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                      <input value={editV.diseno??v.diseno??""} onChange={e=>setEditV(ev=>({...ev,diseno:e.target.value}))} style={inpS} placeholder="Diseño / portada"/>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1}}>Tamaño</span>
                      {SALE_SIZES.map(sz=>(
                        <button key={sz} onClick={()=>setEditV(ev=>({...ev,tamano:ev.tamano===sz?"":sz}))} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"3px 10px",borderRadius:12,cursor:"pointer",background:(editV.tamano??v.tamano)===sz?"#111":"transparent",color:(editV.tamano??v.tamano)===sz?"#fff":"#777",border:"1px dashed #ccc"}}>{sz}</button>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb"}}>Despacho:</span>
                      {["entrega","envio"].map(t=>(
                        <button key={t} onClick={()=>setEditV(ev=>({...ev,tipo_despacho:t}))} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"3px 10px",borderRadius:12,cursor:"pointer",background:(editV.tipo_despacho??v.tipo_despacho??"entrega")===t?"#111":"transparent",color:(editV.tipo_despacho??v.tipo_despacho??"entrega")===t?"#fff":"#777",border:"1px dashed #ccc"}}>{t==="envio"?"📦 Envío":"🤝 Entrega"}</button>
                      ))}
                    </div>
                    {(editV.tipo_despacho??v.tipo_despacho)==="envio"&&(
                      <div style={{background:"#f9f9f9",borderRadius:8,padding:"10px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {[["nombre","Nombre"],["rut","RUT"],["direccion","Dirección"],["correo","Correo"],["telefono","Teléfono"]].map(([k,lbl])=>(
                          <input key={k} value={(editV.envio||v.envio||{})[k]||""} onChange={e=>setEditV(ev=>({...ev,envio:{...(ev.envio||v.envio||{}),[k]:e.target.value}}))} style={{...inpS,gridColumn:k==="direccion"?"1/3":undefined}} placeholder={lbl}/>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                      <button onClick={()=>{setEditId(null);setEditV({});}} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:6,padding:"5px 14px",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#999"}}>cancelar</button>
                      <button onClick={()=>saveEdit(v.id)} style={{background:"#111",border:"none",borderRadius:6,padding:"5px 16px",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#fff"}}>guardar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{padding:"10px 12px",cursor:"pointer"}} onClick={()=>{setEditId(v.id);setEditV({});}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 68px 80px 26px",alignItems:"center"}}>
                      <div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333"}}>{v.producto}</div>
                        <div style={{display:"flex",gap:8,marginTop:2,flexWrap:"wrap"}}>
                          {v.nombre_tapa&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#999"}}>✏️ {v.nombre_tapa}</span>}
                          {v.tipo_agenda&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa"}}>📖 {v.tipo_agenda}</span>}
                          {v.diseno&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>🎨 {v.diseno}</span>}
                          {v.tipo_despacho==="entrega"&&(v.entrega||{}).nombre&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#888"}}>🤝 {(v.entrega||{}).nombre}</span>}
                          {v.tipo_despacho==="envio"&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#5c7a99"}}>📦 {(v.envio||{}).nombre||"envío"}</span>}
                        </div>
                      </div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#888",textAlign:"center"}}>{v.tamano||"—"}</div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#111",fontWeight:600,textAlign:"right"}}>{fmtCLP(v.precio||0)}</div>
                      <button onClick={e=>{e.stopPropagation();delVenta(v.id);}} style={{background:"transparent",border:"none",color:"#e0e0e0",fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Add form */}
            {adding&&(
              <div style={{padding:"14px 12px",borderTop:"1px dashed #eee",background:"#fafafa",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:8}}>
                  <input autoFocus value={ns.producto} onChange={e=>setNs(s=>({...s,producto:e.target.value}))} placeholder="Producto / tipo de agenda" style={inpS}/>
                  <input value={ns.precio} onChange={e=>setNs(s=>({...s,precio:e.target.value}))} placeholder="$ precio" style={inpS}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <input value={ns.nombre_tapa} onChange={e=>setNs(s=>({...s,nombre_tapa:e.target.value}))} placeholder="Nombre en tapa" style={inpS}/>
  <select value={ns.tipo_agenda} onChange={e=>{const ta=e.target.value;const sizes=AGENDA_SIZES[ta];setNs(s=>({...s,tipo_agenda:ta,tamano:sizes?sizes[0]:s.tamano}));}} style={inpS}>
                    <option value="">— tipo de agenda —</option>
                    {tipoAgendaOpts.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <input value={ns.diseno} onChange={e=>setNs(s=>({...s,diseno:e.target.value}))} placeholder="Diseño / portada" style={inpS}/>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1}}>Tamaño</span>
                  {SALE_SIZES.map(sz=>(
                    <button key={sz} onClick={()=>setNs(s=>({...s,tamano:s.tamano===sz?"":sz}))} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"3px 10px",borderRadius:12,cursor:"pointer",background:ns.tamano===sz?"#111":"transparent",color:ns.tamano===sz?"#fff":"#777",border:"1px dashed #ccc"}}>{sz}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb"}}>Despacho:</span>
                  {["entrega","envio"].map(t=>(
                    <button key={t} onClick={()=>setNs(s=>({...s,tipo_despacho:t}))} style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,padding:"5px 14px",borderRadius:20,cursor:"pointer",background:ns.tipo_despacho===t?"#111":"transparent",color:ns.tipo_despacho===t?"#fff":"#777",border:"1px dashed #ccc",transition:"all 0.15s"}}>{t==="envio"?"📦 Envío":"🤝 Entrega"}</button>
                  ))}
                </div>
                {ns.tipo_despacho==="entrega"&&(
                  <div style={{background:"#fafafa",border:"1px dashed #eee",borderRadius:8,padding:"10px",display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>Quién recibe</div>
                    <input value={ns.entrega.nombre} onChange={e=>setNs(s=>({...s,entrega:{...s.entrega,nombre:e.target.value}}))} style={inpS} placeholder="Nombre"/>
                    <input value={ns.entrega.direccion} onChange={e=>setNs(s=>({...s,entrega:{...s.entrega,direccion:e.target.value}}))} style={inpS} placeholder="Dirección"/>
                    <input value={ns.entrega.telefono} onChange={e=>setNs(s=>({...s,entrega:{...s.entrega,telefono:e.target.value}}))} style={inpS} placeholder="Teléfono"/>
                  </div>
                )}
                {ns.tipo_despacho==="envio"&&(
                  <div style={{background:"#fff",border:"1px dashed #ddd",borderRadius:8,padding:"10px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    <div style={{gridColumn:"1/3",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>Datos de envío</div>
                    {[["nombre","Nombre completo"],["rut","RUT"],["direccion","Dirección completa"],["correo","Correo electrónico"],["telefono","Teléfono"]].map(([k,lbl])=>(
                      <input key={k} value={ns.envio[k]} onChange={e=>setNs(s=>({...s,envio:{...s.envio,[k]:e.target.value}}))} style={{...inpS,gridColumn:k==="direccion"||k==="correo"?"1/3":undefined}} placeholder={lbl}/>
                    ))}
                  </div>
                )}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button onClick={()=>{setAdding(false);setNs(EMPTY_NS);}} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:6,padding:"6px 16px",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#999"}}>cancelar</button>
                  <button onClick={addVenta} style={{background:"#111",border:"none",borderRadius:6,padding:"6px 20px",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#fff",fontWeight:600}}>+ agregar</button>
                </div>
              </div>
            )}
            {!adding&&(
              <div style={{padding:"10px 12px",borderTop:monthV.length>0?"1px dashed #eee":"none"}}>
                <button onClick={()=>setAdding(true)} style={{width:"100%",background:"transparent",border:"1px dashed #ccc",borderRadius:6,padding:"8px",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:16,color:"#bbb"}}>+ registrar venta</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ ESTADÍSTICAS ══════════════ */}
      {subPage==="stats"&&(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <button onClick={()=>setSelYear(y=>y-1)} style={{background:"transparent",border:"none",color:"#999",fontSize:22,cursor:"pointer"}}>‹</button>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#555",fontWeight:700}}>{selYear}</div>
            <button onClick={()=>setSelYear(y=>y+1)} style={{background:"transparent",border:"none",color:"#999",fontSize:22,cursor:"pointer"}}>›</button>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",marginLeft:4}}>{yearV.length} ventas</div>
          </div>
          {yearV.length===0?(
            <div style={{padding:"40px",textAlign:"center",fontFamily:"'Caveat',cursive",fontSize:17,color:"#ddd"}}>sin ventas en {selYear}</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {[
                {title:"Por tamaño",data:countBy(yearV,"tamano"),icon:"📐"},
                {title:"Por tipo de agenda",data:countBy(yearV,"tipo_agenda"),icon:"📖"},
                {title:"Por diseño / portada",data:countBy(yearV,"diseno"),icon:"🎨"},
                {title:"Por nombre en tapa",data:countBy(yearV,"nombre_tapa"),icon:"✏️"},
                {title:"Por tipo de despacho",data:countBy(yearV,"tipo_despacho"),icon:"📦"},
              ].map(({title,data:rows,icon})=>{
                const max=Math.max(...rows.map(r=>r[1]),1);
                return (
                  <div key={title} style={{border:"1px dashed #eee",borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:"#111",padding:"10px 16px",fontFamily:"'Caveat',cursive",fontSize:17,color:"#fff",fontWeight:700}}>{icon} {title}</div>
                    <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                      {rows.map(([k,count])=>(
                        <div key={k} style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",width:110,flexShrink:0}}>{k}</div>
                          <div style={{flex:1,background:"#f5f5f5",borderRadius:4,height:14,overflow:"hidden"}}>
                            <div style={{width:`${(count/max)*100}%`,height:"100%",background:"#111",borderRadius:4,transition:"width 0.3s"}}/>
                          </div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#111",fontWeight:600,width:24,textAlign:"right"}}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div style={{border:"1px dashed #eee",borderRadius:10,overflow:"hidden"}}>
                <div style={{background:"#111",padding:"10px 16px",fontFamily:"'Caveat',cursive",fontSize:17,color:"#fff",fontWeight:700}}>💵 Ingresos por mes</div>
                <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:4}}>
                  {MONTH_NAMES.map((mn,mi)=>{
                    const mv=yearV.filter(v=>new Date(v.fecha).getMonth()===mi);
                    const mTotal=mv.reduce((s,v)=>s+(v.precio||0),0);
                    const maxT=Math.max(...MONTH_NAMES.map((_,i)=>yearV.filter(v=>new Date(v.fecha).getMonth()===i).reduce((s,v)=>s+(v.precio||0),0)),1);
                    if(mv.length===0)return null;
                    return(
                      <div key={mi} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555",width:30,flexShrink:0}}>{mn.slice(0,3)}</div>
                        <div style={{flex:1,background:"#f5f5f5",borderRadius:4,height:14,overflow:"hidden"}}>
                          <div style={{width:`${(mTotal/maxT)*100}%`,height:"100%",background:"#4caf50",borderRadius:4}}/>
                        </div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#111",fontWeight:600,width:70,textAlign:"right"}}>{fmtCLP(mTotal)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ COSTOS ══════════════ */}
      {subPage==="costos"&&(
        <div>
          {/* Vista toggle */}
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {[{k:"productos",label:"📦 Agendas"},{k:"angstpop",label:"🎪 Angst Pop"},{k:"insumos",label:"🧪 Insumos"},{k:"guia",label:"📐 Guía de corte"}].map(({k,label})=>(
              <button key={k} onClick={()=>setCostosView(k)} style={{fontFamily:"'Caveat',cursive",fontSize:15,padding:"5px 14px",borderRadius:20,cursor:"pointer",background:costosView===k?"#111":"transparent",color:costosView===k?"#fff":"#555",border:costosView===k?"none":"1px dashed #ccc",transition:"all 0.15s"}}>{label}</button>
            ))}
          </div>

          {/* ── AGENDAS ── */}
          {costosView==="productos"&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {Object.entries(FORMULAS_PRODUCTOS).map(([fKey,formula])=>{
                const {total,breakdown} = calcCosto(FORMULAS_PRODUCTOS, fKey);
                const open = openProducto===fKey;
                const pventa = preciosVenta[fKey] ?? formula.precio_venta;
                const margen = pventa - FEE_CODICE;
                const armado = FEE_CODICE - total;
                return (
                  <div key={fKey} style={{border:"1px dashed #ddd",borderRadius:10,overflow:"hidden"}}>
                    <div onClick={()=>setOpenProducto(open?null:fKey)} style={{background:"#111",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                      <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#fff",fontWeight:700}}>{formula.label}</div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)"}}>mat. {fmtCLP(total)}</div>
                        <span style={{color:"#555",fontSize:12}}>{open?"▲":"▼"}</span>
                      </div>
                    </div>
                    {open&&(
                      <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                        {/* Desglose materiales */}
                        {breakdown.map(({matId,label,qty,subtotal})=>(
                          <div key={matId} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#666"}}>{label}</div>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",width:55,textAlign:"right"}}>×{qty%1===0?qty:qty.toFixed(1)}</div>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",width:65,textAlign:"right"}}>{fmtCLP(subtotal)}</div>
                          </div>
                        ))}
                        {/* Resumen financiero */}
                        <div style={{borderTop:"1px dashed #eee",marginTop:6,paddingTop:8,display:"flex",flexDirection:"column",gap:5}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>Materiales</span>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555"}}>{fmtCLP(total)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>Armado Códice</span>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:armado<0?"#e53935":"#555"}}>{fmtCLP(Math.max(armado,0))}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px dashed #eee",paddingTop:5}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",fontWeight:600}}>Fee Códice</span>
                            <span style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#111",fontWeight:700}}>{fmtCLP(FEE_CODICE)}</span>
                          </div>
                          {/* Precio venta editable */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>Precio venta</span>
                            {editPrecioId===fKey?(
                              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                <input autoFocus value={editPrecioV} onChange={e=>setEditPrecioV(e.target.value)}
                                  onKeyDown={e=>{if(e.key==="Enter")savePrecioVenta(fKey);if(e.key==="Escape"){setEditPrecioId(null);setEditPrecioV("");}}}
                                  style={{width:80,border:"1px dashed #ccc",borderRadius:4,padding:"2px 6px",fontSize:12,fontFamily:"'DM Sans',sans-serif",textAlign:"right",outline:"none",color:"#111"}}/>
                                <button onClick={()=>savePrecioVenta(fKey)} style={{background:"#111",color:"#fff",border:"none",borderRadius:4,padding:"2px 7px",cursor:"pointer",fontSize:11}}>✓</button>
                              </div>
                            ):(
                              <span onClick={()=>{setEditPrecioId(fKey);setEditPrecioV(pventa);}} style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#2e7d52",fontWeight:700,cursor:"pointer",borderBottom:"1px dashed #ccc"}}>{fmtCLP(pventa)}</span>
                            )}
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",background:"#111",borderRadius:6,padding:"8px 10px",marginTop:4}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>TU MARGEN</span>
                            <span style={{fontFamily:"'Caveat',cursive",fontSize:20,color:margen>=0?"#4caf50":"#e53935",fontWeight:700}}>{fmtCLP(margen)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ANGST POP ── */}
          {costosView==="angstpop"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {Object.entries(FORMULAS_ANGSTPOP).map(([fKey,formula])=>{
                const {total,breakdown} = calcCosto(FORMULAS_ANGSTPOP, fKey);
                const pp = preciosPop[fKey] || {precio_venta:formula.precio_venta,precio_pack:formula.precio_pack};
                const margenUnit = pp.precio_venta - total;
                const margenPack = pp.precio_pack - (total * formula.pack);
                const open = openProducto===("pop_"+fKey);
                return (
                  <div key={fKey} style={{border:"1px dashed #ddd",borderRadius:10,overflow:"hidden"}}>
                    <div onClick={()=>setOpenProducto(open?null:("pop_"+fKey))} style={{background:"#1a1a2e",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                      <div style={{fontFamily:"'Caveat',cursive",fontSize:17,color:"#fff",fontWeight:700}}>{formula.label}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)"}}>mat. {fmtCLP(total)}</span>
                        <span style={{color:"#555",fontSize:12}}>{open?"▲":"▼"}</span>
                      </div>
                    </div>
                    {open&&(
                      <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
                        {/* Desglose materiales */}
                        {breakdown.filter(b=>b.subtotal>0).map(({matId,label,qty,subtotal})=>(
                          <div key={matId} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#666"}}>{label}</div>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",width:55,textAlign:"right"}}>×{qty%1===0?qty:qty.toFixed(2)}</div>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",width:65,textAlign:"right"}}>{fmtCLP(subtotal)}</div>
                          </div>
                        ))}
                        <div style={{borderTop:"1px dashed #eee",paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>Costo materiales</span>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",fontWeight:600}}>{fmtCLP(total)}</span>
                        </div>
                        {/* Precios y márgenes */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          <div style={{background:"#f9f9f9",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,marginBottom:6}}>UNITARIO</div>
                            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#111",fontWeight:700}}>{fmtCLP(pp.precio_venta)}</div>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:margenUnit>=0?"#2e7d52":"#e53935",marginTop:2}}>margen {fmtCLP(margenUnit)}</div>
                          </div>
                          <div style={{background:"#f9f9f9",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,marginBottom:6}}>PACK ×{formula.pack}</div>
                            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#111",fontWeight:700}}>{fmtCLP(pp.precio_pack)}</div>
                            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:margenPack>=0?"#2e7d52":"#e53935",marginTop:2}}>margen {fmtCLP(margenPack)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── INSUMOS ── */}
          {costosView==="insumos"&&(
            <div style={{border:"1px dashed #ddd",borderRadius:10,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 80px 60px 70px",padding:"7px 12px",background:"#f9f9f9",borderBottom:"1px solid #f0f0f0"}}>
                {["Insumo","Compra","Divid.","Unitario"].map((h,i)=>(
                  <div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",textAlign:i>0?"right":"left"}}>{h}</div>
                ))}
              </div>
              {Object.entries(DEFAULT_INSUMOS).map(([id,def],i,arr)=>{
                const ins = insumos[id] || {precio:def.precio,divisor:def.divisor};
                const unitCost = (Number(ins.precio)||0) / (Number(ins.divisor)||1);
                const isEdit = editInsumoId===id;
                return (
                  <div key={id} style={{borderBottom:i<arr.length-1?"1px dashed #f5f5f5":"none"}}>
                    {isEdit ? (
                      <div style={{display:"grid",gridTemplateColumns:"1fr 80px 60px 70px",padding:"8px 12px",gap:4,alignItems:"center",background:"#fafafa"}}>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#333"}}>{def.label}</div>
                        <input value={editInsumoV.precio??ins.precio} onChange={e=>setEditInsumoV(v=>({...v,precio:e.target.value}))}
                          style={{border:"1px dashed #ccc",borderRadius:4,padding:"3px 6px",fontSize:12,fontFamily:"'DM Sans',sans-serif",textAlign:"right",outline:"none",background:"#fff",color:"#111"}}/>
                        <input value={editInsumoV.divisor??ins.divisor} onChange={e=>setEditInsumoV(v=>({...v,divisor:e.target.value}))}
                          style={{border:"1px dashed #ccc",borderRadius:4,padding:"3px 6px",fontSize:12,fontFamily:"'DM Sans',sans-serif",textAlign:"right",outline:"none",background:"#fff",color:"#111"}}/>
                        <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                          <button onClick={()=>saveInsumoEdit(id)} style={{background:"#111",color:"#fff",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11}}>✓</button>
                          <button onClick={()=>{setEditInsumoId(null);setEditInsumoV({});}} style={{background:"transparent",border:"none",color:"#bbb",fontSize:14,cursor:"pointer",lineHeight:1}}>×</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={()=>{setEditInsumoId(id);setEditInsumoV({});}} style={{display:"grid",gridTemplateColumns:"1fr 80px 60px 70px",padding:"9px 12px",alignItems:"center",cursor:"pointer"}}>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#333"}}>{def.label}</div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",textAlign:"right"}}>{fmtCLP(Number(ins.precio)||0)}</div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",textAlign:"right"}}>{ins.divisor}</div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#111",fontWeight:600,textAlign:"right"}}>{fmtCLP(unitCost)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── GUÍA DE CORTE ── */}
          {costosView==="guia"&&(
            <div style={{border:"1px dashed #ddd",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#111",padding:"10px 14px"}}>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#fff",fontWeight:700}}>📐 Guía de corte</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>tipo y tamaño de resma · corte · unidades por pliego</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",padding:"7px 12px",background:"#f9f9f9",borderBottom:"1px solid #f0f0f0"}}>
                {["Resma","Corte","x pliego","Total"].map((h,i)=>(
                  <div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",textAlign:i>0?"right":"left"}}>{h}</div>
                ))}
              </div>
              {(data.guiaCorte||makeDefaultNutria().guiaCorte).map((row,i,arr)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",padding:"9px 12px",borderBottom:i<arr.length-1?"1px dashed #f5f5f5":"none",alignItems:"center"}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#333"}}>{row.resma}</div>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"#111",fontWeight:700,textAlign:"right"}}>{row.corte}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",textAlign:"right"}}>{row.unidadPliego}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#888",textAlign:"right"}}>{row.totalHojas?.toLocaleString("es-CL")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NutriaPage;
