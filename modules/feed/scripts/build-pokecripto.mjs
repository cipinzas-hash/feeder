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
//   3. BÚSQUEDA INDIVIDUAL: las cartas que aún no tienen tcgId se buscan una por una en la misma API (nombre + número),
//      mientras quede cupo. Cada búsqueda da el tcgId y el precio, y cosecha los ids de otras cartas del inventario que
//      aparezcan en los mismos resultados. Las que se registraron hace poco y aún no tienen ningún precio de esta
//      fuente van primero, para que su precio se corrija en el snapshot siguiente al de su alta.
// UNA SOLA FUENTE (decisión del 15-oct-2026): el bot guarda SOLO precios de tcgpricelookup.com (src "tpl", la fuente
// de las 100 consultas diarias). pokemontcg.io ya no interviene acá: lo usa el cliente una vez, al agregar una carta,
// para darle su primer precio; el primer snapshot del bot lo corrige y desde entonces el historial es de la misma fuente.
// Antes el bot alternaba entre las dos y las cartas mostraban saltos falsos (0,06 -> 0,26 -> 0,06).
// Robustez: se guarda a disco cada GUARDAR_CADA cartas y ante SIGTERM (timeout del workflow), y el resumen de la
// corrida queda en pokecripto-estado.json (los logs completos de Actions no son legibles desde fuera).

import { readFileSync, writeFileSync } from "node:fs";
import { fetchTCGBatch, addSnapshot, compactarHistorial } from "../../pokecripto/lib/pricing.mjs";
import { aplicarOverrides, normalizarOverridesRemotos, fusionarPending, prioridadCarta } from "../../pokecripto/lib/review.mjs";
import { fetchTCGPagina, fetchTCGSets, fetchTCGSetPagina, slugParaSet, paginasDeSet, claveCarta, PAUSA_RAFAGA_MS, asignarTcgIds, agruparPorSet, debeSaltarse, actualizarEstadoSet, presupuestoDescubrimiento, sumarDias, cupoRestante } from "../../pokecripto/lib/discovery.mjs";

const INVENTARIO_PATH = process.env.POKECRIPTO_INVENTARIO_PATH;
const PENDING_PATH = process.env.POKECRIPTO_PENDING_PATH;
const OVERRIDES_PATH = process.env.POKECRIPTO_OVERRIDES_PATH || null;
const ESTADO_PATH = process.env.POKECRIPTO_ESTADO_PATH || null;   // resumen + memoria del descubrimiento por set
const MERGED_PATH = process.env.POKECRIPTO_MERGED_PATH || null;   // ids fusionados desde pending (lo lee el reconcile)
const TCG_API_KEY = process.env.TCG_API_KEY || null;

