// ─── Selección de Panoramas (nov-2026): ⭐ = "preseleccionado" ──────────────
// Lo único que se guarda: qué panoramas marcó con ⭐, con UNA COPIA del evento (título, fechas,
// lugar, link, imagen, descripción) y, si ya lo creó, a qué tarea del planificador corresponde.
// La copia es a propósito: panoramas.json se renueva cada 6 h y un evento que cambia de fuente o
// ya pasó desaparece de ahí; la lista de preseleccionados no debe desaparecer con él.
//
// UNA clave, "angst-panoramas-seleccion-v1", declarada en LOCAL_KEY_FIELDS (core/persistence.js)
// → viaja en el export 💾 / Angst-data y se rehidrata en restoreFromPayload (rehidratarSeleccion).
// Es una clave nueva (decisión explícita del usuario, 14-nov-2026, R8): no migra ni toca datos
// existentes.
//
// Forma: { sel: { [idEvento]: { marca: msDeLaEstrella, ev: {…copia…}, tarea: { dia, id } | null } } }
const KEY = "angst-panoramas-seleccion-v1";
const CAMPOS = ["id", "titulo", "url", "inicio", "fin", "hora", "lugar", "direccion", "comuna", "categoria", "imagen",
  "gratis", "precio", "inscripcion", "inscripcionUrl", "ventaOnline", "cupos", "detalle", "fuente"];
const VENTANA_AVISO_DIAS = 7;      // el evento aparece en el dashboard de Semana desde 7 días antes
const RETENCION_DIAS = 30;         // un preseleccionado ya terminado se borra solo pasado este plazo

// ── Fechas (YYYY-MM-DD, mediodía local: sin saltos por horario de verano) ───
const pad = n => String(n).padStart(2, "0");
const aFecha = k => new Date(k + "T12:00:00");
const claveDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
export const sumarDias = (k, n) => { const d = aFecha(k); d.setDate(d.getDate() + n); return claveDe(d); };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const fechaCorta = k => { const d = aFecha(k); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };

// ── Copia del evento ─────────────────────────────────────────────────────────
export function copiaDe(ev) {
  const c = {};
  for (const k of CAMPOS) if (ev[k] !== undefined && ev[k] !== null) c[k] = ev[k];
  c.enCurso = diasEntre(ev.inicio, ev.fin) > 45;      // mismo criterio que build-panoramas.mjs
  return c;
}

// ── Estado (caché de módulo + oyentes, como Game enhanced) ───────────────────
const mapa = o => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

function leer() {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sel = {};
      for (const [id, x] of Object.entries(mapa(v.sel))) if (x && x.ev && x.ev.inicio && x.ev.fin) sel[id] = x;   // descarta entradas corruptas
      return { sel };
    }
  } catch (e) { /* clave ausente o corrupta: vacío */ }
  return { sel: {} };
}

let cache = leer();
const oyentes = new Set();

function guardar(next) {
  cache = next;
  try { globalThis.localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* sin cuota: queda en memoria */ }
  oyentes.forEach(fn => fn(next));
}

// Tras restaurar un export: la clave cambió por debajo de la caché de módulo.
export function rehidratarSeleccion() {
  cache = leer();
  oyentes.forEach(fn => fn(cache));
}

export function leerSeleccion() { return cache; }

export function alternarEstrella(ev) {
  const sel = { ...cache.sel };
  if (sel[ev.id]) delete sel[ev.id];
  else sel[ev.id] = { marca: Date.now(), ev: copiaDe(ev), tarea: null };
  guardar({ sel });
}

export function marcarTarea(id, tarea) {
  const x = cache.sel[id];
  if (!x) return;
  guardar({ sel: { ...cache.sel, [id]: { ...x, tarea } } });
}

// Con los datos frescos de panoramas.json: actualiza la copia de lo ⭐ (hora que cambió, descripción
// que llegó después) y borra lo que terminó hace más de RETENCION_DIAS. Solo escribe si algo cambió.
export function sincronizarCon(eventos, hoy) {
  const frescos = new Map((eventos || []).map(e => [e.id, e]));
  let cambio = false;
  const sel = {};
  for (const [id, x] of Object.entries(cache.sel)) {
    if (x.ev.fin < sumarDias(hoy, -RETENCION_DIAS)) { cambio = true; continue; }
    const f = frescos.get(id);
    if (f) {
      const ev = copiaDe(f);
      if (JSON.stringify(ev) !== JSON.stringify(x.ev)) { sel[id] = { ...x, ev }; cambio = true; continue; }
    }
    sel[id] = x;
  }
  if (cambio) guardar({ sel });
}

export function useSeleccion() {
  const [e, setE] = React.useState(cache);
  React.useEffect(() => {
    oyentes.add(setE);
    setE(cache);   // por si cambió entre el render y el efecto
    return () => oyentes.delete(setE);
  }, []);
  return e;
}

// ── Funciones puras (probadas en tests/panoramas-seleccion.mjs) ──────────────

// Preseleccionados que aún no terminaron, ordenados por inicio (los ya empezados cuentan desde hoy).
export function vigentes(estado, hoy) {
  return Object.values(estado.sel).filter(x => x.ev.fin >= hoy).sort((a, b) => a.ev.inicio.localeCompare(b.ev.inicio) || a.ev.titulo.localeCompare(b.ev.titulo, "es"));
}

// Día de la tarea en el planificador: la víspera del evento (anticipación de un día); si la víspera
// ya pasó (el evento es hoy o mañana, o ya empezó), hoy.
export function diaDeTarea(ev, hoy) {
  const visp = sumarDias(ev.inicio, -1);
  return visp < hoy ? hoy : visp;
}

export function textoTarea(ev, dia) {
  const falta = diasEntre(dia, ev.inicio);
  const prefijo = falta <= 0 ? (ev.inicio < dia ? "En curso" : "Hoy") : falta === 1 ? "Mañana" : fechaCorta(ev.inicio);
  return `🗓️ ${prefijo}: ${ev.titulo}${ev.hora ? " · " + ev.hora : ""}${ev.lugar ? " · " + ev.lugar : ""}`;
}

// Avisos para el dashboard de Semana en el día `k`: lo ⭐ que EMPIEZA ese día, solo si faltan 0 a 7
// días desde hoy (la baliza normal mira 60: los panoramas, a propósito, solo la última semana).
export function avisosDelDia(estado, k, hoy, ventana = VENTANA_AVISO_DIAS) {
  const falta = diasEntre(hoy, k);
  if (falta < 0 || falta > ventana) return [];
  return Object.values(estado.sel)
    .filter(x => x.ev.inicio === k)
    .map(x => {
      const m = /^(\d{1,2}):(\d{2})/.exec(x.ev.hora || "");
      return { icono: "⭐", texto: x.ev.titulo, hora: m ? `${pad(+m[1])}:${m[2]}` : null, detalle: [x.ev.lugar, x.ev.comuna].filter(Boolean)[0] || null };
    });
}
