# Angst / Feeder — Handoff y Lineamiento de módulos

> Documento de traspaso para otro agente (IA ejecutora o diseñadora).
> Fecha de corte: 17-oct-2026. Estado del repo al corte: `main` en `63c75f0` (más commits automáticos de bots).
> Idioma de trabajo con el usuario: **español**.

## 0. Cómo leer este documento

Cada punto lleva una marca de estado. No confundas unas con otras:

| Marca | Significa |
|---|---|
| ✅ Hecho | Implementado, validado y publicado en `main`. |
| 🟡 Propuesto | Plan discutido con el usuario. **No hay Go para implementar** salvo que se diga lo contrario. |
| ❓ Abierto | Decisión que le corresponde al usuario. No inferirla: preguntarla. |

Orden de lectura sugerido: §1 (reglas, obligatorio) → §2 (proyecto) → §4 (el lineamiento, el corazón del documento) → §5 (plan) → §6 (otros pendientes) → §7 (cómo validar y publicar).

---

## 1. Reglas de trabajo con Cristopher (no negociables)

El usuario es **Cristopher** (Cris). Define el producto y las decisiones finales. Dice no tener conocimientos técnicos ni de programación más allá de generar ideas: explica en lenguaje simple, sin jerga innecesaria, y no esperes que revise código.

1. **No escribir código sin su Go explícito.** Una idea o preferencia ("quiero que…", "se podría…") no es un Go. El patrón que ha funcionado: él propone → el agente investiga el código real y presenta un plan concreto (qué cambia, qué no, cómo se valida, riesgos) → él aprueba ("perfecto", "Go") → el agente implementa de una vez.
2. **Una vez dado el Go, trabajar en bloques sustanciales** sin fragmentar en confirmaciones intermedias.
3. **Validar antes de publicar:** sintaxis, build y comprobación del contenido del **bundle final** (`index.html`), no solo del código fuente. Reportar con precisión qué quedó terminado y qué no, incluidas las cosas que no se pudieron probar (por ejemplo, el aspecto real en su celular).
4. **Datos persistidos (localStorage, `angst-data`, exportaciones) no se migran ni modifican implícitamente.** Toda migración se declara y la aprueba él. Ejemplo reciente: se le preguntó qué hacer con ítems de Vitrina guardados en el Buzón de Feed y eligió descartarlos.
5. **Mantenerse dentro del alcance pedido.** No aprovechar un cambio puntual para reestructurar. Si algo cercano merece cambio, se propone aparte.
6. **No dejar dos soluciones vivas** para el mismo problema. Al reemplazar algo, buscar referencias y eliminar lo obsoleto (o declararlo).
7. **Un fix no está terminado hasta llegar al artefacto servido.** El sitio sirve `index.html` en GitHub Pages.
8. **Una pregunta por mensaje como máximo**, al final, y solo si es necesaria. Preferir dejar decisiones por defecto razonables indicadas, para que él las corrija.
9. **Reconocimiento directo, sin consejos operativos no pedidos.** Responder primero a lo que dijo.
10. **Token de GitHub:** el usuario ya entregó un token (sin expiración) en conversaciones previas y es consciente del riesgo; **no quiere advertencias repetidas**. En una conversación nueva el agente probablemente no lo tendrá: pedirlo una vez, sin sermón. **Nunca** escribirlo en archivos, commits, documentos ni memoria. Usarlo solo en el comando (ver §7.3).

Documentos vigentes del repo que complementan esto: `docs/operating-directives.md` (roles y reglas duras). `docs/henry-protocol.md` está **en desuso** como flujo; su propósito actual es dar contexto, registrar issues y documentar ideas con evaluación de viabilidad.

---

## 2. El proyecto en dos minutos

