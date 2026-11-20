# Sonda tcgcsv → Pokémon (2026-11-20)

Generado por `modules/feed/scripts/sonda-tcgcsv-pokemon.mjs`. Solo lectura. Categoría tcgcsv: **3** (Pokemon), 222 sets, 30160 productos de carta, 31741 con precio. Sets que fallaron al bajar: 0.

## 1. Emparejamiento del inventario (set + número + nombre)

| Resultado | Filas | % |
|---|---:|---:|
| Emparejadas con un solo producto | 887 | 91 % |
| Emparejadas con varios productos (se elige el que tiene más precios) | 0 | 0 % |
| Solo existe una versión con sello/promo del mismo nombre y número | 30 | 3 % |
| Set no encontrado | 38 | 4 % |
| Set encontrado pero no el número | 10 | 1 % |
| Número encontrado pero distinto nombre | 13 | 1 % |
| **Total filas activas** | 978 | |

Ejemplos «sinSet»: Nest Ball (Scarlet & Violet); Switch (151); Scream Tail (Scarlet & Violet Black Star Promos); Gastly (151); Haunter (151); Gengar (151); Magnemite (EX Trainer Kit Latios); Smeargle (Wizards Black Star Promos)

Ejemplos «sinNumero»: Poliwag 125 (Expedition Base Set); Rattata 128 (Expedition Base Set); Squirtle 131 (Expedition Base Set); Vulpix 136 (Expedition Base Set); Cubone 103 (Expedition Base Set); Magikarp 118 (Expedition Base Set); Pidgey 123 (Expedition Base Set); Moo-Moo Milk 155 (Expedition Base Set)

Ejemplos «sinNombre»: Poliwrath 24 (Expedition Base Set) ↔ Charmeleon; Poliwrath 60 (Expedition Base Set) ↔ Ponyta; Poliwhirl 89 (Expedition Base Set) ↔ Revive; Pidgeot 23 (Expedition Base Set) ↔ Arcanine; Pidgeot 59 (Expedition Base Set) ↔ Poliwag; Charmeleon 73 (Expedition Base Set) ↔ Imposter Professor Oak; Pidgeotto 88 (Expedition Base Set) ↔ Professor Oak; Bulbasaur 95 (Expedition Base Set) ↔ Switch

## 2. Acabados (subtipos con precio) en las filas emparejadas

| Combinación de acabados con precio | Filas |
|---|---:|
| Normal + Reverse Holofoil | 458 |
| Holofoil | 344 |
| 1st Edition + Unlimited | 31 |
| Holofoil + Reverse Holofoil | 23 |
| Normal | 21 |
| Normal + Holofoil + Reverse Holofoil | 4 |
| 1st Edition Holofoil + Unlimited Holofoil | 3 |
| Unlimited Holofoil | 1 |
| Normal + Holofoil | 1 |
| Reverse Holofoil | 1 |

Filas con **2 o más acabados con precio** (alcance del selector holo / reverse): **520** de 887 (59 %).
De ellas, en 9 de 520 el acabado cuyo precio está más cerca del precio actual de tcgpricelookup no es el que elige la regla automática (Normal > Holofoil > Reverse): ahí el selector cambiaría el precio mostrado.
Sets con más filas de varios acabados: Delta Reign (30); Phantasmal Flames (19); Neo Destiny (15); Pitch Black (13); Aquapolis (12); Team Rocket Returns (12).

## 3. Sellos y promos («icono de liga»)

Sufijos entre paréntesis más frecuentes en los nombres de producto de Pokémon (cada uno es un producto aparte con su propio precio): Cosmos Holo (620) · Full Art (546) · Secret (510) · Prerelease (325) · Poke Ball Pattern (260) · Master Ball Pattern (211) · Delta Species (186) · Energy Symbol Pattern (140) · Pokemon League (122) · Team Plasma (102) · Cracked Ice Holo (101) · Regional Championships (85) · League Promo (82) · Jason Klaczynski (67) · Alternate Full Art (64) · League Challenge (55) · Non-Holo (54) · David Cohen (50) · Zachary Bokhari (48) · Shintaro Ito (47) · 30th Celebration (34) · Poke Ball (34) · Prime (33) · Holiday Calendar (32) · Tsubasa Nakamura (32).

Filas del inventario cuyo mismo nombre y número tiene un producto hermano con sello/promo en el mismo set: **0** (0 %). Precio del hermano con sello ÷ precio del producto elegido: sin datos. En 0 de esas filas el precio actual de tcgpricelookup está más cerca del hermano con sello que del producto elegido (posible emparejamiento contaminado).

Filas con **cualquier** hermano entre paréntesis (mismo nombre y número en el set): 52. Sufijos: Energy Symbol Pattern (19) · Delta Species (12) · Dusk Ball (9) · Poke Ball (4) · Team Rocket (2) · Friend Ball (2) · Charmander (2) · Pikachu (2) · Squirtle (2) · Peelable Ditto (2).

Las 30 filas «solo con sello»: sufijos Delta Species (12) · Charmander (2) · Pikachu (2) · Squirtle (2) · Team Plasma (2) · Top (1) · Bottom (1) · H22 (1); ejemplos: Croconaw δ 27 (Dragon Frontiers); Flaaffy δ 30 (Dragon Frontiers); Chikorita δ 44 (Dragon Frontiers); Ekans δ 47 (Dragon Frontiers); Darkrai & Cresselia LEGEND 99 (30th Celebration: Classic Collection); Darkrai & Cresselia LEGEND 100 (30th Celebration: Classic Collection).

