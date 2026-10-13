import assert from "node:assert/strict";
import { heredarVideoteca } from "../modules/feed/scripts/lib/videoteca.mjs";

const previas = [
  { cat: "Microdocumentales", items: [{ guid: "a", title: "A", addedAt: "x" }, { guid: "b" }] },
  { cat: "Conciertos", items: [{ guid: "c", duracionSegundos: 3600 }] },
  { cat: "Gaming", items: [{ guid: "g" }] },            // otra categoría: no se hereda
];
// corrida sin nada de YouTube: se heredan los 3 de videoteca
let h = heredarVideoteca(previas, [{ guid: "z" }]);
assert.deepEqual(h.map(i => i.guid).sort(), ["a", "b", "c"]);
assert.equal(h.find(i => i.guid === "a").addedAt, "x");  // conserva lo ya sellado
// lo que sí vino fresco no se duplica
h = heredarVideoteca(previas, [{ guid: "a" }, { guid: "c" }]);
assert.deepEqual(h.map(i => i.guid), ["b"]);
// sin feed previo / sin categorías
assert.deepEqual(heredarVideoteca(undefined, []), []);
assert.deepEqual(heredarVideoteca([], [{ guid: "a" }]), []);
// guid repetido en el previo
assert.deepEqual(heredarVideoteca([{ cat: "Conciertos", items: [{ guid: "q" }, { guid: "q" }] }], []).length, 1);
console.log("videoteca.mjs OK");
