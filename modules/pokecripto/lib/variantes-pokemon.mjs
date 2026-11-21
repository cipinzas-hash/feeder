// Variantes de una carta de Pokémon a partir del catálogo por set (build-pokemon-variantes.mjs). Sin red ni React.
// Entrada: el índice ({grupos:[{id,nombre}]}), el shard de un set ({cartas:{"<num>|<nombre>":[[pid,sub,sufijo,market,low,high,grupoSello,rareza],…]}}).
import { normNum, normName } from "./pricing.mjs";
import { nombreSetCompatible } from "./variantes.mjs";
import { describirVariante, ordenarVariantes } from "./variantes-comunes.mjs";

export const claveCarta = (numero, nombre) => `${normNum(numero)}|${normName(nombre)}`;

// Grupo del catálogo que corresponde al nombre de set de la app (exacto primero, luego compatible)
export function grupoDeSet(indice, nombreSet) {
  const gs = (indice && indice.grupos) || [];
  const plano = s => String(nombreSet || "").toLowerCase();
  return gs.find(g => g.nombre === nombreSet) || gs.find(g => g.nombre.toLowerCase() === plano()) || gs.find(g => nombreSetCompatible(nombreSet, g.nombre)) || null;
}

// Variantes descritas con el formato común y ordenadas (sellos primero). `key` = "pid|subtipo". [] si la carta no tiene varias.
export function variantesDeShard(shard, indice, numero, nombre) {
  const lista = shard && shard.cartas && shard.cartas[claveCarta(numero, nombre)];
  if (!lista) return [];
  const nombres = new Map(((indice && indice.grupos) || []).map(g => [g.id, g.nombre]));
  const vs = lista.map(([pid, sub, sufijo, market, low, high, grupoSello, rareza]) => ({
    ...describirVariante({ juego: "pokemon", sub, sufijo, grupo: grupoSello ? nombres.get(grupoSello) || "" : "", rareza, market, low, high, pid }),
    key: `${pid}|${sub}`, grupoSello: grupoSello ? nombres.get(grupoSello) || "" : "",
  }));
  return ordenarVariantes(vs);
}
