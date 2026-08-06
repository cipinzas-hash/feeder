// ─── PokeLoader ───────────────────────────────────────────────────────────────
function PokeLoader({ active }) {
  const [filled, setFilled] = React.useState(0);
  React.useEffect(()=>{
    if(!active){ setFilled(0); return; }
    setFilled(0);
    let i = 0;
    const iv = setInterval(()=>{ i=(i+1)%9; setFilled(i); }, 350);
    return ()=>clearInterval(iv);
  },[active]);
  const segs = 8, r = 18, cx = 22, cy = 22;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 0 12px",gap:10}}>
      <svg width={44} height={44} viewBox="0 0 44 44">
        {Array.from({length:segs}).map((_,i)=>{
          const a=(i/segs)*Math.PI*2-Math.PI/2, na=((i+1)/segs)*Math.PI*2-Math.PI/2;
          return <path key={i} d={`M ${cx} ${cy} L ${(cx+r*Math.cos(a)).toFixed(2)} ${(cy+r*Math.sin(a)).toFixed(2)} A ${r} ${r} 0 0 1 ${(cx+r*Math.cos(na)).toFixed(2)} ${(cy+r*Math.sin(na)).toFixed(2)} Z`}
            fill={filled>i?"#111":"#eee"} stroke="#fff" strokeWidth="2" style={{transition:"fill 0.2s"}}/>;
        })}
        <circle cx={cx} cy={cy} r={8} fill="#fff"/>
        <line x1={4} y1={cy} x2={40} y2={cy} stroke={filled>0?"#111":"#ddd"} strokeWidth="1.5"/>
        <circle cx={cx} cy={cy} r={4} fill="#fff" stroke={filled>0?"#111":"#ddd"} strokeWidth="1.5"/>
      </svg>
      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",letterSpacing:2,textTransform:"uppercase"}}>buscando</span>
    </div>
  );
}

// ─── PokeCripto — constantes y helpers ────────────────────────────────────────
const USD_CLP = 1000;
const CONDICIONES = ["NM","LP","MP","HP","DMG"];
export const CARPETAS_DEFAULT = ["MLP","Staples & Meta","Dark Collection"];
const CARPETAS_ICONS = {"MLP":"🐴","Staples & Meta":"⚡","Dark Collection":"⚫"};
const ESTADOS = {
  hunting:      { label:"hunting",      color:"#7c4dff", bg:"#ede7f6" },
  sin_publicar: { label:"sin publicar", color:"#888",    bg:"#f0f0f0" },
  a_la_venta:   { label:"a la venta",   color:"#2e7d52", bg:"#e8f5e9" },
  vendida:      { label:"vendida",       color:"#555",    bg:"#f5f5f5" },
};
const MEGA_SETS = [
  {id:"me1",  name:"Mega Evolution",    releaseDate:"2025-09-26"},
  {id:"me2",  name:"Phantasmal Flames", releaseDate:"2025-11-14"},
  {id:"me25", name:"Ascended Heroes",   releaseDate:"2026-01-30"},
  {id:"me3",  name:"Perfect Order",     releaseDate:"2026-03-27"},
  {id:"me4",  name:"Chaos Rising",      releaseDate:"2026-05-22"},
  {id:"me5",  name:"Pitch Black",       releaseDate:"2026-07-17"},
];
// Sets de promo de la era Mega Evolution — se incluyen por ID fijo porque son
// contenedores que siguen sumando cartas nuevas (ETB exclusives, blister promos)
// sin que su releaseDate de set se actualice, así que el filtro por fecha en
// loadDarkSets() los excluye. ⚠️ VERIFICAR ID contra la API real la primera vez
// que corra esto — si el ID está mal, el fetch simplemente devuelve 0 cartas
// (no rompe nada), y hay que corregirlo acá.
const MEGA_PROMO_SETS = [
  {id:"mep", name:"Mega Evolution Promos", releaseDate:"2025-09-26"},
];
const TCG_BASE = "https://api.tcgpricelookup.com/v1";
const POKE_BASE = "https://api.pokemontcg.io/v2";
const RESYNC_INTERVAL_MS = 24*60*60*1000; // resync automático de sets ya trackeados, 1x/día

// ── Modelo de estado para el catálogo Dark ──
// Desde esta sesión, Dark Collection deja de guardar precio/estado propios:
// cada carta del catálogo que no está conseguida ES una carta del pool real
// (inv) con estado:"hunting" — mismo mecanismo confiable de snapshots que
// cualquier otra carta. mergeDarkWithInv() junta el catálogo con su carta
// de inv correspondiente y le pone `.estado`; getEstadoDark lee de ahí.
// Los campos `estadoDark`/`conseguida` sueltos son fallback legacy, por si
// se llama sobre una entrada de catálogo cruda (aún no migrada/mergeada).
function getEstadoDark(entry){
  if(!entry) return "hunting";
  if(entry.estado) return entry.estado==="hunting" ? "hunting" : "conseguida";
  if(entry.estadoDark) return entry.estadoDark;
  return entry.conseguida ? "conseguida" : "hunting";
}

function fmtUSD(n){ return "$"+parseFloat(n||0).toFixed(2); }
function fmtPokeCLP(n){ return "$"+Math.round((n||0)*USD_CLP).toLocaleString("es-CL"); }
function fmtDateShort(dk){ if(!dk) return ""; const [,m,d]=dk.split("-"); return `${d}/${m}`; }

function getPrimaryPrice(card){
  const p = card?.tcgplayer?.prices;
  if(!p) return null;
  const priority = ["holofoil","reverseHolofoil","normal","1stEditionHolofoil","unlimitedHolofoil","1stEdition","unlimited"];
  for(const k of priority){ if(p[k]?.market) return {market:p[k].market, low:p[k].low, high:p[k].high}; }
  const first = Object.entries(p).find(([,v])=>v?.market);
  return first ? {market:first[1].market, low:first[1].low, high:first[1].high} : null;
}

function isDarkCard(card){
  if(!card) return false;
  if((card.types||[]).includes("Darkness")) return true;
  if(card.supertype==="Energy" && (card.name||"").toLowerCase().includes("darkness")) return true;
  const hasDark = t => {
    if(!t) return false;
    const l = t.toLowerCase();
    return (
      l.includes("darkness energy") || l.includes("darkness pokémon") ||
      l.includes("darkness pokemon") || l.includes("darkness type") ||
      l.includes("darkness-type") || l.includes("non-darkness") ||
      l.includes("basic darkness") || l.includes("{d} energy") ||
      l.includes("[d] energy") || t.includes("[D]") || t.includes("{D}")
    );
  };
  if((card.attacks||[]).some(a=>(a.cost||[]).includes("Darkness")||hasDark(a.text))) return true;
  if((card.abilities||[]).some(a=>hasDark(a.text))) return true;
  if((card.rules||[]).some(r=>hasDark(r))) return true;
  if(hasDark(card.text)) return true;
  return false;
}

function addSnapshot(history, market, low, high){
  const today = new Date().toISOString().slice(0,10);
  const h = history||[];
  if(h.length && h[h.length-1].date===today)
    return h.map((x,i)=>i===h.length-1?{...x,market,low,high}:x);
  return [...h, {date:today, market, low:low||null, high:high||null}];
}

// Construye la carta de inv correspondiente a una carta recién descubierta
// del catálogo Dark — nace en estado "hunting" (la querés, no la tenés),
// carpeta "Dark Collection". Desde acá en más es una carta del pool real,
// con el mismo scheduler de precios y la misma ficha que cualquier otra.
function huntingEntryFromCard(c, s){
  return {
    id:Date.now().toString()+Math.random().toString(36).slice(2)+"_"+c.id,
    cardId:c.id,name:c.name,
    set:s.name||"",setCode:s.id||"",
    number:c.number||"",rarity:c.rarity||"",
    image:c.images?.small||"",imageHd:c.images?.large||"",
    tcgMarket:null,tcgLow:null,tcgHigh:null,tcgUpdated:null,
    priceHistory:[],
    costoUSD:0,precioVentaUSD:0,
    condicion:"NM",estado:"hunting",
    carpeta:"Dark Collection",
    fechaCompra:null,cantidad:1,
    fechaVenta:null,precioVendidoUSD:null,
    notas:"",isDark:true,
  };
}

async function fetchPoke(url){
  const r = await fetch(url, {signal:AbortSignal.timeout(10000)});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}

async function fetchTCGPrice(name, setName, number, setCode, apiKey){
  const price = await fetchTCGPriceDiag(name, setName, number, setCode, apiKey);
  return price?.match ? {market:price.market, low:price.low, high:price.high} : null;
}

// Normaliza un número de colección para comparar: pokemontcg.io y
// tcgpricelookup.com no siempre usan el mismo formato (ceros a la
// izquierda, sufijos "/122", letras de secret rare) — sacamos todo lo que
// no sea alfanumérico y los ceros iniciales, así "004" === "4" === "4/122".
function normNum(n){
  return String(n||"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/^0+(?=\d)/,"");
}
// Mismo criterio para el nombre: pokemontcg.io y tcgpricelookup.com pueden
// diferir en espacios dobles, guiones (- vs – vs —), may/minúscula de "ex"/
// "EX", o acentos -- nada de eso debería impedir el match si el número ya
// lo ancla a la carta correcta. Se le saca todo signo de puntuación y
// espacios, y se le sacan acentos (NFD + strip de diacríticos).
function normName(s){
  return String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"") // acentos
    .toLowerCase().replace(/[^a-z0-9]/g,"");
}

// Versión con diagnóstico completo de fetchTCGPrice -- devuelve además la
// query mandada, los candidatos que trajo tcgpricelookup.com, y por qué no
// matcheó ninguno (si es el caso). fetchTCGPrice (arriba) es un wrapper
// liviano de esto para no duplicar la lógica de búsqueda/match en dos
// lugares -- antes de este cambio estaban duplicadas y podían divergir.
async function fetchTCGPriceDiag(name, setName, number, setCode, apiKey){
  if(!apiKey) return {error:"sin API key"};
  try{
    let q = name;
    if(setCode && number) q = `${name} ${setCode} ${number}`;
    else if(number)       q = `${name} ${number}`;
    const r = await fetch(`${TCG_BASE}/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=20`,
      {headers:{"X-API-Key":apiKey}, signal:AbortSignal.timeout(8000)});
    if(!r.ok) return {error:`HTTP ${r.status}`, query:q};
    const data = await r.json();
    const cards = data.data||[];
    const nameNorm=normName(name), numNorm=normNum(number);
    const setCodeLow=(setCode||"").toLowerCase();
    // Solo matcheamos con nombre+número (+setCode si lo tenemos). Nada de
    // fallback por nombre solo o por prefijo de set — eso es lo que generaba
    // snapshots de la variante equivocada (holo vs estándar, u otro set con
    // carta homónima). Preferimos no tener precio a tener uno contaminado.
    // El nombre se compara normalizado (sin acentos/puntuación/espacios) en
    // vez de string exacto -- el número sigue siendo el ancla real.
    const match =
      (number && setCode && cards.find(c=>normName(c.name)===nameNorm&&normNum(c.number)===numNorm&&(c.set?.ptcgoCode?.toLowerCase()===setCodeLow||c.set?.id?.toLowerCase()===setCodeLow))) ||
      (number && cards.find(c=>normName(c.name)===nameNorm&&normNum(c.number)===numNorm));
    const candidatos = cards.slice(0,10).map(c=>({name:c.name, number:c.number, setId:c.set?.id, setCode:c.set?.ptcgoCode, tieneRaw: !!c.prices?.raw}));
    if(!match) return {query:q, candidatos, matchEncontrado:false};
    const nm=match.prices?.raw?.near_mint?.tcgplayer, lp=match.prices?.raw?.lightly_played?.tcgplayer;
    const best=nm||lp;
    return {
      query:q, candidatos, matchEncontrado:true,
      matchNombre:match.name, matchNumero:match.number,
      preciosDisponibles: Object.keys(match.prices||{}),
      tienePrecioTcgplayer: !!best,
      match: best?.market?true:false,
      market: best?.market, low: best?.low||null, high: best?.high||null,
    };
  }catch(e){ return {error:e.message}; }
}

