// Issue #24 — modelo de presupuesto (sobres, sub-partidas, saldos y gastos).
import assert from "node:assert/strict";
import {
  periodoDeFecha, limpiarParaNuevoPeriodo, resolverPeriodo, inicioSobres, estadoBolsillo, estadoFila,
  validarGasto, agregarGasto, quitarGasto, puedeEliminar, maxSubMonto, bolsillosDe, sinRepartir, claveBolsillo,
  puedeQuitarGasto, resumenDeudas, guiaSobres, capacidadPrestamo, candidatosPrestamo, sugerirFuentes,
  puedeGenerarPeriodo, primerArqueoPendiente, filasArqueo, guardarArqueo, rendicion, progresoMeta,
} from "../core/presupuesto-modelo.js";

// Períodos 25 → 24
assert.equal(periodoDeFecha("2026-10-17"), "2026-09");
assert.equal(periodoDeFecha("2026-10-25"), "2026-10");
assert.equal(periodoDeFecha("2026-01-10"), "2025-12");
assert.equal(periodoDeFecha(new Date(2026, 11, 24)), "2026-11");

const fila = () => ({
  id: "r1", emoji: "👕", label: "Ropa y calzado", monto: 100000, checked: true,
  subs: [{ id: "s1", label: "Colegio", monto: 60000 }, { id: "s2", label: "Calzado", monto: 30000 }],
});
const sep = {
  ingresos: { trabajo: 750000, emprendimiento: 0, reventa: 0, otros: 0 },
  gastos_base: [{ id: "b1", label: "Aseo", monto: 10000 }], personales: [], propositos: [fila()],
  apertura: { [claveBolsillo("propositos", "r1", "s1")]: 5000 },
  gastos: [{ id: "g1", fecha: "2026-10-01", sec: "propositos", rowId: "r1", subId: "s1", monto: 20000, nota: "uniforme" }],
};
const oct = { ...JSON.parse(JSON.stringify(sep)), gastos: undefined, apertura: undefined };
delete oct.gastos; delete oct.apertura;
const budgets = { "2026-09": sep, "2026-10": oct };

// Sin sobres activos
assert.equal(inicioSobres({ "2026-09": oct }), null);
assert.equal(estadoBolsillo({ "2026-09": oct }, "2026-09", "propositos", "r1", "s1"), null);
assert.equal(validarGasto({ "2026-09": oct }, { fecha: "2026-10-01", sec: "propositos", rowId: "r1", subId: "s1", monto: 1 }).ok, false);

// Reparto
assert.equal(sinRepartir(fila()), 10000);
assert.equal(bolsillosDe("propositos", fila()).length, 3);
assert.equal(maxSubMonto(fila(), "s1"), 70000);
assert.equal(bolsillosDe("propositos", { id: "x", label: "Solo", monto: 500 }).length, 1);

// Saldos y sobrante arrastrado
assert.equal(inicioSobres(budgets), "2026-09");
let e = estadoBolsillo(budgets, "2026-09", "propositos", "r1", "s1");
assert.deepEqual([e.inicial, e.asignado, e.gastado, e.saldo, e.debiaHaber], [5000, 60000, 20000, 45000, 65000]);
e = estadoBolsillo(budgets, "2026-10", "propositos", "r1", "s1");
assert.equal(e.inicial, 45000); assert.equal(e.saldo, 105000);
assert.equal(estadoBolsillo(budgets, "2026-10", "propositos", "r1", null).saldo, 20000); // sin repartir arrastra
assert.equal(estadoBolsillo(budgets, "2026-08", "propositos", "r1", "s1"), null);
// Mes futuro sin guardar: hereda filas, no gastos
assert.equal(estadoBolsillo(budgets, "2026-11", "propositos", "r1", "s1").saldo, 165000);
assert.equal(estadoFila(budgets, "2026-09", "propositos", fila()).saldo, 5000 + 100000 - 20000);

