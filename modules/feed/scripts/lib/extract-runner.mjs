import { Worker } from "node:worker_threads";

const VACIO = { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null };
const WORKER_POR_DEFECTO = new URL("./extract-worker.mjs", import.meta.url);

// Parsea el HTML de un artículo en un worker aislado, con tope duro.
//   sanitize: función que limpia el HTML resultante (DOMPurify del hilo principal)
// Si el worker tarda más de timeoutMs o falla, se lo mata y se devuelve el
// resultado vacío (= "sin texto completo"), igual que cualquier otro fallo.
export function parsearArticulo(html, url, { sanitize, label = url, timeoutMs = 20000, workerUrl = WORKER_POR_DEFECTO } = {}) {
  return new Promise(resolve => {
    let terminado = false;
    const worker = new Worker(workerUrl, { workerData: { html, url } });
    const fin = (resultado, motivo) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      if (motivo) console.error(`✗ Extracción (${label}): ${motivo}`);
      worker.terminate().catch(() => {});
      resolve(resultado);
    };
    const timer = setTimeout(() => fin(VACIO, `el parseo superó ${timeoutMs / 1000}s, worker abortado`), timeoutMs);
    worker.once("message", m => {
      const { rawContent, ...resto } = m;
      let sanitized = null;
      try { sanitized = rawContent ? sanitize(rawContent) : null; } catch (e) { /* queda sin texto */ }
      fin({ ...VACIO, ...resto, sanitized });
    });
    worker.once("error", e => fin(VACIO, `error del worker: ${e.message}`));
    worker.once("exit", code => fin(VACIO, code ? `el worker salió con código ${code}` : null));
  });
}
