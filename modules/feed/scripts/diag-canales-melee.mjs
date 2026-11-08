// diag-canales-melee.mjs — DIAGNÓSTICO (nov-2026), solo lee, no cambia datos.
// Objetivo: resolver los canales de YouTube que producen los VODs de los majors de Melee
// y VERIFICAR que de verdad los tengan, antes de fijar un mapa torneo → canal en build-melee.
// Motivo: el organizador no siempre es quien transmite (VGBootCamp produce para otros TOs).
// Costo: ~1500 unidades de cuota (cada search.list = 100). Corre solo desde diag-canales-melee.yml.
import { writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.YOUTUBE_API_KEY;
const OUT_MD = new URL("../../../docs/diag-canales-melee.md", import.meta.url);
const OUT_JSON = new URL("../data/diag-canales-melee.json", import.meta.url);
const VGBC = "UCj1J3QuIftjOq9iv_rr7Egw"; // ya fijado en build-melee.mjs (CEO, Supernova)

// Qué se busca y cómo se reconoce un VOD del evento correcto en el título.
const CANDIDATOS = [
  { clave: "Genesis", buscar: "GENESIS Smash", evento: "GENESIS X3 Melee Singles", reconoce: /genesis/i, torneos: "Genesis X3 / X4 (feb 2027)" },
  { clave: "Satellite Smash", buscar: "Satellite Smash", evento: "Port Priority Melee", reconoce: /port priority|satellite/i, torneos: "Port Priority DX (14–15 nov 2026)" },
  { clave: "Tipped Off", buscar: "Tipped Off Smash", evento: "Tipped Off 16 Melee", reconoce: /tipped off/i, torneos: "Tipped Off 17 (31 oct–1 nov 2026)" },
  { clave: "Galint Gaming", buscar: "Galint Gaming", evento: "Battle of BC 8 Melee", reconoce: /battle of bc|platfight/i, torneos: "Battle of BC, Platfight" },
];
// Verificación del canal ya fijado: ¿VGBootCamp tiene también Riptide y GOML (donde produciría para otros TOs)?
const VERIFICAR_VGBC = [
  { evento: "Riptide 2026 Melee", reconoce: /riptide/i },
  { evento: "GOML 2026 Melee", reconoce: /goml|get on my level/i },
  { evento: "Supernova 2026 Melee", reconoce: /supernova/i },
];

let cuotaAgotada = false;
let unidades = 0;
async function yt(endpoint, params, costo) {
  if (cuotaAgotada) return null;
  const qs = new URLSearchParams({ ...params, key: KEY });
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`);
    const j = await r.json();
    unidades += costo;
    if (j.error) {
      const reason = j.error.errors?.[0]?.reason || j.error.message;
      if (/quota/i.test(reason)) cuotaAgotada = true;
      console.log(`  ✗ ${endpoint}: ${reason}`);
      return null;
    }
    return j;
  } catch (e) { console.log(`  ✗ ${endpoint}: ${e.message}`); return null; }
}

const buscarVideos = async (channelId, q) => {
  const j = await yt("search", { part: "snippet", channelId, q, type: "video", maxResults: "8", order: "relevance" }, 100);
  return (j?.items || []).map(i => ({ videoId: i.id.videoId, titulo: i.snippet.title, fecha: i.snippet.publishedAt?.slice(0, 10) }));
};

const resultados = { generado: new Date().toISOString(), candidatos: [], vgbootcamp: null, cuotaAgotada: false, unidades: 0 };

// 1) Resolver cada candidato y verificar sus 2 mejores canales con una búsqueda del evento.
for (const c of CANDIDATOS) {
  console.log(`\n== ${c.clave} ==`);
  const rec = { clave: c.clave, torneos: c.torneos, canales: [] };
  const s = await yt("search", { part: "snippet", q: c.buscar, type: "channel", maxResults: "5" }, 100);
  const ids = (s?.items || []).map(i => i.snippet.channelId || i.id.channelId).filter(Boolean);
  const info = ids.length ? await yt("channels", { part: "snippet,statistics", id: ids.join(",") }, 1) : null;
  const porId = new Map((info?.items || []).map(i => [i.id, i]));
  for (const [n, id] of ids.entries()) {
    const ch = porId.get(id);
    const canal = { channelId: id, titulo: ch?.snippet?.title, handle: ch?.snippet?.customUrl, subs: ch?.statistics?.subscriberCount, videos: ch?.statistics?.videoCount, verificacion: null };
    if (n < 2) { // solo los 2 primeros: cada verificación cuesta 100
      const vids = await buscarVideos(id, c.evento);
      canal.verificacion = { consulta: c.evento, coinciden: vids.filter(v => c.reconoce.test(v.titulo)).length, de: vids.length, ejemplos: vids.slice(0, 4) };
    }
    console.log(`  ${canal.titulo} (${canal.handle}) ${id} subs=${canal.subs} verif=${canal.verificacion ? canal.verificacion.coinciden + "/" + canal.verificacion.de : "—"}`);
    rec.canales.push(canal);
  }
  resultados.candidatos.push(rec);
}

// 2) VGBootCamp: título real del canal fijado y qué torneos de otros TOs transmite.
console.log("\n== VGBootCamp ==");
const vinfo = await yt("channels", { part: "snippet,statistics", id: VGBC }, 1);
const v = vinfo?.items?.[0];
resultados.vgbootcamp = { channelId: VGBC, titulo: v?.snippet?.title, handle: v?.snippet?.customUrl, subs: v?.statistics?.subscriberCount, torneos: [] };
for (const t of VERIFICAR_VGBC) {
  const vids = await buscarVideos(VGBC, t.evento);
  const ok = vids.filter(x => t.reconoce.test(x.titulo));
  resultados.vgbootcamp.torneos.push({ consulta: t.evento, coinciden: ok.length, de: vids.length, ejemplos: ok.slice(0, 3) });
  console.log(`  ${t.evento}: ${ok.length}/${vids.length}`);
}
resultados.cuotaAgotada = cuotaAgotada; resultados.unidades = unidades;

// Reporte
const L = [`# Diagnóstico de canales de Melee — ${resultados.generado.slice(0, 10)}`, "", `Cuota usada: ~${unidades} unidades${cuotaAgotada ? " (**la cuota se agotó a mitad: faltan datos**)" : ""}.`, "",
  "## VGBootCamp (canal ya fijado en build-melee.mjs)", "", `- ${resultados.vgbootcamp.titulo} · ${resultados.vgbootcamp.handle} · \`${VGBC}\` · subs ${resultados.vgbootcamp.subs}`];
for (const t of resultados.vgbootcamp.torneos) L.push(`- "${t.consulta}": ${t.coinciden}/${t.de} resultados del evento correcto` + (t.ejemplos[0] ? ` — p. ej. ${t.ejemplos[0].titulo} (${t.ejemplos[0].fecha})` : ""));
for (const r of resultados.candidatos) {
  L.push("", `## ${r.clave} — ${r.torneos}`, "", "| Canal | Handle | ID | Subs | Videos | Verificación |", "|---|---|---|---|---|---|");
  for (const c of r.canales) L.push(`| ${c.titulo ?? "?"} | ${c.handle ?? ""} | \`${c.channelId}\` | ${c.subs ?? ""} | ${c.videos ?? ""} | ${c.verificacion ? `${c.verificacion.coinciden}/${c.verificacion.de} para "${c.verificacion.consulta}"` : "sin verificar"} |`);
  const mejor = r.canales.find(c => c.verificacion?.coinciden > 0);
  if (mejor) { L.push("", `Ejemplos del canal más probable (${mejor.titulo}):`); for (const e of mejor.verificacion.ejemplos) L.push(`- ${e.titulo} (${e.fecha}) — \`${e.videoId}\``); }
}
await mkdir(new URL("./", OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(resultados, null, 1));
await writeFile(OUT_MD, L.join("\n") + "\n");
console.log(`\nListo. ~${unidades} unidades de cuota.`);
