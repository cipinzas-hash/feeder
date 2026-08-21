// lib/gemini.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Helper reusable para llamar a la API de Gemini (Google AI) desde cualquier
// script de build (build-feed.mjs, build-nutricion.mjs, etc.). Reemplaza el
// uso puntual de Anthropic API que tenía narrateArchiveSummary -- Gemini se
// usa acá como "la IA del proyecto" por su free tier.
//
// Requiere GEMINI_API_KEY en el entorno del workflow que llame a esto.
//
// Modelo: Google recicla nombres de modelo seguido -- Gemini 2.0 Flash se dio
// de baja en jun-2026, Gemini 1.x ya devuelve 404. gemini-2.5-flash es el
// estable documentado en ai.google.dev al momento de escribir esto
// (2026-08-21). Si esto empieza a devolver 404 con "model not found", revisar
// https://ai.google.dev/gemini-api/docs/models y actualizar GEMINI_MODEL acá
// o vía la variable de entorno del mismo nombre (no hace falta tocar código
// para probar un modelo nuevo).
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Contrato: nunca tira excepción. Devuelve el texto generado, o null si algo
// falló (sin key, HTTP no-ok, respuesta sin texto utilizable) -- el llamador
// decide qué hacer con null (típicamente: caer a un fallback mecánico, no
// romper el build entero por un problema de la IA).
export async function callGemini(prompt, { systemInstruction, temperature, maxOutputTokens, useSearch, timeoutMs } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
  if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };
  const genConfig = {};
  if (temperature != null) genConfig.temperature = temperature;
  if (maxOutputTokens != null) genConfig.maxOutputTokens = maxOutputTokens;
  if (Object.keys(genConfig).length) body.generationConfig = genConfig;
  // Grounding con Google Search -- el modelo decide solo cuándo buscar.
  // No se puede combinar con function calling en el mismo request (no lo
  // usamos acá, así que no aplica).
  if (useSearch) body.tools = [{ google_search: {} }];

  let controller, timeoutId;
  if (timeoutMs) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  let res, raw;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    raw = await res.text();
  } catch (e) {
    console.error(`✗ Gemini (${GEMINI_MODEL}) -- error de red${e.name === "AbortError" ? ` (timeout ${timeoutMs}ms)` : ""}: ${e.message}`);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!res.ok) {
    console.error(`✗ Gemini (${GEMINI_MODEL}) falló: ${res.status} -- ${raw.slice(0, 300)}`);
    return null;
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error(`✗ Gemini devolvió algo no-JSON: ${raw.slice(0, 300)}`);
    return null;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || null;
  if (!text) console.error(`✗ Gemini (${GEMINI_MODEL}) respondió sin texto utilizable: ${raw.slice(0, 300)}`);
  return text;
}