// ── Métricas de historial ──────────────────────────────────────────────────────
function computeHistMetrics(history, range){
  const pts = (history||[]).filter(h=>h.market);
  if(!pts.length) return {ath:null,atl:null,athDate:null,atlDate:null,vol:null,volLabel:null,filtered:[]};
  const now = new Date(pts[pts.length-1].date+"T12:00:00");
  let filtered = pts;
  if(range==="7d"){
    const cut = new Date(now); cut.setDate(cut.getDate()-7);
    filtered = pts.filter(p=>new Date(p.date+"T12:00:00")>=cut);
  } else if(range==="30d"){
    const cut = new Date(now); cut.setDate(cut.getDate()-30);
    filtered = pts.filter(p=>new Date(p.date+"T12:00:00")>=cut);
  }
  if(!filtered.length) filtered = pts;
  // ATH/ATL sobre todo el historial
  let ath=pts[0].market, athDate=pts[0].date, atl=pts[0].market, atlDate=pts[0].date;
  pts.forEach(p=>{ if(p.market>ath){ath=p.market;athDate=p.date;} if(p.market<atl){atl=p.market;atlDate=p.date;} });
  // Volatilidad: desviación estándar de retornos diarios
  let vol=null, volLabel=null;
  if(pts.length>=3){
    const returns=[];
    for(let i=1;i<pts.length;i++){
      if(pts[i-1].market>0) returns.push((pts[i].market-pts[i-1].market)/pts[i-1].market);
    }
    if(returns.length){
      const mean=returns.reduce((s,r)=>s+r,0)/returns.length;
      const variance=returns.reduce((s,r)=>s+(r-mean)**2,0)/returns.length;
      vol=(Math.sqrt(variance)*100).toFixed(1);
      volLabel=parseFloat(vol)<2?"baja":parseFloat(vol)<5?"media":"alta";
    }
  }
  return {ath,athDate,atl,atlDate,vol,volLabel,filtered};
}

// ── Gráfico SVG con eje de fecha real ─────────────────────────────────────────
function PriceChart({history, precioVenta, compact, range, onSelectPoint, selectedPoint}){
  const pts=(history||[]).filter(h=>h.market);
  if(pts.length<2) return null;
  const metrics=computeHistMetrics(history,range||"todo");
  const filtered=metrics.filtered;
  if(filtered.length<2) return null;
  const W=compact?180:290, H=compact?44:90, padL=8, padR=8, padT=8, padB=compact?8:20;
  const vals=[...filtered.map(h=>h.market), precioVenta].filter(Boolean);
  const minV=Math.min(...vals)*0.93, maxV=Math.max(...vals)*1.07, rng=maxV-minV||1;
  const t0=new Date(filtered[0].date+"T12:00:00").getTime();
  const t1=new Date(filtered[filtered.length-1].date+"T12:00:00").getTime();
  const tRng=t1-t0||1;
  const px=d=>padL+((new Date(d+"T12:00:00").getTime()-t0)/tRng)*(W-padL-padR);
  const py=v=>padT+H-padB-((v-minV)/rng)*(H-padT-padB);
  const path=filtered.map((h,i)=>`${i===0?"M":"L"}${px(h.date).toFixed(1)},${py(h.market).toFixed(1)}`).join(" ");
  const last=filtered[filtered.length-1];
  const first=filtered[0];
  const up=last.market>=first.market;
  const color=precioVenta?(last.market<precioVenta?"#2e7d52":"#e53935"):(up?"#2e7d52":"#e53935");
  return(
    <svg width="100%" height={H+padB} viewBox={`0 0 ${W} ${H+padB}`} preserveAspectRatio="xMidYMid meet"
      style={{display:"block",maxWidth:W,overflow:"visible",cursor:compact?"default":"crosshair"}}
      onClick={compact?null:e=>{
        if(!onSelectPoint) return;
        const rect=e.currentTarget.getBoundingClientRect();
        const mx=(e.clientX-rect.left)*(W/rect.width);
        let closest=null, minDist=999;
        filtered.forEach(h=>{
          const d=Math.abs(px(h.date)-mx);
          if(d<minDist){minDist=d;closest=h;}
        });
        if(closest&&minDist<20) onSelectPoint(closest);
      }}>
      {/* Grid horizontal */}
      {!compact&&[0.25,0.5,0.75].map(f=>{
        const v=minV+f*rng;
        return <line key={f} x1={padL} y1={py(v)} x2={W-padR} y2={py(v)} stroke="#f0f0f0" strokeWidth="1"/>;
      })}
      {/* Línea precio venta */}
      {precioVenta&&!compact&&<line x1={padL} y1={py(precioVenta)} x2={W-padR} y2={py(precioVenta)}
        stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>}
      {/* Línea de precio */}
      <path d={path} fill="none" stroke={color} strokeWidth={compact?1.5:2} strokeLinejoin="round" strokeLinecap="round"/>
      {/* Puntos */}
      {filtered.map((h,i)=>{
        const isSel=selectedPoint&&selectedPoint.date===h.date&&selectedPoint.market===h.market;
        return(
          <circle key={i} cx={px(h.date)} cy={py(h.market)} r={isSel?5:compact?1.5:2.5}
            fill={isSel?"#fff":color} stroke={isSel?color:"none"} strokeWidth={isSel?2:0}/>
        );
      })}
      {/* Labels eje X */}
      {!compact&&(()=>{
        const show=[filtered[0], filtered[Math.floor(filtered.length/2)], filtered[filtered.length-1]];
        return show.map((h,i)=>(
          <text key={i} x={px(h.date)} y={H+padB-2} textAnchor={i===0?"start":i===2?"end":"middle"}
            fontSize="8" fontFamily="DM Sans,sans-serif" fill="#bbb">{fmtDateShort(h.date)}</text>
        ));
      })()}
      {/* Label último valor */}
      <text x={px(last.date)} y={py(last.market)-5} textAnchor="end"
        fontSize={compact?8:9} fontFamily="DM Sans,sans-serif" fill={color} fontWeight="700">
        {fmtUSD(last.market)}
      </text>
    </svg>
  );
}