// ── Presupuestos ────────────────────────────────────────────────────────
// Tope propio de consultas diarias a tcgpricelookup.com (cupo real del plan Free: 100). 85 deja 15 para el uso
// manual del cliente, que ahora es barato (el buscador ya no consulta 24 cartas por búsqueda).
const RESERVA_TCG_DIARIA = 85;
const BATCH_TAMANO = 20;          // máximo de ids por consulta de la API
const BATCH_MAX_LLAMADAS = 70;    // 70 x 20 = 1400 tcgId distintos por corrida (issue #27: antes 65 = 1300, el inventario ya pasa de 1300 filas)
const BATCH_PAUSA_MS = Number(process.env.POKECRIPTO_PAUSA_MS ?? 1500);  // la API limita la ráfaga a 1 consulta a la vez (diag. 26-oct-2026); las pruebas la bajan a 0
// Descubrimiento por set REACTIVADO (26-oct-2026, issue #27). Estaba apagado porque consultaba `q=<nombre del set>` (texto libre:
// devolvía productos sellados). El diagnóstico en Actions (docs/diag-tcg.json) confirmó que la API tiene `set=<slug>` +
// `limit`/`offset` y una lista de sets (/sets); cada carta viene en una fila por variante (Normal/Holofoil/Reverse), que
// elegirVariante() resuelve. Sin salida directa a la API desde el sandbox, la primera corrida real es la prueba: si 3 sets
// seguidos no emparejan nada se apaga solo (ver más abajo) y el diagnóstico queda en pokecripto-estado.json.
const DESCUBRIMIENTO_TOPE = Number(process.env.POKECRIPTO_DESCUBRIMIENTO_TOPE ?? 60);
const DESCUBRIMIENTO_PAGINAS = 10; // páginas máximas por set (el `count` de la API incluye variantes y sellados: Ascended Heroes ~800)
const DIAS_CACHE_SETS = 7;         // la lista de sets se vuelve a pedir cada 7 días (aparecen sets nuevos)
const RESERVA_INDIVIDUAL = 8;     // consultas que se guardan para búsquedas carta por carta
const GUARDAR_CADA = 25;
const CUPO_MANUAL = 10;           // si la API dice que quedan <=10 consultas reales, el bot se detiene (son para el uso manual)
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

  if (fus.bajas) console.log(`✓ ${fus.bajas} baja(s) aplicada(s) desde pending`);
  // Compactación del historial (pedido de Cristopher 25-oct-2026): ver compactarHistorial en pricing.mjs. Idempotente.
  let compactados = 0;
  for (const c of base) {
    const h = c.priceHistory;
    if (Array.isArray(h) && h.length > 1) { const n = compactarHistorial(h, hoy); if (n.length !== h.length) { compactados += h.length - n.length; c.priceHistory = n; } }
  }
  if (compactados) console.log(`✓ Historial compactado: ${compactados} snapshot(s) menos`);
  const tomados = new Map(); // tcgId -> cardId que lo tiene (guarda: un tcgId es una carta de un set)
  for (const c of base) if (c.tcgId) tomados.set(c.tcgId, claveCarta(c));
  const actualizadas = new Map(); // id -> campos de precio / intento de HOY
  const parches = new Map();      // id -> { tcgId } descubierto (puede no traer precio)
  const porId = new Map(base.map(c => [c.id, c]));
  const tcgIdDe = c => parches.get(c.id)?.tcgId || c.tcgId || null;
  const activas = base.filter(c => c.estado !== "vendida");
  // Cupo: el contador es POR DÍA (UTC), no por corrida, así dos corridas el mismo día (la programada + una manual) no
  // se pasan del cupo real; además se lee el cupo que reporta la API en las cabeceras cuando las manda.
  let tcgUsadas = estado.cupoDia && estado.cupoDia.fecha === hoy ? (estado.cupoDia.usadas || 0) : 0;
  let restanteReal = null, okCount = 0, failCount = 0;
  let cabecerasCupo = null;
  const registrarCupo = rate => { const v = cupoRestante(rate); if (v != null) restanteReal = v; if (rate && Object.keys(rate).length) cabecerasCupo = rate; };
  const hayCupo = () => tcgUsadas < RESERVA_TCG_DIARIA && (restanteReal == null || restanteReal > CUPO_MANUAL);
  console.log(`Cupo: ${tcgUsadas} consulta(s) ya usadas hoy (tope propio ${RESERVA_TCG_DIARIA})`);

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
      estado.cupoDia = { fecha: hoy, usadas: tcgUsadas };
      estado.ultimaCorrida = {
        ...resumen, fecha: hoy, guardadoPor: motivo, cupoRestanteApi: restanteReal, cabecerasCupo,
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
    priceHistory: compactarHistorial(addSnapshot(carta.priceHistory, m.market, m.low ?? null, m.high ?? null, hoy, src), hoy),
  });

  // ── 1. DESCUBRIMIENTO de tcgId por set (set=<slug>) ───────────────────
  const sinTcgId = activas.filter(c => !tcgIdDe(c));
  const presupuestoDesc = TCG_API_KEY ? presupuestoDescubrimiento({
    reserva: Math.max(0, RESERVA_TCG_DIARIA - tcgUsadas), cartasConTcgId: activas.length - sinTcgId.length, batchTam: BATCH_TAMANO,
    batchMax: BATCH_MAX_LLAMADAS, reservaIndividual: RESERVA_INDIVIDUAL, tope: DESCUBRIMIENTO_TOPE, sinTcgId: sinTcgId.length,
  }) : 0;
  let descLlamadas = 0, descEncontradas = 0, descConPrecio = 0, setsProbados = 0, setsSinMatchSeguidos = 0, descActivo = presupuestoDesc > 0;
  if (estado.descubrimientoSetApagadoHasta && hoy < estado.descubrimientoSetApagadoHasta) {
    console.log(`ℹ Descubrimiento por set apagado hasta ${estado.descubrimientoSetApagadoHasta} (no emparejó nada la última vez); la búsqueda carta por carta cosecha ids igual`);
    descActivo = false;
  }
  let setsApi = estado.setsApi?.fecha && estado.setsApi.lista?.length && sumarDias(estado.setsApi.fecha, DIAS_CACHE_SETS) > hoy ? estado.setsApi.lista : null;
  if (descActivo && !setsApi) {
    const rs = await fetchTCGSets(TCG_API_KEY);
    descLlamadas += rs.llamadas; tcgUsadas += rs.llamadas; registrarCupo(rs.rate);
    if (rs.ok && rs.sets.length) { setsApi = rs.sets; estado.setsApi = { fecha: hoy, lista: rs.sets }; console.log(`✓ Lista de sets de la API: ${rs.sets.length} set(s) en ${rs.llamadas} consulta(s)`); }
    else { console.log(`✗ No se pudo leer la lista de sets (${rs.error || "vacía"}); sin descubrimiento hoy`); descActivo = false; }
  }
  const sinSlug = [];
  const trabajo = [];
  let diagListo = false;
  if (descActivo && setsApi) {
    for (const g of agruparPorSet(sinTcgId).filter(g => !debeSaltarse(estado.sets[g.clave], hoy))) {
      const api = slugParaSet(g.set, setsApi);
      if (!api) { sinSlug.push(g.set); continue; }
      trabajo.push({ g, api, pags: Math.min(DESCUBRIMIENTO_PAGINAS, paginasDeSet(api)) });
    }
    const urg = t => t.g.cartas.some(c => c.carpeta === "Price Watch") ? 1 : 0;
    trabajo.sort((a, b) => urg(b) - urg(a) || (b.g.cartas.length / b.pags) - (a.g.cartas.length / a.pags)); // más cartas por consulta primero
  }
  estado.setsSinSlug = sinSlug;
  console.log(`Descubrimiento: ${sinTcgId.length} carta(s) sin tcgId; ${trabajo.length} set(s) con slug${sinSlug.length ? `, ${sinSlug.length} sin slug (${sinSlug.slice(0, 5).join(" | ")}${sinSlug.length > 5 ? "…" : ""})` : ""}; presupuesto ${presupuestoDesc} consulta(s)`);
  for (const t of trabajo) {
    if (!descActivo || !hayCupo()) break;
    if (descLlamadas + t.pags > presupuestoDesc) continue; // no entra entero en lo que queda: se prueba con un set más chico
    const { g, api } = t;
    const filas = []; let completo = true, totalApi = null;
    for (let off = 0, pag = 0; pag < t.pags; pag++, off += 100) {
      await sleep(PAUSA_RAFAGA_MS);
      const r = await fetchTCGSetPagina(api.slug, TCG_API_KEY, off);
      descLlamadas++; tcgUsadas++; registrarCupo(r.rate);
      if (!diagListo) { diagListo = true; estado.diagnosticoDescubrimiento = { fecha: hoy, set: api.slug, ok: r.ok, status: r.status ?? null, error: r.error || null, filas: r.cards?.length ?? 0, total: r.total ?? null }; }
      if (!r.ok) {
        console.log(`✗ Descubrimiento "${g.set}" (${api.slug}) offset ${off}: ${r.error}`);
        if ([401, 402, 403].includes(r.status)) descActivo = false;
        if (r.status === 429) restanteReal = restanteReal ?? 0;
        completo = false; break;
      }
      totalApi = r.total;
      const nuevos = r.cards.filter(c => !filas.some(f => f.tcgId === c.tcgId));
      filas.push(...nuevos);
      if (!nuevos.length || r.cards.length < 100) break; // última página (o la API ignoró offset)
    }
    if (!completo) continue; // sin todas las variantes a la vista no se asigna (una carta podría quedar con solo la Reverse)
    let encontradasSet = 0;
    const vivas = g.cartas.filter(c => !tcgIdDe(c));
    for (const [id, m] of asignarTcgIds(vivas, filas, { setSeguro: true, tomados })) {
      const carta = porId.get(id);
      parches.set(id, { tcgId: m.tcgId });
      descEncontradas++; encontradasSet++;
      if (m.market && !actualizadas.has(id)) { actualizadas.set(id, snapshotDe(carta, m, "tpl")); descConPrecio++; okCount++; }
    }
    const restantes = g.cartas.filter(c => !tcgIdDe(c)).length;
    console.log(`  ${g.set} (${api.slug}): ${encontradasSet}/${g.cartas.length} emparejada(s), ${filas.length} fila(s) de la API${totalApi != null ? ` de ${totalApi}` : ""}`);
    estado.sets[g.clave] = actualizarEstadoSet(estado.sets[g.clave], { set: g.set, hoy, encontradas: encontradasSet, restantes });
    setsProbados++;
    setsSinMatchSeguidos = encontradasSet === 0 ? setsSinMatchSeguidos + 1 : 0;
    if (descEncontradas === 0 && setsSinMatchSeguidos >= SIN_MATCH_PARA_APAGAR) {
      console.log(`⚠ ${SIN_MATCH_PARA_APAGAR} sets seguidos sin ningún match: se apaga el descubrimiento por set 7 días (ver diagnosticoDescubrimiento en pokecripto-estado.json)`);
      estado.descubrimientoSetApagadoHasta = sumarDias(hoy, 7);
      descActivo = false;
    }
    if (setsProbados % 5 === 0) guardar("descubrimiento");
  }
  if (descEncontradas > 0) delete estado.descubrimientoSetApagadoHasta;
  console.log(`✓ Descubrimiento: ${descEncontradas} tcgId nuevo(s) (${descConPrecio} con precio) en ${descLlamadas} consulta(s), ${setsProbados} set(s)`);
  resumen.descubrimiento = { llamadas: descLlamadas, tcgIdNuevos: descEncontradas, conPrecio: descConPrecio, sets: setsProbados, setsSinSlug: sinSlug.length };
  resumen.compactados = compactados; resumen.bajas = fus.bajas || 0;
  guardar("descubrimiento");

  // ── 2. LOTES: todas las cartas con tcgId, de 20 en 20 ──────────────────
  const conTcgId = activas.filter(c => tcgIdDe(c) && !actualizadas.has(c.id)).sort(porPrioridadYEdad);
  // Una consulta por tcgId DISTINTO (issue #27): la misma carta en varias colecciones comparte tcgId y antes ocupaba un lugar de lote
  // por fila. Se conserva el orden de prioridad (Price Watch / más viejas) y el resultado se aplica a todas las filas del tcgId.
  const filasPorTcg = new Map();
  for (const c of conTcgId) { const t = tcgIdDe(c); if (!filasPorTcg.has(t)) filasPorTcg.set(t, []); filasPorTcg.get(t).push(c); }
  const idsUnicos = [...filasPorTcg.keys()];
  let batchLlamadas = 0, batchOk = 0, batchSinPrecio = 0, batchActivo = !!TCG_API_KEY && idsUnicos.length > 0;
  console.log(`Por lote: ${conTcgId.length} fila(s) con tcgId, ${idsUnicos.length} tcgId distinto(s) (${Math.ceil(idsUnicos.length / BATCH_TAMANO)} consulta(s) para todos, tope ${BATCH_MAX_LLAMADAS})`);
  for (let i = 0; batchActivo && i < idsUnicos.length && batchLlamadas < BATCH_MAX_LLAMADAS && hayCupo(); i += BATCH_TAMANO) {
    const grupoIds = idsUnicos.slice(i, i + BATCH_TAMANO);
    const r = await fetchTCGBatch(grupoIds, TCG_API_KEY);
    batchLlamadas++; tcgUsadas++; registrarCupo(r.rate);
    if (batchLlamadas === 1) console.log(`ℹ Primera consulta por lote: HTTP ${r.status}${r.ok ? "" : " " + r.error} | cabeceras de cupo: ${JSON.stringify(r.rate || {})}`);
    if (!r.ok) { console.log(`✗ Por lote falló (${r.error}); se sigue carta por carta`); batchActivo = false; break; }
    for (const t of grupoIds) {
      const p = r.porId.get(t);
      for (const carta of filasPorTcg.get(t)) {
        if (!p || !p.market) { batchSinPrecio++; continue; }
        actualizadas.set(carta.id, snapshotDe(carta, p, "tpl"));
        batchOk++; okCount++;
      }
    }
    if (batchLlamadas % 10 === 0) guardar("lotes");
    if (i + BATCH_TAMANO < idsUnicos.length) await sleep(BATCH_PAUSA_MS);
  }
  console.log(`✓ Por lote: ${batchOk} snapshot(s) con ${batchLlamadas} consulta(s)${batchSinPrecio ? `, ${batchSinPrecio} sin precio en la API (pasan a la rotación)` : ""}`);
  resumen.lotes = { llamadas: batchLlamadas, snapshots: batchOk, sinPrecio: batchSinPrecio, pendientesPorTope: Math.max(0, conTcgId.length - batchOk - batchSinPrecio) };
  guardar("lotes");

  // ── 3. BÚSQUEDA individual (solo tcgpricelookup): cartas sin tcgId ───────
  // Primero Price Watch; luego las que NO tienen ningún snapshot de esta fuente (altas recientes: su precio vino de
  // pokemontcg.io y debe corregirse cuanto antes); luego las menos recientes.
  const sinTpl = c => !(c.priceHistory || []).some(h => h.src === "tpl");
  const porPrioridadSinTplEdad = (a, b) => prioridadCarta(a) - prioridadCarta(b) || (sinTpl(b) - sinTpl(a)) || claveEdad(a).localeCompare(claveEdad(b));
  const candidatas = activas.filter(c => c.name && !tcgIdDe(c) && !actualizadas.has(c.id)).sort(porPrioridadSinTplEdad);
  console.log(`Búsqueda individual: ${candidatas.length} carta(s) sin tcgId; cupo para ${TCG_API_KEY ? Math.max(0, RESERVA_TCG_DIARIA - tcgUsadas) : 0} consulta(s) más`);
  let cosechadas = 0, busquedasTcg = 0, resueltas = 0, sinResolver = 0;
  for (let i = 0; i < candidatas.length; i++) {
    if (!TCG_API_KEY || !hayCupo()) break;
    const carta = candidatas[i];
    if (actualizadas.has(carta.id) || tcgIdDe(carta)) continue; // ya resuelta como cosecha de una búsqueda anterior
    const ov = carta.tcgOverride;
    const q = ov ? `${ov.name} ${ov.number}` : (carta.number ? `${carta.name} ${carta.number}` : carta.name);
    try {
      const r = await fetchTCGPagina(q, TCG_API_KEY, 1);
      tcgUsadas++; busquedasTcg++; registrarCupo(r.rate);
      if (!r.ok) {
        console.log(`✗ (${i + 1}/${candidatas.length}) ${carta.name}: búsqueda ${r.error}`);
        if (r.status === 429) { restanteReal = 0; break; } // cupo agotado de verdad: nada más por hoy
        failCount++; continue;
      }
      for (const [id, m] of asignarTcgIds(activas.filter(c => !tcgIdDe(c)), r.cards, { tomados })) {
        parches.set(id, { tcgId: m.tcgId });
        if (id !== carta.id) cosechadas++;
        if (m.market && !actualizadas.has(id)) { actualizadas.set(id, snapshotDe(porId.get(id), m, "tpl")); okCount++; }
      }
      if (actualizadas.has(carta.id)) { resueltas++; console.log(`✓ (${i + 1}/${candidatas.length}) ${carta.name}: $${actualizadas.get(carta.id).tcgMarket}`); }
      else if (tcgIdDe(carta)) { resueltas++; console.log(`✓ (${i + 1}/${candidatas.length}) ${carta.name}: tcgId guardado, sin precio en la API (entra a los lotes desde mañana)`); }
      else { sinResolver++; failCount++; actualizadas.set(carta.id, { tcgIntento: hoy }); console.log(`✗ (${i + 1}/${candidatas.length}) ${carta.name}: no apareció en la API; pasa al final de la cola`); }
    } catch (e) {
      console.error(`✗ (${i + 1}/${candidatas.length}) ${carta.name}: ${e.message}`);
      failCount++;
    }
    if (busquedasTcg % GUARDAR_CADA === 0) guardar("busqueda");
    await sleep(BATCH_PAUSA_MS);
  }
  resumen.busqueda = { candidatas: candidatas.length, consultas: busquedasTcg, resueltas, sinResolver, idsCosechadosDeOtras: cosechadas };
  resumen.snapshots = okCount; resumen.fallos = failCount; resumen.consultasTcg = tcgUsadas;
  guardar("final");
  const fin = aplicado().filter(c => c.estado !== "vendida");
  console.log(`✓ ${okCount} snapshot(s) nuevo(s), ${failCount} fallo(s), ${tcgUsadas} consulta(s) a tcgpricelookup.com (${descLlamadas} descubrimiento, ${batchLlamadas} por lote, ${busquedasTcg} individuales); cartas con tcgId: ${fin.filter(c => c.tcgId).length} de ${fin.length}; sin precio: ${fin.filter(c => !c.tcgMarket).length}`);
}

main().catch(e => { console.error("✗ Error fatal:", e); process.exit(1); });
