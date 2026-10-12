const { useState, useEffect, useRef } = React;


// ─── Ícono de personaje de Melee. Reemplaza la foto de perfil de start.gg
// (PlayerAvatar tenía un fallback "foto o silueta genérica", pero
// entrantFace() en build-melee.mjs es un stub que siempre devuelve null
// -- se sacó a propósito por el costo de query que tenía, ver comentario
// ahí. El resultado real era: silueta genérica el 100% de las veces,
// nunca una excepción. El personaje (.pj) en cambio SÍ viene siempre que
// el set ya se jugó -- mismo query, gratis, sin request nueva -- y es
// más relevante que una cara en este contexto igual. Roster fijo de
// Melee (26 personajes, no cambia nunca) así que un mapeo estático
// alcanza, sin necesidad de ningún ícono/imagen cargado por red.
const CHARACTER_ICONS = {
  "Fox": { ab: "FOX", bg: "#8a8a8a" }, "Falco": { ab: "FAL", bg: "#3f6fd1" },
  "Marth": { ab: "MTH", bg: "#2f5fc4" }, "Sheik": { ab: "SHK", bg: "#8a8478" },
  "Jigglypuff": { ab: "PUF", bg: "#e87fb0" }, "Captain Falcon": { ab: "CF", bg: "#d1432f" },
  "Peach": { ab: "PCH", bg: "#f2a6c6" }, "Ice Climbers": { ab: "ICS", bg: "#5c9cff" }, "IceClimbers": { ab: "ICS", bg: "#5c9cff" },
  "Doctor Mario": { ab: "DOC", bg: "#e8e8e8" }, "Dr. Mario": { ab: "DOC", bg: "#e8e8e8" },
  "Young Link": { ab: "YL", bg: "#4caf7d" }, "Ganondorf": { ab: "GAN", bg: "#6b4f8a" },
  "Mr. Game & Watch": { ab: "G&W", bg: "#2a2a2a" }, "Game & Watch": { ab: "G&W", bg: "#2a2a2a" }, "Roy": { ab: "ROY", bg: "#c4432f" },
  "Pichu": { ab: "PIC", bg: "#f2d13a" }, "Mewtwo": { ab: "MTW", bg: "#9a6fc4" },
  "Luigi": { ab: "LUI", bg: "#3f9c5c" }, "Mario": { ab: "MAR", bg: "#d1432f" },
  "Yoshi": { ab: "YSH", bg: "#4caf7d" }, "Donkey Kong": { ab: "DK", bg: "#8a5c3f" },
  "Bowser": { ab: "BOW", bg: "#3f9c5c" }, "Zelda": { ab: "ZEL", bg: "#8a6fc4" },
  "Link": { ab: "LNK", bg: "#3f9c5c" }, "Ness": { ab: "NES", bg: "#d1432f" },
  "Samus": { ab: "SAM", bg: "#e88a3a" }, "Kirby": { ab: "KRB", bg: "#f2a6c6" },
  "Pikachu": { ab: "PIK", bg: "#f2d13a" }, "Zelda/Sheik": { ab: "Z/S", bg: "#8a6fc4" },
};
// ─── Sponsor/team fuera de la vitrina -- mismo criterio que
// stripSponsorTag en build-melee.mjs (se queda con lo que hay después de
// la ÚLTIMA barra vertical), pero acá corre sobre nombres que en algunos
// items viejos ya vienen sin tag y en otros no -- por eso vive acá
// también en vez de sacarlo una sola vez en el backend: los items ya
// generados antes de este cambio (guardados en melee.json) siguen
// teniendo el nombre completo, así que esto los limpia en el momento de
// mostrarlos sin necesidad de tocar ni reprocesar datos viejos.
function stripSponsorTag(name) {
  if (!name) return name;
  const idx = name.lastIndexOf("|");
  return idx === -1 ? name.trim() : name.slice(idx + 1).trim();
}

