# Fadiman — diario de seguimiento

## Objetivo
Llevar un registro diario de cambios (toma, sueño, efecto, escalas, efectos adversos, medidas) para ver
tendencias y llevar un resumen a la consulta. Vive dentro del módulo Fadiman, pero es una pista
independiente del protocolo: se puede usar sin haber iniciado el protocolo, y reiniciar el protocolo
no lo toca.

## Datos (sin migración, R8)
Clave nueva **dentro** de `fadimanData` (que ya viaja entera en export/import/`state-sync`):

```
fadimanData.fadimanDiario = {
  cfg:  { mg: 10 },
  base: { foco, inicio, animo, irrit, ansiedad, apetito, suenoCal } | null,
  dias: { "YYYY-MM-DD": { tomo, hora, mg, comida, protocolo, suenoHora, suenoHoras, suenoCal,
                          efIni, efFin, foco, inicio, animo, irrit, ansiedad, apetito, rebote(0-3),
                          efectos[], efectoOtro, pulso, presion, peso, evento, nota } }
}
```
No hay claves nuevas de localStorage ni campos nuevos del planner: `npm run audit:export` sigue pasando.
`protocolo` se sella al crear la entrada del día (si ese día era de dosis Fadiman) para poder separar efectos.

## Archivos
- `modules/fadiman/diarioModel.js` — lógica pura (resumen, serie, comparación con/sin toma, texto exportable).
- `modules/fadiman/DiarioFadiman.jsx` — pantalla (pestañas día / resumen, gráfico SVG, línea base).
- `modules/fadiman/FadimanPage.jsx` — botón "📓 diario" (en el inicio del protocolo y en el encabezado); rama `view==="diario"`.
- `core/App.jsx` — pasa `cruzFor(k)` a Fadiman: tareas hechas/total del día, `computeStressScore`, ejercicio hecho.
- `tests/fadiman-diario.mjs` — `npm run test:fadiman`.

## Decisiones y límites declarados
- Ánimo e irritabilidad van como dos escalas separadas (en una sola, la dirección de la escala era ambigua). Todas: 1 = nada, 5 = mucho.
- Las fechas del diario son **locales** (el cierre del día se registra de noche; `toISOString()` en Chile ya marca el día siguiente pasadas ~20-21 h). El resto de FadimanPage usa fecha UTC (`today`) y no se tocó: es un desfase conocido, aparte.
- "Cruces": tareas = tareas con texto del día (hechas / total); estrés = índice de Semana; ejercicio = al menos una serie hecha. Sin dato de planner ese día, no hay cruce.
- El resumen exportable es texto plano (copiar / descargar .txt), no PDF.
- Aviso fijo si se marca palpitaciones o dolor de pecho. No interpreta nada.
- La pantalla sigue el layout actual de Fadiman (scroll normal). Se rediseñará con el lineamiento colapsado cuando le toque a Fadiman (Fase 2).

## Validación hecha
Test del modelo; render con jsdom (sin protocolo, marcar toma, escribir sin perder foco, alerta, escala, resumen, gráfico, línea base, reiniciar protocolo sin tocar el diario); arranque de la app completa sin errores; build; `audit:export`.
No verificado: aspecto real en el dispositivo (sin navegador real en el sandbox).
