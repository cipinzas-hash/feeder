// build-nutricion.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Arma data/nutricion.json: base offline de alimentos desde USDA FoodData
// Central, restringida a dataType Foundation + SR Legacy (ingredientes crudos
// y preparaciones estándar -- raw/cooked/roasted/boiled/etc.), sin "Branded"
// (productos envasados con marca).
//
// Corre server-side (a diferencia de la búsqueda que antes vivía en el
// cliente): la API de USDA FDC no manda headers CORS, así que un fetch()
// directo desde el navegador siempre fallaba en silencio. Acá no hay
// problema porque esto corre en GitHub Actions, y el resultado se sirve
// como JSON estático (mismo patrón que feed.json/cine.json, vía
// raw.githubusercontent.com que sí manda CORS abierto).
//
// Secret requerido: USDA_API_KEY (gratis, sign-up instantáneo en
// https://fdc.nal.usda.gov/api-key-signup.html).
//
// A diferencia de feed/cine (corren cada 4h), esto se corre en un workflow
// separado con cadencia semanal -- la composición nutricional de un
// alimento no cambia de un día para otro.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";

const USDA_KEY = process.env.USDA_API_KEY;
const OUT_PATH = "data/nutricion.json";
const PAGE_SIZE = 200;
const DATA_TYPES = ["Foundation", "SR Legacy"];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractNutrient(foodNutrients, names, numbers) {
  const list = foodNutrients || [];
  // USDA FDC no es consistente entre endpoints: /food/{id} usa forma anidada
  // (nutrient:{name,number}, valor en "amount"), /foods/search suele usar
  // forma plana (nutrientName, nutrientNumber, valor en "value"). /foods/list
  // no está documentado con certeza -- en vez de asumir una, se reconocen
  // ambas (mismo enfoque que clientes de esta API ya probados en producción).
  function nameOf(n) { return n.nutrient?.name ?? n.nutrientName ?? n.name; }
  function numberOf(n) { return n.nutrient?.number ?? n.nutrientNumber; }
  function valueOf(n) { return n.amount ?? n.value; }

  let hit = list.find(n => names.includes(nameOf(n)));
  if (!hit) hit = list.find(n => numbers.includes(String(numberOf(n))));
  if (!hit) return null;
  const v = valueOf(hit);
  return v == null ? null : v;
}

async function fetchPage(pageNumber, retries = 3) {
  const params = new URLSearchParams();
  params.set("api_key", USDA_KEY);
  params.set("pageSize", String(PAGE_SIZE));
  params.set("pageNumber", String(pageNumber));
  params.set("dataType", DATA_TYPES.join(","));
  const url = `https://api.nal.usda.gov/fdc/v1/foods/list?${params.toString()}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    let res, raw;
    try {
      res = await fetch(url);
      raw = await res.text();
    } catch (networkErr) {
      // Fallo de red (DNS, conexión, timeout) -- transitorio, se reintenta.
      if (attempt === retries) throw new Error(`USDA foods/list falló de red (página ${pageNumber}) tras ${retries} intentos: ${networkErr.message}`);
      const waitMs = 1000 * 3 ** (attempt - 1);
      console.warn(`  [reintento ${attempt}/${retries}] fallo de red en página ${pageNumber}, reintentando en ${waitMs}ms: ${networkErr.message}`);
      await sleep(waitMs);
      continue;
    }

    if (res.ok) {
      let page;
      try { page = JSON.parse(raw); } catch (e) { throw new Error(`USDA foods/list devolvió algo no-JSON (página ${pageNumber}): ${raw.slice(0, 300)}`); }
      if (!Array.isArray(page)) throw new Error(`USDA foods/list devolvió forma inesperada (página ${pageNumber}, no es array): ${raw.slice(0, 300)}`);
      return page;
    }

    // 429 (rate limit) y 5xx (error del lado de USDA) son transitorios y
    // vale la pena reintentar -- esto es justo lo que paso el 22/8 y 24/8
    // (fallos de ~1-4s, mucho antes de completar ni la primera pagina).
    // Cualquier otro codigo (401/403/400, ej. key invalida o mal formada)
    // NO se reintenta: reintentar eso solo demora un fallo inevitable.
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt === retries) {
      throw new Error(`USDA foods/list falló (página ${pageNumber}): ${res.status} -- ${raw.slice(0, 300)}`);
    }
    const waitMs = 1000 * 3 ** (attempt - 1);
    console.warn(`  [reintento ${attempt}/${retries}] USDA devolvió ${res.status} en página ${pageNumber}, reintentando en ${waitMs}ms`);
    await sleep(waitMs);
  }
}

async function main() {
  if (!USDA_KEY) {
    console.error("✗ Falta USDA_API_KEY -- se aborta sin tocar data/nutricion.json");
    process.exit(1);
  }

  console.log(`Bajando base de alimentos USDA FDC (${DATA_TYPES.join(", ")})...`);
  const foods = [];
  let pageNumber = 1;
  while (true) {
    const page = await fetchPage(pageNumber);
    if (!Array.isArray(page) || page.length === 0) break;
    if (pageNumber === 1 && page[0]) {
      console.log("  [diagnóstico] forma cruda del primer item:", JSON.stringify(page[0]).slice(0, 500));
    }
    for (const item of page) {
      const kcal = extractNutrient(item.foodNutrients, ["Energy"], ["208", "957"]);
      const prot = extractNutrient(item.foodNutrients, ["Protein"], ["203"]);
      const carbs = extractNutrient(item.foodNutrients, ["Carbohydrate, by difference"], ["205"]);
      const fat = extractNutrient(item.foodNutrients, ["Total lipid (fat)"], ["204"]);
      if (!item.description || (kcal == null && prot == null)) continue;
      foods.push({
        fdcId: item.fdcId,
        name: item.description,
        kcal: kcal != null ? Math.round(kcal) : 0,
        prot: prot != null ? Math.round(prot * 10) / 10 : 0,
        carbs: carbs != null ? Math.round(carbs * 10) / 10 : null,
        fat: fat != null ? Math.round(fat * 10) / 10 : null,
      });
    }
    console.log(`  página ${pageNumber}: ${page.length} items (total acumulado: ${foods.length})`);
    if (page.length < PAGE_SIZE) break; // última página
    pageNumber++;
    await sleep(150); // cortesía -- 1000/hr de límite, esto pesa ~45 llamadas
  }

  if (foods.length === 0) {
    console.error("✗ La base quedó en 0 alimentos -- esto es anómalo (la API respondió pero sin items utilizables). Se aborta SIN escribir data/nutricion.json, para no publicar un archivo vacío como si fuera un éxito.");
    process.exit(1);
  }

  const output = { generatedAt: new Date().toISOString(), count: foods.length, foods };
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(output));
  console.log(`✓ ${OUT_PATH}: ${foods.length} alimentos (${(JSON.stringify(output).length / 1024).toFixed(0)} KB)`);
}

main().catch(e => { console.error("✗ build-nutricion.mjs falló:", e.message); process.exit(1); });