function CharIcon({ pj, size = 40, juegosGanados = null }) {
  const c = pj ? CHARACTER_ICONS[pj] : null;
  const badge = juegosGanados != null && (
    <div style={{
      position: "absolute", bottom: -3, right: -3, minWidth: 15, height: 15,
      borderRadius: 8, background: "#111", border: "1px solid #444",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800, color: "#fff", padding: "0 3px", lineHeight: 1,
    }}>{juegosGanados}</div>
  );
  if (!c) return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.55, color: "#555",
      }}>👤</div>
      {badge}
    </div>
  );
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div title={pj} style={{
        width: size, height: size, borderRadius: "50%",
        background: c.bg, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.26, fontWeight: 800, color: "#111", fontFamily: "'DM Sans',sans-serif", letterSpacing: -0.3,
      }}>{c.ab}</div>
      {badge}
    </div>
  );
}

// ─── vistos de clips del VOD permanente — mismo patrón que Microdocs
// (localStorage, clave propia y aislada).
const MELEE_VOD_VISTOS_KEY = "angst-feed-melee-vod-vistos-v1";
function loadMeleeVodVistos() {
  try {
    const raw = localStorage.getItem(MELEE_VOD_VISTOS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) { return new Set(); }
}
function saveMeleeVodVistos(set) {
  try { localStorage.setItem(MELEE_VOD_VISTOS_KEY, JSON.stringify([...set])); } catch (e) {}
}

function MeleeMatchup({ item }) {
  const g = item.ganador, p = item.perdedor;
  if (!g || !p) {
    // Items viejos generados antes de este cambio no tienen ganador/perdedor
    // estructurado — se cae al título plano para no romper nada.
    return <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#ccc" }}>{item.title}</div>;
  }
  // Etiqueta: seed del torneo si existe, si no SSBMRank (upset detectado
  // sin seeding local confiable), si no ninguna -- nunca "[null]".
  const etiquetaJugador = (j) => j.seed != null ? `[${j.seed}]` : j.ssbmrank != null ? `[SSBMRank #${j.ssbmrank}]` : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <CharIcon pj={g.pj} juegosGanados={g.juegosGanados} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "#4caf7d" }}>
          {stripSponsorTag(g.nombre)} <span style={{ color: "#999", fontWeight: 400 }}>{etiquetaJugador(g)}{g.pj ? ` · ${g.pj}` : ""}</span>
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginTop: 2 }}>
          <span style={{ color: "#777" }}>venció a </span><span style={{ color: "#e05a5a", fontWeight: 700 }}>{stripSponsorTag(p.nombre)}</span><span style={{ color: "#777" }}> {etiquetaJugador(p)}{p.pj ? ` · ${p.pj}` : ""}</span>
          {item.viaSSBMRank && <span style={{ color: "#ff6600" }}> · vía SSBMRank</span>}
        </div>
      </div>
      <CharIcon pj={p.pj} size={30} juegosGanados={p.juegosGanados} />
    </div>
  );
}

