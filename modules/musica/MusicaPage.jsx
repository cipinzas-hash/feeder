import { fetchMusicaData } from "../shared/catalog.js";
import { CAT_COLORS } from "../shared/constants.js";
import { useMegusta, alternarMegusta, directorio } from "./megusta.js";
import { generosDeArtista } from "../shared/generos.js";

const { useState, useEffect, useRef } = React;

// ─── Módulo de música (oct-2026) ────────────────────────────────────────────
// Descubrimiento de lanzamientos: un carrusel con UN lanzamiento a la vez
// (portada + reproductor) y, desde ahí, la ficha del artista (bio, discografía
// con carátulas, reproductor por disco). Los datos los arma build-musica.mjs
// (musica.json); aquí solo se muestran. Lo único que se guarda es el ♥ (megusta.js,
// clave "angst-musica-megusta-v1", viaja en el export): de lo guardado sale el
// directorio de artistas con filtro por género.
//
// Montaje (norma N1 del lineamiento): sobre el marco CSS `.app-fit` de core/App.jsx
// (clases .musica / .musica-body). NO se mide el alto a mano: la portada se reparte el
// espacio libre con flex. Entrada colapsada = sin scroll (N3); la ficha del artista y el
// reproductor abierto son estados expandidos y scrollean (data-expandido).

const ACENTO = CAT_COLORS["Dark scene / Música"] || "#7b4fd4";
const FUENTE = "'DM Sans',sans-serif";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function hace(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} d`;
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

const TIPO = { album: "álbum", ep: "EP", single: "single", video: "video", reedicion: "reedición" };

// ─── Reproductor ────────────────────────────────────────────────────────────
function embedBandcamp(kind, id) {
  return `https://bandcamp.com/EmbeddedPlayer/${kind === "track" ? "track" : "album"}=${id}/size=large/bgcol=0a0a0a/linkcol=ffffff/tracklist=false/transparent=true/`;
}

export function Reproductor({ player, titulo }) {
  if (!player) return null;
  const caja = { width: "100%", border: 0, borderRadius: 8, background: "#000", display: "block" };
  if (player.tipo === "bandcamp")
    return <iframe title={titulo || "Bandcamp"} src={embedBandcamp(player.kind, player.id)} style={{ ...caja, height: 120 }} seamless allow="autoplay" />;
  if (player.tipo === "youtube")
    return <iframe title={titulo || "YouTube"} src={`https://www.youtube.com/embed/${player.videoId}?rel=0&playsinline=1`} style={{ ...caja, aspectRatio: "16 / 9", height: "auto" }} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  if (player.tipo === "soundcloud")
    return <iframe title={titulo || "SoundCloud"} src={player.url} style={{ ...caja, height: 120 }} allow="autoplay" />;
  if (player.tipo === "deezer")
    return <iframe title={titulo || "Deezer"} src={`https://widget.deezer.com/widget/dark/track/${player.trackId}?tracklist=false`} style={{ ...caja, height: 140 }} allow="encrypted-media" />;
  return null;
}

const CHIP_INFERIDO = { borderStyle: "dashed", fontStyle: "italic" };   // género que viene de Gemini (inferido de las noticias)

const quitarCaratula = e => { e.currentTarget.style.visibility = "hidden"; };

