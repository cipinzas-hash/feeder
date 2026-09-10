// build-pokecripto.mjs (issue #9)
// Corre vía GitHub Action una vez al día (update-pokecripto.yml), separado
// de cualquier otro job -- lee/escribe directo en Angst-data (checkout
// aparte), nada de esto vive en Mega ni en el repo público feeder.
//
// Fuente de verdad: pokecripto-inventario.json en Angst-data (canónico,
// solo este script lo reescribe completo). pokecripto-pending.json es la
// cola de altas nuevas que encola el cliente (carta agregada a mano, o
// descubierta por el resync de Dark Collection) -- se fusiona al canónico
// al principio de cada corrida y se vacía. Una carta recién fusionada
// entra con tcgUpdated=null, así que cae naturalmente al principio de la
// cola de "más antiguas" sin necesitar lógica de prioridad aparte.
//
// Política (issue #9): ordenar TODAS las cartas activas por antigüedad de
// snapshot, tomar las 300 más viejas (ver CARTAS_POR_CORRIDA más abajo,
// subido de 100 el 9-sep-2026), consultar, snapshot, persistir. Una
// carta actualizada pasa al final de la cola para la próxima corrida.
//
// Presupuesto de API: pokemontcg.io (gratis, sin key) va primero y cubre
// casi todo el inventario real (todo lo que tiene cardId, incluida Dark
// Collection). tcgpricelookup.com es únicamente el respaldo para cartas
// sin cardId (alta manual sin vincular) -- tiene cupo real de 100/día en
// el plan Free, así que el bot se reserva un tope propio más chico
// (RESERVA_TCG_DIARIA) para dejar margen al uso manual del botón de
// refrescar precio en el cliente.

import { readFile, writeFile } from "node:fs/promises";
import { refreshPrecio } from "../../pokecripto/lib/pricing.mjs";

const INVENTARIO_PATH = process.env.POKECRIPTO_INVENTARIO_PATH;
const PENDING_PATH = process.env.POKECRIPTO_PENDING_PATH;
const TCG_API_KEY = process.env.TCG_API_KEY || null;

// Con el throttle de POKE_THROTTLE_MS (más abajo) y timeout-minutes:20 del
// workflow, el presupuesto de tiempo real de una corrida permite bastante
// más que 100 cartas: ~3.7-4.2s por carta (throttle + latencia real de red)
// x 300 cartas ≈ 18-21 min, todavía dentro del margen. Se sube de 100 a 300
// (9-sep-2026, Cristopher pidió maximizar cobertura ya que pokemontcg.io es
// gratis) -- con esto el inventario activo de hoy (128) entra ENTERO en una
// sola corrida diaria, todos los días, en vez de ir rotando entre corridas.
// Si el inventario crece bastante más allá de ~250-280 cartas activas, esta
// cuenta hay que rehacerla (subir timeout-minutes, o recién ahí sí
// considerar correr más de una vez al día).
const CARTAS_POR_CORRIDA = 300;
const RESERVA_TCG_DIARIA = 80; // de 100 reales -- margen para uso manual

if (!INVENTARIO_PATH || !PENDING_PATH) {
  console.error("✗ Faltan POKECRIPTO_INVENTARIO_PATH / POKECRIPTO_PENDING_PATH (rutas al checkout de Angst-data)");
  process.exit(1);
}

async function readJsonSafe(path, fallback) {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    console.log(`⚠ No se pudo leer ${path} (${e.message}), usando ${JSON.stringify(fallback)}`);
    return fallback;
  }
}

