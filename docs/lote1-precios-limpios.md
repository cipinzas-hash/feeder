# Lote 1 · Precios limpios (rama `precios-limpios`, 16-nov-2026)

Origen: Cristopher reportó saltos de precio (de subida y bajada) en muchas cartas de Pokécripto. El análisis del
historial real (Angst-data, 980 filas) mostró dos fenómenos distintos y este lote ataca ambos. Detalle de la medición al final.

## Qué cambia

1. **Cortes de historial** (`lib/historial.mjs`, `marcarCortes`). Un snapshot que sigue a una *costura de datos* grande
   (cambio de fuente —incluido «sin fuente → tpl»—, de base NM/LP o de tcgId, con ≥25 % y ≥ US$0,10) se marca `corte:true`.
   Idempotente: el bot lo corre cada día sobre todo el historial y solo agrega marcas. El gráfico no une la línea a través de
   un corte (marca vertical punteada) y las variaciones 7/30/90/180/360 d y la vista «Historial de snapshots» solo comparan
   dentro del tramo posterior al último corte. La compactación mensual conserva la marca. **No se borra ningún snapshot.**
2. **Base NM fija** (`pricing.mjs`, `precioDeCarta`). El precio es el Near Mint (`base:"nm"`). Si ese día la API solo trae
   Lightly Played y la carta venía de NM (último snapshot de tcgpricelookup, < 14 días), el bot **conserva el último NM**
   (no escribe snapshot; solo `tcgIntento`). Pasados 14 días acepta el LP marcado `base:"lp"`. Antes `nm || lp` alternaba entre
   dos niveles fijos según el día.
3. **Cada snapshot nuevo guarda `tid` (tcgId), `var` (variante que declara la API) y `base`** (`addSnapshot(..., campos)`), para
   poder explicar un salto a posteriori. Los snapshots anteriores no los tienen.
4. **Mercado delgado** (rango (alto−bajo)/market ≥ 1,5): el gráfico dibuja la **mediana móvil de 7 días** (puntos crudos tenues,
   rótulo «mediana 7 d · mercado delgado») y las variaciones por ventana usan esa serie. El precio mostrado y el dato crudo
   no cambian. La vista «Historial de snapshots» sigue usando el dato crudo (solo respeta cortes).
5. **Sonda tcgcsv → Pokémon** (`sonda-tcgcsv-pokemon.mjs` + workflow): solo lee. Informe en `docs/sonda-tcgcsv-pokemon.md`.
   Mide emparejamiento, acabados (alcance del selector holo/reverse), sellos/promos, precio vs tcgpricelookup y el archivo histórico
   mensual de tcgcsv (base del lote «Historial mensual»).

## Qué NO cambia
Precio mostrado, `tcgMarket`, cola y cupo del bot, descubrimiento, designaciones manuales, inventario (más allá de las marcas
`corte` y los campos nuevos de cada snapshot nuevo). El botón de refresco manual de una carta escribe `tid/var/base` y marca
cortes, pero **no** aplica la regla de conservar NM (solo la aplica el bot).

## Medición que motivó el lote (inventario real, 16-nov-2026)
- 227 de 980 filas (23 %) tenían algún salto ≥40 % y ≥ US$0,50; **90 % venían tras un hueco ≥10 días con cambio de fuente**
  (snapshots sin `src` o de pokemontcg.io → tcgpricelookup, concentrados el 26-31 oct, cuando se reactivó el descubrimiento).
- Simulación del marcado sobre una copia: 288 filas reciben ≥1 corte (304 en total); 223 de los 256 saltos grandes quedan como corte.
- Vaivenes (sube y baja ≥15 %, snapshots diarios tpl desde 17-oct): 41 cartas con ≥2; con mediana de 7 d en las de mercado
  delgado (267 cartas) baja a 6 cartas con ≥2 (150 → 26 vaivenes en total).
- La rareza vacía (91 % de las filas) NO explica los saltos; el sello de liga no se puede confirmar con estos datos: lo mide la sonda.

## Pruebas
`node tests/pokecripto-historial.mjs` (11), `tests/pokecripto-bot.mjs` (16, incluye base NM, extras y cortes),
`tests/pokecripto-batch.mjs` (precioDeApi con base/variante) y el resto de `tests/pokecripto-*.mjs`. Rama sin fusionar a main:
el bot diario sigue corriendo con el código de main hasta que se fusione.

## Pendiente (fuera de este lote)
Selector de acabado (holo/reverse), lote «Historial mensual» (archivo de tcgcsv), estructura multi-juego, Yu-Gi-Oh!/Digimon en
Pokécripto, cambio de fuente de Pokémon a tcgcsv. Quedan sin guardar la variante/acabado en snapshots viejos.
