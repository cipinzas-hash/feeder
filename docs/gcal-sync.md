# Sync planner (semana) ↔ calendario Familia de Google

Issue: #26. Estado: implementado en **modo seco**; se activa con la variable de repo `GCAL_SYNC_LIVE=true`.

## Objetivo
Los hijos (cuentas supervisadas) ven en su Google Calendar lo que viene y lo que deben hacer. Lo que ellos creen en
ese calendario aparece en Angst. Un solo calendario, el "Familia" nativo del grupo familiar (el dueño es Cristopher).

## Archivos
- `modules/feed/scripts/gcal-sync-lib.mjs` — lógica pura (qué pasa, recurrencias, plan, bandeja). Probada en `tests/gcal-sync.mjs` (`npm run test:gcal`).
- `modules/feed/scripts/build-gcal-sync.mjs` — I/O: lee el estado, habla con la Calendar API, escribe la bandeja.
- `.github/workflows/update-gcal-sync.yml` — cada 30 min; checkout de feeder, de Angst-data (`main`) y del estado (`state-sync`).
- `core/App.jsx` — botón 🔒 `privada` en tareas fijas, tareas normales y recurrentes.
- Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (scope `calendar.events`, app OAuth "In production").

## Angst → Familia
Ventana: hoy → +42 días (hora de `America/Santiago`; el calendario está en UTC, así que cada evento con hora lleva su `timeZone`).

| Origen en el estado | Evento |
|---|---|
| `dayData[f].tasks[]` con `deadline {h,m}` | con hora (dura 30 min; `deadline` es una hora límite). Un `deadline` 00:00 se trata como sin hora (día completo) |
| `dayData[f].tasks[]` sin `deadline` | día completo |
| `recurring[]` (misma regla que `nextRecurDate` de App.jsx; `every3` = cada 2 días, "c/2d" en la UI) | día completo por ocurrencia; una pospuesta (`postponed` + `recurringId` ese día) se omite |
| `calMarks[f]` | día completo: social, work, colegio, doctor, medico, gym, compras |
| tarea con `urgent` (baliza) o `healthEventId`; recurrente con `urgent`; calmark `doctor`/`medico` | además "Mañana: …" el día anterior (día completo). El calmark doctor cubre las citas anotadas como tareas sueltas: no hay heurística por texto ("cita" también significa otra cosa) |

**No pasan:** `schedule[]` (horario personal), calmarks `romantic`/`melee`/`pokemon` (y cualquier tipo nuevo hasta
agregarlo a `MARCAS`: es allowlist), tareas "preparar:" (`prepReminder` o texto que empieza así), tareas y recurrentes 🔒
`privada`, tareas hechas, tareas con `recurringId` (las emite la recurrente) y marcadores de pospuesta.

El aviso del día anterior es un **evento marcador** y no un recordatorio: los recordatorios de la API son privados de
quien los crea y no llegan a los hijos.

Propiedad: solo se tocan eventos con `extendedProperties.private.angst = "1"` (clave estable en `angstKey`:
`t:<fecha>:<id>`, `r:<id>:<fecha>`, `c:<fecha>:<tipo>`, y `…>m` para marcadores). Lo que un hijo edite o borre de esos
se revierte en la corrida siguiente. Lo demás del calendario no se toca.

Frenos: se aborta si el plan borra más de 40 eventos o si el estado no trae eventos pero el calendario sí.

## Familia → Angst
Los eventos de otras manos (los de los hijos y los que ya existían) en la misma ventana se escriben en
`Angst-data/google-inbox.json` (`{generatedAt, window, events:[{id, summary, allDay, start, end, creator, updated}]}`).
Es un archivo del bot, fuera del estado exportado: no entra al last-write-wins de 📤/📥. **La UI de Angst que lo
muestre en la semana todavía no existe** (queda para otro cambio).

## Persistencia / migración
`privada` es un campo nuevo y aditivo en tareas y recurrentes: ausente = no privada. Sin migración. Las tareas
arrastradas (`carried`) lo conservan porque se copian con spread. Una tarea con `recurringId` no usa su propio
`privada`: manda el de la recurrente.

## Modo seco y activación
Sin `GCAL_SYNC_LIVE=true` el script no escribe en Google: deja el plan (con textos) en `Angst-data/gcal-sync-plan.json`
(privado). feeder es público y sus logs también, por eso el log solo trae conteos. Para activarlo: Settings → Secrets and
variables → Actions → Variables → `GCAL_SYNC_LIVE` = `true`. Una corrida manual con `live=true` lo prueba una vez.

## Criterios de aceptación
1. `npm run test:gcal` pasa; `node build/assemble.mjs` limpio y `privada` presente en `index.html`.
2. Corrida en seco: el plan coincide con lo esperado y el log no trae textos.
3. Primera corrida live: los eventos aparecen en "Familia" con la marca de Angst y una segunda corrida da 0 cambios.
4. Una cuenta supervisada ve el calendario y puede crear un evento; aparece en `google-inbox.json`.
