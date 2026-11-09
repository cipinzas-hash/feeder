# Pokécripto: reglas de las colecciones automáticas (issue #39, 9-nov-2026)

Pedido de Cristopher: Mega y Tera solo con las Double Rare, cada colección individual y una colección nueva de ACE SPEC.

## Qué entra en cada colección
- **Mega:** Pokémon Mega de la era Mega Evolution **y rareza Double Rare** (el ex base). Fuera full art, illustration rare, special illustration rare y doradas.
- **Tera:** subtipo Tera **y rareza Double Rare**.
- **ACE SPEC:** todas las ACE SPEC desde que existen (todos los sets del catálogo de pokemontcg.io): rareza «ACE SPEC Rare» o subtipo «ACE SPEC».
- Dark, ilustradores y Pikachu 30 no cambian.
- Las reglas viven en `REGLAS_COLECCION` (`PokecriptoPage.jsx`); los predicados de rareza, en `lib/colecciones.mjs`.

## Colecciones individuales: una carta de inventario por colección
Antes, el escaneo no agregaba una carta si ese `cardId` ya estaba en **cualquier** carpeta, y el avance (`conseguidas/total`, el estado y la ficha) miraba cualquier carpeta: una Mega que también es Dark solo existía en una de las dos y lo que tenías en una contaba en la otra. Ahora:
- el escaneo (Dark, ilustradores y reglas) deduplica por **colección + cardId**;
- `mergeDarkWithInv`, el avance del menú «Colecciones», marcar conseguida y el modal de precio usan la carta **de esa colección** (`invEnCarpeta` / `invDeCarta`, sin respaldo en otra carpeta). Con una colección abierta, el detalle también resuelve la entrada del catálogo de esa colección (`catDeCarta`);
- una carta que está en dos colecciones **necesita dos ejemplares**, uno por colección. Cada una es una fila de inventario con su estado, costo, notas y precio; la fila nueva hereda de su hermana lo que es de la carta (rareza, ilustrador, imágenes, último precio y `tcgId`), no el estado ni el historial (el bot junta el de cada fila).
- `entradasFaltantes` (efecto de `PokecriptoPage.jsx`) crea en hunting las cartas que le faltaban a su colección (en los datos reales al 9-nov: 32 entradas, 26 de ellas Mega, que estaban «cubiertas» por la carta de otra colección).

## Bajas por regla (solo en hunting)
Las cartas de Mega/Tera que no son Double Rare se dan de baja **solo si siguen en hunting**; una que ya conseguiste o compraste se queda (misma regla de siempre). Cada baja se encola para que el bot la quite también del canónico.
- La rareza no estaba guardada (los escaneos viejos no pedían `rarity`). Un efecto pide una sola vez, **por set** (solo `id` y `rarity`), la rareza de las cartas de Mega/Tera sin dato y la guarda en el catálogo (`rarity`, identidad de la carta) y en las cartas de inventario que no la tengan. Con rareza desconocida no se quita nada (no se adivina) y no se crea la carta propia hasta saberla.
- Dato nuevo persistido: `rarity` en las entradas del catálogo (`pokeDarkCatalogo`), que ya viaja en export/import.

## Pruebas
`tests/pokecripto-colecciones.mjs` (rarezas, ACE SPEC, independencia por colección, cartas que faltan, idempotencia). Además, montando la página real en jsdom con el estado real: sin claves `carpeta::cardId` repetidas, sin cartas huérfanas, ninguna carta conseguida dada de baja.
