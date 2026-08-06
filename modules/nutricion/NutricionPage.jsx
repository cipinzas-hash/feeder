const { useState, useEffect, useRef, useMemo, useCallback } = React;

const NUTRI_FOODS = {
  proteinas:[
    {id:"carne",    emoji:"🥩", name:"Bolognesa casera",   prep:"carne 7% · 2 cebollas · aceite oliva · salsa Merkat 200g", unit:"preparación completa", kcal:582, prot:58, portionType:"fraction"},
    {id:"huevo-d",  emoji:"🥚", name:"Huevo duro",         prep:"cocido con sal · calibre XL ~63g",            unit:"unidad XL",      kcal:90,  prot:7.8},
    {id:"tortilla", emoji:"🍳", name:"Tortilla de huevo",  prep:"1 huevo XL · chorrito aceite · sal",          unit:"unidad",         kcal:112, prot:7.8},
    {id:"soya-mv",  emoji:"🫘", name:"Hamb. soya Mr. Veggies", prep:"100g · receta actual",                   unit:"unidad 100g",    kcal:147, prot:16},
    {id:"pollo",    emoji:"🍗", name:"Pollo",              prep:"filetillo o pechuga · horneado o sartén · sin grasa", unit:"100g", kcal:110, prot:23, portionType:"weight100"},
    {id:"pavo",     emoji:"🍖", name:"Jamón de pavo",      prep:"1 lámina ~20g",                               unit:"lámina",         kcal:22,  prot:3},
  ],
  carbos:[
    {id:"arroz",    emoji:"🍚", name:"Arroz",              prep:"cucharadita aceite · cúrcuma · ajo · sal",    unit:"100g cocido",    kcal:130, prot:2.2, portionType:"weight100"},
    {id:"fideos",   emoji:"🍝", name:"Fideos Merkat",      prep:"cocidos en agua con sal",                     unit:"100g cocido",    kcal:130, prot:4.2, portionType:"weight100"},
    {id:"lentejas", emoji:"🫘", name:"Lentejas",           prep:"cocidas con sal y condimentos",               unit:"100g cocida",    kcal:116, prot:9,   portionType:"weight100"},
  ],
  panes:[
    {id:"marraq",   emoji:"🥖", name:"Marraqueta",         prep:"Bredenmaster congelada · 105g",               unit:"unidad",         kcal:265, prot:9},
    {id:"hallulla", emoji:"🫓", name:"Hallulla La Celeste", prep:"unidad 75g",                                  unit:"unidad",         kcal:207, prot:5.6},
    {id:"ciabatta", emoji:"🥖", name:"Ciabatta",           prep:"unidad completa",                             unit:"unidad",         kcal:210, prot:7},
    {id:"bocadama", emoji:"🥐", name:"Bocado de dama",     prep:"unidad pequeña ~40g",                         unit:"unidad",         kcal:125, prot:3.5},
  ],
  frutas:[
    {id:"platano",  emoji:"🍌", name:"Plátano",            prep:"S=100g · M=150g · L=200g",                    unit:"unidad",         kcal:89,  prot:1.1, portionType:"size"},
    {id:"manzana",  emoji:"🍎", name:"Manzana Pink Lady",  prep:"S=100g · M=150g · L=200g",                    unit:"unidad",         kcal:57,  prot:0.3, portionType:"size"},
    {id:"frutillas",emoji:"🍓", name:"Frutillas",          prep:"S=100g · M=150g · L=200g",                    unit:"porción",        kcal:33,  prot:0.7, portionType:"size"},
    {id:"naranja",  emoji:"🍊", name:"Naranja",            prep:"S=100g · M=150g · L=200g",                    unit:"unidad",         kcal:47,  prot:0.9, portionType:"size"},
  ],
  lacteos:[
    {id:"yogurg",   emoji:"🥛", name:"Yogur griego Oikos", prep:"natural · envase 110g",                       unit:"envase",         kcal:100, prot:5.6},
    {id:"yogurb",   emoji:"🥤", name:"Yogur batido",       prep:"Alerces o Colun · vaso",                      unit:"vaso",           kcal:130, prot:3.7},
  ],
  grasas:[
    {id:"palta",    emoji:"🥑", name:"Palta",              prep:"S=120g · M=175g · L=245g · XL=350g",         unit:"entera",         kcal:192, prot:2.4, portionType:"calibre"},
  ],
  bebidas:[
    {id:"cafe-s",   emoji:"☕", name:"Café negro simple",  prep:"sin azúcar",                                  unit:"taza",           kcal:5,   prot:0},
    {id:"cafe-d",   emoji:"☕", name:"Café negro doble",   prep:"sin azúcar · 2 shots",                        unit:"taza",           kcal:10,  prot:0},
    {id:"azucar",   emoji:"🍬", name:"Azúcar",             prep:"1 cucharadita",                               unit:"cdta",           kcal:16,  prot:0},
    {id:"livean",   emoji:"💧", name:"Livean",             prep:"jugo en polvo · libre de calorías",           unit:"vaso",           kcal:4,   prot:0},
  ],
  snacks:[
    {id:"wild",     emoji:"🍫", name:"Barra Wild",         prep:"Chocolate-Maní · 45g",                        unit:"barra",          kcal:179, prot:15},
    {id:"mani-jp",  emoji:"🥜", name:"Maní japonés",       prep:"porción 30g",                                 unit:"30g",            kcal:150, prot:5},
    {id:"quinoa-p", emoji:"🌾", name:"Quinoa pop",         prep:"porción 30g",                                 unit:"30g",            kcal:110, prot:4},
  ],
  comfortfood:[
    {id:"mustang",  emoji:"🍦", name:"Helado Mustang Clásico", prep:"paleta fruta · 110ml",                    unit:"paleta",         kcal:211, prot:3},
    {id:"sopaip",   emoji:"🍩", name:"Sopaipilla frita",   prep:"unidad ~60g",                                 unit:"unidad",         kcal:239, prot:3},
    {id:"berlin-manjar-s", emoji:"🍩", name:"Berlín manjar (chico)",    prep:"~90g",  unit:"unidad", kcal:330, prot:5},
    {id:"berlin-manjar-m", emoji:"🍩", name:"Berlín manjar (mediano)",  prep:"~125g", unit:"unidad", kcal:460, prot:7},
    {id:"berlin-manjar-l", emoji:"🍩", name:"Berlín manjar (grande)",   prep:"~150g · dato UC del Maule", unit:"unidad", kcal:556, prot:8.5},
    {id:"berlin-crema-s",  emoji:"🍩", name:"Berlín crema pastelera (chico)",   prep:"~90g",  unit:"unidad", kcal:290, prot:4.5},
    {id:"berlin-crema-m",  emoji:"🍩", name:"Berlín crema pastelera (mediano)", prep:"~125g", unit:"unidad", kcal:400, prot:5},
    {id:"berlin-crema-l",  emoji:"🍩", name:"Berlín crema pastelera (grande)",  prep:"~170g", unit:"unidad", kcal:490, prot:6},
    {id:"calzon-roto-s",   emoji:"🥟", name:"Calzones rotos (chico)",   prep:"~40g, tipo feria",  unit:"unidad", kcal:150, prot:2},
    {id:"calzon-roto-m",   emoji:"🥟", name:"Calzones rotos (mediano)", prep:"~55g, casero estándar", unit:"unidad", kcal:190, prot:3},
    {id:"calzon-roto-l",   emoji:"🥟", name:"Calzones rotos (grande)",  prep:"~80g, pastelería",  unit:"unidad", kcal:300, prot:5},
    {id:"queque",   emoji:"🍰", name:"Queque casero",       prep:"tajada estándar ~70g",             unit:"tajada",         kcal:210, prot:5},
    {id:"torta-mh", emoji:"🎂", name:"Torta mil hojas",     prep:"trozo estándar ~110g",             unit:"trozo",          kcal:380, prot:6},
    {id:"papas-fritas", emoji:"🍟", name:"Papas fritas",    prep:"caseras, fritas en aceite",        unit:"100g",           kcal:310, prot:3.5, portionType:"weight100"},
  ],
  otros:[],
};
const NUTRI_CATS = [
  {k:"proteinas",   label:"Proteínas"},
  {k:"carbos",      label:"Carbohidratos"},
  {k:"panes",       label:"Panes"},
  {k:"frutas",      label:"Frutas"},
  {k:"lacteos",     label:"Lácteos"},
  {k:"grasas",      label:"Grasas"},
  {k:"snacks",      label:"Snacks"},
  {k:"bebidas",     label:"Bebidas"},
  {k:"comfortfood", label:"🍦 Comfort Food"},
  {k:"otros",       label:"Otros"},
];
const MEALS = [
  {id:"desayuno", emoji:"🌅", label:"Desayuno"},
  {id:"almuerzo", emoji:"☀️", label:"Almuerzo"},
  {id:"cena",     emoji:"🌙", label:"Cena"},
  {id:"snack",    emoji:"🍪", label:"Snack"},
];
function getDefaultMeal() {
  const h = new Date().getHours();
  if(h>=5 && h<11) return "desayuno";
  if(h>=11 && h<16) return "almuerzo";
  if(h>=16 && h<21) return "cena";
  return "snack";
}
const META_KCAL = 2050;
const META_PROT = 135;