// Gasto: bloqueo por saldo del bolsillo
const g = { fecha: "2026-10-05", sec: "propositos", rowId: "r1", subId: "s2", monto: 30000 };
assert.equal(validarGasto(budgets, g).ok, true);           // = saldo exacto
assert.equal(validarGasto(budgets, { ...g, monto: 30001 }).ok, false);
assert.equal(validarGasto(budgets, { ...g, monto: 0 }).ok, false);
assert.equal(validarGasto(budgets, { ...g, sec: "gastos_base" }).ok, false); // gastos base fuera
const r = agregarGasto(budgets, { ...g, monto: 12000, nota: "zapatillas" });
assert.equal(r.periodo, "2026-09");
assert.equal(r.budget.gastos.length, 2);
assert.equal(sep.gastos.length, 1);                         // no muta
assert.equal(estadoBolsillo({ ...budgets, "2026-09": r.budget }, "2026-09", "propositos", "r1", "s2").saldo, 18000);
assert.ok(agregarGasto(budgets, { ...g, monto: 99999999 }).error);
assert.equal(quitarGasto(r.budget, r.budget.gastos[1].id).gastos.length, 1);

// Período nuevo: hereda estructura, no gastos ni apertura
const nuevo = limpiarParaNuevoPeriodo(sep);
assert.equal(nuevo.gastos, undefined); assert.equal(nuevo.apertura, undefined);
assert.equal(nuevo.propositos[0].subs.length, 2);
assert.equal(nuevo.propositos[0].checked, false);
assert.equal(resolverPeriodo({}, "2026-09").propositos.length, 0);

// Eliminar con sobres activos
assert.equal(puedeEliminar(budgets, "2026-09", "propositos", fila(), "s1").ok, false);
assert.equal(puedeEliminar({ "2026-09": oct }, "2026-09", "propositos", fila(), "s1").ok, true);


