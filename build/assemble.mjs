#!/usr/bin/env node
// Arma el HTML único de Angst a partir de los módulos del repositorio.
//
// El entry point de la aplicación vive ahora en app/App.jsx. Durante Angst 0.0
// ese archivo sigue delegando en core/App.jsx, lo que permite mover la frontera
// del shell sin alterar todavía la lógica de producto.

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
    entryPoints: ["app/App.jsx"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__angst",
    jsx: "transform",
    target: "es2020",
    logLevel: "info",
  });

  const bundledJS = result.outputFiles[0].text;
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
