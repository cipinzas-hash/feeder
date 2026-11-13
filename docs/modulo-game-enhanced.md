# Módulo 🎮 Game enhanced (nov-2026)

**Qué es.** Un módulo de novedades de juegos para "estar listo cuando un proyecto me mueva las cuerdas". Cada ítem dice **por qué lo ves** ("porque terminaste X", "del estudio detrás de X") a partir de los 71 juegos terminados de Cristopher (`modules/gameenhanced/data/terminados.json`, de su Stash, 10-nov-2026).

**Fase 1 (datos reales): Decomps y Estudios.** Versiones web y sucesores espirituales quedaron fuera hasta tener fuente (ver `docs/sonda-game-enhanced.md`: ninguna versión web casa con su lista y las noticias casi no traen "sucesor espiritual").

## Pantalla
- **Montaje (N1):** pestaña 🎮 `game enhanced`, id **13** (sin renumerar; `ORDER` la deja al final), sobre `.app-fit`. Clases `.gameenh` / `.gameenh-body` en `core/App.jsx`.
- **Patrón (N2):** menú en cruz inspirado en el de la PSX, aprobado por Cristopher como excepción justificada (carrusel que escala, como Vitrina). Franja de estado (`N esta semana · N de tus estudios · ★ N` + sello `DATOS HACE N H`, en rojo si pasan de 36 h) · 3 categorías en horizontal (✨ Novedades, 🧩 Decomps, 🏢 Estudios) · ítems en vertical con el enfocado fijo arriba.
- **Colapsado (N3):** solo filas de una línea, sin scroll. La lista es un carrusel (deslizar, rueda, ↑↓). Se muestran las filas **enteras** que caben (se mide solo el contenedor de la lista con `ResizeObserver`); el sobrante se reparte entre filas.
- **Expandido:** tocar la fila del cruce la abre en línea (una a la vez); ahí nace el scroll interno. Tarjeta: detalle, **Abrir ficha** y **No me interesa**. La **ficha** muestra los datos, enlace a la fuente (solo `https://`, `noopener`), ☆ Me interesa y No me interesa.
- **No me interesa:** oculta el ítem, le quita el guardado y avisa en la franja (no flotante) con **Deshacer** por 6 s, que devuelve también el guardado previo.
- Sin título propio (R6); Caveat + DM Sans y emojis (R7). Si no cargan los datos: mensaje y botón **Reintentar**.

## Datos
Los arma `modules/feed/scripts/build-game-enhanced.mjs` (funciones puras en `scripts/lib/game-enhanced-lib.mjs`) y los publica en `modules/feed/data/game-enhanced.json` el workflow `update-game-enhanced.yml` (diario 08:40 UTC + manual). La app lo lee con `fetchGameEnhancedData()` (`modules/shared/catalog.js`). Cada fuente falla por separado: si una cae, se conserva lo anterior de esa fuente y queda el error en `fuentes`.
- **Decomps** (`awesome-decomp-games`, `data/games.json`, se actualiza a diario): un proyecto casa con un terminado si su título **sin el paréntesis final** (nombre del repo o port) es el mismo título, o ese título más una edición (Remastered, HD, DX…). No se cruza por saga ni por "contiene" (mezclaba secuelas). Se descartan las herramientas. Novedad = lo más reciente entre el último commit y la última versión. Ficha: tipo de proyecto, plataforma, estrellas, último commit/versión, jugable en navegador, "pide ROM", bandera de IA de la fuente, estado.
- **Estudios** (IGDB, secrets `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET`): se busca cada terminado, se toman sus desarrolladoras y se piden sus juegos de los últimos 150 días a los próximos 30 meses. Solo cuentan juegos principales, expansiones independientes y remakes; fuera DLC, paquetes, mods, remasterizaciones, ediciones ampliadas, ports, "Arcade Archives" y "Master Collection" (el ruido de Namco, SNK, Konami…). IGDB marca el 31-dic cuando solo se conoce el año: se muestra como año ("en 2027").
- **Novedades** (ventana): decomps activos con actividad en ≤90 días; juegos de estudios lanzados hace ≤120 días o que salen en ≤240. Decomps y Estudios muestran todo. Orden: cercanía a hoy, pasados y futuros por igual.
- **Lo que la fuente NO trae** (por eso no está en la pantalla): % de progreso de los decomps, fecha de alta de cada proyecto, versiones web de sus títulos, seguidores/expectativa en IGDB (campos vacíos).

## Datos persistidos (R8)
UNA clave nueva, `angst-game-enhanced-estado-v1`: `{ guardados: {id: ts}, ocultos: {id: ts} }` (ids `d-…` y `e-…`). Declarada en `LOCAL_KEY_FIELDS.gameEnhancedEstado` (`core/persistence.js`) → viaja en el export 💾 / Angst-data; `restoreFromPayload` la rehidrata con `rehidratarGameEnhanced()`. No migra ni toca datos existentes. Quedan ids `sim-*` huérfanos de la maqueta simulada si Cristopher marcó alguno: son inertes.

## Validación
- `node tests/gameenhanced.mjs` (cruce con decomps e IGDB, filtros, orden, ventanas, enlaces, estado, rehidratación) y `npm run audit:export`: OK.
- Bundle por módulo sin `useAltoLibre`, `MarcoAngst`, `window.innerHeight`, `position: fixed` ni `100vh`.
- Arranque de la app completa (jsdom) con los datos: pestaña, categorías, expandir, ficha, guardar, ocultar/deshacer, error y reintento.
- **Chromium real**, colapsado: sin scroll de módulo ni de página, pie visible y sin hueco bajo la última fila; al expandir nace el scroll interno.

| Viewport | Alto libre | Filas |
|---|---|---|
| 457×810 | ~649 px | 8 |
| 412×915 | 744 px | 9 |
| 360×640 | 469 px | 5 |
| 480×560 | 399 px (mínimo medido) | 4 |
| 820×1180 | 1010 px | 14 |

  No se midió en el celular de Cristopher: su captura es el criterio de aceptación (lineamiento 4.6).

## Pendiente / decisiones abiertas
- Versiones web y sucesores espirituales: faltan fuentes.
- "No me interesa" es por ítem; falta decidir si también debe silenciar el proyecto o el estudio.
- Proyectos con bandera de IA de la fuente se muestran marcados (no se ocultan): decidir si se filtran.
- Nombre de la pestaña ("game enhanced") y su posición (al final) son provisorios.
