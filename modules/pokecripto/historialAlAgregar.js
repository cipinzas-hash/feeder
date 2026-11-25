// Al registrar una carta: trae su historial completo (3 datos por mes, desde feb-2024) del archivo del pool y lo deja en la fila; si todavía no existe
// (carta nueva, o el historial aún no se generó) la marca `histPend` y el bot la completa solo; la ficha avisa «llega en ~N días».
import { fetchDataJson } from "../shared/catalog.js";
import { histMesDeFila } from "./lib/historial-pool.mjs";

export async function adjuntarHistorial(filas, saveInventario, juego, hoy) {
  if (!filas || !filas.length) return;
  const cargar = ruta => fetchDataJson(ruta, { nuevo: ruta.endsWith("estado.json") });
  const estado = await cargar("tcgcrypto-hist/estado.json").catch(() => null);
  const hasta = estado && estado.ultimoMes;
  const res = await Promise.all(filas.map(async f => { try { return [f.id, await histMesDeFila(f, cargar, juego)]; } catch (e) { return [f.id, null]; } }));
  const mapa = new Map(res);
  saveInventario(prev => (prev || []).map(f => {
    if (!mapa.has(f.id)) return f;
    const r = mapa.get(f.id);
    if (r) { const n = { ...f, histMes: r.histMes, ...(hasta ? { histHasta: hasta } : {}) }; delete n.histPend; return n; }
    return f.histMes || f.histPend ? f : { ...f, histPend: hoy };
  }));
}
