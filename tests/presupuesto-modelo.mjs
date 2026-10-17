// Issue #24 — modelo de presupuesto (sobres, sub-partidas, saldos y gastos).
import assert from "node:assert/strict";
import {
  periodoDeFecha, limpiarParaNuevoPeriodo, resolverPeriodo, inicioSobres, estadoBolsillo, estadoFila,
  validarGasto, agregarGasto, quitarGasto, puedeEliminar, maxSubMonto, bolsillosDe, sinRepartir, claveBolsillo,
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
assert.deepEqual(e, { inicial: 5000, asignado: 60000, gastado: 20000, saldo: 45000 });
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

console.log("presupuesto-modelo: OK");
