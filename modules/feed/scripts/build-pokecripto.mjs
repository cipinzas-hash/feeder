// build-pokecripto.mjs (issue #9; reescrito 12-oct-2026)
// Corre vía GitHub Action una vez al día (update-pokecripto.yml), separado de cualquier otro job -- lee/escribe
// directo en Angst-data (checkout aparte), nada de esto vive en Mega ni en el repo público feeder.
//
// Fuente de verdad: pokecripto-inventario.json en Angst-data (canónico, solo este script lo reescribe).
// pokecripto-pending.json es la cola que encola el cliente: altas nuevas Y parches de carpeta
// ({id, _patch:{carpeta}}, para que Price Watch tenga prioridad). Se fusiona al canónico al principio de cada
// corrida; el VACIADO lo hace el workflow (pokecripto-reconcile-pending.mjs) conservando lo que el cliente
// haya encolado mientras el bot corría -- antes se vaciaba el archivo entero y esas altas se perdían.
//
// OBJETIVO (12-oct-2026): que TODAS las cartas tengan precio, con una sola fuente consistente y el máximo de
// snapshots reales por consulta. tcgpricelookup.com acepta 20 ids por consulta (ids=a,b,c…), así que una carta con
// tcgId cuesta 1/20 de consulta. Orden de cada corrida:
//   1. DESCUBRIMIENTO: cartas sin tcgId se buscan por SET (una consulta trae hasta 100 cartas del set, con id y
//      precio). Cada carta emparejada recibe su tcgId y, si la API trae precio, su snapshot de una vez.
//      Presupuesto = lo que sobra del cupo diario después de los lotes (ver presupuestoDescubrimiento).
//   2. LOTES: todas las cartas con tcgId, de 20 en 20, Price Watch primero y luego las más viejas.
//   3. ROTACIÓN: las cartas que siguen sin precio (sin tcgId, o sin precio en la API) se buscan una por una:
//      pokemontcg.io (gratis, 20 req/min) primero y tcgpricelookup como respaldo mientras quede cupo.
// Cada snapshot guarda `src`: "tpl" (tcgpricelookup, Near Mint raw) o "ptcg" (pokemontcg.io). El cliente solo
// compara snapshots de la misma fuente, así una carta que cambia de fuente no muestra saltos falsos.
//
// Robustez: se guarda a disco cada GUARDAR_CADA cartas y ante SIGTERM (timeout del workflow), y el resumen de la
// corrida queda en pokecripto-estado.json (los logs completos de Actions no son legibles desde fuera).

import { readFileSync, writeFileSync } from "node:fs";
import { refreshPrecio, fetchTCGBatch, addSnapshot } from "../../pokecripto/lib/pricing.mjs";
import { aplicarOverrides, normalizarOverridesRemotos, fusionarPending, prioridadCarta } from "../../pokecripto/lib/review.mjs";
import { fetchTCGPagina, asignarTcgIds, agruparPorSet, paginasNecesarias, debeSaltarse, actualizarEstadoSet, presupuestoDescubrimiento, POR_PAGINA } from "../../pokecripto/lib/discovery.mjs";

const INVENTARIO_PATH = process.env.POKECRIPTO_INVENTARIO_PATH;
const PENDING_PATH = process.env.POKECRIPTO_PENDING_PATH;
const OVERRIDES_PATH = process.env.POKECRIPTO_OVERRIDES_PATH || null;
const ESTADO_PATH = process.env.POKECRIPTO_ESTADO_PATH || null;   // resumen + memoria del descubrimiento por set
const MERGED_PATH = process.env.POKECRIPTO_MERGED_PATH || null;   // ids fusionados desde pending (lo lee el reconcile)
const TCG_API_KEY = process.env.TCG_API_KEY || null;

