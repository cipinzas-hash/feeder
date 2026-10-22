// Modelo puro del módulo Presupuesto (issue #24). Sin React ni DOM: lo usan
// BudgetPage, GastoModal y core/dates.js, y lo prueban tests/presupuesto-modelo.mjs.
//
// Todo vive dentro de budgets["YYYY-MM"] (un período corre del 25 al 24) como
// campos OPCIONALES. Un presupuesto sin ellos se comporta exactamente como antes.
//   fila.subs     [{id, emoji?, label, monto}]  reparto mensual de una cartera
//   budget.gastos [{id, fecha:"YYYY-MM-DD", sec, rowId, subId|null, monto, nota}]
//   budget.apertura {claveBolsillo: monto}  efectivo inicial de cada sobre; la
//                 existencia de este objeto en algún mes ACTIVA los sobres desde ese mes.
//   budget.prestamos [{id, fecha, destino:{sec,rowId,subId}, monto, fuentes:[{sec,rowId,subId,monto}]}]
//                 multifinanciamiento: cuando un gasto supera el saldo, el faltante se pide a otras
//                 carteras. La devolución es automática (ver simular()): cada período se descuenta
//                 hasta el 50% de la asignación de la cartera deudora, desde el período siguiente.
//   budget.arqueo {fecha, filas:[{sec,rowId,label,emoji,esperado,contado,diferencia,nota}]}
//                 conteo físico de cada sobre al cierre del período. Es obligatorio antes de
//                 generar el período siguiente; una diferencia no bloquea, queda documentada.
//   fila.subs[].meta {objetivo, fecha:"YYYY-MM-DD"}  meta de ahorro con fecha de una sub-partida.
//   fila.categorias [string]  categorías de gasto de la cartera (lista fija, editable); Alimentación trae una por defecto.
//   fila.aCartera true   (solo en gastos_base) pasa a cartera desde el período siguiente (ver limpiarParaNuevoPeriodo).
//   gasto.categoria / gasto.compraId  categoría del gasto y, si viene de una compra, el id del ítem de compras.
//
// Carteras = fondos por propósito y fondos personales. Los gastos base quedan fuera.
// Un "bolsillo" es una sub-partida o, con subId null, lo no repartido de la cartera
// (si la cartera no tiene sub-partidas, es la cartera entera).

export const CARTERAS = ["propositos", "personales"];
export const SECCIONES = ["gastos_base", "personales", "propositos"];
const CAMPOS_TRANSITORIOS = ["gastos", "apertura", "prestamos", "arqueo"]; // no se heredan al período siguiente

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
  // Un gasto base marcado `aCartera` pasa a ser cartera (fondo por propósito) desde este período: conserva id, monto y emoji.
  const aMover = (copia.gastos_base || []).filter(r => r && r.aCartera);
  if (aMover.length) {
    copia.gastos_base = copia.gastos_base.filter(r => !(r && r.aCartera));
    copia.propositos = [...(copia.propositos || []), ...aMover.map(({ aCartera, ...r }) => r)];
  }
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

// ── Multifinanciamiento: préstamos y devolución automática ──────────────────
export const TOPE_PRESTAMO = 0.30;   // una cartera presta como máximo el 30% de su saldo
export const TOPE_DEVOLUCION = 0.50; // se devuelve como máximo el 50% de la asignación mensual

// Reparte `total` en enteros proporcional a `pesos`; la suma da exactamente `total`.
function repartir(total, pesos) {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0 || total <= 0) return pesos.map(() => 0);
  const out = pesos.map(p => Math.floor((total * p) / suma));
  let resto = total - out.reduce((a, b) => a + b, 0);
  const orden = pesos.map((_, i) => i).sort((x, y) => pesos[y] - pesos[x]);
  for (let j = 0; resto > 0; j = (j + 1) % orden.length, resto--) out[orden[j]] += 1;
  return out;
}

const cacheSim = new WeakMap();
const claveMesValida = k => /^\d{4}-\d{2}$/.test(k);

