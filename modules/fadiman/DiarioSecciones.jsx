import {
  ESCALAS, ESCALAS_RESUMEN, EFECTOS, REBOTE, EFECTOS_ALERTA,
  alternarEfecto, hayAlerta, serie, resumen, compararToma, textoResumen,
} from "./diarioModel.js";
import { etiquetaDia } from "./protocoloModel.js";
import { F_SANS, lbl, inp, chip, Fila5, Grafico } from "./fadimanUi.jsx";

// Secciones del diario de seguimiento (contenido de cada fila expandida).
// Todo es controlado desde FadimanPage: aquí no hay estado de datos ni
// subcomponentes definidos dentro de otros (al escribir no se pierde el foco).

const col = { display: "flex", flexDirection: "column", gap: 14, padding: "6px 2px 12px" };

export function SeccionManana({ T, e, esProtocolo, set, setNum, marcarToma }) {
  return (
    <div style={col}>
      {esProtocolo && <div style={{ fontFamily: F_SANS, fontSize: 11, color: T.acc }}>🍄 día de dosis Fadiman</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.panel, border: `1px solid ${e.tomo ? T.selBg : T.line}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ flex: 1, fontFamily: F_SANS, fontSize: 13, color: T.txt }}>toma del día</div>
        <button onClick={marcarToma} style={chip(T, !!e.tomo)}>{e.tomo ? "✓ tomada" : "marcar"}</button>
      </div>
      {e.tomo && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><div style={lbl(T)}>hora</div><input type="time" value={e.hora || ""} onChange={(ev) => set("hora", ev.target.value)} style={{ ...inp(T), width: 110 }} /></div>
          <div><div style={lbl(T)}>mg</div><input type="number" inputMode="decimal" value={e.mg ?? ""} onChange={(ev) => setNum("mg", ev.target.value)} style={{ ...inp(T), width: 70 }} /></div>
          <button onClick={() => set("comida", !e.comida)} style={{ ...chip(T, !!e.comida), height: 36 }}>{e.comida ? "con comida" : "en ayunas"}</button>
        </div>
      )}
      <div>
        <div style={lbl(T)}>sueño de anoche</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input type="time" aria-label="hora de dormir" value={e.suenoHora || ""} onChange={(ev) => set("suenoHora", ev.target.value)} style={{ ...inp(T), width: 110 }} />
          <input type="number" inputMode="decimal" step="0.5" placeholder="horas" value={e.suenoHoras ?? ""} onChange={(ev) => setNum("suenoHoras", ev.target.value)} style={{ ...inp(T), width: 80 }} />
        </div>
        <Fila5 T={T} valor={e.suenoCal} onPick={(n) => set("suenoCal", n)} />
      </div>
    </div>
  );
}

export function SeccionCierre({ T, e, fecha, cruz, set, setNum }) {
  return (
    <div style={col}>
      {cruz && (
        <div style={{ fontFamily: F_SANS, fontSize: 11, color: T.dim, lineHeight: 1.6 }}>
          {etiquetaDia(fecha)} en Angst:
          {cruz.tareasTotal > 0 ? ` tareas ${cruz.tareasHechas}/${cruz.tareasTotal}` : " sin tareas"}
          {typeof cruz.estres === "number" ? ` · estrés ${cruz.estres}` : ""}
          {cruz.ejercicio != null ? ` · ejercicio ${cruz.ejercicio ? "✓" : "—"}` : ""}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><div style={lbl(T)}>se nota desde</div><input type="time" value={e.efIni || ""} onChange={(ev) => set("efIni", ev.target.value)} style={{ ...inp(T), width: "100%" }} /></div>
        <div style={{ flex: 1 }}><div style={lbl(T)}>se va hacia</div><input type="time" value={e.efFin || ""} onChange={(ev) => set("efFin", ev.target.value)} style={{ ...inp(T), width: "100%" }} /></div>
      </div>
      <div style={{ fontFamily: F_SANS, fontSize: 10, color: T.faint }}>escalas: 1 = nada · 5 = mucho</div>
      {ESCALAS.map(({ k, label }) => (
        <div key={k}><div style={lbl(T)}>{label}</div><Fila5 T={T} valor={e[k]} onPick={(n) => set(k, n)} /></div>
      ))}
      <div>
        <div style={lbl(T)}>rebote vespertino</div>
        <div style={{ display: "flex", gap: 4 }}>
          {REBOTE.map((t, i) => <button key={t} onClick={() => set("rebote", e.rebote === i ? null : i)} style={{ ...chip(T, e.rebote === i), flex: 1, padding: "8px 2px", borderRadius: 8 }}>{t}</button>)}
        </div>
      </div>
      <div>
        <div style={lbl(T)}>efectos adversos</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EFECTOS.map(({ k, label }) => {
            const on = (e.efectos || []).includes(k);
            const al = EFECTOS_ALERTA.includes(k);
            return (
              <button key={k} onClick={() => set("efectos", alternarEfecto(e, k))}
                style={{ ...chip(T, on), ...(al ? { border: "1px solid " + T.warn, color: on ? "#fff" : T.warn, background: on ? T.warn : "transparent" } : {}) }}>{label}</button>
            );
          })}
        </div>
        <input type="text" placeholder="otro…" value={e.efectoOtro || ""} onChange={(ev) => set("efectoOtro", ev.target.value)} style={{ ...inp(T), width: "100%", marginTop: 8 }} />
        {hayAlerta(e) && (
          <div style={{ fontFamily: F_SANS, fontSize: 12, color: T.warn, marginTop: 8, lineHeight: 1.5, border: `1px solid ${T.warn}`, borderRadius: 8, padding: "8px 10px" }}>
            Si las palpitaciones son fuertes, no ceden, o hay dolor de pecho, contacta a tu médico o ve a urgencias.
          </div>
        )}
      </div>
      <div>
        <div style={lbl(T)}>medidas (opcional)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" inputMode="numeric" placeholder="pulso" value={e.pulso ?? ""} onChange={(ev) => setNum("pulso", ev.target.value)} style={{ ...inp(T), width: "30%" }} />
          <input type="text" placeholder="presión 120/80" value={e.presion || ""} onChange={(ev) => set("presion", ev.target.value)} style={{ ...inp(T), width: "40%" }} />
          <input type="number" inputMode="decimal" placeholder="peso kg" value={e.peso ?? ""} onChange={(ev) => setNum("peso", ev.target.value)} style={{ ...inp(T), width: "30%" }} />
        </div>
      </div>
      <div>
        <div style={lbl(T)}>cambio de dosis / horario / otro evento</div>
        <input type="text" value={e.evento || ""} onChange={(ev) => set("evento", ev.target.value)} style={{ ...inp(T), width: "100%" }} />
      </div>
      <div>
        <div style={lbl(T)}>nota</div>
        <textarea value={e.nota || ""} onChange={(ev) => set("nota", ev.target.value)} style={{ ...inp(T), width: "100%", minHeight: 70, resize: "vertical", fontSize: 13 }} />
      </div>
    </div>
  );
}

const f1 = (v) => (v == null ? "—" : v.toFixed(1));
const pct = (v) => (v == null ? "—" : Math.round(v) + "%");

export function SeccionResumen({ T, diario, hoy, rango, setRango, escala, setEscala, cruzFor }) {
  const [aviso, setAviso] = React.useState("");
  const r = resumen(diario, hoy, rango);
  const cmp = compararToma(diario, hoy, rango, cruzFor);
  const pts = serie(diario, escala, hoy, rango);
  const texto = () => textoResumen(diario, hoy, rango, cruzFor);
  const ok = (m) => { setAviso(m); setTimeout(() => setAviso(""), 2500); };
  function copiar() {
    const t = texto();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => ok("copiado"), () => ok("no se pudo copiar"));
    else { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok("copiado"); } catch (_) { ok("no se pudo copiar"); } document.body.removeChild(ta); }
  }
  function descargar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto()], { type: "text/plain;charset=utf-8" }));
    a.download = `seguimiento-${hoy}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  const txt = { fontFamily: F_SANS, fontSize: 12, color: T.dim, lineHeight: 1.7 };
  return (
    <div style={col}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[7, 14, 28].map((n) => <button key={n} onClick={() => setRango(n)} style={chip(T, rango === n)}>{n} días</button>)}
        <div style={{ marginLeft: "auto", fontFamily: F_SANS, fontSize: 10, color: T.faint }}>{etiquetaDia(r.desde)} → {etiquetaDia(r.hasta)}</div>
      </div>
      {r.conRegistro === 0 ? (
        <div style={{ ...txt, textAlign: "center", padding: "10px 0" }}>sin registros en este rango</div>
      ) : (
        <>
          <div style={txt}>
            {r.conRegistro} de {r.diasEnRango} días con registro · {r.tomas} con toma · {r.sinToma} sin toma
            {r.protocolo > 0 && <div style={{ color: "#b26a00" }}>{r.protocolo} día(s) con protocolo Fadiman activo: puede confundir el efecto.</div>}
          </div>
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {[...ESCALAS, { k: "suenoCal", label: "Sueño" }].map(({ k, label }) => <button key={k} onClick={() => setEscala(k)} style={{ ...chip(T, escala === k), padding: "4px 10px", fontSize: 11 }}>{label}</button>)}
            </div>
            <Grafico T={T} pts={pts} />
            <div style={{ fontFamily: F_SANS, fontSize: 9, color: T.faint, marginTop: 4 }}>■ día con toma · ▲ evento/cambio</div>
          </div>
          <div>
            <div style={lbl(T)}>promedios (1–5)</div>
            {ESCALAS_RESUMEN.map(({ k, label }) => {
              const p = r.promedios[k];
              return p.n ? (
                <div key={k} style={{ display: "flex", ...txt, padding: "1px 0" }}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{ color: T.txt, fontWeight: 700 }}>{f1(p.avg)}</span>
                  <span style={{ color: T.faint, width: 100, textAlign: "right" }}>n={p.n}{p.base != null ? ` · base ${p.base}` : ""}</span>
                </div>
              ) : null;
            })}
            <div style={{ ...txt, marginTop: 6 }}>
              {r.suenoHoras != null && <div>sueño: {f1(r.suenoHoras)} h promedio</div>}
              {r.rebote != null && <div>rebote vespertino: {f1(r.rebote)} / 3</div>}
              {(r.efectoInicio || r.efectoFin) && <div>efecto percibido: ~{r.efectoInicio || "—"} a ~{r.efectoFin || "—"}</div>}
              {r.pulso != null && <div>pulso en reposo: {Math.round(r.pulso)}</div>}
            </div>
          </div>
          <div>
            <div style={lbl(T)}>efectos adversos</div>
            <div style={txt}>
              {EFECTOS.filter(({ k }) => r.efectos[k]).map(({ k, label }) => <div key={k} style={{ color: EFECTOS_ALERTA.includes(k) ? T.warn : T.dim }}>{label}: {r.efectos[k]} de {r.conRegistro} días</div>)}
              {EFECTOS.every(({ k }) => !r.efectos[k]) && !r.otros.length && <div style={{ color: T.faint }}>ninguno registrado</div>}
              {r.otros.map((o) => <div key={o.d}>{etiquetaDia(o.d)}: {o.t}</div>)}
            </div>
          </div>
          {r.eventos.length > 0 && (
            <div><div style={lbl(T)}>cambios / eventos</div><div style={txt}>{r.eventos.map((v) => <div key={v.d}>{etiquetaDia(v.d)}: {v.t}</div>)}</div></div>
          )}
          {cmp.con.n > 0 && cmp.sin.n > 0 && (
            <div>
              <div style={lbl(T)}>con toma vs. sin toma (orientativo, n chico)</div>
              <div style={txt}>
                <div>días: {cmp.con.n} vs {cmp.sin.n}</div>
                <div>foco: {f1(cmp.con.foco)} vs {f1(cmp.sin.foco)}</div>
                <div>tareas completadas: {pct(cmp.con.tareasPct)} vs {pct(cmp.sin.tareasPct)}</div>
                <div>estrés (índice Angst): {f1(cmp.con.estres)} vs {f1(cmp.sin.estres)}</div>
                <div>ejercicio: {pct(cmp.con.ejercicioPct)} vs {pct(cmp.sin.ejercicioPct)} de los días</div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={copiar} style={chip(T, false)}>copiar resumen</button>
            <button onClick={descargar} style={chip(T, false)}>descargar .txt</button>
            <span style={{ fontFamily: F_SANS, fontSize: 11, color: T.acc }}>{aviso}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function SeccionBase({ T, diario, setBase, setMg }) {
  return (
    <div style={col}>
      <div style={{ fontFamily: F_SANS, fontSize: 11, color: T.dim, lineHeight: 1.5 }}>Cómo estabas, en promedio, la semana previa al inicio. Solo sirve de referencia en el resumen.</div>
      {ESCALAS_RESUMEN.map(({ k, label }) => (
        <div key={k}><div style={lbl(T)}>{label}</div><Fila5 T={T} valor={diario.base && diario.base[k]} onPick={(n) => setBase(k, n)} /></div>
      ))}
      <div>
        <div style={lbl(T)}>dosis por defecto (mg)</div>
        <input type="number" inputMode="decimal" value={diario.cfg.mg} onChange={(ev) => setMg(ev.target.value)} style={{ ...inp(T), width: 90 }} />
      </div>
    </div>
  );
}
