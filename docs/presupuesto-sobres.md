# Presupuesto: carteras, sobres, gastos y cierre mensual (issue #24)

Especificación acordada con Cristopher el 17-oct-2026 y estado de implementación.

## Modelo
- **Cartera** = un fondo por propósito (`propositos`) o personal (`personales`). Cada una equivale a un **sobre de efectivo**. Los gastos base (`gastos_base`) quedan fuera.
- **Sub-partida**: el monto mensual de la cartera se reparte entre ellas hasta agotarse (`fila.subs`). Lo no repartido es el bolsillo «Sin repartir» (`subId` null). Una cartera sin sub-partidas es un solo bolsillo.
- **Período**: del 25 al 24; la clave `YYYY-MM` es el mes en que empieza. El período nuevo hereda ingresos, filas y sub-partidas; no hereda gastos, apertura, préstamos ni arqueo (`limpiarParaNuevoPeriodo`, también usado por `makeDefaultBudget`).
- **Saldo** de un bolsillo = arrastre + asignado − devolución pagada + devoluciones recibidas + préstamo recibido − préstamo dado − gastado. El sobrante pasa al período siguiente en el mismo bolsillo; si el período tiene arqueo, pasa lo contado (regla 4).
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
4. **Arqueo** (🔍 cierre): se cuenta el efectivo de cada sobre y se compara con lo esperado. Es obligatorio antes de generar el período siguiente (`puedeGenerarPeriodo`; la cadena exige el primer arqueo pendiente). Una diferencia no bloquea: queda documentada, con nota opcional. **Lo contado es lo que arranca el período siguiente como saldo de arrastre** (cambio del 24-oct-2026; antes el arrastre era el saldo según registros y el arqueo no ajustaba nada). Como el conteo es por cartera, el ajuste se reparte entre sus bolsillos (`ajusteArqueo`): un sobrante va al bolsillo libre («Sin repartir», o la cartera entera); un faltante se descuenta primero del libre y luego de los demás, del más abultado al menor. El saldo del período cerrado sigue siendo el de los registros (por eso repetir el arqueo no se contamina) y la diferencia queda en `arqueo.filas[].diferencia`.
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

## Alimentación, compras y categorías (issue #25)
Especificación acordada con Cristopher el 21-oct-2026.

- **Alimentación como cartera**: hoy es un gasto base. En su fila de Gastos Base, «🧾 Pasar a cartera» la marca (`fila.aCartera`); al generarse el período siguiente (`limpiarParaNuevoPeriodo`) la fila pasa a fondos por propósito con el mismo id (`ali`), monto y emoji, ya con sobre, sub-partidas, arqueo y rendición. El período en curso no cambia.
- **Compras con precio**: cada ítem de la lista de compras acepta `cantidad`, `precio` (unitario), `categoria` y `subId`. Al marcarlo comprado se registra un gasto en la cartera `ali` por cantidad × precio, con nota «2× Tomates», su categoría y `compraId`; el ítem guarda `gastoId` y `gastoPeriodo`. Desmarcarlo borra ese gasto (si su préstamo no empezó a devolverse). Si el ítem no cabe en el saldo no se registra: el multifinanciamiento sigue siendo por 💸 Gasto. Mientras `ali` no sea cartera con sobres activos, el ítem solo guarda su precio y no descuenta nada.
- **Categorías**: lista fija por cartera (`fila.categorias`), editable (+ nueva categoría). Alimentación trae ocho por defecto (`CATEGORIAS_ALIMENTACION`); las demás carteras parten vacías. Se elige en 💸 Gasto y por ítem de compra; la ventana de la cartera muestra el gasto por categoría del período junto al anterior.
- **🛒 Carrito** en el menú superior: todas las compras pendientes de todos los días, con contador; se completa precio/cantidad/categoría y se marca comprado desde ahí. También lista lo comprado hoy para deshacer.
- Datos nuevos (todos opcionales, sin migración): `fila.categorias`, `fila.aCartera`, `gasto.categoria`, `gasto.compraId`, ítem de compras `{cantidad, precio, categoria, subId, gastoId, gastoPeriodo}`.
- Código: modelo en `core/presupuesto-modelo.js` (`carteraCompras`, `registrarCompra`, `deshacerCompra`, `categoriasDe`, `agregarCategoria`, `gastoPorCategoria`); UI en `modules/presupuesto/CompraEditor.jsx` y `CarritoModal.jsx`; el cableado vive en `core/App.jsx` (`comprasApi`).

## Lista de compras única, categorías y bolsillo de Aseo (24-oct-2026)
Acordado con Cristopher el 24-oct-2026. **Reemplaza** las tres vistas separadas de la lista de compras (🛒 Carrito del menú superior, 🛒 de cada día en Semana y ➕ Registrar › Compra): hoy las tres son la misma `modules/presupuesto/ListaCompras.jsx`.

- **Lista única**: se agrega desde cualquier punto (también desde el Carrito) con nombre y, opcionalmente, «+ detalles» (cantidad, precio unitario, categoría con «+ nueva categoría…» y su destino). Cada ítem tiene su ×; tocar un ítem abre el editor; la casilla lo marca comprado. **No hay botón «limpiar ✓»** (riesgo de toque accidental): los ítems se quitan de a uno. En la lista de un día se mantiene ordenar (mantener pulsado) y pasar al día siguiente (deslizar →).
- **Categorías** (`CATEGORIAS_COMPRAS`): Lácteos, Huevos, Prote, Snack, Verdura, Fruta, Aseo, más «agregar categoría». Valen como lista por defecto de la fila «ali» mientras no tenga `categorias` propias (las cuentas actuales no las tienen; si una fila ya trae `categorias`, esa lista manda).
- **Bolsillo por categoría**: Lácteos, Huevos, Prote, Snack, Verdura y Fruta descuentan de **Alimentación** (`ali`); **Aseo descuenta de Aseo** (`aseo`). Una categoría nueva elige su destino al crearse (`fila.catDestino` de «ali»: `{categoría: rowId}`); sin elegir, Alimentación. Mientras la fila de destino siga siendo gasto base, el ítem guarda su precio pero no descuenta, y el editor lo dice.
- **Aseo como cartera**: «🧾 Pasar a cartera» ahora aparece también en la fila Aseo de Gastos Base (`FILAS_CARTERABLES`); entra en vigencia desde el período siguiente, igual que Alimentación. Es una decisión de datos de Cristopher: el código no la marca por él.
- Una sub-partida elegida para otra cartera (por haber cambiado la categoría) no se usa: la compra cae en el bolsillo libre de la cartera destino.
- Agregar una categoría escribe en el presupuesto del período en curso, así que respeta la compuerta del arqueo (no genera un período nuevo sin el arqueo del anterior).
- Pruebas: `npm run test:presupuesto` (arrastre por arqueo, destinos por categoría, categorías nuevas).
