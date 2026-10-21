// Dashboard de Semana (prueba del lineamiento "módulo colapsado, sin scroll").
// Todo se DERIVA de datos que ya existen (dayData, calMarks, custody, eventos
// externos, ejercicioLog, nutriLog): no escribe nada ni agrega claves de
// almacenamiento (R8).
//
// "Baliza" = tarea con 🚨 (campo `urgent`) y sin hacer. Igual que el 🚨 de la
// cabecera de cada día, NO cuenta las tareas recurrentes marcadas urgentes.
// Las marcas del calendario usan los mismos íconos que el resto de la app
// (core/ui.jsx: MARK_ICONS_CAL). Las citas de Salud ya llegan como marca
// "doctor" (planCita las sincroniza al calendario), así que no se leen aparte.
import { fmtFull, getHoliday } from "./dates.js";

const DIA_CORTO = ["D", "L", "M", "M", "J", "V", "S"];
const DIA_LARGO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
// El orden es la prioridad con la que se muestran cuando no caben todas.
const MARCAS = [
  { id: "doctor",   label: "doctor",    emoji: "🏥" },
  { id: "colegio",  label: "colegio",   emoji: "🎒" },
  { id: "work",     label: "trabajo",   emoji: "💼" },
  { id: "gym",      label: "gym",       emoji: "🏋️" },
  { id: "social",   label: "social",    emoji: "🟢" },
  { id: "romantic", label: "romántico", emoji: "🌸" },
];
const MARCA_POR_ID = Object.fromEntries(MARCAS.map(m => [m.id, m]));
const EVENTO_COLOR = { melee: "#ff6600", pokemon: "#ffcc00", sc2: "#1565c0" };
const VENTANA_BALIZA_DIAS = 60;