// Simula los préstamos mes a mes hasta `hasta`. Devuelve {meses:{mes:{claveBolsillo:{pres,dado,pag,rec}}}, prestamos:[...]}.
// Un préstamo hecho en el mes M empieza a devolverse en M+1: se descuenta (más antiguo primero)
// hasta el 50% de la asignación de la cartera deudora, repartido en proporción entre sus
// bolsillos, y vuelve a los sobres que prestaron en proporción a lo que aportó cada uno.
function simular(budgets, hasta) {
  const claves = Object.keys(budgets || {}).filter(k => claveMesValida(k) && budgets[k] && Array.isArray(budgets[k].prestamos) && budgets[k].prestamos.length).sort();
  if (!claves.length) return { meses: {}, prestamos: [] };
  let porHasta = cacheSim.get(budgets);
  if (!porHasta) { porHasta = new Map(); cacheSim.set(budgets, porHasta); }
  if (porHasta.has(hasta)) return porHasta.get(hasta);
  const meses = {}, prestamos = [];
  const mov = (m, clave, campo, v) => {
    meses[m] = meses[m] || {};
    meses[m][clave] = meses[m][clave] || { pres: 0, dado: 0, pag: 0, rec: 0 };
    meses[m][clave][campo] += v;
  };
  let k = claves[0];
  for (let i = 0; k <= hasta && i < 600; i++, k = claveSiguiente(k)) {
    const b = resolverPeriodo(budgets, k);
    const deudoras = new Map();
    prestamos.filter(p => p.pendiente > 0 && p.mes < k).forEach(p => {
      const ck = p.destino.sec + "|" + p.destino.rowId;
      if (!deudoras.has(ck)) deudoras.set(ck, []);
      deudoras.get(ck).push(p);
    });
    deudoras.forEach(lista => {
      const { sec, rowId } = lista[0].destino;
      const fila = (b[sec] || []).find(r => r.id === rowId);
      let cupo = fila ? Math.floor((fila.monto || 0) * TOPE_DEVOLUCION) : 0;
      let total = 0;
      lista.sort((x, y) => x.orden - y.orden).forEach(p => {
        const pago = Math.min(p.pendiente, cupo);
        if (pago <= 0) return;
        p.pendiente -= pago; cupo -= pago; total += pago;
        repartir(pago, p.fuentes.map(f => f.pend)).forEach((v, idx) => {
          const f = p.fuentes[idx];
          f.pend -= v;
          mov(k, claveBolsillo(f.sec, f.rowId, f.subId), "rec", v);
        });
      });
      if (total > 0) {
        const bol = bolsillosDe(sec, fila);
        repartir(total, bol.map(x => x.asignado)).forEach((v, idx) => mov(k, claveBolsillo(sec, rowId, bol[idx].subId), "pag", v));
      }
    });
    (b.prestamos || []).forEach(p => {
      prestamos.push({ id: p.id, mes: k, orden: prestamos.length, destino: p.destino, total: p.monto, pendiente: p.monto, fuentes: p.fuentes.map(f => ({ ...f, pend: f.monto })) });
      mov(k, claveBolsillo(p.destino.sec, p.destino.rowId, p.destino.subId), "pres", p.monto);
      p.fuentes.forEach(f => mov(k, claveBolsillo(f.sec, f.rowId, f.subId), "dado", f.monto));
    });
  }
  const res = { meses, prestamos };
  porHasta.set(hasta, res);
  return res;
}

// ── Saldos (sobrante arrastrado) ────────────────────────────────────────────
export function inicioSobres(budgets) {
  const claves = Object.keys(budgets || {}).filter(claveMesValida).sort();
  return claves.find(k => budgets[k] && typeof budgets[k].apertura === "object" && budgets[k].apertura) || null;
}

const SIN_MOV = { pres: 0, dado: 0, pag: 0, rec: 0 };

