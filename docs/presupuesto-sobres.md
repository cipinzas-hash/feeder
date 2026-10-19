# Presupuesto: carteras, sobres, gastos y cierre mensual (issue #24)

Especificación acordada con Cristopher el 17-oct-2026 y estado de implementación.

## Modelo
- **Cartera** = un fondo por propósito (`propositos`) o personal (`personales`). Cada una equivale a un **sobre de efectivo**. Los gastos base (`gastos_base`) quedan fuera.
- **Sub-partida**: el monto mensual de la cartera se reparte entre ellas hasta agotarse (`fila.subs`). Lo no repartido es el bolsillo «Sin repartir» (`subId` null). Una cartera sin sub-partidas es un solo bolsillo.
- **Período**: del 25 al 24; la clave `YYYY-MM` es el mes en que empieza. El período nuevo hereda ingresos, filas y sub-partidas; no hereda gastos, apertura, préstamos ni arqueo (`limpiarParaNuevoPeriodo`, también usado por `makeDefaultBudget`).
- **Saldo** de un bolsillo = arrastre + asignado − devolución pagada + devoluciones recibidas + préstamo recibido − préstamo dado − gastado. El sobrante pasa al período siguiente en el mismo bolsillo.
- Toda la lógica vive en `core/presupuesto-modelo.js` (pura, sin React); la prueba es `npm run test:presupuesto`.

## Datos (todo dentro de `budgets["YYYY-MM"]`, campos opcionales, sin migración)
| Campo | Qué es |
|---|---|
| `fila.subs[]` | `{id, emoji?, label, monto, meta?}`; `meta = {objetivo, fecha}` |
| `apertura` | `{ "sec:rowId:subId": efectivo }`; que exista en algún mes **activa los sobres** desde ese mes |
| `gastos[]` | `{id, fecha, sec, rowId, subId, monto, nota, prestamoId?}` |
| `prestamos[]` | `{id, fecha, destino, monto, fuentes[{sec,rowId,subId,monto}]}` |
| `arqueo` | `{fecha, filas[{sec,rowId,label,emoji,esperado,contado,diferencia,nota}]}` |

## Reglas
1. Un gasto no puede superar el saldo de su sub-partida. Si falta, se pide a **otras carteras** (multifinanciamiento): máximo **30%** del saldo de cada cartera, varias fuentes, la deuda queda registrada.
2. **Devolución automática**: desde el período siguiente se descuenta hasta el **50%** de la asignación de la cartera deudora, el préstamo más antiguo primero, repartido en proporción entre sus bolsillos; vuelve a los sobres que prestaron en proporción a su aporte (`simular()`).
3. **Guía mensual** (🧾 sobres): cuánto debe haber en cada sobre al empezar el período = arrastre + asignado − devolución + devoluciones recibidas.
4. **Arqueo** (🔍 cierre): se cuenta el efectivo de cada sobre y se compara con lo esperado. Es obligatorio antes de generar el período siguiente (`puedeGenerarPeriodo`; la cadena exige el primer arqueo pendiente). Una diferencia no bloquea: queda documentada, con nota opcional. **No ajusta saldos**: la diferencia se corrige registrando el gasto que falta.
5. **Rendición**: informe del período por cartera (asignado, gastado, préstamos, devoluciones, saldo, arqueo y detalle de gastos con nota). Se muestra tras el arqueo y se puede copiar como texto.
6. **Metas con fecha** en sub-partidas: aporte mensual necesario hasta la fecha y fecha de cumplimiento con el aporte actual (`progresoMeta`).
7. **Proyección anual** (columna «Proy. anual» y totales): los próximos 12 períodos desde el que se ve. Cada mes cuenta con lo realmente asignado; un mes dentro del registro sin presupuesto cuenta como cero; los meses futuros usan el promedio de los últimos 12 meses en registro (ceros incluidos, dividido por el total de meses de esa ventana, o por los que lleve el registro). Sin registro: monto × 12 (`proyeccionAnual`).
8. **Ritmo del sobre** (en la ventana de cada cartera): barra de lo gastado frente a lo disponible del período, con una marca del avance del calendario (25 → 24). Verde si gasta al ritmo del mes o menos, ámbar hasta 15 puntos por delante, rojo más allá. Solo visual (`ritmoSobre`).
9. No se eliminan bolsillos con saldo, gastos del período o préstamos pendientes; un gasto con préstamo ya en devolución no se borra.

## Interfaz
- La lista de fondos conserva su forma original (grilla alineada, `modules/presupuesto/grilla.jsx`). Cada cartera se abre tocando su emoji, en una **ventana emergente** (`CarteraVentana.jsx`), una a la vez; ‹ › cambian de cartera y × vuelve.
- 💸 en el menú principal (`GastoModal.jsx`) registra un gasto; 🧾 y 🔍 viven en la cabecera de Presupuesto.

## Estado
- [x] Fase 1: grilla, sub-partidas, saldos, gastos
- [x] Fase 2: multifinanciamiento y guía mensual
- [x] Fase 3: arqueo, rendición y metas con fecha
- [x] Fase 4: proyección anual con montos reales por mes y ritmo del sobre
