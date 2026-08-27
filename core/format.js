function fmtCLP(n) { return "$" + Math.round(n).toLocaleString("es-CL"); }

// Normaliza texto para comparaciones de búsqueda: minúsculas, sin acentos,
// puntuación tratada como separador (no se pega palabras), espacios
// colapsados. Solo para COMPARAR -- nunca usar el resultado como texto a
// mostrar al usuario (issue #2, modulo nutricion).
function normalizeSearchText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quita diacríticos (á→a, é→e; ñ→n también, es el comportamiento esperado para tolerar tildes/eñes faltantes al tipear)
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // puntuación → espacio
    .replace(/\s+/g, " ")
    .trim();
}

export { fmtCLP, normalizeSearchText };
