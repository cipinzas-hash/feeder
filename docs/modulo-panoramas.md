# Módulo Panoramas (issue #17) — Fase 1

Objetivo de Cristopher (13-nov-2026): enterarse de los panoramas culturales de Santiago **con anticipación**
(ese día se le pasó la inscripción a la Noche de Museos). Por eso el módulo agrupa por cuánto falta, distingue
lo que tiene cupos o pide inscripción y marca lo recién detectado como "nuevo".

## Qué hay
- `modules/feed/scripts/build-panoramas.mjs` — un adaptador por fuente → contrato común → `modules/feed/data/panoramas.json`.
- `.github/workflows/update-panoramas.yml` — corre cada 6 h (y a mano). Solo publica `panoramas.json` en main.
- `modules/panoramas/` — pestaña 🗓️ panoramas (solo lee el JSON; sin estado persistente, sin claves nuevas de localStorage).
- Sondas (inertes, se pueden borrar): `sonda-panoramas.mjs`, `sonda-panoramas-2.mjs`, reportes `docs/sonda-panoramas*.md`
  y muestras reales en `modules/feed/data/muestras-panoramas/` (los adaptadores se escribieron contra esas muestras).

## Fuentes de la Fase 1
| Fuente | Método | Notas |
|---|---|---|
| Centro Cultural La Moneda | API REST de WordPress (`/wp-json/wp/v2/{actividad,exposicion,festival,cineteca_nacional}`), campos ACF | Fechas: si `fecha_manual = manual` manda el texto público (`coordenada_adicional`); los `horarios` estructurados pueden estar desfasados (visto en una actividad). Trae `maximo_entradas` y `venta_tickets`. |
| Red Nacional de Museos (SNPC) | HTML de Drupal en `artdec.gob.cl/cartelera/red-nacional?region=RM&page=N` | **`region=RM` no filtra en el servidor** (llegan museos de Valparaíso, Aysén, Limarí): se filtra por comuna detectada. Ordenada por fecha de inicio ascendente; 8 páginas. |

## Contrato del evento
`id, titulo, inicio, fin, hora, lugar, direccion, comuna, categoria, gratis, precio, cupos, ventaOnline, inscripcion, inscripcionUrl, imagen, url, fuenteId, fuente, fuentes[], enCurso, visto, rancio?`
- `visto` = primera fecha en que se detectó (se hereda entre corridas; base de "nuevo").
- `enCurso` = vigencia mayor a 45 días (exposiciones, programas permanentes): van aparte, colapsados.
- `rancio` = la fuente falló en la última corrida y se conservaron sus eventos anteriores (health-check del issue).
- Dedup entre fuentes por título normalizado + fecha de inicio.

## Límites conocidos (decir con precisión qué está y qué no)
- **"Requiere inscripción" no está verificado con datos reales.** En las 73 filas de Red Nacional todas traen `no-inscription · Evento Vigente`;
  la variante con inscripción nunca apareció, así que esa detección es una suposición sobre el marcado. CCLM solo informa cupos / venta online,
  y un cupo no prueba que haga falta inscribirse: la etiqueta dice "Cupos N" / "Entrada online", no "inscripción".
- Red Nacional publica con ~1 semana de anticipación (el último inicio visto fue 20-nov); CCLM, ~2 semanas.
- Santiago Cultura (EventON) expone `wp-json/wp/v2/ajde_events`, pero `meta` viene vacío y la fecha del post es la de publicación; la fecha del evento
  está solo en la página de detalle. Además lo último modificado es del 29-sep-2026: parece sin actualizar. **No entra en la Fase 1.**

## Pendiente (Fase 2)
- GAM (`gam.cl/es/calendario/`, 1,1 MB, fechas ISO en el HTML; la muestra quedó truncada), Teatro Municipal (payload Nuxt de 2 MB, muestra truncada),
  Matucana 100 (`/esta-semana-en-m100/`, HTML) → falta una tercera sonda que guarde las páginas completas.
- Noche de Museos: `api.nochedemuseos.cl` responde pero las rutas `/actividades` y `/espacios` (vistas en el bundle) dan 404 tal cual; falta el prefijo.
- Municipalidades: Recoleta responde 403 al bot; Quinta Normal no resolvió el dominio probado; Providencia usa otro portal.
- Agregadores (SeSale!, Panoramas.app): descartados por ahora (duplican a las fuentes primarias y sus condiciones de uso no se han revisado).
- "Me interesa" y baliza hacia Semana (requiere decidir persistencia, tocaría `core/persistence.js` y el export).

## Cumplimiento del lineamiento (§4.6, verificado en el código y en la app completa — 14-nov-2026)
Módulo 14 `PanoramasPage`: **cumple**. Rediseñado en esta entrega (la v1 del 13-nov no cumplía: título propio, scroll permanente, y además quedó fuera de `ORDER`, por lo que la pestaña no se veía).
- N1: sobre `.app-fit` (`page===14` en la lista de `core/App.jsx`); no usa `useAltoLibre` ni `MarcoAngst`; reutiliza `FilaSeccion`, `T_CLARO`, `chip` (fadimanUi) y `useDesborde` (shared/ui).
- N2: franja de estado arriba (ficha del próximo panorama + filtros) y filas-encabezado que se abren de a una (Hoy, Mañana, Esta semana, Próximas dos semanas, Más adelante, En curso). Sin ventanas emergentes.
- N3: colapsado no desborda ni scrolla; medido en Chromium móvil (390 px de ancho) con la app completa: área libre 481 / 551 / 631 / 721 px → desborde 0, pie visible, la página no se desliza. Con una fila abierta el scroll vive solo en su cuerpo (a 481 px el cuerpo abierto mide 169 px).
- R6: sin título propio. R7: Caveat + DM Sans, fondo claro del marco. R8: sin claves de localStorage nuevas; `audit:export` OK.
- Qué se ve colapsado: ficha del próximo panorama, filtros, y una fila por grupo con su conteo y el primer título. Qué se expande: la lista de tarjetas del grupo.
- **No probado:** tablet (vertical/horizontal), celular real, y las tipografías Caveat/DM Sans (la prueba usó las de respaldo). Con más de 5 filas a 481 px la ficha se encoge hasta 100 px; si aun así no cabe, actúa la válvula (scroll + `console.warn`).