// ── Cascada de comidas — rediseño sesión angst-57 ──────────────────────────
// Modelo viejo (hasta angst-56): el exceso/sobrante de una comida se
// arrastraba a la siguiente en cadena (desayuno→almuerzo→cena→snack). Bug
// real: un exceso grande en una comida temprana podía empujar el límite
// efectivo de una comida posterior a negativo, y esa comida aparecía como
// "excedida" aunque no tuviera ni un alimento registrado.
// Modelo nuevo: desayuno, almuerzo y cena tienen cada uno un límite FIJO de
// 600kcal, independiente entre sí — nunca heredan nada. Solo el snack
// absorbe la diferencia acumulada del día completo (lo que sobró o faltó
// en las 3 comidas principales), con clamp a 0 cuando esa diferencia es
// negativa (evita que el límite del snack se vuelva un número negativo
// confuso en la UI).
const MEAL_KCAL_FIJO = 600;

// Bono de kcal por carga del día (stress score 0-10), se suma exclusivamente
// al margen de snack — nunca a las 3 comidas principales. Refleja que en
// días demandantes el hambre real sube (cortisol) y sostener la cordura
// pesa más que cuadrar el número exacto.
function getStressKcalBonus(score) {
  if(score==null) return 0;
  if(score>=9) return 350;
  if(score>=7) return 250;
  if(score>=5) return 150;
  return 0;
}

// computeMealCascade(log, stressBonus): stressBonus es el kcal extra ya
// resuelto por getStressKcalBonus (0 si no aplica o no hay dato de carga
// para ese día — por ejemplo días fuera de rango de dayData).
function computeMealCascade(log, stressBonus) {
  const l = log||[];
  const bonus = stressBonus||0;
  const meals = {};
  let sumaPrincipales = 0;
  ["desayuno","almuerzo","cena"].forEach(mealId=>{
    const entries = l.filter(e=>(e.meal||"snack")===mealId);
    const subKcal = entries.reduce((s,e)=>s+e.kcal*e.qty,0);
    const delta = subKcal - MEAL_KCAL_FIJO; // positivo = excedido, negativo = sobrante — SIN herencia
    meals[mealId] = {subKcal, nominal:MEAL_KCAL_FIJO, effectiveLimit:MEAL_KCAL_FIJO, delta, over: delta>0};
    sumaPrincipales += subKcal;
  });
  const metaEfectivaDia = META_KCAL + bonus;
  const snackEntries = l.filter(e=>(e.meal||"snack")==="snack");
  const snackKcal = snackEntries.reduce((s,e)=>s+e.kcal*e.qty,0);
  const limiteSnackCrudo = metaEfectivaDia - sumaPrincipales; // puede ser negativo
  const limiteSnack = Math.max(0, limiteSnackCrudo); // clamp — nunca un límite negativo en la UI
  const deltaSnack = snackKcal - limiteSnack;
  meals.snack = {
    subKcal:snackKcal, nominal:Math.max(0, META_KCAL-1800), effectiveLimit:limiteSnack,
    delta:deltaSnack, over:deltaSnack>0,
    sinMargen: limiteSnackCrudo<0, // el día ya venía excedido antes de llegar al snack
  };
  const finalCarry = -deltaSnack; // negativo = exceso neto del día completo (usado en stats)
  return {meals, finalCarry, metaEfectivaDia, bonus, sumaPrincipales};
}

// Reparto de "resto mayor" (largest remainder method): dado un array de
// valores exactos (float), devuelve enteros (o valores con `decimales`
// dígitos) cuya suma da EXACTO Math.round(suma total) — así la suma de las
// 4 tarjetas de comida en la UI siempre cuadra con el total del día, sin
// importar cómo caigan los decimales individuales (fix redondeo sesión angst-57).
function distribuirRedondeo(valores, decimales) {
  const factor = decimales ? Math.pow(10, decimales) : 1;
  const escalados = valores.map(v => v * factor);
  const total = escalados.reduce((s,v)=>s+v, 0);
  const targetTotal = Math.round(total);
  const floors = escalados.map(v => Math.floor(v));
  const sumFloors = floors.reduce((s,v)=>s+v, 0);
  const restante = Math.max(0, Math.min(valores.length, targetTotal - sumFloors));
  const orden = escalados
    .map((v,i)=>({i, rem: v - floors[i]}))
    .sort((a,b)=>b.rem - a.rem);
  const resultado = [...floors];
  for(let k=0; k<restante; k++) resultado[orden[k].i] += 1;
  return decimales ? resultado.map(v => v/factor) : resultado;
}

function LoadingScreen({ onDone }) {
  const phrases = [
    'Previniendo caos',
    'Organizando recursos materiales',
    'Ordenando ventas inexistentes',
    'Anticipando pandemias familiares',
    'Redescubriendo tu propio cerebro',
    'Calculando el combustible óptimo',
    'Creando un cuerpo digno',
    'Especulando con cartitas para niños',
    'ANGST'
  ];
  const [idx, setIdx] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    const step = 100 / phrases.length;
    const id = setInterval(() => {
      setProgress(p => {
        const np = Math.min(100, p + 1.8);
        setIdx(Math.min(phrases.length - 1, Math.floor(np / step)));
        if (np >= 100) {
          clearInterval(id);
          setTimeout(() => onDone && onDone(), 250);
        }
        return np;
      });
    }, 40);
    return () => clearInterval(id);
  }, []);
  const w = 1000, h = 620, m = 64, rw = w - m * 2, rh = h - m * 2, per = 2 * (rw + rh);
  const off = per * (1 - progress / 100);
  return React.createElement('div', {style:{position:'fixed',inset:0,background:'#fff',zIndex:99999,overflow:'hidden'}},
    React.createElement('svg', {width:'100%', height:'100%', viewBox:`0 0 ${w} ${h}`, preserveAspectRatio:'none', style:{display:'block',background:'#fff'}},
      React.createElement('rect', {x:m, y:m, width:rw, height:rh, fill:'none', stroke:'#000', strokeWidth:'10', strokeLinecap:'square', strokeLinejoin:'miter', strokeDasharray:per, strokeDashoffset:off, style:{transition:'stroke-dashoffset 0.15s linear'}}),
      React.createElement('foreignObject', {x:m+16, y:m+16, width:rw-32, height:rh-32},
        React.createElement('div', {xmlns:'http://www.w3.org/1999/xhtml', style:{width:'100%',height:'100%',color:'#fff',fontFamily:'Georgia, serif',fontWeight:700,fontSize:34,lineHeight:1,overflow:'hidden',userSelect:'none',textAlign:'center',whiteSpace:'normal',wordBreak:'break-word'}},
          React.createElement('div', {style:{width:'100%',height:'100%',overflow:'hidden'}}, 'ANGST '.repeat(220))
        )
      ),
      React.createElement('text', {x:w/2, y:h/2+150, textAnchor:'middle', fontFamily:'Georgia, serif', fontSize:'26', fontWeight:'700', fill:'#000'}, phrases[idx])
    )
  );
}

