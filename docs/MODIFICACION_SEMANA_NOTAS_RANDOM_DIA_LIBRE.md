# Angst — Modificación puntual: notas random + día libre

**Repositorio:** `cipinzas-hash/feeder`  
**Módulo:** Semana  
**Archivo principal identificado:** `core/App.jsx`

## Objetivo

Realizar dos modificaciones pequeñas al registro diario de la vista **📅 Semana**:

1. Incorporar un espacio para **Nota random**.
2. Añadir **Día libre** como cuarta opción del selector de trabajo.

La modificación debe ser **aditiva y conservadora**. No refactorizar la arquitectura existente ni modificar otras funcionalidades.

---

## 1. Nota random

### Concepto

Cada día debe disponer de un campo independiente de `Cierre del día` para registrar acontecimientos, pensamientos o datos puntuales que ocurrieron ese día pero que no corresponden al cierre general de la jornada.

Ejemplos:

- "Me llamó X y hablamos de..."
- "Hoy encontré este problema..."
- "Tengo que recordar que..."
- "Pasó algo raro en el trabajo."
- "Idea para Angst: ..."

La distinción conceptual es:

- **Nota random:** registro puntual durante el día.
- **Cierre del día:** reflexión o resumen posterior sobre cómo fue el día.

### UI

Ubicar **Nota random** entre **Menú del día** y **Cierre del día**.

Debe reutilizar el mismo componente/editor de texto que utiliza actualmente `Cierre del día`, manteniendo comportamiento y estética consistentes.

El campo debe almacenarse dentro del objeto del día, utilizando preferentemente:

```js
randomNote
```

La estructura conceptual será:

```js
dayData[dateKey] = {
  ...,
  randomNote: "...",
  summary: "..."
}
```

No crear un sistema global de notas ni un array de notas. Una nota pertenece a una fecha concreta.

Si el campo no existe en datos antiguos, debe comportarse como una cadena vacía mediante fallback (`day.randomNote || ""`, o equivalente).

### Persistencia

Guardar la nota utilizando el mecanismo existente de actualización del día (`updateDay` o equivalente). No crear un mecanismo de persistencia paralelo.

La nota debe quedar incluida automáticamente en los backups/exportaciones que ya persistan `dayData`.

### Completitud

**No incluir `randomNote` en el cálculo del porcentaje de completitud del día.**

La nota es opcional y su ausencia no significa que el registro esté incompleto.

---

## 2. Cuarta opción de Trabajo: Día libre

Actualmente el selector de trabajo tiene tres opciones:

- 😌 Relajado
- 😐 Normal
- 😤 Duro

Agregar una cuarta:

- 🏖️ Día libre

El selector debe quedar conceptualmente:

```text
😌 relajado | 😐 normal | 😤 duro | 🏖️ día libre
```

### Modelo de datos

Mantener el campo existente:

```js
workLevel
```

No crear `isDayOff` ni otro campo equivalente.

Los valores válidos pasan a ser:

```js
"relajado"
"normal"
"duro"
"libre"
```

El valor para Día libre debe ser exactamente:

```js
"libre"
```

### Compatibilidad

Los registros antiguos deben continuar funcionando. Mantener el fallback existente para días sin `workLevel`.

Revisar todas las referencias a `workLevel` en el repositorio antes de implementar. Si existe algún `switch`, array, mapa, estadística o renderizado que asuma explícitamente solo tres valores, añadir `libre` únicamente donde sea necesario para evitar errores.

No realizar migraciones destructivas.

---

## 3. Comportamiento de Día libre

La nueva opción debe comportarse como las otras opciones del selector:

- puede seleccionarse;
- puede cambiarse posteriormente;
- se guarda mediante el mecanismo existente (`updateDay` o equivalente);
- persiste al cambiar de semana o recargar;
- aparece correctamente al volver a abrir la semana.

En esta modificación **no cambiar** el cálculo de estrés, estadísticas, colores del día, marcadores del calendario, filtros, Wrapped ni análisis históricos, salvo que sea estrictamente necesario para soportar el nuevo valor sin errores.

---

## 4. Restricciones de implementación

### NO hacer

- Refactorizar `App.jsx`.
- Cambiar la arquitectura de `dayData`.
- Crear un nuevo sistema de notas.
- Crear una base de datos.
- Crear archivos nuevos salvo necesidad estricta.
- Modificar el sistema de backups.
- Modificar el sistema de estrés.
- Modificar los marcadores del calendario.
- Modificar otras pestañas o módulos de Angst.
- Cambiar estilos globales innecesariamente.

### SÍ hacer

- Reutilizar el componente/editor existente para el cierre del día.
- Reutilizar `updateDay` o el mecanismo existente equivalente.
- Mantener `randomNote` dentro de `dayData[dateKey]`.
- Mantener `workLevel` como representación del estado laboral.
- Revisar referencias existentes a `workLevel`.
- Realizar el cambio mínimo necesario.

---

## 5. Criterios de aceptación

### Nota random

- [ ] Cada día tiene un campo **Nota random**.
- [ ] Está separado visualmente de **Cierre del día**.
- [ ] Permite texto multilinea.
- [ ] Se guarda mediante el mecanismo existente.
- [ ] Al cambiar de semana y volver, la nota permanece.
- [ ] Cada fecha conserva su propia nota.
- [ ] Las notas forman parte del backup/exportación existente.
- [ ] Una nota vacía no afecta el porcentaje de completitud.

### Día libre

- [ ] El selector Trabajo tiene cuatro opciones.
- [ ] La cuarta opción es **🏖️ Día libre**.
- [ ] Su valor interno es `"libre"`.
- [ ] Se guarda en `day.workLevel`.
- [ ] Los registros antiguos siguen funcionando.
- [ ] Seleccionar otra opción reemplaza correctamente `"libre"`.
- [ ] No se crea `isDayOff`.
- [ ] No se modifican otras dimensiones del calendario.

---

## 6. Resultado conceptual

La tarjeta de un día debería incorporar la nueva sección aproximadamente así:

```text
┌─────────────────────────────┐
│ Lunes                       │
├─────────────────────────────┤
│ tareas                      │
│ pendientes                  │
├─────────────────────────────┤
│ Menú del día                │
│ [.........................] │
│                             │
│ Nota random                 │
│ [.........................] │
│                             │
│ Cierre del día              │
│ [.........................] │
│                             │
│ ...                         │
│                             │
│ Trabajo                     │
│ 😌    😐    😤    🏖️       │
└─────────────────────────────┘
```

## Principio de diseño

La **Nota random** agrega una capa de **registro episódico** al día, mientras que `summary` continúa siendo el **registro retrospectivo**.

`libre` amplía el estado laboral existente sin crear una segunda variable para representar lo mismo.
