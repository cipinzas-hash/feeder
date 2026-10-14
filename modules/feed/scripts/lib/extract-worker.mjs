// Worker de extracción: JSDOM + Readability son 100% síncronos y una página
// patológica puede bloquearlos minutos. Corriendo acá, el hilo principal sigue
// vivo y puede matar este worker (worker.terminate()) al vencer el tope.
import { parentPort, workerData } from "node:worker_threads";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { extractBandcampEmbedUrl, extractSoundcloudTrackUrl, extractYoutubeId, hasListenEmbed } from "./embeds.mjs";

const VACIO = { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null };
const { html, url } = workerData;
const dom = new JSDOM(html, { url });
const article = new Readability(dom.window.document).parse();
if (!article?.content) {
  parentPort.postMessage({ ...VACIO, rawContent: null });
} else {
  // chequeo de embed ANTES de sanitizar: DOMPurify pela <iframe> por defecto.
  const videoId = extractYoutubeId(article.content);
  const bandcampEmbedUrl = extractBandcampEmbedUrl(article.content);
  parentPort.postMessage({
    rawContent: article.content, // se sanitiza en el hilo principal, que ya tiene DOMPurify inicializado
    hasEmbed: hasListenEmbed(article.content),
    videoId,
    bandcampEmbedUrl,
    soundcloudTrackUrl: !videoId && !bandcampEmbedUrl ? extractSoundcloudTrackUrl(article.content) : null,
  });
}
