import assert from "node:assert/strict";
import { inferirEp, armarVista, encodeRangos, decodeRangos, epMapToSet, setToEpMap, parseSxxExx, mergeEpisodeOps, applyOps, agruparPorTemporada, keyEp } from "../modules/shared/episodios.js";

assert.equal(encodeRangos([1,2,3,5,7,8,10]), "1-3,5,7-8,10");
assert.equal(encodeRangos([3,1,2,2,"4"]), "1-4");
assert.equal(encodeRangos([]), "");
assert.deepEqual(decodeRangos("1-3,5,7-8"), [1,2,3,5,7,8]);
assert.deepEqual(decodeRangos(""), []);
assert.deepEqual(decodeRangos("x,2"), [2]);
for (const arr of [[1],[1,2,3],[2,4,6],[1,2,4,5,6,9]]) assert.deepEqual(decodeRangos(encodeRangos(arr)), arr);

const m = { "1": "1-3", "2": "2,4" };
const s = epMapToSet(m);
assert.equal(s.size, 5); assert.ok(s.has("1-2") && s.has("2-4") && !s.has("2-3"));
assert.deepEqual(setToEpMap(s), m);

assert.deepEqual(parseSxxExx("S28E05"), { t: 28, e: 5 });
assert.equal(parseSxxExx("28x05"), null); assert.equal(parseSxxExx(undefined), null);

// merge: gana la tanda más nueva por episodio
const a = { marcar: [[1,1],[1,2]], desmarcar: [] };
const b = { marcar: [[1,3]], desmarcar: [[1,2]] };
const mg = mergeEpisodeOps(a, b);
assert.deepEqual(mg.marcar.sort(), [[1,1],[1,3]]); assert.deepEqual(mg.desmarcar, [[1,2]]);
assert.deepEqual(mergeEpisodeOps(mg, { marcar: [[1,2]], desmarcar: [] }).desmarcar, []);

const aplicado = applyOps(new Set(["1-1","1-2"]), { marcar: [[1,5]], desmarcar: [[1,1]] });
assert.deepEqual([...aplicado].sort(), ["1-2","1-5"]);

assert.deepEqual(agruparPorTemporada([[2,3],[1,1],[1,2],[2,1],[1,1]]),
  [{ number: 1, episodes: [{number:1},{number:2}] }, { number: 2, episodes: [{number:1},{number:3}] }]);
assert.equal(keyEp(3, 4), "3-4");

// armarVista
const entry = { ep: { "1": "1-2" }, temporadas: [
  { n: 2, eps: [[1, "c", "2020-03-01"], [2, "d", "2099-01-01"]] },
  { n: 1, eps: [[1, "a", "2020-01-01"], [2, "b", "2020-01-08"], [3, "x", "2020-01-15"]] },
] };
let v = armarVista(entry, {}, "2026-10-12");
assert.deepEqual(v.temporadas.map(t => t.n), [1, 2]);            // ordena por temporada
assert.equal(v.total, 5); assert.equal(v.emitidos, 4); assert.equal(v.vistos, 2);
assert.equal(v.pendientes, 2);                                    // T1E3 y T2E1 (T2E2 no salió)
assert.deepEqual(v.siguiente, { t: 1, e: 3, nombre: "x", fecha: "2020-01-15" });
assert.equal(v.proximo.t, 2); assert.equal(v.proximo.e, 2);
assert.equal(v.temporadas[0].pendientes, 1); assert.equal(v.temporadas[0].vistos, 2);
// overlay: marcar T1E3 y desmarcar T1E1
v = armarVista(entry, { "1-3": { v: true }, "1-1": { v: false } }, "2026-10-12");
assert.equal(v.vistos, 2); assert.equal(v.pendientes, 2);
assert.deepEqual(v.siguiente && [v.siguiente.t, v.siguiente.e], [1, 1]);
assert.equal(armarVista({ ep: {}, temporadas: [] }, null, "2026-10-12").total, 0);

// inferirEp
const temps = [{ n: 1, eps: [[1,"a",null],[2,"b",null],[3,"c",null]] }, { n: 2, eps: [[1,"d",null],[2,"e",null]] }];
assert.deepEqual(inferirEp(temps, { temporada: 2, episodio: 1 }, 4, 5), { "1": "1-3", "2": "1" });   // dropped: secuencial
assert.deepEqual(inferirEp(temps, { temporada: 2, episodio: 2 }, 5, 5), { "1": "1-3", "2": "1-2" }); // completa
assert.deepEqual(inferirEp(temps, null, 5, 5), { "1": "1-3", "2": "1-2" });                          // completa sin last_watched
assert.equal(inferirEp(temps, null, 2, 5), null);                                                   // sin datos para inferir
assert.deepEqual(inferirEp(temps, { temporada: 1, episodio: 2 }, 2, 5), { "1": "1-2" });
console.log("episodios.mjs OK");
