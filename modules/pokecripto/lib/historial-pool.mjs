// Historial del pool (3 datos por mes) → fila.histMes. Sin red ni React: lo usan la app (al agregar una carta), el bot (para completar filas viejas) y
// las pruebas. Los archivos los genera build-historial-pool.mjs; el catálogo de Pokémon (variantes) ubica el producto de cada carta.
import { claveCarta, grupoDeSet } from "./variantes-pokemon.mjs";
import { mezclarHistMes } from "./historial.mjs";

export const CAT_JUEGO = { pokemon: 3, yugioh: 2, digimon: 63 };
export const rutaHist = (cat, grupo) => `tcgcrypto-hist/${cat}/${grupo}.json`;
const sumaMes = (m, k) => { let [y, mo] = m.split("-").map(Number); mo += k; y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12 + 12) % 12 + 1; return `${y}-${String(mo).padStart(2, "0")}`; };
const ordenSub = s => ({ normal: 0, holofoil: 1, "reverse holofoil": 2 }[String(s || "").toLowerCase()] ?? 9);

// histMes de la fila a partir del archivo del grupo: shard = {m, t: {"pid|sub": [desfase, media, mín, máx, …]}}
export function histMesDeShard(shard, key) {
  const e = shard && shard.t && shard.t[key];
  if (!Array.isArray(e) || e.length < 4 || typeof shard.m !== "string") return null;
  const [desfase, ...flat] = e, t = [];
  for (let i = 0; i + 2 < flat.length + 0; i += 3) t.push(flat[i] == null ? null : [flat[i], flat[i + 1], flat[i + 2]]);
  return t.length ? { m: sumaMes(shard.m, desfase), t } : null;
}
// Producto (pid, subtipo, grupo de tcgcsv) de una carta de Pokémon a partir del shard de su set: la variante base del propio set (Normal, si no Holofoil,
// si no Reverse), o la única que tiene (`u`). null si el catálogo no la conoce.
export function productoBasePoke(shard, indice, numero, nombre) {
  if (!shard) return null;
  const k = claveCarta(numero, nombre), lista = shard.cartas && shard.cartas[k];
  if (lista && lista.length) {
    const propias = lista.filter(v => !v[6] && !v[2]);                              // del mismo set y sin sufijo de patrón
    const v = [...(propias.length ? propias : lista.filter(x => !x[6]))].sort((a, b) => ordenSub(a[1]) - ordenSub(b[1]))[0];
    return v ? { pid: v[0], sub: v[1], grupoId: shard.g } : null;
  }
  const u = shard.u && shard.u[k];
  return u ? { pid: u[0], sub: u[1], grupoId: shard.g } : null;
}

// ¿Qué producto es esta fila? { cat, pid, sub, grupoId } o null. `cargar(ruta)` devuelve el JSON (o null) —en la app con fetch, en el bot con fs—.
export async function productoDeFila(fila, cargar, juego = "pokemon") {
  const cat = CAT_JUEGO[juego];
  const m = /^(\d+)\|(.*)$/.exec((fila && fila.tcgcsvKey) || "");
  if (m && fila.tcgcsvGrupo) return { cat, pid: Number(m[1]), sub: m[2], grupoId: fila.tcgcsvGrupo };
  if (juego !== "pokemon" || !fila || !fila.set || !fila.number || !fila.name) return null;
  const indice = await cargar("pokemon-variantes/index.json"); const g = grupoDeSet(indice, fila.set); if (!g) return null;
  const p = productoBasePoke(await cargar(`pokemon-variantes/${g.id}.json`), indice, fila.number, fila.name);
  return p ? { cat, ...p } : null;
}
// histMes de una fila (mezclado con el propio: el archivo manda en los meses que tiene). { histMes, hasta } o null si aún no hay datos.
export async function histMesDeFila(fila, cargar, juego = "pokemon") {
  const p = await productoDeFila(fila, cargar, juego); if (!p) return null;
  const shard = await cargar(rutaHist(p.cat, p.grupoId)); if (!shard) return null;
  const hm = histMesDeShard(shard, `${p.pid}|${p.sub}`); if (!hm) return null;
  return { histMes: mezclarHistMes(hm, fila.histMes), ...p };
}
// Completa filas (bot): aplica histMes a las que no lo tienen y marca `histPend` en las que aún no se puede. Devuelve filas nuevas (mismo arreglo si nada cambió).
const DIAS_ESPERA = 8;
export async function completarHistorial(filas, cargar, hoy, juegoDe) {
  const estado = await cargar("tcgcrypto-hist/estado.json"); const hasta = estado && estado.ultimoMes;
  let cambios = 0;
  const salida = [];
  for (const f of filas) {
    const lista = f && f.estado !== "vendida" && !f.histSin && (!f.histMes || (hasta && f.histHasta !== hasta));
    if (!lista || (f.histPend && f.histIntento === hoy)) { salida.push(f); continue; }
    let r = null; try { r = await histMesDeFila(f, cargar, juegoDe(f)); } catch (e) { r = null; }
    let n = f;
    if (r) { n = { ...f, histMes: r.histMes, ...(hasta ? { histHasta: hasta } : {}) }; delete n.histPend; delete n.histIntento; delete n.histSin; }
    else if (!f.histMes) {
      const desde = f.histPend || hoy;
      n = { ...f, histPend: desde, histIntento: hoy };
      if ((new Date(hoy) - new Date(desde)) / 864e5 > DIAS_ESPERA && hasta) { n = { ...f, histSin: true }; delete n.histPend; delete n.histIntento; }   // no hay datos en tcgcsv para esta carta
    }
    if (n !== f) cambios++;
    salida.push(n);
  }
  return cambios ? salida : filas;
}
// Aviso de espera: días hasta que el historial de una carta nueva debería llegar (el catálogo se regenera los domingos; el bot completa al día siguiente).
export function diasParaHistorial(hoyISO) {
  const d = new Date(hoyISO + "T12:00:00Z"); const dow = d.getUTCDay();
  const hastaDomingo = dow === 0 ? 7 : 7 - dow;
  return hastaDomingo + 1;
}
export const avisoHistorial = (fila, hoyISO) => (fila && !fila.histMes && fila.histPend && !fila.histSin ? `⏳ historial llega en ~${diasParaHistorial(hoyISO)} días` : null);
