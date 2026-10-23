// capturar-muestras-bandcamp.mjs
// Guarda HTML real de Bandcamp (páginas de artista, de sello, de álbum y el
// reproductor embebido) en docs/muestras-bandcamp/ para escribir y probar el
// parser de build-musica.mjs contra el marcado verdadero, no contra supuestos.
// Corre solo desde update-musica.yml con modo=capturar (la red del sandbox de
// desarrollo no llega a Bandcamp). Volumen mínimo: ~12 requests, una vez.
import { mkdir, writeFile } from "node:fs/promises";

const OUT = new URL("../../../docs/muestras-bandcamp/", import.meta.url);
const UA = "angst-feed-sonda/1.0 ( https://github.com/cipinzas-hash/feeder )";
const MAX = 600 * 1024;

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: ctrl.signal, redirect: "follow" });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body };
  } catch (e) { return { ok: false, status: 0, body: "", error: e.message }; }
  finally { clearTimeout(t); }
}
async function guardar(nombre, res, url) {
  const cab = `<!-- muestra: ${url} · http ${res.status} · ${res.body.length} bytes${res.body.length > MAX ? " (truncada)" : ""} -->\n`;
  await writeFile(new URL(nombre, OUT), cab + res.body.slice(0, MAX));
  console.log(`${res.ok ? "✓" : "✗"} ${nombre} (${res.status}, ${res.body.length} bytes)`);
}

await mkdir(OUT, { recursive: true });
const hosts = [
  ["artista-mesh", "mesh-uk"], ["artista-combichrist", "combichrist"], ["artista-reptiletile", "reptiletile"],
  ["artista-korfian", "korfian"], ["sello-metropolis", "metropolisrecords"], ["sello-cryochamber", "cryochamber"],
  ["sello-antzen", "ant-zen"], ["sello-ximg", "x-img"],
];
let albumUrl = null;
for (const [nombre, host] of hosts) {
  const url = `https://${host}.bandcamp.com/music`;
  const r = await get(url);
  await guardar(`${nombre}.html`, r, url);
  if (nombre === "artista-mesh" && r.ok) {
    const m = r.body.match(/href="(\/album\/[^"#?]+)"/);
    if (m) albumUrl = `https://${host}.bandcamp.com${m[1]}`;
  }
  await new Promise(r2 => setTimeout(r2, 1500));
}
if (albumUrl) {
  const a = await get(albumUrl);
  await guardar("album-mesh.html", a, albumUrl);
  const id = a.body.match(/"item_id"\s*:\s*(\d+)/)?.[1] || a.body.match(/album=(\d+)/)?.[1];
  if (id) {
    const eu = `https://bandcamp.com/EmbeddedPlayer/album=${id}/size=large/bgcol=0a0a0a/linkcol=ffffff/tracklist=false/transparent=true/`;
    await guardar("embed-mesh.html", await get(eu), eu);
  }
}
console.log("Listo: muestras en docs/muestras-bandcamp/");
