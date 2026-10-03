# Ejercicio: rutina Día A (lunes) / Día B (viernes) — issue #22

## Objetivo
La vista de sesión del módulo Ejercicio muestra solo la rutina vigente, con guía por ejercicio para favorecer series limpias.

## Comportamiento
- Dos pestañas: **Día A** (lunes) y **Día B** (viernes). Pestaña inicial: lunes → A, martes a viernes → B, sábado y domingo → A. Se elige a mano; no se persiste.
- Cada ejercicio: prescripción de la rutina (series × rango, descanso, ritmo), peso de hoy, última marca, marca de la última vez por serie, calentamiento (solo guía), aviso de progresión y guía de ejecución (dibujo en 2 posiciones, mapa de músculos, señales de montaje, recorrido, "va bien si", "corrige si", cuándo cortar la serie).
- La guía se abre sola hasta marcar la primera serie del día.
- Progresión: si la última sesión de la rutina completó todas las series en el tope del rango, aparece "Subir a …" (o "Menos asistencia …" en dominadas y dips). Hip thrust y elevación de piernas muestran un texto de progresión sin regla de peso.
- Peso que se propone: subida confirmada a mano (si es posterior a la última marca) > último peso marcado desde `RUTINA_DESDE` > sugerido de la rutina. Las marcas anteriores a `RUTINA_DESDE` no fijan el peso.

## Archivos
- `modules/ejercicio/rutina.js` — datos estáticos de la rutina y guías (nuevo).
- `modules/ejercicio/figuras.js` — dibujos SVG por id de ejercicio (nuevo). Ejercicios sin dibujo muestran guía y mapa sin él. Las figuras se construyen con helpers de proporciones reales (fracciones de la estatura: brazo 0,186 · antebrazo 0,146 · muslo 0,245 · pierna 0,246 · hombros a 0,818 · cadera a 0,53); todo dibujo nuevo debe usarlos.
- `modules/ejercicio/EjercicioPage.jsx` — vista de sesión; catálogo con 3 ejercicios nuevos (`press-banca-b`, `peso-muerto-rumano`, `hip-thrust-kb`); `BodyHeatmap` con variante `compact`; `getExHistory(exId, exOverride)`.

## Persistencia / migración
- `ejercicioLog`, archivo, historial, semanas, stats y editor: sin cambios de formato ni de lectura.
- No se escribe ni se migra nada de forma implícita.
- Único dato nuevo: al tocar "Subir a …" / "Menos asistencia …" se guarda en `customEjercicios[id]` el ejercicio fusionado completo (igual que el toggle de archivado, ver issue #1) más `pesoRutina: {kg, fecha}`. Es un campo opcional; sin él todo funciona.
- El calentamiento no se registra como serie (el heatmap cuenta cada serie marcada como serie efectiva).

## Obsoleto (reemplazado en esta vista)
Acordeón por grupo muscular de la sesión, `getProgressionSuggestion`, `getCalisteniaProgression`, `applyProgression` y el estado `openGroup`. Siguen en el historial de git. Los mazos no se usan como plan de rutina y no se tocaron.

## Validación
Sintaxis y build (`npm run build`); contenido del bundle final (`index.html`); prueba de humo con jsdom: render de sesión con el backup real, pestañas, guía, calentamiento, marcar serie (formato `{done,reps,peso}` bajo `<id>_<n>`), aviso y aplicación de progresión, y render de historial, semanas, stats y editor.

## Dibujos
Los 12 ejercicios de la rutina tienen dibujo (inicio/final). Las figuras de perfil se resuelven por cinemática inversa con los largos reales (`ik`, `brazo`, `pierna`, `cuerpo` en `figuras.js`). Las flechas naranjas indican el sentido del movimiento entre el dibujo de inicio y el de final.
