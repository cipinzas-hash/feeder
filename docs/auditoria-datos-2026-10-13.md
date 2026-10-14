# Auditoría de datos — 13-oct-2026

**Objetivo:** todo campo llenable de la app se guarda en el JSON (no solo en
localStorage) y se exporta a Angst-data (💾 / 📤), incluidos los avances de Vitrina.

## Qué se encontró y qué se hizo

| # | Hallazgo | Cambio |
|---|---|---|
| 1 | Restaurar desde el repo dejaba viva la caché vieja de Vitrina (`cineEstadoCache`, overlay, `podcastDispatched`); la siguiente marca pisaba lo restaurado (probado). | `rehidratarCineEstado()`, `rehidratarOverlay()`, `setPodcastDispatched(...)` y evento `angst:restaurado` (Pokécripto) dentro de `restoreFromPayload`. |
| 2 | El guard de sync (`repoEsMasNuevo`) no veía ediciones de Vitrina/Feed. | `modules/shared/localedit.js` (`marcarEdicionLocal`), llamado al guardar estado de cine, episodios, vistos, buzón, Feed y agotadas. El refresh automático del Feed NO marca (`skipEditMark`). |
| 3 | `angst-podcast-positions-v1`, `angst-series-overlay-v1` y `angst-pokecripto-agotadas-v1` no viajaban. | Ahora en `LOCAL_KEY_FIELDS` (`feedPodcastPositions`, `feedSeriesOverlay`, `pokeAgotadas`). |
| 4 | La validación de `handleExport` nunca podía fallar (`clone()` convierte undefined en null) y 📤 no validaba. | `validarPayloadExport` (null/undefined/tipo) en 💾 y 📤. `downloadBackupJSON` ahora devuelve true/false (antes no se veía "descargado ✓"). |
| 5 | Nada impedía olvidar un campo en el futuro. | `tests/export-coverage.mjs` + `tests/vitrina-restore.mjs`. |

## Decisión deliberada
`angst-simkl-pending-v1` (cola hacia Simkl) **no** viaja: se vacía sola hacia
`simkl-state.json` en Angst-data y restaurarla en otro dispositivo reenviaría
acciones viejas que podrían revertir marcas nuevas. Está en `EXPORT_EXEMPT_KEYS`
con ese motivo. Cambiarlo es una decisión de Cristopher, no un detalle de código.

## Regla para el futuro
Campo nuevo del planner → `CORE_EXPORT_FIELDS` + `saveToStorage` + `buildExportPayload`
+ `restoreFromPayload`. Clave nueva de localStorage → `LOCAL_KEY_FIELDS` (o
`EXPORT_EXEMPT_KEYS` con motivo). `npm run audit:export` falla si falta algo.
Cualquier caché en memoria que lea localStorage al cargar necesita su función de
rehidratación en `restoreFromPayload`.

## Pendiente conocido (no tocado: fuera de alcance)
- `core/persistence.js` conserva el motor por manifests, que no es el que corre.
- `pesoUnit` (kg/lb) y `diaManual` de Ejercicio son de sesión.
- No se auditó el export XLSX ni lo que escriben las Actions del lado servidor.

## Confirmación (14-oct-2026)

**Estado: cerrada.** Correcciones publicadas en `main` (commit `39746df`, build de Pages OK).

Prueba final contra Angst-data (rama `state-sync`, `angst-full-state.json`):

- Backup `.json` (💾, 11:20 UTC) vs. estado subido (📤, 11:15 UTC): **36 campos en ambos, idénticos**; la única diferencia es `exportedAt`.
- El payload pasa `validarPayloadExport` y los 36 campos coinciden con `CORE_EXPORT_FIELDS` + `LOCAL_KEY_FIELDS`.
- `feedPodcastPositions` ya viaja con datos reales (avance de podcasts).
- Un backup anterior (33 campos, sin los tres campos nuevos) salió de la versión previa a esta auditoría que seguía en memoria en el navegador; el 📤 posterior, ya con el código nuevo, trajo los 36. Los 32 campos en común eran idénticos: no hubo cambios de datos.

**Aún sin ver con datos reales:** `feedSeriesOverlay` y `pokeAgotadas` vinieron `null` porque no había marcas de episodios recientes ni cartas agotadas. Están cubiertos por `npm run audit:export`, pero falta verlos poblados en un export. Al marcar un episodio o agotarse una carta: 📤 y revisar esos campos.

**Prueba de referencia para repetir:** exportar 💾, subir 📤 sin editar nada, y comparar ambos archivos campo por campo (deben coincidir salvo `exportedAt`).

**Siguientes mejoras posibles (sin implementar):** panel "¿estoy al día?" con sello de versión, chequeo liviano de `exportedAt` antes de bajar el estado completo, restauración desde `state-backups/`, y mostrar `pokecripto-estado.json` en Pokécripto.
