import assert from "node:assert/strict";
import { parsearArticulo } from "../modules/feed/scripts/lib/extract-runner.mjs";

const html = `<html><head><title>x</title></head><body><article><h1>Hola</h1>
<p>${"Texto de prueba suficiente para que Readability lo considere un artículo. ".repeat(12)}</p>
<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><script>alert(1)</script></article></body></html>`;

// 1) camino normal: texto, embed de YouTube detectado antes de sanitizar, sanitize aplicado
const t0 = Date.now();
const r = await parsearArticulo(html, "https://ejemplo.test/nota", { sanitize: h => h.replace(/<script[\s\S]*?<\/script>/g, "") });
assert.ok(r.sanitized && r.sanitized.includes("Hola"), "devuelve el texto");
assert.ok(!r.sanitized.includes("<script"), "aplicó sanitize");
assert.equal(r.videoId, "abcdefghijk");
assert.equal(r.hasEmbed, true);

// 2) HTML sin artículo: resultado vacío, sin colgarse
const vacio = await parsearArticulo("<html><body></body></html>", "https://ejemplo.test/vacio", { sanitize: h => h });
assert.equal(vacio.sanitized, null);

// 3) worker colgado: se aborta al vencer el tope y se devuelve vacío (no bloquea el hilo principal)
const t1 = Date.now();
const colgado = await parsearArticulo("<p>x</p>", "https://ejemplo.test/patologica", {
  sanitize: h => h, timeoutMs: 400, workerUrl: new URL("./fixtures/spin-worker.mjs", import.meta.url), label: "prueba-colgado",
});
const ms = Date.now() - t1;
assert.deepEqual(colgado, { sanitized: null, hasEmbed: false, videoId: null, bandcampEmbedUrl: null, soundcloudTrackUrl: null });
assert.ok(ms >= 380 && ms < 3000, `tardó ${ms} ms (esperado ~400)`);

// 4) mientras un worker está colgado, el hilo principal sigue respondiendo
let ticks = 0; const iv = setInterval(() => ticks++, 50);
await parsearArticulo("<p>x</p>", "u", { sanitize: h => h, timeoutMs: 500, workerUrl: new URL("./fixtures/spin-worker.mjs", import.meta.url), label: "prueba-ticks" });
clearInterval(iv);
assert.ok(ticks >= 6, `el event loop siguió vivo (${ticks} ticks)`);
console.log(`extract-runner.mjs OK (normal ${Date.now() - t0 - ms - 500} ms aprox, colgado abortado en ${ms} ms)`);