// Estado del bolsillo en el período, o null si los sobres no estaban activos:
//   inicial        arrastre del período anterior (o efectivo declarado al iniciar)
//   asignado       lo que le toca este mes
//   devPagada      devolución de deudas descontada de su asignación
//   devRecibida    devoluciones que le llegan por préstamos que hizo
//   debiaHaber     inicial + asignado − devPagada + devRecibida: lo que debe haber en el sobre al empezar el período
//   prestamoRecibido / prestamoDado   multifinanciamiento del período
//   gastado, saldo
export function estadoBolsillo(budgets, periodo, sec, rowId, subId) {
  const inicio = inicioSobres(budgets);
  if (!inicio || periodo < inicio) return null;
  const clave = claveBolsillo(sec, rowId, subId);
  const sim = simular(budgets, periodo);
  let previo = 0, estado = null, k = inicio;
  for (let i = 0; k <= periodo && i < 600; i++, k = claveSiguiente(k)) {
    const b = resolverPeriodo(budgets, k);
    const ap = b.apertura && typeof b.apertura === "object" ? b.apertura[clave] : undefined;
    const inicial = ap !== undefined ? ap : (k === inicio ? 0 : previo);
    const asignado = asignadoDe(b, sec, rowId, subId);
    const gastado = gastadoDe(b, sec, rowId, subId);
    const m = (sim.meses[k] && sim.meses[k][clave]) || SIN_MOV;
    const debiaHaber = inicial + asignado - m.pag + m.rec;
    previo = debiaHaber + m.pres - m.dado - gastado;
    estado = { inicial, asignado, devPagada: m.pag, devRecibida: m.rec, debiaHaber, prestamoRecibido: m.pres, prestamoDado: m.dado, gastado, saldo: previo };
  }
  return estado;
}

// Estado de todos los bolsillos de una cartera. null si los sobres no están activos.
export function estadoFila(budgets, periodo, sec, row) {
  const items = bolsillosDe(sec, row).map(b => ({ ...b, estado: estadoBolsillo(budgets, periodo, sec, row.id, b.subId) }));
  if (items.some(i => !i.estado)) return null;
  const suma = campo => items.reduce((s, i) => s + i.estado[campo], 0);
  return { items, saldo: suma("saldo"), gastado: suma("gastado"), debiaHaber: suma("debiaHaber"), inicial: suma("inicial"), asignado: suma("asignado"), devPagada: suma("devPagada"), devRecibida: suma("devRecibida"), prestamoRecibido: suma("prestamoRecibido"), prestamoDado: suma("prestamoDado") };
}

// Deudas de una cartera al cierre del período: lo que debe y lo que le deben.
export function resumenDeudas(budgets, periodo, sec, rowId) {
  const sim = simular(budgets, periodo);
  let debe = 0, teDeben = 0;
  sim.prestamos.forEach(p => {
    if (p.destino.sec === sec && p.destino.rowId === rowId) debe += p.pendiente;
    p.fuentes.forEach(f => { if (f.sec === sec && f.rowId === rowId) teDeben += f.pend; });
  });
  return { debe, teDeben };
}

// Guía mensual: cuánto debe haber en cada sobre al empezar el período. null si los sobres no están activos.
export function guiaSobres(budgets, periodo) {
  const b = resolverPeriodo(budgets, periodo);
  const filas = [];
  for (const sec of ["personales", "propositos"]) {
    for (const row of (b[sec] || [])) {
      const e = estadoFila(budgets, periodo, sec, row);
      if (!e) return null;
      filas.push({ sec, row, ...e, deudas: resumenDeudas(budgets, periodo, sec, row.id) });
    }
  }
  return { filas, total: filas.reduce((s, f) => s + f.debiaHaber, 0) };
}

// ── Gastos ──────────────────────────────────────────────────────────────────
// Un gasto mayor al saldo del bolsillo solo se registra pidiendo el faltante a otras carteras.
export function validarGasto(budgets, { fecha, sec, rowId, subId, monto }) {
  if (!CARTERAS.includes(sec)) return { ok: false, motivo: "Elige una cartera o un fondo personal." };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, motivo: "El monto debe ser mayor a 0." };
  const periodo = periodoDeFecha(fecha);
  const est = estadoBolsillo(budgets, periodo, sec, rowId, subId ?? null);
  if (!est) return { ok: false, motivo: "Primero inicia los sobres en Presupuesto (botón 🧾)." };
  if (monto > est.saldo) return { ok: false, motivo: "No alcanza: el saldo disponible es menor al gasto.", saldo: est.saldo, falta: monto - est.saldo };
  return { ok: true, periodo, saldo: est.saldo };
}