- **Repo:** `cipinzas-hash/feeder` (público). Sitio estático: https://cipinzas-hash.github.io/feeder/
- **Qué es:** "Angst" es una PWA personal modular (planner semanal, presupuesto, salud, nutrición, ejercicio, Pokécripto, etc.) que además incluye un **Feed** de noticias tipo stories y una **Vitrina** audiovisual (catálogo de cine/series/animación/microdocs/Melee/conciertos).
- **Build:** `npm ci && node build/assemble.mjs` (esbuild). Genera `index.html` (el que sirve GitHub Pages) y `dist/angst-modular.html`. **El build reproduce byte a byte el `index.html` commiteado** (se comprobó): úsalo como línea base antes de tocar nada.
- **Tests:** `npm run audit:export` (`tests/export-coverage.mjs` y `tests/vitrina-restore.mjs`). Hay más scripts en `tests/` (planner, pokécripto, salud, videoteca, episodios) que se corren a mano con `node tests/<archivo>.mjs`.
- **Bots:** GitHub Actions commitean datos continuamente a `main` (podcasts cada hora; feed, Melee, cine cada 4 h; Simkl cada 6 h; precios Pokécripto diarios). Por eso **antes de pushear siempre `fetch` + `rebase`** (ver §7.3).
- **Backend auxiliar:** `cloudflare-worker/angst-sync.js` (sincronización), workflow `deploy-worker.yml`.

### 2.1 Estructura

```
core/            App.jsx (shell + Semana inline), ui.jsx, persistence.js, dates.js, format.js, notifications.js, stress.js
modules/<mod>/   <Mod>Page.jsx + manifest.js (+ archivos propios)
modules/shared/  ui.jsx (useAltoLibre, MarcoAngst, FormatoTag…), constants.js, catalog.js, episodios.js, localedit.js
modules/feed/    FeedPage.jsx, scripts/build-feed.mjs, scripts/lib/embeds.mjs, feeds.json, data/
modules/vitrina/ VitrinaPage.jsx, cine.jsx, series.jsx, melee.jsx, videoteca.jsx, estado.js, simkl.js, avance.js
build/           assemble.mjs
tests/           *.mjs
docs/            documentación operativa y de cambios
.github/workflows/  update-*.yml, deploy-worker.yml, simkl-pin-setup.yml
```

Los módulos usan **React global** (`const { useState } = React;`), no imports de React: cualquier harness de prueba debe definir `global.React`.

### 2.2 Pestañas del shell (`core/App.jsx`)

El id de página es el índice en `TABS`; el orden visual lo define `ORDER=[0,11,1,2,3,4,5,6,7,8,9,10]` (Rutinas se mostró después de Semana **sin renumerar** ids).

| id | Pestaña | Componente | Notas |
|---|---|---|---|
| 0 | 📅 Semana | inline en `App.jsx` (~360 líneas) | calendario semanal, tareas, reflexión |
| 11 | 🌱 rutinas | `RoutinesPage` | antes subpestaña "prácticas" de Semana |
| 1 | 💵 Presupuesto | `BudgetPage` | |
| 2 | 📒 Emprendimientos | `NutriaPage` | |
| 3 | 🧠 mindfulness | `EspritPage` | ~864 líneas |
| 4 | 🩺 salud | `SaludPage` | |
| 5 | 🍄 fadiman | `FadimanPage` | pequeño (~200 líneas) |
| 6 | 🥗 nutrición | `NutricionPage` | ~1.300 líneas |
| 7 | 🏋️ ejercicio | `EjercicioPage` | ~1.340 líneas |
| 8 | 🃏 pokécripto | `PokecriptoPage` | ~2.780 líneas, el más grande |
| 9 | 📰 feed | `FeedPage` | solo noticias |
| 10 | 🎬 vitrina | `VitrinaPage` | plantilla del lineamiento |

Chrome fijo del shell: **encabezado** `.hdr` (título "angstapp" + botones 📁💾⬆️⬇️🎙️), **pestañas** `.tabs` (emoji; la abierta muestra su nombre), **contenido**, **pie** `.ftr` (frase rotativa `STOIC_PHRASES` cada 10 s + logo "ANGST").

### 2.3 Datos locales relevantes (no migrar sin aprobación)

`angst-v12` (estado principal del planner), `angst-feed-proto-v1` (cola/vistos/Buzón de Feed), `angst-cine-estado-v1` (estado y reseñas propias de cine), `angst-simkl-auth-v1`, `angst-simkl-pending-v1`, `angst-series-overlay-v1`, claves de vistos (`angst-feed-*-vistos-v1`), podcasts (`angst-podcast-*`), Pokécripto (`angst-pokecripto-*`, `angst-tcg-*`), `angst-nutri-decks-v1`, `angst-usdclp-v1`, `angst-last-local-edit-v1`. Listado y cobertura de export en `core/persistence.js` y `tests/export-coverage.mjs`.

---

## 3. Qué se hizo en esta sesión (✅ todo publicado en `main`)