function Caratula({ src, lado, alt, flexible }) {
  // flexible: ocupa TODO el alto que deje el resto de la tarjeta (CSS puro, sin medir).
  const vacio = { background: "#16121f", border: "1px solid #2a2438", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a4260" };
  const img = src ? <img src={src} alt={alt || ""} loading="lazy" onError={quitarCaratula} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : "♪";
  if (flexible)
    return (
      <div style={{ position: "relative", flex: "1 1 0", minHeight: 0, width: "100%" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...vacio, height: "100%", maxWidth: "100%", aspectRatio: "1 / 1", fontSize: 48 }}>{img}</div>
        </div>
      </div>
    );
  return <div style={{ ...vacio, width: lado, height: lado, flex: "none", fontSize: Math.round(lado / 3) }}>{img}</div>;
}

function Chip({ children, activo, onClick, style }) {
  return <span onClick={onClick} style={{ fontFamily: FUENTE, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: activo ? "#111" : "#b9afd6", background: activo ? ACENTO : "#1c1729", border: `1px solid ${activo ? ACENTO : "#2f2745"}`, borderRadius: 12, padding: "3px 9px", ...style }}>{children}</span>;
}

// ─── Vista de entrada: un lanzamiento a la vez ──────────────────────────────
function LanzamientoCard({ lz, indice, total, onPrev, onNext, onArtista, onExpandido, meGusta, onMegusta }) {
  const [sonando, setSonando] = useState(false);
  useEffect(() => { setSonando(false); }, [lz.id]);
  useEffect(() => { onExpandido(sonando); }, [sonando]);
  const esVideo = lz.player && lz.player.tipo === "youtube";
  const fuentes = lz.fuentes || [];
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 16px 0", gap: 10 }}>
      {sonando && esVideo
        ? <div style={{ width: "100%" }}><Reproductor player={lz.player} titulo={`${lz.artista} — ${lz.disco || ""}`} /></div>
        : sonando
          ? <Caratula src={lz.arte} lado={180} alt={`${lz.artista} — ${lz.disco || ""}`} />
          : <Caratula src={lz.arte} flexible alt={`${lz.artista} — ${lz.disco || ""}`} />}
      {sonando && !esVideo && <div style={{ width: "100%" }}><Reproductor player={lz.player} titulo={`${lz.artista} — ${lz.disco || ""}`} /></div>}
      <div style={{ textAlign: "center", width: "100%", minWidth: 0, flex: "none" }}>
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.05, overflowWrap: "anywhere" }}>{lz.artista}</div>
        {lz.disco && <div style={{ fontFamily: FUENTE, fontSize: 14, color: "#cfc7e6", marginTop: 3, overflowWrap: "anywhere" }}>{lz.disco}</div>}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          {TIPO[lz.tipo] && <Chip activo>{TIPO[lz.tipo]}</Chip>}
          <Chip>{hace(lz.fecha)}</Chip>
          <Chip>{fuentes.length > 1 ? `${fuentes.length} fuentes` : (fuentes[0]?.fuente || "")}</Chip>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%", flex: "none" }}>
        <button onClick={onMegusta} aria-pressed={meGusta} aria-label={meGusta ? "quitar me gusta" : "me gusta"} style={{ flex: "none", width: 52, background: meGusta ? ACENTO : "transparent", color: meGusta ? "#111" : "#e5def7", border: `1px solid ${ACENTO}`, borderRadius: 12, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>{meGusta ? "♥" : "♡"}</button>
        {lz.player && !sonando && (
          <button onClick={() => setSonando(true)} style={{ flex: 2, background: ACENTO, color: "#111", border: "none", borderRadius: 12, padding: "12px 8px", fontFamily: FUENTE, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>▶ escuchar</button>
        )}
        <button onClick={onArtista} style={{ flex: 2, background: "transparent", color: "#e5def7", border: `1px solid ${ACENTO}`, borderRadius: 12, padding: "12px 8px", fontFamily: FUENTE, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>ficha del artista →</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingBottom: 6, flex: "none" }}>
        <button onClick={onPrev} disabled={indice === 0} aria-label="lanzamiento anterior" style={navBtn(indice === 0)}>←</button>
        <span style={{ fontFamily: FUENTE, fontSize: 11, color: "#7d7396", letterSpacing: "0.06em" }}>{indice + 1} / {total}</span>
        <button onClick={onNext} disabled={indice >= total - 1} aria-label="lanzamiento siguiente" style={navBtn(indice >= total - 1)}>→</button>
      </div>
    </div>
  );
}
const navBtn = off => ({ width: 52, height: 40, background: "transparent", border: "1px solid #2f2745", borderRadius: 10, color: off ? "#3c3552" : "#e5def7", fontSize: 18, cursor: off ? "default" : "pointer" });

// ─── Ficha del artista ──────────────────────────────────────────────────────
function FichaArtista({ slug, artista, lanzamientos, discoInicial, onVolver, volverA }) {
  const bc = artista?.bandcamp || null;
  const discos = bc?.discos || [];
  const propios = lanzamientos.filter(l => l.artistaSlug === slug);
  const inicial = discoInicial || propios[0] || null;
  const [player, setPlayer] = useState(inicial ? inicial.player : null);
  const [titulo, setTitulo] = useState(inicial ? `${inicial.artista} — ${inicial.disco || ""}` : "");
  const [bioAbierta, setBioAbierta] = useState(false);
  const playerRef = useRef(null);
  const nombre = artista?.nombre || propios[0]?.artista || "";
  const bio = artista?.bio || "";
  const meta = [bc?.ubicacion, artista?.mb?.desde ? `desde ${String(artista.mb.desde).slice(0, 4)}` : null, artista?.mb?.pais].filter(Boolean).join(" · ");
  const { tags, inferido } = generosDeArtista(artista);

  function elegir(d) {
    setPlayer({ tipo: "bandcamp", kind: d.tipo, id: d.id });
    setTitulo(`${nombre} — ${d.titulo || ""}`);
    if (playerRef.current && playerRef.current.scrollIntoView) playerRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  const enlace = (href, texto) => href ? <a key={texto} href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FUENTE, fontSize: 12, fontWeight: 700, color: "#e5def7", textDecoration: "none", border: "1px solid #2f2745", borderRadius: 10, padding: "7px 12px" }}>{texto} ↗</a> : null;

  return (
    <div style={{ padding: "10px 16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <button onClick={onVolver} style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: "#8a80a6", fontFamily: FUENTE, fontSize: 13, cursor: "pointer", padding: "4px 0" }}>← {volverA || "lanzamientos"}</button>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {artista?.foto
          ? <img src={artista.foto} alt="" loading="lazy" onError={quitarCaratula} style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", border: `2px solid ${ACENTO}`, flex: "none", background: "#16121f" }} />
          : <div style={{ width: 84, height: 84, borderRadius: "50%", border: `2px solid ${ACENTO}`, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: ACENTO, fontSize: 30, background: "#16121f" }}>♪</div>}
        <div style={{ minWidth: 0 }}>
          {artista?.logo
            ? <img src={artista.logo} alt={nombre} loading="lazy" onError={quitarCaratula} style={{ maxWidth: "100%", maxHeight: 54, objectFit: "contain", display: "block" }} />
            : <div style={{ fontFamily: "'Caveat',cursive", fontSize: 30, fontWeight: 700, color: "#fff", lineHeight: 1.02, overflowWrap: "anywhere" }}>{nombre}</div>}
          {artista?.logo && <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#8a80a6", marginTop: 2 }}>{nombre}</div>}
          {meta && <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#9d93b8", marginTop: 4 }}>{meta}</div>}
        </div>
      </div>

      {tags.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} title={inferido ? "género inferido de las noticias, no confirmado" : undefined}>{tags.map(t => <Chip key={t} style={inferido ? CHIP_INFERIDO : undefined}>{t}</Chip>)}</div>}

      <div ref={playerRef} style={{ scrollMarginTop: 8 }}>
        {player
          ? <Reproductor player={player} titulo={titulo} />
          : <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#7d7396", border: "1px dashed #2f2745", borderRadius: 8, padding: "14px 12px", textAlign: "center" }}>elige un disco para escucharlo</div>}
        {titulo && player && <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#7d7396", marginTop: 6, overflowWrap: "anywhere" }}>{titulo}</div>}
      </div>

      {bio && (
        <div>
          <div style={{ fontFamily: FUENTE, fontSize: 13, lineHeight: 1.5, color: "#cfc7e6", whiteSpace: "pre-line", overflowWrap: "anywhere", ...(bioAbierta ? {} : { display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{bio}</div>
          {bio.length > 260 && <button onClick={() => setBioAbierta(!bioAbierta)} style={{ background: "transparent", border: "none", color: ACENTO, fontFamily: FUENTE, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}>{bioAbierta ? "leer menos" : "leer más"}</button>}
          {!artista?.bandcamp?.bio && artista?.wiki && <div style={{ fontFamily: FUENTE, fontSize: 10, color: "#6a6180", marginTop: 2 }}>texto de Wikipedia ({artista.wiki.lang})</div>}
        </div>
      )}

      {discos.length > 0 && (
        <div>
          <div style={{ fontFamily: FUENTE, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a80a6", marginBottom: 8 }}>
            discografía · {bc.totalDiscos > discos.length ? `${discos.length} de ${bc.totalDiscos}` : discos.length}
            {bc.pagina === "sello" && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}> · del catálogo de su sello</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {discos.map(d => {
              const activo = player && player.tipo === "bandcamp" && player.id === d.id;
              return (
                <button key={`${d.tipo}-${d.id}`} onClick={() => elegir(d)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0 }}>
                  <div style={{ aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", background: "#16121f", border: `2px solid ${activo ? ACENTO : "#2a2438"}` }}>
                    {d.arte && <img src={d.arte} alt="" loading="lazy" onError={quitarCaratula} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                  </div>
                  <div style={{ fontFamily: FUENTE, fontSize: 11, lineHeight: 1.25, color: activo ? "#fff" : "#b9afd6", marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{d.titulo}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {enlace(bc?.url, "Bandcamp")}
        {enlace(artista?.mb?.url, "MusicBrainz")}
        {enlace(artista?.wiki?.url, "Wikipedia")}
      </div>

      {propios.length > 0 && (
        <div>
          <div style={{ fontFamily: FUENTE, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a80a6", marginBottom: 6 }}>en las noticias</div>
          {propios.flatMap(l => l.fuentes.map(f => (
            <a key={f.link} href={f.link} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontFamily: FUENTE, fontSize: 12, color: "#b9afd6", textDecoration: "none", padding: "5px 0", borderBottom: "1px solid #1f1a2e", overflowWrap: "anywhere" }}>
              <span style={{ color: "#6a6180" }}>{f.fuente} · {hace(f.fecha)} — </span>{f.titulo} ↗
            </a>
          )))}
        </div>
      )}
    </div>
  );
}

// ─── Directorio de artistas (los que tienen ♥) ──────────────────────────────
const SIN_GENERO = "\u0000sin-genero";
function Directorio({ guardados, artistas, onArtista }) {
  const [elegido, setElegido] = useState(null);   // null = todos
  const arts = directorio(guardados, artistas);
  const conteo = {};
  let sinGenero = 0;
  for (const a of arts) { if (!a.tags.length) sinGenero++; for (const t of a.tags) conteo[t] = (conteo[t] || 0) + 1; }
  const generos = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a] || a.localeCompare(b));
  const genero = elegido === SIN_GENERO ? (sinGenero ? elegido : null) : (elegido && conteo[elegido] ? elegido : null);   // si ya no queda ninguno de ese género, vuelve a "todos"
  const visibles = arts.filter(a => genero === null ? true : genero === SIN_GENERO ? !a.tags.length : a.tags.includes(genero));
  const clic = { cursor: "pointer" };
  if (!arts.length)
    return <div style={{ flex: "none", fontFamily: FUENTE, fontSize: 13, color: "#7d7396", padding: "40px 28px", textAlign: "center", lineHeight: 1.5 }}>Todavía no guardas nada. Toca ♡ en un lanzamiento y su artista entra aquí.</div>;
  return (
    <div style={{ padding: "6px 16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip activo={genero === null} onClick={() => setElegido(null)} style={clic}>todos · {arts.length}</Chip>
        {generos.map(g => <Chip key={g} activo={genero === g} onClick={() => setElegido(g)} style={clic}>{g} · {conteo[g]}</Chip>)}
        {sinGenero > 0 && generos.length > 0 && <Chip activo={genero === SIN_GENERO} onClick={() => setElegido(SIN_GENERO)} style={clic}>sin género · {sinGenero}</Chip>}
      </div>
      {visibles.map(a => (
        <button key={a.slug} onClick={() => onArtista(a)} style={{ display: "flex", gap: 12, alignItems: "center", background: "#14101d", border: "1px solid #2a2438", borderRadius: 12, padding: "10px 12px", textAlign: "left", cursor: "pointer", width: "100%", minWidth: 0 }}>
          {a.foto
            ? <img src={a.foto} alt="" loading="lazy" onError={quitarCaratula} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flex: "none", background: "#16121f", border: `2px solid ${ACENTO}` }} />
            : <div style={{ width: 52, height: 52, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: ACENTO, fontSize: 20, background: "#16121f", border: `2px solid ${ACENTO}` }}>♪</div>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.05, overflowWrap: "anywhere" }}>{a.nombre}</div>
            <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#9d93b8", marginTop: 3, overflowWrap: "anywhere" }}>
              {a.lanzamientos.map(l => (l.disco || "—") + (TIPO[l.tipo] ? ` (${TIPO[l.tipo]})` : "")).join(" · ")}
            </div>
            {a.tags.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>{a.tags.slice(0, 4).map(t => <Chip key={t} style={{ fontSize: 9, padding: "2px 7px", ...(a.inferido ? CHIP_INFERIDO : {}) }}>{t}</Chip>)}</div>}
          </div>
          <span style={{ color: "#6a6180", fontSize: 18, flex: "none" }}>→</span>
        </button>
      ))}
      {!visibles.length && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#7d7396", textAlign: "center", padding: 20 }}>Ningún artista guardado con ese género.</div>}
      {arts.some(a => a.inferido) && <div style={{ fontFamily: FUENTE, fontSize: 11, color: "#6a6180", textAlign: "center" }}>Borde punteado: género inferido de las noticias, no confirmado.</div>}
    </div>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function MusicaPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [indice, setIndice] = useState(0);
  const [artistaAbierto, setArtistaAbierto] = useState(null);
  const [expandido, setExpandido] = useState(false); // reproductor abierto en la entrada
  const [vista, setVista] = useState("lanzamientos"); // "lanzamientos" | "directorio"
  const [desdeDir, setDesdeDir] = useState(null);     // artista del directorio con el que se abrió la ficha
  const guardados = useMegusta();

  async function cargar() {
    setError(null);
    try { setDatos(await fetchMusicaData()); }
    catch (e) { setError(e.message || "error"); }
  }
  useEffect(() => { cargar(); }, []);

  const lanzamientos = datos ? datos.lanzamientos : [];
  const lz = lanzamientos[Math.min(indice, Math.max(0, lanzamientos.length - 1))];
  const centrado = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FUENTE, fontSize: 13, color: "#7d7396", padding: 24, textAlign: "center" };
  const ancho = { width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box" };

  if (artistaAbierto && (datos || desdeDir)) {
    // Desde el directorio la ficha puede ser de un artista que ya salió de musica.json (ventana de ~30 días):
    // se arma con lo que quedó guardado con el ♥.
    const artistasDatos = (datos && datos.artistas) || {};
    const artistaFicha = artistasDatos[artistaAbierto] || (desdeDir ? { nombre: desdeDir.nombre, foto: desdeDir.foto, mb: { tags: desdeDir.tags } } : undefined);
    const ids = new Set(lanzamientos.map(l => l.id));
    const guardadosLz = Object.values(guardados).map(g => g.lz).filter(l => l && !ids.has(l.id));
    const discoIni = desdeDir ? desdeDir.lanzamientos[0] : (lz && lz.artistaSlug === artistaAbierto ? lz : null);
    return (
      <div className="musica">
        <div className="musica-body" data-expandido="true" style={ancho}>
          <FichaArtista key={artistaAbierto} slug={artistaAbierto} artista={artistaFicha} lanzamientos={[...lanzamientos, ...guardadosLz]} discoInicial={discoIni}
            volverA={desdeDir ? "artistas" : "lanzamientos"} onVolver={() => { setArtistaAbierto(null); setDesdeDir(null); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="musica">
      <div className="musica-body" data-expandido={(expandido || vista === "directorio") ? "true" : "false"} style={ancho}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px 2px", flex: "none" }}>
          <Chip activo={vista === "lanzamientos"} onClick={() => setVista("lanzamientos")} style={{ cursor: "pointer" }}>lanzamientos</Chip>
          <Chip activo={vista === "directorio"} onClick={() => setVista("directorio")} style={{ cursor: "pointer" }}>♥ artistas{directorio(guardados).length ? ` · ${directorio(guardados).length}` : ""}</Chip>
          {vista === "lanzamientos" && datos && datos.generatedAt && <span style={{ fontFamily: FUENTE, fontSize: 10, color: "#6a6180", marginLeft: "auto" }}>actualizado {hace(datos.generatedAt)}</span>}
        </div>
        {vista === "directorio" && <Directorio guardados={guardados} artistas={(datos && datos.artistas) || {}} onArtista={a => { setDesdeDir(a); setArtistaAbierto(a.slug); }} />}
        {vista === "lanzamientos" && !datos && !error && <div style={centrado}>cargando música…</div>}
        {vista === "lanzamientos" && error && (
          <div style={{ ...centrado, flexDirection: "column", gap: 12 }}>
            <div style={{ color: "#c9a0a0" }}>No se pudo cargar la música ({error}).</div>
            <button onClick={cargar} style={{ background: "transparent", color: "#e5def7", border: `1px solid ${ACENTO}`, borderRadius: 12, padding: "10px 18px", fontFamily: FUENTE, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>reintentar</button>
          </div>
        )}
        {vista === "lanzamientos" && datos && !lz && <div style={centrado}>Todavía no hay lanzamientos con forma de escucharse.</div>}
        {vista === "lanzamientos" && datos && lz && (
          <LanzamientoCard
            meGusta={!!guardados[lz.id]} onMegusta={() => alternarMegusta(lz, datos.artistas[lz.artistaSlug])}
            lz={lz} indice={Math.min(indice, lanzamientos.length - 1)} total={lanzamientos.length} onExpandido={setExpandido}
            onPrev={() => setIndice(i => Math.max(0, i - 1))}
            onNext={() => setIndice(i => Math.min(lanzamientos.length - 1, i + 1))}
            onArtista={() => setArtistaAbierto(lz.artistaSlug)}
          />
        )}
      </div>
    </div>
  );
}
