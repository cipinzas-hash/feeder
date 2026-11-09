import assert from "node:assert/strict";
import { estaAlDia, listaDeNavegacion } from "../modules/vitrina/navegacion.js";

// Series al día: vio algo y no le queda nada emitido por ver
assert.equal(estaAlDia({ vistos: 10, pendientes: 0 }), true);
assert.equal(estaAlDia({ vistos: 10, pendientes: 2 }), false);   // salió un episodio nuevo: reaparece
assert.equal(estaAlDia({ vistos: 0, pendientes: 0 }), false);    // sin ver nada no es "al día"
assert.equal(estaAlDia(null), false);                            // sin datos de avance: no se oculta

// Navegación del detalle: respeta la lista filtrada del carrusel
const completa = [{ guid: "a" }, { guid: "b" }, { guid: "c" }, { guid: "d" }];
const filtrada = [{ guid: "b" }, { guid: "d" }];
const mem = { lista: filtrada, listaCat: "Series" };
assert.deepEqual(listaDeNavegacion(mem, "Series", completa, "b"), filtrada);
// otra categoría, sin lista, lista vacía o ítem fuera de ella: cae al catálogo completo
assert.equal(listaDeNavegacion(mem, "Películas", completa, "b"), completa);
assert.equal(listaDeNavegacion({ lista: null, listaCat: null }, "Series", completa, "b"), completa);
assert.equal(listaDeNavegacion({ lista: [], listaCat: "Series" }, "Series", completa, "b"), completa);
assert.equal(listaDeNavegacion(mem, "Series", completa, "a"), completa);
assert.equal(listaDeNavegacion(undefined, "Series", undefined, "a").length, 0);
console.log("vitrina-ajustes OK");
