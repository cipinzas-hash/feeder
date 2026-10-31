import { CAMPOS_ESCALA, ETIQUETAS, tipoDia, esSabado, diasDosis, etiquetaDia } from "./protocoloModel.js";
import { F_HAND, F_SANS, lbl, inp, chip, Fila5, Hoja, T_CLARO, T_OSCURO } from "./fadimanUi.jsx";

// Vistas del protocolo Fadiman (1 día dosis · 2 descanso · 60 días).
// Mismos datos de siempre (fadiman / fadimanLogs); solo cambia cómo se muestran.

const puntos = (T, lg) => (
  <div style={{ display: "flex", gap: 3 }}>
    {CAMPOS_ESCALA.map((f) => <div key={f} style={{ width: 4, height: 4, borderRadius: "50%", background: lg[f] ? T.acc : T.line }} />)}
  </div>
);

export function SeccionProtocolo({ cfg, logs, hoy, abrirLog, abrirInicio }) {
  const T = T_CLARO;
  if (!cfg) {
    return (
      <div style={{ padding: "10px 4px 14px", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontFamily: F_SANS, fontSize: 12, color: T.dim, lineHeight: 1.6 }}>Sin protocolo activo. 1 día de dosis, 2 de descanso, durante 60 días; el inicio debe ser un sábado.</div>
        <button onClick={abrirInicio} style={chip(T, true)}>iniciar protocolo</button>
      </div>
    );
  }
  const dosis = diasDosis(cfg);
  const proximas = dosis.filter((d) => d >= hoy).slice(0, 8);
  const pasadas = dosis.filter((d) => d < hoy).reverse().slice(0, 10);
  const fila = (d, atenuada) => {
    const lg = logs[d] || {};
    const esHoy = d === hoy;
    return (
      <div key={d} onClick={() => abrirLog(d)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", background: esHoy ? "#f1f6e3" : "#fff", border: "1px dashed " + (esHoy ? T.acc : T.line), borderRadius: 8, cursor: "pointer", marginBottom: 4, opacity: atenuada ? 0.75 : 1 }}>
        <span style={{ fontSize: 14 }}>🍄</span>
        <span style={{ flex: 1, fontFamily: F_HAND, fontSize: 16, fontWeight: 700, color: esHoy ? T.acc : T.txt }}>{etiquetaDia(d, true)}{esHoy ? " — hoy" : ""}</span>
        {lg.dosed && <span style={{ fontFamily: F_SANS, fontSize: 10, color: T.acc }}>✓</span>}
        {puntos(T, lg)}
        <span style={{ fontSize: 11, color: "#ccc" }}>›</span>
      </div>
    );
  };
  return (
    <div style={{ padding: "6px 2px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ ...lbl(T), marginBottom: 0, flex: 1 }}>próximas dosis</div>
        <button onClick={abrirInicio} style={{ ...chip(T, false), fontSize: 10, padding: "3px 10px" }}>reiniciar</button>
      </div>
      {proximas.length ? proximas.map((d) => fila(d, false)) : <div style={{ fontFamily: F_HAND, fontSize: 16, color: "#bbb", padding: "6px 0" }}>sin dosis pendientes</div>}
      {pasadas.length > 0 && (
        <>
          <div style={{ ...lbl(T), margin: "14px 0 8px" }}>historial</div>
          {pasadas.map((d) => fila(d, true))}
        </>
      )}
    </div>
  );
}

// Registro de un día de dosis del protocolo (formulario → emergente, R4).
export function HojaRegistroProtocolo({ cfg, logs, logDate, setLogDate, saveLog, onClose }) {
  const T = T_OSCURO;
  const dt = tipoDia(cfg, logDate);
  const lg = logs[logDate] || {};
  return (
    <Hoja titulo={`🍄 ${etiquetaDia(logDate, true)}`} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {dt === "dose" && <span style={{ fontFamily: F_SANS, fontSize: 10, color: T.acc, letterSpacing: 1 }}>DÍA DE DOSIS</span>}
        <input type="date" value={logDate} onChange={(e) => e.target.value && setLogDate(e.target.value)} style={{ ...inp(T), marginLeft: "auto", fontSize: 12, padding: "4px 8px" }} />
      </div>
      {dt === "dose" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a2200", border: `1px solid ${T.acc}`, borderRadius: 8, padding: "12px 14px" }}>
          <span style={{ fontSize: 20 }}>🍄</span>
          <div style={{ flex: 1, fontFamily: F_SANS, fontSize: 12, color: T.acc }}>dosis tomada</div>
          <button onClick={() => saveLog(logDate, "dosed", !lg.dosed)} style={{ background: lg.dosed ? T.acc : "transparent", border: `1px dashed ${T.acc}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: F_SANS, fontSize: 12, color: lg.dosed ? "#111" : T.acc }}>{lg.dosed ? "✓ sí" : "marcar"}</button>
        </div>
      )}
      {CAMPOS_ESCALA.map((f) => (
        <div key={f}><div style={lbl(T)}>{ETIQUETAS[f]}</div><Fila5 T={T} valor={lg[f] || 0} onPick={(n) => saveLog(logDate, f, n == null ? 0 : n)} /></div>
      ))}
      {["sensaciones", "notas"].map((f) => (
        <div key={f}>
          <div style={lbl(T)}>{ETIQUETAS[f]}</div>
          <textarea value={lg[f] || ""} onChange={(e) => saveLog(logDate, f, e.target.value)}
            placeholder={f === "sensaciones" ? "tensión, ligereza, temperatura..." : "observaciones del día..."}
            style={{ ...inp(T), width: "100%", minHeight: 70, resize: "vertical", fontSize: 13 }} />
        </div>
      ))}
    </Hoja>
  );
}

// Iniciar o reiniciar el protocolo (confirmación con fecha → emergente).
export function HojaInicio({ cfg, fecha, setFecha, onStart, onClose }) {
  const T = T_OSCURO;
  const sab = esSabado(fecha);
  return (
    <Hoja titulo={cfg ? "Reiniciar protocolo" : "Iniciar protocolo"} onClose={onClose}>
      <div style={{ fontFamily: F_SANS, fontSize: 12, color: T.dim, lineHeight: 1.6 }}>1 día de dosis · 2 de descanso · 60 días. El inicio debe ser un sábado.</div>
      {cfg && <div style={{ fontFamily: F_SANS, fontSize: 12, color: "#f5a623", lineHeight: 1.5 }}>Reiniciar borra los registros del protocolo actual. El diario de seguimiento no se toca.</div>}
      <div>
        <div style={lbl(T)}>fecha de inicio (sábado)</div>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...inp(T), fontSize: 16, padding: "10px 14px" }} />
        {!sab && <div style={{ fontFamily: F_SANS, fontSize: 11, color: T.warn, marginTop: 8 }}>elige un sábado</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => sab && onStart(fecha)} style={{ ...chip(T, sab), opacity: sab ? 1 : 0.4, cursor: sab ? "pointer" : "default" }}>{cfg ? "reiniciar" : "iniciar protocolo"}</button>
        <button onClick={onClose} style={chip(T, false)}>cancelar</button>
      </div>
    </Hoja>
  );
}
