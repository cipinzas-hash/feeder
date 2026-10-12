import assert from "node:assert/strict";
import { encodeRangos, decodeRangos, epMapToSet, setToEpMap, parseSxxExx, mergeEpisodeOps, applyOps, agruparPorTemporada, keyEp } from "../modules/shared/episodios.js";

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
console.log("episodios.mjs OK");
