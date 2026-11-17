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
