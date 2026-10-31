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

## Pantalla (lineamiento, issue #33)
Módulo completo bajo `docs/angst-lineamiento-y-handoff.md`; la pestaña usa `app-fit` en el shell (como Semana, Presupuesto y Salud).
- **Colapsado (sin scroll, R2):** franja de estado (🍄 protocolo de hoy · 📓 registro de hoy · alerta si hay palpitaciones o dolor de pecho), navegador de día, cinco filas y una **tendencia** de foco (14 días) que ocupa el alto sobrante. Sin título propio (R6).
- **Filas (expansión exclusiva, R3):** ☀️ Mañana · 🌙 Cierre · 🍄 Protocolo (próximas dosis e historial) · 📈 Resumen · 📏 Línea base y dosis. Expandido, el contenido scrollea por dentro.
- **Emergentes (R4):** registro de un día de dosis del protocolo, iniciar/reiniciar protocolo.
- **Válvula (§4.5):** si colapsado no cupiera, aparece scroll en vez de recortar, y se avisa en consola (`[fadiman] desborda colapsado`).
- El diario es usable sin protocolo iniciado; reiniciar el protocolo no lo toca.

## Archivos
- `modules/fadiman/diarioModel.js` — lógica pura del diario (resumen, serie, comparación con/sin toma, texto exportable).
- `modules/fadiman/protocoloModel.js` — lógica pura del protocolo (tipo de día, dosis, restantes), con fechas locales.
- `modules/fadiman/fadimanUi.jsx` — piezas visuales (fila de sección, hoja emergente, escalas, gráficos).
- `modules/fadiman/DiarioSecciones.jsx` — Mañana, Cierre, Resumen, Línea base.
- `modules/fadiman/ProtocoloVistas.jsx` — sección Protocolo y las dos hojas (registro de dosis, iniciar/reiniciar).
- `modules/fadiman/FadimanPage.jsx` — estado de la página, franja y composición.
- `core/App.jsx` — `app-fit` para la pestaña 5 y `cruzFor(k)` (tareas hechas/total, `computeStressScore`, ejercicio).
- `tests/fadiman-diario.mjs`, `tests/fadiman-protocolo.mjs` — `npm run test:fadiman`.

## Decisiones y límites declarados
- Ánimo e irritabilidad van como dos escalas separadas (en una sola, la dirección era ambigua). Todas: 1 = nada, 5 = mucho.
- **Fechas locales en todo el módulo** (antes el protocolo usaba UTC, y de noche en Chile marcaba el día siguiente). Cambia solo cuándo cambia "hoy"; los datos guardados no se tocan.
- "Cruces": tareas = tareas con texto del día (hechas / total); estrés = índice de Semana; ejercicio = al menos una serie hecha. Sin dato de planner ese día, no hay cruce.
- El resumen exportable es texto plano (copiar / descargar .txt), no PDF.
- Aviso fijo si se marca palpitaciones o dolor de pecho. No interpreta nada.
- Reiniciar el protocolo borra sus registros (comportamiento de siempre); ahora la hoja lo advierte.
- La fila de sección es una copia local del aspecto de Salud (`FilaSeccion`): candidata a unificarse en `shared/ui.jsx` cuando se toque Salud.

## Validación hecha
Tests de ambos modelos; render con jsdom de la pantalla colapsada (acordeón exclusivo, tendencia, toma, escribir sin perder foco, alerta en formulario y franja, escalas, navegación de día, resumen, línea base, iniciar solo en sábado, registro de dosis, reiniciar sin tocar el diario); arranque de la app completa; build; `audit:export`.
No verificado: aspecto y alturas reales (480/560/640/720 px) en el dispositivo; el sandbox no mide layout. Ahí decide la válvula y una captura tuya.
