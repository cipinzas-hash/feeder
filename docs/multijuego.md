# Multi-juego en Pokécripto (rama `multijuego`, 17-nov-2026)

Construida SOBRE `precios-limpios` (lote 1): al fusionar, primero `precios-limpios` y después `multijuego`.

## Qué es
Yu-Gi-Oh! y Digimon dentro de Pokécripto, con la estructura de Pokécripto: **el mismo inventario de ejemplares**
(`pokeInventario`) con su estado, carpeta, costo, historial de precios y snapshots `csv`, no un almacén aparte como tcgcrypto.

- **Selector de juego** arriba de Pokécripto (`PokecriptoRaiz.jsx`): 🎴 Pokémon · 🃏 Yu-Gi-Oh! · 🐉 Digimon.
  Pokémon abre la pantalla de siempre. Mientras no existan filas de otros juegos recibe el inventario tal cual (comportamiento idéntico);
  si existen, recibe solo sus filas y lo que guarda se fusiona de vuelta sin tocar las de los otros juegos.
- **Campo `juego` en cada fila** (`pokemon` si falta: las 980 filas actuales no se migran).
- **Catálogo virtual** (los JSON de tcgcrypto que arma el bot de tcgcsv) + **fila solo si marcas la carta** (la tengo, la busco, versión
  elegida, cantidad, costo, notas). Así el inventario no se llena de miles de filas: Dark de Yu-Gi-Oh! son 2.609 cartas y el inventario ya
  ocupa ~1,8 MB de localStorage (65 % es historial). Regla de tcgcrypto conservada: colección individual (la misma carta en dos colecciones = dos filas).
- **Pantalla de juego** (`PokecriptoJuego.jsx`), con la MISMA estructura de exploración que las colecciones de Pokémon (pedido del 17-nov):
  menú «🗂️ Colecciones» (completación, barra, valor conseguido/total y % del valor, tarjetas por colección); dentro de una colección, tarjeta
  de completación en dos mitades (izquierda n/total, %, valor; derecha chips 🔍 sin precio y 🔎 buscar/filtrar), vistas ⠿ ▦ ≡, cartas
  **agrupadas por set** (más nuevo primero; una carta aparece en CADA set donde se imprimió —Magic Ruler, Invasion of Chaos…—, no solo bajo su impresión más nueva; con más de 400 impresiones los sets vienen cerrados y se abren al tocar su cabecera, y el panel 🔎 trae un selector de set) con barra de avance, valor por set y «¡completada!», tarjetas con borde verde = conseguida / rojo =
  falta, ✓ y precio; y **al tocar una carta, detalle a pantalla completa** (← volver, contador i/n, flechas ‹ › para recorrer la lista visible,
  zoom de la ilustración, estado, precio de mercado y rango, ATH/ATL/σ y variación 7/30/90/180/360 D, gráfico de precios con 7d/30d/todo y punto
  seleccionable, ✓ marcar conseguida / ↺ volver a hunting, ✎ editar (costo, cantidad, notas) y 🗑 quitar). Añade lo que viene de tcgcrypto:
  **selector de versión/edición** dentro del detalle y búsqueda + filtros de biblioteca (🔎).
  Diferencias con Pokémon que quedan: sin 🖨️ placeholders ni 📈 historial mensual de la colección (no hay serie histórica de estos juegos todavía),
  sin toque largo para zoom (el zoom es tocando la ilustración), y la vista lista usa texto claro sobre fondo oscuro.
- **Precios sin API** (`lib/juegos.mjs`): del catálogo (src `csv`, con `tid` = productId y `var` = edición). Los repreciea el cliente al abrir el
  juego y el bot cada día. El cambio de versión cambia el `tid`: si el salto es grande, el lote 1 lo marca como corte.
- **Bot**: las filas de otros juegos NO entran a ninguna fase de Pokémon (lotes, descubrimiento, búsqueda individual: no gastan cupo de
  tcgpricelookup) y se repreciean desde `modules/feed/data/tcgcrypto-{juego}.json`.

## Imágenes
Vienen del CDN de TCGplayer (`{id}_200w.jpg`), así que **necesitan internet** (la versión offline solo bloquea las consultas de datos, no las imágenes).
Cada imagen reserva su alto, no envía referer y prueba 200w → 400w → 1000x1000 antes de dejar un marcador con el nombre. Arreglo de un bug: las tarjetas
se definían dentro del render y se desmontaban en cada refresco de la app (reiniciando la carga); ahora la vista de colección es un componente
memoizado con tarjetas estables.

## Qué NO está todavía
- **Agregar cartas sueltas fuera de una colección** (p. ej. una staple para una carpeta «Staples & Meta» del juego): hoy solo se marcan cartas de las
  colecciones definidas (Yu-Gi-Oh!: Dark/Zombie/Eldlich; Digimon: Numemon). Se resuelve con colecciones nuevas en `build-tcgcrypto.mjs`
  o con un alta por búsqueda de catálogo (siguiente paso).