// ─── MoveMealButton — mover un alimento registrado entre comidas ───────────
// (sesión angst-57) Botón 🔀 + popover compacto con las otras 3 comidas.
// Reutilizado por la vista "hoy" (onMove=moveEntryMeal) y por el
// planificador de mazos (onMove=moveDeckItemMeal) — misma UI, distinto handler.
function MoveMealButton({ uid, currentMeal, isOpen, onToggle, onMove, compact }) {
  const otras = MEALS.filter(m=>m.id!==currentMeal);
  return (
    <div style={{position:"relative",display:"inline-flex",flexShrink:0}}>
      <button onClick={e=>{e.stopPropagation();onToggle(isOpen?null:uid);}}
        title="mover a otra comida"
        style={compact
          ?{position:"absolute",top:6,right:26,background:"transparent",border:"none",color:"#c8c8c8",fontSize:13,cursor:"pointer",padding:2,lineHeight:1}
          :{background:"transparent",border:"none",color:"#ccc",fontSize:14,cursor:"pointer",padding:"0 2px",lineHeight:1}}>
        🔀
      </button>
      {isOpen&&(
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:50,
          background:"#fff",border:"1.5px dashed #111",borderRadius:8,
          padding:"5px",boxShadow:"2px 2px 0 #eee",minWidth:130,
        }}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textTransform:"uppercase",padding:"2px 6px 4px"}}>mover a</div>
          {otras.map(m=>(
            <button key={m.id} onClick={()=>onMove(uid,m.id)} style={{
              display:"block",width:"100%",textAlign:"left",padding:"6px 8px",
              border:"none",borderRadius:5,background:"transparent",
              fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",cursor:"pointer",
            }}>{m.emoji} {m.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function NutricionPage({ nutriLog, saveNutriLog, customFoods, saveCustomFoods, foodOverrides, saveFoodOverrides, nutriDecks, saveNutriDecks, getStressScore }) {
  const todayKey = (()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const [dateKey, setDateKey] = useState(todayKey);
  const [view, setView] = useState("hoy"); // hoy | ficha | stats | deck
  const [fichaFoodId, setFichaFoodId] = useState(null);
  const [modal, setModal] = useState(null); // {food}
  const [qty, setQty] = useState(1);
  const [fraction, setFraction] = useState(1);   // for fraction / calibre / size
  const [sizeKey, setSizeKey] = useState("M");    // for size / calibre
  const [mealSel, setMealSel] = useState(getDefaultMeal());
  const [openCat, setOpenCat] = useState(null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [foodView, setFoodView] = useState("grid-lg");
  const savedDecks = nutriDecks||[];
  const [deckMenuOpen, setDeckMenuOpen] = useState(false);
  const [deckEditor, setDeckEditor] = useState(null); // {id, name, items, isNew}
  const [collapsedMeals, setCollapsedMeals] = useState({});
  const [apiFoodResults, setApiFoodResults] = useState([]);
  const [moveMenuOpen, setMoveMenuOpen] = useState(null); // uid de la entrada con el popover "mover a otra comida" abierto
  const [apiLoading, setApiLoading] = useState(false);

  // Key de USDA FoodData Central: se pide una vez por UI (no hardcodeada en
  // el código, no queda visible en el index.html compilado) y se guarda en
  // su propia clave de localStorage, fuera de la regla vital de export/
  // import (mismo criterio que la key de TCG en Pokecripto).
  const USDA_KEY_STORAGE = "angst-usda-fdc-key";
  const [usdaKey, setUsdaKeyState] = useState(() => { try { return localStorage.getItem(USDA_KEY_STORAGE) || ""; } catch(e){ return ""; } });
  const [usdaKeyInput, setUsdaKeyInput] = useState("");
  function saveUsdaKey(k){ try { localStorage.setItem(USDA_KEY_STORAGE, k); } catch(e){} setUsdaKeyState(k); }

  const log = nutriLog[dateKey] || [];
  const totalKcal = Math.round(log.reduce((a,e)=>a+e.kcal*e.qty,0));
  const totalProt = parseFloat(log.reduce((a,e)=>a+e.prot*e.qty,0).toFixed(1));
  // Ajuste por carga del día (sesión angst-57): getStressScore es una función
  // que AngstApp pasa como prop (envuelve computeStressScore con dayData/
  // calMarks/kidsHealth ya en su closure) — si no está disponible por algún
  // motivo, dayStress queda null y el bono es 0, sin romper nada.
  const dayStress = getStressScore ? getStressScore(dateKey) : null;
  const stressBonus = getStressKcalBonus(dayStress);
  const cascade = computeMealCascade(log, stressBonus);
  const metaEfectivaDia = cascade.metaEfectivaDia;
  const pctK = Math.min(100, totalKcal/metaEfectivaDia*100);
  const pctP = Math.min(100, totalProt/META_PROT*100);
  const remK = Math.max(0, metaEfectivaDia-totalKcal);
  const remP = Math.max(0, META_PROT-totalProt);
  const over = totalKcal > metaEfectivaDia+150;

  // size multipliers for frutas y calibre (palta)
  const SIZE_MULT = {S:1, M:1.5, L:2};
  const CALIBRE_KCAL = {S:192, M:280, L:392, XL:560};
  const CALIBRE_PROT = {S:2.4, M:3.5, L:4.9, XL:7.0};
  const FRUIT_FRACTIONS = [[1,"entera"],[0.5,"½"],[0.333,"⅓"],[0.25,"¼"]];

  function computeEffective(food, qty, fraction, sizeKey) {
    const pt = food.portionType;
    if(pt === "weight100") {
      // qty ahora representa pasos de 50g (precisión real sin pesar de a 100)
      return { kcal: food.kcal * qty * 0.5, prot: food.prot * qty * 0.5, displayQty: `${qty*50}g` };
    }
    if(pt === "size") {
      const m = SIZE_MULT[sizeKey]||1;
      const ef = fraction||1;
      const fLabel = ef===1?"":ef===0.5?" ½":ef===0.333?" ⅓":" ¼";
      return { kcal: food.kcal * m * ef * qty, prot: food.prot * m * ef * qty, displayQty: `${sizeKey}${fLabel}` };
    }
    if(pt === "fraction") {
      return { kcal: food.kcal * fraction * qty, prot: food.prot * fraction * qty, displayQty: fraction===1?"completa":fraction===0.5?"½":fraction===0.333?"⅓":"¼" };
    }
    if(pt === "calibre") {
      const kcal = CALIBRE_KCAL[sizeKey] || food.kcal;
      const prot = CALIBRE_PROT[sizeKey] || food.prot;
      return { kcal: kcal * fraction * qty, prot: prot * fraction * qty, displayQty: `${sizeKey} ${fraction===1?"entera":fraction===0.5?"½":"¼"}` };
    }
    return { kcal: food.kcal * qty, prot: food.prot * qty, displayQty: `×${qty}` };
  }

  function openModal(food) {
    setModal({food});
    setQty(food.portionType==="weight100"?2:1);
    setFraction(1);
    setSizeKey("M");
    setMealSel(getDefaultMeal());
  }

  const PORTION_TYPES=[{k:"",label:"tap directo"},{k:"weight100",label:"por 50g"},{k:"size",label:"S/M/L"},{k:"fraction",label:"fracción"},{k:"calibre",label:"calibre+fracción"}];

  function getMergedFoods(catKey) {
    const base=(NUTRI_FOODS[catKey]||[]).map(f=>({...f,...((foodOverrides||{})[f.id]||{})}));
    const custom=Object.values(customFoods||{}).filter(f=>f.cat===catKey);
    return [...base,...custom];
  }
  function allFoodsFlat() {
    return NUTRI_CATS.flatMap(c=>getMergedFoods(c.k).map(f=>({...f, catKey:c.k})));
  }
  function openEditModal(food,catKey){ setEditModal({food:{...food},isNew:false,catKey}); }
  function openNewModal(catKey, prefillName){ setEditModal({food:{id:"custom-"+Date.now(),emoji:"🍽️",name:prefillName||"",prep:"",kcal:0,prot:0,unit:"unidad",portionType:"",cat:catKey},isNew:true,catKey}); }
  function saveEdit(){
    const {food,isNew}=editModal;
    if(isNew){ saveCustomFoods({...(customFoods||{}),[food.id]:food}); }
    else{ saveFoodOverrides({...(foodOverrides||{}),[food.id]:food}); }
    setEditModal(null);
  }
  function deleteCustom(id){ const n={...(customFoods||{})}; delete n[id]; saveCustomFoods(n); }

  function addEntry() {
    if(!modal) return;
    const { kcal, prot, displayQty } = computeEffective(modal.food, qty, fraction, sizeKey);
    const entry = {
      ...modal.food,
      kcal: parseFloat((kcal/qty).toFixed(2)), // store per-unit so ×qty math is preserved
      prot: parseFloat((prot/qty).toFixed(2)),
      qty,
      unit: displayQty,
      meal: mealSel,
      uid: Date.now()+Math.random()
    };
    if(deckEditor){
      setDeckEditor(de=>({...de, items:[...de.items, entry]}));
    } else {
      saveNutriLog({...nutriLog, [dateKey]: [...log, entry]});
    }
    setModal(null);
    setSearchQuery("");
  }
  function removeEntry(uid) { saveNutriLog({...nutriLog, [dateKey]: log.filter(e=>e.uid!==uid)}); }
  function moveEntryMeal(uid, newMealId) {
    saveNutriLog({...nutriLog, [dateKey]: log.map(e=>e.uid===uid?{...e,meal:newMealId}:e)});
    setMoveMenuOpen(null);
  }
  function shiftDate(n) {
    const d = new Date(dateKey+"T12:00:00"); d.setDate(d.getDate()+n);
    setDateKey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
  }
  function getFoodHistory(foodId) {
    const out=[];
    Object.keys(nutriLog).sort().forEach(dk=>{
      (nutriLog[dk]||[]).forEach(e=>{
        if(e.id===foodId) out.push({date:dk, name:e.name, emoji:e.emoji, qty:e.qty, unit:e.unit, kcalTot:e.kcal*e.qty, protTot:e.prot*e.qty, meal:e.meal||"snack"});
      });
    });
    return out;
  }

  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const DOW_ES = ["dom","lun","mar","mié","jue","vie","sáb"];
  const dObj = new Date(dateKey+"T12:00:00");
  const dateLabel = dateKey===todayKey ? "hoy" : `${DOW_ES[dObj.getDay()]} ${dObj.getDate()} ${MONTHS_ES[dObj.getMonth()]}`;

  const barStyle = (pct,color) => ({width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.4s"});
  const trackStyle = {height:6,background:"#eee",borderRadius:99,overflow:"hidden",marginTop:6};

  const searchResults = searchQuery.trim()
    ? allFoodsFlat().filter(f=>f.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0,6)
    : [];

  function normalizeApiFood(item, idx){
    const name = item.description || item.foodDescription || item.name || item.food_name || item.label || "alimento";
    const kcal = parseFloat(item.calories || item.energy || item.kcal || item.energy_kcal || item.nf_calories || 0) || 0;
    const prot = parseFloat(item.protein || item.proteins || item.protein_g || item.nf_protein || 0) || 0;
    return { id:`api-${Date.now()}-${idx}`, emoji:"🌐", name, prep:"USDA FoodData Central", kcal:Math.round(kcal), prot:parseFloat(prot.toFixed(1)), unit:"porción", portionType:"", cat:"otros", catKey:"otros", source:"api" };
  }

  useEffect(()=>{
    let cancelled = false;
    async function run(){
      const q = searchQuery.trim();
      if(q.length < 3){ setApiFoodResults([]); setApiLoading(false); return; }
      const localLower = allFoodsFlat().map(f=>f.name.toLowerCase());
      const localMatch = localLower.some(n=>n.includes(q.toLowerCase()));
      if(localMatch && searchResults.length >= 3){ setApiFoodResults([]); setApiLoading(false); return; }
      if(!usdaKey){ setApiFoodResults([]); setApiLoading(false); return; }
      setApiLoading(true);
      try {
        // Foundation Foods + SR Legacy: ingredientes crudos y preparaciones
        // estándar (raw/cooked/roasted/boiled/etc.), no "Branded" (productos
        // envasados con marca) -- es justo lo que se buscaba evitar.
        const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=8&dataType=Foundation,SR%20Legacy&api_key=${encodeURIComponent(usdaKey)}`;
        const r = await fetch(url);
        const data = await r.json();
        const foods = (data.foods || []).map(f=>{
          const nutrients = f.foodNutrients || [];
          const energy = nutrients.find(n=>n.nutrientName==="Energy" && n.unitName==="KCAL") || nutrients.find(n=>n.nutrientName==="Energy");
          const protein = nutrients.find(n=>n.nutrientName==="Protein");
          return { description: f.description, calories: energy?.value, protein: protein?.value };
        }).filter(x=>x.description && (x.calories || x.protein));
        const normalized = foods.map(normalizeApiFood).filter(f=>f.name && !localLower.includes(f.name.toLowerCase())).slice(0,6);
        if(!cancelled) setApiFoodResults(normalized);
      } catch(e){ if(!cancelled) setApiFoodResults([]); }
      if(!cancelled) setApiLoading(false);
    }
    run();
    return ()=>{ cancelled = true; };
  }, [searchQuery, dateKey, usdaKey]);

  function openDeckPlanner(existingDeck){
    if(existingDeck){
      setDeckEditor({id:existingDeck.id, name:existingDeck.name, items:(existingDeck.items||[]).map(it=>({...it})), isNew:false});
    } else {
      setDeckEditor({id:"deck-"+Date.now(), name:"", items:[], isNew:true});
    }
    setDeckMenuOpen(false);
    setView("deck");
  }

  function removeDeckItem(uid){
    setDeckEditor(de=>de?{...de, items:de.items.filter(i=>i.uid!==uid)}:de);
  }
  function moveDeckItemMeal(uid, newMealId){
    setDeckEditor(de=>de?{...de, items:de.items.map(i=>i.uid===uid?{...i,meal:newMealId}:i)}:de);
    setMoveMenuOpen(null);
  }

  function saveDeckEditor(){
    if(!deckEditor || !deckEditor.name.trim() || !deckEditor.items.length) return;
    const finalDeck = {
      id: deckEditor.id,
      name: deckEditor.name.trim(),
      createdFrom: deckEditor.createdFrom || null,
      items: deckEditor.items.map(e=>({
        id:e.id, emoji:e.emoji, name:e.name, kcal:e.kcal, prot:e.prot, qty:e.qty, unit:e.unit, meal:e.meal || "snack", prep:e.prep || ""
      }))
    };
    const exists = savedDecks.some(d=>d.id===finalDeck.id);
    const next = exists ? savedDecks.map(d=>d.id===finalDeck.id?finalDeck:d) : [finalDeck, ...savedDecks];
    saveNutriDecks(next);
    setDeckEditor(null);
    setView("hoy");
  }

  function cancelDeckEditor(){
    setDeckEditor(null);
    setView("hoy");
  }

  function deleteDeck(id){
    saveNutriDecks(savedDecks.filter(d=>d.id!==id));
  }

  function applyDeck(deck){
    if(!deck?.items?.length) return;
    const mapped = deck.items.map(e=>({...e, uid: Date.now()+Math.random()}));
    saveNutriLog({...nutriLog, [dateKey]: mapped});
    setDeckMenuOpen(false);
  }

  function renderFoodCard(food, catKey){
    const cardBase = {background:"#fafafa",border:"1px dashed #e8e8e8",cursor:"pointer"};
    if(foodView === "list") {
      return (
        <div key={food.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderBottom:"1px dashed #f1f1f1",background:"#fafafa"}}>
          <span onClick={()=>openModal(food)} style={{fontSize:18,flexShrink:0,cursor:"pointer"}}>{food.emoji}</span>
          <div onClick={()=>openModal(food)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{food.name}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",fontStyle:"italic"}}>{food.prep}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#111",fontWeight:700}}>{food.kcal}k</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#888"}}>{food.prot}g</div>
          </div>
          <button onClick={()=>openEditModal(food,catKey)} style={{background:"transparent",border:"none",color:"#ccc",fontSize:14,cursor:"pointer",padding:"2px 4px"}}>✎</button>
        </div>
      );
    }
    const isSmall = foodView === "grid-sm";
    return (
      <div key={food.id} onClick={()=>openModal(food)} style={{...cardBase,borderRadius:isSmall?10:12,padding:isSmall?10:12,minHeight:isSmall?88:118,display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative"}}>
        <button onClick={(e)=>{e.stopPropagation();openEditModal(food,catKey);}} style={{position:"absolute",top:6,right:6,background:"transparent",border:"none",color:"#d0d0d0",fontSize:12,cursor:"pointer",padding:2}}>✎</button>
        <div>
          <div style={{fontSize:isSmall?18:24,lineHeight:1,marginBottom:isSmall?6:8}}>{food.emoji}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:isSmall?11:12,color:"#333",fontWeight:700,lineHeight:1.25,paddingRight:18}}>{food.name}</div>
          {!isSmall && <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#b3b3b3",fontStyle:"italic",marginTop:5,lineHeight:1.3}}>{food.prep}</div>}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:10}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:isSmall?10:11,color:"#111",fontWeight:700}}>{food.kcal}k</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:isSmall?9:10,color:"#888"}}>{food.prot}g</div>
        </div>
      </div>
    );
  }

  // Render modal controls based on portionType
  function renderModalControls(food) {
    const pt = food.portionType;
    const eff = computeEffective(food, qty, fraction, sizeKey);
    const btnBase = {border:"1px dashed #ddd",borderRadius:8,background:"transparent",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"8px 12px",transition:"all 0.15s"};
    const btnActive = {...btnBase, background:"#111", color:"#fff", border:"1px solid #111"};

    return (
      <div>
        {/* Comida del día */}
        <div style={{marginBottom:18}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>comida</div>
          <div style={{display:"flex",gap:6}}>
            {MEALS.map(m=>(
              <button key={m.id} onClick={()=>setMealSel(m.id)}
                style={{flex:1,padding:"8px 4px",borderRadius:8,border:"1.5px solid",borderColor:mealSel===m.id?"#111":"#eee",background:mealSel===m.id?"#111":"transparent",color:mealSel===m.id?"#fff":"#999",fontFamily:"'Caveat',cursive",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
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
                ? [[1,"completa"],[0.5,"½"],[0.333,"⅓"],[0.25,"¼"]]
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

  // ════════════════════ FICHA DE ALIMENTO ════════════════════
  if(view==="ficha") {
    const history = getFoodHistory(fichaFoodId);
    if(!history.length) { setView("hoy"); return null; }
    const last = history[history.length-1];
    const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate()-30);
    const last30 = history.filter(h=>new Date(h.date+"T12:00:00")>=cutoff30);
    const avgKcal30 = last30.length ? Math.round(last30.reduce((s,h)=>s+h.kcalTot,0)/last30.length) : 0;
    const maxKcal = Math.max(...history.map(h=>h.kcalTot),1);
    const recent = history.slice().reverse().slice(0,20);
    return (
      <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>setView("hoy")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontSize:22}}>{last.emoji}</span>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111"}}>{last.name}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          <div style={{background:"#fafafa",border:"1px dashed #ddd",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>veces (30d)</div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:28,fontWeight:700,color:"#111"}}>{last30.length}</div>
          </div>
          <div style={{background:"#fafafa",border:"1px dashed #ddd",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>kcal promedio</div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:28,fontWeight:700,color:"#111"}}>{avgKcal30}</div>
          </div>
        </div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>historial · {history.length} registros</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {recent.map((h,i)=>{
            const [y,m,d] = h.date.split("-");
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa",width:42,flexShrink:0}}>{d}/{m}</div>
                <div style={{flex:1,background:"#f5f5f5",borderRadius:4,height:14,overflow:"hidden"}}>
                  <div style={{width:`${h.kcalTot/maxKcal*100}%`,height:"100%",background:"#111",borderRadius:4,transition:"width 0.3s"}}/>
                </div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555",width:96,textAlign:"right",flexShrink:0}}>{Math.round(h.kcalTot)}kcal · ×{h.qty}</div>
              </div>
            );
          })}
        </div>
        <div style={{height:32}}/>
      </div>
    );
  }

  // ════════════════════ STATS ════════════════════
  if(view==="stats") {
    const CARD={background:"#1a1a1a",borderRadius:12,padding:"16px",marginBottom:14,color:"#fff"};
    const SL={fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:8};
    function dTotals(dk){ const l=nutriLog[dk]||[]; return {kcal:l.reduce((s,e)=>s+e.kcal*e.qty,0), prot:l.reduce((s,e)=>s+e.prot*e.qty,0)}; }
    function dHit(dk){
      const t=dTotals(dk);
      const bonus = getStressKcalBonus(getStressScore ? getStressScore(dk) : null);
      const metaDia = META_KCAL + bonus;
      return t.kcal>0 && Math.abs(t.kcal-metaDia)<=250 && t.prot>=META_PROT*0.85;
    }
    let streak=0; let dCur=new Date();
    for(let i=0;i<60;i++){
      const dk=`${dCur.getFullYear()}-${String(dCur.getMonth()+1).padStart(2,"0")}-${String(dCur.getDate()).padStart(2,"0")}`;
      if(!nutriLog[dk]){ if(i===0){ dCur.setDate(dCur.getDate()-1); continue; } break; }
      if(dHit(dk)){ streak++; dCur.setDate(dCur.getDate()-1); } else break;
    }
    const last7=[]; let d2=new Date();
    for(let i=0;i<7;i++){
      const dk=`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,"0")}-${String(d2.getDate()).padStart(2,"0")}`;
      if(nutriLog[dk]) last7.push({dk,...dTotals(dk)});
      d2.setDate(d2.getDate()-1);
    }
    const avgKcal7 = last7.length? Math.round(last7.reduce((s,x)=>s+x.kcal,0)/last7.length):0;
    const avgProt7 = last7.length? (last7.reduce((s,x)=>s+x.prot,0)/last7.length).toFixed(1):0;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
    const counts={};
    Object.keys(nutriLog).forEach(dk=>{
      if(new Date(dk+"T12:00:00")<cutoff) return;
      (nutriLog[dk]||[]).forEach(e=>{ if(!counts[e.id]) counts[e.id]={name:e.name,emoji:e.emoji,count:0}; counts[e.id].count++; });
    });
    const topFoods=Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,5);
    const protDays=last7.slice(0,3).map(x=>x.prot);
    const protAvg3=protDays.length? protDays.reduce((s,v)=>s+v,0)/protDays.length : null;
    const alert = (protAvg3!==null && protAvg3 < META_PROT*0.75) ? `bajo en proteína los últimos ${protDays.length} días (prom. ${Math.round(protAvg3)}g)` : null;

    // Margen acumulado — antes "fondo de grasa acumulado" (sesión angst-57).
    // Renombrado y recalculado con la cascada nueva: cada día histórico se
    // recalcula con su propio bono por carga (getStressScore + escala), así
    // los días demandantes ya reconocidos no se leen como "fallaste" contra
    // una meta rígida que nunca les correspondió. Se separa el exceso en dos
    // bolsas — días donde hubo ajuste por carga (≥5) vs. días sin ajuste —
    // para que el número deje de ser un bloque uniforme de culpa.
    let margenAjustadoKcal = 0, margenNoAjustadoKcal = 0;
    let diasAjustados = 0, diasNoAjustados = 0;
    Object.keys(nutriLog).forEach(dk=>{
      const score = getStressScore ? getStressScore(dk) : null;
      const bonus = getStressKcalBonus(score);
      const cascade = computeMealCascade(nutriLog[dk]||[], bonus);
      if(cascade.finalCarry < 0) {
        if(bonus>0) { margenAjustadoKcal += Math.abs(cascade.finalCarry); diasAjustados++; }
        else { margenNoAjustadoKcal += Math.abs(cascade.finalCarry); diasNoAjustados++; }
      }
    });
    const margenTotalKcal = margenAjustadoKcal + margenNoAjustadoKcal;
    const diasExcedidos = diasAjustados + diasNoAjustados;
    const margenGramos = Math.round(margenTotalKcal/9);

    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>setView("hoy")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111"}}>📊 stats</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
          <div style={CARD}>
            <div style={SL}>racha actual</div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:32,fontWeight:700}}>{streak}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>días cumpliendo meta</div>
          </div>
          <div style={CARD}>
            <div style={SL}>promedio 7d</div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:24,fontWeight:700}}>{avgKcal7} kcal</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>{avgProt7}g proteína</div>
          </div>
        </div>
        {alert && <div style={{background:"#2a1515",border:"1px solid rgba(255,100,100,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#ff9b9b"}}>⚠️ {alert}</div>}
        {margenTotalKcal>0 && (
          <div style={CARD}>
            <div style={SL}>margen acumulado</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}}>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:32,fontWeight:700}}>{Math.round(margenTotalKcal)}</span>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)"}}>kcal por sobre la meta ajustada</span>
            </div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:margenAjustadoKcal>0&&margenNoAjustadoKcal>0?10:0}}>
              ≈ {margenGramos}g · {diasExcedidos} día{diasExcedidos!==1?"s":""} con exceso neto al cierre
            </div>
            {margenAjustadoKcal>0&&margenNoAjustadoKcal>0&&(
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#aac756"}}>{Math.round(margenAjustadoKcal)}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:2}}>en {diasAjustados} día{diasAjustados!==1?"s":""} ajustado{diasAjustados!==1?"s":""} por carga</div>
                </div>
                <div style={{flex:1,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{Math.round(margenNoAjustadoKcal)}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:2}}>en {diasNoAjustados} día{diasNoAjustados!==1?"s":""} sin ajuste</div>
                </div>
              </div>
            )}
          </div>
        )}
        {topFoods.length>0 && (
          <div style={CARD}>
            <div style={SL}>alimentos frecuentes (30d)</div>
            {topFoods.map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<topFoods.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
                <span style={{fontSize:15}}>{f.emoji}</span>
                <span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"rgba(255,255,255,0.85)"}}>{f.name}</span>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#aac756"}}>×{f.count}</span>
              </div>
            ))}
          </div>
        )}
        {topFoods.length===0 && <div style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"#ccc",textAlign:"center",padding:"24px 0"}}>aún no hay suficientes datos</div>}
        <div style={{height:32}}/>
      </div>
    );
  }

  // ════════════════════ PLANIFICADOR DE MAZO ════════════════════
  if(view==="deck"){
    if(!deckEditor){ setView("hoy"); return null; }
    const de = deckEditor;
    const deckKcal = Math.round(de.items.reduce((s,e)=>s+e.kcal*e.qty,0));
    const deckProt = parseFloat(de.items.reduce((s,e)=>s+e.prot*e.qty,0).toFixed(1));
    const itemsByMeal = MEALS.map(m=>({...m, entries: de.items.filter(e=>(e.meal||"snack")===m.id)}));
    const canSave = de.name.trim().length>0 && de.items.length>0;
    return (
      <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
        {/* Modal de registro — reutilizado, agrega al borrador del mazo */}
        {modal&&(
          <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#fff",borderRadius:"16px 16px 0 0",padding:"24px 24px 40px",maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111",marginBottom:2}}>{modal.food.emoji} {modal.food.name}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa",marginBottom:20}}>{modal.food.prep}</div>
              {renderModalControls(modal.food)}
              <button onClick={addEntry} style={{width:"100%",background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"14px",fontFamily:"'Caveat',cursive",fontSize:18,cursor:"pointer",marginBottom:10}}>agregar al mazo</button>
              <button onClick={()=>setModal(null)} style={{width:"100%",background:"transparent",color:"#bbb",border:"none",padding:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}}>cancelar</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={cancelDeckEditor} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111"}}>{de.isNew?"🃏 planificar mazo":"🃏 editar mazo"}</span>
        </div>

        <input value={de.name} onChange={e=>setDeckEditor(prev=>({...prev,name:e.target.value}))}
          placeholder="nombre del mazo..."
          style={{width:"100%",border:"1.5px solid #111",borderRadius:10,padding:"12px 14px",fontFamily:"'Caveat',cursive",fontSize:18,outline:"none",boxSizing:"border-box",marginBottom:14,color:"#111"}}/>

        {/* Resumen */}
        <div style={{background:"#111",borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",gap:20}}>
          <div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:26,fontWeight:700,color:"#fff",lineHeight:1}}>{deckKcal}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>kcal totales</div>
          </div>
          <div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:26,fontWeight:700,color:"#fff",lineHeight:1}}>{deckProt}g</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>proteína</div>
          </div>
        </div>

        {/* Items por comida */}
        {itemsByMeal.map(meal=>(
          <div key={meal.id} style={{marginBottom:12}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#111",marginBottom:6}}>{meal.emoji} {meal.label}</div>
            {meal.entries.length===0
              ? <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#ddd",fontStyle:"italic",padding:"4px 2px"}}>sin alimentos</div>
              : meal.entries.map(e=>(
                  <div key={e.uid} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px dashed #f0f0f0"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{e.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{e.name}</div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>×{e.qty} {e.unit} · {Math.round(e.kcal*e.qty)}kcal</div>
                    </div>
                    <MoveMealButton uid={e.uid} currentMeal={meal.id} isOpen={moveMenuOpen===e.uid} onToggle={setMoveMenuOpen} onMove={moveDeckItemMeal}/>
                    <button onClick={()=>removeDeckItem(e.uid)} style={{background:"transparent",border:"none",color:"#ddd",fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>
                  </div>
                ))
            }
          </div>
        ))}

        {/* Buscador para agregar */}
        <div style={{marginTop:18,marginBottom:10}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>agregar alimento al mazo</div>
          {searchQuery.trim() && (
            <div style={{border:"1.5px dashed #111",borderRadius:10,marginBottom:8,overflow:"hidden",background:"#fff"}}>
              {searchResults.map(food=>(
                <div key={food.catKey+"-"+food.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderBottom:"1px dashed #f0f0f0"}}>
                  <span onClick={()=>openModal(food)} style={{fontSize:16,flexShrink:0,cursor:"pointer"}}>{food.emoji}</span>
                  <div onClick={()=>openModal(food)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{food.name}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>{food.kcal}kcal · {food.prot}g / {food.unit}</div>
                  </div>
                </div>
              ))}
              {apiLoading && <div style={{padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>buscando fuera de tu registro…</div>}
              {apiFoodResults.map(food=>(
                <div key={food.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderTop:"1px dashed #f0f0f0",background:"#fcfcfc"}}>
                  <span onClick={()=>openModal(food)} style={{fontSize:16,flexShrink:0,cursor:"pointer"}}>{food.emoji}</span>
                  <div onClick={()=>openModal(food)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{food.name}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#9aa"}}>{food.kcal}kcal · {food.prot}g · api</div>
                  </div>
                </div>
              ))}
              {searchResults.length===0 && apiFoodResults.length===0 && !apiLoading && (
                <div style={{padding:"12px 14px",fontFamily:"'Caveat',cursive",fontSize:14,color:"#bbb"}}>sin resultados — probá desde "explorar por categoría"</div>
              )}
              {!usdaKey && (
                <div style={{padding:"10px 12px",borderTop:"1px dashed #f0f0f0",display:"flex",gap:6}}>
                  <input value={usdaKeyInput} onChange={e=>setUsdaKeyInput(e.target.value)} placeholder="API key de USDA FoodData Central"
                    style={{flex:1,minWidth:0,border:"1px solid #ddd",borderRadius:8,padding:"6px 8px",fontFamily:"'DM Sans',sans-serif",fontSize:11,outline:"none"}}/>
                  <button onClick={()=>{ if(usdaKeyInput.trim()){ saveUsdaKey(usdaKeyInput.trim()); setUsdaKeyInput(""); } }}
                    style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,border:"none",borderRadius:8,padding:"6px 10px",background:"#111",color:"#fff",cursor:"pointer"}}>guardar</button>
                </div>
              )}
            </div>
          )}
          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="busca un alimento..."
            style={{width:"100%",border:"1.5px solid #111",borderRadius:10,padding:"12px 14px",fontFamily:"'Caveat',cursive",fontSize:16,outline:"none",boxSizing:"border-box",color:"#111"}}/>
        </div>

        {/* Explorar por categoría */}
        <button onClick={()=>setExploreOpen(o=>!o)} style={{width:"100%",background:"transparent",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",cursor:"pointer",padding:"6px 0 14px",textAlign:"center"}}>
          {exploreOpen?"▴ ocultar categorías":"▾ explorar por categoría"}
        </button>
        {exploreOpen && NUTRI_CATS.map(({k,label})=>(
          <div key={k} style={{marginBottom:8,border:"1px solid #eee",borderRadius:12,overflow:"hidden"}}>
            <div onClick={()=>setOpenCat(openCat===k?null:k)}
              style={{padding:"11px 16px",background:openCat===k?"#111":"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:openCat===k?"#fff":"#111"}}>{label}</span>
              <span style={{color:openCat===k?"#777":"#ccc",fontSize:12}}>{openCat===k?"▴":"▾"}</span>
            </div>
            {openCat===k&&(
              <div style={{borderTop:"1px solid #eee",padding:foodView==="list"?0:8}}>
                <div style={foodView==="list"?{}:{display:"grid",gridTemplateColumns:foodView==="grid-sm"?"repeat(3,1fr)":"repeat(2,1fr)",gap:8}}>
                  {getMergedFoods(k).map(food=>renderFoodCard(food,k))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Guardar / cancelar */}
        <div style={{display:"flex",gap:8,marginTop:20}}>
          <button onClick={cancelDeckEditor} style={{flex:1,background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"11px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#999",cursor:"pointer"}}>cancelar</button>
          <button onClick={saveDeckEditor} disabled={!canSave} style={{flex:2,background:canSave?"#111":"#eee",color:canSave?"#fff":"#bbb",border:"none",borderRadius:8,padding:"11px",fontFamily:"'Caveat',cursive",fontSize:17,cursor:canSave?"pointer":"default",fontWeight:700}}>guardar mazo</button>
        </div>
        <div style={{height:32}}/>
      </div>
    );
  }

  // ════════════════════ HOY (vista principal) ════════════════════
  return (
    <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
      {/* Modal de registro */}
      {modal&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#fff",borderRadius:"16px 16px 0 0",padding:"24px 24px 40px",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111",marginBottom:2}}>{modal.food.emoji} {modal.food.name}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa",marginBottom:20}}>{modal.food.prep}</div>
            {renderModalControls(modal.food)}
            <button onClick={addEntry} style={{width:"100%",background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"14px",fontFamily:"'Caveat',cursive",fontSize:18,cursor:"pointer",marginBottom:10}}>agregar</button>
            <button onClick={()=>setModal(null)} style={{width:"100%",background:"transparent",color:"#bbb",border:"none",padding:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}}>cancelar</button>
          </div>
        </div>
      )}

      {/* Date nav */}
      <div style={{display:"grid",gridTemplateColumns:"44px minmax(0,1fr) 44px",alignItems:"center",gap:8,marginBottom:10}}>
        <button onClick={()=>shiftDate(-1)} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"8px 14px",cursor:"pointer",color:"#888",fontSize:20}}>‹</button>
        <span style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#555",textAlign:"center"}}>{dateLabel}</span>
        <button onClick={()=>shiftDate(1)} disabled={dateKey>=todayKey} style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"8px 14px",cursor:"pointer",color:dateKey>=todayKey?"#ddd":"#888",fontSize:20}}>›</button>
      </div>

      {/* Menú de mazos: guardar / ver / cargar */}
      <div style={{marginBottom:16}}>
        <button onClick={()=>setDeckMenuOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"8px 14px",cursor:"pointer"}}>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"#777"}}>🃏 mazos</span>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb"}}>{deckMenuOpen?"▴":"▾"}</span>
        </button>
        {deckMenuOpen && (
          <div style={{border:"1px dashed #eee",borderRadius:8,marginTop:6,padding:"10px",display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>openDeckPlanner()} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"9px",fontFamily:"'Caveat',cursive",fontSize:15,cursor:"pointer"}}>+ planificar mazo nuevo</button>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginTop:4}}>cargar mazo</div>
            {savedDecks.length===0 && <div style={{background:"#fafafa",border:"1px dashed #e5e5e5",borderRadius:10,padding:"12px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa"}}>sin mazos guardados</div>}
            {savedDecks.map(deck=>(
              <div key={deck.id} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"linear-gradient(180deg,#f8f8f8 0%,#efefef 100%)",border:"1.5px solid #d8d8d8",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.8)",borderRadius:10,padding:"10px 12px"}}>
                <button onClick={()=>applyDeck(deck)} style={{flex:1,minWidth:0,background:"transparent",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#111",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deck.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa"}}>{(deck.items||[]).length} cartas · cargar</div>
                </button>
                <button onClick={()=>openDeckPlanner(deck)} style={{background:"transparent",border:"none",color:"#999",fontSize:14,cursor:"pointer",padding:"4px 6px",flexShrink:0}}>✎</button>
                <button onClick={()=>{if(window.confirm(`¿Eliminar el mazo "${deck.name}"?`))deleteDeck(deck.id);}} style={{background:"transparent",border:"none",color:"#ccc",fontSize:17,cursor:"pointer",padding:"4px 6px",flexShrink:0,lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta del día */}
      <div style={{marginBottom:14}}>
        <div onClick={()=>setView("stats")} style={{background:"#111",borderRadius:14,padding:"18px",cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase"}}>meta del día</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {stressBonus>0&&(
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#aac756",background:"rgba(170,199,86,0.15)",borderRadius:20,padding:"3px 8px",whiteSpace:"nowrap"}}>
                día cargado ({dayStress}/10) · +{stressBonus} kcal
              </span>
            )}
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>stats ▸</span>
          </div>
        </div>
        <div style={{display:"flex",gap:20}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:34,fontWeight:700,color:over?"#ff7b7b":"#fff",lineHeight:1}}>{totalKcal}</span>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.3)"}}>/ {metaEfectivaDia} kcal</span>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.1)",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pctK}%`,background:over?"#ff7b7b":"#fff",borderRadius:99,transition:"width 0.4s"}}/>
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:34,fontWeight:700,color:"#fff",lineHeight:1}}>{totalProt}</span>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.3)"}}>/ {META_PROT}g</span>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.1)",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pctP}%`,background:"#5c9cff",borderRadius:99,transition:"width 0.4s"}}/>
            </div>
          </div>
        </div>
        <div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#fff",marginTop:14}}>
          {over ? `excediste por ${totalKcal-metaEfectivaDia} kcal` : totalKcal>=metaEfectivaDia&&totalProt>=META_PROT ? "objetivos cumplidos ✓" : `faltan ${remK} kcal · ${remP}g proteína`}
        </div>
        </div>
      </div>

      {/* Selector de visualización */}
      <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginBottom:12}}>
        {[["grid-lg","◫"],["grid-sm","▦"],["list","☰"]].map(([k,icon])=>(
          <button key={k} onClick={()=>setFoodView(k)} title={k} style={{width:30,height:28,borderRadius:8,border:"1px dashed #ddd",background:foodView===k?"#111":"transparent",color:foodView===k?"#fff":"#999",fontFamily:"'DM Sans',sans-serif",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</button>
        ))}
      </div>

      {/* Registro por comida */}
      {(()=>{
        // Fix redondeo (sesión angst-57): reparto de largest-remainder sobre
        // las 4 kcal exactas de las comidas, así la suma de las tarjetas
        // siempre da EXACTO totalKcal — antes cada tarjeta redondeaba por
        // separado y podía desviarse 1-2kcal del total mostrado arriba.
        const kcalRedondeados = distribuirRedondeo(MEALS.map(m=>cascade.meals[m.id].subKcal));
        const kcalPorMeal = Object.fromEntries(MEALS.map((m,i)=>[m.id, kcalRedondeados[i]]));
        return MEALS.map(meal=>{
        const entries = log.filter(e=>(e.meal||"snack")===meal.id);
        const mealData = cascade.meals[meal.id];
        const subKcal = kcalPorMeal[meal.id];
        const subProt = entries.reduce((s,e)=>s+e.prot*e.qty,0).toFixed(1);
        const limitDisp = Math.round(mealData.effectiveLimit);
        const pctMeal = limitDisp>0 ? Math.min(100, Math.round((subKcal / limitDisp) * 100)) : (subKcal>0?100:0);
        const mealOver = mealData.over;
        const isCollapsed = collapsedMeals[meal.id] !== false;
        // Mensaje del límite: el snack puede llegar sin margen (día ya
        // excedido en las 3 comidas principales) — se lo comunica directo
        // en vez de mostrar "límite 0kcal" sin contexto.
        const limitLabel = (meal.id==="snack" && mealData.sinMargen && entries.length===0)
          ? "sin margen — se suma directo al exceso del día"
          : (entries.length?(mealOver?`excedente +${Math.round(mealData.delta)} de ${limitDisp}kcal`:`${pctMeal}% de ${limitDisp}kcal`):`límite ${limitDisp}kcal`);
        return (
          <div key={meal.id} style={{marginBottom:12}}>
            <button onClick={()=>setCollapsedMeals(prev=>({...prev,[meal.id]:!isCollapsed}))} style={{width:"100%",background:"transparent",border:"1px dashed #ddd",borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#111"}}>{meal.emoji} {meal.label}</span>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#999",flexShrink:0}}>{isCollapsed?"▾":"▴"}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:6}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:entries.length?"#777":"#bbb"}}>
                  {entries.length?`${subKcal} kcal · ${subProt}g`:'sin registros'}
                </div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:mealOver?"#e53935":entries.length?"#999":"#ccc"}}>
                  {limitLabel}
                </div>
              </div>
            </button>
            {!isCollapsed && (entries.length===0
              ? <div style={{fontFamily:"'Caveat',cursive",fontSize:14,color:"#ddd",fontStyle:"italic",padding:"8px 4px 2px"}}>sin registros</div>
              : <div style={{marginTop:8}}>
                  <div style={foodView==="list"?{border:"1px dashed #ddd",borderRadius:10,overflow:"hidden"}:{display:"grid",gridTemplateColumns:foodView==="grid-sm"?"repeat(3,1fr)":"repeat(2,1fr)",gap:8}}>

                    {entries.map((e,i)=>(
                      <div key={e.uid} style={foodView==="list"?{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:i<entries.length-1?"1px dashed #f0f0f0":"none",background:i%2===0?"#fff":"#fafafa"}:{background:i%2===0?"#fff":"#fafafa",border:"1px dashed #e5e5e5",borderRadius:foodView==="grid-sm"?10:12,padding:foodView==="grid-sm"?10:12,minHeight:foodView==="grid-sm"?90:112,display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative"}}>
                        {foodView==="list" ? <span style={{fontSize:16,flexShrink:0}}>{e.emoji}</span> : <span style={{fontSize:foodView==="grid-sm"?18:24,lineHeight:1,marginBottom:6}}>{e.emoji}</span>}
                        <div onClick={()=>{setFichaFoodId(e.id);setView("ficha");}} style={foodView==="list"?{flex:1,minWidth:0,cursor:"pointer"}:{flex:1,width:"100%",cursor:"pointer"}}>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:foodView==="grid-sm"?11:13,color:"#333",fontWeight:600,lineHeight:1.25}}>{e.name}</div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>×{e.qty} {e.unit}</div>
                        </div>
                        <div style={foodView==="list"?{textAlign:"right",flexShrink:0}:{display:"flex",justifyContent:"space-between",alignItems:"baseline",width:"100%",marginTop:8}}>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:foodView==="grid-sm"?10:12,color:"#111",fontWeight:700}}>{Math.round(e.kcal*e.qty)} kcal</div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#888"}}>{(e.prot*e.qty).toFixed(1)}g</div>
                        </div>
                        {foodView==="list"
                          ? <>
                              <MoveMealButton uid={e.uid} currentMeal={meal.id} isOpen={moveMenuOpen===e.uid} onToggle={setMoveMenuOpen} onMove={moveEntryMeal}/>
                              <button onClick={()=>removeEntry(e.uid)} style={{background:"transparent",border:"none",color:"#ddd",fontSize:18,cursor:"pointer",padding:"0 2px",lineHeight:1,flexShrink:0}}>×</button>
                            </>
                          : <>
                              <MoveMealButton uid={e.uid} currentMeal={meal.id} isOpen={moveMenuOpen===e.uid} onToggle={setMoveMenuOpen} onMove={moveEntryMeal} compact/>
                              <button onClick={()=>removeEntry(e.uid)} style={{position:"absolute",top:6,right:6,background:"transparent",border:"none",color:"#d0d0d0",fontSize:16,cursor:"pointer",padding:2,lineHeight:1}}>×</button>
                            </>
                        }
                      </div>
                    ))}
                  </div>
                </div>
            )}
          </div>
        );
      }); })()}


      {/* Edit/Create food modal */}
      {editModal&&(
        <div onClick={()=>setEditModal(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#fff",borderRadius:"16px 16px 0 0",padding:"24px 24px 40px",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111",marginBottom:16}}>{editModal.isNew?"➕ nuevo alimento":"✎ editar alimento"}</div>
            {[{key:"emoji",label:"Emoji",placeholder:"🍽️"},{key:"name",label:"Nombre",placeholder:"nombre"},{key:"prep",label:"Descripción",placeholder:"prep..."},{key:"unit",label:"Unidad",placeholder:"unidad"}].map(({key,label,placeholder})=>(
              <div key={key} style={{marginBottom:10}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <input type="text" value={editModal.food[key]||""} placeholder={placeholder} onChange={e=>setEditModal(em=>({...em,food:{...em.food,[key]:e.target.value}}))}
                  style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            {[{key:"kcal",label:"Kcal"},{key:"prot",label:"Proteína (g)"}].map(({key,label})=>(
              <div key={key} style={{marginBottom:10}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <input type="number" value={editModal.food[key]||0} onChange={e=>setEditModal(em=>({...em,food:{...em.food,[key]:parseFloat(e.target.value)||0}}))}
                  style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Categoría</div>
              <select value={editModal.catKey} onChange={e=>setEditModal(em=>({...em,catKey:e.target.value,food:{...em.food,cat:e.target.value}}))}
                style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",background:"#fff"}}>
                {NUTRI_CATS.map(c=><option key={c.k} value={c.k}>{c.label}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Tipo de porción</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {PORTION_TYPES.map(({k,label})=>(
                  <button key={k} onClick={()=>setEditModal(em=>({...em,food:{...em.food,portionType:k||undefined}}))}
                    style={{padding:"5px 10px",borderRadius:8,border:"1px dashed #ddd",background:(editModal.food.portionType||"")===(k)?"#111":"transparent",color:(editModal.food.portionType||"")===(k)?"#fff":"#555",fontFamily:"'DM Sans',sans-serif",fontSize:11,cursor:"pointer"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveEdit} disabled={!editModal.food.name?.trim()}
              style={{width:"100%",background:editModal.food.name?.trim()?"#111":"#eee",color:editModal.food.name?.trim()?"#fff":"#aaa",border:"none",borderRadius:8,padding:"14px",fontFamily:"'Caveat',cursive",fontSize:18,cursor:"pointer",marginBottom:8}}>guardar</button>
            {!editModal.isNew&&(foodOverrides||{})[editModal.food.id]&&(
              <button onClick={()=>{const n={...(foodOverrides||{})};delete n[editModal.food.id];saveFoodOverrides(n);setEditModal(null);}}
                style={{width:"100%",background:"transparent",color:"#e53935",border:"1px dashed #e53935",borderRadius:8,padding:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer",marginBottom:8}}>restaurar original</button>
            )}
            <button onClick={()=>setEditModal(null)} style={{width:"100%",background:"transparent",color:"#bbb",border:"none",padding:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}}>cancelar</button>
          </div>
        </div>
      )}

      {/* Registrar ingesta — buscador con autocompletado */}
      <div style={{marginTop:22,marginBottom:10}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>registrar ingesta</div>
        {searchQuery.trim() && (
          <div style={{border:"1.5px dashed #111",borderRadius:10,marginBottom:8,overflow:"hidden",background:"#fff"}}>
            {searchResults.map(food=>(
              <div key={food.catKey+"-"+food.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderBottom:"1px dashed #f0f0f0"}}>
                <span onClick={()=>openModal(food)} style={{fontSize:16,flexShrink:0,cursor:"pointer"}}>{food.emoji}</span>
                <div onClick={()=>openModal(food)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{food.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>{food.kcal}kcal · {food.prot}g / {food.unit}</div>
                </div>
                <button onClick={()=>openEditModal(food,food.catKey)} style={{background:"transparent",border:"none",color:"#ccc",fontSize:13,cursor:"pointer",padding:"4px 6px",flexShrink:0}}>✎</button>
              </div>
            ))}
            {apiLoading && <div style={{padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#aaa"}}>buscando fuera de tu registro…</div>}
            {apiFoodResults.map(food=>(
              <div key={food.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderTop:"1px dashed #f0f0f0",background:"#fcfcfc"}}>
                <span onClick={()=>openModal(food)} style={{fontSize:16,flexShrink:0,cursor:"pointer"}}>{food.emoji}</span>
                <div onClick={()=>openModal(food)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#333",fontWeight:600}}>{food.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#9aa"}}>{food.kcal}kcal · {food.prot}g · api</div>
                </div>
                <button onClick={()=>saveCustomFoods({...(customFoods||{}),[food.id]:food})} style={{background:"transparent",border:"none",color:"#bbb",fontSize:16,cursor:"pointer",padding:"2px 4px",flexShrink:0}}>＋</button>
              </div>
            ))}
            {searchResults.length===0 && apiFoodResults.length===0 && !apiLoading && (
              <div onClick={()=>{openNewModal("otros",searchQuery.trim());setSearchQuery("");}}
                style={{padding:"12px 14px",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:15,color:"#555"}}>
                + agregar "{searchQuery.trim()}" como nuevo alimento
              </div>
            )}
            {!usdaKey && (
              <div style={{padding:"10px 12px",borderTop:"1px dashed #f0f0f0",display:"flex",gap:6}}>
                <input value={usdaKeyInput} onChange={e=>setUsdaKeyInput(e.target.value)} placeholder="API key de USDA FoodData Central"
                  style={{flex:1,minWidth:0,border:"1px solid #ddd",borderRadius:8,padding:"6px 8px",fontFamily:"'DM Sans',sans-serif",fontSize:11,outline:"none"}}/>
                <button onClick={()=>{ if(usdaKeyInput.trim()){ saveUsdaKey(usdaKeyInput.trim()); setUsdaKeyInput(""); } }}
                  style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,border:"none",borderRadius:8,padding:"6px 10px",background:"#111",color:"#fff",cursor:"pointer"}}>guardar</button>
              </div>
            )}
          </div>
        )}
        <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="escribe lo que comiste..."
          style={{width:"100%",border:"1.5px solid #111",borderRadius:10,padding:"12px 14px",fontFamily:"'Caveat',cursive",fontSize:16,outline:"none",boxSizing:"border-box",color:"#111"}}/>
      </div>

      {/* Explorar por categoría */}
      <button onClick={()=>setExploreOpen(o=>!o)} style={{width:"100%",background:"transparent",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",cursor:"pointer",padding:"6px 0 14px",textAlign:"center"}}>
        {exploreOpen?"▴ ocultar categorías":"▾ explorar por categoría"}
      </button>
      {exploreOpen && NUTRI_CATS.map(({k,label})=>(
        <div key={k} style={{marginBottom:8,border:"1px solid #eee",borderRadius:12,overflow:"hidden"}}>
          <div onClick={()=>setOpenCat(openCat===k?null:k)}
            style={{padding:"11px 16px",background:openCat===k?"#111":"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background 0.15s"}}>
            <span style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:openCat===k?"#fff":"#111"}}>{label}</span>
            <span style={{color:openCat===k?"#777":"#ccc",fontSize:12}}>{openCat===k?"▴":"▾"}</span>
          </div>
          {openCat===k&&(
            <div style={{borderTop:"1px solid #eee",padding:foodView==="list"?0:8}}>
              <div style={foodView==="list"?{}:{display:"grid",gridTemplateColumns:foodView==="grid-sm"?"repeat(3,1fr)":"repeat(2,1fr)",gap:8}}>
                {getMergedFoods(k).map(food=>renderFoodCard(food,k))}
              </div>
              <div style={{padding:foodView==="list"?"10px 16px":"10px 0 2px"}}>
                <button onClick={()=>openNewModal(k)} style={{width:"100%",background:"transparent",border:"1px dashed #ddd",borderRadius:foodView==="list"?8:12,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa",cursor:"pointer"}}>＋ agregar alimento</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div style={{height:32}}/>
    </div>
  );
}

export default NutricionPage;
