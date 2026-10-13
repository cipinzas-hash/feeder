// Videoteca persistente (issue #8): Microdocumentales y Conciertos no deben
// caducar. Hasta ahora "no caducar" solo significaba "sin corte de 30 días",
// pero feed.json se rearmaba entero con lo que YouTube devolvía en ESA
// corrida: si los feeds fallaban (pasó el 12-oct: ambas categorías quedaron
// vacías hasta la próxima corrida buena), la videoteca desaparecía.
// Acá se heredan de feed.json anterior los ítems de esas categorías que la
// corrida actual no trajo. Un video que YouTube borre queda en la videoteca:
// es el costo (aceptado en el issue) de que nada caduque solo.
export const CATEGORIAS_VIDEOTECA = new Set(["Microdocumentales", "Conciertos"]);

export function heredarVideoteca(categoriasPrevias, itemsFrescos, categorias = CATEGORIAS_VIDEOTECA) {
  const frescos = new Set(itemsFrescos.map(i => i.guid));
  const heredados = [];
  const vistos = new Set();
  for (const cat of categoriasPrevias || []) {
    if (!categorias.has(cat.cat)) continue;
    for (const item of cat.items || []) {
      if (!item.guid || frescos.has(item.guid) || vistos.has(item.guid)) continue;
      vistos.add(item.guid);
      heredados.push(item);
    }
  }
  return heredados;
}
