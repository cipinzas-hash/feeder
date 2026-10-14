import { marcarEdicionLocal } from "../shared/localedit.js";
const { useState, useEffect, useRef } = React;


// ─── ArchivedFeed — Micro Docs y Conciertos como videoteca persistente
// (issue #8). Reemplaza a MicrodocFeed/ConcertFeed, que eran casi idénticos.
// Ya no hay corte de 30 días para estas dos categorías (ver build-feed.mjs,
// RETENTION_DAYS ahora las exime igual que Podcasts) — el propósito de este
// componente es justamente no perder ese archivo dentro de un scroll infinito:
// bucket "NUEVOS" (ventana de NUEVOS_DIAS por pubDate) + archivo colapsable
// por año/mes debajo, con tabs de canal (item.source) cuando hay más de uno.
// Los embeds usan LazyEmbed (IntersectionObserver) para no montar todos los
// iframes de una — con meses de archivo acumulado eso sería carísimo.
// Storage keys sin cambiar respecto a MicrodocFeed/ConcertFeed a propósito:
// conserva las marcas de "visto" que ya existían en el dispositivo.
function loadArchivedVistos(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) { return new Set(); }
}
function saveArchivedVistos(storageKey, set) {
  try { localStorage.setItem(storageKey, JSON.stringify([...set])); } catch (e) {}
  marcarEdicionLocal();
}

const ARCHIVEDFEED_NUEVOS_DIAS = 20;
const ARCHIVEDFEED_MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function LazyEmbed({ videoId, title }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !ref.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "400px 0px" });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [visible]);
  return (
    <div ref={ref} style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", background: "#000" }}>
      {visible && (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </div>
  );
}

function ArchivedFeedCard({ item, visto, onToggleVisto, onNoInteresa, showSource }) {
  return (
    <div style={{
      padding: "22px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      opacity: visto ? 0.55 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2, flex: 1 }}>{item.title}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <button onClick={onToggleVisto} style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
            border: "1px solid " + (visto ? "#333" : "#26a69a"), borderRadius: 14, padding: "4px 10px",
            background: "transparent", color: visto ? "#666" : "#26a69a", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {visto ? "✓ visto" : "marcar visto"}
          </button>
          <button onClick={onNoInteresa} style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
            border: "1px solid #4a2f2f", borderRadius: 14, padding: "4px 10px",
            background: "transparent", color: "#a35a5a", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            no me interesa
          </button>
        </div>
      </div>
      {showSource && item.source && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{item.source}</div>
      )}
      {item.summary && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 12 }}>
          {item.summary}
        </div>
      )}
      {item.videoId ? (
        <LazyEmbed videoId={item.videoId} title={item.title} />
      ) : (
        <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#26a69a" }}>ver original ↗</a>
      )}
    </div>
  );
}

function ArchivedFeedCanalTabs({ canales, canal, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 14px", WebkitOverflowScrolling: "touch" }}>
      {canales.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          flexShrink: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700,
          border: "1px solid " + (c === canal ? "#26a69a" : "#333"), borderRadius: 14, padding: "5px 12px",
          background: c === canal ? "#26a69a" : "transparent", color: c === canal ? "#111" : "#999",
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          {c}
        </button>
      ))}
    </div>
  );
}

export function ArchivedFeed({ items, storageKey }) {
  const [vistos, setVistos] = useState(() => loadArchivedVistos(storageKey));
  const noInteresaKey = storageKey + "-no-interesa";
  const [noInteresa, setNoInteresa] = useState(() => loadArchivedVistos(noInteresaKey));
  const [canal, setCanal] = useState("Todos");
  const [openPeriods, setOpenPeriods] = useState(() => new Set());

  function toggleVisto(guid) {
    setVistos(prev => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid); else next.add(guid);
      saveArchivedVistos(storageKey, next);
      return next;
    });
  }
  // No hay toggle de vuelta desde la UI: una vez marcado "no me interesa" el
  // ítem desaparece (de NUEVOS y del archivo), no hay afordancia para
  // deshacerlo. Igual queda en localStorage por si hace falta limpiar a mano.
  function marcarNoInteresa(guid) {
    setNoInteresa(prev => {
      const next = new Set(prev);
      next.add(guid);
      saveArchivedVistos(noInteresaKey, next);
      return next;
    });
  }
  function togglePeriodo(key) {
    setOpenPeriods(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const canales = [...new Set(items.map(i => i.source).filter(Boolean))];
  const showCanalTabs = canales.length > 1;
  const filtered = (!showCanalTabs || canal === "Todos") ? items : items.filter(i => i.source === canal);
  // "no me interesa" saca el ítem de todo el componente, no solo de NUEVOS.
  const visibles = filtered.filter(i => !noInteresa.has(i.guid));
  const sorted = [...visibles].sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));

  const cutoff = Date.now() - ARCHIVEDFEED_NUEVOS_DIAS * 86400000;
  // Marcar visto (además de no me interesa) también saca el ítem de NUEVOS
  // aunque siga adentro de la ventana de días — pasa directo al archivo.
  const nuevos = sorted.filter(i => i.pubDate && new Date(i.pubDate).getTime() >= cutoff && !vistos.has(i.guid));
  const resto = sorted.filter(i => !nuevos.includes(i));

  const porPeriodo = new Map();
  resto.forEach(item => {
    const d = item.pubDate ? new Date(item.pubDate) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "sin-fecha";
    if (!porPeriodo.has(key)) porPeriodo.set(key, []);
    porPeriodo.get(key).push(item);
  });
  const periodosOrdenados = [...porPeriodo.keys()].sort().reverse();

  return (
    <div style={{ padding: "6px 18px 30px" }}>
      {showCanalTabs && (
        <ArchivedFeedCanalTabs canales={["Todos", ...canales]} canal={canal} onChange={setCanal} />
      )}

      {!sorted.length && (
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
          nada por acá todavía
        </div>
      )}

      {nuevos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#26a69a", marginBottom: 4 }}>NUEVOS</div>
          {nuevos.map(item => (
            <ArchivedFeedCard key={item.guid} item={item} visto={vistos.has(item.guid)} onToggleVisto={() => toggleVisto(item.guid)} onNoInteresa={() => marcarNoInteresa(item.guid)} showSource={showCanalTabs} />
          ))}
        </div>
      )}

      {periodosOrdenados.length > 0 && (
        <div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#666", marginBottom: 8 }}>ARCHIVO</div>
          {periodosOrdenados.map(key => {
            const [anio, mesNum] = key.split("-");
            const label = key === "sin-fecha" ? "sin fecha" : `${ARCHIVEDFEED_MESES[parseInt(mesNum, 10) - 1]} ${anio}`;
            const isOpen = openPeriods.has(key);
            const periodoItems = porPeriodo.get(key);
            return (
              <div key={key} style={{ marginBottom: 2 }}>
                <button onClick={() => togglePeriodo(key)} style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.08)",
                  padding: "10px 4px", cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: "#ccc" }}>{isOpen ? "▾" : "▸"} {label}</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#555" }}>{periodoItems.length}</span>
                </button>
                {isOpen && periodoItems.map(item => (
                  <ArchivedFeedCard key={item.guid} item={item} visto={vistos.has(item.guid)} onToggleVisto={() => toggleVisto(item.guid)} onNoInteresa={() => marcarNoInteresa(item.guid)} showSource={showCanalTabs} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
