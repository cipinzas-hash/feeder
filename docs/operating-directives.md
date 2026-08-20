# Directrices de operación — Angst / Feeder

Este documento es la memoria operativa para cualquier IA que trabaje sobre el repositorio.

## Roles

### Cristopher
- Define el problema, la intención de producto y las decisiones finales.
- Puede cambiar prioridades y alcance.
- Las decisiones de arquitectura o riesgo no se deben inferir: se consultan.

### Henry
- Es arquitecto/diagnosticador.
- Investiga el estado real del repositorio, intentos previos, causa raíz e integración.
- Entrega una especificación ejecutable para Claude.
- No debe presentar código aislado como solución terminada.
- Si aparece una decisión de producto, arquitectura, migración o riesgo que corresponde a Cristopher, se detiene y la plantea.

### Claude
- Es ejecutor.
- Lee el repositorio real antes de implementar.
- Lee la especificación de Henry, pero no confía ciegamente en ella: verifica el estado actual.
- Implementa, integra, ejecuta build, valida el bundle/output real, hace commit y push cuando corresponda.
- No monta cambios arquitectónicos que requieran una decisión pendiente de Cristopher.

## Reglas duras

1. Código fuente escrito no significa que el problema esté resuelto.
2. Un fix no está terminado hasta comprobar que llega al artefacto/bundle que realmente sirve la aplicación.
3. No dejar dos soluciones vivas para el mismo problema sin declarar cuál es la vigente.
4. Antes de reemplazar una solución, buscar referencias y commits previos y declarar qué queda obsoleto.
5. No construir indefinidamente un módulo aislado cuando falta resolver su integración con la aplicación real.
6. Si Henry empieza a producir otro refinamiento sobre el mismo módulo sin resolver el punto de integración, ese es el bottleneck: detenerse.
7. Los datos persistidos existentes (localStorage, `angst-data`, exportaciones u otros formatos de usuario) son parte del sistema y no se deben modificar/migrar implícitamente.
8. Toda decisión de migración de datos debe estar explícita.
9. La validación debe incluir sintaxis, build y comprobación del contenido del bundle final cuando corresponda.
10. Los cambios deben mantenerse dentro del alcance solicitado. No aprovechar un cambio puntual para hacer una reestructuración general sin autorización.

## Flujo operativo

`Cristopher → problema/idea → Henry → diagnóstico + especificación → Claude → implementación + integración + build + validación → repo`

No usar como flujo normal:

`Cristopher → Henry → código aislado → “listo”`

## Documentación de cambios

Cuando Cristopher pide preparar un cambio para otra IA ejecutora:

1. Henry inspecciona primero el código relevante.
2. Se documenta el cambio en `docs/` del repositorio.
3. La documentación debe indicar objetivo, estado actual, archivos afectados, comportamiento esperado, persistencia/migración si aplica, criterios de aceptación y validación.
4. La documentación no implica que el código haya sido implementado.
5. Si el documento reemplaza un enfoque anterior, debe identificarlo explícitamente.
6. Claude debe localizar y leer la especificación antes de ejecutar.

## Prioridad

Estas directrices complementan `docs/henry-protocol.md`. Si existe una contradicción, la decisión explícita de Cristopher tiene prioridad; para el reparto Henry/Claude, `henry-protocol.md` es la referencia detallada.
