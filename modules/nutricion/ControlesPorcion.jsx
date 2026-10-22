// Controles de porción (comida + calibre/fracción/cantidad + kcal resultantes).
// Compartido por NutricionPage (modal de alimento) e IngestaRapida (➕ Registrar).
import { MEALS, FRUIT_FRACTIONS, calcPorcion } from "./ingesta.js";

function ControlesPorcion({ food, qty, setQty, fraction, setFraction, sizeKey, setSizeKey, meal, setMeal }) {
    const pt = food.portionType;
    const eff = calcPorcion(food, qty, fraction, sizeKey);
    const btnBase = {border:"1px dashed #ddd",borderRadius:8,background:"transparent",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"8px 12px",transition:"all 0.15s"};
    const btnActive = {...btnBase, background:"#111", color:"#fff", border:"1px solid #111"};

    return (
      <div>
        {/* Comida del día */}
        <div style={{marginBottom:18}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>comida</div>
          <div style={{display:"flex",gap:6}}>
            {MEALS.map(m=>(
              <button key={m.id} onClick={()=>setMeal(m.id)}
                style={{flex:1,padding:"8px 4px",borderRadius:8,border:"1.5px solid",borderColor:meal===m.id?"#111":"#eee",background:meal===m.id?"#111":"transparent",color:meal===m.id?"#fff":"#999",fontFamily:"'Caveat',cursive",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* SIZE selector — frutas */}
        {pt === "size" && (
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>calibre</div>
            <div style={{display:"flex",gap:8}}>
              {[["S","~100g"],["M","~150g"],["L","~200g"]].map(([k,sub])=>(
                <button key={k} onClick={()=>setSizeKey(k)} style={sizeKey===k?btnActive:btnBase}>
                  <div style={{fontWeight:700}}>{k}</div>
                  <div style={{fontSize:10,color:sizeKey===k?"rgba(255,255,255,0.5)":"#bbb"}}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CALIBRE selector — palta */}
        {pt === "calibre" && (
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>calibre</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["S","~120g"],["M","~175g"],["L","~245g"],["XL","~350g"]].map(([k,sub])=>(
                <button key={k} onClick={()=>setSizeKey(k)} style={sizeKey===k?btnActive:btnBase}>
                  <div style={{fontWeight:700}}>{k}</div>
                  <div style={{fontSize:10,color:sizeKey===k?"rgba(255,255,255,0.5)":"#bbb"}}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FRACTION selector — bolognesa, palta y frutas grandes */}
        {(pt === "fraction" || pt === "calibre" || pt === "size") && (
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>porción</div>
            <div style={{display:"flex",gap:8}}>
              {(pt==="fraction"
                ? [[1,"completa"],[0.5,"½"],[2/3,"⅔"],[0.333,"⅓"],[0.25,"¼"]]
                : pt==="calibre"
                  ? [[1,"entera"],[0.5,"½"],[0.25,"¼"]]
                  : FRUIT_FRACTIONS
              ).map(([f,label])=>(
                <button key={f} onClick={()=>setFraction(f)} style={fraction===f?btnActive:btnBase}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {/* WEIGHT100 — qty en pasos de 50g, con atajos comunes */}
        {pt === "weight100" && (
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>cantidad</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24}}>
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:44,height:44,borderRadius:8,border:"1px dashed #ddd",background:"transparent",fontSize:22,cursor:"pointer",color:"#555"}}>−</button>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:44,fontWeight:700,color:"#111",minWidth:90,textAlign:"center"}}>{qty*50}g</span>
              <button onClick={()=>setQty(q=>Math.min(20,q+1))} style={{width:44,height:44,borderRadius:8,border:"1px dashed #ddd",background:"transparent",fontSize:22,cursor:"pointer",color:"#555"}}>+</button>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:10,flexWrap:"wrap"}}>
              {[50,100,150,200,300].map(g=>(
                <button key={g} onClick={()=>setQty(g/50)}
                  style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"4px 11px",borderRadius:14,border:"1px dashed #ddd",background:qty===g/50?"#111":"transparent",color:qty===g/50?"#fff":"#999",cursor:"pointer"}}>{g}g</button>
              ))}
            </div>
          </div>
        )}

        {/* DEFAULT qty — items sin portionType */}
        {!pt && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,marginBottom:16}}>
            <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:44,height:44,borderRadius:8,border:"1px dashed #ddd",background:"transparent",fontSize:22,cursor:"pointer",color:"#555"}}>−</button>
            <span style={{fontFamily:"'Caveat',cursive",fontSize:44,fontWeight:700,color:"#111",minWidth:48,textAlign:"center"}}>{qty}</span>
            <button onClick={()=>setQty(q=>Math.min(10,q+1))} style={{width:44,height:44,borderRadius:8,border:"1px dashed #ddd",background:"transparent",fontSize:22,cursor:"pointer",color:"#555"}}>+</button>
          </div>
        )}

        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#888",textAlign:"center",marginBottom:20}}>
          <span style={{color:"#111",fontWeight:700}}>{Math.round(eff.kcal)} kcal</span> · <span style={{color:"#5c7a99",fontWeight:700}}>{eff.prot.toFixed(1)}g prot</span>
        </div>
      </div>
    );
}

export default ControlesPorcion;
