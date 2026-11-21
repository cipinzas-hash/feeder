// ─── Claves de títulos del registro de Game enhanced (puro: lo usan el módulo y el pipeline) ────
// Un juego del registro se identifica por su título normalizado: "r-" + clave. El pipeline guarda las
// fichas de IGDB bajo ese mismo id, así que cliente y bot tienen que calcularlo igual.
// Estados de un juego del registro (B, nov-2026): lo que ya jugó (terminado), lo que juega ahora (jugando), lo que dejó a medias
// (inconcluso) y lo que quiere jugar. El antiguo "pendiente" («empezado o en pausa») se lee como "inconcluso".
export const ESTADOS_REGISTRO = ["terminado", "jugando", "inconcluso", "quiero"];
// Estados que cuentan como "lo que has jugado": alimentan decomps y juegos nuevos de sus estudios. `quiero` solo alimenta decomps y ports.
export const ESTADOS_JUGADOS = ["terminado", "jugando", "inconcluso"];
export const normalizarEstado = e => (e === "pendiente" ? "inconcluso" : e);

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

// Plataformas en las que se buscan versiones "nativas" de un decomp (ramas y forks), en el orden en que se muestran.
export const PLATAFORMAS_SUGERIDAS = ["3DS", "PS Vita", "Wii U", "Switch", "PSP", "Wii", "GameCube", "PS3", "PS4", "PS5", "Xbox", "Xbox 360", "Dreamcast", "Saturn", "Android"];