function aFecha(k) { return new Date(k + "T12:00:00"); }
function diasEntre(a, b) { return Math.round((aFecha(b) - aFecha(a)) / 86400000); }
function sumarDias(k, n) { const d = aFecha(k); d.setDate(d.getDate() + n); return fmtFull(d); }
function minutosDe(dl) { return dl ? dl.h * 60 + dl.m : null; }
function hhmm(dl) { return String(dl.h).padStart(2, "0") + ":" + String(dl.m).padStart(2, "0"); }
function balizasDeDia(day) {
  return (day?.tasks || []).filter(t => t.urgent && !t.done && !t.postponed && t.text);
}
function cuando(dias) { return dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`; }
function colorCarga(score) { return score <= 5 ? "#4caf50" : score <= 7 ? "#ff9800" : "#f44336"; }

// Función pura (exportada para poder probarla sin React).
function buildResumen({ todayKey, ahoraMin, weekKeys, dayData, calMarks, eventos, stressFor, conNinosEn, ejercicioHoy, kcalHoy }) {
  const marcasDe = k => {
    const v = calMarks[k];
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    const ids = new Set(arr.map(m => (m === "medico" ? "doctor" : m)).filter(m => MARCA_POR_ID[m]));
    return MARCAS.filter(m => ids.has(m.id)).map(m => m.id);
  };
  const ordenBaliza = (a, b) => (minutosDe(a.deadline) ?? 1e9) - (minutosDe(b.deadline) ?? 1e9);

  // Próxima baliza: mira hacia adelante desde hoy, también fuera de la semana mostrada.
  let proxima = null;
  for (let i = 0; i <= VENTANA_BALIZA_DIAS && !proxima; i++) {
    const k = sumarDias(todayKey, i);
    const bs = balizasDeDia(dayData[k]);
    if (bs.length) {
      const ord = [...bs].sort(ordenBaliza);
      proxima = {
        dateKey: k, dias: i, dow: aFecha(k).getDay(),
        texto: ord[0].text, hora: ord[0].deadline ? hhmm(ord[0].deadline) : null,
        extra: bs.length - 1,
      };
    }
  }
  const balizasSemana = weekKeys.reduce((n, k) => (k >= todayKey ? n + balizasDeDia(dayData[k]).length : n), 0);

  // Una celda por día: es la tira de la fila colapsada y la grilla del detalle.
  const semana = weekKeys.map(k => ({
    k, dow: aFecha(k).getDay(), num: aFecha(k).getDate(),
    hoy: k === todayKey, pasado: k < todayKey,
    marcas: marcasDe(k), balizas: balizasDeDia(dayData[k]).length,
    score: stressFor(k) || 0, conNinos: !!conNinosEn(k),
  }));

  // Agenda de balizas: solo lo que NO se ve en los íconos (texto y hora). Desde hoy.
  const agenda = semana
    .filter(c => !c.pasado && c.balizas)
    .map(c => ({
      k: c.k, dow: c.dow, num: c.num, hoy: c.hoy,
      balizas: [...balizasDeDia(dayData[c.k])].sort(ordenBaliza)
        .map(t => ({ texto: t.text, hora: t.deadline ? hhmm(t.deadline) : null })),
    }));

  const evs = eventos
    .filter(ev => weekKeys.some(k => k >= ev.start && k <= ev.end))
    .map(ev => {
      const enCurso = todayKey >= ev.start && todayKey <= ev.end;
      const terminado = todayKey > ev.end;
      const finalsKey = weekKeys.includes(ev.end) ? ev.end : null;
      return {
        ...ev, enCurso, terminado,
        estado: enCurso ? "en curso" : terminado ? "terminó" : cuando(diasEntre(todayKey, ev.start)),
        finals: finalsKey ? DIA_LARGO[aFecha(finalsKey).getDay()] : null,
      };
    });

  let hoy = null;
  if (weekKeys.includes(todayKey)) {
    const ts = (dayData[todayKey]?.tasks || []).filter(t => t.text && !t.postponed);
    const pend = ts.filter(t => !t.done);
    const prox = pend
      .filter(t => t.deadline && minutosDe(t.deadline) >= ahoraMin)
      .sort((a, b) => minutosDe(a.deadline) - minutosDe(b.deadline))[0] || null;
    hoy = {
      total: ts.length, hechas: ts.length - pend.length,
      proxima: prox ? { hora: hhmm(prox.deadline), texto: prox.text } : null,
      ejercicio: !!ejercicioHoy,
      kcal: kcalHoy > 0 ? Math.round(kcalHoy) : 0,
    };
  }

  const pico = semana.reduce((a, c) => (c.score > (a ? a.score : 0) ? c : a), null);
  const feriados = weekKeys
    .map(k => ({ dow: aFecha(k).getDay(), h: getHoliday(aFecha(k)) }))
    .filter(x => x.h && x.h.type !== "weekend")
    .map(x => ({ dow: x.dow, label: x.h.label }));

  return { proxima, balizasSemana, semana, agenda, eventos: evs, hoy, pico, feriados };
}

// Íconos de un día: 🚨 primero, luego las marcas por prioridad; recorta con "+".
function iconosDia(c, max) {
  const lista = (c.balizas > 0 ? ["🚨"] : []).concat(c.marcas.map(id => MARCA_POR_ID[id].emoji));
  return lista.slice(0, max).join("") + (lista.length > max ? "+" : "");
}

// Anillo de estrés alrededor de la fecha (como el progreso del reproductor): 0–10.
function Aro({ score, children }) {
  const R = 14, C = 2 * Math.PI * R;
  const frac = Math.min(1, Math.max(0, score / 10));
  return (
    <span className="aro">
      <svg viewBox="0 0 34 34" aria-hidden="true">
        <circle className="aro-t" cx="17" cy="17" r={R} />
        {frac > 0 && (
          <circle className="aro-p" cx="17" cy="17" r={R} stroke={colorCarga(score)}
            strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 17 17)" />
        )}
      </svg>
      <span className="aro-n">{children}</span>
    </span>
  );
}

function HoyLinea({ hoy }) {
  return (
    <>
      <b>HOY</b>{" "}
      {hoy.total === 0 ? "sin tareas" : hoy.proxima ? `${hoy.proxima.hora} ${hoy.proxima.texto}` : "sin horas pendientes"}
      {hoy.total > 0 && <span className="dash-dim"> · {hoy.hechas}/{hoy.total} ✓</span>}
      {hoy.ejercicio && <span className="dash-dim"> · 🏋️ ✓</span>}
      {hoy.kcal > 0 && <span className="dash-dim"> · {hoy.kcal.toLocaleString("es-CL")} kcal</span>}
    </>
  );
}

// Panel único: selector de semana (`navegacion`) + fechas con anillo de estrés e íconos
// de marcas + una línea de lo importante. Ocupa el espacio que dejan los días colapsados.
function SemanaDashboard({ abierto, onToggle, navegacion, ...args }) {
  const r = buildResumen(args);
  return (
    <div className={"dashpanel" + (abierto ? " abierto" : "")}>
      <div className="dp-nav">{navegacion}</div>

      <div className="dw-grid">
        {r.semana.map(c => (
          <div key={c.k} className={"dw-col" + (c.hoy ? " hoy" : "") + (c.pasado ? " pasado" : "")}>
            <span className="dw-dow">{DIA_LARGO[c.dow]}</span>
            <Aro score={c.score}>{c.num}</Aro>
            <span className="dw-ic">{iconosDia(c, 3)}</span>
            <i className={"dw-kid" + (c.conNinos ? " on" : "")} title={c.conNinos ? "con los niños" : "sin los niños"} />
          </div>
        ))}
      </div>

      <div className="dp-info" onClick={onToggle}>
        <div className="dp-lineas">
          <div className="dp-l1">
            {r.proxima
              ? <>🚨 {cuando(r.proxima.dias)} · {DIA_LARGO[r.proxima.dow]} {r.proxima.hora ? r.proxima.hora + " " : ""}{r.proxima.texto}{r.proxima.extra > 0 ? ` +${r.proxima.extra}` : ""}</>
              : r.hoy ? <HoyLinea hoy={r.hoy} /> : <span className="dash-dim">sin balizas</span>}
          </div>
          {r.proxima && r.hoy && <div className="dp-l2"><HoyLinea hoy={r.hoy} /></div>}
        </div>
        <button className="min-btn" onClick={e => { e.stopPropagation(); onToggle(); }}>{abierto ? "▴" : "▾"}</button>
      </div>

      {abierto && (
        <div className="dash-det">
          {r.hoy && <div className="dash-hoy"><HoyLinea hoy={r.hoy} /></div>}
          <div>
            <div className="dash-sec">balizas{r.balizasSemana > 0 ? ` · ${r.balizasSemana} esta semana` : ""}</div>
            {r.agenda.length === 0
              ? <div className="dash-dim">{r.proxima ? `la próxima es ${cuando(r.proxima.dias)}` : "sin balizas por delante"}</div>
              : r.agenda.map(d => (
                <div key={d.k} className={"dq-row" + (d.hoy ? " hoy" : "")}>
                  <span className="dq-d">{DIA_LARGO[d.dow]} {d.num}</span>
                  <span className="dq-t">
                    {d.balizas.map((b, i) => <span key={i}>🚨 {b.hora ? <span className="dq-h">{b.hora} </span> : null}{b.texto}</span>)}
                  </span>
                </div>
              ))}
          </div>
          {r.eventos.length > 0 && (
            <div>
              <div className="dash-sec">eventos</div>
              {r.eventos.slice(0, 3).map((ev, i) => (
                <a key={i} className="dash-ev" href={ev.url} target="_blank" rel="noopener" style={{ opacity: ev.terminado ? 0.5 : 1 }}>
                  <b style={{ background: EVENTO_COLOR[ev.tipo] || "#888" }} />
                  <span className="dash-ev-n">{ev.name}</span>
                  <span className="dash-dim">{ev.estado}{ev.finals && !ev.terminado ? ` · finals ${ev.finals}` : ""}</span>
                </a>
              ))}
              {r.eventos.length > 3 && <div className="dash-dim">+{r.eventos.length - 3} más</div>}
            </div>
          )}
          {r.feriados.length > 0 && <div className="dash-dim">feriado: {r.feriados.map(f => DIA_LARGO[f.dow]).join(", ")}</div>}
        </div>
      )}
    </div>
  );
}

export { buildResumen };
export default SemanaDashboard;
