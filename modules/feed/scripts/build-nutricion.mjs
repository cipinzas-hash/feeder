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
  let hit = list.find(n => names.includes(n.nutrientName));
  if (!hit) hit = list.find(n => numbers.includes(String(n.nutrientNumber)));
  return hit ? hit.value : null;
}

async function fetchPage(pageNumber) {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/list?api_key=${USDA_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataType: DATA_TYPES, pageSize: PAGE_SIZE, pageNumber }),
  });
  if (!res.ok) throw new Error(`USDA foods/list falló (página ${pageNumber}): ${res.status}`);
  return res.json();
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

  const output = { generatedAt: new Date().toISOString(), count: foods.length, foods };
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(output));
  console.log(`✓ ${OUT_PATH}: ${foods.length} alimentos (${(JSON.stringify(output).length / 1024).toFixed(0)} KB)`);
}

main().catch(e => { console.error("✗ build-nutricion.mjs falló:", e.message); process.exit(1); });
