import { CINE_RATINGS, STATUS_BADGE, diasHasta, diasParaEstreno, diasRestantesCartelera, esEnProduccion, esEstreno, esNuevo, esTrending, seasonLabel, setCineItemEstado, useCineEstadoMap } from "./estado.js";
import { FormatoTag, btnGhost, shareToWhatsApp } from "../shared/ui.jsx";
import { SeriesSeguimiento } from "./series.jsx";
import { avanceDe, estadoAvance, estadoEfectivo, estadoRemotoDe, useAvanceVersion } from "./avance.js";
import { enqueueSimklAction, flushSimklQueue, pedirSimklAuth, useSimklDiscovery, useSimklSyncStatus } from "./simkl.js";
import { CAT_COLORS } from "../shared/constants.js";

const { useState, useEffect, useRef } = React;


// ─── Exportar imagen para RRSS (solo desde el Buzón) ───────────────────────
// Renderiza poster + título + rating + sinopsis en un canvas 1080×1920
// (proporción Instagram Story) y lo descarga como PNG — el usuario lo sube
// manualmente a la red social que quiera, no hay integración directa.
function loadImageForCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // necesario para no "tainted-ear" el canvas
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no se pudo cargar la imagen"));
    img.src = url;
  });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function exportCineShareImage(item, onError) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  // Poster — ocupa el ~68% superior, "cover" (recorta, no deforma)
  const posterH = Math.round(H * 0.68);
  try {
    if (item.image) {
      const img = await loadImageForCanvas(item.image);
      const scale = Math.max(W / img.width, posterH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (posterH - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, W, posterH);
    }
  } catch (e) {
    onError && onError("no se pudo exportar el poster de esta ficha (bloqueo de origen de la imagen) — probá con otro título");
    return false;
  }

  // Degradé para que el texto de abajo se lea sobre el poster
  const grad = ctx.createLinearGradient(0, posterH - 420, 0, posterH + 20);
  grad.addColorStop(0, "rgba(10,10,10,0)");
  grad.addColorStop(1, "rgba(10,10,10,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, posterH - 420, W, 440);

  const marginX = 64;
  let y = posterH + 70;

  // Título
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 58px 'DM Sans', sans-serif";
  const titleLines = wrapCanvasText(ctx, item.title, W - marginX * 2).slice(0, 2);
  for (const line of titleLines) { ctx.fillText(line, marginX, y); y += 66; }
  y += 10;

  // Rating (IMDb / RT / Metascore / TMDb — lo que haya)
  const r = item.rating || {};
  const chips = [];
  if (r.imdb != null) chips.push(`★ ${r.imdb.toFixed(1)} IMDb`);
  if (r.rt != null) chips.push(`🍅 ${r.rt}% RT`);
  if (r.metascore != null) chips.push(`Ⓜ ${r.metascore} MC`);
  if (!chips.length && r.tmdb != null) chips.push(`★ ${r.tmdb} TMDb`);
  if (chips.length) {
    ctx.font = "700 32px 'DM Sans', sans-serif";
    ctx.fillStyle = "#f5c518";
    ctx.fillText(chips.join("   "), marginX, y);
    y += 56;
  } else {
    y += 20;
  }

  // Sinopsis
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "400 32px 'DM Sans', sans-serif";
  const summaryLines = wrapCanvasText(ctx, item.summary || "", W - marginX * 2).slice(0, 7);
  for (const line of summaryLines) { ctx.fillText(line, marginX, y); y += 42; }

  // Marca al pie
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "600 24px 'DM Sans', sans-serif";
  ctx.fillText("ANGST", marginX, H - 50);

  try {
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("toBlob devolvió null");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(item.title || "angst").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) {
    onError && onError("no se pudo exportar esta imagen (bloqueo del origen del poster) — probá con otro título");
    return false;
  }
}

// ─── RatingBadges ────────────────────────────────────────────────────────────
function RatingBadges({ rating, size = "sm" }) {
  if (!rating) return null;
  const chips = [];
  if (rating.imdb != null) chips.push({ label: "IMDb", value: rating.imdb.toFixed(1), bg: "#f5c518", fg: "#000" });
  if (rating.rt != null) chips.push({ label: rating.rt >= 60 ? "🍅" : "🟢", value: `${rating.rt}%`, bg: "#fa320a", fg: "#fff" });
  if (rating.metascore != null) chips.push({ label: "MC", value: rating.metascore, bg: rating.metascore >= 61 ? "#6c3" : rating.metascore >= 40 ? "#fc3" : "#c0392b", fg: "#000" });
  if (rating.tmdb != null) chips.push({ label: "TMDb", value: rating.tmdb.toFixed(1), bg: "#01b4e4", fg: "#000" });
  if (!chips.length) return null;
  const fontSize = size === "lg" ? 12 : 10;
  const pad = size === "lg" ? "5px 10px" : "3px 7px";
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {chips.map((c, i) => (
        <span key={i} style={{ background: c.bg, color: c.fg, borderRadius: 6, padding: pad, fontFamily: "'DM Sans',sans-serif", fontSize, fontWeight: 700, display: "flex", gap: 4, alignItems: "center" }}>
          <span>{c.label}</span><span>{c.value}</span>
        </span>
      ))}
    </div>
  );
}