| Commit | Cambio |
|---|---|
| `896f43a` | **Feed y Vitrina dentro del marco de Angst** (nuevo `MarcoAngst`; fuera `position:fixed; inset:0`). Fuera el ✕ flotante y la barra inferior Noticias/Vitrina. **Vitrina desacoplada de Feed:** ya no escribe en su Buzón (se eliminó `shared/buzon.js`). Feed es solo noticias; al cargar **descarta** del Buzón los ítems de categorías de Vitrina (decisión explícita: ahora esos guardados viven en simkl) y persiste el Buzón depurado. |
| `a19a85b` | Se quitó la franja de frases rotativas **de arriba** (`CYNICAL_SUBTITLES`). Se mantienen las del pie. |
| `bf26c3a` | **Rutinas como módulo propio** (id 11, mostrado tras Semana). Se eliminó la fila de subpestañas "semana / prácticas" (y `semanaTab`). **Encabezado fijo "angstapp"** en todos los módulos (antes repetía el nombre del módulo, p. ej. "Mi semana día a día"). |
| `cc10135` | **Exportar imagen de cine** redefinido: PNG 1080×1920 (historia de Instagram), fondo negro, solo **cartel + mi puntuación + mi reseña + firma discreta "angstapp"** (Caveat, blanco 35 %). Botón en la ficha de Vitrina, dentro de "mi reseña", solo si la película está vista **y** tiene puntuación. El cartel se achica y la letra baja (44→26 px) para que quepa la reseña; si no cabe, termina en "…". Sin reseña: cartel más grande y centrado. Reemplaza el botón viejo del Buzón. |
| `bba560c` | **Pie visible:** nuevo `useAltoLibre` (mide el espacio libre descontando el pie `.ftr`). `MarcoAngst` y Vitrina lo usan; se eliminó `min-height:100vh` de Vitrina, que sacaba el pie de pantalla. |
| `63c75f0` | Vitrina: se quitó el título repetido "vitrina audiovisual". `CineCoverFlow` **escala las tarjetas completas** (póster, textos, insignias) para ocupar el espacio libre, con tope por ancho (56 % de la pantalla, máx. 1,4×–1,6×) y centradas verticalmente; la separación crece menos que la tarjeta para que las vecinas sigan asomando. |

Lo que el usuario aprobó en el camino (para no re-preguntar): opción A (todo dentro del marco), descartar ítems de Vitrina del Buzón, Rutinas como pestaña tras Semana, "angstapp" en **todos** los módulos, firma "angstapp" en la imagen exportada.

---

## 4. EL LINEAMIENTO: "módulo colapsado, sin scroll, scroll solo al expandir"

> Es la idea central del rediseño que viene. Aplica a **todos los módulos existentes** y a **cualquier módulo nuevo**.

### 4.1 La idea, en palabras del usuario

> "El módulo recién abierto y con todos sus elementos colapsados debe ser del tamaño en que quedó Vitrina, incluyendo las frases. No hay scroll vertical y este solo se habilita cuando se expande un elemento colapsado."
>
> "Hay que rediseñar las guis de los módulos en caso de que no pueda seguir el nuevo lineamiento."

### 4.2 Definiciones

- **Marco / chrome:** encabezado `.hdr` + pestañas `.tabs` + pie `.ftr`. Siempre visibles, nunca scrollean.
- **Área libre:** la pantalla menos el chrome. Es el único espacio disponible para un módulo.
- **Estado colapsado (estado de apertura):** lo que ve el usuario al entrar a un módulo, con **todos** sus elementos colapsables cerrados.
- **Elemento colapsable:** sección, tarjeta o bloque que muestra un resumen y se despliega **en el mismo lugar** (inline) al tocarlo.
- **Estado expandido:** al menos un elemento está abierto; ahora el contenido puede superar el área libre y **recién ahí** se habilita el scroll vertical.
- **Válvula:** protección de último recurso (ver 4.5).

### 4.3 Reglas normativas

**DEBE**

