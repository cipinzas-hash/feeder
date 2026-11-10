// build-pokecripto-colecciones.mjs (issue #41, 10-nov-2026)
// Snapshot mensual del valor de cada colección de Pokécripto, hecho por un bot (el registro desde la app al abrirla no
// servía: si no se abría en el mes, el mes se perdía). Corre vía GitHub Action una vez cada 30 días (el día 1 de cada mes,
// después del bot de precios; update-pokecripto-colecciones.yml), dentro del checkout de Angst-data.
//
// Lee pokecripto-inventario.json (canónico, lo reescribe el bot de precios) y mantiene pokecripto-colecciones-historial.json:
//   [{ mes:"2026-11", fecha:"2026-11-10", colecciones:{ "Mega":{v,vc,n,c,p}, …, "*":{…total} } }]
// Un snapshot por colección y mes: nunca hay snapshots diarios que acumular. Si se corre a mano dentro de un mes que ya
// tiene snapshot, reemplaza la entrada de ese mes (no agrega otra) y los meses anteriores no se tocan. Lógica pura en pokecripto/lib/colecciones.mjs (con test).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { avancesDeInventario, registrarSnapshotMes, mesDe, TOTAL_COLECCIONES } from "../../pokecripto/lib/colecciones.mjs";

const INVENTARIO_PATH = process.env.POKECRIPTO_INVENTARIO_PATH;
const SALIDA_PATH = process.env.POKECRIPTO_COLECCIONES_PATH;
if (!INVENTARIO_PATH || !SALIDA_PATH) {
  console.error("✗ Faltan POKECRIPTO_INVENTARIO_PATH / POKECRIPTO_COLECCIONES_PATH (rutas al checkout de Angst-data)");
  process.exit(1);
}

let inventario;
try { inventario = JSON.parse(readFileSync(INVENTARIO_PATH, "utf-8")); }
catch (e) { console.error(`✗ No se pudo leer el inventario (${e.message}): no se toca el historial`); process.exit(1); }
if (!Array.isArray(inventario) || !inventario.length) { console.error("✗ Inventario vacío o inválido: no se toca el historial"); process.exit(1); }

// Si el historial existe pero no se puede leer, se aborta: seguir con [] lo pisaría entero.
let previo = [];
if (existsSync(SALIDA_PATH)) {
  try { previo = JSON.parse(readFileSync(SALIDA_PATH, "utf-8")); }
  catch (e) { console.error(`✗ El historial existe pero no se pudo leer (${e.message}): no se pisa`); process.exit(1); }
  if (!Array.isArray(previo)) { console.error("✗ El historial no es una lista: no se pisa"); process.exit(1); }
}

const hoy = new Date().toISOString().slice(0, 10);
const { porColeccion, total } = avancesDeInventario(inventario);
const avances = { ...porColeccion, [TOTAL_COLECCIONES]: total };

// Guarda de cordura: si el total de cartas cae a menos de la mitad del último snapshot, el inventario está incompleto
// (corrida cortada, archivo a medio escribir): mejor no registrar un valor falso como "el valor del mes".
const ultimo = previo.length ? previo[previo.length - 1].colecciones?.[TOTAL_COLECCIONES] : null;
if (ultimo?.n > 0 && total.total < ultimo.n * 0.5) {
  console.error(`✗ El inventario trae ${total.total} cartas de colecciones y el último snapshot tenía ${ultimo.n}: se descarta esta corrida`);
  process.exit(1);
}

for (const [nombre, r] of Object.entries(avances)) {
  console.log(`${nombre === TOTAL_COLECCIONES ? "TOTAL" : nombre}: ${r.conseguidas}/${r.total} (${r.pct}%) · $${r.valorConseguido.toFixed(2)} / $${r.valorTotal.toFixed(2)} · ${r.conPrecio} con precio`);
}
const siguiente = registrarSnapshotMes(previo, hoy, avances);
if (siguiente === previo) { console.log(`ℹ ${mesDe(hoy)}: sin cambios respecto del snapshot guardado, no se escribe`); process.exit(0); }
writeFileSync(SALIDA_PATH, JSON.stringify(siguiente, null, 1));
console.log(`✓ Snapshot de ${mesDe(hoy)} guardado (${siguiente.length} mes(es) en el historial)`);
