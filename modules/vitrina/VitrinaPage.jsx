import { CAT_COLORS, VITRINA_CATEGORIAS } from "../shared/constants.js";
import { ArchivedFeed, PodcastFeed } from "./videoteca.jsx";
import { MeleeFeed } from "./melee.jsx";
import { CineCoverFlow, CineExtendedView } from "./cine.jsx";
import { TabBar } from "../shared/ui.jsx";
import { fetchFeedData } from "../shared/catalog.js";
import { addToFeedBuzon, countFeedBuzon } from "../shared/buzon.js";

const { useState, useEffect, useRef } = React;


const VITRINA_ICONS = { "Películas": "🎬", "Series": "📺", "Animación": "⛩️", "Microdocumentales": "🎥", "Melee": "🕹️", "Conciertos": "🎪" };
// ─── VitrinaView — carrusel de Destacados (Películas/Series/Animación) ─────
// Segmented control fijo arriba, sin auto-alternancia: se queda en la
// categoría elegida hasta que el usuario cambia manualmente. Muestra el
// catálogo completo de 30 días, no solo lo cargado en la cola de Noticias.
export function VitrinaView({ vitrinaData, vitrinaCat, onChangeCat, onOpen, generatedAt }) {
  const items = vitrinaData[vitrinaCat] || [];
  const segBtn = (active) => ({
    flex: 1, padding: "9px 4px", fontSize: 20,
    border: "1px solid", borderRadius: 20, cursor: "pointer",
    background: active ? (CAT_COLORS[vitrinaCat] || "#e91e8c") : "transparent",
    color: active ? "#111" : "#999",
    borderColor: active ? (CAT_COLORS[vitrinaCat] || "#e91e8c") : "#333",
  });
  return (
    <div style={{ paddingBottom: 70, background: "#111", minHeight: "100vh" }}>
      <div style={{ padding: "16px 18px 4px" }}>
        <span style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: "#fff" }}>🎬 vitrina audiovisual</span>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 18px" }}>
        {VITRINA_CATEGORIAS.map(cat => (
          <button key={cat} onClick={() => onChangeCat(cat)} title={cat} style={segBtn(cat === vitrinaCat)}>{VITRINA_ICONS[cat] || cat}</button>
        ))}
      </div>
      {vitrinaCat === "Microdocumentales"
        ? <ArchivedFeed items={items} storageKey="angst-feed-microdocs-vistos-v1" />
        : vitrinaCat === "Podcasts"
        ? <PodcastFeed items={items} />
        : vitrinaCat === "Melee"
        ? <MeleeFeed items={items} />
        : vitrinaCat === "Conciertos"
        ? <ArchivedFeed items={items} storageKey="angst-feed-conciertos-vistos-v1" />
        : <CineCoverFlow items={items} onOpen={onOpen} generatedAt={generatedAt} categoria={vitrinaCat} />
      }
    </div>
  );
}

// ─── VitrinaPage — shell del módulo (antes vivía dentro de FeedPage) ────────
// Navegación propia: guardar/siguiente/anterior operan sobre
// vitrinaData[vitrinaCat]. Los datos salen del mismo fetchFeedData que usa
// Feed (la parte que no es Noticias), sin el throttle de 4h: es un catálogo
// de consulta, no una cola que se consume.
// onGoFeed({ buzon: true }) abre Feed directo en el Buzón (tab 📌).
function VitrinaPage({ onExit, onGoFeed }) {
  const ExitBtn = () => (
    <button onClick={onExit} title="Volver a Angst" style={{ position: "fixed", top: "calc(10px + env(safe-area-inset-top))", right: 12, zIndex: 999, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: 20, width: 34, height: 34, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
  );
  const [vitrinaCat, setVitrinaCat] = useState("Películas");
  const [vitrinaData, setVitrinaData] = useState({ "Películas": [], "Series": [], "Animación": [], "Microdocumentales": [], "Podcasts": [], "Melee": [], "Conciertos": [] });
  const [vitrinaOpenItem, setVitrinaOpenItem] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { vitrina, generatedAt: g } = await fetchFeedData();
        if (vitrina) setVitrinaData(v => ({ ...v, ...vitrina }));
        if (g) setGeneratedAt(g);
      } catch (e) { /* silencioso: sin red, la Vitrina queda con lo que ya tenga */ }
    })();
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 1800); }

  function handleVitrinaSave(item) {
    const added = addToFeedBuzon(item);
    showToast(added ? `guardado en ${item.categoria}` : "ya estaba en el buzón");
  }
  function stepItem(item, delta) {
    const list = vitrinaData[vitrinaCat] || [];
    const idx = list.findIndex(i => i.guid === item.guid);
    if (idx === -1 || !list.length) { setVitrinaOpenItem(null); return; }
    setVitrinaOpenItem(list[(idx + delta + list.length) % list.length]);
  }

  const toastEl = toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#111", padding: "8px 18px", borderRadius: 20, fontFamily: "'Caveat',cursive", fontSize: 15, fontWeight: 700, zIndex: 200 }}>{toast}</div>;

  if (vitrinaOpenItem) {
    return (
      <>
        <CineExtendedView item={vitrinaOpenItem} onBack={() => setVitrinaOpenItem(null)}
          onNext={() => stepItem(vitrinaOpenItem, 1)}
          onSave={() => handleVitrinaSave(vitrinaOpenItem)}
          onChangeCategory={() => stepItem(vitrinaOpenItem, -1)} />
        {toastEl}
        <ExitBtn/>
      </>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {toastEl}
      <VitrinaView vitrinaData={vitrinaData} vitrinaCat={vitrinaCat} onChangeCat={setVitrinaCat} onOpen={item => setVitrinaOpenItem(item)} generatedAt={generatedAt} />
      <TabBar area="vitrina" onChange={a => { if (a === "noticias" && onGoFeed) onGoFeed(); }} buzonCount={countFeedBuzon()} onOpenBuzon={() => onGoFeed && onGoFeed({ buzon: true })} />
      <ExitBtn/>
    </div>
  );
}

export default VitrinaPage;
