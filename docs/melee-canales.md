# Melee: canales de producción y qué torneos se archivan

Criterio de Cristopher (nov-2026): **solo majors y súper majors** se archivan, y los videos se buscan **solo en el canal que transmite** (nunca en todo YouTube). El organizador no siempre es quien transmite: VGBootCamp produce streams de otros TOs (Riptide, GOML).

## Dónde vive
`PRODUCTION_CHANNELS` en `modules/feed/scripts/build-melee.mjs` (patrón de nombre → canal). `productionChannelFor(nombre)` devuelve el canal o `null`.

| Patrón del nombre | Canal | ID | Estilo de título |
|---|---|---|---|
| CEO, Supernova, Riptide, GOML / Get On My Level | VGBootCamp | `UCj1J3QuIftjOq9iv_rr7Egw` | vgbc: `TORNEO ETIQUETA - Ganador vs Perdedor` |
| Genesis | genesisgg | `UC7boel3KeF8CfIoe0j1WHqA` | generic: `Jugador (Fox) vs Jugador (Marth) - Ronda - Melee Singles \| GX3` |
| Port Priority | The Satellite Network | `UCqB7d-vcBxxlccHB3oMk6ew` | generic |
| Battle of BC | Galint Gaming VODs | `UCG-pxOMgCQ3AtsxVPWk3XuQ` | generic |

IDs resueltos y verificados en Actions el 8-nov-2026 (`docs/diag-canales-melee.md`, workflow `diag-canales-melee.yml`: solo lectura, ~1500 unidades de cuota).

## Reglas
- Torneo **sin patrón** → no entra a la Fase 2 (sets, upsets en vivo, archivo): ni búsqueda de videos ni archivo. Queda anotado en `meleeDebug` como `sinCanalMapeado: true` y en el log como `⚠ Melee · "…" no tiene canal de producción mapeado`. Si es un major nuevo, se agrega a `PRODUCTION_CHANNELS`. Los avisos "se viene…" (hype) siguen para todos los torneos del listado.
- Los archivos ya construidos de torneos pasados **no se tocan** (se conservan como están).
- La búsqueda usa una **ventana de fechas**: videos publicados desde el día antes del evento hasta 75 días después (evita colar otra edición del mismo torneo, p. ej. GX3 vs GX4 con los mismos jugadores).
- Estilo `generic`: la consulta lleva solo los nombres (más la etiqueta de las finales GRAND/WINNERS/LOSERS FINALS, que desempata entre los mismos rivales); `vgbc` imita el título completo.
- Un clip exige **ambos nombres** en el título y un video no se reutiliza en dos sets del mismo torneo; la clave de caché incluye la ronda.

## Pendiente
- **Tipped Off** (major, transmisión sin identificar): sin canal no se archiva. Agregar cuando se conozca.
- **Taking Back Tampa** no es major: no se archiva.
- Antes de cada major nuevo conviene correr `diag-canales-melee.yml` (adaptando la lista) para resolver y verificar su canal.

## Orden del Top 8
Por eliminaciones: ronda de los 7º → Winners Semi → Losers Quarter (5º) → Winners Final → Losers Semi (4º) → Losers Final (3º) → Grand Final (+ reset). Ver `TOP8_ROUND_ORDER` y `ronda7mos()`.

Pruebas: `npm run test:melee`.
