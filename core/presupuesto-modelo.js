// Modelo puro del módulo Presupuesto (issue #24). Sin React ni DOM: lo usan
// BudgetPage, GastoModal y core/dates.js, y lo prueban tests/presupuesto-modelo.mjs.
//
// Todo vive dentro de budgets["YYYY-MM"] (un período corre del 25 al 24) como
// campos OPCIONALES. Un presupuesto sin ellos se comporta exactamente como antes.
//   fila.subs     [{id, emoji?, label, monto}]  reparto mensual de una cartera
//   budget.gastos [{id, fecha:"YYYY-MM-DD", sec, rowId, subId|null, monto, nota}]
//   budget.apertura {claveBolsillo: monto}  efectivo inicial de cada sobre; la
//                 existencia de este objeto en algún mes ACTIVA los sobres desde ese mes.
//
// Carteras = fondos por propósito y fondos personales. Los gastos base quedan fuera.
// Un "bolsillo" es una sub-partida o, con subId null, lo no repartido de la cartera
// (si la cartera no tiene sub-partidas, es la cartera entera).

export const CARTERAS = ["propositos", "personales"];
export const SECCIONES = ["gastos_base", "personales", "propositos"];
const CAMPOS_TRANSITORIOS = ["gastos", "apertura"]; // no se heredan al período siguiente

export function presupuestoVacio() {
  return { ingresos: { trabajo: 0, emprendimiento: 0, reventa: 0, otros: 0 }, gastos_base: [], personales: [], propositos: [] };
}

// ── Períodos ────────────────────────────────────────────────────────────────
export function claveMes(anio, mes0) { return `${anio}-${String(mes0 + 1).padStart(2, "0")}`; }
function partes(clave) { const [a, m] = clave.split("-").map(Number); return [a, m - 1]; }
export function claveAnterior(clave) { const [a, m] = partes(clave); const d = new Date(a, m - 1, 1); return claveMes(d.getFullYear(), d.getMonth()); }
export function claveSiguiente(clave) { const [a, m] = partes(clave); const d = new Date(a, m + 1, 1); return claveMes(d.getFullYear(), d.getMonth()); }

export function fechaDe(valor) {
  if (valor instanceof Date) return valor;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(valor);
}
export function fechaISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
// El período 2026-09 va del 25 sep al 24 oct.
export function periodoDeFecha(valor) {
  const d = fechaDe(valor);
  let a = d.getFullYear(), m = d.getMonth();
  if (d.getDate() < 25) { m -= 1; if (m < 0) { m = 11; a -= 1; } }
  return claveMes(a, m);
}

// ── Clonado de períodos ─────────────────────────────────────────────────────
// El período nuevo hereda ingresos, filas y sub-partidas; NO hereda gastos ni apertura.
export function limpiarParaNuevoPeriodo(source) {
  if (!source || typeof source !== "object") return null;
  const copia = JSON.parse(JSON.stringify(source));
  CAMPOS_TRANSITORIOS.forEach(k => { delete copia[k]; });
  copia.ingresos = { ...presupuestoVacio().ingresos, ...(copia.ingresos || {}) };
  SECCIONES.forEach(sec => { copia[sec] = (copia[sec] || []).map(r => ({ ...r, checked: false })); });
  return copia;
}

export function resolverPeriodo(budgets, clave) {
  if (budgets && budgets[clave]) return budgets[clave];
  let k = clave;
  for (let i = 0; i < 24; i++) {
    k = claveAnterior(k);
    if (budgets && budgets[k]) return limpiarParaNuevoPeriodo(budgets[k]);
  }
  return presupuestoVacio();
}

// ── Bolsillos ───────────────────────────────────────────────────────────────
export function claveBolsillo(sec, rowId, subId) { return `${sec}:${rowId}:${subId ?? "-"}`; }
export function sumaSubs(row) { return (row.subs || []).reduce((s, x) => s + (x.monto || 0), 0); }
export function sinRepartir(row) { return Math.max(0, (row.monto || 0) - sumaSubs(row)); }

export function bolsillosDe(sec, row) {
  const subs = Array.isArray(row.subs) ? row.subs : [];
  const lista = subs.map(s => ({ sec, rowId: row.id, subId: s.id, emoji: s.emoji || "", label: s.label, asignado: s.monto || 0, libre: false }));
  lista.push({
    sec, rowId: row.id, subId: null, libre: true,
    emoji: subs.length ? "" : (row.emoji || ""),
    label: subs.length ? "Sin repartir" : row.label,
    asignado: subs.length ? sinRepartir(row) : (row.monto || 0),
  });
  return lista;
}

function mismoSub(a, b) { return (a ?? null) === (b ?? null); }
function asignadoDe(budget, sec, rowId, subId) {
  const fila = (budget[sec] || []).find(r => r.id === rowId);
  if (!fila) return 0;
  const b = bolsillosDe(sec, fila).find(x => mismoSub(x.subId, subId));
  return b ? b.asignado : 0;
}
export function gastosDe(budget, sec, rowId, subId) {
  return (budget.gastos || []).filter(g => g.sec === sec && g.rowId === rowId && (subId === undefined || mismoSub(g.subId, subId)));
}
function gastadoDe(budget, sec, rowId, subId) {
  return gastosDe(budget, sec, rowId, subId).reduce((s, g) => s + (g.monto || 0), 0);
}

