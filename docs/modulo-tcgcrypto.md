# Módulo tcgcrypto (issue #42)

Pokécripto para otros TCGs. Selector de juego arriba; las colecciones de cada juego como filas que se expanden en línea.
Por ahora **Yu-Gi-Oh!** y **Digimon**. **Pokémon sigue en su módulo (Pokécripto)**; el merge es un paso posterior, cuando
tcgcrypto esté probado.

## Colecciones
- **Yu-Gi-Oh!** — Dark (monstruos de atributo DARK), Zombie (tipo Zombie + cartas que mencionan Zombie en su texto) y Eldlich
  (arquetipo Eldlich y su soporte, por arquetipo, nombre o texto). Una carta = un nombre; sus impresiones son "versiones" y se
  elige la que gusta.
- **Digimon** — Numemon: solo cartas de Numemon, todas sus artes. Cada producto de TCGplayer es una carta distinta.
- Cada colección es **individual** (misma regla que Pokécripto, issue #39): la misma carta en dos colecciones son dos marcas.

## Qué muestra
Marco verde = conseguida, rojo = por conseguir. Cada colección: completitud (barra por tramos: rojo/naranjo/amarillo/verde,
dorada con "¡completada!" al 100 %), valor conseguido / valor total. Ficha de carta: versiones agrupadas por set con precio
de mercado, bajo y alto; elegir versión, marcar conseguida, cantidad, costo y notas.
El valor de una carta es el de la versión elegida; sin elegir, el de la versión más barata con precio.

## Datos
- Bot: `modules/feed/scripts/build-tcgcrypto.mjs` + `.github/workflows/update-tcgcrypto.yml` (diario 21:30 UTC, y a mano).
  Sin secrets. Escribe `modules/feed/data/tcgcrypto-yugioh.json`, `tcgcrypto-digimon.json` y `tcgcrypto-diag.json`
  (diagnóstico de la última corrida: cuántas cartas por colección, cuántas quedaron sin clasificar, etc.).
- Precios y catálogo: **tcgcsv.com** (espejo diario de TCGplayer, sin key ni cuota). Clasificación de Yu-Gi-Oh!: **YGOPRODeck**
  (una llamada con toda la base; sus imágenes NO se hotlinkean: se usan las de cada producto de TCGplayer).
- Precios en **USD de TCGplayer** (no es precio local).
- Formato compacto: `carta = {k, n, c:[colecciones], v:[[productId, subtipo, idxSet, número, rareza, mercado, bajo, alto]]}`.
- Estado propio (`angst-tcgcrypto-estado-v1`, clave nueva en `LOCAL_KEY_FIELDS`): viaja en el export 💾 / Angst-data.

## Agregar una colección o un juego
Colecciones: criterio en `COLECCIONES_YGO` / `coleccionesYgo()` (Yu-Gi-Oh!) o en el filtro de `construirDigimon()`.
Juego nuevo: función `construir<Juego>()` en el bot (categoría de tcgcsv), una entrada en `TCGS` de `TcgCryptoPage.jsx`.

## Pendiente respecto de Pokécripto (no replicado todavía)
Snapshots mensuales del valor por colección, hoja imprimible de placeholders, Price Watch, ficha a pantalla completa,
carpeta por ilustrador, registro de reverse. Se evalúan al hacer el merge.
