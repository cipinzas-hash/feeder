# Pokécripto unificado (22-nov-2026)

**Una sola pantalla para todos los juegos.** La de siempre (`PokecriptoPage`): carpetas, estados, Price Watch, precio objetivo, ventas, historial,
ficha y gráficos. El selector de juego (`PokecriptoRaiz`) solo cambia qué filas se ven y de dónde vienen el catálogo y los precios. Reemplaza el
diseño anterior de esta rama (una segunda pantalla reducida, `PokecriptoJuego`, al lado de la de Pokémon).

- **Filas**: todas en `pokeInventario`; `juego` ausente = Pokémon. Las 980 filas de Pokémon no se migran ni cambian.
- **Carpetas**: Pokémon como siempre; los otros juegos usan MLP, Staples & Meta y Price Watch propios (guardados en `pokeCarpetas` con prefijo `yugioh::`).
- **Otros juegos aportan**: el explorador de colecciones (`PokecriptoJuego`, ahora embebido: «🗂️ Colecciones») y el buscador de catálogo
  (`BuscarCatalogo`: «+ agregar» → carta, variante, carpeta, «la tengo» / «solo la sigo»). Precios diarios desde tcgcsv (sin API).
- **Lo propio de Pokémon queda apagado en los otros juegos**: API key, bot de tcgpricelookup, catálogo Dark, colecciones por ilustrador, «revisar precio».
- **Variantes en Pokémon**: cada variante (holo, reverse, Poké Ball, logo de tipo, sellos) puede ser su propio ejemplar, con costo, historial y gráfico.
  En el detalle: «＋ la tengo» (promueve la fila «hunting» o crea un ejemplar extra) y «es mi carta» (la fila que ya tenías ES esa variante).
  Lógica en `lib/variantes-filas.mjs`; el bot repreciea esas filas cada día desde `tcgcsv.com/tcgplayer/3/<grupo>/prices` y no las pasa por la API de la carta base.
- **Pestaña tcgcrypto retirada** (id 15 sin pestaña; el código de `modules/tcgcrypto` sigue porque `logica.js` lo usan los juegos).


## Segunda entrega (23-nov-2026)

- **Estructura de colecciones única**: sets plegables (pocos → abiertos; más de 400 cartas → cerrados y se abren al tocar), mismos botones de vista `S · M · L · XL · ≡`
  (`lib/vistas.mjs`), mismo formato de nombre de set y de carta, proporción de carta por juego (Pokémon/Digimon 63×88, Yu-Gi-Oh! 59×86).
  Los ‹ › del zoom grande tienen el tamaño de los de Pokémon (64×110) y recorren solo las cartas del set que estás viendo; el zoom sigue abierto al pasar de carta.
- **«Para cambio»** reemplaza a MLP en Yu-Gi-Oh! y Digimon (las filas y carpetas existentes se migran solas).
- **Dark sale de Yu-Gi-Oh!** (se conservan Zombie y Eldlich). Las filas ya marcadas se conservan.
- **Pool completo** (`build-tcgcrypto.mjs`, domingos o `POOL=1`): `tcgcrypto-pool/<juego>-index.json` (nombres), `<juego>-<letra>.json` (versiones, precios, **texto del efecto**)
  y `yugioh-codigos.json` (pasaporte → carta). El buscador «+ agregar» busca ahí; si aún no existe cae al catálogo de colecciones.
- **Importar mazo** (Yu-Gi-Oh!): `.ydk` o lista de texto → «rareza para todo» + ajuste carta por carta → carpeta «Edison · Zombie» con las copias (`copiasMazo`).
- **Historial de 3 datos por mes** (media, mínimo, máximo del market) desde feb-2024: `build-historial-pool.mjs` (workflow `historial-pool.yml`, mensual día 2) escribe
  `tcgcrypto-hist/<cat>/<grupo>.json`; `lib/historial-pool.mjs` lo une a cada fila (`histMes`) al registrarla o, si aún no está, la marca `histPend` y la ficha avisa
  «⏳ historial llega en ~N días»; el bot completa solo. **Pokémon pasa al mismo régimen**: el bot pliega los meses cerrados de `priceHistory` a `histMes`
  (`plegarMeses`), el inventario se escribe sin sangrías (-42 %) y las cartas nuevas de Pokémon también nacen con su historial.
- **Texto del efecto** en la ficha y en el zoom de Yu-Gi-Oh! (`EfectoCarta.jsx`).

### Pendientes conocidos de esta entrega
- Los datos nuevos (pool, historial, `u` en pokemon-variantes) los generan los workflows: hasta que corran, el buscador usa el catálogo de colecciones y las filas quedan `histPend`.
- El plegado de sets en las colecciones de **Pokémon** compila y comparte código con el explorador, pero no se probó en pantalla (requiere el catálogo Dark/ilustradores de la API).
- Las cartas con una sola variante de Pokémon necesitan el campo `u` que agrega `build-pokemon-variantes.mjs` (corre los domingos).
- Si el historial del pool pesa demasiado, `MIN_USD` (0,50) filtra el bulk; el informe de peso queda en `tcgcrypto-hist/estado.json`.

## Límites conocidos
- El buscador de otros juegos solo ve las cartas del catálogo que arma `build-tcgcrypto.mjs` (las de sus colecciones). Para staples hay que sumarlas al catálogo.
- Las ediciones de una fila existente (costo, notas…) no viajan al bot: el cliente es dueño de esos campos, como ya pasaba en Pokémon.
- El precio inicial de una variante recién marcada es el del catálogo semanal; el bot lo actualiza en su próxima corrida (necesita conectar el bot en el dispositivo).

---
(Documento anterior de la rama, para referencia)

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
  (archivos de tcgcsv, 2-4 MB c/u, ~105 MB en total por corrida). Se guarda COMPACTO en la fila (`histMes`: {m, p:[…]}; medido en Actions: 119 KB en total, 144 caracteres por fila) y la pantalla
  lo expande al dibujar (`historialConMensual`, con costuras marcadas). **Modo prueba por omisión**; escribe Angst-data solo con `apply = true`.
  Prueba real (21-nov, 34 de 34 archivos): 940 de 1003 filas de Pokémon identificadas, 851 reciben historial (mediana 31 meses); precio del archivo ÷ tu snapshot del mismo mes:
  mediana 1,00 (55 % dentro de ±10 %, 77 % dentro de ±25 %: tu mes es un promedio, el archivo es un día).
- Marcar una variante de Yu-Gi-Oh!/Digimon **encola la fila al bot** (alta, cambio o baja) para que acumule historial.

## Orden de fusión y pasos manuales
1. Fusionar `precios-limpios` (marca costuras, base NM, mediana 7 d; el bot lo aplica en su próxima corrida; respaldo: tag `backup-pre-lote1-2026-11-16` en Angst-data).
2. Fusionar `multijuego`, luego `variantes` (selector de juego, variantes, catálogo de Pokémon, historial mensual). Tras fusionar, los workflows semanales/manuales quedan en main.
3. Historial mensual: Run workflow «Historial mensual de precios (tcgcsv)» con `apply = true` (antes, el informe de prueba ya está en `docs/historial-mensual-reporte.md`).
4. Pendiente (no hecho): marcar la variante que tienes en Pokémon (hoy solo se muestran), selector de tamaño de caras en las tarjetas de Pokémon, y mostrar
   las «promos relacionadas» por nombre (liga modernas) como lista aparte.
