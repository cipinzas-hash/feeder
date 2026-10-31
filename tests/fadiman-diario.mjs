// Modelo del diario de seguimiento (modules/fadiman/diarioModel.js).
import assert from "node:assert/strict";
import {
  leerDiario, conCampo, conBase, alternarEfecto, hayAlerta, claveLocal, sumarDias,
  rangoDias, serie, resumen, compararToma, textoResumen, DIARIO_VACIO,
} from "../modules/fadiman/diarioModel.js";

// fecha local, no UTC: 23:30 del 30-oct-2026 en hora local sigue siendo el 30
assert.equal(claveLocal(new Date(2026, 9, 30, 23, 30)), "2026-10-30");
assert.equal(sumarDias("2026-10-31", 1), "2026-11-01");
assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
assert.deepEqual(rangoDias("2026-10-31", 3), ["2026-10-29", "2026-10-30", "2026-10-31"]);

// leerDiario tolera datos viejos / vacíos y no muta
assert.deepEqual(leerDiario({}).dias, {});
assert.deepEqual(leerDiario(undefined).cfg, { mg: 10 });
const viejo = { fadiman: { startDate: "2026-10-31", active: true }, fadimanLogs: { "2026-10-31": { dosed: true } } };
const d0 = leerDiario(viejo);
assert.deepEqual(d0.dias, {});

// escribir un campo conserva el resto de fadimanData (reiniciar protocolo no toca el diario)
let d = conCampo(d0, "2026-10-31", "tomo", true, true);
assert.equal(d.dias["2026-10-31"].protocolo, true);
d = conCampo(d, "2026-10-31", "foco", 4, false);
assert.equal(d.dias["2026-10-31"].protocolo, true, "protocolo se sella al crear la entrada y no cambia");
assert.equal(DIARIO_VACIO.dias["2026-10-31"], undefined, "no muta la constante");
assert.equal(d0.dias["2026-10-31"], undefined, "no muta el original");
const tras = { ...viejo, fadiman: { startDate: "2026-11-07", active: true }, fadimanLogs: {}, fadimanDiario: d };
assert.equal(leerDiario(tras).dias["2026-10-31"].foco, 4);

// efectos y alerta
let e = { efectos: [] };
e = { efectos: alternarEfecto(e, "cefalea") };
assert.equal(hayAlerta(e), false);
e = { efectos: alternarEfecto(e, "palpitaciones") };
assert.equal(hayAlerta(e), true);
e = { efectos: alternarEfecto(e, "palpitaciones") };
assert.deepEqual(e.efectos, ["cefalea"]);

// resumen: 5 días, el primer registro es el 27; lo anterior no cuenta como "sin toma"
let dia = leerDiario({});
const set = (k, c, v) => { dia = conCampo(dia, k, c, v, false); };
for (const [k, tomo, foco] of [["2026-10-27", true, 4], ["2026-10-28", false, 2], ["2026-10-29", true, 5], ["2026-10-31", true, 3]]) {
  set(k, "tomo", tomo); set(k, "foco", foco);
}
set("2026-10-27", "efectos", ["cefalea", "bocaSeca"]);
set("2026-10-29", "efectos", ["cefalea", "palpitaciones"]);
set("2026-10-29", "efIni", "09:00"); set("2026-10-29", "efFin", "15:00");
set("2026-10-27", "efIni", "10:00"); set("2026-10-27", "efFin", "16:00");
set("2026-10-31", "evento", "sube a 20 mg");
dia = conBase(dia, "foco", 2);
const r = resumen(dia, "2026-10-31", 14);
assert.equal(r.desde, "2026-10-18");
assert.equal(r.diasEnRango, 5, "27,28,29,30,31");
assert.equal(r.conRegistro, 4);
assert.equal(r.tomas, 3);
assert.equal(r.sinToma, 2, "el 28 (registrado sin toma) y el 30 (sin entrada)");
assert.equal(r.promedios.foco.avg, 3.5);
assert.equal(r.promedios.foco.base, 2);
assert.equal(r.efectos.cefalea, 2);
assert.equal(r.efectoInicio, "09:30");
assert.equal(r.efectoFin, "15:30");
assert.deepEqual(r.alerta, ["2026-10-29"]);
assert.equal(r.eventos.length, 1);

// serie con huecos
const s = serie(dia, "foco", "2026-10-31", 5);
assert.deepEqual(s.map((p) => p.v), [4, 2, 5, null, 3]);
assert.equal(s[4].evento, true);

// con toma vs. sin toma + cruces
const cruz = (k) => ({ "2026-10-27": { estres: 4, tareasHechas: 3, tareasTotal: 4, ejercicio: true }, "2026-10-28": { estres: 6, tareasHechas: 1, tareasTotal: 4, ejercicio: false } }[k] || null);
const c = compararToma(dia, "2026-10-31", 14, cruz);
assert.equal(c.con.n, 3);
assert.equal(c.sin.n, 1);
assert.equal(c.sin.foco, 2);
assert.equal(Math.round(c.sin.tareasPct), 25);
assert.equal(c.con.estres, 4);

// texto exportable: contiene lo esencial y no revienta con datos vacíos
const t = textoResumen(dia, "2026-10-31", 14, cruz);
assert.match(t, /SEGUIMIENTO — 18-10-2026 a 31-10-2026/);
assert.match(t, /Foco: 3\.5 · n=4 · base 2/);
assert.match(t, /Cefalea 2\/4 días/);
assert.match(t, /palpitaciones o dolor de pecho: 29-10-2026/);
assert.match(t, /Con toma \(n=3\) vs\. sin toma \(n=1\)/);
assert.doesNotThrow(() => textoResumen(leerDiario({}), "2026-10-31", 7));
const vacio = resumen(leerDiario({}), "2026-10-31", 7);
assert.equal(vacio.conRegistro, 0);
assert.equal(vacio.diasEnRango, 0);

console.log("fadiman-diario: OK");
