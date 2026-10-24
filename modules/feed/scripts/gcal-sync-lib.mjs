// Lógica PURA del sync planner (semana) → calendario Familia de Google (issue #26, docs/gcal-sync.md).
// Sin red ni disco: build-gcal-sync.mjs hace el I/O. Todo lo de acá se prueba en tests/gcal-sync.mjs.
//
// Reglas de qué pasa y qué no (decididas por Cristopher, 21-22 oct 2026):
//   pasan   → tareas (con hora si tienen `deadline`), recurrentes (por ocurrencia), calmarks de la lista MARCAS,
//             y un marcador "Mañana: …" el día anterior para tareas/recurrentes con baliza (`urgent`), `healthEventId`
//             y para los calmarks doctor/medico.
//   NO pasan → `schedule[]` (horario personal), calmarks romantic/melee/pokemon, tareas "preparar:" (prepReminder),
//             tareas/recurrentes 🔒 `privada`, tareas hechas, marcadores de pospuesta.
// Los calmarks son ALLOWLIST: un tipo nuevo no se filtra a los hijos hasta que se agregue acá a propósito.

export const MARCAS = {
  social: "Social", work: "Trabajo", colegio: "Colegio", doctor: "Doctor",
  medico: "Médico", gym: "Gimnasio", compras: "Compras",
};
const MARCAS_MEDICAS = new Set(["doctor", "medico"]);
export const DURACION_MIN = 30; // `deadline` es una hora límite, no un rango: el evento dura esto
export const MAX_TEXTO = 200;

const pad = n => String(n).padStart(2, "0");