// Lo máximo que una cartera puede prestar hoy (30% de su saldo).
export function capacidadPrestamo(budgets, periodo, sec, row) {
  const e = estadoFila(budgets, periodo, sec, row);
  return e ? Math.max(0, Math.floor(e.saldo * TOPE_PRESTAMO)) : 0;
}

// Bolsillos de OTRAS carteras de los que se puede pedir, con lo máximo que cada uno puede aportar
// (el tope del 30% se reparte entre los bolsillos de la misma cartera, del más abultado al menor).
export function candidatosPrestamo(budgets, periodo, destino) {
  const b = resolverPeriodo(budgets, periodo);
  const lista = [];
  for (const sec of CARTERAS) {
    for (const row of (b[sec] || [])) {
      if (sec === destino.sec && row.id === destino.rowId) continue;
      const e = estadoFila(budgets, periodo, sec, row);
      if (!e) continue;
      let cupo = Math.max(0, Math.floor(e.saldo * TOPE_PRESTAMO));
      e.items.filter(i => i.estado.saldo > 0).sort((x, y) => y.estado.saldo - x.estado.saldo).forEach(i => {
        const disp = Math.min(cupo, i.estado.saldo);
        if (disp > 0) { lista.push({ sec, rowId: row.id, subId: i.subId, cartera: row.label, emoji: row.emoji || "", label: i.label, libre: i.libre, disp }); cupo -= disp; }
      });
    }
  }
  return lista;
}

// Propone de dónde pedir `falta`: primero los que más pueden aportar. {fuentes, cubierto}
export function sugerirFuentes(budgets, periodo, destino, falta) {
  const fuentes = [];
  let resto = falta;
  candidatosPrestamo(budgets, periodo, destino).sort((x, y) => y.disp - x.disp).forEach(c => {
    if (resto <= 0) return;
    const monto = Math.min(resto, c.disp);
    fuentes.push({ sec: c.sec, rowId: c.rowId, subId: c.subId, monto });
    resto -= monto;
  });
  return { fuentes, cubierto: falta - resto };
}

function validarFuentes(budgets, periodo, destino, falta, fuentes) {
  if (!Array.isArray(fuentes) || !fuentes.length) return "Elige de dónde pedir lo que falta.";
  if (fuentes.some(f => !Number.isFinite(f.monto) || f.monto <= 0)) return "Cada aporte debe ser mayor a 0.";
  if (fuentes.reduce((s, f) => s + f.monto, 0) !== falta) return "Los aportes deben sumar exactamente lo que falta.";
  const b = resolverPeriodo(budgets, periodo);
  const porCartera = new Map();
  for (const f of fuentes) {
    if (!CARTERAS.includes(f.sec)) return "Fuente inválida.";
    if (f.sec === destino.sec && f.rowId === destino.rowId) return "No se puede pedir a la misma cartera.";
    const est = estadoBolsillo(budgets, periodo, f.sec, f.rowId, f.subId ?? null);
    if (!est) return "Los sobres no estaban activos en ese período.";
    if (f.monto > est.saldo) return "Una de las fuentes no tiene saldo suficiente.";
    const ck = f.sec + "|" + f.rowId;
    porCartera.set(ck, (porCartera.get(ck) || 0) + f.monto);
  }
  for (const [ck, total] of porCartera) {
    const [sec, rowId] = ck.split("|");
    const row = (b[sec] || []).find(r => r.id === rowId);
    if (!row || total > capacidadPrestamo(budgets, periodo, sec, row)) return "Una cartera no puede prestar tanto: el tope es 30% de su saldo.";
  }
  return null;
}

