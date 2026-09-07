// build-podcasts.mjs
// Corre vía GitHub Action cada hora (update-podcasts.yml), separado del job
// pesado de RSS+extracción (build-feed.mjs, cada 4h) -- mismo criterio que
// llevó a separar Melee a su propio script/workflow: un fetch liviano no
// debería competir por presupuesto de tiempo con un job que hace
// extracción de texto completo.
//
// Lee la lista de shows desde podcasts-config.json en Angst-data (repo
// aparte, checkout de solo lectura acá -- lo edita Cristopher a mano o,
// eventualmente, el formulario del cliente vía el Worker angst-sync, que
// escribe directo a Angst-data sin pasar por acá). Si el archivo no existe
// todavía, cae a un único show hardcodeado (Meta Pod) para no romper nada
// mientras el config no esté desplegado.
//
// Salida: data/podcast-latest.json, agrupado por show -- consumido por el
// panel del reproductor en Angst (core/App.jsx).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import Parser from "rss-parser";

const parser = new Parser();

const CONFIG_PATH = process.env.PODCASTS_CONFIG_PATH || null; // ruta al checkout de Angst-data
const OUTPUT_PATH = new URL("../data/podcast-latest.json", import.meta.url);
const EPISODES_PER_SHOW = 5;

const FALLBACK_CONFIG = [
  { nombre: "Meta Pod", rssUrl: "https://anchor.fm/s/238c39d0/podcast/rss" },
];

async function loadConfig() {
  if (!CONFIG_PATH) {
    console.log("⚠ PODCASTS_CONFIG_PATH no seteado, usando config de respaldo (solo Meta Pod)");
    return FALLBACK_CONFIG;
  }
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) throw new Error("config vacío o no es un array");
    return parsed;
  } catch (e) {
    console.log(`⚠ No se pudo leer podcasts-config.json (${e.message}), usando config de respaldo (solo Meta Pod)`);
    return FALLBACK_CONFIG;
  }
}

async function fetchShowEpisodes(show) {
  try {
    const feed = await parser.parseURL(show.rssUrl);
    const episodes = (feed.items || [])
      .map(item => ({
        guid: item.guid || item.id || item.link,
        title: (item.title || "").trim(),
        audioUrl: item.enclosure?.url || null,
        pubDate: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null),
        link: item.link || "",
      }))
      .filter(e => e.guid && e.title && e.audioUrl)
      .sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""))
      .slice(0, EPISODES_PER_SHOW);
    console.log(`✓ ${show.nombre}: ${episodes.length} episodio(s)`);
    return { nombre: show.nombre, episodios: episodes };
  } catch (e) {
    console.error(`✗ ${show.nombre}: ${e.message}`);
    return null; // este show no entra en la corrida, pero no aborta a los demás
  }
}

async function main() {
  const config = await loadConfig();
  const results = await Promise.all(config.map(fetchShowEpisodes));
  const shows = results.filter(Boolean);

  if (!shows.length) {
    console.log("⚠ Ningún show pudo bajarse esta corrida, se conserva podcast-latest.json anterior");
    return;
  }

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), shows }, null, 2));
  console.log(`✓ podcast-latest.json: ${shows.length} show(s)`);
}

main();
