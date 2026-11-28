// Variantes de otros grupos (sobres de premio, Deck Exclusives, Cosmos Holo…) y su etiqueta. Correr: node tests/pokecripto-variantes-grupos.mjs
import assert from "node:assert/strict";
import { describirVariante, aceptaDeOtroGrupo, grupoCorto } from "../modules/pokecripto/lib/variantes-comunes.mjs";
let n = 0; const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
t("grupoCorto", () => { assert.equal(grupoCorto("Prize Pack Series Cards"), "Prize Pack Series"); assert.equal(grupoCorto("Miscellaneous Cards & Products"), "Miscellaneous"); assert.equal(grupoCorto("Deck Exclusives"), "Deck Exclusives"); });
t("Mega Absol ex de sobre de premio (producto SIN etiqueta en «Prize Pack Series Cards»): entra y se llama «Prize Pack Series»", () => {
  assert.equal(aceptaDeOtroGrupo({ sufijo: "", grupo: "Prize Pack Series Cards" }), true);
  const d = describirVariante({ juego: "pokemon", sub: "Holofoil", sufijo: "", grupo: "Prize Pack Series Cards", fueraDeSet: true });
  assert.equal(d.tipo, "sello"); assert.ok(d.esSello); assert.ok(d.etiqueta.startsWith("Prize Pack Series"));
});
t("Cosmos Holo de «Miscellaneous Cards & Products» entra como patrón (antes se descartaba)", () => {
  assert.equal(aceptaDeOtroGrupo({ sufijo: "Cosmos Holo", grupo: "Miscellaneous Cards & Products" }), true);
  const d = describirVariante({ juego: "pokemon", sub: "Holofoil", sufijo: "Cosmos Holo", grupo: "Miscellaneous Cards & Products", fueraDeSet: true }); assert.equal(d.tipo, "patron"); assert.ok(d.etiqueta.includes("Cosmos Holo"));
});
t("Prerelease, liga y staff siguen entrando como sellos", () => {
  for (const [sufijo, grupo] of [["Prerelease", "ME: Mega Evolution Promo"], ["Staff", "SWSH: Promos"], ["Pokemon League", "League & Championship Cards"]]) { assert.equal(aceptaDeOtroGrupo({ sufijo, grupo }), true, sufijo); assert.equal(describirVariante({ sufijo, grupo, fueraDeSet: true }).tipo, "sello", sufijo); }
});
t("un acabado cualquiera de otro set (Reverse Holofoil con etiqueta rara) NO entra", () => {
  assert.equal(aceptaDeOtroGrupo({ sufijo: "Reverse Holofoil", grupo: "SV: Otro Set" }), false);
});
t("las variantes del propio set no cambian de etiqueta (sin fueraDeSet)", () => {
  assert.equal(describirVariante({ sub: "Reverse Holofoil" }).tipo, "acabado"); assert.equal(describirVariante({ sub: "Normal" }).tipo, "base");
});
console.log(`${n} pruebas en verde`);
