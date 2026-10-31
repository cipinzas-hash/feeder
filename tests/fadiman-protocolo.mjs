// Protocolo Fadiman (modules/fadiman/protocoloModel.js): mismas reglas de siempre.
import assert from "node:assert/strict";
import { tipoDia, diasDosis, diasRestantes, proximaDosis, diffDias, esSabado, etiquetaDia, DURACION } from "../modules/fadiman/protocoloModel.js";

const cfg = { startDate: "2026-11-07", active: true }; // sábado
assert.equal(esSabado("2026-11-07"), true);
assert.equal(esSabado("2026-11-08"), false);
assert.equal(diffDias("2026-11-07", "2026-11-10"), 3);

// 1 día dosis · 2 descanso
assert.equal(tipoDia(cfg, "2026-11-06"), null, "antes del inicio");
assert.equal(tipoDia(cfg, "2026-11-07"), "dose");
assert.equal(tipoDia(cfg, "2026-11-08"), "rest");
assert.equal(tipoDia(cfg, "2026-11-09"), "rest");
assert.equal(tipoDia(cfg, "2026-11-10"), "dose");
assert.equal(tipoDia(null, "2026-11-07"), null);

// 60 días: última dosis el día 60 (diff 60), después "done"
const dosis = diasDosis(cfg);
assert.equal(dosis.length, 21);
assert.equal(dosis[0], "2026-11-07");
assert.equal(dosis[20], "2027-01-06");
assert.equal(tipoDia(cfg, "2027-01-06"), "dose");
assert.equal(tipoDia(cfg, "2027-01-07"), "done");
assert.equal(DURACION, 60);

// restantes / próxima
assert.equal(diasRestantes(cfg, "2026-11-07"), 60);
assert.equal(diasRestantes(cfg, "2026-11-17"), 50);
assert.equal(diasRestantes(cfg, "2027-03-01"), 0);
assert.equal(diasRestantes(null, "2026-11-07"), null);
assert.equal(proximaDosis(cfg, "2026-11-08"), "2026-11-10");
assert.equal(proximaDosis(cfg, "2027-03-01"), null);

// etiquetas
assert.equal(etiquetaDia("2026-11-07"), "7 nov");
assert.equal(etiquetaDia("2026-11-07", true), "sáb 7 nov");
console.log("fadiman-protocolo: OK");
