// lib/gemini.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Helper reusable para llamar a la API de Gemini (Google AI) desde cualquier
// script de build (build-feed.mjs, build-pokecripto.mjs, etc.). Reemplaza el
// uso puntual de Anthropic API que tenía narrateArchiveSummary -- Gemini se
// usa acá como "la IA del proyecto" por su free tier.
//
// Requiere GEMINI_API_KEY en el entorno del workflow que llame a esto.
//
// Modelo: Google recicla nombres de modelo seguido. gemini-2.0-flash y 1.x se
// dieron de baja, y gemini-2.5-flash responde 404 "no longer available to new
// users" con la key de este proyecto (verificado 2026-10-07 desde Actions de
// ANGSTsongeditor, que usa la misma key). Modelo que SÍ responde: gemini-3.1-flash-lite.
// Cadena de respaldo ante 404/5xx: gemini-flash-latest, gemini-3.5-flash. Para
// probar otro modelo sin tocar código: variable de entorno GEMINI_MODEL.
//
// OJO grounding (useSearch): con el free tier de esta key, las llamadas con
// google_search devuelven 429 (cuota) en TODOS los modelos, mientras que las
// llamadas normales funcionan. Cuando eso pasa callGemini devuelve null y deja
// el motivo en geminiStatus.lastError; quien llama decide el plan B (ver
// lib/melee-narration.mjs: reintenta sin búsqueda y con un prompt más estricto).
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-3.5-flash"];

// Último resultado (para logs/diagnóstico de quien llama). La API key viaja en
// un header, nunca en la URL ni en estos mensajes.
export const geminiStatus = { lastError: null, lastModel: null };

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  const chain = [GEMINI_MODEL, ...FALLBACK_MODELS.filter(m => m !== GEMINI_MODEL)];

  for (const model of chain) {
    // 429/5xx/timeout son reintentables con espera; 404/400/403 no (siguiente modelo).
    for (const waitMs of [0, 3000, 8000]) {
      if (waitMs) await sleep(waitMs);

      let controller, timeoutId;
      if (timeoutMs) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      let res, raw;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: controller?.signal,
        });
        raw = await res.text();
      } catch (e) {
        geminiStatus.lastError = `red/timeout con ${model}: ${e.message}`;
        console.error(`✗ Gemini (${model}) -- error de red${e.name === "AbortError" ? ` (timeout ${timeoutMs}ms)` : ""}: ${e.message}`);
        continue;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (!res.ok) {
        geminiStatus.lastError = `${res.status} con ${model}${useSearch ? " (grounding)" : ""}: ${raw.slice(0, 200)}`;
        console.error(`✗ Gemini (${model}) falló: ${res.status} -- ${raw.slice(0, 300)}`);
        if (res.status === 429 && useSearch) return null; // cuota de grounding: reintentar o cambiar de modelo no sirve
        if (![429, 500, 502, 503, 504].includes(res.status)) break; // 404/400/403 -> siguiente modelo
        continue;
      }

      let data;
      try { data = JSON.parse(raw); } catch (e) {
        geminiStatus.lastError = `no-JSON con ${model}`;
        console.error(`✗ Gemini devolvió algo no-JSON: ${raw.slice(0, 300)}`);
        break;
      }

      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || null;
      if (text) {
        geminiStatus.lastModel = model;
        geminiStatus.lastError = null;
        return text;
      }
      geminiStatus.lastError = `sin texto utilizable con ${model}`;
      console.error(`✗ Gemini (${model}) respondió sin texto utilizable: ${raw.slice(0, 300)}`);
      break;
    }
  }
  return null;
}