export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function todayIn(tz, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function dayRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Copia EXACTA de nextRecurDate (core/App.jsx). tests/gcal-sync.mjs la compara contra la original para detectar deriva.
export function recurrenceOccursOn(createdAt, freq, fromDate) {
  function dateToDayNumber(s) {
    const [y, m, d] = s.split("-").map(Number);
    const a = Math.floor((14 - m) / 12), yr = y + 4800 - a, mo = m + 12 * a - 3;
    return d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
  }
  const originDay = dateToDayNumber(createdAt);
  const checkDay = dateToDayNumber(fromDate);
  const diff = checkDay - originDay;
  if (diff < 0) return false;
  if (freq === "daily") return true;
  if (freq === "every3") return diff % 2 === 0; // en la UI se llama "c/2d": cada 2 días, el nombre es legado
  if (freq === "every5") return diff % 5 === 0;
  if (freq === "weekly") return diff % 7 === 0;
  if (freq === "biweekly") return diff % 14 === 0;
  if (freq === "monthly") {
    const [oy, om, od] = createdAt.split("-").map(Number);
    const [cy, cm, cd] = fromDate.split("-").map(Number);
    return cd === od && (cy * 12 + cm) > (oy * 12 + om - 1);
  }
  if (freq === "yearly") {
    const [oy, om, od] = createdAt.split("-").map(Number);
    const [cy, cm, cd] = fromDate.split("-").map(Number);
    return cd === od && cm === om && cy >= oy;
  }
  return false;
}

function limpiar(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
}

function esPreparar(t) {
  return !!t.prepReminder || /^\s*preparar\s*:/i.test(t.text || "");
}

function sumarMinutos(fecha, h, m, mins) {
  const total = h * 60 + m + mins;
  const dias = Math.floor(total / 1440), resto = ((total % 1440) + 1440) % 1440;
  return { fecha: addDays(fecha, dias), h: Math.floor(resto / 60), m: resto % 60 };
}

// Eventos deseados (neutros) para el rango [from, to] (YYYY-MM-DD, inclusive).
export function buildDesired(state, { from, to }) {
  const dayData = state?.dayData || {};
  const calMarks = state?.calMarks || {};
  const recurring = Array.isArray(state?.recurring) ? state.recurring : [];
  const out = [];
  const push = ev => out.push(ev);
  const marcador = (claveBase, texto, fecha) => {
    const dia = addDays(fecha, -1);
    if (dia < from || dia > to) return;
    push({ key: `${claveBase}>m`, kind: "marcador", summary: `Mañana: ${texto}`, allDay: true, date: dia });
  };

  for (const D of dayRange(from, to)) {
    const day = dayData[D] || {};
    const tasks = Array.isArray(day.tasks) ? day.tasks : [];

    for (const t of tasks) {
      if (!t || t.postponed || t.done || t.privada || t.recurringId || esPreparar(t)) continue;
      const texto = limpiar(t.text);
      if (!texto) continue;
      const key = `t:${D}:${t.id}`;
      const dl = t.deadline && Number.isInteger(t.deadline.h) && Number.isInteger(t.deadline.m) ? t.deadline : null;
      push(dl
        ? { key, kind: "tarea", summary: texto, allDay: false, date: D, h: dl.h, m: dl.m }
        : { key, kind: "tarea", summary: texto, allDay: true, date: D });
      if (t.urgent || t.healthEventId) marcador(key, texto, D);
    }

    const marks = [...new Set(Array.isArray(calMarks[D]) ? calMarks[D] : [])];
    for (const k of marks) {
      if (!MARCAS[k]) continue;
      push({ key: `c:${D}:${k}`, kind: "calmark", summary: MARCAS[k], allDay: true, date: D });
      // "todo lo médico tiene evento previo": el calmark doctor/medico avisa el día anterior, sin heurística de texto
      // (las citas se anotan como tareas sueltas y "cita" también significa otra cosa).
      if (MARCAS_MEDICAS.has(k)) marcador(`c:${D}:${k}`, MARCAS[k], D);
    }

    for (const r of recurring) {
      if (!r || r.privada || !r.createdAt || !recurrenceOccursOn(r.createdAt, r.freq, D)) continue;
      if (tasks.some(t => t && t.recurringId === r.id && t.postponed)) continue;
      const texto = limpiar(r.text);
      if (!texto) continue;
      const key = `r:${r.id}:${D}`;
      push({ key, kind: "recurrente", summary: texto, allDay: true, date: D });
      if (r.urgent) marcador(key, texto, D);
    }
  }

  const vistos = new Set();
  return out.filter(e => (vistos.has(e.key) ? false : (vistos.add(e.key), true)));
}

export const DESCRIPCION = "Viene de Angst. No lo edites aquí: los cambios se revierten.";

// Evento neutro → recurso de Google Calendar.
export function toBody(ev, tz) {
  const base = {
    summary: ev.summary,
    description: DESCRIPCION,
    extendedProperties: { private: { angst: "1", angstKey: ev.key } },
  };
  if (ev.allDay) {
    return { ...base, start: { date: ev.date }, end: { date: addDays(ev.date, 1) } };
  }
  const fin = sumarMinutos(ev.date, ev.h, ev.m, DURACION_MIN);
  return {
    ...base,
    start: { dateTime: `${ev.date}T${pad(ev.h)}:${pad(ev.m)}:00`, timeZone: tz },
    end: { dateTime: `${fin.fecha}T${pad(fin.h)}:${pad(fin.m)}:00`, timeZone: tz },
  };
}

// Firma comparable entre lo deseado y lo que devuelve Google (la lista se pide con timeZone=<tz>, así los
// dateTime vienen en hora de pared de ese huso y alcanza con los primeros 16 caracteres).
export function sigOf(res) {
  const t = p => (p?.date ? `D${p.date}` : p?.dateTime ? `T${p.dateTime.slice(0, 16)}` : "");
  return `${res.summary || ""}|${t(res.start)}|${t(res.end)}`;
}

export const esDeAngst = ev => ev?.extendedProperties?.private?.angst === "1";
export const claveDe = ev => ev?.extendedProperties?.private?.angstKey || null;

export function fechaLocalDe(ev) {
  return ev?.start?.date || ev?.start?.dateTime?.slice(0, 10) || null;
}

// desired: eventos neutros; existing: eventos de Google ya filtrados a [from,to] y esDeAngst.
export function planSync(desired, existing, tz) {
  const porClave = new Map();
  const sobrantes = [];
  for (const g of existing) {
    const k = claveDe(g);
    if (!k) continue;
    if (porClave.has(k)) sobrantes.push(g); else porClave.set(k, g);
  }
  const create = [], update = [], remove = [];
  let keep = 0;
  for (const ev of desired) {
    const body = toBody(ev, tz);
    const g = porClave.get(ev.key);
    if (!g) { create.push({ key: ev.key, body }); continue; }
    porClave.delete(ev.key);
    if (sigOf(g) === sigOf(body) && g.status !== "cancelled") keep++;
    else update.push({ id: g.id, key: ev.key, body });
  }
  for (const [key, g] of porClave) remove.push({ id: g.id, key });
  for (const g of sobrantes) remove.push({ id: g.id, key: claveDe(g) });
  return { create, update, remove, keep };
}

// Freno de seguridad: un estado vacío/corrupto no debe vaciar el calendario de los hijos.
export function verificarSeguridad(plan, { desiredCount, existingCount, maxRemove = 40 }) {
  if (desiredCount === 0 && existingCount > 5) {
    throw new Error(`estado sin eventos deseados pero ${existingCount} existentes: se aborta para no vaciar el calendario`);
  }
  if (plan.remove.length > maxRemove) {
    throw new Error(`el plan borraría ${plan.remove.length} eventos (tope ${maxRemove}): se aborta`);
  }
}

// Eventos de otras manos (los hijos, los que ya existían) → bandeja para Angst.
export function buildInbox(todosLosEventos) {
  return todosLosEventos
    .filter(g => g && !esDeAngst(g) && g.status !== "cancelled")
    .map(g => ({
      id: g.id,
      summary: g.summary || "",
      allDay: !!g.start?.date,
      start: g.start?.date || g.start?.dateTime || null,
      end: g.end?.date || g.end?.dateTime || null,
      creator: g.creator?.email || null,
      updated: g.updated || null,
    }))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.id.localeCompare(b.id));
}