// ─── PokecriptoPage ─────────────────────────────────────────────────────────────
function PokecriptoPage({inventario,saveInventario,carpetas,saveCarpetas,darkCatalogo,saveDarkCatalogo,priceCache,savePriceCache,apiKey,saveApiKey}){
  const inv     = inventario||[];
  const cats    = carpetas||[...CARPETAS_DEFAULT];
  const darkCat = darkCatalogo||[];
  const cache   = priceCache||{};
  const hoy     = new Date().toISOString().slice(0,10);

  // ── Estado principal ──
  const [view,           setView]           = React.useState("coleccion");
  const [fichaId,        setFichaId]        = React.useState(null);
  const [carpetaView,    setCarpetaView]    = React.useState(null); // nombre de carpeta hardcodeada
  const [carpetaFiltro,  setCarpetaFiltro]  = React.useState("todas");
  const [filterEstado,   setFilterEstado]   = React.useState("todos");
  const [sortBy,         setSortBy]         = React.useState("fecha");
  const [sortAsc,        setSortAsc]        = React.useState(false);
  const [poolView,       setPoolView]       = React.useState("lista");
  const [query,          setQuery]          = React.useState("");
  const [results,        setResults]        = React.useState([]);
  const [loading,        setLoading]        = React.useState(false);
  const [searchErr,      setSearchErr]      = React.useState(null);
  const [addingCard,     setAddingCard]     = React.useState(null);
  const [zoomImage,      setZoomImage]      = React.useState(null);
  const [newForm,        setNewForm]        = React.useState({costoUSD:"",precioVentaUSD:"",condicion:"NM",notas:"",fechaCompra:hoy,carpeta:cats[0]||"MLP",cantidad:1,destino:"inventario"});
  const [vendModal,      setVendModal]      = React.useState(false);
  const [vendPrecio,     setVendPrecio]     = React.useState("");
  const [vendFecha,      setVendFecha]      = React.useState(hoy);
  const [editMode,       setEditMode]       = React.useState(false);
  const [editFields,     setEditFields]     = React.useState({});
  const [darkView,       setDarkView]       = React.useState("grid_small");
  const [darkSets,       setDarkSets]       = React.useState([]);
  const [darkSetsLoading,setDarkSetsLoading]= React.useState(false);
  const [showAddCarpeta, setShowAddCarpeta] = React.useState(false);
  const [newCarpeta,     setNewCarpeta]     = React.useState("");
  const [schedStatus,    setSchedStatus]    = React.useState(null);
  const [schedProgress,  setSchedProgress]  = React.useState({done:0,total:0});
  const [schedLog,       setSchedLog]       = React.useState([]);
  const [apiKeyInput,    setApiKeyInput]    = React.useState("");
  const [diagResult, setDiagResult] = React.useState(null);
  const [diagLoading, setDiagLoading] = React.useState(false);
  const [showSchedLog,   setShowSchedLog]   = React.useState(false);
  const [darkPriceModal, setDarkPriceModal] = React.useState(null);
  const [darkPrecioInput,setDarkPrecioInput]= React.useState("");
  const [darkNotaInput,  setDarkNotaInput]  = React.useState("");
  const [repoblando,     setRepoblando]     = React.useState(false);
  // Ficha
  const [chartRange,     setChartRange]     = React.useState("todo");
  const [selectedPoint,  setSelectedPoint]  = React.useState(null);
  const [confirmDelSnap, setConfirmDelSnap] = React.useState(null);
  const schedAbort = React.useRef(false);
  // Detalle de carta en Dark Collection / pool hunting (cambio 2 de la sesión)
  const [darkDetailId,   setDarkDetailId]   = React.useState(null); // cardId del detalle abierto
  const [darkDetailRange,setDarkDetailRange]= React.useState("todo");
  // Long-press sobre imagen → fullscreen (cambio 9). Un solo ref porque solo
  // puede haber una presión activa a la vez; el flag `fired` se usa para
  // suprimir el click/tap normal que dispara la acción principal de la fila.
  const pressRef = React.useRef({timer:null, fired:false});
  function bindLongPress(imgUrl){
    if(!imgUrl) return {};
    const start=()=>{ pressRef.current.fired=false; clearTimeout(pressRef.current.timer);
      pressRef.current.timer=setTimeout(()=>{ pressRef.current.fired=true; setZoomImage(imgUrl); }, 380); };
    const cancel=()=>{ clearTimeout(pressRef.current.timer); };
    return { onTouchStart:start, onTouchEnd:cancel, onTouchMove:cancel, onMouseDown:start, onMouseUp:cancel, onMouseLeave:cancel };
  }
  function guardLongPressClick(fn){
    return (e)=>{ if(pressRef.current.fired){ pressRef.current.fired=false; return; } fn(e); };
  }
  // Resync automático periódico (cambio 6)
  const [resyncStatus,   setResyncStatus]   = React.useState(null);
  const resyncAbort = React.useRef(false);

  // ── Sync ficha ──
  React.useEffect(()=>{
    if(!fichaId) return;
    const c=inv.find(x=>x.id===fichaId);
    if(!c) return;
    setVendPrecio(String(c.precioVentaUSD||""));
    setVendFecha(hoy);
    setEditMode(false);
    setEditFields({costoUSD:c.costoUSD||0,precioVentaUSD:c.precioVentaUSD||0,
      condicion:c.condicion||"NM",notas:c.notas||"",carpeta:c.carpeta||cats[0],
      fechaCompra:c.fechaCompra||hoy,cantidad:c.cantidad||1});
    setVendModal(false);
    setSelectedPoint(null);
    setChartRange("todo");
  },[fichaId]);

  // ── Sync modal de detalle Dark — mismo reset que la ficha, para que un
  // punto seleccionado o una confirmación de borrado no se arrastre de una
  // carta a otra al abrir/cerrar el modal. ──
  React.useEffect(()=>{
    if(!darkDetailId) return;
    setSelectedPoint(null);
    setConfirmDelSnap(null);
    setDarkDetailRange("todo");
  },[darkDetailId]);

  // ── Migración: el precio y el estado de Dark Collection pasan a vivir en
  // el pool de cartas real (inv) ──
  // Hasta ahora, tanto el viejo "pool hunting manual" (darkCat+manual:true)
  // como el catálogo Dark real guardaban su propio precio/estado — y por
  // eso nunca acumulaban snapshots de forma confiable ni generaban gráfico
  // (mecanismo paralelo, sin el scheduler robusto del inventario). Desde
  // esta sesión, cada carta del catálogo Dark que no está conseguida ES una
  // carta de `inv` con estado:"hunting" — misma ficha, mismo scheduler,
  // mismo ATH/ATL, mismo borrado de snapshots. Acá migramos una sola vez
  // todo lo que ya existía (manuales + catálogo con precio propio),
  // preservando priceHistory/estado/notas, y dejamos darkCat reducido a
  // solo identidad (cardId/name/número/set) — el resto vive en inv.
  React.useEffect(()=>{
    const invIds=new Set(inv.map(c=>c.cardId));
    const manuales=darkCat.filter(d=>d.manual&&!invIds.has(d.cardId));
    const legacyDark=darkCat.filter(d=>!d.manual&&!invIds.has(d.cardId)&&
      (d.estadoDark||d.conseguida||d.tcgMarket||(d.priceHistory&&d.priceHistory.length)));
    const aMigrar=[...manuales,...legacyDark];
    if(aMigrar.length){
      const nuevasInv=aMigrar.map(d=>({
        id:Date.now().toString()+Math.random().toString(36).slice(2)+"_"+d.cardId,
        cardId:d.cardId,name:d.name,
        set:d.setName||"",setCode:d.setCode||d.setId||"",
        number:d.number||"",rarity:"",
        image:d.image||"",imageHd:d.image||"",
        tcgMarket:d.tcgMarket||null,tcgLow:null,tcgHigh:null,
        tcgUpdated:d.tcgUpdated||null,
        priceHistory:d.priceHistory||[],
        costoUSD:d.manual?0:(d.precioUSD||0),
        precioVentaUSD:d.precioUSD||d.tcgMarket||0,
        condicion:"NM",
        estado: getEstadoDark(d)==="conseguida" ? "sin_publicar" : "hunting",
        carpeta: d.manual?(cats[0]||"MLP"):"Dark Collection",
        fechaCompra:d.fechaConseguida||null,
        cantidad:1,
        fechaVenta:null,precioVendidoUSD:null,
        notas:d.notas||"",isDark:!d.manual,
      }));
      saveInventario(prev=>[...nuevasInv,...(prev||[])]);
    }
    saveDarkCatalogo(prev=>(prev||[]).filter(d=>!d.manual).map(d=>{
      const {estadoDark,conseguida,tcgMarket,tcgLow,tcgHigh,tcgUpdated,priceHistory,precioUSD,notas,fechaConseguida,...limpio}=d;
      return {...limpio, setCode:d.setCode||d.setId||""};
    }));
  },[]);

  // ── Auto-fetch precio en ficha ──
  React.useEffect(()=>{
    if(view!=="ficha"||!fichaId) return;
    const carta=inv.find(c=>c.id===fichaId);
    if(carta) refreshPrecio(carta);
  },[view,fichaId]);

  // ── Auto-cargar sets dark (incluye promos por ID fijo — cambio 5) ──
  React.useEffect(()=>{
    if(view!=="dark"&&carpetaView!=="Dark Collection") return;
    if(!darkSets.length&&!darkSetsLoading) loadDarkSets();
  },[view,carpetaView]);

  // ── Auto-poblar catálogo dark con sets nuevos ──
  // El catálogo guarda solo identidad (cardId/name/número/set) — el precio y
  // el estado (hunting/conseguida) viven en la carta de inv correspondiente,
  // que se crea acá mismo en estado "hunting" para que junte snapshots con
  // el mismo scheduler confiable que cualquier otra carta del pool.
  React.useEffect(()=>{
    if(!darkSets.length) return;
    const enCat=new Set(darkCat.map(d=>d.setId));
    const nuevos=darkSets.filter(s=>!enCat.has(s.id));
    if(!nuevos.length) return;
    let idx=0;
    function siguiente(){
      if(idx>=nuevos.length) return;
      const s=nuevos[idx++];
      fetchPoke(`${POKE_BASE}/cards?q=set.id:${s.id}&select=id,name,number,supertype,subtypes,images,types,attacks,abilities,rules,text&orderBy=number&pageSize=500`)
        .then(data=>{
          const dark=(data.data||[]).filter(isDarkCard);
          if(dark.length){
            const nuevas=dark.map(c=>({
              cardId:c.id,name:c.name,image:c.images?.small||"",
              number:c.number||"",setName:s.name,setId:s.id,setCode:s.id,
              releaseDate:s.releaseDate||"",
            }));
            saveDarkCatalogo(prev=>{
              const ids=new Set((prev||[]).map(d=>d.cardId));
              const add=nuevas.filter(n=>!ids.has(n.cardId));
              return add.length?[...(prev||[]),...add]:(prev||[]);
            });
            saveInventario(prev=>{
              const cur=prev||[];
              const ids=new Set(cur.map(c=>c.cardId));
              const add=dark.filter(c=>!ids.has(c.id)).map(c=>huntingEntryFromCard(c,s));
              return add.length?[...cur,...add]:cur;
            });
          }
          setTimeout(siguiente,400);
        }).catch(()=>setTimeout(siguiente,800));
    }
    siguiente();
  },[darkSets]);

  // ── Resync automático periódico de sets ya trackeados (cambio 6) ──
  // El "🔄 repoblar" manual sigue existiendo, pero esto corre solo 1x/día sin
  // que Cristopher tenga que acordarse: re-pide las cartas de cada set que ya
  // conocemos y suma las que pokemontcg.io haya indexado con lag, sin tocar
  // el progreso (conseguida/hunting/precio) de las que ya están.
  React.useEffect(()=>{
    if(!darkSets.length) return;
    const lastSync=cache._lastResyncDate;
    if(lastSync && (Date.now()-new Date(lastSync).getTime())<RESYNC_INTERVAL_MS) return;
    resyncAbort.current=false;
    setResyncStatus("running");
    let idx=0;
    const sets=[...darkSets];
    function siguiente(){
      if(resyncAbort.current||idx>=sets.length){
        setResyncStatus("done");
        savePriceCache(prev=>({...(prev||{}),_lastResyncDate:new Date().toISOString()}));
        return;
      }
      const s=sets[idx++];
      fetchPoke(`${POKE_BASE}/cards?q=set.id:${s.id}&select=id,name,number,supertype,subtypes,images,types,attacks,abilities,rules,text&orderBy=number&pageSize=500`)
        .then(data=>{
          const dark=(data.data||[]).filter(isDarkCard);
          if(dark.length){
            saveDarkCatalogo(prev=>{
              const cur=prev||[];
              const ids=new Set(cur.map(d=>d.cardId));
              const nuevas=dark.filter(c=>!ids.has(c.id)).map(c=>({
                cardId:c.id,name:c.name,image:c.images?.small||"",
                number:c.number||"",setName:s.name,setId:s.id,setCode:s.id,
                releaseDate:s.releaseDate||"",
              }));
              return nuevas.length?[...cur,...nuevas]:cur;
            });
            saveInventario(prev=>{
              const cur=prev||[];
              const ids=new Set(cur.map(c=>c.cardId));
              const add=dark.filter(c=>!ids.has(c.id)).map(c=>huntingEntryFromCard(c,s));
              return add.length?[...cur,...add]:cur;
            });
          }
          setTimeout(siguiente,500);
        }).catch(()=>setTimeout(siguiente,900));
    }
    siguiente();
    return ()=>{ resyncAbort.current=true; };
  },[darkSets]);

  // ── Scheduler diario — 200/día (cambio 4) ──
  // Todo el pool de cartas (inventario real + hunting, incluida Dark
  // Collection ya que ahora es una carta más de inv) se refresca desde el
  // mismo lugar, ordenado por snapshot más antiguo. Ya no hay una rama
  // separada para Dark Collection — antes tenía su propio mecanismo de
  // precio paralelo, que era justo la causa de que no generara gráficos.
  React.useEffect(()=>{
    if(!inv.length) return;
    const DAILY_CAP=200;
    const log=cache._snapshotLog||{};
    const yaHoy=log.date===hoy;
    const yaHechas=yaHoy?(log.count||0):0;
    if(yaHoy&&yaHechas>=DAILY_CAP) return;
    const invCandidatas=inv
      .filter(c=>c.estado!=="vendida"&&c.cardId)
      .sort((a,b)=>(a.tcgUpdated||"2000-01-01").localeCompare(b.tcgUpdated||"2000-01-01"));
    const cupoRestante=DAILY_CAP-yaHechas;
    const candidatas=invCandidatas.slice(0,cupoRestante);
    if(!candidatas.length) return;
    schedAbort.current=false;
    setSchedStatus("running");
    setSchedProgress({done:0,total:candidatas.length});
    setSchedLog([]);
    let i=0;
    async function processNext(){
      if(schedAbort.current||i>=candidatas.length){ setSchedStatus("done"); return; }
      const carta=candidatas[i++];
      const prevMarket=carta.tcgMarket||null;
      const newMarket=await refreshPrecioSilent(carta);
      if(prevMarket&&newMarket){
        const delta=((newMarket-prevMarket)/prevMarket*100).toFixed(1);
        setSchedLog(prev=>[...prev,{name:carta.name,image:carta.image,prevMarket,newMarket,delta}]);
      }
      const newCount=yaHechas+i;
      savePriceCache(prev=>({...(prev||{}),_snapshotLog:{date:hoy,count:newCount}}));
      setSchedProgress({done:i,total:candidatas.length});
      setTimeout(processNext,1500);
    }
    processNext();
    return ()=>{ schedAbort.current=true; };
  },[inv.length]);

  // ── Precio ──
  async function refreshPrecioSilent(carta){
    let market=null,low=null,high=null;
    if(carta.cardId){
      try{
        const data=await fetchPoke(`${POKE_BASE}/cards/${carta.cardId}`);
        const pp=getPrimaryPrice(data.data);
        if(pp?.market){market=pp.market;low=pp.low||null;high=pp.high||null;}
      }catch(e){}
    }
    if(!market){
      const p=await fetchTCGPrice(carta.name,carta.set,carta.number,carta.setCode,apiKey);
      if(p?.market){market=p.market;low=p.low||null;high=p.high||null;}
    }
    if(!market) return null;
    const newHist=addSnapshot(carta.priceHistory,market,low,high);
    saveInventario(prev=>(Array.isArray(prev)?prev:[]).map(c=>c.id===carta.id
      ?{...c,tcgMarket:market,tcgLow:low,tcgHigh:high,tcgUpdated:hoy,priceHistory:newHist}:c));
    return market;
  }

  async function refreshPrecio(carta){ await refreshPrecioSilent(carta); }

  // ── Dark sets ──
  async function loadDarkSets(){
    setDarkSetsLoading(true);
    let sets=[];
    try{
      const data=await fetchPoke(`${POKE_BASE}/sets?q=releaseDate:[2025/09/26 TO 2099/12/31]&orderBy=-releaseDate&pageSize=100`);
      sets=data.data||[];
    }catch(e){}
    MEGA_SETS.forEach(known=>{ if(!sets.find(s=>s.id===known.id)) sets.push({id:known.id,name:known.name,releaseDate:known.releaseDate,images:{symbol:"",logo:""}}); });
    // Sets de promo — se incluyen SIEMPRE por ID fijo, sin importar su
    // releaseDate de contenedor (cambio 5: ver comentario junto a MEGA_PROMO_SETS).
    MEGA_PROMO_SETS.forEach(promo=>{ if(!sets.find(s=>s.id===promo.id)) sets.push({id:promo.id,name:promo.name,releaseDate:promo.releaseDate,images:{symbol:"",logo:""},isPromo:true}); });
    sets.sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate));
    setDarkSets(sets);
    setDarkSetsLoading(false);
  }

  // ── Repoblar Dark Collection preservando progreso ──
  async function repoblarDark(){
    // El progreso (estado/precio/historial/notas) vive en inv, no en darkCat
    // — vaciar el catálogo y dejar que el auto-poblado lo reconstruya no
    // toca esas cartas para nada, se reconectan solas por cardId.
    setRepoblando(true);
    saveDarkCatalogo([]);
    if(!darkSets.length) await loadDarkSets();
    setTimeout(()=>setRepoblando(false),4000);
  }

  // ── CRUD inventario ──
  function agregarCarta(card){
    const p=getPrimaryPrice(card);
    const esHunting=newForm.destino==="hunting";
    const nueva={
      id:Date.now().toString(),cardId:card.id,name:card.name,
      set:card.set?.name||"",setCode:card.set?.ptcgoCode||card.set?.id||"",
      number:card.number||"",rarity:card.rarity||"",
      image:card.images?.small||"",imageHd:card.images?.large||"",
      tcgMarket:p?.market||null,tcgLow:p?.low||null,tcgHigh:p?.high||null,
      tcgUpdated:hoy,
      priceHistory:p?.market?[{date:hoy,market:p.market,low:p.low||null,high:p.high||null}]:[],
      costoUSD:esHunting?0:(parseFloat(newForm.costoUSD)||0),
      precioVentaUSD:parseFloat(newForm.precioVentaUSD)||(p?.market||0),
      condicion:newForm.condicion||"NM",estado:esHunting?"hunting":"sin_publicar",
      carpeta:newForm.carpeta||cats[0],
      fechaCompra:esHunting?null:(newForm.fechaCompra||hoy),
      cantidad:parseInt(newForm.cantidad)||1,
      fechaVenta:null,precioVendidoUSD:null,
      notas:newForm.notas||"",isDark:isDarkCard(card),
    };
    saveInventario([nueva,...inv]);
    setAddingCard(null);
    setNewForm({costoUSD:"",precioVentaUSD:"",condicion:"NM",notas:"",fechaCompra:hoy,carpeta:cats[0],cantidad:1,destino:"inventario"});
    setView("coleccion");
  }
  function updCarta(id,fields){ saveInventario(inv.map(c=>c.id===id?{...c,...fields}:c)); }
  function deleteCarta(id){ saveInventario(inv.filter(c=>c.id!==id)); setView("coleccion"); }
  function marcarVendida(id,precio,fecha){ updCarta(id,{estado:"vendida",precioVendidoUSD:parseFloat(precio)||0,fechaVenta:fecha||hoy}); }
  function addCarpeta(){ if(!newCarpeta.trim()) return; saveCarpetas([...cats,newCarpeta.trim()]); setNewCarpeta(""); setShowAddCarpeta(false); }

  function deleteSnapshot(carta, snap){
    const newHist=(carta.priceHistory||[]).filter(h=>!(h.date===snap.date&&h.market===snap.market));
    updCarta(carta.id,{priceHistory:newHist,tcgMarket:newHist.length?newHist[newHist.length-1].market:null});
    setSelectedPoint(null);
    setConfirmDelSnap(null);
  }

  // ── Dark Collection: junta el catálogo (cardId/name/número/set) con su
  // carta de inv correspondiente (estado/precio/historial/imagen) — desde
  // esta sesión el catálogo NO guarda precio propio, todo vive en inv para
  // que use el mismo mecanismo confiable de snapshots que cualquier carta. ──
  function mergeDarkWithInv(catalogEntry){
    const invMatch=inv.find(c=>c.cardId===catalogEntry.cardId);
    if(!invMatch) return {...catalogEntry, id:null, estado:"hunting", tcgMarket:null, tcgLow:null, tcgHigh:null, priceHistory:[], notas:"", precioUSD:null};
    return {
      ...catalogEntry,
      id:invMatch.id,
      image:invMatch.image||catalogEntry.image,
      imageHd:invMatch.imageHd||catalogEntry.image,
      tcgMarket:invMatch.tcgMarket??null,
      tcgLow:invMatch.tcgLow??null,
      tcgHigh:invMatch.tcgHigh??null,
      priceHistory:invMatch.priceHistory||[],
      notas:invMatch.notas||"",
      precioUSD:invMatch.costoUSD??null,
      estado:invMatch.estado,
    };
  }

  function toggleDark(cardId){
    const invMatch=inv.find(c=>c.cardId===cardId);
    if(!invMatch) return;
    if(invMatch.estado==="hunting"){
      setDarkPrecioInput(""); setDarkNotaInput(invMatch.notas||""); setDarkPriceModal(cardId);
    } else {
      updCarta(invMatch.id,{estado:"hunting",costoUSD:0,fechaCompra:null});
    }
  }
  function saveDarkModal(){
    if(!darkPriceModal) return;
    const invMatch=inv.find(c=>c.cardId===darkPriceModal);
    if(invMatch){
      updCarta(invMatch.id,{
        estado:"sin_publicar",
        costoUSD:parseFloat(darkPrecioInput)||0,
        notas:darkNotaInput,
        fechaCompra:invMatch.fechaCompra||hoy,
      });
    }
    setDarkPriceModal(null);
  }

  // ── Búsqueda ──
  async function doSearch(){
    const q=query.trim(); if(!q) return;
    setLoading(true); setSearchErr(null); setResults([]);
    try{
      const idFmt=q.match(/^[a-z0-9]+-\d+[a-z]*$/i);
      const setNum=q.match(/^([a-zA-Z0-9]+)\s+(\d+)(?:\/\d+)?$/);
      let apiQ="";
      if(idFmt) apiQ=`id:${q}`;
      else if(setNum) apiQ=`set.ptcgoCode:${setNum[1].toUpperCase()} number:${setNum[2]}`;
      else apiQ=q.includes(" ")?`name:"${q}"`:`name:${q}*`;
      const data=await fetchPoke(`${POKE_BASE}/cards?q=${encodeURIComponent(apiQ)}&select=id,name,number,set,tcgplayer,images,rarity,types,attacks,abilities&orderBy=-set.releaseDate&pageSize=24`);
      const cards=data.data||[];
      setResults(cards);
      if(!cards.length) setSearchErr(`Sin resultados para "${q}"`);
      cards.forEach(c=>{
        fetchTCGPrice(c.name,c.set?.name,c.number,c.set?.ptcgoCode||c.set?.id,apiKey).then(p=>{
          if(!p?.market) return;
          const prev=cache[c.id]||{name:c.name,image:c.images?.small||"",history:[]};
          savePriceCache(prev2=>({...prev2,[c.id]:{...prev,lastMarket:p.market,lastDate:hoy,history:addSnapshot(prev.history,p.market,p.low,p.high)}}));
        });
      });
    }catch(e){ setSearchErr("Error de conexión"); }
    setLoading(false);
  }

  // ── Métricas globales ──
  const activas=inv.filter(c=>c.estado!=="vendida"&&c.estado!=="hunting");
  const huntingCards=inv.filter(c=>c.estado==="hunting");
  const vendidas=inv.filter(c=>c.estado==="vendida");
  const invTotal=activas.reduce((s,c)=>s+(c.costoUSD||0),0);
  const valorEstim=activas.reduce((s,c)=>s+(c.precioVentaUSD||0)*(c.cantidad||1),0);
  const gananciaReal=vendidas.reduce((s,c)=>s+((c.precioVendidoUSD||0)-(c.costoUSD||0)),0);
  const darkConseguidas=darkCat.filter(d=>{
    const invMatch=inv.find(c=>c.cardId===d.cardId);
    return invMatch&&invMatch.estado!=="hunting";
  }).length;

  // ── Filtrado y ordenamiento del pool ──
  const filtradas=(()=>{
    let f=inv.filter(c=>carpetaFiltro==="todas"||c.carpeta===carpetaFiltro);
    if(filterEstado!=="todos") f=f.filter(c=>c.estado===filterEstado);
    f=[...f].sort((a,b)=>{
      let v=0;
      if(sortBy==="nombre") v=a.name.localeCompare(b.name);
      else if(sortBy==="precio") v=(b.precioVentaUSD||0)-(a.precioVentaUSD||0);
      else v=(b.fechaCompra||"").localeCompare(a.fechaCompra||"");
      return sortAsc?-v:v;
    });
    return f;
  })();

  function toggleSort(key){
    if(sortBy===key) setSortAsc(a=>!a);
    else { setSortBy(key); setSortAsc(false); }
  }

  // ── DarkCard, modal de precio y modal de detalle — compartidos entre la
  // vista Dark Collection y la sección "Hunting" de la vista Colección general.
  // Precio de mercado visible en TODO el catálogo — se muestra tanto en
  // hunting como en conseguida, para decidir si conviene salir a buscar la
  // carta según el precio de referencia.
  function DarkCard({d}){
    const cons=getEstadoDark(d)==="conseguida";
    const abrir=guardLongPressClick(()=>setDarkDetailId(d.cardId));
    const press=bindLongPress(d.imageHd||d.image);
    if(darkView==="lista") return(
      <div onClick={abrir} {...press} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}}>
        {d.image&&<img src={d.image} style={{width:36,borderRadius:4,flexShrink:0,filter:cons?"none":"grayscale(1) brightness(0.6)"}}/>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:cons?"#111":"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:cons?600:400}}>{d.name}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>#{d.number}</div>
        </div>
        {d.tcgMarket&&<div style={{fontFamily:"'Caveat',cursive",fontSize:14,fontWeight:700,color:"#5c9cff",flexShrink:0}}>{fmtUSD(d.tcgMarket)}</div>}
        <div style={{width:18,height:18,borderRadius:"50%",border:`1.5px solid ${cons?"#2e7d52":"#ddd"}`,background:cons?"#2e7d52":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {cons&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
        </div>
      </div>
    );
    const isSmall=darkView==="grid_small";
    return(
      <div onClick={abrir} {...press}
        style={{position:"relative",cursor:"pointer",borderRadius:isSmall?6:8,overflow:"hidden",
          border:cons?"2px solid #2e7d52":"2px solid transparent",
          boxShadow:cons?"0 2px 8px rgba(46,125,82,0.3)":"0 1px 3px rgba(0,0,0,0.1)"}}>
        {d.image
          ?<img src={d.image} alt={d.name} style={{width:"100%",display:"block",filter:cons?"none":"grayscale(1) brightness(0.6)"}}/>
          :<div style={{aspectRatio:"2/3",background:"#1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚫</div>
        }
        {cons&&<div style={{position:"absolute",top:2,right:2,background:"#2e7d52",borderRadius:"50%",width:isSmall?12:16,height:isSmall?12:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{color:"#fff",fontSize:isSmall?7:9,fontWeight:700}}>✓</span>
        </div>}
        <div style={{background:"rgba(0,0,0,0.7)",padding:isSmall?"2px 3px":"3px 4px",textAlign:"center"}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:isSmall?8:9,color:"#aac756"}}>{d.number}</div>
          {!isSmall&&d.tcgMarket&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"#5c9cff"}}>{fmtUSD(d.tcgMarket)}</div>}
        </div>
      </div>
    );
  }

  function renderDarkPriceModal(){
    if(!darkPriceModal) return null;
    const carta=darkCat.find(d=>d.cardId===darkPriceModal);
    return(
      <div onClick={()=>setDarkPriceModal(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,420px)",background:"#111",borderRadius:"16px 16px 0 0",padding:"22px 20px 40px"}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16}}>
            {carta?.image&&<img src={carta.image} style={{width:44,borderRadius:6,flexShrink:0}}/>}
            <div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#fff"}}>{carta?.name}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555"}}>#{carta?.number} · {carta?.setName}</div>
            </div>
          </div>
          <input autoFocus type="number" step="0.01" value={darkPrecioInput} onChange={e=>setDarkPrecioInput(e.target.value)} placeholder="lo que pagué USD (0 si fue regalo)"
            style={{width:"100%",background:"#1a1a1a",border:"1px dashed #333",borderRadius:8,padding:"10px 12px",fontSize:18,fontFamily:"'Caveat',cursive",color:"#fff",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
          <input value={darkNotaInput} onChange={e=>setDarkNotaInput(e.target.value)} placeholder="notas (opcional)"
            style={{width:"100%",background:"#1a1a1a",border:"1px dashed #333",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#ccc",outline:"none",boxSizing:"border-box",marginBottom:20}}/>
          <button onClick={saveDarkModal} style={{width:"100%",background:"#2e7d52",border:"none",borderRadius:10,padding:"13px",fontFamily:"'Caveat',cursive",fontSize:18,color:"#fff",cursor:"pointer"}}>✓ marcar conseguida</button>
        </div>
      </div>
    );
  }

  function renderDarkDetailModal(){
    const catalogEntry=darkDetailId?darkCat.find(d=>d.cardId===darkDetailId):null;
    if(!catalogEntry) return null;
    const detalle=mergeDarkWithInv(catalogEntry);
    const hist=detalle.priceHistory||[];
    const cons=getEstadoDark(detalle)==="conseguida";
    const metrics=computeHistMetrics(hist,darkDetailRange);
    const {ath,athDate,atl,atlDate,vol,volLabel}=metrics;
    return(
      <div onClick={()=>{setDarkDetailId(null);setDarkDetailRange("todo");}} style={{position:"fixed",inset:0,zIndex:650,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,460px)",background:"#111",borderRadius:"16px 16px 0 0",padding:"20px 20px 36px",maxHeight:"90vh",overflowY:"auto",boxSizing:"border-box"}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
            {detalle.image&&<img src={detalle.imageHd||detalle.image} alt={detalle.name}
              style={{width:84,borderRadius:8,flexShrink:0,cursor:"pointer",filter:cons?"none":"grayscale(1) brightness(0.65)"}}
              {...bindLongPress(detalle.imageHd||detalle.image)}
              onClick={()=>setZoomImage(detalle.imageHd||detalle.image)}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#fff",lineHeight:1.15}}>{detalle.name}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#777",marginTop:3}}>#{detalle.number} · {detalle.setName}</div>
            </div>
            <button onClick={()=>{setDarkDetailId(null);setDarkDetailRange("todo");}} style={{background:"transparent",border:"none",color:"#555",fontSize:20,cursor:"pointer",padding:0}}>×</button>
          </div>
          {/* Precio de mercado — visible siempre, conseguida o hunting.
              El rango bajo/alto de TCGPlayer (ya lo trae la misma búsqueda,
              antes no se mostraba) sirve de referencia extra al lado del
              market price. */}
          <div style={{background:"#1a1a1a",borderRadius:10,padding:"12px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>precio de mercado</div>
              {detalle.tcgMarket
                ?<div style={{fontFamily:"'Caveat',cursive",fontSize:26,fontWeight:700,color:"#5c9cff"}}>{fmtUSD(detalle.tcgMarket)}</div>
                :<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.3)"}}>sin precio aún</div>
              }
              {(detalle.tcgLow||detalle.tcgHigh)&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>
                rango {detalle.tcgLow?fmtUSD(detalle.tcgLow):"—"} – {detalle.tcgHigh?fmtUSD(detalle.tcgHigh):"—"}
              </div>}
            </div>
            {cons&&detalle.precioUSD&&<div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>pagué</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:"#fff"}}>{fmtUSD(detalle.precioUSD)}</div>
            </div>}
          </div>
          {/* ATH / ATL / Volatilidad — mismo cálculo y nivel de detalle que la
              ficha de inventario, para cualquier carta que junte snapshots
              (Dark Collection o Hunting, da igual el origen). */}
          {hist.length>=2&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[
              {label:"ATH",val:ath,date:athDate,color:"#4caf80"},
              {label:"ATL",val:atl,date:atlDate,color:"#e57373"},
              {label:`σ ${volLabel||""}`,val:vol?`${vol}%`:null,date:null,color:"#999"},
            ].map(({label,val,date,color})=>(
              <div key={label} style={{background:"#1a1a1a",borderRadius:10,padding:"10px"}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:val?color:"rgba(255,255,255,0.2)",lineHeight:1}}>{val?fmtUSD(parseFloat(val)):"—"}</div>
                {date&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:3}}>{fmtDateShort(date)}</div>}
              </div>
            ))}
          </div>}
          {/* Historial de precio — mismo gráfico seleccionable + borrado de
              snapshot que la ficha del inventario, ahora que Dark Collection
              usa exactamente los mismos datos (inv), esto ya funciona acá. */}
          {hist.length>=2&&(
            <div style={{background:"#1a1a1a",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,textTransform:"uppercase"}}>historial</div>
                <div style={{display:"flex",gap:4}}>
                  {["7d","30d","todo"].map(r=>(
                    <button key={r} onClick={()=>{setDarkDetailRange(r);setSelectedPoint(null);}}
                      style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,padding:"2px 7px",borderRadius:8,border:"1px solid",cursor:"pointer",
                        background:darkDetailRange===r?"#fff":"transparent",color:darkDetailRange===r?"#111":"#666",borderColor:darkDetailRange===r?"#fff":"#333"}}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <PriceChart history={hist} range={darkDetailRange}
                onSelectPoint={p=>setSelectedPoint(selectedPoint?.date===p.date&&selectedPoint?.market===p.market?null:p)}
                selectedPoint={selectedPoint}/>
              {selectedPoint&&(
                <div style={{marginTop:10,background:"#1a1a1a",border:"1px dashed #333",borderRadius:8,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#fff"}}>{fmtUSD(selectedPoint.market)}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.4)"}}>{selectedPoint.date}</div>
                  </div>
                  {confirmDelSnap?.date===selectedPoint.date&&confirmDelSnap?.market===selectedPoint.market
                    ?<div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#ff8080"}}>¿borrar?</span>
                      <button onClick={()=>deleteSnapshot(detalle,selectedPoint)}
                        style={{background:"#e53935",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#fff"}}>sí</button>
                      <button onClick={()=>setConfirmDelSnap(null)}
                        style={{background:"transparent",border:"1px dashed #444",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#999"}}>no</button>
                    </div>
                    :<button onClick={()=>setConfirmDelSnap(selectedPoint)} disabled={!detalle.id}
                      style={{background:"transparent",border:"1px dashed #5a2020",borderRadius:8,padding:"5px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#e08080",cursor:detalle.id?"pointer":"default",opacity:detalle.id?1:0.4}}>
                      × borrar snapshot
                    </button>
                  }
                </div>
              )}
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:6,textAlign:"center"}}>{hist.length} snapshots — tocá un punto para seleccionarlo</div>
            </div>
          )}
          {detalle.notas&&<div style={{fontFamily:"'Caveat',cursive",fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:12,fontStyle:"italic"}}>"{detalle.notas}"</div>}
          {/* Toggle explícito de estado — reemplaza el tap directo */}
          <button onClick={()=>toggleDark(detalle.cardId)}
            style={{width:"100%",background:cons?"transparent":"#2e7d52",border:cons?"1px dashed #555":"none",borderRadius:10,padding:"12px",fontFamily:"'Caveat',cursive",fontSize:17,color:cons?"#aaa":"#fff",cursor:"pointer"}}>
            {cons?"↺ volver a hunting":"✓ marcar conseguida"}
          </button>
        </div>
      </div>
    );
  }

  // ── VISTA FICHA ──────────────────────────────────────────────────────────────
  if(view==="ficha"){
    const carta=inv.find(c=>c.id===fichaId);
    if(!carta){setView("coleccion");return null;}
    const est=ESTADOS[carta.estado]||ESTADOS.sin_publicar;
    const hist=carta.priceHistory||[];
    const metrics=computeHistMetrics(hist,chartRange);
    const {ath,athDate,atl,atlDate,vol,volLabel,filtered}=metrics;
    const dias=carta.fechaCompra?Math.round((new Date(hoy+"T12:00:00")-new Date(carta.fechaCompra+"T12:00:00"))/86400000):null;
    const colorVenta=carta.tcgMarket&&carta.precioVentaUSD?(carta.precioVentaUSD>carta.tcgMarket?"#2e7d52":"#e53935"):null;

    return(
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto",overflowX:"hidden",boxSizing:"border-box"}}>
        {zoomImage&&(
          <div onClick={()=>setZoomImage(null)} style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src={zoomImage} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}/>
          </div>
        )}
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={()=>setView("coleccion")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{carta.name}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",marginTop:2}}>{carta.set} · #{carta.number} · {carta.condicion} · {carta.carpeta}{(carta.cantidad||1)>1?` · ×${carta.cantidad}`:""}</div>
          </div>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,background:est.bg,color:est.color,borderRadius:20,padding:"3px 10px",fontWeight:600,flexShrink:0}}>{est.label}</span>
        </div>

        {/* Imagen grande — mantené presionado para verla fullscreen (cambio 9) */}
        {carta.image&&<div style={{textAlign:"center",marginBottom:14}}>
          <img src={carta.imageHd||carta.image} alt={carta.name} style={{maxWidth:200,borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",cursor:"pointer"}}
            {...bindLongPress(carta.imageHd||carta.image)}/>
        </div>}

        {/* Precio de venta destacado */}
        <div style={{background:"#111",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>precio de venta</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:34,fontWeight:700,color:colorVenta||"#fff",lineHeight:1}}>{fmtUSD(carta.precioVentaUSD)}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{fmtPokeCLP(carta.precioVentaUSD)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>TCGPlayer market</div>
              {carta.tcgMarket
                ?<div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{fmtUSD(carta.tcgMarket)}</div>
                :<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.3)"}}>sin precio</div>
              }
              {!carta.tcgMarket && (
                <button onClick={async()=>{
                  setDiagLoading(true); setDiagResult(null);
                  const d = await fetchTCGPriceDiag(carta.name, carta.set, carta.number, carta.setCode, apiKey);
                  setDiagLoading(false); setDiagResult(d);
                }} style={{marginTop:4,fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,border:"1px solid rgba(255,255,255,0.25)",borderRadius:10,padding:"3px 8px",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>
                  {diagLoading?"buscando…":"🔍 diagnosticar"}
                </button>
              )}
              {(carta.tcgLow||carta.tcgHigh)&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>
                rango {carta.tcgLow?fmtUSD(carta.tcgLow):"—"} – {carta.tcgHigh?fmtUSD(carta.tcgHigh):"—"}
              </div>}
            </div>
          </div>
        </div>

        {diagResult && (
          <div style={{background:"#fafafa",border:"1px dashed #ccc",borderRadius:10,padding:"10px 12px",marginBottom:12,fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#444",lineHeight:1.6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontWeight:700}}>diagnóstico tcgpricelookup.com</span>
              <button onClick={()=>setDiagResult(null)} style={{background:"transparent",border:"none",color:"#999",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
            {diagResult.error
              ? <div>error: {diagResult.error}{diagResult.query?` (query: "${diagResult.query}")`:""}</div>
              : <>
                  <div>query: "{diagResult.query}"</div>
                  {diagResult.matchEncontrado ? (
                    <>
                      <div>✓ match: "{diagResult.matchNombre}" #{diagResult.matchNumero}</div>
                      <div>precios disponibles en la carta: {diagResult.preciosDisponibles?.length?diagResult.preciosDisponibles.join(", "):"ninguno"}</div>
                      <div>{diagResult.tienePrecioTcgplayer?"✓":"✗"} tiene precio tcgplayer en raw/near_mint o lightly_played</div>
                    </>
                  ) : (
                    <>
                      <div>✗ ningún candidato matcheó por nombre+número</div>
                      {diagResult.candidatos?.length ? (
                        <div style={{marginTop:4}}>
                          <div style={{color:"#888"}}>candidatos que trajo la búsqueda:</div>
                          {diagResult.candidatos.map((c,i)=>(
                            <div key={i} style={{marginLeft:8}}>· {c.name} #{c.number} ({c.setId||c.setCode||"sin set"}){c.tieneRaw?"":" — sin precio raw"}</div>
                          ))}
                        </div>
                      ) : <div style={{color:"#888"}}>la búsqueda no devolvió ningún candidato</div>}
                    </>
                  )}
                </>
            }
          </div>
        )}

        {/* ATH / ATL / Volatilidad */}
        {hist.length>=2&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[
            {label:"ATH",val:ath,date:athDate,color:"#2e7d52"},
            {label:"ATL",val:atl,date:atlDate,color:"#e53935"},
            {label:`σ ${volLabel||""}`,val:vol?`${vol}%`:null,date:null,color:"#888"},
          ].map(({label,val,date,color})=>(
            <div key={label} style={{background:"#fafafa",border:"1px solid #eee",borderRadius:10,padding:"10px"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color:val?color:"#ddd",lineHeight:1}}>{val?fmtUSD(parseFloat(val)):"—"}</div>
              {date&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",marginTop:3}}>{fmtDateShort(date)}</div>}
            </div>
          ))}
        </div>}

        {/* Gráfico con selector de rango y borrar snapshot */}
        {hist.length>=2&&(
          <div style={{background:"#fafafa",border:"1px solid #eee",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:2,textTransform:"uppercase"}}>historial TCGPlayer</div>
              <div style={{display:"flex",gap:4}}>
                {["7d","30d","todo"].map(r=>(
                  <button key={r} onClick={()=>{setChartRange(r);setSelectedPoint(null);}}
                    style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,padding:"3px 8px",borderRadius:8,border:"1px solid",cursor:"pointer",
                      background:chartRange===r?"#111":"transparent",color:chartRange===r?"#fff":"#bbb",borderColor:chartRange===r?"#111":"#ddd"}}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart history={hist} precioVenta={carta.precioVentaUSD} range={chartRange}
              onSelectPoint={p=>setSelectedPoint(selectedPoint?.date===p.date&&selectedPoint?.market===p.market?null:p)}
              selectedPoint={selectedPoint}/>
            {/* Panel de snapshot seleccionado */}
            {selectedPoint&&(
              <div style={{marginTop:10,background:"#fff",border:"1px dashed #ddd",borderRadius:8,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#111"}}>{fmtUSD(selectedPoint.market)}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa"}}>{selectedPoint.date}</div>
                </div>
                {confirmDelSnap?.date===selectedPoint.date&&confirmDelSnap?.market===selectedPoint.market
                  ?<div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#e53935"}}>¿borrar?</span>
                    <button onClick={()=>deleteSnapshot(carta,selectedPoint)}
                      style={{background:"#e53935",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#fff"}}>sí</button>
                    <button onClick={()=>setConfirmDelSnap(null)}
                      style={{background:"transparent",border:"1px dashed #ddd",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#999"}}>no</button>
                  </div>
                  :<button onClick={()=>setConfirmDelSnap(selectedPoint)}
                    style={{background:"transparent",border:"1px dashed #f5c0c0",borderRadius:8,padding:"5px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#e08080",cursor:"pointer"}}>
                    × borrar snapshot
                  </button>
                }
              </div>
            )}
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#ccc",marginTop:6,textAlign:"center"}}>{hist.length} snapshots — tocá un punto para seleccionarlo</div>
          </div>
        )}

        {/* KPIs secundarios */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[
            {label:"costo",   val:carta.estado==="hunting"?"sin comprar":carta.costoUSD?fmtUSD(carta.costoUSD):"regalo"},
            {label:"días",    val:dias!=null?`${dias}d`:"—"},
            {label:"estado",  val:est.label,color:est.color},
          ].map(({label,val,color})=>(
            <div key={label} style={{background:"#fafafa",border:"1px solid #eee",borderRadius:10,padding:"10px"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:color||"#111",lineHeight:1}}>{val}</div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        {carta.estado==="hunting"&&<div style={{marginBottom:10}}>
          <button onClick={()=>updCarta(carta.id,{estado:"sin_publicar",fechaCompra:carta.fechaCompra||hoy})}
            style={{width:"100%",background:"#7c4dff",border:"none",borderRadius:10,padding:"12px",fontFamily:"'Caveat',cursive",fontSize:16,color:"#fff",cursor:"pointer"}}>
            ✓ ya la conseguí — pasar a inventario
          </button>
        </div>}
        {carta.estado!=="vendida"&&carta.estado!=="hunting"&&<div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>updCarta(carta.id,{estado:carta.estado==="sin_publicar"?"a_la_venta":"sin_publicar"})}
            style={{flex:1,background:"#111",border:"none",borderRadius:10,padding:"11px",fontFamily:"'Caveat',cursive",fontSize:15,color:"#fff",cursor:"pointer"}}>
            {carta.estado==="sin_publicar"?"🏷️ poner a la venta":"📦 quitar de venta"}
          </button>
          <button onClick={()=>setVendModal(true)}
            style={{flex:1,background:"#2e7d52",border:"none",borderRadius:10,padding:"11px",fontFamily:"'Caveat',cursive",fontSize:15,color:"#fff",cursor:"pointer"}}>
            ✓ registrar venta
          </button>
        </div>}

        {/* Edición / Reset historial */}
        {editMode?(
          <div style={{background:"#fafafa",border:"1px dashed #ddd",borderRadius:12,padding:"14px",marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              {[{k:"costoUSD",l:"Costo USD"},{k:"precioVentaUSD",l:"Precio venta USD"}].map(({k,l})=>(
                <div key={k}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>{l}</div>
                  <input type="number" step="0.01" value={editFields[k]||""} onChange={e=>setEditFields(f=>({...f,[k]:e.target.value}))}
                    style={{width:"100%",border:"1px dashed #ccc",borderRadius:6,padding:"6px 8px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box",color:"#111"}}/>
                </div>
              ))}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>Cantidad</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>setEditFields(f=>({...f,cantidad:Math.max(1,(f.cantidad||1)-1)}))} style={{width:28,height:28,borderRadius:6,border:"1px dashed #ddd",background:"transparent",fontSize:16,cursor:"pointer",color:"#555"}}>−</button>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111",minWidth:28,textAlign:"center"}}>{editFields.cantidad||1}</span>
                <button onClick={()=>setEditFields(f=>({...f,cantidad:(f.cantidad||1)+1}))} style={{width:28,height:28,borderRadius:6,border:"1px dashed #ddd",background:"transparent",fontSize:16,cursor:"pointer",color:"#555"}}>+</button>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>Carpeta</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {cats.map(c=><button key={c} onClick={()=>setEditFields(f=>({...f,carpeta:c}))}
                  style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"4px 10px",borderRadius:8,border:"1px dashed #ddd",background:editFields.carpeta===c?"#111":"transparent",color:editFields.carpeta===c?"#fff":"#555",cursor:"pointer"}}>{c}</button>)}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>Condición</div>
              <div style={{display:"flex",gap:4}}>
                {CONDICIONES.map(c=><button key={c} onClick={()=>setEditFields(f=>({...f,condicion:c}))}
                  style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"5px 4px",borderRadius:6,border:"1px dashed #ddd",background:editFields.condicion===c?"#111":"transparent",color:editFields.condicion===c?"#fff":"#555",cursor:"pointer"}}>{c}</button>)}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Notas</div>
              <textarea value={editFields.notas||""} onChange={e=>setEditFields(f=>({...f,notas:e.target.value}))} rows={2}
                style={{width:"100%",border:"1px dashed #ccc",borderRadius:8,padding:"8px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",resize:"none",boxSizing:"border-box",color:"#111"}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{updCarta(carta.id,{costoUSD:parseFloat(editFields.costoUSD)||0,precioVentaUSD:parseFloat(editFields.precioVentaUSD)||0,condicion:editFields.condicion,notas:editFields.notas||"",carpeta:editFields.carpeta,cantidad:editFields.cantidad||1});setEditMode(false);}}
                style={{flex:1,background:"#111",border:"none",borderRadius:8,padding:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",cursor:"pointer",fontWeight:600}}>guardar</button>
              <button onClick={()=>setEditMode(false)}
                style={{background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"9px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#999",cursor:"pointer"}}>cancelar</button>
            </div>
          </div>
        ):(
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <button onClick={()=>setEditMode(true)}
              style={{flex:1,background:"transparent",border:"1px dashed #ddd",borderRadius:10,padding:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#777",cursor:"pointer"}}>✎ editar</button>
            {hist.length>0&&<button onClick={()=>{if(window.confirm(`¿Resetear historial de ${carta.name}? Se borran ${hist.length} snapshots.`))updCarta(carta.id,{priceHistory:[],tcgMarket:null,tcgLow:null,tcgHigh:null,tcgUpdated:null});}}
              style={{background:"transparent",border:"1px dashed #f5c0c0",borderRadius:10,padding:"9px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#e08080",cursor:"pointer",flexShrink:0}}>↺ historial</button>}
          </div>
        )}
        <button onClick={()=>{if(window.confirm(`¿Eliminar ${carta.name}?`))deleteCarta(carta.id);}}
          style={{width:"100%",background:"transparent",border:"1px dashed #eee",borderRadius:10,padding:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#ccc",cursor:"pointer"}}>eliminar carta</button>

        {/* Modal venta */}
        {vendModal&&(
          <div onClick={()=>setVendModal(false)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,420px)",background:"#fff",borderRadius:"16px 16px 0 0",padding:"24px 20px 40px"}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111",marginBottom:16}}>✓ registrar venta</div>
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,marginBottom:6}}>PRECIO USD</div>
                <input autoFocus type="number" step="0.01" value={vendPrecio} onChange={e=>setVendPrecio(e.target.value)}
                  style={{width:"100%",border:"1.5px solid #111",borderRadius:8,padding:"10px 12px",fontSize:18,fontFamily:"'Caveat',cursive",outline:"none",boxSizing:"border-box",color:"#111"}}/>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,marginBottom:6}}>FECHA</div>
                <input type="date" value={vendFecha} onChange={e=>setVendFecha(e.target.value)}
                  style={{border:"1px dashed #ddd",borderRadius:8,padding:"8px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",color:"#111"}}/>
              </div>
              <button onClick={()=>{marcarVendida(carta.id,vendPrecio,vendFecha);setVendModal(false);setView("coleccion");}}
                style={{width:"100%",background:"#2e7d52",border:"none",borderRadius:10,padding:"13px",fontFamily:"'Caveat',cursive",fontSize:18,color:"#fff",cursor:"pointer"}}>confirmar venta</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VISTA BUSCAR ─────────────────────────────────────────────────────────────
  if(view==="buscar"){
    return(
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto",overflowX:"hidden",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>{setView("coleccion");setResults([]);setQuery("");}} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111"}}>agregar carta</span>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()}
            autoFocus placeholder="nombre · sv3-125 · OBF 125"
            style={{flex:1,border:"none",borderBottom:"2px solid #111",padding:"8px 4px",fontSize:18,fontFamily:"'Caveat',cursive",outline:"none",background:"transparent",color:"#111"}}/>
          <button onClick={doSearch} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Caveat',cursive",fontSize:15,cursor:"pointer"}}>buscar</button>
        </div>
        {/* Zoom de imagen */}
        {zoomImage&&(
          <div onClick={()=>setZoomImage(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src={zoomImage} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}/>
          </div>
        )}
        <PokeLoader active={loading}/>
        {!loading&&searchErr&&<div style={{textAlign:"center",padding:16,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#c00"}}>{searchErr}</div>}
        {results.map(card=>{
          const p=getPrimaryPrice(card);
          const cacheEntry=cache[card.id];
          const tcgPrice=cacheEntry?.lastMarket||p?.market||null;
          const yaInv=inv.some(c=>c.cardId===card.id);
          const dark=isDarkCard(card);
          return(
            <div key={card.id} style={{padding:"12px 0",borderBottom:"1px solid #f0f0f0"}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{position:"relative",flexShrink:0,cursor:"pointer"}} onClick={()=>setZoomImage(card.images?.large||card.images?.small||null)}>
                  {card.images?.small&&<img src={card.images.small} alt={card.name} style={{width:52,borderRadius:6,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}/>}
                  {dark&&<span style={{position:"absolute",top:-4,right:-4,fontSize:11}}>⚫</span>}
                  <div style={{position:"absolute",bottom:2,right:2,background:"rgba(0,0,0,0.5)",borderRadius:3,padding:"1px 3px",fontSize:8,color:"#fff"}}>🔍</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,lineHeight:1.2,color:"#111"}}>{card.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",marginTop:1}}>{card.set?.name} · #{card.number}{card.rarity?` · ${card.rarity}`:""}</div>
                  {tcgPrice&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,color:"#2e7d52",marginTop:4}}>{fmtUSD(tcgPrice)} <span style={{fontWeight:400,color:"#bbb",fontSize:10}}>TCGPlayer</span></div>}
                </div>
                {yaInv
                  ?<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",padding:"6px",alignSelf:"center"}}>ya en tu pool</span>
                  :<button onClick={()=>{setAddingCard(card);setNewForm(f=>({...f,precioVentaUSD:tcgPrice?tcgPrice.toFixed(2):"",carpeta:isDarkCard(card)?"Dark Collection":(cats[0]||"MLP")}));}}
                    style={{background:"#111",border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:14,color:"#fff",flexShrink:0,alignSelf:"center"}}>+ agregar</button>
                }
              </div>
            </div>
          );
        })}
        {/* Modal agregar */}
        {addingCard&&(
          <div onClick={()=>setAddingCard(null)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,420px)",background:"#fff",borderRadius:"16px 16px 0 0",padding:"22px 20px 40px",maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:16}}>
                {addingCard.images?.small&&<img src={addingCard.images.small} style={{width:52,borderRadius:6,flexShrink:0,cursor:"pointer"}} onClick={()=>setZoomImage(addingCard.images?.large||addingCard.images?.small)}/>}
                <div>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111",lineHeight:1.1}}>{addingCard.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",marginTop:2}}>{addingCard.set?.name} · #{addingCard.number}</div>
                </div>
              </div>
              {/* Destino: en posesión (inventario normal) o hunting (quiero
                  trackear precio, todavía no la tengo) — cualquier carta,
                  sea o no Darkness. */}
              <div style={{display:"flex",gap:0,marginBottom:16,border:"1.5px solid #111",borderRadius:10,overflow:"hidden"}}>
                {[["inventario","📦 en posesión"],["hunting","🗡️ hunting"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setNewForm(f=>({...f,destino:k}))}
                    style={{flex:1,padding:"8px 0",background:newForm.destino===k?"#111":"transparent",color:newForm.destino===k?"#fff":"#999",
                      border:"none",cursor:"pointer",fontFamily:"'Caveat',cursive",fontSize:14,fontWeight:700}}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>Carpeta</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {cats.map(c=><button key={c} onClick={()=>setNewForm(f=>({...f,carpeta:c}))}
                    style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"5px 12px",borderRadius:8,border:"1px dashed #ddd",background:newForm.carpeta===c?"#111":"transparent",color:newForm.carpeta===c?"#fff":"#555",cursor:"pointer"}}>{c}</button>)}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:newForm.destino==="hunting"?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
                {newForm.destino!=="hunting"&&(
                  <div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Lo que pagué USD (0 si fue regalo)</div>
                    <input type="number" step="0.01" value={newForm.costoUSD} onChange={e=>setNewForm(f=>({...f,costoUSD:e.target.value}))} placeholder="ej: 8.50"
                      style={{width:"100%",border:"1px dashed #ccc",borderRadius:8,padding:"8px 10px",fontSize:16,fontFamily:"'Caveat',cursive",outline:"none",boxSizing:"border-box",color:"#111"}}/>
                  </div>
                )}
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>{newForm.destino==="hunting"?"Precio de referencia USD (opcional)":"Precio venta USD"}</div>
                  <input type="number" step="0.01" value={newForm.precioVentaUSD} onChange={e=>setNewForm(f=>({...f,precioVentaUSD:e.target.value}))} placeholder="ej: 15.00"
                    style={{width:"100%",border:"1px dashed #ccc",borderRadius:8,padding:"8px 10px",fontSize:16,fontFamily:"'Caveat',cursive",outline:"none",boxSizing:"border-box",color:"#111"}}/>
                </div>
              </div>
              {newForm.destino!=="hunting"&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>Cantidad</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>setNewForm(f=>({...f,cantidad:Math.max(1,(f.cantidad||1)-1)}))} style={{width:32,height:32,borderRadius:8,border:"1px dashed #ddd",background:"transparent",fontSize:18,cursor:"pointer",color:"#555"}}>−</button>
                    <span style={{fontFamily:"'Caveat',cursive",fontSize:26,fontWeight:700,color:"#111",minWidth:32,textAlign:"center"}}>{newForm.cantidad||1}</span>
                    <button onClick={()=>setNewForm(f=>({...f,cantidad:(f.cantidad||1)+1}))} style={{width:32,height:32,borderRadius:8,border:"1px dashed #ddd",background:"transparent",fontSize:18,cursor:"pointer",color:"#555"}}>+</button>
                  </div>
                </div>
              )}
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>Condición</div>
                <div style={{display:"flex",gap:6}}>
                  {CONDICIONES.map(c=><button key={c} onClick={()=>setNewForm(f=>({...f,condicion:c}))}
                    style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:11,padding:"6px 4px",borderRadius:8,border:"1px dashed #ddd",background:newForm.condicion===c?"#111":"transparent",color:newForm.condicion===c?"#fff":"#555",cursor:"pointer"}}>{c}</button>)}
                </div>
              </div>
              {newForm.destino!=="hunting"&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:4}}>Fecha de compra</div>
                  <input type="date" value={newForm.fechaCompra} onChange={e=>setNewForm(f=>({...f,fechaCompra:e.target.value}))}
                    style={{border:"1px dashed #ddd",borderRadius:8,padding:"7px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",color:"#111"}}/>
                </div>
              )}
              <button onClick={()=>agregarCarta(addingCard)} disabled={newForm.destino!=="hunting"&&!newForm.precioVentaUSD}
                style={{width:"100%",background:(newForm.destino==="hunting"||newForm.precioVentaUSD)?"#111":"#eee",border:"none",borderRadius:10,padding:"13px",fontFamily:"'Caveat',cursive",fontSize:18,color:(newForm.destino==="hunting"||newForm.precioVentaUSD)?"#fff":"#bbb",cursor:"pointer"}}>
                {newForm.destino==="hunting"?"🗡️ agregar a hunting":"agregar al inventario"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VISTA CARPETA (MLP / Staples / Dark desde icono) ─────────────────────────
  if(carpetaView){
    const esDark=carpetaView==="Dark Collection";
    if(esDark){ setTimeout(()=>{setCarpetaView(null);setView("dark");},0); return null; }
    const cartasCarpeta=inv.filter(c=>c.carpeta===carpetaView);
    const cvView=darkView; const setCvView=setDarkView;
    const gridCols=cvView==="grid_small"?"repeat(auto-fill,minmax(72px,1fr))":cvView==="grid_med"?"repeat(auto-fill,minmax(100px,1fr))":null;
    return(
      <div style={{background:"#0a0a0a",minHeight:"100vh",padding:"16px",maxWidth:480,margin:"0 auto",overflowX:"hidden",boxSizing:"border-box"}}>
        {zoomImage&&(
          <div onClick={()=>setZoomImage(null)} style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src={zoomImage} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}/>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>setCarpetaView(null)} style={{background:"transparent",border:"none",fontSize:20,color:"#444",cursor:"pointer",padding:0}}>←</button>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#fff"}}>{CARPETAS_ICONS[carpetaView]||"📁"} {carpetaView}</div>
          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            {[["grid_small","⠿"],["grid_med","▦"],["lista","≡"]].map(([v,l])=>(
              <button key={v} onClick={()=>setCvView(v)}
                style={{flex:1,padding:"6px 8px",background:cvView===v?"#fff":"transparent",color:cvView===v?"#111":"#555",
                  border:"1px solid",borderColor:cvView===v?"#fff":"#333",borderRadius:8,cursor:"pointer",fontSize:13}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {[["sin_publicar","sin publicar"],["a_la_venta","a la venta"],["vendida","vendida"]].map(([k,l])=>{
            const n=cartasCarpeta.filter(c=>c.estado===k).length;
            if(!n) return null;
            return <span key={k} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:ESTADOS[k].color,background:ESTADOS[k].bg,borderRadius:20,padding:"3px 10px"}}>{l} {n}</span>;
          })}
        </div>
        {cvView==="lista"
          ?<div>{cartasCarpeta.map(c=>{
            const up=c.tcgMarket&&c.precioVentaUSD;
            const color=up?(c.precioVentaUSD>c.tcgMarket?"#2e7d52":"#e53935"):"#fff";
            return(
              <div key={c.id} onClick={guardLongPressClick(()=>{setFichaId(c.id);setCarpetaView(null);setView("ficha");})}
                style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",alignItems:"center"}}>
                {c.image&&<img src={c.image} style={{width:40,borderRadius:5,flexShrink:0}} {...bindLongPress(c.imageHd||c.image)}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)"}}>{c.condicion}{(c.cantidad||1)>1?` · ×${c.cantidad}`:""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,color}}>{fmtUSD(c.precioVentaUSD)}</div>
                  {c.tcgMarket&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>{fmtUSD(c.tcgMarket)}</div>}
                </div>
              </div>
            );
          })}</div>
          :<div style={{display:"grid",gridTemplateColumns:gridCols,gap:cvView==="grid_small"?3:5}}>
            {cartasCarpeta.map(c=>{
              const up=c.tcgMarket&&c.precioVentaUSD;
              const color=up?(c.precioVentaUSD>c.tcgMarket?"#2e7d52":"#e53935"):"rgba(255,255,255,0.7)";
              const isSmall=cvView==="grid_small";
              return(
                <div key={c.id} onClick={guardLongPressClick(()=>{setFichaId(c.id);setCarpetaView(null);setView("ficha");})}
                  style={{cursor:"pointer",borderRadius:isSmall?6:8,overflow:"hidden",border:"2px solid transparent",position:"relative"}}
                  {...bindLongPress(c.imageHd||c.image)}>
                  {c.image
                    ?<img src={c.image} alt={c.name} style={{width:"100%",display:"block"}}/>
                    :<div style={{aspectRatio:"2/3",background:"#1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🃏</div>
                  }
                  {(c.cantidad||1)>1&&<div style={{position:"absolute",top:2,left:2,background:"rgba(0,0,0,0.75)",borderRadius:4,padding:"1px 5px",fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#fff"}}>×{c.cantidad}</div>}
                  <div style={{background:"rgba(0,0,0,0.75)",padding:isSmall?"2px 3px":"4px 5px"}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:isSmall?13:15,fontWeight:700,color,textAlign:"center"}}>{fmtUSD(c.precioVentaUSD)}</div>
                    {!isSmall&&c.tcgMarket&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>{fmtUSD(c.tcgMarket)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        }
        <div style={{height:32}}/>
      </div>
    );
  }

  // ── VISTA DARK COLLECTION ─────────────────────────────────────────────────────
  // Muestra las cartas que cumplen el criterio real de Darkness (catálogo
  // auto-poblado desde los sets) — conseguidas en color, las que faltan en
  // blanco y negro, para trackear avance por set. El precio/estado de cada
  // una vive en su carta de inv correspondiente (mergeDarkWithInv la trae).
  if(view==="dark"){
    const darkCatMerged = darkCat.map(mergeDarkWithInv);
    const conseguidas=darkCatMerged.filter(d=>getEstadoDark(d)==="conseguida").length;
    const total=darkCatMerged.length;
    const porSet={};
    darkCatMerged.forEach(d=>{
      const k=d.setId||d.setName||"Sin set";
      if(!porSet[k]) porSet[k]={setName:d.setName||k,setId:d.setId||k,releaseDate:d.releaseDate||"",cards:[]};
      porSet[k].cards.push(d);
    });
    const setGroups=Object.values(porSet).sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate));
    const gridCols=darkView==="grid_small"?"repeat(auto-fill,minmax(58px,1fr))":darkView==="grid_med"?"repeat(auto-fill,minmax(88px,1fr))":null;

    return(
      <div style={{background:"#0a0a0a",minHeight:"100vh",padding:"16px",maxWidth:480,margin:"0 auto",overflowX:"hidden",boxSizing:"border-box"}}>
        {zoomImage&&(
          <div onClick={()=>setZoomImage(null)} style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src={zoomImage} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}/>
          </div>
        )}
        {renderDarkPriceModal()}
        {renderDarkDetailModal()}

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={()=>setView("coleccion")} style={{background:"transparent",border:"none",fontSize:20,color:"#444",cursor:"pointer",padding:0}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#fff"}}>⚫ Dark Collection</div>
          </div>
          {total>0&&<div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#aac756"}}>{conseguidas}/{total}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#444"}}>{Math.round(conseguidas/total*100)}%</div>
          </div>}
        </div>
        {total>0&&<div style={{height:3,background:"#1a1a1a",borderRadius:99,overflow:"hidden",marginBottom:12}}>
          <div style={{height:"100%",width:`${total>0?conseguidas/total*100:0}%`,background:"#2e7d52",borderRadius:99}}/>
        </div>}
        <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
          {[["grid_small","⠿"],["grid_med","▦"],["lista","≡"]].map(([v,l])=>(
            <button key={v} onClick={()=>setDarkView(v)}
              style={{padding:"6px 10px",background:darkView===v?"#fff":"transparent",color:darkView===v?"#111":"#555",
                border:"1px solid",borderColor:darkView===v?"#fff":"#333",borderRadius:8,cursor:"pointer",fontSize:13}}>
              {l}
            </button>
          ))}
          <button onClick={()=>{if(window.confirm("¿Repoblar catálogo Dark? Se conserva tu progreso (conseguidas, precios, notas)."))repoblarDark();}}
            style={{marginLeft:"auto",background:"transparent",border:"1px dashed #333",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#444"}}>
            {repoblando?"repoblando...":"🔄 repoblar"}
          </button>
        </div>
        {resyncStatus==="running"&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#444",marginBottom:8}}>resincronizando sets trackeados en segundo plano…</div>}


        {darkSetsLoading&&<PokeLoader active/>}
        {!darkSetsLoading&&total===0&&<div style={{textAlign:"center",padding:"32px 0"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#333",marginBottom:6}}>cargando cartas dark...</div>
        </div>}
        {!darkSetsLoading&&total>0&&setGroups.length===0&&<div style={{textAlign:"center",padding:"32px 0"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"#333"}}>cargando catálogo dark...</div>
        </div>}
        {setGroups.map(({setName,setId,cards})=>{
          const cons=cards.filter(c=>getEstadoDark(c)==="conseguida").length;
          // Diagnóstico holo/estándar (cambio 7): si hay más objetos de carta
          // que números de colección únicos, pokemontcg.io está modelando el
          // holo como una entrada separada — ya está cubierta por el fetch
          // normal del set, esto es solo informativo para confirmarlo.
          const numerosUnicos=new Set(cards.map(c=>c.number)).size;
          const hayVariantes=cards.length>numerosUnicos;
          return(
            <div key={setId} style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:6}}>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:17,fontWeight:700,color:"#fff",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{setName}</div>
                {hayVariantes&&<span title={`${cards.length} cartas · ${numerosUnicos} números únicos — hay variantes holo/estándar como entradas separadas`}
                  style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"#5c9cff",background:"rgba(92,156,255,0.12)",borderRadius:6,padding:"1px 5px",flexShrink:0}}>2 var.</span>}
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:cons===cards.length&&cards.length>0?"#2e7d52":"#555",flexShrink:0}}>{cons}/{cards.length}</div>
              </div>
              <div style={{height:2,background:"#1a1a1a",borderRadius:99,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:`${cards.length>0?cons/cards.length*100:0}%`,background:"#2e7d52",borderRadius:99}}/>
              </div>
              {darkView==="lista"
                ?<div>{cards.map(d=><DarkCard key={d.cardId} d={d}/>)}</div>
                :<div style={{display:"grid",gridTemplateColumns:gridCols,gap:darkView==="grid_small"?3:5}}>
                  {cards.map(d=><DarkCard key={d.cardId} d={d}/>)}
                </div>
              }
            </div>
          );
        })}
        <div style={{height:40}}/>
      </div>
    );
  }

  // ── VISTA COLECCIÓN (principal) ───────────────────────────────────────────────
  const mesActual=new Date().toISOString().slice(0,7);
  const vendMes=vendidas.filter(c=>(c.fechaVenta||"").startsWith(mesActual));
  const ganMes=vendMes.reduce((s,c)=>s+((c.precioVendidoUSD||0)-(c.costoUSD||0)),0);

  return(
    <div style={{padding:"16px",maxWidth:480,margin:"0 auto",overflowX:"hidden",boxSizing:"border-box"}}>
      {!apiKey&&(
        <div style={{background:"#1a1a1a",border:"1px solid #333",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#bbb",marginBottom:8}}>
            Sin API key de tcgpricelookup.com — los precios en vivo no van a actualizar (lo guardado sigue disponible). Se pide una sola vez, queda en este dispositivo.
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)} placeholder="API key"
              style={{flex:1,background:"#000",border:"1px solid #333",borderRadius:8,padding:"8px 10px",color:"#fff",fontFamily:"'DM Sans',sans-serif",fontSize:13}}/>
            <button onClick={()=>{ if(apiKeyInput.trim()){ saveApiKey(apiKeyInput.trim()); setApiKeyInput(""); } }}
              style={{background:"#aac756",border:"none",borderRadius:8,padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,color:"#111"}}>
              Guardar
            </button>
          </div>
        </div>
      )}
      {zoomImage&&(
        <div onClick={()=>setZoomImage(null)} style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src={zoomImage} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}/>
        </div>
      )}
      {/* Header métricas */}
      <div style={{background:"#111",borderRadius:12,padding:"14px 16px",marginBottom:12,cursor:"pointer"}} onClick={()=>{}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          {[
            {label:"inventario",  val:fmtUSD(valorEstim),    sub:`${activas.length} cartas`},
            {label:"ganancia mes",val:fmtUSD(ganMes),        sub:`${vendMes.length} vendidas`,color:ganMes>=0?"#aac756":"#e53935"},
          ].map(({label,val,sub,color},i)=>(
            <div key={label} style={{textAlign:i===0?"left":"right"}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:24,fontWeight:700,color:color||"#fff",lineHeight:1}}>{val}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginTop:3}}>{label}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:2}}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduler clickeable */}
      {(schedStatus==="running"||schedStatus==="done")&&(
        <div>
          <div onClick={()=>setShowSchedLog(v=>!v)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"#f9f9f9",border:"1px solid #f0f0f0",borderRadius:8,marginBottom:4,cursor:"pointer"}}>
            {schedStatus==="running"&&<div style={{width:6,height:6,borderRadius:"50%",background:"#2e7d52",flexShrink:0}}/>}
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:1,flex:1}}>
              {schedStatus==="running"?`actualizando precios ${schedProgress.done}/${schedProgress.total}`:`✓ ${schedProgress.done} precios actualizados hoy`}
            </span>
            {schedLog.length>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb"}}>{showSchedLog?"▴":"▾"}</span>}
            {schedStatus==="running"&&<div style={{width:50,height:3,background:"#eee",borderRadius:99,overflow:"hidden",flexShrink:0}}>
              <div style={{height:"100%",width:`${schedProgress.total>0?schedProgress.done/schedProgress.total*100:0}%`,background:"#2e7d52",borderRadius:99,transition:"width 0.3s"}}/>
            </div>}
          </div>
          {showSchedLog&&schedLog.length>0&&(
            <div style={{background:"#fff",border:"1px solid #f0f0f0",borderRadius:8,marginBottom:8,maxHeight:200,overflowY:"auto"}}>
              {schedLog.map((item,i)=>{
                const up=parseFloat(item.delta)>=0;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderBottom:"1px solid #f8f8f8"}}>
                    {item.image&&<img src={item.image} style={{width:28,borderRadius:4,flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0,fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:up?"#2e7d52":"#e53935",flexShrink:0}}>
                      {up?"+":""}{item.delta}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Iconos de carpetas hardcodeadas */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["MLP","Staples & Meta","Dark Collection"].map(cat=>{
          const n=cat==="Dark Collection"?darkCat.length:inv.filter(c=>c.carpeta===cat).length;
          const cons=cat==="Dark Collection"?darkConseguidas:null;
          return(
            <button key={cat} onClick={()=>cat==="Dark Collection"?setView("dark"):setCarpetaView(cat)}
              style={{flex:1,background:"#1a1a1a",border:"none",borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:4}}>{CARPETAS_ICONS[cat]}</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:13,color:"#fff",lineHeight:1.2}}>{cat}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:3}}>
                {cons!=null?`${cons}/${n}`:n} {cat==="Dark Collection"?"conseguidas":"cartas"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Botones agregar + carpeta */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>{setView("buscar");setResults([]);setQuery("");}}
          style={{background:"#111",border:"none",borderRadius:20,padding:"7px 16px",fontFamily:"'Caveat',cursive",fontSize:15,color:"#fff",cursor:"pointer",flexShrink:0}}>+ agregar</button>
        {showAddCarpeta
          ?<div style={{display:"flex",gap:4,alignItems:"center"}}>
            <input autoFocus value={newCarpeta} onChange={e=>setNewCarpeta(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addCarpeta();if(e.key==="Escape")setShowAddCarpeta(false);}}
              placeholder="nombre..." style={{border:"1px dashed #ccc",borderRadius:6,padding:"4px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:"none",width:100,color:"#111"}}/>
            <button onClick={addCarpeta} style={{background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>+</button>
            <button onClick={()=>setShowAddCarpeta(false)} style={{background:"transparent",border:"none",color:"#bbb",cursor:"pointer",fontSize:14}}>×</button>
          </div>
          :<button onClick={()=>setShowAddCarpeta(true)} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",background:"transparent",border:"1px dashed #eee",borderRadius:12,padding:"4px 10px",cursor:"pointer"}}>+ carpeta</button>
        }
      </div>

      {/* Filtros línea 1 — por carpeta */}
      <div style={{display:"flex",gap:4,marginBottom:8,overflowX:"auto",paddingBottom:2}}>
        {["todas",...cats].map(c=>(
          <button key={c} onClick={()=>setCarpetaFiltro(c)}
            style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,padding:"4px 10px",borderRadius:12,border:"1px dashed",cursor:"pointer",flexShrink:0,
              background:carpetaFiltro===c?"#111":"transparent",color:carpetaFiltro===c?"#fff":"#aaa",borderColor:carpetaFiltro===c?"#111":"#ddd"}}>
            {c}
          </button>
        ))}
      </div>

      {/* Filtros línea 2 — por estado */}
      <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
        {[["todos","todas"],["hunting","🗡️ hunting"],["sin_publicar","sin publicar"],["a_la_venta","a la venta"],["vendida","vendida"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilterEstado(k)}
            style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,padding:"4px 10px",borderRadius:12,border:"1px dashed",cursor:"pointer",flexShrink:0,
              background:filterEstado===k?"#111":"transparent",color:filterEstado===k?"#fff":"#aaa",borderColor:filterEstado===k?"#111":"#ddd"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Ordenamiento + toggle visualización */}
      <div style={{display:"flex",gap:4,marginBottom:12,alignItems:"center"}}>
        {[["fecha","↓fecha"],["nombre","A-Z"],["precio","$"]].map(([k,l])=>(
          <button key={k} onClick={()=>toggleSort(k)}
            style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,padding:"3px 8px",borderRadius:6,border:"1px dashed",cursor:"pointer",flexShrink:0,
              background:sortBy===k?"#111":"transparent",color:sortBy===k?"#fff":"#bbb",borderColor:sortBy===k?"#bbb":"#eee"}}>
            {sortBy===k?(sortAsc?l+"↑":l+"↓"):l}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:3}}>
          {[["lista","☰"],["columnas","▤"],["grid","⠿"]].map(([v,l])=>(
            <button key={v} onClick={()=>setPoolView(v)}
              style={{width:28,height:26,borderRadius:6,border:"1px dashed",background:poolView===v?"#111":"transparent",color:poolView===v?"#fff":"#bbb",borderColor:poolView===v?"#111":"#eee",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Pool de cartas */}
      {filtradas.length===0&&(
        <div style={{padding:"40px 0",textAlign:"center"}}>
          <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#ccc"}}>{inv.length===0?"colección vacía":"sin cartas en esta vista"}</div>
        </div>
      )}

      {poolView==="lista"&&<div>
        {filtradas.map(carta=>{
          const est=ESTADOS[carta.estado]||ESTADOS.sin_publicar;
          const hist=carta.priceHistory||[];
          const metrics=computeHistMetrics(hist,"todo");
          const colorVenta=carta.tcgMarket&&carta.precioVentaUSD?(carta.precioVentaUSD>carta.tcgMarket?"#2e7d52":"#e53935"):null;
          // Variación total desde el primer snapshot hasta el más reciente —
          // neto después de subas y bajas, no la suma de cada movimiento.
          const varTotal = hist.length>=2 && hist[0].market>0
            ? ((hist[hist.length-1].market-hist[0].market)/hist[0].market*100) : null;
          return(
            <div key={carta.id} onClick={guardLongPressClick(()=>{setFichaId(carta.id);setView("ficha");})}
              style={{display:"flex",gap:10,padding:"12px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer",alignItems:"flex-start"}}>
              <div style={{position:"relative",flexShrink:0}} {...bindLongPress(carta.imageHd||carta.image)}>
                {carta.image
                  ?<img src={carta.image} alt={carta.name} style={{width:52,borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,0.1)"}}/>
                  :<div style={{width:52,height:72,borderRadius:6,background:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🃏</div>
                }
                {carta.isDark&&<span style={{position:"absolute",top:-3,right:-3,fontSize:10}}>⚫</span>}
                {carta.estado==="hunting"&&<span style={{position:"absolute",top:-3,left:-3,fontSize:12}}>🗡️</span>}
                {(carta.cantidad||1)>1&&<div style={{position:"absolute",bottom:2,left:2,background:"rgba(0,0,0,0.7)",borderRadius:4,padding:"1px 4px",fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"#fff"}}>×{carta.cantidad}</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:2}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:17,fontWeight:700,color:"#111",lineHeight:1.2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{carta.name}</div>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,background:est.bg,color:est.color,borderRadius:10,padding:"2px 7px",fontWeight:600,flexShrink:0,marginTop:2}}>{est.label}</span>
                </div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",marginBottom:6}}>{carta.carpeta} · {carta.set} · {carta.condicion}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:colorVenta||"#111"}}>{fmtUSD(carta.precioVentaUSD)}</span>
                  {carta.tcgMarket&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb"}}>{fmtUSD(carta.tcgMarket)} TCG</span>}
                  {varTotal!==null&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,color:varTotal>=0?"#2e7d52":"#e53935",background:varTotal>=0?"#e8f5e9":"#fdecea",borderRadius:8,padding:"1px 6px"}}>
                    {varTotal>=0?"↑":"↓"} {Math.abs(varTotal).toFixed(1)}%
                  </span>}
                </div>
                {metrics.ath&&<div style={{display:"flex",gap:8,marginTop:4}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#2e7d52"}}>▲ {fmtUSD(metrics.ath)} {fmtDateShort(metrics.athDate)}</span>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#e53935"}}>▼ {fmtUSD(metrics.atl)} {fmtDateShort(metrics.atlDate)}</span>
                </div>}
              </div>
              <span style={{color:"#ddd",fontSize:14,alignSelf:"center",flexShrink:0}}>›</span>
            </div>
          );
        })}
      </div>}
      {/* Modo "columnas" (cambio 8) — imagen + texto compacto en 2 columnas,
          resuelve el espacio vacío que quedaba a la derecha en modo lista. */}
      {poolView==="columnas"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {filtradas.map(carta=>{
          const est=ESTADOS[carta.estado]||ESTADOS.sin_publicar;
          const colorVenta=carta.tcgMarket&&carta.precioVentaUSD?(carta.precioVentaUSD>carta.tcgMarket?"#2e7d52":"#e53935"):null;
          return(
            <div key={carta.id} onClick={guardLongPressClick(()=>{setFichaId(carta.id);setView("ficha");})}
              style={{display:"flex",gap:8,padding:"8px",border:"1px solid #f0f0f0",borderRadius:10,cursor:"pointer",alignItems:"flex-start"}}>
              <div style={{position:"relative",flexShrink:0}} {...bindLongPress(carta.imageHd||carta.image)}>
                {carta.image
                  ?<img src={carta.image} alt={carta.name} style={{width:40,borderRadius:5}}/>
                  :<div style={{width:40,height:56,borderRadius:5,background:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🃏</div>
                }
                {carta.isDark&&<span style={{position:"absolute",top:-3,right:-3,fontSize:9}}>⚫</span>}
                {carta.estado==="hunting"&&<span style={{position:"absolute",top:-3,left:-3,fontSize:11}}>🗡️</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{carta.name}</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#aaa",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{carta.condicion} · {carta.carpeta}</div>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:colorVenta||"#111",lineHeight:1}}>{fmtUSD(carta.precioVentaUSD)}</div>
                {carta.tcgMarket&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#bbb",marginTop:1}}>{fmtUSD(carta.tcgMarket)} TCG</div>}
                <span style={{display:"inline-block",fontFamily:"'DM Sans',sans-serif",fontSize:8,background:est.bg,color:est.color,borderRadius:8,padding:"1px 6px",fontWeight:600,marginTop:4}}>{est.label}</span>
              </div>
            </div>
          );
        })}
      </div>}
      {poolView==="grid"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:6}}>
        {filtradas.map(carta=>{
          const colorVenta=carta.tcgMarket&&carta.precioVentaUSD?(carta.precioVentaUSD>carta.tcgMarket?"#2e7d52":"#e53935"):null;
          return(
            <div key={carta.id} onClick={guardLongPressClick(()=>{setFichaId(carta.id);setView("ficha");})}
              style={{cursor:"pointer",borderRadius:8,overflow:"hidden",border:"1px solid #f0f0f0",position:"relative"}}
              {...bindLongPress(carta.imageHd||carta.image)}>
              {carta.image
                ?<img src={carta.image} alt={carta.name} style={{width:"100%",display:"block"}}/>
                :<div style={{aspectRatio:"2/3",background:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🃏</div>
              }
              {(carta.cantidad||1)>1&&<div style={{position:"absolute",top:2,left:2,background:"rgba(0,0,0,0.7)",borderRadius:4,padding:"1px 4px",fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"#fff"}}>×{carta.cantidad}</div>}
              {carta.isDark&&<span style={{position:"absolute",top:2,right:2,fontSize:9}}>⚫</span>}
              {carta.estado==="hunting"&&<span style={{position:"absolute",top:carta.isDark?15:2,right:2,fontSize:12}}>🗡️</span>}
              <div style={{padding:"4px 5px",background:"#fff"}}>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:14,fontWeight:700,color:colorVenta||"#111",lineHeight:1}}>{fmtUSD(carta.precioVentaUSD)}</div>
                {carta.tcgMarket&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"#bbb"}}>{fmtUSD(carta.tcgMarket)}</div>}
              </div>
            </div>
          );
        })}
      </div>}

      <div style={{height:32}}/>
    </div>
  );
}

export default PokecriptoPage;
