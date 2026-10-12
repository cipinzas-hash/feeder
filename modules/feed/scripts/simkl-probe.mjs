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

const out = { at: new Date().toISOString() };
out.activities = (await get("/sync/activities")).json?.tv_shows ?? null;
out.plain = trim(await get("/sync/all-items/shows/watching"));
out.extended = trim(await get("/sync/all-items/shows/watching?extended=full&episode_watched_at=yes&next_watch_info=yes"));
await writeFile(OUT, JSON.stringify(out, null, 2));
console.log("probe escrito:", OUT, "plain:", out.plain.status, "extended:", out.extended.status, "shows:", out.extended.total);
