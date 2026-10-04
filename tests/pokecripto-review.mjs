// Pruebas de la lógica pura del flujo de revisión de cartas sin precio
// (modules/pokecripto/lib/review.mjs). Correr: node tests/pokecripto-review.mjs
import assert from "node:assert/strict";
import {
  mergePreciosBot, colaSinPrecio, variantesNombre, planBusquedas, rankCandidatos,
  mezclarCandidatos, matchAutomatico, normalizarOverridesRemotos, mergeOverrides, aplicarOverrides,
  normSet, mismoSet, urlsFoto, numeroBase,
} from "../modules/pokecripto/lib/review.mjs";

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };

t("mergePreciosBot NO borra un precio local cuando el bot no tiene precio (bug del 3-oct)", () => {
  const local = [{ id: "a", tcgMarket: 12.5, tcgUpdated: "2026-10-03", priceHistory: [{ date: "2026-10-03", market: 12.5 }] }];
  const remote = [{ id: "a", tcgMarket: null, tcgUpdated: null, priceHistory: [] }];
  const out = mergePreciosBot(local, remote);
  assert.equal(out[0].tcgMarket, 12.5);
  assert.equal(out[0].priceHistory.length, 1);
});
t("mergePreciosBot sí superpone cuando el bot tiene precio", () => {
  const local = [{ id: "a", name: "X", tcgMarket: null }];
  const remote = [{ id: "a", tcgMarket: 3, tcgLow: 2, tcgHigh: 4, tcgUpdated: "2026-10-02", priceHistory: [{ date: "2026-10-02", market: 3 }] }];
  const out = mergePreciosBot(local, remote);
  assert.equal(out[0].tcgMarket, 3); assert.equal(out[0].name, "X"); assert.equal(out[0].priceHistory.length, 1);
});
t("mergePreciosBot deja intactas las cartas que el bot no conoce y tolera entradas vacías", () => {
  const local = [{ id: "z", tcgMarket: 1 }];
  assert.deepEqual(mergePreciosBot(local, [null, { id: "otra", tcgMarket: 9 }]), local);
  assert.deepEqual(mergePreciosBot(local, null), local);
  assert.deepEqual(mergePreciosBot(null, []), []);
});
t("colaSinPrecio: solo sin precio y no vendidas, ordenada por set y número", () => {
  const inv = [
    { id: "1", set: "B", number: "10", estado: "hunting" }, { id: "2", set: "A", number: "20", estado: "hunting" },
    { id: "3", set: "A", number: "3", estado: "hunting" }, { id: "4", set: "A", number: "1", tcgMarket: 5 },
    { id: "5", set: "A", number: "2", estado: "vendida" },
  ];
  assert.deepEqual(colaSinPrecio(inv).map(c => c.id), ["3", "2", "1"]);
  assert.deepEqual(colaSinPrecio(inv, new Set(["3"])).map(c => c.id), ["2", "1"]);
});
t("variantesNombre: incluye el original, sin ex, sin Mega y sin sufijo de numeración, sin repetir", () => {
  const v = variantesNombre("Mega Darkrai ex - 116/084");
  assert.equal(v[0], "Mega Darkrai ex - 116/084");
  assert.ok(v.includes("Mega Darkrai ex")); assert.ok(v.includes("Darkrai ex")); assert.ok(v.includes("Mega Darkrai")); assert.ok(v.includes("Darkrai"));
  assert.equal(new Set(v.map(x => x.toLowerCase())).size, v.length);
});
t("variantesNombre: sin prefijo Dark/Radiant", () => {
  assert.ok(variantesNombre("Dark Charizard").includes("Charizard"));
  assert.ok(variantesNombre("Radiant Greninja").includes("Greninja"));
});
t("planBusquedas: primero nombre+número, luego variantes, luego sin número; sin repetidos", () => {
  const p = planBusquedas({ name: "Mega Darkrai ex", number: "116" });
  assert.equal(p[0].q, "Mega Darkrai ex 116");
  assert.ok(p.some(x => x.q === "Darkrai 116")); assert.ok(p.some(x => x.q === "Darkrai"));
  assert.equal(new Set(p.map(x => x.q.toLowerCase())).size, p.length);
});
t("rankCandidatos: mismo número y set primero; empata por orden original", () => {
  const carta = { name: "Pikachu", number: "25", setCode: "sv3" };
  const c = [
    { name: "Pikachu", number: "26", setId: "sv3", market: 1 },
    { name: "Pikachu", number: "25/091", setId: "sv9", market: null },
    { name: "Pikachu", number: "025", setId: "sv3", market: 2 },
  ];
  const out = rankCandidatos(carta, c);
  assert.equal(out[0].number, "025"); assert.equal(out[1].number, "25/091");
});
t("mezclarCandidatos no repite lo ya visto", () => {
  const carta = { name: "Pikachu", number: "25", setCode: "sv3" };
  const a = { name: "Pikachu", number: "25", setId: "sv3", market: 1 };
  const b = { name: "Pikachu", number: "25", setId: "sv9", market: 2 };
  const r = mezclarCandidatos(carta, [a], [a, b]);
  assert.equal(r.agregados.length, 1); assert.equal(r.todos.length, 2);
});
t("matchAutomatico: exige nombre+número+precio; nunca elige por nombre solo", () => {
  const carta = { name: "Pikachu", number: "25" };
  assert.equal(matchAutomatico(carta, [{ name: "Pikachu", number: "26", market: 3 }]), null);
  assert.equal(matchAutomatico(carta, [{ name: "Pikachu", number: "25", market: null }]), null);
  assert.equal(matchAutomatico(carta, [{ name: "Pikachu", number: "25/091", market: 3 }]).market, 3);
});
t("matchAutomatico con setCode conocido exige el mismo set (no acepta la reimpresión de otro set)", () => {
  const carta = { name: "Pikachu", number: "25", setCode: "sv3" };
  assert.equal(matchAutomatico(carta, [{ name: "Pikachu", number: "25", setId: "sv9", market: 3 }]), null);
  assert.equal(matchAutomatico(carta, [{ name: "Pikachu", number: "25", setId: "SV3", market: 3 }]).market, 3);
});
t("normalizarOverridesRemotos ignora {found:false}, arrays y entradas inválidas", () => {
  assert.deepEqual(normalizarOverridesRemotos({ found: false }), {});
  assert.deepEqual(normalizarOverridesRemotos([1, 2]), {});
  assert.deepEqual(normalizarOverridesRemotos({ a: { name: "X", number: "1" }, b: { name: "Y" }, c: null }), { a: { name: "X", number: "1" } });
});
t("mergeOverrides agrega sin perder los existentes y reemplaza el de la misma carta", () => {
  const base = { a: { name: "X", number: "1" } };
  const m1 = mergeOverrides(base, "b", { name: "Y", number: "2", setId: "s2", setCode: "S2" });
  assert.deepEqual(Object.keys(m1).sort(), ["a", "b"]);
  const m2 = mergeOverrides(m1, "b", { name: "Y2", number: "3" });
  assert.equal(m2.b.name, "Y2"); assert.equal(m2.a.name, "X");
});
t("aplicarOverrides pone tcgOverride solo a las cartas designadas y no toca lo demás", () => {
  const inv = [{ id: "a", name: "A", tcgMarket: null }, { id: "b", name: "B" }];
  const out = aplicarOverrides(inv, { a: { name: "A real", number: "7", setId: "x", setCode: "X" } });
  assert.equal(out[0].tcgOverride.name, "A real"); assert.equal(out[1].tcgOverride, undefined);
  assert.equal(out[0].name, "A");
  assert.deepEqual(aplicarOverrides(inv, { found: false }), inv);
});
t("Aquapolis: mismo nombre de set con otro código SÍ calza (era el bug) y se autodetecta", () => {
  const carta = { name: "Jumpluff", number: "17", set: "Aquapolis", setCode: "ecard2" };
  const c = { name: "Jumpluff", number: "17/147", setId: "aquapolis", setCode: "AQ", setName: "Aquapolis", market: 2.1 };
  assert.equal(mismoSet(carta, c), "nombre");
  assert.equal(matchAutomatico(carta, [c]).market, 2.1);
});
t("mismoSet: el código gana, y sets distintos no calzan aunque el nombre y número sean iguales", () => {
  assert.equal(mismoSet({ set: "X", setCode: "ecard2" }, { setId: "ECARD2", setName: "Otro" }), "codigo");
  assert.equal(mismoSet({ set: "Aquapolis", setCode: "ecard2" }, { setId: "skyridge", setCode: "SK", setName: "Skyridge" }), null);
  const carta = { name: "Jumpluff", number: "17", set: "Aquapolis", setCode: "ecard2" };
  assert.equal(matchAutomatico(carta, [{ name: "Jumpluff", number: "17/147", setId: "skyridge", setName: "Skyridge", market: 9 }]), null);
});
t("matchAutomatico acepta un candidato sin ningún dato de set (no hay con qué contrastar)", () => {
  assert.equal(matchAutomatico({ name: "Pikachu", number: "25", set: "Base", setCode: "base1" }, [{ name: "Pikachu", number: "25", market: 3 }]).market, 3);
});
t("normSet ignora el prefijo de serie y los acentos", () => {
  assert.equal(normSet("Sword & Shield: Brilliant Stars"), normSet("Brilliant Stars"));
  assert.equal(normSet("Scarlet & Violet—Paldea Evolved"), normSet("Paldea Evolved"));
  assert.notEqual(normSet("Base Set"), normSet("Base Set 2"));
});
t("urlsFoto: arma las URLs por set+número sin API, sin ceros a la izquierda y sin repetidos", () => {
  assert.equal(numeroBase("090/084"), "90"); assert.equal(numeroBase("TG05"), "TG05");
  const u = urlsFoto({ setId: "me4", setCode: "ME4", number: "116/084" });
  assert.deepEqual(u, ["https://images.pokemontcg.io/me4/116.png", "https://images.scrydex.com/pokemon/me4-116/small"]);
  const v = urlsFoto({ image: "https://x/y.png", cardId: "ecard2-H13" });
  assert.equal(v[0], "https://x/y.png"); assert.ok(v.includes("https://images.pokemontcg.io/ecard2/H13.png"));
  assert.deepEqual(urlsFoto({}), []);
});
console.log(`\n${n} pruebas en verde`);