// ── Presupuestos ────────────────────────────────────────────────────────
// Rotación individual: ~3,2 s por carta (throttle de pokemontcg.io sin key: 20 req/min) => 100 cartas ≈ 6 min.
// A medida que las cartas pasan a lotes esta fase se vacía sola.
const CARTAS_POR_CORRIDA = 100;
// Tope propio de consultas diarias a tcgpricelookup.com (cupo real del plan Free: 100). 85 deja 15 para el uso
// manual del cliente, que ahora es barato (el buscador ya no consulta 24 cartas por búsqueda).
const RESERVA_TCG_DIARIA = 85;
const BATCH_TAMANO = 20;          // máximo de ids por consulta de la API
const BATCH_MAX_LLAMADAS = 65;    // 65 x 20 = 1300 cartas: todo el inventario actual (1291) en una corrida
const BATCH_PAUSA_MS = Number(process.env.POKECRIPTO_PAUSA_MS ?? 500);   // las pruebas la bajan a 0
const DESCUBRIMIENTO_TOPE = 40;   // consultas máximas de descubrimiento por corrida
const DESCUBRIMIENTO_PAGINAS = 4; // páginas máximas por set (4 x 100 = 400 cartas)
const RESERVA_INDIVIDUAL = 8;     // consultas que se guardan para búsquedas carta por carta
const POKE_THROTTLE_MS = Number(process.env.POKECRIPTO_THROTTLE_MS ?? 3200);
const GUARDAR_CADA = 25;
const SIN_MATCH_PARA_APAGAR = 3;  // sets consecutivos sin ni un match => se apaga el descubrimiento esta corrida

if (!INVENTARIO_PATH || !PENDING_PATH) {
  console.error("✗ Faltan POKECRIPTO_INVENTARIO_PATH / POKECRIPTO_PENDING_PATH (rutas al checkout de Angst-data)");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
function leerJson(path, fallback, validar) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return validar(parsed) ? parsed : fallback;
  } catch (e) {
    console.log(`⚠ No se pudo leer ${path} (${e.message}), usando ${JSON.stringify(fallback)}`);
    return fallback;
  }
}
const esArray = x => Array.isArray(x);
const esObjeto = x => x && typeof x === "object" && !Array.isArray(x);