1. **R1 — Llenar el área libre:** en estado colapsado el contenido del módulo mide exactamente el área libre: ni más (scroll) ni menos (hueco muerto). El pie con su frase **siempre** se ve sin scrollear.
2. **R2 — Sin scroll vertical en estado colapsado.** Ningún módulo puede necesitar scroll para usar su función principal al abrirse.
3. **R3 — El scroll nace al expandir.** Solo se habilita mientras haya un elemento expandido; al colapsar todo, vuelve a no haber scroll (y el scroll vuelve al inicio).
4. **R4 — Expansión inline.** Expandir un elemento no abre pantalla completa ni cambia de página. Las **ventanas emergentes** (formularios, confirmaciones, selectores) siguen permitidas pero **no sustituyen** a la expansión como mecanismo normal de profundidad.
5. **R5 — Si el diseño actual no cabe, se rediseña la pantalla.** No se corrige con scroll ni con letra diminuta. Es decisión de diseño que se discute con el usuario por módulo.
6. **R6 — No repetir el nombre del módulo.** La pestaña abierta ya lo dice: sin título de página, sin filas de subpestañas que lo repitan. El encabezado es siempre **"angstapp"** (identidad).
7. **R7 — Identidad visual de Angst:** tipografías **Caveat** (títulos, acentos, firma) y **DM Sans** (texto), emojis como iconografía, chrome oscuro (`#111`), frase del pie en Caveat. Firma de piezas exportadas: "angstapp" discreta (Caveat, ~35 % de opacidad, abajo al centro).
8. **R8 — Los datos no cambian por un rediseño de pantalla.** Mismas claves, mismo formato, sin migraciones. Si un rediseño exigiera tocar datos, es una decisión aparte y explícita.

**DEBERÍA**

9. **R9 — Densidad con aire:** el resumen colapsado prioriza lo que el usuario consulta a diario; lo demás queda a un toque.
10. **R10 — Adaptarse al alto real.** El área libre varía por dispositivo y barras del navegador (ver 4.4). El diseño debe degradar con elegancia: p. ej. un carrusel que **escala** (como Vitrina), filas que se compactan, en vez de tamaños fijos.
11. **R11 — Gestos y controles ya existentes se conservan** (swipe de tareas en Semana, reproductor de podcasts flotante, etc.).

### 4.4 Presupuesto de espacio (referencial; medir en cada caso)

Medido sobre las capturas del usuario (1080×2400 px; ≈2,36 px de pantalla por px CSS, calculado con una tarjeta de 160 px CSS; ancho ≈ 457 px CSS), con el navegador mostrando sus barras inferiores:

- Alto visible de la página ≈ 810 px CSS. Encabezado + pestañas ≈ 100 px CSS; pie (frase + logo) ≈ 62 px CSS.
- **El área libre de un módulo es ≈ 640–650 px CSS de alto × ≈ 457 de ancho.** Es bastante menos que una página larga: un módulo colapsado tiene que caber ahí. Eso obliga a rediseñar la mayoría de los módulos (hoy son páginas largas con scroll).
- Referencia útil: en Vitrina, dentro de esa área, los botones de categoría + filtros ocupan ≈ 200 px CSS y el carrusel recibe lo que sobra (≈ 420–450 px CSS).
- Calcular siempre: `libre = alto_visible − (encabezado + pestañas) − pie`. Probar al menos con áreas libres de 480, 560, 640 y 720 px (pantallas más chicas o con más barras del navegador dan menos).

### 4.5 La válvula (decisión tomada)

Aunque el diseño busca que nunca ocurra, si un módulo ya migrado **no cabe** en estado colapsado, **aparece scroll en vez de cortar contenido** (cortar lo haría inaccesible sin avisar). Pero la válvula **no es una solución, es un detector:** si se activa en estado colapsado, el módulo **no cumple el lineamiento** y debe rediseñarse; el agente debe marcarlo explícitamente al usuario (y, en desarrollo, emitir `console.warn("<módulo> desborda N px colapsado")`).

### 4.6 Contrato del shell (🟡 propuesto, "Fase 0")

Reemplazar las mediciones por JavaScript (`useAltoLibre`) por **reglas de diseño** del marco:

```css
.app        { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
.hdr, .tabs { flex: none; }
.contenido  { flex: 1 1 0; min-height: 0; overflow-y: hidden; }      /* colapsado */
.contenido[data-expandido="true"], .contenido[data-valvula="true"]
            { overflow-y: auto; }                                    /* expandido o válvula */
.ftr        { flex: none; }
/* la raíz de cada módulo migrado: height:100%; display:flex; flex-direction:column */
```

