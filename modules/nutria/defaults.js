const DEFAULT_INSUMOS = {
  anillo:      { label:"Anillo 3/4\"",    precio:52438, divisor:7000 },
  laminado:    { label:"Laminado (metro)",precio:13073, divisor:120  },
  ojetillo:    { label:"Ojetillo",        precio:25,    divisor:1    },
  elastico:    { label:"Elástico (cm)",  precio:177,   divisor:1500 }, // $177 por 15m = 1500cm → $0.118/cm
  opalina:     { label:"Opalina",         precio:81099, divisor:1700 },
  bond_12x18:  { label:"Bond 12x18",      precio:45156, divisor:9000 },
  bond_15x15:  { label:"Bond 15x15",      precio:45156, divisor:8750 },
  bond_15x21:  { label:"Bond 15x21",      precio:45156, divisor:6250 },
  bond_19x25:  { label:"Bond 19x25",      precio:47100, divisor:4250 },
  carton_12x18:{ label:"Cartón 12x18",    precio:11250, divisor:320  },
  carton_15x15:{ label:"Cartón 15x15",    precio:11250, divisor:280  },
  carton_15x21:{ label:"Cartón 15x21",    precio:24794, divisor:360  },
  carton_19x25:{ label:"Cartón 19x25",    precio:24790, divisor:225  },
  tinta:       { label:"Tinta (impresión)",precio:12000, divisor:60  },
  adh:         { label:"Adhesivo tapas",  precio:7500,  divisor:100  },
  corchete:    { label:"Corchete",        precio:3500,  divisor:5000 },
};

// Fórmulas agendas anilladas Nutria/Angst
// elastico: cantidad en CM (unitario = $177/1500cm = $0.118/cm)
// laminado: cantidad en METROS (unitario = $13073/120m = $108.94/m)
// adh: hojas A4 de adhesivo por agenda
const FORMULAS_PRODUCTOS = {
  "12x18": { label:"Agenda 12x18",  precio_venta:12990, materiales:{ ojetillo:2, elastico:18, carton_12x18:2, adh:2, laminado:1.2, anillo:13, bond_12x18:80, tinta:1 } },
  "15x15": { label:"Agenda 15x15",  precio_venta:14990, materiales:{ ojetillo:2, elastico:15, carton_15x15:2, adh:3, laminado:1.5, anillo:16, bond_15x15:80, tinta:1 } },
  "15x21": { label:"Agenda 15x21",  precio_venta:16990, materiales:{ ojetillo:2, elastico:21, carton_15x21:2, adh:3, laminado:1.5, anillo:16, bond_15x21:80, tinta:1 } },
  "19x25": { label:"Agenda 19x25",  precio_venta:19990, materiales:{ ojetillo:2, elastico:25, carton_19x25:2, adh:4, laminado:1.8, anillo:19, bond_19x25:80, tinta:1 } },
};

// Fórmulas Angst Pop (feria)
const FORMULAS_ANGSTPOP = {
  sticker_tercio:  { label:"Sticker tercio",    precio_venta:700, precio_pack:2000, pack:3, materiales:{ adh:0.33, tinta:0.19, corchete:0 } },
  taco_12x18:      { label:"Taco 12x18",         precio_venta:700, precio_pack:2000, pack:3, materiales:{ bond_12x18:35, adh:0.5, tinta:0.44, corchete:0 } },
  libro_pintar:    { label:"Libro de pintar",    precio_venta:700, precio_pack:2000, pack:3, materiales:{ bond_19x25:5,  tinta:1,    corchete:2 } },
  cubeecraft:      { label:"Cubeecraft",         precio_venta:500, precio_pack:1000, pack:3, materiales:{ opalina:1,    tinta:0.33  } },
};

const FEE_CODICE = 5000; // Fee fijo Códice por agenda anillada (incluye materiales + armado)

const SALE_SIZES = ["A5","12x19","19x25"];

function makeDefaultNutria() {
  const insumosDefault = Object.fromEntries(Object.entries(DEFAULT_INSUMOS).map(([k,v])=>[k,{precio:v.precio,divisor:v.divisor}]));
  const preciosVentaDefault = Object.fromEntries(Object.entries(FORMULAS_PRODUCTOS).map(([k,v])=>[k,v.precio_venta]));
  const preciosPopDefault = Object.fromEntries(Object.entries(FORMULAS_ANGSTPOP).map(([k,v])=>[k,{precio_venta:v.precio_venta,precio_pack:v.precio_pack}]));
  return {
    emprendimientos: ["Nutria Papelería","Angst Papelería"],
    ventas: [],
    costos: { insumos: insumosDefault, precios_venta: preciosVentaDefault, precios_pop: preciosPopDefault },
    guiaCorte: [
      { resma:"Bond 105g 77x110",   corte:"12x18", unidadPliego:36, totalHojas:9000 },
      { resma:"Bond 105g 77x110",   corte:"15x15", unidadPliego:35, totalHojas:8750 },
      { resma:"Bond 105g 77x110",   corte:"15x21", unidadPliego:25, totalHojas:6250 },
      { resma:"Bond 105g 77x110",   corte:"19x25", unidadPliego:17, totalHojas:4250 },
      { resma:"Opalina 200g 77x110",corte:"19x25", unidadPliego:17, totalHojas:1700 },
    ],
  };
}

export { DEFAULT_INSUMOS, FORMULAS_PRODUCTOS, FORMULAS_ANGSTPOP, makeDefaultNutria, SALE_SIZES, FEE_CODICE };