### Filas sin emparejar, por set del inventario

- **sin_set** (38): Scarlet & Violet (9) · 151 (6) · Sword & Shield (4) · Sun & Moon (3) · Scarlet & Violet Black Star Promos (2) · Wizards Black Star Promos (2) · XY (2) · McDonald's Collection 2015 (2)
- **sin_numero** (10): Expedition Base Set (8) · Generations (2)
- **sin_nombre** (13): Expedition Base Set (9) · Delta Reign (3) · 30th Celebration (1)

## 4. Precio tcgcsv vs tcgpricelookup actual (tcgMarket)

- Con la regla automática de acabado: mediana 1 · p10 0.92 · p90 1.14 · n=885; dentro de ±10 %: 78 %; dentro de ±25 %: 93 %.
- Eligiendo para cada fila el acabado más cercano (cota optimista): mediana 1 · p10 0.92 · p90 1.14 · n=885; dentro de ±10 %: 78 %.

## 5. Variantes de sello entre sets (liga, prerelease, campeonato…)

Regla probada: mismo nombre base + mismo número con total (p. ej. «025/165») en **cualquier grupo** de la categoría, con un paréntesis en el nombre del producto hermano.

- Filas del inventario con **al menos una variante de sello** en otro grupo (o en el mismo): **36** de 887 (4 %). Con patrón (Poké Ball, Master Ball, logo de tipo…) además: 25.
- Tipos de sello encontrados (hermanos): campeonato (34) · evento (18) · liga (1) · prerelease (1).
- Grupos donde viven: World Championship Decks (34) · Miscellaneous Cards & Products (17) · Southeast Asia Exclusives (1) · Nintendo Promos (1) · Jumbo Cards (1).
- Precio del sello ÷ precio de la carta base (acabado automático): mediana 1.5 · p10 0.2 · p90 11.7 · n=47.

| Carta | Set | Sello | Grupo del sello | Base | Sello | × |
|---|---|---|---|---:|---:|---:|
| Zarude 56 | Pitch Black | evento (What's Your Favorite Stamp) | Miscellaneous Cards & Products | $0.18 | $52.76 | 293.1 |
| Yveltal 88 | Mega Evolution | evento (Mega Evolution Stamped) | Miscellaneous Cards & Products | $0.22 | $38.3 | 174.1 |
| Pumpkaboo 76 | Evolving Skies | campeonato (Andre Chiasson) | World Championship Decks | $0.2 | $5.8 | 29 |
| Snom 84 | Fusion Strike | evento (Holiday Calendar) | Miscellaneous Cards & Products | $0.24 | $2.99 | 12.5 |
| Swalot 50 | Hidden Legends | prerelease (Prerelease) | Nintendo Promos | $10.14 | $118.16 | 11.7 |
| Lotad 66 | Sandstorm | campeonato (Michael Gonzalez) | World Championship Decks | $2.18 | $22.4 | 10.3 |
| Pumpkaboo 76 | Evolving Skies | campeonato (Ondrej Skubal) | World Championship Decks | $0.2 | $1.96 | 9.8 |
| Dark Tyranitar 19 | 30th Celebration: Classic Collection | campeonato (Takashi Yoneda) | World Championship Decks | $5.86 | $32.99 | 5.6 |
| Bellossom 16 | Hidden Legends | campeonato (Chris Fulop) | World Championship Decks | $7.79 | $31.68 | 4.1 |
| Hearthflame Mask Ogerpon ex 40 | Twilight Masquerade | evento (Twilight Masquerade Stamp) | Jumbo Cards | $0.51 | $2.02 | 4 |
| Glaceon ex 26 | Prismatic Evolutions | evento (Prismatic Evolutions Stamp) | Miscellaneous Cards & Products | $1.7 | $6.42 | 3.8 |
| Lombre 45 | Sandstorm | campeonato (Michael Gonzalez) | World Championship Decks | $4.32 | $14.39 | 3.3 |

## 6. Archivo histórico de tcgcsv

- Archivo 2026-11-01: 4.0 MB, 221 archivos de precios de la categoría 3 (p. ej. `x/2026-11-01/1/3/prices`), 31948 productos. Primeras rutas extraídas: `x/2026-11-01/1/1/prices`, `x/2026-11-01/1/10/prices`, `x/2026-11-01/1/100/prices`, `x/2026-11-01/1/101/prices`, `x/2026-11-01/1/102/prices`, `x/2026-11-01/1/103/prices`.
- **Empalme con tcgpricelookup el 2026-11-01** (precio del archivo ÷ snapshot diario de esa fecha, mismo acabado): mediana 1 · p10 0.94 · p90 1.08 · n=311; dentro de ±10 %: 85 %; dentro de ±25 %: 93 %.
- Archivo 2024-02-08: 2.0 MB, 25344 productos; 481 de 887 filas emparejadas ya existían ese día.
- Un archivo por mes (día 1; el primero del archivo es el 2024-02-08): 34 de 34 disponibles.