// Devuelve {periodo, budget} con el gasto agregado (y el préstamo, si el gasto supera el saldo), o {error}.
// No modifica budgets. `fuentes` solo se usa cuando falta saldo.
export function agregarGasto(budgets, { fecha, sec, rowId, subId, monto, nota, fuentes, categoria, compraId }) {
  const puede = puedeGenerarPeriodo(budgets, periodoDeFecha(fecha));
  if (!puede.ok) return { error: puede.motivo };
  const m = Math.round(monto);
  const v = validarGasto(budgets, { fecha, sec, rowId, subId, monto: m });
  const base0 = resolverPeriodo(budgets, periodoDeFecha(fecha));
  const gasto = { id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, fecha: fechaISO(fechaDe(fecha)), sec, rowId, subId: subId ?? null, monto: m, nota: (nota || "").trim() };
  if (categoria && String(categoria).trim()) gasto.categoria = String(categoria).trim();
  if (compraId) gasto.compraId = compraId;
  if (v.ok) return { periodo: v.periodo, budget: { ...base0, gastos: [...(base0.gastos || []), gasto] }, gastoId: gasto.id };
  if (!v.falta) return { error: v.motivo, saldo: v.saldo };
  const periodo = periodoDeFecha(fecha);
  const destino = { sec, rowId, subId: subId ?? null };
  const lista = (fuentes || []).map(f => ({ sec: f.sec, rowId: f.rowId, subId: f.subId ?? null, monto: Math.round(f.monto) }));
  const err = validarFuentes(budgets, periodo, destino, v.falta, lista);
  if (err) return { error: err, saldo: v.saldo, falta: v.falta };
  const prestamo = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, fecha: gasto.fecha, destino, monto: v.falta, fuentes: lista };
  gasto.prestamoId = prestamo.id;
  return { periodo, budget: { ...base0, gastos: [...(base0.gastos || []), gasto], prestamos: [...(base0.prestamos || []), prestamo] }, gastoId: gasto.id };
}

// Quita el gasto y, si pidió fondos, también su préstamo.
export function quitarGasto(budget, gastoId) {
  const g = (budget.gastos || []).find(x => x.id === gastoId);
  const sig = { ...budget, gastos: (budget.gastos || []).filter(x => x.id !== gastoId) };
  if (g && g.prestamoId) sig.prestamos = (budget.prestamos || []).filter(p => p.id !== g.prestamoId);
  return sig;
}

// Un gasto con préstamo no se borra si el préstamo ya empezó a devolverse.
export function puedeQuitarGasto(budgets, gasto) {
  if (!gasto || !gasto.prestamoId) return { ok: true };
  const claves = Object.keys(budgets || {}).filter(claveMesValida).sort();
  const hasta = claves.length ? claves[claves.length - 1] : "0000-00";
  const sim = simular(budgets, hasta > periodoDeFecha(new Date()) ? hasta : periodoDeFecha(new Date()));
  const p = sim.prestamos.find(x => x.id === gasto.prestamoId);
  if (p && p.pendiente !== p.total) return { ok: false, motivo: "Su préstamo ya empezó a devolverse: no se puede borrar este gasto." };
  return { ok: true };
}

// ── Arqueo mensual, rendición y metas (fase 3) ──────────────────────────────
const SECCIONES_CARTERA = ["personales", "propositos"]; // orden en que se ven en pantalla

// Primer período desde que se iniciaron los sobres que todavía no tiene arqueo, si es anterior a `antesDe`.
export function primerArqueoPendiente(budgets, antesDe) {
  const inicio = inicioSobres(budgets);
  if (!inicio) return null;
  let k = inicio;
  for (let i = 0; k < antesDe && i < 600; i++, k = claveSiguiente(k)) {
    const b = resolverPeriodo(budgets, k);
    if (!(b.arqueo && Array.isArray(b.arqueo.filas))) return k;
  }
  return null;
}

// Un período que todavía no existe solo se puede generar si los anteriores ya tienen su arqueo.
export function puedeGenerarPeriodo(budgets, periodo) {
  if (budgets && budgets[periodo]) return { ok: true };
  const inicio = inicioSobres(budgets);
  if (!inicio || periodo <= inicio) return { ok: true };
  const pendiente = primerArqueoPendiente(budgets, periodo);
  if (!pendiente) return { ok: true };
  return { ok: false, requiere: pendiente, motivo: "Antes de generar este período haz el arqueo del período anterior." };
}

// Qué debería haber en cada sobre al cierre del período, según los registros. null si los sobres no están activos.
export function filasArqueo(budgets, periodo) {
  const b = resolverPeriodo(budgets, periodo);
  const filas = [];
  for (const sec of SECCIONES_CARTERA) {
    for (const row of (b[sec] || [])) {
      const e = estadoFila(budgets, periodo, sec, row);
      if (!e) return null;
      filas.push({ sec, rowId: row.id, label: row.label, emoji: row.emoji || "", esperado: e.saldo });
    }
  }
  return filas;
}

