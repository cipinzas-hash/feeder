// Pruebas de lib/mazos.mjs (importar mazos). Correr: node tests/pokecripto-mazos.mjs
import assert from "node:assert/strict";
import { normNombre, parsearMazo, elegirVersion, rarezasDe } from "../modules/pokecripto/lib/mazos.mjs";
let n = 0; const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
t("normNombre coincide con el catálogo (acentos, comillas, paréntesis finales, símbolos)", () => {
  assert.equal(normNombre("Ash Blossom & Joyous Spring"), "ash blossom joyous spring");
  assert.equal(normNombre("Ash Blossom & Joyous Spring (Secret Rare)"), "ash blossom joyous spring");
  assert.equal(normNombre("Dark Magician Girl’s Tribute"), "dark magician girls tribute"); assert.equal(normNombre("Pot of Desires"), "pot of desires");
});
t(".ydk: main, extra y side; los pasaportes repetidos suman copias; los comentarios se ignoran", () => {
  const m = parsearMazo("#created by Cris\n#main\n14558127\n14558127\n14558127\n46986414\n#extra\n1861629\n!side\n14558127\n");
  assert.deepEqual(m.main, [{ id: 14558127, copias: 3 }, { id: 46986414, copias: 1 }]); assert.deepEqual(m.extra, [{ id: 1861629, copias: 1 }]); assert.deepEqual(m.side, [{ id: 14558127, copias: 1 }]);
});
t("texto: '3 Nombre', '3x Nombre', 'Nombre x2', secciones y códigos de set al final", () => {
  const m = parsearMazo("Main Deck\n3 Ash Blossom & Joyous Spring\n2x Pot of Desires (SDWD-EN001)\nMaxx \"C\" x3\nExtra Deck (2)\n1 Apollousa, Bow of the Goddess\nSide Deck\n2 Nibiru, the Primal Being");
  assert.deepEqual(m.main.map(x => [x.nombre, x.copias]), [["Ash Blossom & Joyous Spring", 3], ["Pot of Desires", 2], ['Maxx "C"', 3]]);
  assert.equal(m.extra[0].copias, 1); assert.equal(m.side[0].nombre, "Nibiru, the Primal Being");
});
t("elegirVersion: la más barata de la rareza pedida; si no existe, la más barata y avisa", () => {
  const v = [[1, "Unlimited", 0, "LOB-001", "Ultra Rare", 90], [2, "1st Edition", 0, "LOB-001", "Ultra Rare", 150], [3, "Unlimited", 1, "GFP2-001", "Secret Rare", 4.5], [4, "Unlimited", 2, "X", "Common", null]];
  assert.equal(elegirVersion(v, "Ultra Rare").version[0], 1); assert.equal(elegirVersion(v, "Secret Rare").sinRareza, false);
  const e = elegirVersion(v, "Starlight Rare"); assert.equal(e.version[0], 3); assert.equal(e.sinRareza, true); assert.equal(elegirVersion([], "x"), null);
  assert.equal(elegirVersion(v, "").sinRareza, false);
});
t("rarezasDe ordena por frecuencia para ofrecer «rareza para todo»", () => {
  assert.deepEqual(rarezasDe([{ v: [[0, "", 0, "", "Ultra Rare"], [0, "", 0, "", "Rare"]] }, { v: [[0, "", 0, "", "Ultra Rare"]] }]), ["Ultra Rare", "Rare"]);
});
console.log(`${n} pruebas en verde`);
