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
- **Pantalla de juego** (`PokecriptoJuego.jsx`): inicio con colecciones y avance (Yu-Gi-Oh!: Dark, Zombie, Eldlich; Digimon: Numemon), lista
  paginada con búsqueda, «todas / me faltan / las tengo» y filtros de biblioteca (de tcgcrypto), ficha con **selector de versión/edición**,
  cantidad, costo, notas, deltas y gráfico de precios (el mismo `PriceChart` con cortes y mediana del lote 1).
- **Precios sin API** (`lib/juegos.mjs`): del catálogo (src `csv`, con `tid` = productId y `var` = edición). Los repreciea el cliente al abrir el
  juego y el bot cada día. El cambio de versión cambia el `tid`: si el salto es grande, el lote 1 lo marca como corte.
- **Bot**: las filas de otros juegos NO entran a ninguna fase de Pokémon (lotes, descubrimiento, búsqueda individual: no gastan cupo de
  tcgpricelookup) y se repreciean desde `modules/feed/data/tcgcrypto-{juego}.json`.

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
consumen cupo) y el resto de la batería. Flujo de pantalla verificado en jsdom sobre la versión offline: selector → Yu-Gi-Oh! → Dark (2.609 cartas,
60 por página) → búsqueda → ficha → «la tengo» crea la fila (`en_mano`, `csv`) → elegir otra versión → desmarcar (queda `hunting`) → Digimon →
volver a Pokémon sin ver la fila → inventario 981 filas.
