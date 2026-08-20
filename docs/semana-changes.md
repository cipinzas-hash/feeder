# Semana — cambios: nota puntual y día libre

**Estado:** especificación para implementación  
**Rol:** Henry — diagnóstico/diseño  
**Ejecutor:** Claude  
**Módulo:** `modules/planner`  
**Alcance:** vista semanal del Planner

## Objetivo

Implementar dos cambios puntuales en la Semana del Planner:

1. Un espacio para **notas puntuales/random** asociadas a una fecha.
2. Una opción explícita de **día libre** dentro de la carga laboral.

Ambos cambios deben integrarse al modelo diario existente y no crear un segundo sistema paralelo de estado.

---

## 1. Nota puntual / random

### Propósito

Permitir registrar algo que ocurrió durante un día y que vale la pena conservar, aunque no sea una tarea ni corresponda al cierre/reflexión del día.

Ejemplos conceptuales:

- una idea que apareció durante el día;
- algo que ocurrió y quiero recordar;
- una observación puntual;
- una decisión tomada;
- cualquier registro breve que no justifique convertirse en tarea.

### Reglas funcionales

- La nota pertenece a **un día concreto**.
- Debe persistir dentro del estado del día existente.
- Debe ser independiente de:
  - tareas;
  - reflexión/cierre diario;
  - carga laboral;
  - estadísticas de cumplimiento.
- Crear o editar una nota no debe marcar tareas como completadas ni modificar indicadores de productividad.
- Debe ser posible dejarla vacía cuando no se necesite.
- La interfaz debe ser simple y rápida: registrar texto y conservarlo.
- Debe aparecer dentro de la tarjeta del día en Semana, en una ubicación visualmente diferenciada de la reflexión diaria.

### Modelo de datos

Agregar un campo diario dedicado, preferentemente con un nombre semántico como:

```js
randomNote: ""
```

Si durante la implementación existe ya un campo equivalente en el modelo real, **reutilizarlo** en lugar de duplicar estado.

Para datos antiguos, ausencia del campo debe equivaler a cadena vacía.

### Importante

No convertir `randomNote` en una lista de tareas, eventos o entradas con timestamp salvo que el código existente obligue a ello. El requerimiento actual es una nota puntual simple asociada al día.

---

## 2. Día libre en carga laboral

### Propósito

La carga laboral de un día debe poder indicar explícitamente que ese día es **libre**.

Esto permite distinguir un día laboral con poca carga de un día que deliberadamente no tiene carga laboral.

### Modelo de datos

Usar el campo existente/diseñado para carga laboral:

```js
workLevel: "libre"
```

No crear un segundo booleano paralelo como `isDayOff`.

La opción `libre` debe coexistir con los valores de carga laboral que ya utilice el Planner.

### Compatibilidad

- Los días existentes sin `workLevel` deben seguir funcionando exactamente como antes.
- No realizar una migración destructiva de datos históricos.
- La normalización del día debe proporcionar el valor por defecto compatible con el comportamiento actual.
- Cambiar a `libre` y volver a otra carga laboral debe ser reversible.
- El valor debe persistirse mediante el mecanismo existente de `updateDay`.

### Comportamiento visual

Agregar `Libre` como opción seleccionable dentro del control de carga laboral existente.

No imponer una nueva pantalla ni un flujo separado.

El tratamiento visual específico puede seguir el lenguaje visual existente del Planner, pero debe quedar claro que `libre` significa ausencia planificada de carga laboral.

### Límites del cambio

`workLevel: "libre"` **no debe**, por sí solo:

- borrar tareas;
- borrar reflexión;
- borrar notas;
- alterar datos históricos;
- cambiar estadísticas existentes;
- modificar Wrapped;
- modificar filtros globales;
- reinterpretar retrospectivamente el día.

Si alguna estadística existente necesita posteriormente entender el significado de `libre`, eso será un cambio posterior y separado.

---

## 3. Integración en la arquitectura actual

El código actual de Semana está estructurado alrededor de:

```text
PlannerPage
  └── PlannerDayCard
       ├── PlannerTaskList
       ├── PlannerDayUtilities
       └── PlannerDayReflection
```

