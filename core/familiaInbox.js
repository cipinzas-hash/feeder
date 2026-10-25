// Bandeja Familia → Angst (issue #26, docs/gcal-sync.md). Lógica PURA de la bandeja: qué eventos del calendario
// Familia están pendientes de decidir, cómo se vuelven tareas y cómo se registra lo decidido.
//
// Los eventos llegan en google-inbox.json (lo escribe el bot build-gcal-sync.mjs; la app lo lee por el Worker).
// Lo decidido vive en localStorage "angst-gcal-inbox-v1" y viaja en el export como `gcalInbox`
// (LOCAL_KEY_FIELDS en persistence.js). El sync lo lee del estado exportado y borra de Google SOLO los eventos
// que se pasaron a tarea Y cuya tarea ya está en ese estado.

export const FAMILIA_KEY = "angst-gcal-inbox-v1";
export const MAX_DIAS = 14; // un evento de varios días se parte en una tarea por día, hasta este tope

export function decisionesVacias() { return { imported: {}, ignored: {} }; }

export function normalizarDecisiones(d) {
  const ok = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  return { imported: ok(d?.imported), ignored: ok(d?.ignored) };
}

export function leerDecisiones(storage = globalThis.localStorage) {
  try { const v = storage.getItem(FAMILIA_KEY); return normalizarDecisiones(v ? JSON.parse(v) : null); }
  catch (e) { return decisionesVacias(); }
}

export function guardarDecisiones(dec, storage = globalThis.localStorage) {
  try { storage.setItem(FAMILIA_KEY, JSON.stringify(normalizarDecisiones(dec))); return true; }
  catch (e) { return false; }
}

const pad = n => String(n).padStart(2, "0");
function sumarDias(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// Fechas (YYYY-MM-DD) en que cae el evento. Día completo: start inclusive, end exclusivo. Con hora: solo el día de inicio.
export function fechasDeEvento(ev) {
  if (!ev || !ev.start) return [];
  const ini = String(ev.start).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ini)) return [];
  if (!ev.allDay || !ev.end) return [ini];
  const fin = String(ev.end).slice(0, 10);
  const out = [];
  for (let d = ini; d < fin && out.length < MAX_DIAS; d = sumarDias(d, 1)) out.push(d);
  return out.length ? out : [ini];
}

// Hora local del evento ("HH:MM" de su dateTime); null si es de día completo o a las 00:00 (igual criterio que el sync).
export function horaDeEvento(ev) {
  if (!ev || ev.allDay || !ev.start || String(ev.start).length < 16) return null;
  const hhmm = String(ev.start).slice(11, 16);
  if (!/^\d{2}:\d{2}$/.test(hhmm) || hhmm === "00:00") return null;
  return { h: Number(hhmm.slice(0, 2)), m: Number(hhmm.slice(3, 5)) };
}

// Eventos sin decidir y que todavía no pasaron (su última fecha >= hoy), ordenados por fecha.
export function pendientes(events, dec, hoy) {
  const { imported, ignored } = normalizarDecisiones(dec);
  return (Array.isArray(events) ? events : [])
    .filter(ev => ev && ev.id && !(ev.id in imported) && !(ev.id in ignored))
    .map(ev => ({ ev, fechas: fechasDeEvento(ev) }))
    .filter(x => x.fechas.length && x.fechas[x.fechas.length - 1] >= hoy)
    .sort((a, b) => a.fechas[0].localeCompare(b.fechas[0]) || String(a.ev.start).localeCompare(String(b.ev.start)) || a.ev.id.localeCompare(b.ev.id));
}

export function tareaDesdeEvento(ev, nid) {
  const t = { id: nid, text: String(ev.summary || "").replace(/\s+/g, " ").trim() || "(sin título)", fixed: false, done: false };
  const hora = horaDeEvento(ev);
  if (hora) t.deadline = hora;
  return t;
}

export function registrarImportado(dec, eventId, items, ahora = Date.now()) {
  const d = normalizarDecisiones(dec);
  return { ...d, imported: { ...d.imported, [eventId]: { at: ahora, items } } };
}

export function registrarIgnorado(dec, eventId, ahora = Date.now()) {
  const d = normalizarDecisiones(dec);
  return { ...d, ignored: { ...d.ignored, [eventId]: ahora } };
}

// Poda decisiones de eventos que ya no están en la bandeja (el sync borró el importado, o se borró a mano) y son viejas.
export function podar(dec, events, ahora = Date.now(), dias = 45) {
  const d = normalizarDecisiones(dec);
  const vivos = new Set((Array.isArray(events) ? events : []).map(e => e.id));
  const limite = ahora - dias * 86400000;
  const filtrar = (obj, ts) => Object.fromEntries(Object.entries(obj).filter(([id, v]) => vivos.has(id) || ts(v) > limite));
  return { imported: filtrar(d.imported, v => v?.at || 0), ignored: filtrar(d.ignored, v => Number(v) || 0) };
}
