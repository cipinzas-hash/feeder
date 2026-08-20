# Planner 0.0 — Parity Checklist

Estado de referencia: `angst-architecture-0.0`

Este documento compara la implementación modular de `modules/planner/` con la Semana histórica de `core/LegacyApp.jsx`.

## ✅ Migrado al módulo Planner

- Ownership de `dayData`
- Ownership de `weekOffset`
- Ownership de `calMarks`
- Ownership de `custody`
- Ownership de `routines`
- Ownership de `recurring`
- Ownership de `cookingOpts`
- Ownership de `aseoOpts`
- Ownership de `lastRollover`
- Provider + persistence
- Navegación de semana
- Generación de los 7 días
- Calendario base
- `PlannerDayCard`
- Lista de tareas
- Crear/eliminar/completar tareas
- Edición de texto
- Urgencia
- Deadline
- Reordenamiento
- Drag adapter
- Swipe adapter
- Transferencia entre días
- `carried` / "a tiempo"
- Cocina & Aseo
- Menú
- Cierre
- Humor
- Energía / Concentración / Sueño

## 🟡 Parcial / requiere paridad funcional

- Tareas recurrentes: el estado y algunas acciones existen, pero la UI/semántica histórica completa de ocurrencias todavía está en Legacy.
- Calendario: Planner tiene un calendario modular básico, pero falta paridad completa con todas las marcas y efectos automáticos de la versión histórica.
- Deadline: Planner tiene el dato y selector básico; falta reproducir toda la lógica histórica asociada a preparación/notificaciones.
- Eventos: Planner muestra la semana, pero todavía no integra todos los eventos externos que Legacy calcula y pinta.

## 🔴 Todavía depende de Legacy o no está implementado en Planner 0.0

- Compras/`ComprasModal` completo y rollover de compras.
- Agenda horaria / `ScheduleModal`.
- Bloques automáticos derivados de marcas (`gym`, etc.).
- Integración completa de notificaciones de tareas.
- Rollover diario completo de tareas no realizadas y urgencias históricas.
- Eventos de Melee / Pokémon / SC2 dentro de la vista semanal.
- Indicadores históricos de carga/estrés y reglas asociadas.
- Minimized/expanded por día con la semántica histórica exacta.
- Restauración/importación/exportación específicamente integrada con el flujo visual de Planner.

## Orden de cierre de Planner 0.0

1. Compras.
2. Schedule/agenda.
3. Rollover.
4. Notificaciones + deadlines.
5. Marcas automáticas y calendario completo.
6. Eventos externos.
7. Indicadores visuales y paridad de expansión/minimización.
8. Test de integración end-to-end Provider → UI → persistencia.
9. Freeze de contrato 0.0.
10. Retirada de funciones equivalentes de `LegacyApp.jsx`.

## Criterio de terminado

Planner 0.0 se considera funcionalmente equivalente a la Semana histórica sólo cuando las capacidades de las secciones 🟡 y 🔴 anteriores tengan implementación propia en `modules/planner/`, cobertura de tests y persistencia verificada, y `LegacyApp.jsx` ya no sea requerido para renderizar Semana.
