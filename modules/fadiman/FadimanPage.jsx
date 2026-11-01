// Fadiman — protocolo (1 día dosis · 2 descanso · 60 días) + diario de seguimiento.
// Pantalla colapsada según el lineamiento (docs/angst-lineamiento-y-handoff.md §4): sin título
// propio, sin scroll colapsada, expansión exclusiva inline, formularios como emergentes.
// Datos sin cambios: fadimanData.{fadiman, fadimanLogs, fadimanDiario}.
import {
  ESCALAS, leerDiario, conCampo, conBase, hayAlerta, claveLocal, horaLocal, sumarDias, serie, resumen,
} from "./diarioModel.js";
import { tipoDia, diasRestantes, proximaDosis, etiquetaDia } from "./protocoloModel.js";
import { F_SANS, T_CLARO, chip, FilaSeccion, Tendencia } from "./fadimanUi.jsx";
import { SeccionManana, SeccionCierre, SeccionResumen, SeccionBase } from "./DiarioSecciones.jsx";
import { SeccionProtocolo, HojaRegistroProtocolo, HojaInicio } from "./ProtocoloVistas.jsx";

function FadimanPage({ data, saveData, cruzFor }) {
  const hoy = claveLocal();
  const T = T_CLARO;
  const [open, setOpen] = React.useState(null);        // sección expandida (exclusiva)
  const [fecha, setFecha] = React.useState(hoy);       // día que editan Mañana / Cierre
  const [hoja, setHoja] = React.useState(null);        // null | "inicio" | "log"
  const [logDate, setLogDate] = React.useState(hoy);
  const [setupDate, setSetupDate] = React.useState(hoy);
  const [rango, setRango] = React.useState(14);
  const [escala, setEscala] = React.useState("foco");
  const [desborda, setDesborda] = React.useState(false); // válvula: si colapsado no cabe, scroll en vez de recortar
  const bodyRef = React.useRef(null);

  const cfg = (data && data.fadiman) || null;
  const logs = (data && data.fadimanLogs) || {};
  const diario = leerDiario(data);
  const e = diario.dias[fecha] || {};
  const eHoy = diario.dias[hoy] || {};
  const esProtocolo = tipoDia(cfg, fecha) === "dose";

  // Válvula (lineamiento §4.5): si colapsado no cabe, aparece scroll en vez de cortar contenido, y se avisa en consola.
  React.useEffect(() => {
    const el = bodyRef.current;
    if (!el || open) return;
    const over = el.scrollHeight - el.clientHeight;
    if (over > 1) console.warn(`[fadiman] desborda colapsado: ${over}px — revisar alturas (R2)`);
    if ((over > 1) !== desborda) setDesborda(over > 1);
  });

  const save = (updates) => saveData({ ...data, ...updates });
  const guardar = (nuevo) => save({ fadimanDiario: nuevo });
  const set = (campo, valor) => guardar(conCampo(diario, fecha, campo, valor, esProtocolo));
  const setNum = (campo, txt) => set(campo, txt === "" ? null : parseFloat(txt));
  const setBase = (campo, valor) => guardar(conBase(diario, campo, valor));
  const setMg = (txt) => guardar({ ...diario, cfg: { ...diario.cfg, mg: txt === "" ? 10 : parseFloat(txt) } });
  function marcarToma() {
    if (e.tomo) { set("tomo", false); return; }
    let d = conCampo(diario, fecha, "tomo", true, esProtocolo);
    if (!e.hora && fecha === hoy) d = conCampo(d, fecha, "hora", horaLocal(), esProtocolo);
    if (!e.mg) d = conCampo(d, fecha, "mg", diario.cfg.mg, esProtocolo);
    guardar(d);
  }
  const saveLog = (dateKey, field, val) => save({ fadimanLogs: { ...logs, [dateKey]: { ...(logs[dateKey] || {}), [field]: val } } });
  function iniciar(startDate) { save({ fadiman: { startDate, active: true }, fadimanLogs: {} }); setHoja(null); }

  // ── franja de estado ──
  const tHoy = tipoDia(cfg, hoy);
  const rest = diasRestantes(cfg, hoy);
  const sig = proximaDosis(cfg, hoy);
  let lineaProt;
  if (!cfg) lineaProt = "sin protocolo activo";
  else if (hoy < cfg.startDate) lineaProt = `empieza ${etiquetaDia(cfg.startDate, true)}`;
  else if (tHoy === "done") lineaProt = "protocolo completado";
  else if (tHoy === "dose") lineaProt = `día de dosis${(logs[hoy] || {}).dosed ? " ✓" : ""} · ${rest} días restantes`;
  else lineaProt = `descanso · próxima dosis ${etiquetaDia(sig, true)}`;

  const partes = [];
  if (eHoy.tomo) partes.push(`toma ✓${eHoy.hora ? " " + eHoy.hora : ""}${eHoy.mg ? " · " + eHoy.mg + " mg" : ""}`);
  else if (eHoy.tomo === false) partes.push("sin toma");
  if (eHoy.foco) partes.push(`foco ${eHoy.foco}`);
  const lineaDiario = partes.length ? partes.join(" · ") : "sin registro hoy";

  // ── resúmenes de las filas ──
  const hayCierre = ESCALAS.some(({ k }) => e[k]) || (e.efectos || []).length > 0 || e.rebote != null || !!e.nota;
  const r14 = resumen(diario, hoy, 14);
  const summaries = {
    manana: e.tomo ? `✓ ${e.hora || ""}${e.mg ? " · " + e.mg + " mg" : ""}${e.suenoHoras ? " · " + e.suenoHoras + " h" : ""}`.trim() : (e.suenoHoras ? `sin toma · ${e.suenoHoras} h` : "sin toma"),
    cierre: hayCierre ? `foco ${e.foco || "—"} · ${(e.efectos || []).length} efecto${(e.efectos || []).length === 1 ? "" : "s"}` : "sin registro",
    protocolo: !cfg ? "sin iniciar" : tHoy === "dose" ? "dosis hoy" : tHoy === "done" ? "completado" : sig ? `próxima ${etiquetaDia(sig)}` : "—",
    resumen: r14.conRegistro ? `${r14.conRegistro} registro${r14.conRegistro === 1 ? "" : "s"} en 14 d` : "sin registros",
    base: `${diario.base ? "definida" : "sin definir"} · ${diario.cfg.mg} mg`,
  };
  const SECCIONES = [
    { id: "manana", icon: "☀️", label: "Mañana" },
    { id: "cierre", icon: "🌙", label: "Cierre" },
    { id: "protocolo", icon: "🍄", label: "Protocolo" },
    { id: "resumen", icon: "📈", label: "Resumen" },
    { id: "base", icon: "📏", label: "Línea base" },
  ];
  const toggle = (id) => setOpen((o) => (o === id ? null : id));
  const cruz = cruzFor ? cruzFor(fecha) : null;
  const alerta = hayAlerta(eHoy);

  return (
    <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: "10px 12px 8px", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "8px 12px", marginBottom: 6, flex: "none", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F_SANS, fontSize: 12, lineHeight: "18px", color: tHoy === "dose" ? "#aac756" : "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🍄 {lineaProt}</div>
          <div style={{ fontFamily: F_SANS, fontSize: 12, lineHeight: "18px", color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📓 {lineaDiario}</div>
          {alerta && <div style={{ fontFamily: F_SANS, fontSize: 11, lineHeight: "16px", color: "#ffb74d" }}>⚠️ palpitaciones o dolor de pecho hoy: si son fuertes, consulta</div>}
        </div>
        <button onClick={() => { setSetupDate(hoy); setHoja("inicio"); }} style={{ flex: "none", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, padding: "3px 8px", fontFamily: F_SANS, fontSize: 11, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>{cfg ? "↻ reiniciar" : "▶ iniciar"}</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flex: "none" }}>
        <button onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="día anterior" style={chip(T, false)}>◀</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: F_SANS, fontSize: 12, color: "#111" }}>{etiquetaDia(fecha, true)}{fecha === hoy ? " · hoy" : ""}</div>
        {fecha !== hoy && <button onClick={() => setFecha(hoy)} style={chip(T, false)}>hoy</button>}
        <button onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="día siguiente" style={chip(T, false)}>▶</button>
      </div>

      <div ref={bodyRef} data-expandido={open ? "true" : "false"} style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", overflowY: (open || desborda) ? "auto" : "hidden", overflowX: "hidden" }}>
        {SECCIONES.map((sc) => (
          <div key={sc.id} style={{ flex: "none" }}>
            <FilaSeccion icon={sc.icon} label={sc.label} summary={summaries[sc.id]} open={open === sc.id} onToggle={() => toggle(sc.id)} />
            {open === sc.id && sc.id === "manana" && <SeccionManana T={T} e={e} esProtocolo={esProtocolo} set={set} setNum={setNum} marcarToma={marcarToma} />}
            {open === sc.id && sc.id === "cierre" && <SeccionCierre T={T} e={e} fecha={fecha} cruz={cruz} set={set} setNum={setNum} />}
            {open === sc.id && sc.id === "protocolo" && <SeccionProtocolo cfg={cfg} logs={logs} hoy={hoy} abrirLog={(d) => { setLogDate(d); setHoja("log"); }} abrirInicio={() => { setSetupDate(hoy); setHoja("inicio"); }} />}
            {open === sc.id && sc.id === "resumen" && <SeccionResumen T={T} diario={diario} hoy={hoy} rango={rango} setRango={setRango} escala={escala} setEscala={setEscala} cruzFor={cruzFor} />}
            {open === sc.id && sc.id === "base" && <SeccionBase T={T} diario={diario} setBase={setBase} setMg={setMg} />}
          </div>
        ))}
        {!open && <Tendencia pts={serie(diario, "foco", hoy, 14)} titulo="foco · últimos 14 días" />}
      </div>

      {hoja === "inicio" && <HojaInicio cfg={cfg} fecha={setupDate} setFecha={setSetupDate} onStart={iniciar} onClose={() => setHoja(null)} />}
      {hoja === "log" && <HojaRegistroProtocolo cfg={cfg} logs={logs} logDate={logDate} setLogDate={setLogDate} saveLog={saveLog} onClose={() => setHoja(null)} />}
    </div>
  );
}

export default FadimanPage;