- API sugerida para módulos: un contexto del marco con `useExpandible(id, abierto)` que registra qué elementos están expandidos; el marco deriva `data-expandido`. Alternativa más simple: cada módulo reporta un booleano `hayExpandido`.
- **Detector de válvula:** si no hay nada expandido y `scrollHeight > clientHeight`, el marco pone `data-valvula="true"` y avisa.
- **Migración módulo a módulo:** una lista `MODULOS_MIGRADOS` (p. ej. `{9, 10}` al inicio). Los migrados usan el shell nuevo; los demás conservan el layout de hoy (alto natural, pie después del contenido) **hasta que se les haga su rediseño**. Aplicar la regla estricta a todos a la vez cortaría contenido.
- `100dvh` maneja bien las barras dinámicas de Chrome Android. Es más robusto que `window.innerHeight − top − footer` calculado a mano (que es lo que hoy hace `useAltoLibre`).
- Vitrina y Feed son los primeros en montarse sobre el marco nuevo; con eso `useAltoLibre` y `MarcoAngst` quedan **obsoletos** y deben eliminarse (R6 de §1: no dejar dos soluciones vivas).

### 4.7 Cómo diseñar el estado colapsado de un módulo

Patrones disponibles (elegir por módulo, discutir con el usuario):

1. **Carrusel que escala** (Vitrina): un elemento protagonista grande y centrado, vecinos asomando; escala para llenar el área libre.
2. **Tira de resumen + lista de secciones colapsadas:** una franja con el dato clave (p. ej. total del mes) y debajo filas-encabezado que se expanden (acordeón).
3. **Tarjetas compactas** (grilla 2×N): cada tarjeta es un elemento colapsado; al tocarla se expande inline y empuja el resto.
4. **Vista de un día/ítem activo + navegación lateral:** muestra el elemento actual completo y permite cambiar sin scroll (como las stories de Feed).

**Plantilla de propuesta por módulo** (lo que el agente debe llevar al usuario antes de implementar):

1. Qué muestra el módulo hoy (pantallas y secciones, con sus funciones).
2. Qué se vería colapsado dentro de ~640 px de alto × ~457 de ancho (boceto en texto o SVG).
3. Qué elementos se expanden y qué revelan.
4. Qué pasa a ventana emergente.
5. Qué datos toca (esperado: ninguno nuevo; R8).
6. Qué funciones quedarían a más toques de distancia (costo del rediseño) y cuáles se vuelven más rápidas.
7. Riesgos y cómo se validará.

### 4.8 Expansión: comportamiento

- Tocar un elemento colapsado lo expande **inline**; el scroll del área de contenido se habilita.
- ❓ **Abierto:** ¿se permite más de un elemento expandido a la vez, o expandir uno colapsa el anterior (acordeón exclusivo)? Recomendación del agente: exclusivo por defecto (menos scroll, más predecible), con excepciones justificadas por módulo.
- Al colapsar el último elemento, el área vuelve a `overflow:hidden` y el scroll vuelve al inicio.
- Un elemento expandido debe poder cerrarse con un toque obvio (mismo encabezado), sin gestos ocultos.

### 4.9 Ventanas emergentes, toasts, overlays

- Las ventanas emergentes existentes (muchas en Pokécripto, Presupuesto, Nutrición, etc.) **no son parte del flujo de scroll**; siguen siendo `position: fixed`. No se tocan salvo que el rediseño del módulo lo requiera.
- Los **toasts** son fijos y transitorios: permitidos.
- Para módulos nuevos: preferir expansión inline (R4); reservar emergentes para formularios y confirmaciones.

### 4.10 Checklist para módulos nuevos (definición de "listo")

- [ ] Tiene `modules/<id>/<Nombre>Page.jsx` y `manifest.js` (como los demás) y se registra en `TABS`/`page===N` de `core/App.jsx` (id nuevo; no renumerar los existentes; el orden visual se controla con `ORDER`).
- [ ] Se declara migrado al lineamiento (entra en `MODULOS_MIGRADOS`).
- [ ] Estado colapsado cabe en el área libre a 480/560/640/720 px de alto sin scroll (R1, R2).
- [ ] El scroll solo existe con algo expandido (R3).
- [ ] Sin título propio ni subpestañas que repitan la pestaña (R6).
- [ ] Tipografías y firma según R7. Emoji de pestaña definido.
- [ ] Datos: sus claves nuevas están en `core/persistence.js` y cubiertas por `tests/export-coverage.mjs`; `npm run audit:export` pasa.
- [ ] Build OK, bundle verificado **por módulo** (ver §7.2), prueba de arranque de la app completa sin errores.
- [ ] El pie con la frase y el logo es visible al abrir.
- [ ] Documentado en `docs/` si cambia comportamiento (objetivo, estado actual, archivos, criterios de aceptación).

