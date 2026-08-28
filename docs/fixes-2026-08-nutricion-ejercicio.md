# Fixes aplicados — Ejercicio / Nutrición / Feed (agosto 2026)

Resumen técnico para que Henry (u otro agente) pueda actualizar/cerrar los
issues correspondientes en GitHub — el PAT usado en esta sesión no tiene
scope de escritura sobre Issues, así que quedaron sin comentar/cerrar
directamente.

Todos los commits están en `main` de `cipinzas-hash/feeder`.

---

## Issue #1 — Bug: jalón al pecho desaparecido

**Estado: resuelto, listo para cerrar.**

**Causa real:** `applyProgression()` en `EjercicioPage.jsx` (la función que
aplica la sugerencia automática de "subir X kg tras 2 sesiones en el
tope") guardaba el override en `customEjercicios` como
`{...(customEjercicios?.[ex.id]||{}), id:ex.id, pesoActual:newPeso}` — si
no existía override previo, el resultado era literalmente `{id,
pesoActual}`, sin `muscles`/`name`/etc. Como el merge usa
`customOverrides[e.id] || e` (reemplazo total, no combinación de campos),
y ambas vistas (sesión activa y "editar catálogo") filtran por
`(e.muscles||[]).some(...)`, un override sin `muscles` queda invisible en
**toda** la UI.

**Fix (commit `d490f36`):** `applyProgression` ahora hace
`{...ex, pesoActual:newPeso}` — spreadea el objeto `ex` completo (ya viene
fusionado vía `allExercicios` en el call site), igual que ya hacía el
toggle de archivado. Se confirmó que es el único punto de escritura de
`customEjercicios` con este patrón roto (`saveExercise`, usado por el
toggle de archivado y el editor completo, siempre pasa el objeto entero).

**Dato corrupto del usuario:** reparado manualmente reimportando un backup
con el override de `jalon-pecho` eliminado (vuelve al default limpio del
catálogo). El historial de series (`ejercicioLog`, 7 entradas) no se tocó.

---

## Issue #2 — Búsqueda de alimentos ignora acentos/puntuación

**Estado: resuelto, listo para cerrar.**

**Causa:** tres comparaciones de texto distintas en `NutricionPage.jsx`
usaban `.toLowerCase().includes(...)` sin normalizar acentos ni
puntuación — `platano` no encontraba `Plátano`.

**Fix (commit `cc1d348`):** nueva función `normalizeSearchText()` agregada
a `core/format.js` (mismo patrón de import que `fmtCLP`, ya usado por
otros módulos): minúsculas + NFD + strip de diacríticos + puntuación
tratada como separador + espacios colapsados. Aplicada en los 3 puntos de
comparación (`searchResults`, `localMatch`, `hits` contra `foodsDb`). El
nombre mostrado al usuario (`f.name`) nunca se reasigna — la normalización
solo se usa para comparar, nunca se persiste ni se muestra.

---

## Issue #3 — USDA no se descarga / Issue #6 — Feed no incorpora fuentes nuevas

**Estado: resuelto, listo para cerrar ambos (misma causa raíz).**

Estos dos terminaron siendo el mismo bug de fondo, descubierto en dos
pasadas:

**Primer diagnóstico (parcial, commit `76f36e7`):** los runs del 22/8 y
24/8 fallaban en ~1-4s con error explícito. Se agregó reintento con
backoff para fallas transitorias (red, HTTP 429/5xx). Esto era correcto
pero no era la causa de fondo — **incluso los runs "exitosos" (incluido
el primero, 21/8) venían devolviendo `count:0, foods:[]` sin ningún error**,
así que nunca se notó.

**Segundo intento (commit `4dca35d`):** se corrigió el formato del
parámetro `dataType` (de claves repetidas a separado por comas, según
documentación de la API). No resolvió el problema — el run con este fix
paginó completo (~44s, evidencia de que sí traía datos reales) pero
`foods.length` terminó en 0 de nuevo. Se agregó una salvaguarda: si el
resultado final queda en 0, el script aborta con error en vez de escribir
un JSON vacío como si fuera éxito (esto fue lo que expuso que el problema
seguía sin resolverse).

**Causa real (commit `902741b`):** la API de USDA FDC es inconsistente
entre endpoints en la forma de `foodNutrients` — a veces anidada
(`nutrient:{name,number}` + valor en `amount`) y a veces plana
(`nutrientName`/`nutrientNumber` + valor en `value`). El código de
`extractNutrient()` solo reconocía la forma plana, así que en `/foods/list`
(que aparentemente usa la forma anidada) **cada ítem de cada página se
filtraba silenciosamente** (kcal/prot quedaban `null` para los ~200 ítems
de cada página, ninguno pasaba el filtro). `extractNutrient()` ahora
reconoce ambas formas. Confirmado con datos reales: **8,145 alimentos**
en el run posterior a este fix.

Se dejó además un log de diagnóstico (forma cruda del primer ítem de la
página 1) por si hiciera falta depurar esto de nuevo.

**Nota para Henry:** si el issue #6 tenía alcance más amplio que "el feed
de nutrición no trae nada" (por ejemplo, otras fuentes del Feed general
además de nutrición), habría que revisar si aplica a algo más — esta
sesión solo confirmó y arregló el caso de nutrición.

---

