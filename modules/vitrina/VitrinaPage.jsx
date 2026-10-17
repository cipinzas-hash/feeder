import { CAT_COLORS, VITRINA_CATEGORIAS } from "../shared/constants.js";
import { ArchivedFeed } from "./videoteca.jsx";
import { MeleeFeed } from "./melee.jsx";
import { CineCoverFlow, CineExtendedView } from "./cine.jsx";
import { fetchVitrinaData } from "../shared/catalog.js";
import { useAltoLibre } from "../shared/ui.jsx";

const { useState, useEffect, useRef } = React;


const VITRINA_ICONS = { "Películas": "🎬", "Series": "📺", "Animación": "⛩️", "Microdocumentales": "🎥", "Melee": "🕹️", "Conciertos": "🎪" };
// ─── VitrinaView — carrusel de Destacados (Películas/Series/Animación) ─────
// Segmented control fijo arriba, sin auto-alternancia: se queda en la
// categoría elegida hasta que el usuario cambia manualmente. Muestra el
// catálogo completo de 30 días, no solo lo cargado en la cola de Noticias.
export function VitrinaView({ vitrinaData, vitrinaCat, onChangeCat, onOpen, generatedAt, aviso, cargando }) {
  const items = vitrinaData[vitrinaCat] || [];
  // La vista llena la pantalla hasta el pie de Angst (que queda visible, no
  // empujado fuera por un min-height de 100vh). El carrusel de cine se reparte
  // solo el espacio libre (ver CineCoverFlow): tarjetas más grandes y centradas.
  const raiz = useRef(null);
  const alto = useAltoLibre(raiz, 0);
  const segBtn = (active) => ({
    flex: 1, padding: "9px 4px", fontSize: 20,
    border: "1px solid", borderRadius: 20, cursor: "pointer",
    background: active ? (CAT_COLORS[vitrinaCat] || "#e91e8c") : "transparent",
    color: active ? "#111" : "#999",
    borderColor: active ? (CAT_COLORS[vitrinaCat] || "#e91e8c") : "#333",
  });
  return (
    <div ref={raiz} style={{ paddingBottom: 16, background: "#111", minHeight: alto || "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 6, padding: "16px 18px 12px" }}>
        {VITRINA_CATEGORIAS.map(cat => (
          <button key={cat} onClick={() => onChangeCat(cat)} title={cat} style={segBtn(cat === vitrinaCat)}>{VITRINA_ICONS[cat] || cat}</button>
        ))}
      </div>
      {aviso && (
        <div style={{
          margin: "0 18px 8px", padding: "8px 12px", borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 12,
          display: "flex", alignItems: "center", gap: 10,
          background: aviso.tono === "error" ? "rgba(231,76,60,0.15)" : aviso.tono === "aviso" ? "rgba(245,197,24,0.13)" : "rgba(255,255,255,0.06)",
          color: aviso.tono === "error" ? "#ff8a7a" : aviso.tono === "aviso" ? "#f5c518" : "#aaa",
        }}>
          <span style={{ flex: 1 }}>{aviso.texto}</span>
          {aviso.accion && <button onClick={aviso.accion.fn} style={{ background: "transparent", border: "1px solid currentColor", color: "inherit", borderRadius: 14, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>{aviso.accion.label}</button>}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Categorías de lista (no carrusel) vacías: decirlo, en vez de dejar la pantalla en blanco. */}
        {!cargando && items.length === 0 && ["Microdocumentales", "Conciertos", "Melee"].includes(vitrinaCat) && (
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#666", textAlign: "center", padding: "50px 20px" }}>
            no hay ítems en esta categoría por ahora
          </div>
        )}
        {vitrinaCat === "Microdocumentales"
          ? <ArchivedFeed items={items} storageKey="angst-feed-microdocs-vistos-v1" />
          : vitrinaCat === "Melee"
          ? <MeleeFeed items={items} />
          : vitrinaCat === "Conciertos"
          ? <ArchivedFeed items={items} storageKey="angst-feed-conciertos-vistos-v1" />
          : <CineCoverFlow items={items} onOpen={onOpen} generatedAt={generatedAt} categoria={vitrinaCat} />
        }
      </div>
    </div>
  );
}

// ─── VitrinaPage — shell del módulo (antes vivía dentro de FeedPage) ────────
// Navegación propia: siguiente/anterior operan sobre vitrinaData[vitrinaCat].
// Los datos salen de fetchVitrinaData (cine, melee y videoteca: ~0,4 MB), sin
// el throttle de 4h: es un catálogo de consulta, no una cola que se consume.
// Vitrina es independiente de Feed: no escribe en su Buzón ni navega hacia él
// (lo que se guarda de Vitrina vive en simkl).
function VitrinaPage() {
  const [vitrinaCat, setVitrinaCat] = useState("Películas");
  const [vitrinaData, setVitrinaData] = useState({ "Películas": [], "Series": [], "Animación": [], "Microdocumentales": [], "Melee": [], "Conciertos": [] });
  const [vitrinaOpenItem, setVitrinaOpenItem] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  // Estado de la carga: antes un fallo de red (o un JSON vacío) dejaba la pantalla
  // en blanco sin distinguirse de "no hay nada".
  const [carga, setCarga] = useState({ cargando: true, error: null, fuentes: null });

  function cargar() {
    setCarga(c => ({ ...c, cargando: true, error: null }));
    fetchVitrinaData()
      .then(({ vitrina, fuentes, generatedAt: g }) => {
        setVitrinaData(v => ({ ...v, ...vitrina }));
        setGeneratedAt(g);
        setCarga({ cargando: false, error: null, fuentes });
      })
      .catch(e => setCarga({ cargando: false, error: e.message || "error", fuentes: e.fuentes || null }));
  }
  useEffect(() => { cargar(); }, []);

  const NOMBRE_FUENTE = { cine: "cine.json", melee: "melee.json", videoteca: "videoteca.json" };
  const fuenteDe = c => c === "Melee" ? "melee" : (c === "Microdocumentales" || c === "Conciertos") ? "videoteca" : "cine";
  const hayDatos = Object.values(vitrinaData).some(a => a.length > 0);
  const reintentar = { label: "reintentar", fn: cargar };
  let aviso = null;
  const f = carga.fuentes?.[fuenteDe(vitrinaCat)];
  if (carga.cargando && !hayDatos) aviso = { tono: "info", texto: "cargando catálogo…" };
  else if (carga.error) aviso = { tono: "error", texto: "No se pudo cargar el catálogo (¿sin conexión?).", accion: reintentar };
  else if (f && !f.ok) aviso = { tono: "error", texto: `No se pudo leer ${NOMBRE_FUENTE[fuenteDe(vitrinaCat)]}: se muestra lo que haya.`, accion: reintentar };
  else if (f?.generatedAt) {
    const horas = (Date.now() - new Date(f.generatedAt).getTime()) / 3600000;
    if (horas > 72) aviso = { tono: "aviso", texto: `Datos de hace ${Math.round(horas / 24)} días: la actualización automática no está corriendo.` };
  }

  function stepItem(item, delta) {
    const list = vitrinaData[vitrinaCat] || [];
    const idx = list.findIndex(i => i.guid === item.guid);
    if (idx === -1 || !list.length) { setVitrinaOpenItem(null); return; }
    setVitrinaOpenItem(list[(idx + delta + list.length) % list.length]);
  }

  if (vitrinaOpenItem) {
    return (
      <CineExtendedView item={vitrinaOpenItem} onBack={() => setVitrinaOpenItem(null)}
        onNext={() => stepItem(vitrinaOpenItem, 1)}
        onChangeCategory={() => stepItem(vitrinaOpenItem, -1)} />
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <VitrinaView vitrinaData={vitrinaData} vitrinaCat={vitrinaCat} onChangeCat={setVitrinaCat} onOpen={item => setVitrinaOpenItem(item)} generatedAt={generatedAt} aviso={aviso} cargando={carga.cargando} />
    </div>
  );
}

export default VitrinaPage;
