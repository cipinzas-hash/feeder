import {
  ESCALAS, EFECTOS, REBOTE, EFECTOS_ALERTA,
  leerDiario, conCampo, conBase, alternarEfecto, hayAlerta,
  claveLocal, horaLocal, sumarDias, serie, resumen, compararToma, textoResumen,
} from "./diarioModel.js";

const C = { fg: "#fff", dim: "#555", faint: "#444", line: "#333", panel: "#1a1a1a", acc: "#aac756", warn: "#e53935" };
const sans = "'DM Sans',sans-serif";
const cav = "'Caveat',cursive";
const lbl = { fontFamily: sans, fontSize: 10, color: C.faint, letterSpacing: 1, marginBottom: 6 };
const inp = { fontFamily: sans, fontSize: 14, background: C.panel, border: `1px dashed ${C.line}`, color: "#ddd", borderRadius: 8, padding: "8px 10px", outline: "none", boxSizing: "border-box" };
const btn = (on) => ({ background: on ? C.acc : "transparent", color: on ? "#111" : C.acc, border: `1px dashed ${C.acc}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontFamily: sans, fontSize: 12 });


function Seccion({ t, children }) { return (
  <div>
    <div style={{ ...lbl, color: C.dim, marginBottom: 10 }}>{t}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
  </div>
); }
function Fila5({ valor, onPick, desde = 1 }) { return (
  <div style={{ display: "flex", gap: 4 }}>
    {Array.from({ length: 5 - desde + 1 }, (_, i) => i + desde).map((n) => {
      const on = (valor || 0) >= n;
      return (
        <button key={n} onClick={() => onPick(n === valor ? null : n)}
          style={{ flex: 1, background: on ? "#fff" : C.panel, border: `1px dashed ${on ? "#fff" : C.line}`, borderRadius: 6, padding: "8px 4px", cursor: "pointer", fontFamily: cav, fontSize: 18, color: on ? "#111" : C.dim }}>{n}</button>
      );
    })}
  </div>
); }

function Grafico({ pts }) {
  const W = 300, H = 110, X0 = 14, X1 = W - 6, Y0 = 8, Y1 = 90;
  const x = (i) => X0 + (pts.length === 1 ? 0 : (i * (X1 - X0)) / (pts.length - 1));
  const y = (v) => Y1 - ((v - 1) / 4) * (Y1 - Y0);
  const tramos = []; let cur = [];
  pts.forEach((p, i) => { if (p.v != null) cur.push([x(i), y(p.v)]); else if (cur.length) { tramos.push(cur); cur = []; } });
  if (cur.length) tramos.push(cur);
  const hay = pts.some((p) => p.v != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", background: "#111", borderRadius: 8 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="#1f1f1f" strokeWidth="1" />
          <text x={2} y={y(v) + 3} fontSize="8" fill="#444" fontFamily="DM Sans">{v}</text>
        </g>
      ))}
      {tramos.map((t, i) => <polyline key={i} points={t.map((p) => p.join(",")).join(" ")} fill="none" stroke={C.acc} strokeWidth="1.6" />)}
      {pts.map((p, i) => p.v != null && <circle key={i} cx={x(i)} cy={y(p.v)} r="2.4" fill={C.acc} />)}
      {pts.map((p, i) => p.tomo && <rect key={"t" + i} x={x(i) - 2} y={H - 14} width="4" height="4" fill="#fff" />)}
      {pts.map((p, i) => p.evento && <text key={"e" + i} x={x(i) - 3} y={H - 3} fontSize="8" fill="#f5a623">▲</text>)}
      {!hay && <text x={W / 2} y={H / 2} fontSize="10" fill="#555" textAnchor="middle" fontFamily="DM Sans">sin datos de esta escala</text>}
    </svg>
  );
}


// Diario de seguimiento. Vive dentro de fadimanData.fadimanDiario (ver diarioModel.js).
// Props:
//   data, saveData  — igual que FadimanPage (saveData recibe el fadimanData completo)
//   protocoloDe(k)  — "dose" | "rest" | "done" | null según el protocolo Fadiman
//   cruzFor(k)      — {estres, tareasHechas, tareasTotal, ejercicio} | null (datos de Angst)
//   onBack()        — volver a la pantalla de Fadiman
function DiarioFadiman({ data, saveData, protocoloDe, cruzFor, onBack }) {
  const hoy = claveLocal();
  const [tab, setTab] = React.useState("dia");
  const [fecha, setFecha] = React.useState(hoy);
  const [rango, setRango] = React.useState(14);
  const [escala, setEscala] = React.useState("foco");
  const [verBase, setVerBase] = React.useState(false);
  const [aviso, setAviso] = React.useState("");

  const diario = leerDiario(data);
  const e = diario.dias[fecha] || {};
  const esProtocolo = protocoloDe ? protocoloDe(fecha) === "dose" : false;

  function guardar(nuevo) { saveData({ ...data, fadimanDiario: nuevo }); }
  function set(campo, valor) { guardar(conCampo(diario, fecha, campo, valor, esProtocolo)); }
  function setNum(campo, txt) { set(campo, txt === "" ? null : parseFloat(txt)); }
  function setBase(campo, valor) { guardar(conBase(diario, campo, valor)); }
  function setMg(txt) { guardar({ ...diario, cfg: { ...diario.cfg, mg: txt === "" ? 10 : parseFloat(txt) } }); }

  function marcarToma() {
    if (e.tomo) { set("tomo", false); return; }
    let d = conCampo(diario, fecha, "tomo", true, esProtocolo);
    if (!e.hora && fecha === hoy) d = conCampo(d, fecha, "hora", horaLocal(), esProtocolo);
    if (!e.mg) d = conCampo(d, fecha, "mg", diario.cfg.mg, esProtocolo);
    guardar(d);
  }

  const fmtDia = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    const MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d} ${MES[m]}`;
  };

  // ── Resumen ──
  const r = resumen(diario, hoy, rango);
  const cmp = compararToma(diario, hoy, rango, cruzFor);
  const pts = serie(diario, escala, hoy, rango);

  function copiar() {
    const t = textoResumen(diario, hoy, rango, cruzFor);
    const ok = () => { setAviso("copiado"); setTimeout(() => setAviso(""), 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => setAviso("no se pudo copiar"));
    else { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (_) { setAviso("no se pudo copiar"); } document.body.removeChild(ta); }
  }
  function descargar() {
    const t = textoResumen(diario, hoy, rango, cruzFor);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/plain;charset=utf-8" }));
    a.download = `seguimiento-${hoy}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  const cruz = cruzFor ? cruzFor(fecha) : null;
  const pctF = (v) => (v == null ? "—" : Math.round(v) + "%");
  const f1 = (v) => (v == null ? "—" : v.toFixed(1));

  return (
    <div style={{ background: "#0d0d0d", color: C.fg }}>
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1a1a" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.dim, fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ fontFamily: cav, fontSize: 22, fontWeight: 700 }}>📓 diario</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["dia", "resumen"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={btn(tab === t)}>{t === "dia" ? "día" : "resumen"}</button>
          ))}
        </div>
      </div>

      {tab === "dia" && (
        <div style={{ padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setFecha(sumarDias(fecha, -1))} style={btn(false)}>◀</button>
            <input type="date" value={fecha} onChange={(ev) => ev.target.value && setFecha(ev.target.value)} style={{ ...inp, flex: 1, fontSize: 13 }} />
            <button onClick={() => setFecha(sumarDias(fecha, 1))} style={btn(false)}>▶</button>
          </div>
          {(esProtocolo || cruz) && (
            <div style={{ fontFamily: sans, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
              {esProtocolo && <div style={{ color: C.acc }}>🍄 día de dosis Fadiman</div>}
              {cruz && (
                <div>
                  {fmtDia(fecha)} en Angst:
                  {cruz.tareasTotal > 0 ? ` tareas ${cruz.tareasHechas}/${cruz.tareasTotal}` : " sin tareas"}
                  {typeof cruz.estres === "number" ? ` · estrés ${cruz.estres}` : ""}
                  {cruz.ejercicio != null ? ` · ejercicio ${cruz.ejercicio ? "✓" : "—"}` : ""}
                </div>
              )}
            </div>
          )}

          <Seccion t="MAÑANA">
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: e.tomo ? "#1a2200" : C.panel, border: `1px solid ${e.tomo ? C.acc : C.line}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ flex: 1, fontFamily: sans, fontSize: 13, color: e.tomo ? C.acc : "#aaa" }}>toma de hoy</div>
              <button onClick={marcarToma} style={btn(!!e.tomo)}>{e.tomo ? "✓ tomada" : "marcar"}</button>
            </div>
            {e.tomo && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div><div style={lbl}>HORA</div><input type="time" value={e.hora || ""} onChange={(ev) => set("hora", ev.target.value)} style={{ ...inp, width: 110 }} /></div>
                <div><div style={lbl}>MG</div><input type="number" inputMode="decimal" value={e.mg ?? ""} onChange={(ev) => setNum("mg", ev.target.value)} style={{ ...inp, width: 70 }} /></div>
                <button onClick={() => set("comida", !e.comida)} style={{ ...btn(!!e.comida), height: 36 }}>{e.comida ? "con comida" : "en ayunas"}</button>
              </div>
            )}
            <div>
              <div style={lbl}>SUEÑO DE ANOCHE</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input type="time" value={e.suenoHora || ""} onChange={(ev) => set("suenoHora", ev.target.value)} style={{ ...inp, width: 110 }} aria-label="hora de dormir" />
                <input type="number" inputMode="decimal" step="0.5" placeholder="horas" value={e.suenoHoras ?? ""} onChange={(ev) => setNum("suenoHoras", ev.target.value)} style={{ ...inp, width: 80 }} />
              </div>
              <Fila5 valor={e.suenoCal} onPick={(n) => set("suenoCal", n)} />
            </div>
          </Seccion>

          <Seccion t="CIERRE DEL DÍA">
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><div style={lbl}>SE NOTA DESDE</div><input type="time" value={e.efIni || ""} onChange={(ev) => set("efIni", ev.target.value)} style={{ ...inp, width: "100%" }} /></div>
              <div style={{ flex: 1 }}><div style={lbl}>SE VA HACIA</div><input type="time" value={e.efFin || ""} onChange={(ev) => set("efFin", ev.target.value)} style={{ ...inp, width: "100%" }} /></div>
            </div>
            <div style={{ fontFamily: sans, fontSize: 10, color: C.faint }}>escalas: 1 = nada · 5 = mucho</div>
            {ESCALAS.map(({ k, label }) => (
              <div key={k}><div style={lbl}>{label.toUpperCase()}</div><Fila5 valor={e[k]} onPick={(n) => set(k, n)} /></div>
            ))}
            <div>
              <div style={lbl}>REBOTE VESPERTINO</div>
              <div style={{ display: "flex", gap: 4 }}>
                {REBOTE.map((t, i) => (
                  <button key={t} onClick={() => set("rebote", e.rebote === i ? null : i)} style={{ ...btn(e.rebote === i), flex: 1, padding: "8px 2px" }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={lbl}>EFECTOS ADVERSOS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EFECTOS.map(({ k, label }) => {
                  const on = (e.efectos || []).includes(k);
                  const al = EFECTOS_ALERTA.includes(k);
                  return (
                    <button key={k} onClick={() => set("efectos", alternarEfecto(e, k))}
                      style={{ background: on ? (al ? C.warn : C.acc) : "transparent", color: on ? "#111" : (al ? C.warn : "#888"), border: `1px dashed ${al ? C.warn : C.line}`, borderRadius: 14, padding: "5px 11px", cursor: "pointer", fontFamily: sans, fontSize: 12 }}>{label}</button>
                  );
                })}
              </div>
              <input type="text" placeholder="otro…" value={e.efectoOtro || ""} onChange={(ev) => set("efectoOtro", ev.target.value)} style={{ ...inp, width: "100%", marginTop: 8 }} />
              {hayAlerta(e) && (
                <div style={{ fontFamily: sans, fontSize: 12, color: C.warn, marginTop: 8, lineHeight: 1.5, border: `1px solid ${C.warn}`, borderRadius: 8, padding: "8px 10px" }}>
                  Si las palpitaciones son fuertes, no ceden, o hay dolor de pecho, contacta a tu médico o ve a urgencias.
                </div>
              )}
            </div>
            <div>
              <div style={lbl}>MEDIDAS (OPCIONAL)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" inputMode="numeric" placeholder="pulso" value={e.pulso ?? ""} onChange={(ev) => setNum("pulso", ev.target.value)} style={{ ...inp, width: "33%" }} />
                <input type="text" placeholder="presión 120/80" value={e.presion || ""} onChange={(ev) => set("presion", ev.target.value)} style={{ ...inp, width: "37%" }} />
                <input type="number" inputMode="decimal" placeholder="peso kg" value={e.peso ?? ""} onChange={(ev) => setNum("peso", ev.target.value)} style={{ ...inp, width: "30%" }} />
              </div>
            </div>
            <div>
              <div style={lbl}>CAMBIO DE DOSIS / HORARIO / OTRO EVENTO</div>
              <input type="text" value={e.evento || ""} onChange={(ev) => set("evento", ev.target.value)} style={{ ...inp, width: "100%" }} />
            </div>
            <div>
              <div style={lbl}>NOTA</div>
              <textarea value={e.nota || ""} onChange={(ev) => set("nota", ev.target.value)} style={{ ...inp, width: "100%", minHeight: 70, resize: "vertical", fontSize: 13 }} />
            </div>
          </Seccion>
        </div>
      )}

      {tab === "resumen" && (
        <div style={{ padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[7, 14, 28].map((n) => <button key={n} onClick={() => setRango(n)} style={btn(rango === n)}>{n} días</button>)}
            <div style={{ marginLeft: "auto", fontFamily: sans, fontSize: 10, color: C.faint }}>{fmtDia(r.desde)} → {fmtDia(r.hasta)}</div>
          </div>

          {r.conRegistro === 0 ? (
            <div style={{ fontFamily: sans, fontSize: 13, color: C.dim, lineHeight: 1.6 }}>Aún no hay registros en este rango. Empieza por la pestaña “día”.</div>
          ) : (
            <>
              <div style={{ fontFamily: sans, fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>
                {r.conRegistro} de {r.diasEnRango} días con registro · {r.tomas} con toma · {r.sinToma} sin toma
                {r.protocolo > 0 && <div style={{ color: "#f5a623" }}>{r.protocolo} día(s) con protocolo Fadiman activo: puede confundir el efecto.</div>}
              </div>

              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {[...ESCALAS, { k: "suenoCal", label: "Sueño" }].map(({ k, label }) => <button key={k} onClick={() => setEscala(k)} style={{ ...btn(escala === k), padding: "4px 10px", fontSize: 11 }}>{label}</button>)}
                </div>
                <Grafico pts={pts} />
                <div style={{ fontFamily: sans, fontSize: 9, color: C.faint, marginTop: 4 }}>■ día con toma · ▲ evento/cambio</div>
              </div>

              <div>
                <div style={lbl}>PROMEDIOS (1–5)</div>
                {[...ESCALAS, { k: "suenoCal", label: "Calidad de sueño" }].map(({ k, label }) => {
                  const p = r.promedios[k];
                  return p.n ? (
                    <div key={k} style={{ display: "flex", fontFamily: sans, fontSize: 12, color: "#aaa", padding: "3px 0" }}>
                      <span style={{ flex: 1 }}>{label}</span>
                      <span style={{ color: C.acc }}>{f1(p.avg)}</span>
                      <span style={{ color: C.faint, width: 90, textAlign: "right" }}>n={p.n}{p.base != null ? ` · base ${p.base}` : ""}</span>
                    </div>
                  ) : null;
                })}
                <div style={{ fontFamily: sans, fontSize: 12, color: "#888", marginTop: 8, lineHeight: 1.7 }}>
                  {r.suenoHoras != null && <div>sueño: {f1(r.suenoHoras)} h promedio</div>}
                  {r.rebote != null && <div>rebote vespertino: {f1(r.rebote)} / 3</div>}
                  {(r.efectoInicio || r.efectoFin) && <div>efecto percibido: ~{r.efectoInicio || "—"} a ~{r.efectoFin || "—"}</div>}
                  {r.pulso != null && <div>pulso en reposo: {Math.round(r.pulso)}</div>}
                </div>
              </div>

              <div>
                <div style={lbl}>EFECTOS ADVERSOS</div>
                <div style={{ fontFamily: sans, fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>
                  {EFECTOS.filter(({ k }) => r.efectos[k]).map(({ k, label }) => <div key={k} style={{ color: EFECTOS_ALERTA.includes(k) ? C.warn : "#aaa" }}>{label}: {r.efectos[k]} de {r.conRegistro} días</div>)}
                  {EFECTOS.every(({ k }) => !r.efectos[k]) && !r.otros.length && <div style={{ color: C.dim }}>ninguno registrado</div>}
                  {r.otros.map((o) => <div key={o.d}>{fmtDia(o.d)}: {o.t}</div>)}
                </div>
              </div>

              {r.eventos.length > 0 && (
                <div>
                  <div style={lbl}>CAMBIOS / EVENTOS</div>
                  <div style={{ fontFamily: sans, fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>{r.eventos.map((v) => <div key={v.d}>{fmtDia(v.d)}: {v.t}</div>)}</div>
                </div>
              )}

              {cmp.con.n > 0 && cmp.sin.n > 0 && (
                <div>
                  <div style={lbl}>CON TOMA vs. SIN TOMA (orientativo, n chico)</div>
                  <div style={{ fontFamily: sans, fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>
                    <div>días: {cmp.con.n} vs {cmp.sin.n}</div>
                    <div>foco: {f1(cmp.con.foco)} vs {f1(cmp.sin.foco)}</div>
                    <div>tareas completadas: {pctF(cmp.con.tareasPct)} vs {pctF(cmp.sin.tareasPct)}</div>
                    <div>estrés (índice Angst): {f1(cmp.con.estres)} vs {f1(cmp.sin.estres)}</div>
                    <div>ejercicio: {pctF(cmp.con.ejercicioPct)} vs {pctF(cmp.sin.ejercicioPct)} de los días</div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={copiar} style={btn(false)}>copiar resumen</button>
                <button onClick={descargar} style={btn(false)}>descargar .txt</button>
                <span style={{ fontFamily: sans, fontSize: 11, color: C.acc }}>{aviso}</span>
              </div>
            </>
          )}

          <div>
            <button onClick={() => setVerBase(!verBase)} style={{ ...btn(false), color: "#888", borderColor: C.line }}>{verBase ? "▾" : "▸"} línea base (la semana previa al inicio)</button>
            {verBase && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontFamily: sans, fontSize: 11, color: C.dim, lineHeight: 1.5 }}>Cómo estabas, en promedio, antes de empezar. Se usa solo como referencia en el resumen.</div>
                {[...ESCALAS, { k: "suenoCal", label: "Calidad de sueño" }].map(({ k, label }) => (
                  <div key={k}><div style={lbl}>{label.toUpperCase()}</div><Fila5 valor={diario.base && diario.base[k]} onPick={(n) => setBase(k, n)} /></div>
                ))}
                <div>
                  <div style={lbl}>DOSIS POR DEFECTO (MG)</div>
                  <input type="number" inputMode="decimal" value={diario.cfg.mg} onChange={(ev) => setMg(ev.target.value)} style={{ ...inp, width: 90 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiarioFadiman;