## Issue #5 — Ingestas con calorías desconocidas/estimadas

**Estado: resuelto, listo para cerrar.**

**Fix (commit `ad2292b`):** nuevo modal "registrar sin datos exactos"
(link junto al buscador principal de `NutricionPage.jsx`, siempre
visible). Tres niveles de certeza en las entradas de `nutriLog`:

- **exacto** — entradas normales existentes, sin cambios, campo
  `certainty` ausente (retrocompatible, sin migración de datos vieja).
- **estimado (🟡)** — descripción libre + rango opcional de kcal/prot.
  `kcal`/`prot` guardan el punto medio del rango (para que `dTotals` y la
  cascada semanal sigan sumando sin tocar esa lógica); el rango se
  conserva aparte (`kcalRange`, `protRange`) para mostrarlo tal cual.
- **desconocido (🔴)** — descripción libre, sin ningún número. Nunca
  muestra "0 kcal" (se confundiría con una ingesta real de cero calorías,
  requisito explícito del issue) — muestra un aviso en su lugar.

En el historial, estas entradas no abren la "ficha" de detalle (no tienen
`id` de catálogo real) y el total diario se marca con `~` + aviso cuando
el día incluye alguna estimación.

**Alcance no cubierto (mencionado explícitamente a Cristopher, quien lo
aceptó):** el "meta-análisis" (cascada semanal, bono por estrés) sigue
sumando con el punto medio, sin propagar la incertidumbre más allá del
indicador visual del total diario. Si hace falta que la incertidumbre se
refleje en cálculos semanales, es trabajo aparte.

**Integración con Gemini:** diferida — el propio issue la marca como
trabajo futuro, no de este fix.

---

## Issue #4 — Mazos → comidas individuales + meta-análisis con Gemini

**Estado: PARCIAL — solo Fase 1 completa. No cerrar, dejar abierto con
comentario de progreso.**

Este issue se dividió en 4 fases (acordado con Cristopher dado el tamaño
real del trabajo — data model + pipeline de micronutrientes + algoritmo
de tierlist + integración de IA es mucho más que un fix puntual).

### Fase 1 — Mazos como comidas individuales (✅ completa)

**Bug real encontrado de paso:** `applyDeck()` **sobrescribía el registro
del día completo** (`saveNutriLog({...nutriLog, [dateKey]: mapped})`, no
hacía append). Si ya habías registrado desayuno y almuerzo y cargabas un
mazo de cena, se perdía todo lo anterior sin aviso.

**Fix (commits `ec9d20c`, `0088d5d`):**
- Los mazos ganan un campo `meal` a nivel de mazo (antes era por ítem,
  permitiendo que un solo mazo abarcara varias comidas — exactamente el
  problema que describía el issue).
- `applyDeck()` ahora **agrega** los ítems a la comida que el mazo
  declara, en vez de sobrescribir el día.
- Mazos guardados antes de este cambio (sin campo `meal`) se migran solos
  al abrirlos: `inferDeckMeal()` infiere la comida más frecuente entre sus
  ítems existentes, sin borrar ni alterar el mazo hasta que el usuario lo
  guarde de nuevo explícitamente.
- Editor de mazos: selector único de comida (antes: sección agrupada por
  comida + botón de mover cada ítem individualmente, ya no aplica con un
  mazo = una comida).
- Menú de mazos guardados: muestra el emoji de la comida, y el texto
  cambió de "cargar" (sonaba no-destructivo cuando no lo era) a "agregar a
  hoy".

### Fase 2 — Evaluación nutricional objetiva (⬜ pendiente)

Requiere extender `modules/feed/scripts/build-nutricion.mjs` para bajar
**fibra y micronutrientes** de USDA — hoy el pipeline solo extrae
kcal/prot/carbs/fat. Con la forma de `foodNutrients` ya resuelta (ver
issue #3 arriba), agregar más nutrientes a `extractNutrient()` debería ser
mecánico. Después: calcular densidad nutricional, balance de macros y
variedad de grupos alimenticios por mazo. Frecuencia de consumo puede
sacarse de `nutriLog` histórico (cuántas veces se registró ese mazo).

### Fase 3 — Tierlist explicable (⬜ pendiente)

Algoritmo de scoring (S/A/B/C o similar) basado en la Fase 2, con
explicación de qué componentes suman/restan. Vista nueva en la UI.

### Fase 4 — Gemini como capa de sugerencias (⬜ pendiente)

Reusar el helper de Gemini que ya existe en el proyecto (`GEMINI_API_KEY`
ya está configurado como secret del repo). Gemini recibe los datos
objetivos de las fases 2/3 — no calcula nutrientes por su cuenta. Requiere
un flujo explícito tipo "usar esto para ajustar el mazo" — nunca
automático, para no sobrescribir silenciosamente registros existentes
(principio que el propio issue #4 declara explícitamente).

---

## Para Henry

1. Comentar y cerrar issues **#1, #2, #3, #5, #6** citando los commits de
   arriba.
2. Dejar **#4 abierto**, comentar el progreso de Fase 1 (commits
   `ec9d20c`, `0088d5d`) y las fases 2-4 pendientes tal como están
   descritas acá.
3. Si el PAT que uses tiene scope de escritura sobre Issues (el de esta
   sesión no lo tenía), esto se puede hacer directo vía API en vez de
   manual.