### 4.11 Anti-patrones (no hacer)

- `min-height: 100vh` en un módulo (empuja el pie fuera de pantalla; fue el bug de Vitrina).
- `position: fixed; inset: 0` para una vista de módulo (tapa el chrome; fue el bug de Feed).
- Resolver "no cabe" con letra pequeña o scroll interno permanente.
- Repetir el nombre del módulo en un título o fila de subpestañas.
- Calcular el alto libre a mano con `window.innerHeight` si el shell ya lo provee (tras Fase 0).
- Tocar datos persistidos "de paso".
- Reestructurar varios módulos a la vez sin que el usuario haya aprobado cada diseño.

### 4.12 Referencia viva: Vitrina (qué ya cumple y qué reutilizar)

- `modules/shared/ui.jsx`: `useAltoLibre(ref, minimo, reserva, deps)` y `MarcoAngst` (ya publicados; **a reemplazar** en Fase 0).
- `modules/vitrina/VitrinaPage.jsx`: raíz que llena el área libre; sin título propio; carrusel de cine a cargo de `CineCoverFlow`.
- `modules/vitrina/cine.jsx` → `CineCoverFlow`: calcula `k` (escala) = `min((libre − 20)/altoNaturalTarjeta, 0,56·ancho/CARD_W, 1,6)`, nunca menor que 1; `ESPACIADO = ITEM_W·(1+(k−1)·0,5)`; tarjeta centrada con `top=(libre − h0)/2`. Es el patrón "carrusel que escala".
- Las listas (Microdocumentales, Melee, Conciertos) en Vitrina **aún no** cumplen el lineamiento estricto: hoy solo llenan el fondo hasta el pie; su contenido largo scrollea. Son candidatas a rediseño.
- Feed: sus vistas (story, música, lectura, fin de cola, Buzón, diagnóstico) viven en `MarcoAngst` con scroll interno en las vistas largas (lectura, Buzón). Conviene revisarlas contra R2/R3.

---

## 5. Plan por fases (🟡 propuesto, sin Go)

**Fase 0 — Infraestructura (casi invisible).** Implementar el contrato del shell (§4.6) con `MODULOS_MIGRADOS`, la válvula y el aviso de desborde. Montar Vitrina y Feed sobre él, eliminar `useAltoLibre`/`MarcoAngst`. Verificar que ningún otro módulo cambie de aspecto.

**Fase 1 — Uso diario.** Rutinas (el más chico de los diarios; propuesto como primero) y Semana (calendario semanal; 360 líneas inline en `App.jsx`; probablemente el más delicado: tareas, swipe, reflexión, utilidades).

**Fase 2 — El resto, de a uno.** Empezar por los más chicos (Fadiman, Presupuesto) y terminar con Pokécripto. Cada módulo: propuesta (plantilla §4.7) → aprobación → implementación → publicación → revisión del usuario en su celular (captura) → ajustes.

Entre fases, el usuario decide el orden; el agente no debe adelantarse a módulos no aprobados.

### 5.1 Decisiones abiertas del lineamiento (❓)

1. ¿Expansión exclusiva (un elemento abierto a la vez) o múltiple? (recomendado: exclusiva).
2. ¿Primer módulo a rediseñar tras la Fase 0? (propuesto: Rutinas).
3. Para Feed: ¿sus vistas largas (lectura, Buzón) deben pasar a "elemento expandido" para cumplir R2/R3, o se aceptan como vistas inmersivas con scroll interno?
4. Para las listas de Vitrina (Microdocs/Melee/Conciertos): ¿qué se muestra colapsado?
5. Nada de esto está aprobado para implementar: **falta el Go de la Fase 0**.

---

## 6. Otros pendientes (fuera del lineamiento)

### 6.1 Descubrimiento musical (🟡 plan aceptado, falta Go de implementación)

Se discutió y el usuario aceptó empezar por goth/dark metal y permitir YouTube para vkei ("Suena bien"). Se dejó **después** del lineamiento, salvo que él lo reordene.