// CineStoryCard fue removido esta sesión: Vitrina reemplaza el swipe de una
// tarjeta de cine a la vez por el carrusel (CineCoverFlow) + detalle
// (CineExtendedView, más abajo). "cine" ya no participa del formato "story".

function ReviewBlock({ label, review, color }) {
  return (
    <div style={{ background: "#151515", borderRadius: 10, padding: "10px 12px", marginBottom: 8, borderLeft: `2px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color, fontWeight: 700 }}>{review.rating}/10</span>
      </div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{review.text}</div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>— {review.author}</div>
    </div>
  );
}

function MiniReviewForm({ onSave, onCancel, inicial }) {
  const [ratingId, setRatingId] = useState(inicial?.rating || null);
  const [nota, setNota] = useState(inicial?.nota || "");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {CINE_RATINGS.map(r => (
          <button key={r.id} onClick={() => setRatingId(r.id)} style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "8px 10px", borderRadius: 8,
            border: "1px solid", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1,
            background: ratingId === r.id ? "#fff" : "transparent",
            color: ratingId === r.id ? "#111" : "#ccc",
            borderColor: ratingId === r.id ? "#fff" : "#333",
          }}>
            <span style={{ fontSize: 20 }}>{r.emoji}</span>
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={nota} onChange={e => setNota(e.target.value)} placeholder="nota (opcional)"
        style={{
          width: "100%", minHeight: 60, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
          color: "#fff", fontFamily: "'DM Sans',sans-serif", fontSize: 13, padding: 10, resize: "vertical", boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1 }}>cancelar</button>
        <button
          onClick={() => ratingId && onSave(ratingId, nota)}
          disabled={!ratingId}
          style={{ ...btnGhost, flex: 1, opacity: ratingId ? 1 : 0.4, background: ratingId ? "#fff" : "transparent", color: ratingId ? "#111" : undefined }}>
          guardar reseña
        </button>
      </div>
    </div>
  );
}

export function CineExtendedView({ item, onBack, onNext, onSave, onChangeCategory, hideActions, onExportImage }) {
  const cineEstado = useCineEstadoMap();
  useAvanceVersion(); // re-render cuando llega el avance de Simkl o cambian las marcas
  const estadoItem = cineEstado[item.guid];
  const estado = estadoEfectivo(cineEstado, item.guid);
  const [reviewOpen, setReviewOpen] = useState(false);
  function marcar(nuevoEstado) {
    if (nuevoEstado === "interesa") {
      // Copia completa: tiene que sobrevivir a la poda de 30 días de
      // build-cine.mjs, que no sabe que esto está marcado "interesa".
      setCineItemEstado(item.guid, { estado: "interesa", item });
    } else if (nuevoEstado === "sin_marca") {
      // Si Simkl tiene un estado para este ítem, borrar la entrada local lo
      // "revive" (el estado efectivo cae al remoto): se guarda un override.
      setCineItemEstado(item.guid, estadoRemotoDe(item.guid) ? { estado: "sin_marca" } : null);
    } else {
      setCineItemEstado(item.guid, { estado: nuevoEstado });
    }
    enqueueSimklAction(item, nuevoEstado);
  }
  function guardarReview(ratingId, nota) {
    setCineItemEstado(item.guid, { estado: "vista", rating: ratingId, nota: nota || "" });
    enqueueSimklAction(item, "vista");
    setReviewOpen(false);
  }
  // Progreso por episodio (solo Series) -- "watching" en Simkl: acá
  // vas, marca todo lo anterior como visto. No es un estado local
  // nuevo, es "interesa" + progreso enganchado, mismo criterio que ya
  // habíamos definido para watching/hold al diseñar el mapeo de
  // estados de Simkl.
  const progresoActual = estadoItem?.progreso || null;
  function marcarProgreso(temporada, episodio) {
    setCineItemEstado(item.guid, { estado: "interesa", item, progreso: { temporada, episodio } });
    enqueueSimklAction(item, "interesa", { temporada, episodio });
  }
  // Episodios: solo si ya hay progreso o le diste 👍 (antes salían siempre,
  // incluso para una serie que ni siquiera decidiste ver).
  const avance = avanceDe(item.guid);
  const puedeEpisodios = item.categoria === "Series" || (item.categoria === "Animación" && !!avance?.catalogo);
  const mostrarEpisodios = estado === "interesa" || (avance?.vistos ?? 0) > 0 || !!progresoActual;
  const color = CAT_COLORS[item.categoria] || "#e91e8c";
  const leads = (item.cast || []).filter(c => c.order < 4);
  const supporting = (item.cast || []).filter(c => c.order >= 4);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0d0d0d", display: "flex", flexDirection: "column", zIndex: 50 }}>
      <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1a1a" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", flex: 1 }}>{item.source}</span>
        <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>fuente ↗</a>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehaviorY: "contain", padding: "18px 20px 30px" }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
          {item.image && (
            <img src={item.image} alt="" style={{ width: 110, minWidth: 110, borderRadius: 10, alignSelf: "flex-start" }} onError={e => { e.target.style.display = "none"; }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FormatoTag item={item} />
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: "#fff", margin: "4px 0 8px", lineHeight: 1.15, wordBreak: "break-word" }}>{item.title}</div>
            <RatingBadges rating={item.rating} size="lg" />
          </div>
        </div>

        {/* Orden de la ficha (pedido de uso en tablet): nombre y carátula, sinopsis,
            video, y recién ahí decidir. Antes el video iba antes que la sinopsis y
            los botones de decisión quedaban en una barra fija aparte. */}
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: 18 }}>
          {item.summary}
        </div>

        {item.trailer && (
          <div style={{ margin: "16px 0", borderRadius: 10, overflow: "hidden", aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${item.trailer.key}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        )}

        {/* Oculta si ya está vista -- interesa/no-interesa no tiene
              sentido una vez vista, la reseña ya la reemplaza. También
              oculta mientras se escribe la reseña: estaba justo encima
              del formulario y un toque accidental acá perdía el
              borrador. */}
          {!hideActions && !reviewOpen && estado !== "vista" && (
            <div style={{ display: "flex", gap: 6, margin: "2px 0 18px" }}>
              <button
                onClick={() => marcar(estado === "interesa" ? "sin_marca" : "interesa")}
                style={{ ...btnGhost, background: estado === "interesa" ? "#2ecc71" : "transparent", color: estado === "interesa" ? "#111" : undefined, borderColor: estado === "interesa" ? "#2ecc71" : undefined }}>
                <span style={{ fontSize: 17 }}>👍</span>me interesa
              </button>
              <button
                onClick={() => marcar(estado === "descartada" ? "sin_marca" : "descartada")}
                style={{ ...btnGhost, background: estado === "descartada" ? "#e74c3c" : "transparent", color: estado === "descartada" ? "#111" : undefined, borderColor: estado === "descartada" ? "#e74c3c" : undefined }}>
                <span style={{ fontSize: 17 }}>👎</span>no me interesa
              </button>
            </div>
          )}
        {/* Episodios -- solo con progreso o 👍 (ver puedeEpisodios/mostrarEpisodios). */}
        {!hideActions && !reviewOpen && puedeEpisodios && mostrarEpisodios && (
          <div style={{ margin: "0 0 18px", borderRadius: 10, overflow: "hidden" }}>
            <SeriesSeguimiento item={item} progresoActual={progresoActual} onMarcar={marcarProgreso} />
          </div>
        )}
        {/* Mi reseña — después de tráiler/sinopsis a propósito: la
            decisión de marcar como vista viene después de repasar esa
            info, no antes. Bloqueada mientras está en producción -- no
            se puede haber visto algo que todavía no se estrenó. */}
        {!esEnProduccion(item) && (
          <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: "#fff", marginBottom: 8 }}>mi reseña</div>
            {estado === "vista" && !reviewOpen ? (
              <div onClick={() => setReviewOpen(true)} style={{ cursor: "pointer" }}>
                {(() => {
                  const r = CINE_RATINGS.find(r => r.id === estadoItem.rating);
                  return (
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#fff", marginBottom: 4 }}>
                      {r ? `${r.emoji} ${r.label}` : "sin calificar"}
                    </div>
                  );
                })()}
                {estadoItem.nota && (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
                    "{estadoItem.nota}"
                  </div>
                )}
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#666", marginTop: 4 }}>tocar para editar</div>
              </div>
            ) : reviewOpen || estado !== "vista" ? (
              reviewOpen && <MiniReviewForm onSave={guardarReview} onCancel={() => setReviewOpen(false)} inicial={estadoItem} />
            ) : null}
            {estado !== "vista" && !reviewOpen && (
              <button onClick={() => setReviewOpen(true)} style={{ ...btnGhost, width: "100%" }}>
                <span style={{ fontSize: 17 }}>📝</span>marcar como vista
              </button>
            )}
          </div>
        )}
        {leads.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: "#fff", marginBottom: 6 }}>reparto principal</div>
            {leads.map((c, i) => (
              <div key={i} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>
                <b style={{ color: "#fff" }}>{c.name}</b>{c.character ? ` — ${c.character}` : ""}
              </div>
            ))}
            {supporting.length > 0 && (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                {supporting.map(c => c.name).join(" · ")}
              </div>
            )}
          </div>
        )}

        {item.reviews ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: "#fff", marginBottom: 8 }}>reseñas de usuario</div>
            <ReviewBlock label="mejor valorada" review={item.reviews.top} color={color} />
            {item.reviews.bottom && <ReviewBlock label="peor valorada" review={item.reviews.bottom} color={color} />}
          </div>
        ) : (
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#666", fontStyle: "italic" }}>
            sin reseñas de usuario disponibles para este título
          </div>
        )}
      </div>
      {!hideActions && (
        <React.Fragment>
          <div style={{ display: "flex", gap: 6, padding: "4px 10px 10px", background: "#111" }}>
            <button onClick={onChangeCategory} style={btnGhost}><span style={{ fontSize: 17 }}>⬅️</span>anterior</button>
            <button onClick={onSave} style={btnGhost}><span style={{ fontSize: 17 }}>⬇️</span>guardar</button>
            <button onClick={() => shareToWhatsApp(item)} style={btnGhost}><span style={{ fontSize: 17 }}>📤</span>compartir</button>
            <button onClick={onNext} style={{ ...btnGhost, background: color, color: "#111", borderColor: color }}><span style={{ fontSize: 17 }}>➡️</span>siguiente</button>
          </div>
        </React.Fragment>
      )}
      {hideActions && onExportImage && (
        <div style={{ display: "flex", gap: 6, padding: "10px 10px", background: "#111" }}>
          <button onClick={() => onExportImage(item)} style={{ ...btnGhost, background: color, color: "#111", borderColor: color, flex: "none", width: "100%" }}>
            <span style={{ fontSize: 17 }}>📸</span>exportar imagen para compartir
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CineCoverFlow — carrusel de posters con perspectiva 3D. Se usa en el
// Buzón (filtrado a lo guardado) y en Vitrina (catálogo completo del mes).
// Flechas ◀️▶️ a los costados + loop infinito (después del último vuelve
// al primero, y viceversa) además del scroll táctil de siempre.
export function CineCoverFlow({ items, onOpen, generatedAt, categoria }) {
  // Reintenta lo que haya quedado pendiente de una corrida anterior
  // (red caída, Worker no respondió, etc.) al entrar a la Vitrina --
  // sin esto, solo se reintenta la próxima vez que se toque un ítem.
  useEffect(() => { flushSimklQueue(); }, []);

  const CARD_W = 160;
  const GAP = 20;
  const ITEM_W = CARD_W + GAP;

  // pos = posición central continua, en "unidades de ítem" (puede tener
  // decimales durante el arrastre). No se resetea NUNCA para el loop --
  // crece o decrece sin límite; el wrap a un catálogo finito se resuelve
  // con módulo recién al elegir qué ítem mostrar en cada franja, no
  // reposicionando nada. Por eso no hay salto que corregir ni superficie
  // para que el navegador pelee contra un scroll nativo: no hay scroll
  // nativo, el carrusel entero lo maneja este componente.
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const dragRef = useRef(null); // {startX, startPos, moved, pointerId} mientras se arrastra
  const animRef = useRef(null); // id de la animación de snap/paso en curso

  function setPosBoth(v) { posRef.current = v; setPos(v); }

  function animateTo(target, ms = 260) {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = posRef.current;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setPosBoth(start + (target - start) * eased);
      if (p < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    }
    animRef.current = requestAnimationFrame(tick);
  }
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  function onPointerDown(e) {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const tapEl = e.target.closest?.("[data-cine-tap]");
    dragRef.current = {
      startX: e.clientX, startPos: posRef.current, moved: 0,
      tapOffset: tapEl ? Number(tapEl.dataset.cineTap) : null,
    };
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const deltaPx = e.clientX - d.startX;
    d.moved = Math.max(d.moved, Math.abs(deltaPx));
    setPosBoth(d.startPos - deltaPx / ITEM_W);
  }
  function endDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    animateTo(Math.round(posRef.current));
  }
  // El tap se resuelve acá, no con onClick en cada tarjeta -- con
  // setPointerCapture + touchAction:none activos, el click sintético
  // que dispara el navegador después de un toque en pantallas táctiles
  // no es confiable (dejó de abrir el detalle en la versión final).
  // Guardamos qué tarjeta (por offset) se tocó al bajar el dedo, y si
  // el gesto no se movió más de un puñado de px, la abrimos acá.
  function onPointerUp(e) {
    const d = dragRef.current;
    const moved = d?.moved || 0;
    if (d && moved <= 6 && d.tapOffset != null) {
      const rawIdx = Math.round(d.startPos) + d.tapOffset;
      const realIdx = ((rawIdx % total) + total) % total;
      const item = sortedItems[realIdx];
      if (item) onOpen(item);
    }
    endDrag();
  }

  function step(dir) { animateTo(Math.round(posRef.current) + dir); }

  const cineEstado = useCineEstadoMap();
  const avVersion = useAvanceVersion(); // avance/estados de Simkl: re-render + dependencia estable de useMemo
  // Las marcadas "interesa" llevan copia completa del item justamente para
  // sobrevivir a la poda de 30 días de build-cine.mjs (que no sabe nada de
  // este estado) — si build-cine ya la sacó de `items`, la reinyectamos acá
  // desde la copia local para que no desaparezca del carrusel. Filtra por
  // `categoria` explícito, no solo por ausencia en `items` -- si no,
  // cualquier "interesa" de Películas se colaba también en el carrusel de
  // Series/Animación (bug real: no estaba en `items` de esa categoría por
  // ser de otra, así que el chequeo de ausencia daba falso positivo).
  // _fueraDeCartelera marca justamente eso -- issue #12: la fuente activa
  // (cine.json, `items`) nunca es la única verdad para lo que el usuario
  // ya marcó, y lo que cayó de ahí se agrupa aparte, no se pierde ni se
  // mezcla sin distinción con lo que sigue vigente.
  const itemGuidsEnCartelera = React.useMemo(() => new Set(items.map(it => it.guid)), [items]);
  const exemptExtra = React.useMemo(() => Object.values(cineEstado)
    .filter(e => e.estado === "interesa" && e.item
      && (!categoria || e.item.categoria === categoria)
      && !itemGuidsEnCartelera.has(e.item.guid))
    .map(e => ({ ...e.item, _fueraDeCartelera: true })), [cineEstado, itemGuidsEnCartelera, categoria]);
  // "Bajo el radar" (issue #14, fase B): lo de tu lista real de Simkl que
  // el descubrimiento normal de cine.json nunca trajo. Mismo criterio de
  // no-duplicar que exemptExtra -- si ya está en `items` o ya se agregó
  // como exemptExtra (marcado localmente también), no se vuelve a meter.
  const simklDiscoveryAll = useSimklDiscovery();
  const exemptGuids = React.useMemo(() => new Set(exemptExtra.map(e => e.guid)), [exemptExtra]);
  const simklExtra = React.useMemo(() => simklDiscoveryAll
    .filter(it => (!categoria || it.categoria === categoria)
      && !itemGuidsEnCartelera.has(it.guid)
      && !exemptGuids.has(it.guid)),
    [simklDiscoveryAll, itemGuidsEnCartelera, exemptGuids, categoria]);
  const fullItems = (exemptExtra.length || simklExtra.length) ? [...items, ...exemptExtra, ...simklExtra] : items;

  // Orden y filtro del carrusel: por defecto el orden del catálogo tal
  // cual llega; "próxima" prioriza lo que menos le queda en cartelera
  // (lo sin firstSeenAt queda al final). "ocultar descartadas"/"ocultar
  // vistas" sacan del loop lo ya resuelto (visto o descartado) sin
  // borrar la marca -- son solo filtros de vista. "solo me interesa"
  // es la vía para revisar el acumulado sin que se pierda entre lo
  // demás (issue: "cómo se van a acumular sin ver").
  const [sortBy, setSortBy] = useState("default"); // default | proxima
  // Ocultas por defecto -- el toggle las muestra si querés revisarlas.
  const [ocultarDescartadas, setOcultarDescartadas] = useState(true);
  const [ocultarVistas, setOcultarVistas] = useState(true);
  const [soloInteresa, setSoloInteresa] = useState(false);
  // Novedades = ítems sin NINGUNA marca (ni 👍, ni 👎, ni vista). Opuesto a "solo me
  // interesa", así que activar uno apaga el otro. "Solo pendientes" (series con algo
  // visto y episodios emitidos por ver) se combina con cualquiera.
  const [soloNovedades, setSoloNovedades] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const puedePendientes = categoria === "Series" || categoria === "Animación";
  useEffect(() => { setSoloPendientes(false); }, [categoria]);
  // Estreno pasó de "ocultar" a "solo" -- como filtro negativo casi no
  // se notaba (13/32 en un carrusel no es un cambio visible claro);
  // como filtro positivo sí sirve para "qué puedo ver todavía en el
  // cine" (15 días desde pubDate). Producción se sacó entera -- con
  // 1-2 ítems en producción a la vez el toggle no tenía nada real que
  // mostrar/ocultar.
  const [soloEstrenos, setSoloEstrenos] = useState(false);
  const [ocultarTrending, setOcultarTrending] = useState(false);
  const esPelicula = categoria === "Películas";
  const sortedItems = React.useMemo(() => {
    let arr = fullItems;
    if (soloInteresa) {
      // Mutuamente excluyente con descartada/vista por construcción
      // (un ítem tiene un solo estado a la vez) -- no hace falta
      // aplicar esos dos filtros encima.
      arr = arr.filter(it => estadoEfectivo(cineEstado, it.guid) === "interesa");
    } else if (soloNovedades) {
      arr = arr.filter(it => estadoEfectivo(cineEstado, it.guid) === "sin_marca");
    } else {
      if (ocultarDescartadas) arr = arr.filter(it => estadoEfectivo(cineEstado, it.guid) !== "descartada");
      if (ocultarVistas) arr = arr.filter(it => estadoEfectivo(cineEstado, it.guid) !== "vista");
    }
    if (puedePendientes && soloPendientes) {
      arr = arr.filter(it => { const a = avanceDe(it.guid); return !!a && a.vistos > 0 && a.pendientes > 0; });
    }
    if (esPelicula && soloEstrenos) arr = arr.filter(it => esEstreno(it));
    if (esPelicula && ocultarTrending) arr = arr.filter(it => !esTrending(it));
    if (sortBy === "proxima") {
      // "Próxima a salir" = solo lo que todavía no se estrenó (peli) o
      // cuya próxima temporada todavía no se estrenó (serie/anime) --
      // antes ordenaba TODO el catálogo por días-restantes-en-cartelera,
      // que es otra cosa (cuánto le queda antes de salir de cartelera,
      // no cuándo entra).
      function diasHastaEstreno(it) {
        if (esPelicula) return esEnProduccion(it) ? diasParaEstreno(it) : null;
        if (!it.nextEpisodeDate) return null;
        const dias = Math.ceil((new Date(it.nextEpisodeDate).getTime() - Date.now()) / 86400000);
        return dias >= 0 ? dias : null;
      }
      arr = arr.filter(it => diasHastaEstreno(it) != null);
      arr.sort((a, b) => diasHastaEstreno(a) - diasHastaEstreno(b));
    }
    // Fuera de cartelera agrupado al final, cualquiera sea el orden
    // elegido arriba -- issue #12: agrupado aparte, no mezclado.
    const enCartelera = arr.filter(it => !it._fueraDeCartelera);
    const fueraDeCartelera = arr.filter(it => it._fueraDeCartelera);
    return fueraDeCartelera.length ? [...enCartelera, ...fueraDeCartelera] : arr;
  }, [fullItems, sortBy, ocultarDescartadas, ocultarVistas, soloInteresa, soloNovedades, soloPendientes, puedePendientes, soloEstrenos, ocultarTrending, esPelicula, cineEstado, avVersion]);

  const total = sortedItems.length;
  // Al cambiar el catálogo filtrado/ordenado (o de categoría), volver al
  // principio -- el `pos` anterior podía corresponder a un índice sin
  // sentido en la lista nueva.
  useEffect(() => { setPosBoth(0); }, [sortedItems.length, sortBy, ocultarDescartadas, ocultarVistas, soloInteresa, soloNovedades, soloPendientes, soloEstrenos, ocultarTrending, categoria]);

  function irARandom() {
    if (sortedItems.length < 2) return;
    let idx = Math.floor(Math.random() * sortedItems.length);
    if (idx === Math.round(posRef.current)) idx = (idx + 1) % sortedItems.length;
    animateTo(idx);
  }

  const toolbarBtn = (active) => ({
    fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "5px 11px", borderRadius: 20,
    border: "1px solid", cursor: "pointer", whiteSpace: "nowrap",
    background: active ? "#fff" : "transparent", color: active ? "#111" : "#999",
    borderColor: active ? "#fff" : "#333",
  });
  const simklStatus = useSimklSyncStatus();
  const toolbar = (
    <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", justifyContent: "center", flexWrap: "wrap" }}>
      <button onClick={() => setSortBy(sortBy === "proxima" ? "default" : "proxima")} style={toolbarBtn(sortBy === "proxima")}>📅 próxima a salir</button>
      <button onClick={() => { setSoloInteresa(v => !v); setSoloNovedades(false); }} style={toolbarBtn(soloInteresa)}>🔖 solo me interesa</button>
      <button onClick={() => { setSoloNovedades(v => !v); setSoloInteresa(false); }} style={toolbarBtn(soloNovedades)} title="Sin 👍, 👎 ni vista">🆕 solo novedades</button>
      {puedePendientes && (
        <button onClick={() => setSoloPendientes(v => !v)} style={toolbarBtn(soloPendientes)} title="Con episodios vistos y episodios emitidos por ver">📺 solo pendientes</button>
      )}
      <button onClick={() => setOcultarVistas(v => !v)} style={toolbarBtn(ocultarVistas)}>👁️ ocultar vistas</button>
      <button onClick={() => setOcultarDescartadas(v => !v)} style={toolbarBtn(ocultarDescartadas)}>🚫 ocultar no me interesa</button>
      <button onClick={irARandom} style={toolbarBtn(false)}>🎲 sorpréndeme</button>
      {esPelicula && (
        <React.Fragment>
          <button onClick={() => setSoloEstrenos(v => !v)} style={toolbarBtn(soloEstrenos)}>🎬 solo estrenos</button>
          <button onClick={() => setOcultarTrending(v => !v)} style={toolbarBtn(ocultarTrending)}>🔥 ocultar trending</button>
        </React.Fragment>
      )}
      {!simklStatus.conectado && (
        <button onClick={pedirSimklAuth} style={toolbarBtn(false)} title="Conectar este dispositivo con la sincronización de Simkl">🔗 conectar Simkl</button>
      )}
      {simklStatus.conectado && simklStatus.estado === "syncing" && (
        <span style={{ ...toolbarBtn(false), cursor: "default", opacity: 0.7 }}>⏳ sincronizando...</span>
      )}
      {simklStatus.conectado && simklStatus.estado === "ok" && (
        <span style={{ ...toolbarBtn(true), cursor: "default" }} title={`Última sincronización: ${simklStatus.ultimoOk}`}>✓ Simkl</span>
      )}
      {simklStatus.conectado && simklStatus.estado === "error" && (
        <button
          onClick={() => { alert(`Simkl no pudo sincronizar:\n\n${simklStatus.ultimoError || "error desconocido"}\n\nToco reintentar ahora.`); flushSimklQueue(); }}
          style={{ ...toolbarBtn(false), borderColor: "#c0392b", color: "#e74c3c", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >⚠️ Simkl: {simklStatus.ultimoError || "error"} (tocar)</button>
      )}
      {simklStatus.conectado && simklStatus.estado === "idle" && (
        <span style={{ ...toolbarBtn(false), cursor: "default", opacity: 0.5 }}>🔗 Simkl conectado</span>
      )}
    </div>
  );

  if (!sortedItems.length) {
    return (
      <div>
        {toolbar}
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
          {(() => {
            const av = estadoAvance();
            if (puedePendientes && soloPendientes) {
              if (av.error === "sin-auth") return "para ver pendientes hay que conectar Simkl";
              if (!av.hayDatos) return av.cargando ? "cargando tu avance…" : "no se pudo leer el avance de Simkl";
              return "ninguna serie con pendientes";
            }
            if (soloNovedades) return "no quedan novedades sin marcar";
            return "nada por acá todavía";
          })()}
        </div>
      </div>
    );
  }

  const arrowStyle = {
    position: "absolute", top: "38%", transform: "translateY(-50%)", zIndex: 300,
    background: "rgba(20,20,20,0.75)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff", fontSize: 18, width: 52, height: 52, borderRadius: 26, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  // Ventana chica de tarjetas alrededor de la posición actual -- ya no
  // hace falta triplicar el catálogo entero como con el scroll nativo,
  // el módulo resuelve el loop directo en cada índice.
  const baseIdx = Math.round(pos);
  const WINDOW = 6;
  const slots = [];
  for (let o = -WINDOW; o <= WINDOW; o++) {
    const rawIdx = baseIdx + o;
    const realIdx = ((rawIdx % total) + total) % total;
    slots.push({ offset: o, item: sortedItems[realIdx], dist: rawIdx - pos });
  }

  return (
    <div>
      {toolbar}
      <div style={{ position: "relative" }}>
      <button onClick={() => step(-1)} style={{ ...arrowStyle, left: 6 }}>◀️</button>
      <button onClick={() => step(1)} style={{ ...arrowStyle, right: 6 }}>▶️</button>
      <div
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{
          position: "relative", height: 380, touchAction: "none", perspective: 2600, overflow: "hidden",
          padding: "16px 0 12px", userSelect: "none", cursor: "grab",
        }}>
        {slots.map(({ offset, item, dist }) => {
          const rotate = Math.max(-40, Math.min(40, dist * 40));
          const scale = 1 - Math.min(0.25, Math.abs(dist) * 0.15);
          const isCenter = Math.abs(dist) < 0.5;
          // Resguardo extra sobre el GAP/ángulo ya corregidos: si igual
          // queda algo de invasión visual por la rotación 3D, que no se
          // note -- el texto de una tarjeta lateral no tiene que
          // competir por lectura con el de la central de cualquier forma.
          const textOpacity = Math.max(0.15, 1 - Math.abs(dist) * 0.5);
          const temporada = seasonLabel(item);
          const estadoItem = cineEstado[item.guid];
          const itemEstado = estadoEfectivo(cineEstado, item.guid);
          const descartada = itemEstado === "descartada";
          const vista = itemEstado === "vista";
          const interesa = itemEstado === "interesa";
          const nuevo = itemEstado === "sin_marca" && esNuevo(item);
          const restantes = diasRestantesCartelera(item);
          const enProduccion = esEnProduccion(item);
          const diasEstreno = enProduccion ? diasParaEstreno(item) : null;
          const ratingVista = vista ? CINE_RATINGS.find(r => r.id === estadoItem?.rating) : null;
          const trending = esTrending(item);
          const fueraDeCartelera = !!item._fueraDeCartelera;
          const deSimkl = !!item._deSimkl;
          return (
            <div key={offset} data-cine-tap={offset} style={{
              position: "absolute", top: 16, left: "50%", width: CARD_W,
              marginLeft: -CARD_W / 2, cursor: "pointer",
              transform: `translateX(${dist * ITEM_W}px) rotateY(${-rotate}deg) scale(${scale})`,
              transformOrigin: "center center",
              zIndex: Math.round(100 - Math.abs(dist) * 10),
            }}>
              <div style={{
                position: "relative", borderRadius: 8, overflow: "hidden",
                // "interesa" se marca con un anillo verde -- es el único
                // de los tres estados de decisión que no tenía ninguna
                // señal visual propia en el póster (descartada tiene la
                // franja, vista el ribbon; interesa se veía igual que
                // sin marcar).
                boxShadow: [
                  isCenter ? "0 12px 32px rgba(0,0,0,0.7)" : "0 10px 30px rgba(0,0,0,0.6)",
                  interesa ? "0 0 0 3px #2ecc71" : isCenter ? "0 0 0 2px rgba(255,255,255,0.15)" : null,
                ].filter(Boolean).join(", "),
                transition: "box-shadow 0.15s",
              }}>
                {item.image
                  ? <img src={item.image} alt="" style={{
                      width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block",
                      filter: descartada ? "grayscale(1)" : "none",
                    }} onError={e => { e.target.style.display = "none"; }} />
                  : <div style={{ width: "100%", aspectRatio: "2/3", background: "#1a1a1a" }} />
                }
                {/* Franja diagonal — misma posición para "no me interesa"
                    y para la etiqueta de reseña de "vista" (una u otra,
                    nunca ambas a la vez para el mismo ítem). */}
                {descartada && (
                  <div style={{
                    position: "absolute", top: 14, left: -34, width: 140, transform: "rotate(-45deg)",
                    background: "#e74c3c", color: "#fff", textAlign: "center",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    padding: "3px 0", boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}>NO ME INTERESA</div>
                )}
                {/* Ribbon de reseña ("vista") y badge "nuevo" comparten la
                    misma esquina (arriba-derecha) -- son mutuamente
                    excluyentes: nuevo solo aplica en sin_marca, y deja de
                    aplicar apenas se marca vista, así que nunca compiten
                    por el espacio al mismo tiempo. */}
                {vista && ratingVista && (
                  <div style={{ position: "absolute", top: 6, right: 6, width: 34, height: 34, borderRadius: "50%", background: "#f5c518",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                    {ratingVista.emoji}
                  </div>
                )}
                {nuevo && (
                  <div style={{
                    position: "absolute", top: 6, right: 6, background: "#2ecc71", color: "#111",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, padding: "3px 7px",
                    borderRadius: 5, letterSpacing: 0.3,
                  }}>NUEVO</div>
                )}
                {/* "Fuera de cartelera" -- issue #12: la marca "interesa"
                    sobrevive a que build-cine.mjs deje de traer el ítem
                    (cartelera activa se le pasó, catálogo cumplió los 30
                    días). Mismo lugar que "nuevo"/"vista": mutuamente
                    excluyente con ambos (esto solo se pinta si el estado
                    es "interesa", nunca "sin_marca" ni "vista" a la vez). */}
                {fueraDeCartelera && !nuevo && !vista && (
                  <div style={{
                    position: "absolute", top: 6, right: 6, background: "#333", color: "#ccc",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 8, fontWeight: 700, padding: "3px 6px",
                    borderRadius: 5, letterSpacing: 0.2, textAlign: "right", lineHeight: 1.3,
                  }}>FUERA DE<br/>CARTELERA</div>
                )}
                {/* "Bajo el radar" (issue #14): entró a la Vitrina porque
                    está en tu lista real de Simkl, no porque cine.json lo
                    haya traído por trending -- mismo slot, mutuamente
                    excluyente con los anteriores por construcción (ver
                    simklExtra, nunca se solapa con exemptExtra/items). */}
                {deSimkl && !nuevo && !vista && !fueraDeCartelera && (
                  <div style={{
                    position: "absolute", top: 6, right: 6, background: "#2a4d3a", color: "#7fd99a",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 8, fontWeight: 700, padding: "3px 6px",
                    borderRadius: 5, letterSpacing: 0.2, textAlign: "right", lineHeight: 1.3,
                  }}>TU LISTA<br/>SIMKL</div>
                )}
                {/* "Interesa" -- además del anillo verde del póster, un
                    ícono explícito arriba-izquierda (mutuamente excluyente
                    con la franja de "no me interesa" que va en ese mismo
                    lugar) para que se distinga de un ítem sin marcar de
                    un vistazo, no solo por el borde. */}
                {interesa && (
                  <div style={{
                    position: "absolute", top: 6, left: 6, width: 26, height: 26, borderRadius: "50%",
                    background: "#2ecc71", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}>👍</div>
                )}
                {/* Trending -- esquina inferior izquierda, para que el
                    toggle "ocultar trending" tenga algo visible que
                    confirme qué se está ocultando/mostrando. */}
                {trending && (
                  <div style={{
                    position: "absolute", bottom: 22, left: 6, width: 24, height: 24, borderRadius: "50%",
                    background: "rgba(230,80,20,0.92)", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}>🔥</div>
                )}
                {/* Franja inferior: cuenta regresiva al estreno si todavía
                    no se estrenó, o días restantes en cartelera si ya
                    se estrenó -- mutuamente excluyentes por definición
                    (pubDate futura vs. pasada). */}
                {enProduccion && diasEstreno != null ? (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(52,152,219,0.9)", color: "#fff",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, textAlign: "center", padding: "3px 0",
                  }}>{diasEstreno > 0 ? `estrena en ${diasEstreno}d` : "estrena hoy"}</div>
                ) : restantes != null && (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(46,204,113,0.9)", color: "#111",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, textAlign: "center", padding: "3px 0",
                  }}>{restantes > 0 ? `${restantes}d en cartelera` : "sale hoy"}</div>
                )}
              </div>
              <div style={{ opacity: textOpacity }}>
              <div style={{ fontFamily: "'Caveat',cursive", fontWeight: 700, fontSize: 18, color: "#fff", marginTop: 6, textAlign: "center", lineHeight: 1.15, minHeight: 42, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
                {(() => {
                  const score = item.rating?.imdb ?? item.rating?.tmdb ?? null;
                  return (
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: score != null ? "#f5c518" : "#666" }}>
                      {score != null ? `★ ${score.toFixed(1)}` : "TBD"}
                    </span>
                  );
                })()}
                {temporada && (
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#999", borderLeft: "1px solid #444", paddingLeft: 6 }}>{temporada}</span>
                )}
                {(() => {
                  const av = avanceDe(item.guid);
                  const pend = av && av.vistos > 0 && av.pendientes > 0 ? av.pendientes : null;
                  return pend ? <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#f5c518", borderLeft: "1px solid #444", paddingLeft: 6 }}>🎞 {pend} pend.</span> : null;
                })()}
              </div>
              {/* minHeight fijo -- antes esta fila desaparecía del todo
                  cuando el ítem no tenía badge de estado, y eso corría
                  verticalmente todo lo de abajo (el reflejo) respecto a
                  las tarjetas vecinas que sí lo tenían. Sumado a que el
                  título de arriba tampoco reservaba alto fijo entre 1 y
                  2 líneas, las tarjetas de la fila terminaban con altos
                  totales distintos y, con alignItems:"center", los
                  pósters quedaban centrados en puntos verticales
                  distintos entre sí -- eso era lo que se veía "corrido". */}
              <div style={{ minHeight: 13, marginTop: 2 }}>
                {(() => {
                  const badge = STATUS_BADGE[item.status];
                  if (!badge) return null;
                  return (
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: badge.color, textAlign: "center", letterSpacing: 0.3 }}>
                      {badge.label}
                      {item.status === "Returning Series" && item.nextEpisodeDate ? ` · ${item.nextEpisodeDate}` : ""}
                    </div>
                  );
                })()}
              </div>
              </div>
              {item.image && (
                <div style={{ width: "100%", height: 42, overflow: "hidden", marginTop: 4 }}>
                  <div style={{
                    width: "100%", aspectRatio: "2/3",
                    backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center",
                    transform: "scaleY(-1)", opacity: 0.2,
                    maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3), transparent 85%)",
                    WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3), transparent 85%)",
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