// ── Multifinanciamiento (fase 2) ────────────────────────────────────────────
{
  const ropa = () => ({ id: "r1", emoji: "👕", label: "Ropa", monto: 100000, subs: [{ id: "s1", label: "Colegio", monto: 60000 }, { id: "s2", label: "Calzado", monto: 30000 }] });
  const ocio = () => ({ id: "r2", emoji: "🎈", label: "Ocio", monto: 50000 });
  const sepM = { ingresos: {}, gastos_base: [], personales: [], propositos: [ropa(), ocio()], apertura: {} };
  const octM = { ingresos: {}, gastos_base: [], personales: [], propositos: [ropa(), ocio()] };
  let B = { "2026-09": sepM, "2026-10": octM };
  const dest = { sec: "propositos", rowId: "r1" };
  const cal = { fecha: "2026-10-05", sec: "propositos", rowId: "r1", subId: "s2" };

  assert.equal(capacidadPrestamo(B, "2026-09", "propositos", ocio()), 15000);          // 30% de 50.000
  assert.equal(sugerirFuentes(B, "2026-09", dest, 10000).fuentes[0].monto, 10000);
  assert.equal(candidatosPrestamo(B, "2026-09", dest).every(c => c.rowId !== "r1"), true);

  // Gasto de 40.000 con 30.000 de saldo: sin fuentes no pasa; con fuentes pide 10.000 a Ocio
  assert.ok(agregarGasto(B, { ...cal, monto: 40000 }).error);
  assert.ok(agregarGasto(B, { ...cal, monto: 40000, fuentes: [{ sec: "propositos", rowId: "r2", subId: null, monto: 9000 }] }).error);       // no suma
  assert.ok(agregarGasto(B, { ...cal, monto: 56000, fuentes: [{ sec: "propositos", rowId: "r2", subId: null, monto: 26000 }] }).error);      // pasa del 30%
  assert.ok(agregarGasto(B, { ...cal, monto: 40000, fuentes: [{ sec: "propositos", rowId: "r1", subId: "s1", monto: 10000 }] }).error);      // misma cartera
  const r2 = agregarGasto(B, { ...cal, monto: 40000, nota: "zapatos", fuentes: [{ sec: "propositos", rowId: "r2", subId: null, monto: 10000 }] });
  assert.ok(!r2.error, r2.error);
  assert.equal(r2.budget.prestamos.length, 1); assert.equal(r2.budget.prestamos[0].monto, 10000);
  assert.equal(r2.budget.gastos[0].prestamoId, r2.budget.prestamos[0].id);
  B = { ...B, "2026-09": r2.budget };

  // Mismo período: el préstamo mueve saldo, el gasto lo consume
  assert.equal(estadoBolsillo(B, "2026-09", "propositos", "r1", "s2").saldo, 0);
  assert.equal(estadoBolsillo(B, "2026-09", "propositos", "r2", null).saldo, 40000);
  assert.deepEqual(resumenDeudas(B, "2026-09", "propositos", "r1"), { debe: 10000, teDeben: 0 });
  assert.deepEqual(resumenDeudas(B, "2026-09", "propositos", "r2"), { debe: 0, teDeben: 10000 });

  // Período siguiente: se devuelve solo, repartido en proporción entre los bolsillos de la deudora
  const s1 = estadoBolsillo(B, "2026-10", "propositos", "r1", "s1"), s2 = estadoBolsillo(B, "2026-10", "propositos", "r1", "s2"), lib = estadoBolsillo(B, "2026-10", "propositos", "r1", null);
  assert.deepEqual([s1.devPagada, s2.devPagada, lib.devPagada], [6000, 3000, 1000]);
  assert.equal(estadoBolsillo(B, "2026-10", "propositos", "r2", null).devRecibida, 10000);
  assert.deepEqual(resumenDeudas(B, "2026-10", "propositos", "r1"), { debe: 0, teDeben: 0 });
  assert.equal(s2.debiaHaber, 0 + 30000 - 3000);
  // El dinero total se conserva: lo que sale de una cartera entra en otra
  const tot = per => estadoFila(B, per, "propositos", ropa()).saldo + estadoFila(B, per, "propositos", ocio()).saldo;
  assert.equal(tot("2026-10"), 150000 + 150000 - 40000);  // lo que sale de una cartera entra en la otra: solo el gasto sale del sistema

  // Guía mensual: cuánto debe haber en cada sobre al empezar octubre
  const g = guiaSobres(B, "2026-10");
  const fila = id => g.filas.find(f => f.row.id === id);
  assert.equal(fila("r1").debiaHaber, (60000 + 60000 - 6000) + (0 + 30000 - 3000) + (10000 + 10000 - 1000));   // Colegio + Calzado + Sin repartir
  assert.equal(fila("r2").debiaHaber, 40000 + 50000 + 10000);
  assert.equal(g.total, fila("r1").debiaHaber + fila("r2").debiaHaber);

  // Con tope del 50%: asignación 20.000 → máximo 10.000 por mes
  const chica = () => ({ id: "r3", label: "Chica", monto: 20000 });
  const rica = () => ({ id: "r4", label: "Rica", monto: 1000000 });
  let C = { "2026-09": { ingresos: {}, gastos_base: [], personales: [], propositos: [chica(), rica()], apertura: {} }, "2026-10": { ingresos: {}, gastos_base: [], personales: [], propositos: [chica(), rica()] }, "2026-11": { ingresos: {}, gastos_base: [], personales: [], propositos: [chica(), rica()] } };
  const rr = agregarGasto(C, { fecha: "2026-10-05", sec: "propositos", rowId: "r3", subId: null, monto: 50000, fuentes: [{ sec: "propositos", rowId: "r4", subId: null, monto: 30000 }] });
  assert.ok(!rr.error, rr.error);
  C = { ...C, "2026-09": rr.budget };
  assert.equal(estadoBolsillo(C, "2026-10", "propositos", "r3", null).devPagada, 10000);
  assert.equal(estadoBolsillo(C, "2026-11", "propositos", "r3", null).devPagada, 10000);
  assert.deepEqual(resumenDeudas(C, "2026-11", "propositos", "r3"), { debe: 10000, teDeben: 0 });

  // Borrados protegidos mientras haya deuda; el gasto con préstamo no se borra si ya se devolvió
  assert.equal(puedeEliminar(B, "2026-09", "propositos", ropa(), "s2").ok, false);
  assert.equal(puedeQuitarGasto(B, B["2026-09"].gastos[0]).ok, false);
  const sin = quitarGasto(B["2026-09"], B["2026-09"].gastos[0].id);
  assert.equal((sin.prestamos || []).length, 0); assert.equal(sin.gastos.length, 0);
  assert.equal(limpiarParaNuevoPeriodo(B["2026-09"]).prestamos, undefined);
}