// ─── MeleeFeed — Melee dentro de Vitrina, agrupado por torneo (carpeta
// expandible) en vez de la lista plana que vivía en el swipe de Noticias.
// Cada torneo puede tener: preview de Top 8 (esTop8Preview, solo mientras
// sigue en curso), upsets sueltos, y el archivo final permanente
// (esArchivo) una vez que termina — ese es el que se muestra primero
// cuando está disponible, como resumen.
export function MeleeFeed({ items }) {
  const [openTournament, setOpenTournament] = useState(null);
  const [vodVistos, setVodVistos] = useState(() => loadMeleeVodVistos());
  // Antes "collapsedSections" (colapsado explícito, default expandido).
  // Cristopher pidió que arranquen minimizadas -- se invierte a
  // "openSections" (expandido explícito, default colapsado) en vez de
  // pre-cargar todos los sectionKey posibles (dependen de `nombre`, no
  // se conocen hasta el render).
  const [openSections, setOpenSections] = useState(() => new Set());
  function toggleSection(key) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleVodVisto(guid) {
    setVodVistos(prev => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid); else next.add(guid);
      saveMeleeVodVistos(next);
      return next;
    });
  }
  const torneos = {};
  for (const it of items) {
    (torneos[it.source] = torneos[it.source] || []).push(it);
  }
  const nombres = Object.keys(torneos);
  // Torneos con archivo (terminados) primero, más recientes arriba.
  nombres.sort((a, b) => {
    const aArchivo = torneos[a].some(i => i.esArchivo);
    const bArchivo = torneos[b].some(i => i.esArchivo);
    if (aArchivo !== bArchivo) return aArchivo ? -1 : 1;
    const aDate = Math.max(...torneos[a].map(i => (i.pubDate ? new Date(i.pubDate).getTime() : 0)));
    const bDate = Math.max(...torneos[b].map(i => (i.pubDate ? new Date(i.pubDate).getTime() : 0)));
    return bDate - aDate;
  });

  if (!nombres.length) {
    return (
      <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
        nada por acá todavía
      </div>
    );
  }

  return (
    <div style={{ padding: "6px 18px 30px" }}>
      {nombres.map(nombre => {
        const grupo = torneos[nombre];
        const archivo = grupo.find(i => i.esArchivo);
        const top16 = grupo.find(i => i.esTop16Preview);
        const top8 = grupo.find(i => i.esTop8Preview);
        const hype = grupo.find(i => i.esHype);
        const proyeccion = grupo.find(i => i.esProyeccion);
        const seedReport = grupo.find(i => i.esSeedReport);
        const upsets = grupo.filter(i => !i.esArchivo && !i.esTop16Preview && !i.esTop8Preview && !i.esHype && !i.esProyeccion && !i.esSeedReport);
        const open = openTournament === nombre;
        const estado = archivo ? "finalizado" : top8 ? "en Top 8" : top16 ? "en Top 16" : (seedReport ? "en curso" : (upsets.length ? "en curso" : "próximamente"));
        // Pendientes sin ver de TODO el torneo (Top 8 + Upsets + Doc),
        // visible en el header de la carpeta sin necesidad de abrirla --
        // así un set nuevo que se terminó de encontrar en una corrida
        // posterior (sobre todo Top 8, que sube tarde) queda a la vista
        // como "esperando", no enterrado adentro de una sección colapsada.
        const pendientesTorneo = archivo
          ? [...(archivo.top8Clips || []), ...(archivo.upsetClips || []), ...(archivo.docClips || [])].filter(c => !vodVistos.has(c.guid)).length
          : 0;
        // Hora Chile del Top 8 + link de stream: puede venir de hype (pre-torneo)
        // o de top16/top8/seedReport (torneo en curso) — el que esté disponible primero.
        const liveInfo = top8 || top16 || seedReport || hype;
        return (
          <div key={nombre} style={{ marginBottom: 10, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setOpenTournament(open ? null : nombre)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", background: "rgba(255,102,0,0.06)", border: "none", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: "#fff" }}>{nombre}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {pendientesTorneo > 0 && (
                  <span style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: "#111",
                    background: "#ff6600", borderRadius: 10, padding: "2px 8px",
                  }}>{pendientesTorneo} sin ver</span>
                )}
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: "#ff6600" }}>{estado.toUpperCase()} {open ? "▲" : "▼"}</div>
              </div>
            </button>
            {open && (
              <div style={{ padding: "14px 16px" }}>
                {!archivo && (liveInfo?.top8StartAt || liveInfo?.streamUrl) && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                    {liveInfo.top8StartAt && (
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#ddd" }}>
                        🕗 Top 8: {new Date(liveInfo.top8StartAt * 1000).toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} (hora Chile)
                      </div>
                    )}
                    {liveInfo.streamUrl && (
                      <a href={liveInfo.streamUrl} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: "#ff6600" }}>
                        📡 ver stream ↗
                      </a>
                    )}
                  </div>
                )}
                {!archivo && (hype || proyeccion) && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 6 }}>PRÓXIMAMENTE</div>
                    {hype && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#ddd", lineHeight: 1.6 }}>{hype.summary}</div>}
                    {hype?.startAt && (
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#999", marginTop: 4 }}>
                        {new Date(hype.startAt * 1000).toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (hora Chile)
                      </div>
                    )}
                    {proyeccion && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#ddd", lineHeight: 1.6, marginTop: hype ? 8 : 0 }}>{proyeccion.summary}</div>}
                    {hype?.notableEntrants?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 6 }}>ENTRANTS DESTACADOS</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                          {hype.notableEntrants.map(e => (
                            <div key={e.seed} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#ddd" }}>
                              <span style={{ color: "#ff6600", fontWeight: 700 }}>[{e.seed}]</span> {stripSponsorTag(e.nombre)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <a href={(hype || proyeccion).link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#ff6600", display: "inline-block", marginTop: 8 }}>
                      ver bracket ↗
                    </a>
                  </div>
                )}
                {archivo && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 6 }}>RESULTADO FINAL</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#ddd", lineHeight: 1.6 }}>{archivo.summary}</div>
                    {archivo.videoId && (
                      <a href={`https://youtube.com/watch?v=${archivo.videoId}${archivo.startSeconds ? `&t=${archivo.startSeconds}s` : ""}`} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#ff6600", display: "inline-block", marginTop: 8 }}>
                        ▶ ver VOD
                      </a>
                    )}
                  </div>
                )}
                {archivo && (() => {
                  // Tres secciones en el orden pedido: Top 8 completo (ya
                  // viene ordenado por orden real de juego desde el
                  // backend -- ver top8RoundOrder), Upsets (contra seed
                  // top 32), y Doc (todos los sets de Dr. Mario del
                  // torneo, para revisión personal). Mismo renderizado
                  // para las tres, solo cambia el título de sección.
                  const secciones = [
                    { key: "top8", titulo: "TOP 8", clips: archivo.top8Clips || [] },
                    { key: "upsets", titulo: "UPSETS (SEED TOP 32)", clips: archivo.upsetClips || [] },
                    { key: "doc", titulo: "SETS DE DR. MARIO", clips: archivo.docClips || [] },
                  ];
                  return secciones.map(sec => sec.clips.length > 0 && (() => {
                    const sectionKey = `${nombre}-${sec.key}`;
                    const colapsada = !openSections.has(sectionKey);
                    const pendientes = sec.clips.filter(c => !vodVistos.has(c.guid)).length;
                    return (
                    <div key={sec.key} style={{ marginBottom: 16, paddingBottom: colapsada ? 0 : 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <button onClick={() => toggleSection(sectionKey)} style={{
                        display: "flex", alignItems: "center", gap: 6, width: "100%",
                        background: "transparent", border: "none", padding: 0, marginBottom: colapsada ? 0 : 8, cursor: "pointer",
                      }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#ff6600", transform: colapsada ? "rotate(-90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>▼</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600" }}>{sec.titulo}</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#777" }}>({sec.clips.length})</span>
                        {pendientes > 0 && (
                          <span style={{
                            fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: "#111",
                            background: "#ff6600", borderRadius: 10, padding: "1px 7px", marginLeft: 2,
                          }}>{pendientes} sin ver</span>
                        )}
                      </button>
                      {!colapsada && sec.clips.map((clip, i) => {
                        const visto = vodVistos.has(clip.guid);
                        return (
                          <div key={clip.guid} style={{
                            padding: "16px 0",
                            borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                            opacity: visto ? 0.55 : 1,
                          }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <MeleeMatchup item={clip} />
                                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#777", marginTop: 4 }}>
                                  {clip.ronda}
                                </div>
                              </div>
                              <button onClick={() => toggleVodVisto(clip.guid)} style={{
                                flexShrink: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
                                border: "1px solid " + (visto ? "#333" : "#ff6600"), borderRadius: 14, padding: "4px 10px",
                                background: "transparent", color: visto ? "#666" : "#ff6600", cursor: "pointer",
                              }}>
                                {visto ? "✓ visto" : "marcar visto"}
                              </button>
                            </div>
                            {clip.videoId && (
                              <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", background: "#000" }}>
                                <iframe
                                  src={`https://www.youtube-nocookie.com/embed/${clip.videoId}${clip.startSeconds ? `?start=${clip.startSeconds}` : ""}`}
                                  title={`${stripSponsorTag(clip.ganador?.nombre)} vs ${stripSponsorTag(clip.perdedor?.nombre)}`}
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                  allowFullScreen
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    );
                  })());
                })()}
                {top16 && !archivo && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 8 }}>TOP 16</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {(top16.jugadores || []).map(j => (
                        <div key={j.nombre} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 60 }}>
                          <CharIcon pj={j.pj} size={44} />
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 4 }}>{stripSponsorTag(j.nombre)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {top8 && !archivo && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 8 }}>TOP 8</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {(top8.jugadores || []).map(j => (
                        <div key={j.nombre} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 60 }}>
                          <CharIcon pj={j.pj} size={44} />
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 4 }}>{stripSponsorTag(j.nombre)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {seedReport && !archivo && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 6 }}>
                      REPORTE DE SEEDS · {seedReport.summary}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                      {seedReport.jugadores.map(j => (
                        <div key={j.seed} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                          color: j.sostiene ? "#ddd" : "#777",
                          textDecoration: j.sostiene ? "none" : "line-through",
                        }}>
                          <span style={{ color: j.sostiene ? "#ff6600" : "#666", fontWeight: 700, textDecoration: "none" }}>[{j.seed}]</span>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripSponsorTag(j.nombre)}</span>
                          {!j.sostiene ? (
                            <span style={{ color: j.esUpset ? "#ff6600" : "#666", fontSize: 10, textDecoration: "none", flexShrink: 0 }}>
                              {j.esUpset ? "⚡" : "✕"} vs {stripSponsorTag(j.eliminadoPor?.nombre)}
                            </span>
                          ) : j.derrotas > 0 ? (
                            // Sigue vivo pero ya perdió una en el bracket (va en
                            // losers) -- distinto de "sigue limpio", vale la pena
                            // marcarlo sin tratarlo como eliminado.
                            <span style={{ color: "#888", fontSize: 10, textDecoration: "none", flexShrink: 0 }}>
                              en losers
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {upsets.length > 0 && (
                  <div>
                    {archivo || top16 || top8 || seedReport ? (
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 8 }}>UPSETS</div>
                    ) : null}
                    {(() => {
                      // Agrupado por día (hora Chile) -- así se distingue de un
                      // vistazo "los upsets de ayer" de "los de hoy" en majors
                      // de varios días. Sin fecha (pubDate null) cae a un solo
                      // grupo al final. La etiqueta de día solo se muestra si
                      // hay más de un día presente -- en torneos de un día no
                      // aporta nada, es ruido.
                      const chileDayKey = iso => iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Santiago" }) : "0000-00-00";
                      const chileDayLabel = iso => {
                        if (!iso) return "sin fecha";
                        const s = new Date(iso).toLocaleDateString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long" });
                        return s.charAt(0).toUpperCase() + s.slice(1);
                      };
                      const byDay = {};
                      for (const it of upsets) {
                        const key = chileDayKey(it.pubDate);
                        (byDay[key] = byDay[key] || []).push(it);
                      }
                      const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
                      return dayKeys.map(dayKey => (
                        <div key={dayKey} style={{ marginBottom: 8 }}>
                          {dayKeys.length > 1 && (
                            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: "#ff6600", opacity: 0.8, margin: "8px 0 4px" }}>
                              {chileDayLabel(byDay[dayKey][0].pubDate)}
                            </div>
                          )}
                          {byDay[dayKey].map((it, i) => {
                            const visto = vodVistos.has(it.guid);
                            return (
                              <div key={it.guid} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                <MeleeMatchup item={it} />
                                {it.videoId ? (
                                  // Microdoc: mismo tratamiento que los clips del
                                  // archivo permanente (embed inline + marcar visto),
                                  // en vez del link plano de antes.
                                  <div style={{ marginTop: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                                      <button onClick={() => toggleVodVisto(it.guid)} style={{
                                        fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
                                        border: "1px solid " + (visto ? "#333" : "#ff6600"), borderRadius: 14, padding: "4px 10px",
                                        background: "transparent", color: visto ? "#666" : "#ff6600", cursor: "pointer",
                                      }}>
                                        {visto ? "✓ visto" : "marcar visto"}
                                      </button>
                                    </div>
                                    <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", background: "#000" }}>
                                      <iframe
                                        src={`https://www.youtube-nocookie.com/embed/${it.videoId}${it.startSeconds ? `?start=${it.startSeconds}` : ""}`}
                                        title={`${stripSponsorTag(it.ganador?.nombre)} vs ${stripSponsorTag(it.perdedor?.nombre)}`}
                                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        allowFullScreen
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}
                {!archivo && !top16 && !top8 && !hype && !proyeccion && !seedReport && upsets.length === 0 && (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#666" }}>sin novedades todavía</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

