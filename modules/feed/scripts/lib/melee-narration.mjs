// lib/melee-narration.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Narración del resumen de un torneo de Melee con Gemini. Compartido por
// build-melee.mjs (al archivar un torneo) y regen-melee-summaries.mjs
// (regeneración retroactiva de los ya archivados).
//
// Plan A: con búsqueda web (grounding) para contexto histórico real.
// Plan B: si el grounding no está disponible (cuota del free tier: 429), se
// narra SOLO con los datos entregados y un prompt que prohíbe agregar contexto
// que no esté ahí -- resumen más plano pero sin datos inventados.
// Devuelve null si Gemini no responde en ningún plan (el llamador conserva el
// resumen mecánico).
// ─────────────────────────────────────────────────────────────────────────────
import { callGemini, geminiStatus } from "./gemini.mjs";

export function buildNarrationPrompt({ tournamentName, datos, grounded }) {
  const contexto = grounded
    ? `Usá la búsqueda web para confirmar contexto real: rachas, primera vez que X le gana a Y, importancia de un resultado dentro de la temporada, etc. -- SOLO si lo podés confirmar con una fuente real. Si no encontrás contexto verificable para un upset, simplemente describilo sin inventar superlativos ("primera vez", "el único", "el más joven en...") sin haberlo confirmado. Es preferible un resumen más plano y correcto que uno rico pero con datos inventados.`
    : `NO tenés acceso a búsqueda web en este momento: usá EXCLUSIVAMENTE los datos de arriba. No agregues contexto histórico, rachas, "primera vez", "el único", récords, personajes jugados ni resultados de otros torneos que no estén en esos datos. Es preferible un resumen más plano y correcto que uno rico pero con datos inventados.`;
  return `Redactá el resumen de resultado final de un torneo de Super Smash Bros. Melee, en español, en prosa narrativa -- NO como una lista de posiciones ("1° X · 2° Y · 3° Z"), sino contando cómo se dio el resultado. Un ejemplo del tono buscado (dos o tres oraciones, standings integrados a la narración + upsets con contexto real):

"Hungrybox se quedó con el título tras remontarle la gran final a Cody Schwab, que había llegado invicto desde winners. Wizzrobe completó el podio en tercer lugar. Entre los resultados más sorprendentes: lloD sorprendió a Hungrybox en un reverse 3-0 que lo mandó directo a Top 8 -- su primera victoria sobre él --, y Kola, entrando como seed 72, llegó hasta noveno lugar derrotando a Maher, Drephen, Zuppy y SluG en el camino."

Nombres SIN el tag de equipo/sponsor (solo el nombre de jugador, ya vienen así abajo -- no los reconstruyas con equipo).

Torneo: ${tournamentName}
${datos}

${contexto}

Devolvé SOLO el texto del resumen final en prosa, sin preámbulo, sin markdown, sin comillas.`;
}

export async function narrateResult(tournamentName, datos) {
  let texto = await callGemini(
    buildNarrationPrompt({ tournamentName, datos, grounded: true }),
    { useSearch: true, maxOutputTokens: 1024, timeoutMs: 90000 }
  );
  if (!texto) {
    console.log(`  · sin grounding (${geminiStatus.lastError || "sin detalle"}) -- narrando solo con los datos del torneo`);
    texto = await callGemini(
      buildNarrationPrompt({ tournamentName, datos, grounded: false }),
      { maxOutputTokens: 1024, timeoutMs: 90000 }
    );
  }
  return texto ? texto.trim() : null;
}
