# Salud — línea de tiempo de eventos (schema v2)

Issues: #23 (modelo), #28 (personas), #29 (lineamiento, marca 🏥 y ➕ Registrar). Reemplaza el enfoque anterior de Salud (episodios + registro diario por persona + citas regulares sin fecha). **Solución vigente: este documento.**

## Qué es
Un solo registro de todo lo relacionado con salud, familiar e individual: enfermedades, síntomas/fiebre, medicamentos, tratamientos y citas médicas, en una línea de tiempo con filtro Familia / persona. Sirve para tener datos que compartir con un médico (pantalla "resumen", texto copiable por persona y rango de fechas). Las citas se registran solas en el planner semanal.

## Datos (`kidsHealth`, clave sin cambios)
`{schemaVersion:2, family[], profiles{}, events[]}` — `profiles[p]` conserva condiciones, alergias, medicación habitual, vacunas y `growthLog` (curva de crecimiento, fuera de la línea de tiempo).

Evento: `{id, personId, type, start, startTime?, end?, parentId?, ...}`
- `enfermedad`: episodio (`hazardLevel` = el del último registro de síntomas, `missedDays`). Agrupa hijos por `parentId`.
- `sintoma`: síntomas + lecturas de temperatura `[{t,v}]` con hora; abre un episodio si la persona no tiene uno activo.
- `medicamento` / `tratamiento`: dosis, frecuencia, inicio y fin opcional (con fin se dibuja como barra).
- `diagnostico`: diagnóstico (`title`), quién lo dio (`medico`), nota; se enlaza al episodio activo y, si lo hay, nombra al episodio. Tipo aditivo dentro de `events`, sin migración.
- `cita`: `title` = especialidad, `medico` opcional, fecha y hora reales, repetición en meses opcional (4 ocurrencias). Cada ocurrencia crea en el planner una tarea fija (`healthEventId`, texto "especialidad paciente — médico") y una tarea "preparar:" el día anterior a las 21:30. Editar o eliminar la cita actualiza o borra esas tareas.

## La cita es la fuente de la marca 🏥
La marca `doctor` del calendario **no se guarda** para las citas: se deriva. `effectiveMarks(calMarks, events)` = marcas guardadas ∪ días con cita, y es lo que leen el calendario, la semana (que muestra "🏥 hora · paciente · especialidad", elástico y con la hora primero), el dashboard y `computeStressScore` (que deriva por su cuenta, sin contar doble). Las escrituras siguen yendo al `calMarks` guardado. Consecuencias:
- El pincel "Doctor" del calendario abre el formulario de cita del día (en un día con marca guardada de antes, tocar de nuevo la quita, como siempre).
- Las marcas 🏥 guardadas antes de las citas quedan intactas y se siguen viendo, sin datos.
- `autoMarkDoctor` (por palabras clave en el texto de una tarea) puede quitar la marca guardada, pero ya no afecta a las citas porque su marca es derivada. Al borrar o mover una cita se limpia solo la marca guardada que ella dejó (`planCita`).
- El recordatorio anual de medir y el episodio nuevo en WARNING/CRITICAL ya no marcan 🏥: lo primero es solo una tarea; lo segundo muestra el aviso "agendar cita", que abre el formulario con la persona y la fecha de hoy.

## Migración v1 → v2 (explícita, no destructiva)
`migrateKidsHealth` corre al cargar y al importar un respaldo; no escribe por sí sola (se persiste en el primer guardado desde Salud).
- `episodes[]` → `enfermedad` + un `sintoma` por día; `temperatura` → una lectura sin hora.
- `profiles[p].citasRegulares[]` → eventos `cita`. No tenían fecha: se toma su fecha de creación (el `id`) y se avanza por su frecuencia hasta la primera ocurrencia ≥ hoy. Las tareas que ya habían proyectado al planner no estaban ligadas a nada: quedan como están (no se duplican, pero tampoco se borran desde Salud).
- `dailyLog` (incluye los "sin novedades") deja de usarse.
- Lo original queda intacto en `kidsHealth.legacy` (`episodes`, `dailyLog`, `citasRegulares`) como respaldo; nada lo lee.

## Obsoleto
`kidsHealth.episodes`, `dailyLog`, `profiles[p].citasRegulares` y las tarjetas diarias "tap = ok". Consumidores actualizados: `core/stress.js` (carga de estrés), `CalendarModal` y `SearchModal` en `core/ui.jsx`.

## Pantalla (lineamiento de diseño, `docs/angst-lineamiento-y-handoff.md` §4)
Colapsada y sin título propio (R6): chips Familia / personas, franja de estado (episodios activos + próxima cita + aviso de cita sugerida), cuatro filas-encabezado con resumen (Episodios, Citas, Medicación y tratamientos, Historial) y "+ agregar". Expansión **exclusiva** inline; el scroll aparece solo al expandir (`data-expandido`) y un `console.warn` avisa si colapsada desborda. Ficha, crecimiento, resumen y datos de persona son ventanas emergentes. La pestaña usa `app-fit` (como Semana y Presupuesto). Medido en navegador: colapsada cabe sin scroll desde ≈374 px de alto libre (362 px con una persona filtrada), entre 360 y 800 px de ancho.

## ➕ Registrar
Entrada "🩺 Salud" (`SaludRegistro`, mismas acciones que la pestaña, `saludActions.js`) con Cita, Diagnóstico y Síntoma.

## Archivos
`modules/salud/saludModel.js` (lógica pura) · `saludActions.js` (guardar/borrar con sincronía al planner) · `SaludPage.jsx` (UI y `SaludRegistro`) · `GrowthView.jsx` (curva de crecimiento, movida sin cambios de comportamiento) · `tests/salud-model.mjs`.