// pokemontcg.io sin API key: 20 requests/minuto. Sin ninguna pausa entre
// llamadas, un loop de hasta 100 cartas agota ese cupo a los ~20-25
// segundos -- coincide exactamente con el patrón real observado (siempre
// ~24-26 cartas actualizadas por día, nunca cerca de las 100 candidatas).
// 3.2s entre cartas = ~18.75 req/min, con margen bajo el límite real.
const POKE_THROTTLE_MS = 3200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const inventario = await readJsonSafe(INVENTARIO_PATH, []);
  const pending = await readJsonSafe(PENDING_PATH, []);

  // 1. Fusionar pendientes -- por id, sin duplicar si por algún motivo
  // una carta ya estaba (ej. reintento de una corrida anterior que no
  // llegó a vaciar pending).
  const idsExistentes = new Set(inventario.map(c => c.id));
  const nuevas = pending.filter(c => !idsExistentes.has(c.id));
  const inventarioFusionado = [...inventario, ...nuevas];
  if (nuevas.length) console.log(`✓ ${nuevas.length} carta(s) nueva(s) fusionada(s) desde pending`);

  // 2. Ordenar por antigüedad de snapshot (tcgUpdated null = más viejo
  // posible, entra primero) y tomar las CARTAS_POR_CORRIDA más viejas. "vendida" no
  // participa -- ya no es inventario activo.
  const candidatas = inventarioFusionado
    .filter(c => c.estado !== "vendida" && (c.cardId || c.name))
    .sort((a, b) => (a.tcgUpdated || "2000-01-01").localeCompare(b.tcgUpdated || "2000-01-01"))
    .slice(0, CARTAS_POR_CORRIDA);

  console.log(`Procesando ${candidatas.length} carta(s) (de ${inventarioFusionado.length} activas)...`);

  let tcgUsadas = 0;
  let okCount = 0, failCount = 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const actualizadas = new Map();

  for (let i = 0; i < candidatas.length; i++) {
    const carta = candidatas[i];
    if (i > 0) await sleep(POKE_THROTTLE_MS); // ver nota de POKE_THROTTLE_MS arriba
    try {
      // Presupuesto de tcgpricelookup.com agotado -- no aborta la corrida,
      // simplemente esta carta puntual (y las que sigan necesitando
      // fallback) esperan a la corrida de mañana. pokemontcg.io sigue
      // disponible sin restricción.
      const necesitaFallbackSiFalla = !carta.cardId;
      if (necesitaFallbackSiFalla && tcgUsadas >= RESERVA_TCG_DIARIA) {
        console.log(`⏭ (${i + 1}/${candidatas.length}) ${carta.name}: sin cardId y cupo de tcgpricelookup.com agotado por hoy, se pospone`);
        continue;
      }
      const { market, low, high, fuente } = await refreshPrecio(carta, TCG_API_KEY);
      if (fuente === "tcgpricelookup") tcgUsadas++;
      if (market == null) {
        console.log(`✗ (${i + 1}/${candidatas.length}) ${carta.name}: sin precio de ninguna fuente`);
        failCount++;
        continue;
      }
      console.log(`✓ (${i + 1}/${candidatas.length}) ${carta.name}: $${market} (${fuente})`);
      const newHist = [...(carta.priceHistory || [])];
      const idx = newHist.length && newHist[newHist.length - 1].date === hoy ? newHist.length - 1 : -1;
      const snap = { date: hoy, market, low: low || null, high: high || null };
      if (idx >= 0) newHist[idx] = snap; else newHist.push(snap);
      actualizadas.set(carta.id, { tcgMarket: market, tcgLow: low, tcgHigh: high, tcgUpdated: hoy, priceHistory: newHist });
      okCount++;
    } catch (e) {
      console.error(`✗ (${i + 1}/${candidatas.length}) ${carta.name}: ${e.message}`);
      failCount++;
    }
  }

  const inventarioFinal = inventarioFusionado.map(c => actualizadas.has(c.id) ? { ...c, ...actualizadas.get(c.id) } : c);

  await writeFile(INVENTARIO_PATH, JSON.stringify(inventarioFinal, null, 2));
  await writeFile(PENDING_PATH, JSON.stringify([], null, 2)); // vaciar, ya se fusionó todo

  console.log(`✓ ${okCount} snapshot(s) nuevo(s), ${failCount} fallo(s), ${tcgUsadas} consulta(s) a tcgpricelookup.com`);
}

main();
