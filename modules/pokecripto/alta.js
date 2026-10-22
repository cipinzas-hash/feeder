// Alta de cartas, compartida por PokecriptoPage (vista "agregar carta") y AgregarCartaModal (➕ Registrar).
// Un solo lugar para: búsqueda en pokemontcg.io, armado de la carta del inventario y encolado para el bot de precios.
import { POKE_BASE, fetchPoke, getPrimaryPrice } from "./lib/pricing.mjs";

export const POKECRIPTO_WORKER_URL = "https://angst-sync.angst-66394c52.workers.dev";
// Mismo AUTH_SECRET que Simkl/podcasts -- un solo secret de Worker compartido, no uno por feature.
export const POKECRIPTO_AUTH_KEY = "angst-simkl-auth-v1";
export function getPokecriptoAuth(){ try{ return localStorage.getItem(POKECRIPTO_AUTH_KEY)||null; }catch(e){ return null; } }

export function isDarkCard(card){
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

// Encola cartas nuevas para que el bot las precie en su próxima corrida
// -- nunca prompt() acá, solo lo llaman flujos donde el usuario ya
// conectó el Worker (agregarCarta, resync de Dark Collection, botón
// "conectar" de abajo).
export async function encolarPokecriptoPending(cartas){
  const auth = getPokecriptoAuth();
  if(!auth || !cartas.length) return;
  try{
    const getResp = await fetch(`${POKECRIPTO_WORKER_URL}?path=pokecripto-pending.json`, {headers:{"X-Angst-Auth":auth}});
    const remote = getResp.ok ? await getResp.json() : [];
    const actual = Array.isArray(remote) ? remote : [];
    // Combina por id (12-oct-2026): un parche de carpeta sobre una carta que ya estaba encolada se funde en ella; una
    // entrada repetida con otro contenido la reemplaza. Antes todo lo que ya estaba en la cola se descartaba.
    const porId = new Map(actual.map(c=>[c.id,c]));
    let cambio = false;
    for(const c of cartas){
      const prev = porId.get(c.id);
      const sig = (c._patch && prev && !prev._patch) ? {...prev,...c._patch} : c;
      if(!prev || JSON.stringify(prev)!==JSON.stringify(sig)){ porId.set(c.id,sig); cambio = true; }
    }
    if(!cambio) return;
    await fetch(POKECRIPTO_WORKER_URL, {
      method:"POST",
      headers:{"X-Angst-Auth":auth,"Content-Type":"application/json"},
      body: JSON.stringify({path:"pokecripto-pending.json", payload:[...porId.values()]}),
    });
  }catch(e){ /* silencioso -- se reintenta la próxima vez que se llame, nada local se rompe */ }
}

// Busca cartas por nombre, "sv3-125" (id) o "OBF 125" (código de set + número). Lanza si la red falla.
export async function buscarCartas(q){
  const idFmt=q.match(/^[a-z0-9]+-\d+[a-z]*$/i);
  const setNum=q.match(/^([a-zA-Z0-9]+)\s+(\d+)(?:\/\d+)?$/);
  let apiQ="";
  if(idFmt) apiQ=`id:${q}`;
  else if(setNum) apiQ=`set.ptcgoCode:${setNum[1].toUpperCase()} number:${setNum[2]}`;
  else apiQ=q.includes(" ")?`name:"${q}"`:`name:${q}*`;
  const data=await fetchPoke(`${POKE_BASE}/cards?q=${encodeURIComponent(apiQ)}&select=id,name,number,set,tcgplayer,images,rarity,types,attacks,abilities&orderBy=-set.releaseDate&pageSize=24`);
  return data.data||[];
}

// Carta nueva del inventario a partir de una carta de la API y el formulario de alta.
export function armarCartaNueva(card, form, cats, hoy){
  const p=getPrimaryPrice(card);
  const esWatch=form.destino==="watch"; // Price Watch = solo sigo su precio (con objetivo); hunting = la busco para completar una colección
  const esHunting=form.destino==="hunting"||esWatch;
  const nueva={
    id:Date.now().toString(),cardId:card.id,name:card.name,
    set:card.set?.name||"",setCode:card.set?.ptcgoCode||card.set?.id||"",
    number:card.number||"",rarity:card.rarity||"",
    image:card.images?.small||"",imageHd:card.images?.large||"",
    tcgMarket:p?.market||null,tcgLow:p?.low||null,tcgHigh:p?.high||null,
    tcgUpdated:hoy,
    priceHistory:p?.market?[{date:hoy,market:p.market,low:p.low||null,high:p.high||null,src:"ptcg"}]:[],
    costoUSD:esHunting?0:(parseFloat(form.costoUSD)||0),
    precioVentaUSD:parseFloat(form.precioVentaUSD)||(p?.market||0),
    condicion:form.condicion||"NM",estado:esHunting?"hunting":"sin_publicar",
    carpeta:esWatch?"Price Watch":(form.carpeta&&form.carpeta!=="Price Watch"?form.carpeta:(cats.find(c=>c!=="Price Watch")||cats[0])),
    fechaCompra:esHunting?null:(form.fechaCompra||hoy),
    cantidad:parseInt(form.cantidad)||1,
    fechaVenta:null,precioVendidoUSD:null,
    notas:form.notas||"",isDark:isDarkCard(card),
    ...(esWatch&&form.precioObjetivo?{precioObjetivo:parseFloat(form.precioObjetivo)||null}:{}),
  };
  return nueva;
}
