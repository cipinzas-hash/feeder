// Diario de seguimiento (módulo Fadiman). Lógica pura, sin React ni DOM.
//
// Forma de los datos — vive DENTRO de fadimanData (que ya viaja entero en el
// export/import general), en una clave propia que "reiniciar protocolo" no toca:
//   fadimanData.fadimanDiario = {
//     cfg:  { mg: 10 },                 // dosis por defecto al marcar toma
//     base: { ...escalas } | null,      // línea base retrospectiva (una sola)
//     dias: { "YYYY-MM-DD": entrada }   // una entrada por día
//   }
// Entrada (todo opcional): tomo, hora, mg, comida, protocolo, suenoHora,
// suenoHoras, suenoCal, efIni, efFin, foco, inicio, animo, irrit, ansiedad,
// apetito, rebote(0-3), efectos[], efectoOtro, pulso, presion, peso, evento, nota.

export const ESCALAS = [
  { k: "foco",     label: "Foco" },
  { k: "inicio",   label: "Inicio de tareas" },
  { k: "animo",    label: "Ánimo" },
  { k: "irrit",    label: "Irritabilidad" },
  { k: "ansiedad", label: "Ansiedad" },
  { k: "apetito",  label: "Apetito" },
];
// La calidad de sueño se promedia como escala más (clave suenoCal).
export const ESCALAS_RESUMEN = [...ESCALAS, { k: "suenoCal", label: "Calidad de sueño" }];

export const EFECTOS = [
  { k: "cefalea",      label: "Cefalea" },
  { k: "bocaSeca",     label: "Boca seca" },
  { k: "palpitaciones",label: "Palpitaciones" },
  { k: "dolorPecho",   label: "Dolor de pecho" },
  { k: "nausea",       label: "Náusea" },
  { k: "mandibula",    label: "Mandíbula apretada" },
  { k: "tics",         label: "Tics" },
  { k: "sudor",        label: "Sudoración" },
  { k: "insomnio",     label: "Insomnio de inicio" },
];
export const EFECTOS_ALERTA = ["palpitaciones", "dolorPecho"];
export const REBOTE = ["ninguno", "leve", "moderado", "fuerte"];

export const DIARIO_VACIO = { cfg: { mg: 10 }, base: null, dias: {} };

const pad = (n) => String(n).padStart(2, "0");

// Fecha LOCAL (no UTC): el cierre del día se registra de noche y en Chile
// toISOString() ya marca el día siguiente pasadas ~20-21 h.
export function claveLocal(fecha = new Date()) {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}
export function horaLocal(fecha = new Date()) {
  return `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}
export function sumarDias(clave, n) {
  const d = new Date(clave + "T12:00:00");
  d.setDate(d.getDate() + n);
  return claveLocal(d);
}
export function rangoDias(hasta, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(sumarDias(hasta, -i));
  return out;
}

export function leerDiario(fadimanData) {
  const d = fadimanData && fadimanData.fadimanDiario;
  return {
    cfg: { mg: 10, ...((d && d.cfg) || {}) },
    base: (d && d.base) || null,
    dias: (d && d.dias) || {},
  };
}

// Devuelve el nuevo objeto fadimanDiario con un campo cambiado en un día.
// "protocolo" (hubo dosis Fadiman ese día) se sella al crear la entrada.
export function conCampo(diario, clave, campo, valor, protocolo) {
  const previo = diario.dias[clave];
  const entrada = { ...(previo || {}), [campo]: valor };
  if (!previo && protocolo != null) entrada.protocolo = !!protocolo;
  return { ...diario, dias: { ...diario.dias, [clave]: entrada } };
}
export function conBase(diario, campo, valor) {
  return { ...diario, base: { ...(diario.base || {}), [campo]: valor } };
}

export function alternarEfecto(entrada, clave) {
  const actual = (entrada && entrada.efectos) || [];
  return actual.includes(clave) ? actual.filter((x) => x !== clave) : [...actual, clave];
}
export function hayAlerta(entrada) {
  return ((entrada && entrada.efectos) || []).some((e) => EFECTOS_ALERTA.includes(e));
}

const aMin = (hhmm) => {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const deMin = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min % 60))}`;
const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const num = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);