// `conteos`: {"sec|rowId": efectivo contado}; `notas`: {"sec|rowId": texto}. Devuelve {periodo, budget} o {error}.
// Una diferencia no bloquea: se documenta en el período. Se puede repetir mientras no se use el siguiente.
export function guardarArqueo(budgets, periodo, { fecha, conteos, notas }) {
  const filas = filasArqueo(budgets, periodo);
  if (!filas) return { error: "Primero inicia los sobres en Presupuesto (botón 🧾)." };
  const puede = puedeGenerarPeriodo(budgets, periodo);
  if (!puede.ok) return { error: "Primero haz el arqueo de un período anterior." };
  const faltan = [];
  const datos = filas.map(f => {
    const k = f.sec + "|" + f.rowId;
    const c = conteos && conteos[k];
    if (!Number.isFinite(c) || c < 0) { faltan.push(f.label); return null; }
    return { ...f, contado: Math.round(c), diferencia: Math.round(c) - f.esperado, nota: ((notas && notas[k]) || "").trim() };
  });
  if (faltan.length) return { error: "Falta contar: " + faltan.join(", ") + "." };
  const base = resolverPeriodo(budgets, periodo);
  return { periodo, budget: { ...base, arqueo: { fecha: fechaISO(fechaDe(fecha || new Date())), filas: datos } } };
}

// Informe del período: por cartera, lo asignado, gastado, prestado, el saldo y el resultado del arqueo.
export function rendicion(budgets, periodo) {
  const b = resolverPeriodo(budgets, periodo);
  const filas = [];
  for (const sec of SECCIONES_CARTERA) {
    for (const row of (b[sec] || [])) {
      const e = estadoFila(budgets, periodo, sec, row);
      if (!e) return null;
      const arq = b.arqueo && Array.isArray(b.arqueo.filas) ? b.arqueo.filas.find(x => x.sec === sec && x.rowId === row.id) : null;
      const gastos = gastosDe(b, sec, row.id).slice().sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0))
        .map(g => ({ ...g, sub: g.subId == null ? (row.subs && row.subs.length ? "Sin repartir" : row.label) : ((row.subs || []).find(x => x.id === g.subId) || { label: "(sub-partida eliminada)" }).label }));
      filas.push({ sec, row, ...e, gastos, arqueo: arq, deudas: resumenDeudas(budgets, periodo, sec, row.id) });
    }
  }
  const suma = c => filas.reduce((s, f) => s + f[c], 0);
  return {
    filas, arqueoFecha: b.arqueo ? b.arqueo.fecha : null,
    totales: { asignado: suma("asignado"), gastado: suma("gastado"), saldo: suma("saldo"), prestamoDado: suma("prestamoDado"), prestamoRecibido: suma("prestamoRecibido"),
      diferencia: b.arqueo ? filas.reduce((s, f) => s + (f.arqueo ? f.arqueo.diferencia : 0), 0) : null },
  };
}

// Meta con fecha de una sub-partida. `saldo` es lo ahorrado al cierre del período; `aporteMensual` lo que se le asigna cada mes.
// Los aportes futuros son los de los períodos siguientes cuyo inicio (día 25) cae hasta la fecha de la meta.
export function progresoMeta({ saldo, objetivo, fecha, periodo, aporteMensual }) {
  const falta = Math.max(0, (objetivo || 0) - (saldo || 0));
  if (falta === 0) return { cumplida: true, falta: 0, meses: 0, necesario: 0, alDia: true, cumpleEn: null };
  const limite = fechaDe(fecha);
  const inicioDe = k => { const [a, m] = partes(k); return new Date(a, m, 25); };
  let meses = 0;
  for (let k = claveSiguiente(periodo), i = 0; i < 600 && inicioDe(k) <= limite; i++, k = claveSiguiente(k)) meses++;
  const necesario = meses > 0 ? Math.ceil(falta / meses) : falta;
  let cumpleEn = null;
  if (aporteMensual > 0) {
    cumpleEn = periodo;
    for (let i = 0, n = Math.ceil(falta / aporteMensual); i < n; i++) cumpleEn = claveSiguiente(cumpleEn);
  }
  const alDia = cumpleEn !== null && inicioDe(cumpleEn) <= limite;
  return { cumplida: false, falta, meses, necesario, alDia, cumpleEn };
}

