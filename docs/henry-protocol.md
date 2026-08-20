# Protocolo Henry → Claude — repo `angst` (feeder)

Contexto: Cristopher denuncia un issue. Henry lo diagnostica y diseña la solución
"en papel". Claude ejecuta contra el repo real (clona, edita, builda, valida,
commitea, pushea). Este documento define dónde termina el trabajo de uno y
empieza el del otro, basado en tres fallas ya observadas en este repo.

---

## Fallas ya detectadas (por qué existe este documento)

1. **Presupuesto (`1b33e2c`, `af16cba`)** — Henry entregó código fuente correcto
   y corregido, pero el bug persistió porque `index.html` (lo que sirve GitHub
   Pages) nunca se reconstruyó. El fix vivía en `modules/*.jsx`, no en el bundle.
2. **`core/dates.js` — `makeDefaultBudget()` huérfana (`9546568`)** — Henry
   propuso una solución, la dejó colgada de `globalThis`, y el comentario del
   propio commit afirmaba que `BudgetPage` la llamaba — falso, nunca se importó.
   Cuando la solución real se hizo por otro camino, nadie marcó el intento
   anterior como muerto. Quedó código huérfano indistinguible de código vivo.
3. **Migración Planner v0.0 (~70 commits)** — arquitectura paralela completa
   (dominio, contrato de estado, API de acciones, adaptador de persistencia,
   tests, CI) construida y nunca montada en `core/App.jsx`. El bottleneck real
   — cómo migrar `dayData` (formato legacy, ya persistido en disco de
   usuarios reales) al contrato nuevo — nunca se decidió. Henry siguió
   refinando el módulo aislado en vez de resolver esa pregunta.

Patrón común: Henry entrega trabajo que **parece terminado pero no está
integrado, no está deployado, o no está desambiguado de intentos previos**.

---

## El trabajo de Henry

Henry diagnostica y diseña. Su entregable no es "código que compila en
aislamiento" — es una **especificación ejecutable de cambio**, con estos
componentes obligatorios:

### 1. Diagnóstico
- Síntoma reportado por Cristopher, en sus palabras.
- Causa raíz, con referencia a archivo/función/línea si aplica.
- Si hay más de un intento previo tocando el mismo problema (buscar en
  `git log --all -- <archivo>` antes de proponer), decirlo explícitamente.

### 2. Especificación del cambio
- Qué archivos tocar y qué cambia en cada uno (puede ser pseudocódigo o diff
  conceptual, no necesita ser el diff final).
- **Si el cambio reemplaza un intento anterior**: decir cuál commit/función
  queda obsoleto y debe eliminarse. Nunca dejar dos soluciones vivas al mismo
  problema sin marcar cuál manda.
- Si el cambio requiere tocar más de un módulo o migrar datos persistidos
  (localStorage, export XLSX, `angst-data`), decirlo — no asumir que Claude
  lo va a descubrir solo.

### 3. Clasificación de tamaño — esto decide dónde corta Henry

| Tamaño | Ejemplo real | Dónde corta Henry |
|---|---|---|
| **Fix puntual** | bug de presupuesto | Diseño completo, código propuesto (aunque no lo haya corrido). Marca explícita: "esto no está buildeado ni deployado". |
| **Reemplazo de enfoque** | `dates.js` huérfano | Igual que arriba + declarar muerto el intento anterior por nombre de archivo/función. |
| **Cambio de arquitectura** | migración Planner | **No construir la arquitectura completa.** Cortar en el momento en que aparece una decisión de producto/riesgo (ej. "¿migramos datos existentes o convivimos con dos formatos?"). Entregar esa pregunta a Cristopher explícitamente, no seguir de largo. Si ya se avanzó en aislamiento, documentar exactamente qué falta para montar (el diff de integración, no otro refinamiento del módulo aislado). |

**Regla dura:** si Henry se encuentra escribiendo el commit N+1 sobre el mismo
módulo sin haber resuelto el punto de integración con el resto de la app,
para ahí. Eso es la señal de bottleneck, no una razón para seguir.

### 4. Nunca asumir que "código escrito" == "problema resuelto"
Henry no tiene acceso al build real (`node build/assemble.mjs`) ni sabe si
`index.html` quedó actualizado. Por default, asumir que no.

---

## El trabajo de Claude — qué hago cuando Cristopher denuncia un issue

1. **Leer el repo antes de leer a Henry.** `git log`, diff de los últimos
   commits relevantes, estado real de `index.html` vs. fuente
   (`grep` de una función clave del fix en ambos). No confío en que "Henry ya
   lo resolvió" hasta verificarlo contra el bundle servido.
2. **Ubicar el corte real:** ¿el trabajo de Henry es código fuente sin
   buildear? ¿hay dos soluciones compitiendo? ¿es una arquitectura aislada sin
   montar? Diagnóstico de cuál de los tres casos de la tabla aplica.
3. **Ejecutar el paso que falta:**
   - Fix puntual → build (`assemble.mjs`), verificar que el fix está en el
     bundle (`grep` de la función), commit, push.
   - Reemplazo de enfoque → eliminar código huérfano confirmado (verificar con
     `grep -rn` que nada más lo referencia antes de borrar), quedarme con la
     versión vigente, build, deploy.
   - Cambio de arquitectura → **no monto nada sin decisión explícita de
     Cristopher** sobre la pregunta de riesgo que Henry dejó pendiente. Si no
     hay decisión, se la pido antes de tocar código.
4. **Validar antes de pushear:** sintaxis (`esbuild` en seco), build limpio
   (warnings preexistentes ok, errores no), y confirmar en el bundle final que
   el cambio está presente — no asumir que compilar sin errores implica que
   el fix llegó al output.
5. **Reportar en corto:** qué estaba roto, por qué (una frase), qué hice, qué
   quedó pendiente si algo depende de una decisión de Cristopher o de una
   acción suya fuera del repo (secrets, disparar un workflow, etc.).

---

## Resumen en una línea

Henry diseña hasta el punto donde aparece una decisión de riesgo o de
integración — y ahí se detiene y la nombra. Claude ejecuta, builda, verifica
contra el bundle real, y nunca monta un cambio de arquitectura sin que
Cristopher haya resuelto la pregunta que Henry dejó abierta.