// Serie para el gráfico: un punto por día (v=null si no hay dato).
export function serie(diario, escala, hasta, n) {
  return rangoDias(hasta, n).map((d) => {
    const e = diario.dias[d];
    return { d, v: e ? num(e[escala]) : null, evento: !!(e && e.evento), tomo: !!(e && e.tomo) };
  });
}

// Resumen sobre los últimos n días terminando en `hasta`.
export function resumen(diario, hasta, n) {
  const dias = rangoDias(hasta, n);
  const claves = Object.keys(diario.dias).sort();
  const primero = claves[0] || null;
  // No cuenta como "sin toma" lo anterior al primer registro del diario.
  const enRango = dias.filter((d) => primero && d >= primero);
  const entradas = enRango.map((d) => [d, diario.dias[d]]).filter(([, e]) => e);
  const tomas = enRango.filter((d) => diario.dias[d] && diario.dias[d].tomo).length;

  const promedios = {};
  for (const { k } of ESCALAS_RESUMEN) {
    const xs = entradas.map(([, e]) => num(e[k])).filter((v) => v != null);
    promedios[k] = { avg: prom(xs), n: xs.length, base: diario.base ? num(diario.base[k]) : null };
  }
  const efectos = {};
  for (const { k } of EFECTOS) {
    efectos[k] = entradas.filter(([, e]) => (e.efectos || []).includes(k)).length;
  }
  const otros = entradas.filter(([, e]) => (e.efectoOtro || "").trim()).map(([d, e]) => ({ d, t: e.efectoOtro.trim() }));
  const horas = entradas.map(([, e]) => num(e.suenoHoras)).filter((v) => v != null);
  const rebotes = entradas.map(([, e]) => (typeof e.rebote === "number" ? e.rebote : null)).filter((v) => v != null);
  const ini = entradas.map(([, e]) => aMin(e.efIni)).filter((v) => v != null);
  const fin = entradas.map(([, e]) => aMin(e.efFin)).filter((v) => v != null);
  const eventos = entradas.filter(([, e]) => (e.evento || "").trim()).map(([d, e]) => ({ d, t: e.evento.trim() }));
  const pulso = entradas.map(([, e]) => num(e.pulso)).filter((v) => v != null);

  return {
    hasta, n,
    desde: dias[0],
    diasEnRango: enRango.length,
    conRegistro: entradas.length,
    tomas,
    sinToma: enRango.length - tomas,
    protocolo: entradas.filter(([, e]) => e.protocolo).length,
    promedios, efectos, otros, eventos,
    suenoHoras: prom(horas),
    rebote: prom(rebotes),
    efectoInicio: ini.length ? deMin(prom(ini)) : null,
    efectoFin: fin.length ? deMin(prom(fin)) : null,
    pulso: prom(pulso),
    alerta: entradas.filter(([, e]) => hayAlerta(e)).map(([d]) => d),
  };
}

// Días con toma vs. días registrados sin toma. cruzFor(clave) → {estres,
// tareasHechas, tareasTotal, ejercicio} | null (datos que Angst ya tiene).
export function compararToma(diario, hasta, n, cruzFor) {
  const grupos = { con: [], sin: [] };
  for (const d of rangoDias(hasta, n)) {
    const e = diario.dias[d];
    if (!e) continue;
    (e.tomo ? grupos.con : grupos.sin).push(d);
  }
  const resumenGrupo = (ds) => {
    const foco = ds.map((d) => num(diario.dias[d].foco)).filter((v) => v != null);
    const cr = ds.map((d) => (cruzFor ? cruzFor(d) : null)).filter(Boolean);
    const tareas = cr.filter((c) => c.tareasTotal > 0).map((c) => c.tareasHechas / c.tareasTotal);
    const estres = cr.map((c) => c.estres).filter((v) => typeof v === "number");
    const ejer = cr.filter((c) => c.ejercicio != null);
    return {
      n: ds.length,
      foco: prom(foco),
      tareasPct: tareas.length ? prom(tareas) * 100 : null,
      estres: prom(estres),
      ejercicioPct: ejer.length ? (ejer.filter((c) => c.ejercicio).length / ejer.length) * 100 : null,
    };
  };
  return { con: resumenGrupo(grupos.con), sin: resumenGrupo(grupos.sin) };
}