- **Qué:** una categoría nueva "Descubrimiento" en Feed, **separada** de "Dark scene / Música" (hoy con Side-Line, Post-Punk.com, Electrozombies), para no alterar lo actual y poder medir su rendimiento. Solo **noticias de lanzamientos** (no entrevistas ni giras), de bandas **vkei (visual kei)** y de la **escena dark/goth metal**, siempre con reproductor. Se muestra con la tarjeta de música existente.
- **Fuentes candidatas** (RSS **sin verificar**; la primera corrida automática lo dirá): Decibel, Invisible Oranges y Doomed Nation para goth/dark metal (publican estrenos y "full album streams"); **vkgy** para vkei (noticias y resúmenes mensuales). Esa escena vive sobre todo en Spotify y YouTube, por lo que con "solo Bandcamp" el vkei saldría casi vacío → aceptar YouTube.
- **Reproductor Bandcamp resuelto desde el link:** Bandcamp no tiene oEmbed, pero **cada página de release publica su reproductor (`og:video` → `EmbeddedPlayer/album=…` o `track=…`) en sus metadatos** (comprobado en una página real). Entonces, si una noticia enlaza a un release de Bandcamp, el script abre esa página y extrae el embed; si falla → YouTube; si tampoco → se descarta (regla actual). Con tope de peticiones por corrida y timeout, User-Agent decente. ⚠️ El comentario en el repo que dice que no se puede construir un embed de Bandcamp desde un link plano es **inexacto**; corregirlo al implementar.
- **Filtro de títulos:** ampliar el de "es noticia de release" **solo para esta categoría** con formatos como "Full Album Stream", "Early Album Stream", "Premiere".
- **Dónde tocar:** `modules/feed/scripts/build-feed.mjs` (heurística de release, cuota por fuente, resolución de embeds), `modules/feed/scripts/lib/embeds.mjs` (orden de resolución: YouTube → Bandcamp si el post ya trae iframe → SoundCloud), `modules/feed/feeds.json` (fuentes), `shared/constants.js`/`catalog.js` (colores y categorías). El panel de diagnóstico de Feed (`DiagPanel`) ya muestra conteos por fuente: usarlo para medir el rendimiento tras la primera corrida (workflow `update-feed.yml`, cada 4 h).
- **Riesgos:** no verificado desde el entorno de desarrollo que Bandcamp responda bien a los runners de GitHub ni que los RSS existan; el rendimiento real solo se ve en la primera corrida.

### 6.2 Exportar imagen de cine (✅ hecho; falta feedback)

Pendiente: que el usuario la pruebe con una película real en su celular. En las pruebas se usó tipografía de respaldo (sin Caveat/DM Sans) y pósters sintéticos. Posibles ajustes que él pida: tamaño del cartel, peso/posición de la firma "angstapp", comportamiento con reseñas muy largas.
Requisito de aparición del botón: película **vista** + **puntuación** guardada (si no hay puntuación el botón no aparece).

### 6.3 Títulos redundantes en otros módulos (🟡 ofrecido, no aprobado)

Con R6 (la pestaña ya dice el módulo), conviene revisar si otros módulos repiten su nombre en un título interno. Se ofreció revisarlo; no hay Go. Se resolverá de forma natural en el rediseño de cada módulo.

### 6.4 Deuda y limpieza conocidas

- `modules/planner/index.js`: barril **huérfano** (re-exporta archivos que no existen y no se importa en ningún lado). Se le quitó solo `CYNICAL_SUBTITLES`. Candidato a eliminar (pedir aprobación).
- `modules/feed/index.html`: archivo **legacy** autónomo con código viejo (aún contiene el título "vitrina audiovisual"); no forma parte del build. Verificar y proponer su eliminación.
- `CineExtendedView` conserva la prop `hideActions`, hoy sin llamadores que la usen para cine.
- Archivo `feeder-marco-y-desacople.patch` generado durante la sesión: **obsoleto** (ya está en `main`). Ignorar.
- Pendientes históricos del proyecto (del contexto previo del usuario): proporción del reflejo en `CineCoverFlow`, beats 2–4 de Melee (día 1 / top 8 / cierre), badge de `FormatoTag` para proyecciones de Melee, big names SSBMRank, historial de torneo/rachas/rivalidades, "Angst app" más allá del feed, módulo Jobs.

---

## 7. Cómo validar y publicar (aprendido en esta sesión)

### 7.1 Línea base y build

