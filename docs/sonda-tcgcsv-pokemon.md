# Sonda tcgcsv → Pokémon (2026-11-17)

Generado por `modules/feed/scripts/sonda-tcgcsv-pokemon.mjs`. Solo lectura. Categoría tcgcsv: **3** (Pokemon), 221 sets, 30157 productos de carta, 31713 con precio. Sets que fallaron al bajar: 0.

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
| Normal + Reverse Holofoil | 457 |
| Holofoil | 344 |
| 1st Edition + Unlimited | 31 |
| Holofoil + Reverse Holofoil | 24 |
| Normal | 23 |
| 1st Edition Holofoil + Unlimited Holofoil | 3 |
| Normal + Holofoil + Reverse Holofoil | 3 |
| Unlimited Holofoil | 1 |
| Normal + Holofoil | 1 |

Filas con **2 o más acabados con precio** (alcance del selector holo / reverse): **519** de 887 (59 %).
De ellas, en 12 de 519 el acabado cuyo precio está más cerca del precio actual de tcgpricelookup no es el que elige la regla automática (Normal > Holofoil > Reverse): ahí el selector cambiaría el precio mostrado.
Sets con más filas de varios acabados: Delta Reign (30); Phantasmal Flames (19); Neo Destiny (15); Pitch Black (13); Aquapolis (12); Team Rocket Returns (12).

## 3. Sellos y promos («icono de liga»)

Sufijos entre paréntesis más frecuentes en los nombres de producto de Pokémon (cada uno es un producto aparte con su propio precio): Cosmos Holo (620) · Full Art (546) · Secret (510) · Prerelease (325) · Poke Ball Pattern (260) · Master Ball Pattern (211) · Delta Species (186) · Energy Symbol Pattern (140) · Pokemon League (122) · Team Plasma (102) · Cracked Ice Holo (101) · Regional Championships (85) · League Promo (82) · Jason Klaczynski (67) · Alternate Full Art (64) · League Challenge (55) · Non-Holo (54) · David Cohen (50) · Zachary Bokhari (48) · Shintaro Ito (47) · Poke Ball (34) · Prime (33) · 30th Celebration (32) · Holiday Calendar (32) · Tsubasa Nakamura (32).

Filas del inventario cuyo mismo nombre y número tiene un producto hermano con sello/promo en el mismo set: **0** (0 %). Precio del hermano con sello ÷ precio del producto elegido: sin datos. En 0 de esas filas el precio actual de tcgpricelookup está más cerca del hermano con sello que del producto elegido (posible emparejamiento contaminado).

## 4. Precio tcgcsv vs tcgpricelookup actual (tcgMarket)

- Con la regla automática de acabado: mediana 1 · p10 0.92 · p90 1.13 · n=885; dentro de ±10 %: 82 %; dentro de ±25 %: 93 %.
- Eligiendo para cada fila el acabado más cercano (cota optimista): mediana 1 · p10 0.92 · p90 1.12 · n=885; dentro de ±10 %: 82 %.

## 5. Archivo histórico de tcgcsv

- Archivo 2026-11-01: 4.0 MB, 221 archivos de precios de la categoría 3 (p. ej. `x/2026-11-01/1/3/prices`), 31948 productos. Primeras rutas extraídas: `x/2026-11-01/1/1/prices`, `x/2026-11-01/1/10/prices`, `x/2026-11-01/1/100/prices`, `x/2026-11-01/1/101/prices`, `x/2026-11-01/1/102/prices`, `x/2026-11-01/1/103/prices`.
- **Empalme con tcgpricelookup el 2026-11-01** (precio del archivo ÷ snapshot diario de esa fecha, mismo acabado): mediana 1 · p10 0.94 · p90 1.08 · n=311; dentro de ±10 %: 85 %; dentro de ±25 %: 93 %.
- Archivo 2024-02-08: 2.0 MB, 25344 productos; 481 de 887 filas emparejadas ya existían ese día.
- Un archivo por mes (día 1; el primero del archivo es el 2024-02-08): 34 de 34 disponibles.
