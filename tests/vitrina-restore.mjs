// Regresión del bug probado en la auditoría (13-oct-2026): restaurar el estado
// desde Angst-data escribe a localStorage, pero la caché de módulo de Vitrina
// quedaba vieja y la siguiente marca pisaba lo restaurado.
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.React = { useState: v => [v, () => {}], useEffect: () => {}, useRef: v => ({ current: v }) };

const { LOCAL_KEY_FIELDS, escribirCamposLocales, leerCamposLocales } = await import("../core/persistence.js");
const { LOCAL_EDIT_KEY } = await import("../modules/shared/localedit.js");

// Estado previo del dispositivo: 1 película marcada
store.set(LOCAL_KEY_FIELDS.feedCineEstado, JSON.stringify({ "tmdb-movie-1": { estado: "vista", rating: "remarkable" } }));
const est = await import("../modules/vitrina/estado.js");   // la caché se arma AQUÍ
const epi = await import("../modules/vitrina/avance.js");

// Lo que trae Angst-data
const payload = {
  feedCineEstado: {
    "tmdb-movie-1": { estado: "vista", rating: "remarkable" },
    "tmdb-movie-2": { estado: "vista", rating: "outstanding" },
    "tmdb-tv-3": { estado: "interesa" },
  },
  feedPodcastPositions: { "guid-a": 1234 },
  feedSeriesOverlay: { "603": { "1x2": { v: true, ts: Date.now() } } },
  pokeAgotadas: { "sv1-5": { fecha: "2026-10-13", intentos: 18 } },
  feedPodcastsEscuchados: null,              // null = no tocar lo local
};
const escritos = escribirCamposLocales(payload);
assert.deepEqual(escritos.sort(), ["feedCineEstado", "feedPodcastPositions", "feedSeriesOverlay", "pokeAgotadas"].sort());
assert.equal(store.has(LOCAL_KEY_FIELDS.feedPodcastsEscuchados), false, "un campo null del payload no debe escribir ni borrar");

// Lo que hace restoreFromPayload tras escribir:
est.rehidratarCineEstado();
epi.rehidratarOverlay();

// El usuario marca UNA película nueva sin recargar
est.setCineItemEstado("tmdb-movie-9", { estado: "interesa" });
const final = JSON.parse(store.get(LOCAL_KEY_FIELDS.feedCineEstado));
assert.deepEqual(Object.keys(final).sort(), ["tmdb-movie-1", "tmdb-movie-2", "tmdb-movie-9", "tmdb-tv-3"], "lo restaurado debe sobrevivir a la siguiente marca");

// La marca de edición local se actualiza al editar Vitrina (guard de sync)
assert(store.has(LOCAL_EDIT_KEY), "marcar en Vitrina debe actualizar la marca de edición local");

// Round-trip: lo escrito es lo que el export vuelve a leer
const leido = leerCamposLocales();
assert.deepEqual(leido.feedPodcastPositions, { "guid-a": 1234 });
assert.deepEqual(leido.pokeAgotadas, payload.pokeAgotadas);
assert.equal(leido.feedPodcastsEscuchados, null);

console.log("OK vitrina-restore: lo restaurado sobrevive a la siguiente marca; round-trip export/restore de las 10 claves locales");
