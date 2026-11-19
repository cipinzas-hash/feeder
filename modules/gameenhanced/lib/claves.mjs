// ─── Claves de títulos del registro de Game enhanced (puro: lo usan el módulo y el pipeline) ────
// Un juego del registro se identifica por su título normalizado: "r-" + clave. El pipeline guarda las
// fichas de IGDB bajo ese mismo id, así que cliente y bot tienen que calcularlo igual.
export const ESTADOS_REGISTRO = ["terminado", "quiero", "pendiente"];

export function claveTitulo(titulo) {
  const t = String(titulo || "").trim();
  const n = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n.length >= 2) return n;
  // Títulos sin letras latinas (japonés, coreano…): se usan los códigos de los caracteres.
  return Array.from(t.toLowerCase()).map(c => c.codePointAt(0).toString(36)).join("-").slice(0, 60);
}

export function idRegistro(titulo) {
  const k = claveTitulo(titulo);
  return k ? "r-" + k : null;
}

// "owner/repo" de una URL de GitHub; null para cualquier otro sitio. Lo usan el pipeline (README) y la ficha (releases).
export function repoDeUrl(url) {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/.exec(String(url || ""));
  return m ? `${m[1]}/${m[2]}` : null;
}

// Quita los sufijos entre paréntesis de un título de proyecto ("Mario Kart 64 (SpaghettiKart)" → "Mario Kart 64").
// Lo usan el pipeline (cruce con tus terminados) y la ficha (🎯 Quiero jugar desde un port).
const SUFIJO_PAREN = /\s*\((?:[^()]|\([^()]*\))*\)\s*$/;
export function tituloLimpio(titulo) {
  let t = String(titulo || "");
  for (let i = 0; i < 3 && SUFIJO_PAREN.test(t); i++) t = t.replace(SUFIJO_PAREN, "");
  return t;
}
