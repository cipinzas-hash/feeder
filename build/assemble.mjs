#!/usr/bin/env node
// Arma el HTML único de Angst a partir de los módulos separados del repo.
//
// Entry point real: core/App.jsx (AngstApp) — bundlea los 9 módulos +
// core/ui.jsx + core/stress.js + core/notifications.js + core/dates.js +
// core/persistence.js en un solo archivo.

import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "fs";

const HTML_HEAD = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>Angst</title>
<script crossorigin="anonymous" src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin="anonymous" src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script crossorigin="anonymous" src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
</head>
<body>
<div id="root"></div>
<div id="err" style="display:none;white-space:pre-wrap;padding:16px;font-family:monospace;color:#c00;"></div>
<script>
// No hay ningún .register() de service worker en el código de Angst -- si
// el navegador tiene uno activo de todos modos, es un resabio de algún
// mecanismo anterior (o algo registrado a mano alguna vez para probar
// notificaciones) y puede estar sirviendo un snapshot cacheado viejo que
// ningún deploy nuevo puede pisar por su cuenta. Desregistro defensivo:
// si no hay ninguno, esto no hace nada; si lo hay, lo saca de encima para
// que la próxima carga sí traiga el bundle real desde la red.
if (window.isSecureContext && navigator.serviceWorker) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister()))
    .catch(() => {});
}
if (window.caches) {
  caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
}
</script>
<script>
`;

const HTML_TAIL = `
try {
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(AngstApp));
} catch(e) {
  document.getElementById('err').style.display='block';
  document.getElementById('err').textContent='RENDER ERROR\\n\\n'+e.message+'\\n\\n'+(e.stack||'');
}
</script>
</body>
</html>
`;

async function main() {
  const result = await build({
    entryPoints: ["core/App.jsx"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__angst",
    jsx: "transform",
    target: "es2020",
    logLevel: "info",
  });

  const bundledJS = result.outputFiles[0].text;
  // El bundle IIFE deja AngstApp adentro de __angst.default (export default).
  // Lo exponemos como global simple para el bootstrap de arriba.
  const expose = `\nwindow.AngstApp = __angst.default;\n`;
  const html = HTML_HEAD + bundledJS + expose + HTML_TAIL;
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/angst-modular.html", html);
  console.log(`OK -> dist/angst-modular.html (${(html.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