// ── Proyección anual y ritmo del sobre (fase 4) ─────────────────────────────
// Proyección de los próximos 12 períodos desde `periodo` (incluido), fila por fila. `actual` es el
// presupuesto que se está viendo. Cada mes cuenta con lo que realmente se asignó; un mes dentro del
// registro sin presupuesto cuenta como cero; los meses futuros (después del último guardado) usan el
// promedio de los últimos 12 meses en registro, con los ceros incluidos y dividiendo por el total
// de meses de esa ventana (o por los que lleve el registro). Sin registro alguno: monto × 12.
// Devuelve {filas:{sec:{rowId:anual}}, mesesPromedio}.
export function proyeccionAnual(budgets, periodo, actual) {
  const claves = Object.keys(budgets || {}).filter(claveMesValida).sort();
  const ultima = claves.length ? claves[claves.length - 1] : null;
  const primera = claves.length ? claves[0] : null;
  const montoEn = (k, sec, rowId) => {
    const b = k === periodo ? actual : (budgets || {})[k];
    const r = b && (b[sec] || []).find(x => x.id === rowId);
    return r ? (r.monto || 0) : 0;
  };
  const ventana = [];
  if (ultima) for (let k = ultima, i = 0; i < 12 && k >= primera; i++, k = claveAnterior(k)) ventana.unshift(k);
  const filas = {};
  for (const sec of SECCIONES) {
    filas[sec] = {};
    for (const row of (actual[sec] || [])) {
      const prom = ventana.length ? Math.round(ventana.reduce((t, k) => t + montoEn(k, sec, row.id), 0) / ventana.length) : (row.monto || 0);
      let total = 0, k = periodo;
      for (let i = 0; i < 12; i++, k = claveSiguiente(k)) {
        if (i === 0) total += row.monto || 0;
        else if (budgets && budgets[k]) total += montoEn(k, sec, row.id);
        else total += ultima && k <= ultima ? 0 : prom;
      }
      filas[sec][row.id] = total;
    }
  }
  return { filas, mesesPromedio: ventana.length };
}

// Ritmo del sobre: lo gastado frente a lo disponible en el período, contra el avance del período (25 → 24).
// estado: "bien" (gasta al ritmo del calendario o menos), "atento" (hasta 15 puntos por delante) o "adelantado".
export function ritmoSobre({ gastado, disponible, periodo, hoy }) {
  if (!(disponible > 0)) return null;
  const [a, m] = partes(periodo);
  const inicio = new Date(a, m, 25), fin = new Date(a, m + 1, 25);
  const ahora = hoy instanceof Date ? hoy : new Date();
  const pctPeriodo = Math.max(0, Math.min(1, (ahora - inicio) / (fin - inicio)));
  const pctGastado = Math.max(0, gastado) / disponible;
  const estado = pctGastado <= pctPeriodo ? "bien" : pctGastado <= pctPeriodo + 0.15 ? "atento" : "adelantado";
  return { pctGastado, pctPeriodo, estado };
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
  const sim = simular(budgets, periodo);
  const toca = (r, id) => r.sec === sec && r.rowId === row.id && (subId === undefined || (id ?? null) === (subId ?? null));
  if (sim.prestamos.some(p => (p.pendiente > 0 && toca({ sec: p.destino.sec, rowId: p.destino.rowId }, p.destino.subId)) || p.fuentes.some(f => f.pend > 0 && toca(f, f.subId)))) {
    return { ok: false, motivo: "Tiene un préstamo pendiente (debe o le deben)." };
  }
  return { ok: true };
}

// Reparto: ninguna sub-partida puede dejar el total repartido sobre el monto de la cartera.
export function maxSubMonto(row, subId) {
  const otras = (row.subs || []).filter(s => s.id !== subId).reduce((s, x) => s + (x.monto || 0), 0);
  return Math.max(0, (row.monto || 0) - otras);
}

