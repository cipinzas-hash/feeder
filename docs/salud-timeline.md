# Salud — línea de tiempo de eventos (schema v2)

Issue: #23. Reemplaza el enfoque anterior de Salud (episodios + registro diario por persona + citas regulares sin fecha). **Solución vigente: este documento.**

## Qué es
Un solo registro de todo lo relacionado con salud, familiar e individual: enfermedades, síntomas/fiebre, medicamentos, tratamientos y citas médicas, en una línea de tiempo con filtro Familia / persona. Sirve para tener datos que compartir con un médico (pantalla "resumen", texto copiable por persona y rango de fechas). Las citas se registran solas en el planner semanal.

## Datos (`kidsHealth`, clave sin cambios)
`{schemaVersion:2, family[], profiles{}, events[]}` — `profiles[p]` conserva condiciones, alergias, medicación habitual, vacunas y `growthLog` (curva de crecimiento, fuera de la línea de tiempo).

Evento: `{id, personId, type, start, startTime?, end?, parentId?, ...}`
- `enfermedad`: episodio (`hazardLevel` = el del último registro de síntomas, `missedDays`). Agrupa hijos por `parentId`.
- `sintoma`: síntomas + lecturas de temperatura `[{t,v}]` con hora; abre un episodio si la persona no tiene uno activo.
- `medicamento` / `tratamiento`: dosis, frecuencia, inicio y fin opcional (con fin se dibuja como barra).
- `cita`: fecha y hora reales, repetición en meses opcional (4 ocurrencias). Cada ocurrencia crea en el planner una tarea fija (`healthEventId`) y una tarea "preparar:" el día anterior a las 21:30. Editar o eliminar la cita actualiza o borra esas tareas y el marcador `doctor` que ella puso (`markedDates`).

## Migración v1 → v2 (explícita, no destructiva)
`migrateKidsHealth` corre al cargar y al importar un respaldo; no escribe por sí sola (se persiste en el primer guardado desde Salud).
- `episodes[]` → `enfermedad` + un `sintoma` por día; `temperatura` → una lectura sin hora.
- `profiles[p].citasRegulares[]` → eventos `cita`. No tenían fecha: se toma su fecha de creación (el `id`) y se avanza por su frecuencia hasta la primera ocurrencia ≥ hoy. Las tareas que ya habían proyectado al planner no estaban ligadas a nada: quedan como están (no se duplican, pero tampoco se borran desde Salud).
- `dailyLog` (incluye los "sin novedades") deja de usarse.
- Lo original queda intacto en `kidsHealth.legacy` (`episodes`, `dailyLog`, `citasRegulares`) como respaldo; nada lo lee.

## Obsoleto
`kidsHealth.episodes`, `dailyLog`, `profiles[p].citasRegulares` y las tarjetas diarias "tap = ok". Consumidores actualizados: `core/stress.js` (carga de estrés), `CalendarModal` y `SearchModal` en `core/ui.jsx`.

## Archivos
`modules/salud/saludModel.js` (lógica pura) · `SaludPage.jsx` (UI) · `GrowthView.jsx` (curva de crecimiento, movida sin cambios de comportamiento) · `tests/salud-model.mjs`.
