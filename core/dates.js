const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function fmt(date) { return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0,3)}`; }
function fmtFull(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }

// BudgetPage uses this fallback when a period has not been created yet.
// Keep the factory available globally because BudgetPage currently calls it
// without importing it. New periods start as a deep copy of the latest saved
// period, so the previous budget becomes the editable template for the next one.
function makeDefaultBudget() {
  const empty = {
    ingresos: {trabajo:0, emprendimiento:0, reventa:0, otros:0},
    gastos_base: [],
    personales: [],
    propositos: []
  };
  try {
    const raw = localStorage.getItem("angst-v12");
    const data = raw ? JSON.parse(raw) : null;
    const budgets = data && data.budgets && typeof data.budgets === "object" ? data.budgets : {};
    const keys = Object.keys(budgets).sort();
    if(!keys.length) return empty;
    const previous = budgets[keys[keys.length-1]];
    if(!previous || typeof previous !== "object") return empty;
    const copy = JSON.parse(JSON.stringify(previous));
    // Completion state belongs to the old period, not the new template.
    ["gastos_base","personales","propositos"].forEach(sec => {
      if(Array.isArray(copy[sec])) copy[sec] = copy[sec].map(row => ({...row, checked:false}));
    });
    return copy;
  } catch(e) {
    return empty;
  }
}
if(typeof globalThis !== "undefined") globalThis.makeDefaultBudget = makeDefaultBudget;

const CL_HOLIDAYS = {"01-01":"Año Nuevo","04-03":"Viernes Santo","04-04":"Sábado Santo","05-01":"Día del Trabajo","05-21":"Glorias Navales","06-29":"San Pedro y San Pablo","07-16":"Virgen del Carmen","08-15":"Asunción de la Virgen","09-18":"Independencia","09-19":"Glorias del Ejército","10-12":"Día del Encuentro","10-31":"Iglesias Evangélicas","11-01":"Todos los Santos","12-08":"Inmaculada Concepción","12-25":"Navidad"};
const US_HOLIDAYS = {"01-01":"New Year's Day","01-20":"MLK Day","02-16":"Presidents' Day","05-25":"Memorial Day","06-19":"Juneteenth","07-04":"Independence Day","09-07":"Labor Day","10-13":"Columbus Day","11-11":"Veterans Day","11-26":"Thanksgiving","12-25":"Christmas"};

function getHoliday(date) {
  const dow = date.getDay();
  if (dow === 6) return { label:"Sábado", type:"weekend" };
  if (dow === 0) return { label:"Domingo", type:"weekend" };
  const key = String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
  if (CL_HOLIDAYS[key] && US_HOLIDAYS[key]) return { label:CL_HOLIDAYS[key]+" · "+US_HOLIDAYS[key], type:"both" };
  if (CL_HOLIDAYS[key]) return { label:CL_HOLIDAYS[key], type:"cl" };
  if (US_HOLIDAYS[key]) return { label:US_HOLIDAYS[key], type:"us" };
  return null;
}

export { MONTH_NAMES, addDays, fmt, fmtFull, getHoliday, CL_HOLIDAYS, US_HOLIDAYS };