async function main() {
  const inventario = leerJson(INVENTARIO_PATH, [], esArray);
  const pending = leerJson(PENDING_PATH, [], esArray);
  const estado = ESTADO_PATH ? leerJson(ESTADO_PATH, {}, esObjeto) : {};
  estado.sets = esObjeto(estado.sets) ? estado.sets : {};
  let overrides = {};
  if (OVERRIDES_PATH) {
    try { overrides = normalizarOverridesRemotos(JSON.parse(readFileSync(OVERRIDES_PATH, "utf-8"))); }
    catch (e) { console.log(`ℹ Sin overrides (${e.message}), se sigue sin ellos`); }
  }
  const hoy = new Date().toISOString().slice(0, 10);

  // 0. Fusionar pending (altas + parches de carpeta) y aplicar designaciones manuales.
  const fus = fusionarPending(inventario, pending);
  if (MERGED_PATH) writeFileSync(MERGED_PATH, JSON.stringify(fus.fusionados));
  const base = aplicarOverrides(fus.inventario, overrides);
  if (fus.nuevas) console.log(`✓ ${fus.nuevas} carta(s) nueva(s) fusionada(s) desde pending`);
  if (fus.parcheadas) console.log(`✓ ${fus.parcheadas} parche(s) de carpeta aplicado(s)`);
  if (Object.keys(overrides).length) console.log(`✓ ${Object.keys(overrides).length} designación(es) manual(es) aplicada(s)`);

  const actualizadas = new Map(); // id -> campos de precio / intento de HOY
  const parches = new Map();      // id -> { tcgId } descubierto (puede no traer precio)
  const porId = new Map(base.map(c => [c.id, c]));
  const tcgIdDe = c => parches.get(c.id)?.tcgId || c.tcgId || null;
  const activas = base.filter(c => c.estado !== "vendida");
  let tcgUsadas = 0, okCount = 0, failCount = 0;

  // Antigüedad = lo más reciente entre el último precio y el último INTENTO (tcgIntento): una carta que falla no se
  // queda al frente de la cola gastando cupo todos los días. Price Watch siempre primero.
  const claveEdad = c => [c.tcgUpdated, c.tcgIntento].filter(Boolean).map(x => String(x).slice(0, 10)).sort().pop() || "2000-01-01";
  const porPrioridadYEdad = (a, b) => prioridadCarta(a) - prioridadCarta(b) || claveEdad(a).localeCompare(claveEdad(b));

  const aplicado = () => base.map(c => (parches.has(c.id) || actualizadas.has(c.id)) ? { ...c, ...(parches.get(c.id) || {}), ...(actualizadas.get(c.id) || {}) } : c);
  const resumen = {};
  function guardar(motivo) {
    const inv = aplicado();
    writeFileSync(INVENTARIO_PATH, JSON.stringify(inv, null, 2));
    if (ESTADO_PATH) {
      const act = inv.filter(c => c.estado !== "vendida");
      const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      estado.ultimaCorrida = {
        ...resumen, fecha: hoy, guardadoPor: motivo,
        activas: act.length,
        conTcgId: act.filter(c => c.tcgId).length,
        sinPrecio: act.filter(c => !c.tcgMarket).length,
        actualizadasHoyOAyer: act.filter(c => c.tcgUpdated && String(c.tcgUpdated).slice(0, 10) >= ayer).length,
      };
      writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2));
    }
  }
  // Timeout del workflow (SIGTERM): se persiste lo hecho hasta ahora en vez de perder la corrida entera.
  process.on("SIGTERM", () => { try { guardar("SIGTERM"); } catch (e) { /* nada más que hacer */ } process.exit(1); });

  const snapshotDe = (carta, m, src) => ({
    tcgMarket: m.market, tcgLow: m.low ?? null, tcgHigh: m.high ?? null, tcgUpdated: hoy,
    priceHistory: addSnapshot(carta.priceHistory, m.market, m.low ?? null, m.high ?? null, hoy, src),
  });

  // ── 1. DESCUBRIMIENTO de tcgId por set ────────────────────────────────
  const sinTcgId = activas.filter(c => !tcgIdDe(c));
  const presupuestoDesc = TCG_API_KEY ? presupuestoDescubrimiento({
    reserva: RESERVA_TCG_DIARIA, cartasConTcgId: activas.length - sinTcgId.length, batchTam: BATCH_TAMANO,
    batchMax: BATCH_MAX_LLAMADAS, reservaIndividual: RESERVA_INDIVIDUAL, tope: DESCUBRIMIENTO_TOPE, sinTcgId: sinTcgId.length,
  }) : 0;
  let descLlamadas = 0, descEncontradas = 0, descConPrecio = 0, setsProbados = 0, setsSinMatchSeguidos = 0, descActivo = presupuestoDesc > 0;
  const grupos = agruparPorSet(sinTcgId).filter(g => !debeSaltarse(estado.sets[g.clave], hoy));
  console.log(`Descubrimiento: ${sinTcgId.length} carta(s) sin tcgId en ${grupos.length} set(s) elegibles; presupuesto ${presupuestoDesc} consulta(s)`);
  for (const g of grupos) {
    if (!descActivo || descLlamadas >= presupuestoDesc) break;
    const vistos = new Set();
    let encontradasSet = 0;
    const maxPag = paginasNecesarias(g, DESCUBRIMIENTO_PAGINAS);
    for (let page = 1; page <= maxPag && descLlamadas < presupuestoDesc; page++) {
      const r = await fetchTCGPagina(g.set, TCG_API_KEY, page);
      descLlamadas++; tcgUsadas++;
      if (!r.ok) {
        console.log(`✗ Descubrimiento "${g.set}" p${page}: ${r.error}`);
        if ([401, 402, 403].includes(r.status)) descActivo = false; // credencial o plan: no seguir gastando
        break;
      }
      if (descLlamadas === 1) console.log(`ℹ Primera consulta de descubrimiento ("${g.set}"): ${r.cards.length} resultado(s), set(s) en la respuesta: ${[...new Set(r.cards.map(c => c.setName))].slice(0, 5).join(" | ")}`);
      const nuevos = r.cards.filter(c => !vistos.has(c.tcgId));
      r.cards.forEach(c => vistos.add(c.tcgId));
      if (page > 1 && !nuevos.length) break; // la API ignora `page`: no hay más que sacar
      const vivas = activas.filter(c => !tcgIdDe(c)); // se empareja con TODAS las que faltan, no solo las del set
      for (const [id, m] of asignarTcgIds(vivas, r.cards)) {
        const carta = porId.get(id);
        parches.set(id, { tcgId: m.tcgId });
        descEncontradas++;
        if (g.cartas.some(c => c.id === id)) encontradasSet++;
        if (m.market && !actualizadas.has(id)) { actualizadas.set(id, snapshotDe(carta, m, "tpl")); descConPrecio++; okCount++; }
      }
      if (r.cards.length < POR_PAGINA) break; // última página del set
      await sleep(BATCH_PAUSA_MS);
    }
    const restantes = g.cartas.filter(c => !tcgIdDe(c)).length;
    estado.sets[g.clave] = actualizarEstadoSet(estado.sets[g.clave], { set: g.set, hoy, encontradas: encontradasSet, restantes });
    setsProbados++;
    setsSinMatchSeguidos = encontradasSet === 0 ? setsSinMatchSeguidos + 1 : 0;
    if (descEncontradas === 0 && setsSinMatchSeguidos >= SIN_MATCH_PARA_APAGAR) {
      console.log(`⚠ ${SIN_MATCH_PARA_APAGAR} sets seguidos sin ningún match: se apaga el descubrimiento en esta corrida (revisar si la búsqueda por set funciona como se supone)`);
      descActivo = false;
    }
  }
  console.log(`✓ Descubrimiento: ${descEncontradas} tcgId nuevo(s) (${descConPrecio} con precio) en ${descLlamadas} consulta(s), ${setsProbados} set(s)`);
  resumen.descubrimiento = { llamadas: descLlamadas, tcgIdNuevos: descEncontradas, conPrecio: descConPrecio, sets: setsProbados };
  guardar("descubrimiento");

  // ── 2. LOTES: todas las cartas con tcgId, de 20 en 20 ──────────────────
  const conTcgId = activas.filter(c => tcgIdDe(c) && !actualizadas.has(c.id)).sort(porPrioridadYEdad);
  let batchLlamadas = 0, batchOk = 0, batchSinPrecio = 0, batchActivo = !!TCG_API_KEY && conTcgId.length > 0;
  console.log(`Por lote: ${conTcgId.length} carta(s) con tcgId (${Math.ceil(conTcgId.length / BATCH_TAMANO)} consulta(s) para todas, tope ${BATCH_MAX_LLAMADAS})`);
  for (let i = 0; batchActivo && i < conTcgId.length && batchLlamadas < BATCH_MAX_LLAMADAS && tcgUsadas < RESERVA_TCG_DIARIA; i += BATCH_TAMANO) {
    const grupo = conTcgId.slice(i, i + BATCH_TAMANO);
    const r = await fetchTCGBatch(grupo.map(tcgIdDe), TCG_API_KEY);
    batchLlamadas++; tcgUsadas++;
    if (batchLlamadas === 1) console.log(`ℹ Primera consulta por lote: HTTP ${r.status}${r.ok ? "" : " " + r.error} | cabeceras de cupo: ${JSON.stringify(r.rate || {})}`);
    if (!r.ok) { console.log(`✗ Por lote falló (${r.error}); se sigue carta por carta`); batchActivo = false; break; }
    for (const carta of grupo) {
      const p = r.porId.get(tcgIdDe(carta));
      if (!p || !p.market) { batchSinPrecio++; continue; }
      actualizadas.set(carta.id, snapshotDe(carta, p, "tpl"));
      batchOk++; okCount++;
    }
    if (batchLlamadas % 10 === 0) guardar("lotes");
    if (i + BATCH_TAMANO < conTcgId.length) await sleep(BATCH_PAUSA_MS);
  }
  console.log(`✓ Por lote: ${batchOk} snapshot(s) con ${batchLlamadas} consulta(s)${batchSinPrecio ? `, ${batchSinPrecio} sin precio en la API (pasan a la rotación)` : ""}`);
  resumen.lotes = { llamadas: batchLlamadas, snapshots: batchOk, sinPrecio: batchSinPrecio, pendientesPorTope: Math.max(0, conTcgId.length - batchOk - batchSinPrecio) };
  guardar("lotes");

  // ── 3. ROTACIÓN individual: lo que sigue sin precio de hoy ──────────────
  const candidatas = activas
    .filter(c => (c.cardId || c.name) && !actualizadas.has(c.id))
    .sort(porPrioridadYEdad)
    .slice(0, CARTAS_POR_CORRIDA);
  console.log(`Procesando ${candidatas.length} carta(s) por búsqueda individual (de ${activas.length} activas)...`);
  for (let i = 0; i < candidatas.length; i++) {
    const carta = candidatas[i];
    if (i > 0) await sleep(POKE_THROTTLE_MS);
    try {
      // El respaldo de tcgpricelookup solo para cartas SIN tcgId (una con tcgId ya se pidió por lote) y mientras
      // quede cupo real en este momento.
      const sinId = !tcgIdDe(carta);
      const permitirFallback = sinId && tcgUsadas < RESERVA_TCG_DIARIA;
      const r = await refreshPrecio(carta, TCG_API_KEY, permitirFallback);
      if (r.usoTcg) tcgUsadas++;
      if (r.market == null) {
        console.log(sinId && !permitirFallback
          ? `⏭ (${i + 1}/${candidatas.length}) ${carta.name}: cupo de tcgpricelookup.com agotado por hoy, se pospone`
          : `✗ (${i + 1}/${candidatas.length}) ${carta.name}: sin precio de ninguna fuente`);
        failCount++;
        if (permitirFallback || !sinId || !TCG_API_KEY) actualizadas.set(carta.id, { tcgIntento: hoy }); // intentada de verdad: pasa al final de la cola
      } else {
        console.log(`✓ (${i + 1}/${candidatas.length}) ${carta.name}: $${r.market} (${r.fuente})`);
        actualizadas.set(carta.id, { ...snapshotDe(carta, r, r.src), ...(r.tcgId && r.tcgId !== tcgIdDe(carta) ? { tcgId: r.tcgId } : {}) });
        okCount++;
      }
    } catch (e) {
      console.error(`✗ (${i + 1}/${candidatas.length}) ${carta.name}: ${e.message}`);
      failCount++;
    }
    if ((i + 1) % GUARDAR_CADA === 0) guardar("rotacion");
  }

  resumen.rotacion = { candidatas: candidatas.length };
  resumen.snapshots = okCount; resumen.fallos = failCount; resumen.consultasTcg = tcgUsadas;
  guardar("final");
  const fin = aplicado().filter(c => c.estado !== "vendida");
  console.log(`✓ ${okCount} snapshot(s) nuevo(s), ${failCount} fallo(s), ${tcgUsadas} consulta(s) a tcgpricelookup.com (${descLlamadas} descubrimiento, ${batchLlamadas} por lote); cartas con tcgId: ${fin.filter(c => c.tcgId).length} de ${fin.length}; sin precio: ${fin.filter(c => !c.tcgMarket).length}`);
}

main().catch(e => { console.error("✗ Error fatal:", e); process.exit(1); });
