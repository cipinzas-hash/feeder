// Lógica compartida de nutrición: catálogo, comidas, cálculo de porciones y armado de entradas.
// Antes vivía dentro de NutricionPage; ahora la usan NutricionPage, IngestaRapida (➕ Registrar) y los
// mazos, para que las kcal se calculen UNA sola vez y no se desfasen entre pantallas.
import { normalizeSearchText } from "../../core/format.js";

export const NUTRI_FOODS = {
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
export const NUTRI_CATS = [
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
export const MEALS = [
  {id:"desayuno", emoji:"🌅", label:"Desayuno"},
  {id:"almuerzo", emoji:"☀️", label:"Almuerzo"},
  {id:"cena",     emoji:"🌙", label:"Cena"},
  {id:"snack",    emoji:"🍪", label:"Snack"},
];
export function getDefaultMeal() {
  const h = new Date().getHours();
  if(h>=5 && h<11) return "desayuno";
  if(h>=11 && h<16) return "almuerzo";
  if(h>=16 && h<21) return "cena";
  return "snack";
}

export const SIZE_MULT = {S:1, M:1.5, L:2};
export const CALIBRE_KCAL = {S:192, M:280, L:392, XL:560};
export const CALIBRE_PROT = {S:2.4, M:3.5, L:4.9, XL:7.0};
export const FRUIT_FRACTIONS = [[1,"entera"],[0.5,"½"],[2/3,"⅔"],[0.333,"⅓"],[0.25,"¼"]];

export function fechaKey(d=new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// kcal/prot efectivas de una porción (idéntico al computeEffective que vivía en NutricionPage).
export function calcPorcion(food, qty, fraction, sizeKey) {
  const pt = food.portionType;
  if(pt === "weight100") {
    // qty representa pasos de 50g (precisión real sin pesar de a 100)
    return { kcal: food.kcal * qty * 0.5, prot: food.prot * qty * 0.5, displayQty: `${qty*50}g` };
  }
  if(pt === "size") {
    const m = SIZE_MULT[sizeKey]||1;
    const ef = fraction||1;
    const fLabel = ef===1?"":ef===0.5?" ½":ef===2/3?" ⅔":ef===0.333?" ⅓":" ¼";
    return { kcal: food.kcal * m * ef * qty, prot: food.prot * m * ef * qty, displayQty: `${sizeKey}${fLabel}` };
  }
  if(pt === "fraction") {
    return { kcal: food.kcal * fraction * qty, prot: food.prot * fraction * qty, displayQty: fraction===1?"completa":fraction===0.5?"½":fraction===2/3?"⅔":fraction===0.333?"⅓":"¼" };
  }
  if(pt === "calibre") {
    const kcal = CALIBRE_KCAL[sizeKey] || food.kcal;
    const prot = CALIBRE_PROT[sizeKey] || food.prot;
    return { kcal: kcal * fraction * qty, prot: prot * fraction * qty, displayQty: `${sizeKey} ${fraction===1?"entera":fraction===0.5?"½":"¼"}` };
  }
  return { kcal: food.kcal * qty, prot: food.prot * qty, displayQty: `×${qty}` };
}

// Alimentos de una categoría: base con sus overrides (cat del override manda) + personalizados.
export function alimentosPorCategoria(catKey, foodOverrides, customFoods) {
  const allBase = NUTRI_CATS.flatMap(c=>(NUTRI_FOODS[c.k]||[]).map(f=>({...f,catKey:c.k,...((foodOverrides||{})[f.id]||{})})));
  const base = allBase.filter(f=>(f.cat||f.catKey)===catKey);
  const custom = Object.values(customFoods||{}).filter(f=>f.cat===catKey);
  return [...base,...custom];
}
export function todosLosAlimentos(foodOverrides, customFoods) {
  return NUTRI_CATS.flatMap(c=>alimentosPorCategoria(c.k, foodOverrides, customFoods).map(f=>({...f,catKey:c.k})));
}
export function buscarAlimentos(query, foodOverrides, customFoods, limite=6) {
  const q = normalizeSearchText(query||"");
  if(!q.trim()) return [];
  return todosLosAlimentos(foodOverrides, customFoods).filter(f=>normalizeSearchText(f.name).includes(q)).slice(0,limite);
}

// Entrada del registro del día: el alimento completo + kcal/prot POR UNIDAD (así qty multiplica bien).
export function armarEntrada(food, qty, fraction, sizeKey, meal) {
  const { kcal, prot, displayQty } = calcPorcion(food, qty, fraction, sizeKey);
  return {
    ...food,
    kcal: parseFloat((kcal/qty).toFixed(2)),
    prot: parseFloat((prot/qty).toFixed(2)),
    qty,
    unit: displayQty,
    meal,
    uid: Date.now()+Math.random(),
  };
}

// "Registrar sin datos exactos" (issue #5): 🟡 estimado (rango opcional, guarda el punto medio) o 🔴 desconocido (sin números).
// Devuelve null si falta la descripción o la certeza.
export function armarEntradaEstimada(est, meal) {
  const { descripcion, certainty, kcalMin, kcalMax, protMin, protMax } = est||{};
  if(!descripcion?.trim() || !certainty) return null;
  const kMin = parseFloat(kcalMin), kMax = parseFloat(kcalMax);
  const pMin = parseFloat(protMin), pMax = parseFloat(protMax);
  const kcalRange = (certainty==="estimado" && !isNaN(kMin) && !isNaN(kMax)) ? [kMin,kMax] : null;
  const protRange = (certainty==="estimado" && !isNaN(pMin) && !isNaN(pMax)) ? [pMin,pMax] : null;
  return {
    uid: Date.now()+Math.random(),
    meal,
    certainty,
    name: descripcion.trim(),
    emoji: certainty==="desconocido" ? "🔴" : "🟡",
    kcal: kcalRange ? (kcalRange[0]+kcalRange[1])/2 : 0,
    prot: protRange ? (protRange[0]+protRange[1])/2 : 0,
    kcalRange, protRange,
    qty: 1,
    unit: "",
  };
}

// Un mazo = una comida. Los guardados antes de la Fase 1 (issue #4) traían meal por ítem: se infiere el más frecuente.
export function inferirComidaMazo(items) {
  const counts = {};
  (items||[]).forEach(it=>{ const m=it.meal||"snack"; counts[m]=(counts[m]||0)+1; });
  const entries = Object.entries(counts);
  if(!entries.length) return "snack";
  return entries.sort((a,b)=>b[1]-a[1])[0][0];
}

// Alimentos recientes (únicos, del más nuevo al más viejo) que todavía existen en el catálogo.
export function alimentosRecientes(nutriLog, foodOverrides, customFoods, n=8) {
  const vigentes = new Map(todosLosAlimentos(foodOverrides, customFoods).map(f=>[f.id,f]));
  const vistos = new Set(); const out = [];
  const fechas = Object.keys(nutriLog||{}).sort().reverse();
  for(const dk of fechas) {
    const log = nutriLog[dk]||[];
    for(let i=log.length-1;i>=0;i--) {
      const id = log[i].id;
      if(!id || vistos.has(id) || !vigentes.has(id)) continue;
      vistos.add(id); out.push(vigentes.get(id));
      if(out.length>=n) return out;
    }
  }
  return out;
}

// Última vez que se registró esta comida en un día ANTERIOR a `hasta` (para "repetir").
export function ultimaComida(nutriLog, mealId, hasta) {
  const fechas = Object.keys(nutriLog||{}).filter(dk=>dk<hasta).sort().reverse();
  for(const dk of fechas) {
    const items = (nutriLog[dk]||[]).filter(e=>(e.meal||"snack")===mealId);
    if(items.length) return { fecha: dk, items };
  }
  return null;
}