La implementación debe respetar esta separación.

La nota puntual y el control de carga laboral deben integrarse al `PlannerDayCard`/componentes diarios correspondientes, utilizando `updateDay` y el estado diario existente.

No crear un store nuevo ni una segunda fuente de verdad.

La Semana calcula las fechas y entrega cada `dateKey` al `PlannerDayCard`; por tanto, el nuevo estado debe quedar asociado al mismo `dateKey` del día. 

---

## 4. Criterios de aceptación

### Nota puntual

- [ ] Puedo escribir una nota puntual en cualquier día.
- [ ] La nota queda asociada a ese día.
- [ ] La nota sobrevive al cambio de semana/navegación.
- [ ] Al recargar la aplicación, la nota continúa presente si el mecanismo de persistencia existente funciona correctamente.
- [ ] Editar/borrar la nota no afecta tareas ni reflexión.
- [ ] La nota no altera métricas de productividad.

### Día libre

- [ ] `Libre` aparece como opción de carga laboral.
- [ ] Seleccionarlo guarda `workLevel: "libre"`.
- [ ] Al volver al día, la opción sigue seleccionada.
- [ ] Se puede cambiar nuevamente a otra carga.
- [ ] Los días antiguos siguen funcionando sin `workLevel`.
- [ ] No se borran ni modifican automáticamente tareas/reflexiones/notas.
- [ ] No se modifican estadísticas existentes como efecto lateral.

### Integración

- [ ] No se crea un segundo sistema de estado.
- [ ] Se utiliza `updateDay`.
- [ ] Se mantiene la navegación semanal existente.
- [ ] El build de la aplicación termina correctamente.
- [ ] La funcionalidad aparece en el bundle que realmente carga la aplicación, no solo en archivos fuente.

---

## 5. Archivos a inspeccionar antes de modificar

Claude debe comprobar primero el estado real de estos archivos y cualquier dependencia directa:

- `modules/planner/PlannerPage.jsx`
- `modules/planner/PlannerDayCard.jsx`
- `modules/planner/PlannerDayUtilities.jsx`
- `modules/planner/PlannerDayReflection.jsx`
- `modules/planner/PlannerTaskList.jsx`
- `modules/planner/index.js`
- `modules/planner` — archivo(s) reales de dominio/estado/normalización
- archivos del core responsables de persistencia y composición del Planner
- `index.html` / proceso de build si el bundle se genera directamente allí

**No asumir que los nombres de archivos de estado/dominio indicados en documentación antigua siguen existiendo.** Resolver primero la estructura actual del repositorio.

---

## 6. Protocolo de ejecución

Esta documentación no constituye una orden para que Henry implemente código.

Claude debe:

1. Leer esta especificación.
2. Inspeccionar el estado actual del repositorio.
3. Verificar si existe una implementación parcial o anterior de cualquiera de los dos cambios.
4. Reutilizar o reemplazar explícitamente cualquier implementación obsoleta, evitando duplicados.
5. Implementar ambos cambios como una unidad coherente de Semana.
6. Ejecutar el build/test disponible.
7. Verificar que los cambios llegan al artefacto/bundle realmente servido por la aplicación.
8. Informar cualquier decisión arquitectónica que no pueda resolverse sin intervención de Cristopher.
9. Hacer commit solamente de los archivos pertenecientes a este cambio.

### No ampliar el alcance

No implementar en esta tarea:

- sistema de eventos/historial de notas;
- estadísticas nuevas para días libres;
- cambios en Wrapped;
- rediseño general del Planner;
- migración completa del estado del Planner;
- calendario avanzado;
- nuevas integraciones externas.

Esos cambios deben tener sus propias especificaciones.

---

## Referencia de arquitectura observada

`PlannerPage` genera los siete días de la semana y pasa cada fecha como `dateKey` al `PlannerDayCard`. `PlannerDayCard` ya concentra tareas, utilidades y reflexión, por lo que ambos cambios pertenecen al ámbito del estado diario y no requieren crear una nueva vista semanal paralela.