// ── Saldos (sobrante arrastrado) ────────────────────────────────────────────
export function inicioSobres(budgets) {
  const claves = Object.keys(budgets || {}).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
  return claves.find(k => budgets[k] && typeof budgets[k].apertura === "object" && budgets[k].apertura) || null;
}

// {inicial, asignado, gastado, saldo} del bolsillo en el período, o null si los sobres no estaban activos.
export function estadoBolsillo(budgets, periodo, sec, rowId, subId) {
  const inicio = inicioSobres(budgets);
  if (!inicio || periodo < inicio) return null;
  const clave = claveBolsillo(sec, rowId, subId);
  let previo = 0, estado = null, k = inicio;
  for (let i = 0; k <= periodo && i < 600; i++, k = claveSiguiente(k)) {
    const b = resolverPeriodo(budgets, k);
    const ap = b.apertura && typeof b.apertura === "object" ? b.apertura[clave] : undefined;
    const inicial = ap !== undefined ? ap : (k === inicio ? 0 : previo);
    const asignado = asignadoDe(b, sec, rowId, subId);
    const gastado = gastadoDe(b, sec, rowId, subId);
    previo = inicial + asignado - gastado;
    estado = { inicial, asignado, gastado, saldo: previo };
  }
  return estado;
}

// Estado de todos los bolsillos de una cartera. null si los sobres no están activos.
export function estadoFila(budgets, periodo, sec, row) {
  const items = bolsillosDe(sec, row).map(b => ({ ...b, estado: estadoBolsillo(budgets, periodo, sec, row.id, b.subId) }));
  if (items.some(i => !i.estado)) return null;
  return { items, saldo: items.reduce((s, i) => s + i.estado.saldo, 0), gastado: items.reduce((s, i) => s + i.estado.gastado, 0) };
}

// ── Gastos ──────────────────────────────────────────────────────────────────
// Un gasto mayor al saldo del bolsillo no se registra (por ahora no hay otra vía).
export function validarGasto(budgets, { fecha, sec, rowId, subId, monto }) {
  if (!CARTERAS.includes(sec)) return { ok: false, motivo: "Elige una cartera o un fondo personal." };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, motivo: "El monto debe ser mayor a 0." };
  const periodo = periodoDeFecha(fecha);
  const est = estadoBolsillo(budgets, periodo, sec, rowId, subId ?? null);
  if (!est) return { ok: false, motivo: "Primero inicia los sobres en Presupuesto (botón 🧾)." };
  if (monto > est.saldo) return { ok: false, motivo: "No alcanza: el saldo disponible es menor al gasto.", saldo: est.saldo };
  return { ok: true, periodo, saldo: est.saldo };
}

// Devuelve {periodo, budget} con el gasto agregado, o {error}. No modifica budgets.
export function agregarGasto(budgets, { fecha, sec, rowId, subId, monto, nota }) {
  const m = Math.round(monto);
  const v = validarGasto(budgets, { fecha, sec, rowId, subId, monto: m });
  if (!v.ok) return { error: v.motivo, saldo: v.saldo };
  const base = resolverPeriodo(budgets, v.periodo);
  const gasto = { id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, fecha: fechaISO(fechaDe(fecha)), sec, rowId, subId: subId ?? null, monto: m, nota: (nota || "").trim() };
  return { periodo: v.periodo, budget: { ...base, gastos: [...(base.gastos || []), gasto] } };
}

export function quitarGasto(budget, gastoId) {
  return { ...budget, gastos: (budget.gastos || []).filter(g => g.id !== gastoId) };
}

// ── Eliminaciones seguras ───────────────────────────────────────────────────
// Con sobres activos no se borra un bolsillo con saldo o con gastos registrados.
export function puedeEliminar(budgets, periodo, sec, row, subId) {
  const inicio = inicioSobres(budgets);
  if (!inicio || periodo < inicio) return { ok: true };
  const b = resolverPeriodo(budgets, periodo);
  const ids = subId === undefined ? bolsillosDe(sec, row).map(x => x.subId) : [subId];
  for (const id of ids) {
    const est = estadoBolsillo(budgets, periodo, sec, row.id, id);
    if (est && est.saldo !== 0) return { ok: false, motivo: "Tiene saldo en el sobre: gástalo o ajústalo antes de eliminarlo." };
    if (gastosDe(b, sec, row.id, id).length) return { ok: false, motivo: "Tiene gastos registrados en este período." };
  }
  return { ok: true };
}

// Reparto: ninguna sub-partida puede dejar el total repartido sobre el monto de la cartera.
export function maxSubMonto(row, subId) {
  const otras = (row.subs || []).filter(s => s.id !== subId).reduce((s, x) => s + (x.monto || 0), 0);
  return Math.max(0, (row.monto || 0) - otras);
}
