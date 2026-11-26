# Prueba de humo de Game enhanced (render real con jsdom)

Renderiza `GameEnhancedPage` de verdad (React 18 + jsdom) con los datos reales del repo y de la fuente
(`awesome-decomp-games`), y comprueba el flujo completo: categorías del eje, semilla del registro, alta con Deshacer,
arrastre vertical y horizontal con inercia, popup de la ficha, posición recordada al cerrarlo, README y estado del autor,
releases, ↗ Compartir, insignias de estado, versiones sugeridas en otras plataformas, categoría Ports y 🎯 Quiero jugar.

No va en `npm test` porque necesita `react`, `react-dom` y `jsdom` (el repo no los tiene como dependencias).

```bash
# 1) dependencias y fuente, fuera del repo
mkdir -p /tmp/smoke && cd /tmp/smoke && npm init -y >/dev/null && npm i react@18 react-dom@18 jsdom
curl -s -o /tmp/games.json https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/data/games.json

# 2) desde la raíz del repo: empaquetar y correr
cd <raíz del repo>
NODE_PATH=/tmp/smoke/node_modules node_modules/.bin/esbuild tests/humo-gameenhanced/harness.jsx \
  --bundle --platform=node --format=esm --outfile=/tmp/smoke/harness.mjs --loader:.jsx=jsx --jsx=transform \
  --external:jsdom --log-level=error \
  --banner:js="import {createRequire} from 'module'; const require=createRequire(import.meta.url);"
cd /tmp/smoke && REPO=<raíz del repo> node harness.mjs 2>&1 | grep -v deprecated
```

Cada verificación imprime `ok:` o `FALLA:`; el proceso sale con código distinto de 0 si algo falla.

Límites: jsdom no mide pantalla ni tiene un dedo real. El umbral y la inercia del arrastre, el desborde colapsado y el aspecto solo se
confirman en un dispositivo. Los gestos se simulan con eventos `pointer*` con pausas entre movimientos.
Los selectores de botones del eje y de las fichas comparten texto («Quiero jugar»): usar el texto exacto (`🎯 Quiero jugar`).
