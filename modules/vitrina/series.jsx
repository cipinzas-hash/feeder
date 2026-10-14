import { diasHasta, setCineItemEstado, useCineEstadoMap } from "./estado.js";
import { enqueueSimklAction } from "./simkl.js";
import { estadoEfectivo, marcarHastaAca, marcarTemporada, toggleEpisodio, useSerieEpisodios } from "./avance.js";

const { useState, useEffect, useRef } = React;

// Selector de temporada/episodio + contador de días para lo próximo.
// "Marcar hasta acá" = vas viendo la serie hasta ese punto -- manda
// status "watching" a Simkl (ver enqueueSimklAction), que internamente
// marca visto todo lo anterior, no solo el episodio puntual.
function SeriesProgreso({ item, progresoActual, onMarcar }) {
  const seasons = item.seasons;
  const [temporada, setTemporada] = useState(progresoActual?.temporada || seasons?.[0]?.numero || 1);
  const [episodio, setEpisodio] = useState(progresoActual?.episodio || 1);
  const seasonInfo = seasons?.find(s => s.numero === temporada);
  const maxEp = seasonInfo?.episodios || 99;
  const diasProximoEp = diasHasta(item.nextEpisodeDate);

  return (
    <div style={{ padding: "8px 10px", background: "#111", borderTop: "1px solid #1c1c1c" }}>
      {progresoActual && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#2ecc71", marginBottom: 6 }}>
          📺 vas por T{progresoActual.temporada}·E{progresoActual.episodio}
        </div>
      )}
      {diasProximoEp != null && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: diasProximoEp <= 0 ? "#2ecc71" : "#999", marginBottom: 6 }}>
          {diasProximoEp <= 0 ? "🆕 nuevo episodio ya disponible" : `📅 próximo episodio en ${diasProximoEp} día${diasProximoEp === 1 ? "" : "s"}`}
        </div>
      )}
      {seasons && seasons.length > 0 ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={temporada} onChange={e => { setTemporada(Number(e.target.value)); setEpisodio(1); }}
            style={{ background: "#1c1c1c", color: "#fff", border: "1px solid #333", borderRadius: 6, padding: "6px 8px", fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
            {seasons.map(s => <option key={s.numero} value={s.numero}>Temporada {s.numero}</option>)}
          </select>
          <select value={episodio} onChange={e => setEpisodio(Number(e.target.value))}
            style={{ background: "#1c1c1c", color: "#fff", border: "1px solid #333", borderRadius: 6, padding: "6px 8px", fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
            {Array.from({ length: maxEp }, (_, i) => i + 1).map(n => <option key={n} value={n}>Ep. {n}</option>)}
          </select>
          <button onClick={() => onMarcar(temporada, episodio)} style={{
            background: "#2ecc71", color: "#111", border: "none", borderRadius: 6, padding: "6px 12px",
            fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>marcar hasta acá</button>
        </div>
      ) : (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#666", fontStyle: "italic" }}>
          sin desglose de temporadas todavía -- se completa en la próxima actualización del catálogo
        </div>
      )}
    </div>
  );
}

// Seguimiento episodio por episodio (issue #13). Se muestra cuando
// avance.js ya tiene el catálogo de la serie (nombre y fecha de
// cada episodio, avance real de Simkl). Mientras no lo tenga, cae al
// selector simple de SeriesProgreso.
export function SeriesSeguimiento({ item, progresoActual, onMarcar }) {
  const { vista, entry, estadoCarga } = useSerieEpisodios(item.guid);
  // El catálogo de esta serie se baja al abrir la ficha: mientras llega, un aviso
  // en vez de mostrar un instante el selector simple y cambiarlo después.
  if (estadoCarga === "cargando" && entry?.catalogo) {
    return <div style={{ padding: "10px 12px", background: "#111", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#888" }}>cargando episodios…</div>;
  }
  if (vista && vista.total > 0) return <SeriesEpisodios item={item} vista={vista} inferido={!!entry?.epInferido} />;
  return <SeriesProgreso item={item} progresoActual={progresoActual} onMarcar={onMarcar} />;
}

function SeriesEpisodios({ item, vista, inferido }) {
  const cineEstado = useCineEstadoMap();
  const estado = estadoEfectivo(cineEstado, item.guid);
  const inicial = vista.siguiente?.t ?? vista.temporadas[vista.temporadas.length - 1]?.n;
  const [abiertas, setAbiertas] = useState(() => new Set(inicial != null ? [inicial] : []));
  const fuente = { fontFamily: "'DM Sans',sans-serif" };
  const diasProximo = vista.proximo?.fecha ? diasHasta(vista.proximo.fecha) : null;

  // Marcar episodios implica que la estás viendo: si no tenía marca local,
  // pasa a "interesa" (copia completa, para sobrevivir a la poda de 30 días).
  function actuar(fn) {
    if (estado === "sin_marca") setCineItemEstado(item.guid, { estado: "interesa", item });
    fn();
  }
  function alternar(n) {
    setAbiertas(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  }
  const btnMini = (activo) => ({
    background: "transparent", border: "1px solid " + (activo ? "#2ecc71" : "#333"), color: activo ? "#2ecc71" : "#888",
    borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", ...fuente,
  });

  return (
    <div style={{ padding: "8px 10px", background: "#111", borderTop: "1px solid #1c1c1c" }}>
      <div style={{ ...fuente, fontSize: 12, color: "#ddd", marginBottom: 4 }}>
        📺 {vista.vistos}/{vista.emitidos} vistos
        {" · "}
        {vista.pendientes > 0
          ? <span style={{ color: "#f5c518", fontWeight: 700 }}>{vista.pendientes} pendiente{vista.pendientes === 1 ? "" : "s"}</span>
          : <span style={{ color: "#2ecc71", fontWeight: 700 }}>al día ✓</span>}
      </div>
      {inferido && (
        <div style={{ ...fuente, fontSize: 10, color: "#888", fontStyle: "italic", marginBottom: 4 }}>
          ⓘ Simkl no entrega el detalle por episodio de esta serie: el avance se reconstruyó desde el último episodio visto.
        </div>
      )}
      {vista.siguiente && (
        <div style={{ ...fuente, fontSize: 11, color: "#2ecc71", marginBottom: 4 }}>
          ▶ siguiente: T{vista.siguiente.t}·E{vista.siguiente.e}{vista.siguiente.nombre ? ` — ${vista.siguiente.nombre}` : ""}
        </div>
      )}
      {vista.proximo && (
        <div style={{ ...fuente, fontSize: 11, color: "#999", marginBottom: 4 }}>
          📅 próximo: T{vista.proximo.t}·E{vista.proximo.e}{vista.proximo.nombre ? ` — ${vista.proximo.nombre}` : ""}
          {diasProximo != null ? (diasProximo <= 0 ? " (hoy)" : ` (en ${diasProximo} día${diasProximo === 1 ? "" : "s"})`) : ""}
        </div>
      )}
      <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 6, border: "1px solid #1c1c1c", borderRadius: 8 }}>
        {vista.temporadas.map(t => {
          const abierta = abiertas.has(t.n);
          const completa = t.vistos === t.total;
          return (
            <div key={t.n}>
              <div onClick={() => alternar(t.n)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#161616", cursor: "pointer", borderBottom: "1px solid #1c1c1c" }}>
                <span style={{ ...fuente, fontSize: 11, color: "#888", width: 10 }}>{abierta ? "▾" : "▸"}</span>
                <span style={{ ...fuente, fontSize: 12, color: "#fff", fontWeight: 600, flex: 1 }}>
                  Temporada {t.n}
                  <span style={{ color: completa ? "#2ecc71" : "#888", fontWeight: 400, marginLeft: 8 }}>{t.vistos}/{t.total}</span>
                  {t.pendientes > 0 && <span style={{ color: "#f5c518", fontWeight: 400, marginLeft: 6 }}>· {t.pendientes} pend.</span>}
                </span>
                <button onClick={e => { e.stopPropagation(); actuar(() => marcarTemporada(item, vista, t.n, true)); }} style={btnMini(false)} title="marcar toda la temporada (solo los emitidos)">✓ todo</button>
                <button onClick={e => { e.stopPropagation(); actuar(() => marcarTemporada(item, vista, t.n, false)); }} style={btnMini(false)} title="desmarcar la temporada">↺ nada</button>
              </div>
              {abierta && t.eps.map(x => (
                <div key={x.e} onClick={() => x.emitido && actuar(() => toggleEpisodio(item, t.n, x.e, x.visto))}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "1px solid #181818", cursor: x.emitido ? "pointer" : "default", opacity: x.emitido ? 1 : 0.4 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid " + (x.visto ? "#2ecc71" : "#444"), background: x.visto ? "#2ecc71" : "transparent", color: "#111", fontSize: 12, fontWeight: 700,
                  }}>{x.visto ? "✓" : ""}</span>
                  <span style={{ ...fuente, fontSize: 11, color: "#888", width: 28, flexShrink: 0 }}>E{x.e}</span>
                  <span style={{ ...fuente, fontSize: 12, color: x.visto ? "#777" : "#eee", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre || `Episodio ${x.e}`}</span>
                  {!x.emitido && <span style={{ ...fuente, fontSize: 10, color: "#888", flexShrink: 0 }}>{x.fecha ? `sale ${x.fecha}` : "sin fecha"}</span>}
                  {x.emitido && !x.visto && (
                    <button onClick={e => { e.stopPropagation(); actuar(() => marcarHastaAca(item, vista, t.n, x.e)); }} style={btnMini(false)} title="marcar como visto todo lo anterior y este">⤓ hasta acá</button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
