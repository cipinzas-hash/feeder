# Módulo 🎮 Game enhanced (nov-2026)

**Qué es.** Un módulo de novedades de juegos para "estar listo cuando un proyecto me mueva las cuerdas": decomps, versiones web, juegos nuevos de los estudios detrás de lo que Cristopher terminó y sucesores espirituales. Cada ítem dice **por qué lo ves** ("porque terminaste X", "del estudio detrás de X", "sucesor espiritual de X").

**Estado actual: los datos son SIMULADOS.** `modules/gameenhanced/datos.js` tiene 19 ítems inventados (los juegos de "motivo" sí son de su lista de terminados). Mientras `SIMULADO` sea `true`, la franja de estado y cada ficha muestran el sello "SIMULADO". El pipeline real (decomps, ports web, estudios vía IGDB, sucesores) viene después de una sonda (sin Go aún).

## Pantalla
- **Montaje (N1):** pestaña 🎮 `game enhanced`, id **13** (sin renumerar; `ORDER` la deja al final), sobre `.app-fit`. Clases `.gameenh` / `.gameenh-body` en `core/App.jsx`.
- **Patrón (N2):** menú en cruz inspirado en el de la PSX, aprobado por Cristopher como excepción justificada (carrusel que escala, como Vitrina). Franja de estado arriba (`N esta semana · N de tus estudios · ★ N` + sello SIMULADO) · 5 categorías en horizontal (✨ Novedades, 🧩 Decomps, 🌐 Versiones web, 🏢 Estudios, 👻 Sucesores) · ítems en vertical con el enfocado fijo arriba.
- **Colapsado (N3):** solo filas de una línea, sin scroll. La lista es un carrusel: se mueve el foco (deslizar arriba/abajo, rueda del mouse, ↑↓), no la lista. Se muestran las filas **enteras** que caben (se mide solo el contenedor de la lista con `ResizeObserver`, no la pantalla); el sobrante se reparte entre filas (sin hueco muerto).
- **Expandido:** tocar la fila del cruce la abre en línea (una a la vez); ahí nace el scroll interno. Desde la tarjeta: **Abrir ficha** y **No me interesa**. La **ficha** es otro estado expandido, con ☆ Me interesa y No me interesa.
- **Categorías:** tocar o deslizar de lado (←→ en teclado). Sin título propio (R6); Caveat + DM Sans y emojis (R7).
- **No me interesa:** oculta el ítem, le quita el guardado si lo tenía y avisa en la franja de estado (no flotante) con **Deshacer** por 6 s; deshacer devuelve también el guardado previo.

## Datos persistidos (R8)
UNA clave nueva, `angst-game-enhanced-estado-v1`: `{ guardados: {id: ts}, ocultos: {id: ts} }`. Declarada en `LOCAL_KEY_FIELDS.gameEnhancedEstado` (`core/persistence.js`) → viaja en el export 💾 / Angst-data; `restoreFromPayload` la rehidrata con `rehidratarGameEnhanced()`. No migra ni toca datos existentes. Los ids de los ítems simulados empiezan con `sim-`; al pasar a datos reales conviene decidir qué hacer con lo guardado/oculto sobre ítems simulados (decisión de Cristopher).

## Validación (10-nov-2026)
- `node tests/gameenhanced.mjs` (datos, filtro/orden/ventana, estado, rehidratación, claves corruptas) y `npm run audit:export`: OK.
- Bundle por módulo: sin `useAltoLibre`, `MarcoAngst`, `window.innerHeight`, `position: fixed` ni `100vh`.
- Arranque de la app completa (jsdom): 14 pestañas, 🎮 al final, interacciones completas, 0 errores del módulo.
- **Chromium real**, colapsado, sin scroll de módulo ni de página, pie visible, sin hueco bajo la última fila:

| Viewport | Alto libre del módulo | Filas |
|---|---|---|
| 457×810 | 639 px | 8 |
| 412×915 | 744 px | 9 |
| 360×640 | 469 px | 5 |
| 480×560 | **399 px (mínimo medido)** | 4 |
| 820×1180 (tablet) | 1010 px | 14 |

  Al expandir una fila el scroll interno aparece y colapsarla lo devuelve al inicio. **No** se midió en el celular real de Cristopher: su captura es el criterio de aceptación (lineamiento 4.6).

## Pendiente / decisiones abiertas
- Pipeline de datos reales y su sonda (sin Go): decomps (awesome-decomp-games), estudios y lanzamientos (IGDB: secrets `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` ya creados en el repo), sucesores espirituales (frase en noticias cruzada con su lista).
- Lista de juegos terminados de Cristopher (71, de Stash) para cruzar con los datos reales: aún no está en el repo.
- "No me interesa": hoy es solo por ítem; falta decidir si también debe silenciar el proyecto o el estudio.
- Nombre de la pestaña ("game enhanced") y su posición (hoy al final) son provisorios.
- Los botones del encabezado y la franja de estado no cambian por módulo; no hay nada específico de Game enhanced en ellos.