const f1 = (v) => (v == null ? "—" : v.toFixed(1));
const fecha = (k) => { const [y, m, d] = k.split("-"); return `${d}-${m}-${y}`; };

// Resumen en texto plano, una página, para llevar a la consulta.
export function textoResumen(diario, hasta, n, cruzFor) {
  const r = resumen(diario, hasta, n);
  const cmp = compararToma(diario, hasta, n, cruzFor);
  const L = [];
  L.push(`SEGUIMIENTO — ${fecha(r.desde)} a ${fecha(r.hasta)} (${n} días)`);
  L.push(`Días con registro: ${r.conRegistro} de ${r.diasEnRango}. Con toma: ${r.tomas}. Sin toma: ${r.sinToma}.`);
  if (r.protocolo) L.push(`Días con protocolo Fadiman activo ese día: ${r.protocolo} (puede confundir el efecto).`);
  L.push("");
  L.push("Escalas 1–5 (promedio · n · línea base previa):");
  for (const { k, label } of ESCALAS_RESUMEN) {
    const p = r.promedios[k];
    if (p.n) L.push(`- ${label}: ${f1(p.avg)} · n=${p.n}${p.base != null ? ` · base ${p.base}` : ""}`);
  }
  if (r.suenoHoras != null) L.push(`- Horas de sueño: ${f1(r.suenoHoras)} h`);
  if (r.rebote != null) L.push(`- Rebote vespertino (0–3): ${f1(r.rebote)}`);
  if (r.efectoInicio || r.efectoFin) L.push(`- Efecto percibido: inicio ~${r.efectoInicio || "—"}, fin ~${r.efectoFin || "—"}`);
  if (r.pulso != null) L.push(`- Pulso en reposo (promedio): ${Math.round(r.pulso)}`);
  const ef = EFECTOS.filter(({ k }) => r.efectos[k]).map(({ k, label }) => `${label} ${r.efectos[k]}/${r.conRegistro} días`);
  L.push("");
  L.push(`Efectos adversos: ${ef.length ? ef.join("; ") : "ninguno registrado"}`);
  if (r.otros.length) L.push(`Otros: ${r.otros.map((o) => `${fecha(o.d)} ${o.t}`).join("; ")}`);
  if (r.alerta.length) L.push(`Días con palpitaciones o dolor de pecho: ${r.alerta.map(fecha).join(", ")}`);
  if (r.eventos.length) {
    L.push("");
    L.push("Cambios/eventos:");
    for (const e of r.eventos) L.push(`- ${fecha(e.d)}: ${e.t}`);
  }
  if (cmp.con.n && cmp.sin.n) {
    L.push("");
    L.push(`Con toma (n=${cmp.con.n}) vs. sin toma (n=${cmp.sin.n}) — muestra chica, solo orientativo:`);
    L.push(`- Foco: ${f1(cmp.con.foco)} vs ${f1(cmp.sin.foco)}`);
    if (cmp.con.tareasPct != null || cmp.sin.tareasPct != null)
      L.push(`- Tareas del planner completadas: ${cmp.con.tareasPct == null ? "—" : Math.round(cmp.con.tareasPct) + "%"} vs ${cmp.sin.tareasPct == null ? "—" : Math.round(cmp.sin.tareasPct) + "%"}`);
    if (cmp.con.estres != null || cmp.sin.estres != null)
      L.push(`- Estrés (índice Angst): ${f1(cmp.con.estres)} vs ${f1(cmp.sin.estres)}`);
  }
  return L.join("\n");
}
