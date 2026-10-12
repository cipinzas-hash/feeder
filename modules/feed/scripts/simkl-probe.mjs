// simkl-probe.mjs -- diagnóstico de UNA sola corrida (workflow_dispatch).
// Objetivo: ver la forma real de lo que Simkl devuelve por serie en
// /sync/all-items/shows/watching con y sin los parámetros extendidos, para
// diseñar la lectura de avance por episodio (issue #13). La salida va al
// repo PRIVADO Angst-data (simkl-probe.json), nunca a feeder (público).
// Se borra junto con su workflow cuando termine el diagnóstico.
import { writeFile } from "node:fs/promises";

const TOKEN = process.env.SIMKL_ACCESS_TOKEN;
const CID = process.env.SIMKL_CLIENT_ID;
const OUT = process.env.SIMKL_PROBE_OUT;
const H = { Authorization: `Bearer ${TOKEN}`, "simkl-api-key": CID, "User-Agent": "angst/1.0" };
const APP = "app-name=angst&app-version=1.0";

async function get(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://api.simkl.com${path}${sep}${APP}`, { headers: H });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json, raw: json ? undefined : text.slice(0, 300) };
}
const trim = (r, n = 3) => ({ status: r.status, raw: r.raw, shows: r.json?.shows ? r.json.shows.slice(0, n) : r.json, total: r.json?.shows?.length });

const Q = "extended=full&episode_watched_at=yes&next_watch_info=yes";
const resumen = (r, tmdb) => {
  const lista = r.json?.shows || [];
  const pick = tmdb ? lista.filter(x => String(x.show?.ids?.tmdb) === String(tmdb)) : lista.slice(0, 1);
  return { status: r.status, total: lista.length, muestra: pick.map(x => ({ title: x.show?.title, status: x.status, last_watched: x.last_watched, next_to_watch: x.next_to_watch, watched: x.watched_episodes_count, total: x.total_episodes_count, tieneSeasons: Array.isArray(x.seasons), temporadas: (x.seasons || []).map(t => [t.number, (t.episodes || []).length]) })) };
};
const out = { at: new Date().toISOString() };
out.dropped = resumen(await get(`/sync/all-items/shows/dropped?${Q}`), 1398);
out.completed = resumen(await get(`/sync/all-items/shows/completed?${Q}`));
await writeFile(OUT, JSON.stringify(out, null, 2));
console.log("probe2 escrito");