// ── Categorías de gasto y compras de Alimentación ───────────────────────────
export const ID_ALIMENTACION = "ali";
export const CATEGORIAS_ALIMENTACION = ["Verduras y frutas", "Carnes y pescado", "Lácteos y huevos", "Despensa", "Panadería", "Bebidas", "Snacks y dulces", "Otros"];
export const SIN_CATEGORIA = "Sin categoría";

// Lista de categorías de una cartera: la propia si existe; Alimentación parte con las suyas; el resto parte vacía.
export function categoriasDe(row) {
  if (row && Array.isArray(row.categorias)) return row.categorias;
  if (row && row.id === ID_ALIMENTACION) return CATEGORIAS_ALIMENTACION.slice();
  return [];
}

// Agrega una categoría a la cartera (sin duplicar, sin distinguir mayúsculas). Devuelve el presupuesto nuevo.
export function agregarCategoria(budget, sec, rowId, label) {
  const l = String(label || "").trim();
  if (!l) return budget;
  return { ...budget, [sec]: (budget[sec] || []).map(r => {
    if (r.id !== rowId) return r;
    const lista = categoriasDe(r);
    if (lista.some(x => x.toLowerCase() === l.toLowerCase())) return r;
    return { ...r, categorias: [...lista, l] };
  }) };
}

// Gasto del período por categoría: [{categoria, monto, n}] de mayor a menor, y el total.
export function gastoPorCategoria(budget, sec, rowId) {
  const mapa = {};
  gastosDe(budget, sec, rowId).forEach(g => {
    const c = g.categoria || SIN_CATEGORIA;
    mapa[c] = mapa[c] || { categoria: c, monto: 0, n: 0 };
    mapa[c].monto += g.monto || 0; mapa[c].n += 1;
  });
  const lista = Object.values(mapa).sort((a, b) => b.monto - a.monto);
  return { lista, total: lista.reduce((s, x) => s + x.monto, 0) };
}

// Cartera que paga las compras: la fila «ali» en fondos por propósito o personales. null si Alimentación aún es gasto base.
export function carteraCompras(budgets, fecha) {
  const periodo = periodoDeFecha(fecha);
  const b = resolverPeriodo(budgets, periodo);
  for (const sec of CARTERAS) {
    const row = (b[sec] || []).find(r => r.id === ID_ALIMENTACION);
    if (row) return { sec, row, periodo };
  }
  return null;
}

export function montoCompra(item) {
  const cant = Number(item && item.cantidad) > 0 ? Number(item.cantidad) : 1;
  const precio = Number(item && item.precio) > 0 ? Number(item.precio) : 0;
  return Math.round(cant * precio);
}

// Compra → gasto de Alimentación. {periodo, budget, gastoId} o {error}. No modifica budgets.
export function registrarCompra(budgets, { fecha, item, subId }) {
  const dest = carteraCompras(budgets, fecha);
  if (!dest) return { error: "Alimentación todavía no es una cartera: pásala a cartera en Presupuesto (Gastos Base)." };
  const monto = montoCompra(item);
  if (monto <= 0) return { error: "Falta el precio del ítem." };
  const cant = Number(item.cantidad) > 0 ? Number(item.cantidad) : 1;
  const r = agregarGasto(budgets, { fecha, sec: dest.sec, rowId: dest.row.id, subId: subId ?? null, monto, nota: `${cant !== 1 ? cant + "× " : ""}${item.text}`, categoria: item.categoria, compraId: item.id });
  if (r.error) return { error: r.error, saldo: r.saldo };
  return r;
}

// Deshace el gasto de una compra (al desmarcarla). {budget} del período, o {error}.
export function deshacerCompra(budgets, periodo, gastoId) {
  const b = budgets && budgets[periodo];
  const g = b && (b.gastos || []).find(x => x.id === gastoId);
  if (!g) return { budget: null };                       // el gasto ya no existe: nada que deshacer
  const p = puedeQuitarGasto(budgets, g);
  if (!p.ok) return { error: p.motivo };
  return { budget: quitarGasto(b, gastoId) };
}
