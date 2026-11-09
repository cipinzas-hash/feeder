// Helpers puros de Vitrina (sin React) para poder probarlos en node.

// Una serie está "al día" si vio al menos un episodio y no le queda ninguno
// emitido por ver. Si sale un episodio nuevo, pendientes > 0 y deja de estarlo.
export function estaAlDia(av) {
  return !!av && av.vistos > 0 && av.pendientes === 0;
}

// Lista por la que navegan siguiente/anterior dentro del detalle: la que el
// carrusel mostraba (con sus filtros y orden). `mem` es el ref de memoria que
// comparten el carrusel y VitrinaPage. Si no hay lista publicada para esta
// categoría, o el ítem abierto no está en ella, cae al catálogo completo.
export function listaDeNavegacion(mem, cat, completa, guidActual) {
  const l = mem && mem.listaCat === cat ? mem.lista : null;
  if (Array.isArray(l) && l.length && l.some(i => i.guid === guidActual)) return l;
  return completa || [];
}