// ── Arqueo, rendición y metas (fase 3) ──────────────────────────────────────
{
  const rop = () => ({ id: "r1", emoji: "👕", label: "Ropa", monto: 100000, subs: [{ id: "s1", label: "Colegio", monto: 60000 }, { id: "s2", label: "Calzado", monto: 30000 }] });
  const hog = () => ({ id: "r2", emoji: "🏠", label: "Hogar", monto: 40000 });
  const mk = extra => ({ ingresos: {}, gastos_base: [], personales: [], propositos: [rop(), hog()], ...extra });
  let B = { "2026-09": mk({ apertura: {} }) };

  // El período siguiente no se genera sin el arqueo del anterior
  assert.equal(puedeGenerarPeriodo(B, "2026-09").ok, true);                       // el período inicial siempre
  assert.equal(puedeGenerarPeriodo(B, "2026-10").ok, false);
  assert.equal(puedeGenerarPeriodo(B, "2026-10").requiere, "2026-09");
  assert.equal(puedeGenerarPeriodo(B, "2026-12").requiere, "2026-09");            // la cadena exige el primero pendiente
  assert.equal(puedeGenerarPeriodo({ "2026-10": mk({}) }, "2026-10").ok, true);   // sin sobres no hay compuerta
  assert.ok(agregarGasto(B, { fecha: "2026-10-26", sec: "propositos", rowId: "r2", subId: null, monto: 1000 }).error);   // octubre arranca el 25

  // Esperado al cierre = saldo según registros
  const g = agregarGasto(B, { fecha: "2026-09-30", sec: "propositos", rowId: "r2", subId: null, monto: 5000, nota: "fugas" });
  B = { "2026-09": g.budget };
  const esp = filasArqueo(B, "2026-09");
  assert.deepEqual(esp.map(f => [f.rowId, f.esperado]), [["r1", 100000], ["r2", 35000]]);

  // Todos los sobres deben contarse; una diferencia no bloquea y queda documentada
  assert.match(guardarArqueo(B, "2026-09", { fecha: "2026-10-24", conteos: { "propositos|r1": 100000 } }).error, /Falta contar/);
  const a = guardarArqueo(B, "2026-09", { fecha: "2026-10-24", conteos: { "propositos|r1": 100000, "propositos|r2": 33000 }, notas: { "propositos|r2": "se me perdió una boleta" } });
  assert.ok(!a.error, a.error);
  const f2 = a.budget.arqueo.filas.find(f => f.rowId === "r2");
  assert.deepEqual([f2.esperado, f2.contado, f2.diferencia, f2.nota], [35000, 33000, -2000, "se me perdió una boleta"]);
  B = { "2026-09": a.budget };
  assert.equal(puedeGenerarPeriodo(B, "2026-10").ok, true);
  assert.equal(primerArqueoPendiente(B, "2026-12"), "2026-10");
  assert.ok(agregarGasto(B, { fecha: "2026-10-26", sec: "propositos", rowId: "r2", subId: null, monto: 1000 }).periodo === "2026-10");
  assert.equal(limpiarParaNuevoPeriodo(B["2026-09"]).arqueo, undefined);           // no se hereda

  // Rendición del período
  const r = rendicion(B, "2026-09");
  assert.equal(r.totales.asignado, 140000); assert.equal(r.totales.gastado, 5000); assert.equal(r.totales.saldo, 135000);
  assert.equal(r.totales.diferencia, -2000);
  const hogar = r.filas.find(f => f.row.id === "r2");
  assert.equal(hogar.gastos.length, 1); assert.equal(hogar.gastos[0].nota, "fugas"); assert.equal(hogar.arqueo.diferencia, -2000);
  assert.equal(rendicion({ "2026-09": mk({}) }, "2026-09"), null);

  // Metas con fecha: período 2026-09; aportes futuros en 25-oct, 25-nov, 25-dic
  let m = progresoMeta({ saldo: 10000, objetivo: 100000, fecha: "2026-12-31", periodo: "2026-09", aporteMensual: 30000 });
  assert.deepEqual([m.falta, m.meses, m.necesario, m.alDia, m.cumpleEn], [90000, 3, 30000, true, "2026-12"]);
  m = progresoMeta({ saldo: 10000, objetivo: 100000, fecha: "2026-12-31", periodo: "2026-09", aporteMensual: 20000 });
  assert.deepEqual([m.necesario, m.alDia, m.cumpleEn], [30000, false, "2027-02"]);
  assert.equal(progresoMeta({ saldo: 0, objetivo: 50000, fecha: "2026-10-10", periodo: "2026-09", aporteMensual: 50000 }).meses, 0);  // vence antes del próximo aporte
  assert.equal(progresoMeta({ saldo: 100000, objetivo: 100000, fecha: "2026-12-31", periodo: "2026-09", aporteMensual: 0 }).cumplida, true);
  assert.equal(progresoMeta({ saldo: 0, objetivo: 100000, fecha: "2026-12-31", periodo: "2026-09", aporteMensual: 0 }).cumpleEn, null);
}

console.log("presupuesto-modelo: OK");
