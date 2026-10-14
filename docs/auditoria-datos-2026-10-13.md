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