```bash
git clone --depth 1 https://github.com/cipinzas-hash/feeder.git && cd feeder
npm ci
cp index.html /tmp/index.committed.html
node build/assemble.mjs        # debe reproducir index.html idéntico (cmp)
npm run audit:export           # export-coverage + vitrina-restore
```

### 7.2 Validación sin navegador real (lo que se hizo)

El entorno de desarrollo usado **no tenía navegador**. Se validó así (todo fuera del repo, en un directorio temporal con `jsdom`, `react@18`, `react-dom@18`, `esbuild` y, para imágenes, `canvas`):

- **Bundle por módulo, no por texto global:** esbuild reformatea literales (`position:"fixed",inset:0` pasa a `position: "fixed", inset: 0`), así que contar patrones en todo `index.html` engaña. Cortar el bundle por los comentarios `// modules/...` y revisar **cada módulo** por separado.
- **Arranque de la app completa** (`core/App.jsx` empaquetado a CJS con `--define:process.env.NODE_ENV="test"`): `global.React`, `global.ReactDOM`, `global.XLSX = {}`, `matchMedia` simulado; navegar las pestañas con `.tab` y comprobar encabezado, orden, pie y **0 errores** de runtime.
- **Geometría simulada** (jsdom no calcula layout): sobrescribir `getBoundingClientRect`, `offsetHeight`/`offsetWidth` y `innerHeight` para forzar un caso (p. ej. pantalla 2000, contenido en y=800, pie 60) y comprobar que alto/escala/posición salen como se calcula.
- **Datos falsos para Vitrina:** simular `fetch` devolviendo `{generatedAt, categories:[{cat:"Películas", items:[...]}]}` para `cine.json`; sin eso el carrusel no se dibuja.
- **Imágenes (canvas):** `node-canvas` + `document` simulado (`createElement('canvas')` con `toBlob`) permite generar los PNG reales de la exportación y **verlos**. Las fuentes de Angst no están disponibles offline: el diseño se valida, la tipografía final no.
- ⚠️ **jsdom no puede confirmar que un módulo "cabe" sin scroll** (no hay layout real). Para el lineamiento esto es crítico: si el agente dispone de un navegador real (Playwright/Chromium), validar con viewports como 457×810 (el del usuario), 412×915 y 360×640 que `scrollHeight <= clientHeight` del área de contenido en estado colapsado. Si no, pedir al usuario una **captura del celular** tras publicar cada módulo y tratarla como criterio de aceptación.
- Los hooks de test comparten estado por **instancia de módulo**: si se empaquetan por separado el componente y su módulo de estado, no se ven entre sí (falsos fallos). Exportar ambos desde el mismo bundle.

### 7.3 Publicar (el sitio es `main` → GitHub Pages)

```bash
git add -A && git commit -m "<mensaje en español, con el porqué>"
AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"
git -c http.extraheader="$AUTH" fetch origin main
# si el remoto avanzó (bots), rebasar; el token NO queda guardado en .git/config
git rebase FETCH_HEAD
git -c http.extraheader="$AUTH" push origin HEAD:main
```

- Los bots commitean datos a `main`: **siempre** `fetch` + `rebase` antes de pushear. Para saber si el remoto tocó código fuente o `index.html`, comparar **antes** del rebase (`git diff --name-only HEAD~1 FETCH_HEAD`); después del rebase esa comparación es vacía y engaña.
- **Verificar lo publicado:** descargar `https://raw.githubusercontent.com/cipinzas-hash/feeder/main/index.html` y compararlo (`cmp`) con el `index.html` construido y validado localmente. GitHub Pages tarda un par de minutos en reflejarlo.
- Mensaje al usuario: qué cambió, qué se validó, **qué no se pudo ver** (aspecto real en su celular) y qué decide él a continuación.

---

## 8. Glosario rápido

- **Marco / chrome:** encabezado + pestañas + pie del shell.
- **Área libre:** pantalla − chrome.
- **Colapsado / expandido:** estados de un módulo según tenga o no un elemento abierto.
- **Válvula:** scroll de seguridad que además delata un módulo que no cumple el lineamiento.
- **Vitrina:** catálogo audiovisual (cine, series, animación, microdocs, Melee, conciertos); sus guardados viven en **simkl**.
- **Feed:** stories de noticias; su **Buzón** guarda solo noticias.
- **Henry:** rol de arquitecto/diagnosticador en el flujo histórico (en desuso como protocolo); **Claude:** ejecutor.