- **Price Watch, carpetas libres y precio objetivo** para otros juegos.
- **Retirar la pestaña tcgcrypto**: sigue disponible; sus marcas NO se migraron (eran de prueba).
- Las filas nuevas de otros juegos **no se encolan al bot** (`pokecripto-pending`): el bot toma el precio del catálogo de todos modos, pero el
  historial diario de una fila solo se acumula cuando la fila está en el canónico. Hoy la fila se sube al canónico con el botón «conectar» o al
  resincronizar; pendiente: encolar al marcar.
- No se probó en navegador real (solo jsdom, ver más abajo); no hay gráfico en jsdom (sin layout).

## Pruebas
`node tests/pokecripto-juegos.mjs` (9; lib con los catálogos reales), `tests/pokecripto-bot.mjs` (17, incluye filas de otros juegos y que no
consumen cupo) y el resto de la batería. Flujo de pantalla verificado en jsdom sobre la versión offline: selector → Yu-Gi-Oh! → menú → Eldlich (por sets, borde rojo) →
vistas ▦ ≡ → detalle a pantalla completa (1 / 14, ‹ ›) → «marcar conseguida» crea la fila (`en_mano`, `csv`) → ✎ editar costo → elegir edición →
volver (1 conseguida, borde verde) → menú actualizado → Digimon con la misma estructura → Pokémon sin cambios (123 cartas).


## Variantes homogéneas y tamaño de caras (20-nov-2026)
- `lib/variantes-comunes.mjs`: una variante se describe igual en todos los juegos (tipo, etiqueta, ícono, orden): **acabado** (Normal, Holo, Reverse,
  Foil), **patrón** (Poké Ball, Master Ball, logo de tipo, Dusk/Friend Ball, Cosmos, Cracked Ice), **sello** (liga, campeonato, prerelease, staff, torneo,
  evento; casi siempre más caros que la base), **edición** (1ª Edición, Unlimited, Limited) y **rareza** (UR, SR, ScR… en Yu-Gi-Oh!).
- **Un ejemplar por variante**: la fila lleva `tcgcsvKey` = `pid|subtipo` y su id incluye la variante; cada una tiene costo, cantidad, notas, historial y gráfico
  propios. La completación de la colección cuenta CARTAS (alguna variante); el valor conseguido suma cada variante × cantidad.
- **Tarjeta = impresión (set + número)** con insignias de todas sus variantes (rellenas las que tienes), contador `n/N`, 🏅 si trae sello y rango de precios.
- **Detalle**: franja «Variantes» con casilla «la tengo», etiqueta, precio y ×base para los sellos; la variante seleccionada manda la imagen, el precio, el
  historial y la edición.
- **Tamaño de caras** S / M / L / XL / lista, recordado por juego en el dispositivo (`angst-caras-{juego}`), por defecto L.
- Filtros: 🏅 (solo cartas con sello) y «Variantes» en el panel 🔎.
- La sonda de tcgcsv mide además los sellos entre sets (liga, prerelease, campeonato) con tus cartas: ver `docs/sonda-tcgcsv-pokemon.md` sección 5.

## Pokémon: variantes y historial mensual (20-nov-2026)
- **Variantes de Pokémon** (`build-pokemon-variantes.mjs` + `update-pokemon-variantes.yml`, semanal): catálogo por set desde tcgcsv, un archivo por set
  (≤135 KB, ~2 MB en total) en `modules/feed/data/pokemon-variantes/`. Une los acabados del producto (Normal/Holo/Reverse), los hermanos del mismo set
  con patrón (Poké Ball, Master Ball, logo de tipo…) y los sellos de OTROS grupos con el mismo nombre y el mismo número CON total (campeonato, evento,
  prerelease, liga). **No enlaza por nombre solo**: la sonda midió 348 de 887 filas con «promos del mismo nombre» (ruido: son cartas aparte, p. ej. las promos de
  liga modernas con numeración de promo). Con tus cartas: 583 de 978 filas tienen ≥2 variantes, 34 con sello (evento/campeonato sobre todo) y 20 con patrón.
- Pantalla: panel «variantes» en el detalle de Pokémon e insignias en las tarjetas de las colecciones (`VariantesPokemon.jsx`), mismo formato que los otros
  juegos. **Solo muestra**: marcar cuál variante tienes en Pokémon cambia el modelo de filas del módulo y queda como paso aparte.
- **Historial mensual** (`build-historial-mensual.mjs` + `historial-mensual.yml`): precio de la variante de cada fila el día 1 de cada mes desde feb-2024
  (archivos de tcgcsv, 2-4 MB c/u, ~105 MB en total por corrida). Se guarda COMPACTO en la fila (`histMes`: {m, p:[…]}, ~180 caracteres por fila) y la pantalla
  lo expande al dibujar (`historialConMensual`, con costuras marcadas). **Modo prueba por omisión**; escribe Angst-data solo con `apply = true`.
  Prueba real (20-nov): 940 de 1003 filas de Pokémon identificadas, 851 reciben historial (mediana 30 meses); precio del archivo ÷ tu snapshot del mismo mes:
  mediana 1,00 (55 % dentro de ±10 %, 77 % dentro de ±25 %: tu mes es un promedio, el archivo es un día).
- Marcar una variante de Yu-Gi-Oh!/Digimon **encola la fila al bot** (alta, cambio o baja) para que acumule historial.
