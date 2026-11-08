const { useState, useEffect, useLayoutEffect, useRef } = React;


// ─── Ventana emergente de papel (Presupuesto) ───────────────────────────────
// Marco único de las ventanas emergentes de Presupuesto (formularios, listas y confirmaciones): papel blanco, borde punteado #111,
// sombra dura, cabecera negra con título en Caveat y texto en DM Sans (R7). Una sola pieza: no se copia entre ventanas (N1).
//   z: capa (las que se abren desde otra ventana quedan más abajo que las que se abren sobre ellas) · arriba: pegada arriba
//   (para teclado) · estiloMarco: ajustes puntuales del marco (alto máximo, scroll propio).
export function Ventana({ onClose, ancho = 440, z = 1001, arriba = false, estiloMarco, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: z, display: "flex", alignItems: arriba ? "flex-start" : "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", paddingTop: arriba ? "calc(env(safe-area-inset-top, 0px) + 6px)" : 0 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 14, overflow: "hidden", boxShadow: "6px 6px 0 #111", width: `min(96vw,${ancho}px)`, maxHeight: "92vh", display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif", color: "#111", ...estiloMarco }}>
        {children}
      </div>
    </div>
  );
}
export function VentanaCabecera({ titulo, sub, onClose }) {
  return (
    <div style={{ background: "#111", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
      <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>{titulo}{sub != null ? <> <span style={{ fontSize: 14, color: "#888" }}>{sub}</span></> : null}</div>
      <button onClick={onClose} aria-label="cerrar" style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
    </div>
  );
}

// Gestos removidos — la navegación es 100% por botones (ver StoryCard/ExtendedView).
export const btnGhost = { flex: 1, background: "transparent", border: "1px dashed #444", color: "#aaa", borderRadius: 10, padding: "10px 6px", fontFamily: "'DM Sans',sans-serif", fontSize: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 };

// ─── Compartir por WhatsApp ─────────────────────────────────────────────────
// wa.me abre WhatsApp (app o web) con el mensaje precargado, el usuario elige
// el contacto ahí mismo. Sin SDK, sin permisos — es solo un link.
export function shareToWhatsApp(item) {
  const text = encodeURIComponent(`${item.title}\n${item.link}`);
  window.open(`https://wa.me/?text=${text}`, "_blank");
}

// ─── FormatoTag — badges retro tipo Pokémon (TXT/VID/AUD), hasta 2 por item,
// el de medio (VID/AUD) primero si existe, TXT después. Mismo color por
// etiqueta siempre, independiente de la categoría (CAT_COLORS es un eje
// distinto). Sombra dura offset sin blur, esquinas chicas — no píldora.
const FORMATO_BADGE_COLORS = { TXT: "#6b7280", VID: "#e0483e", AUD: "#9b59d0" };

function formatoBadges(item) {
  const badges = [];
  if (item.formato === "cine") {
    if (item.trailer && item.trailer.key) badges.push("VID");
    if (item.summary) badges.push("TXT");
  } else if (item.formato === "musica") {
    const hasVideo = item.tipo === "video" && !!item.videoId;
    const hasAudio = !!item.bandcampEmbedUrl || !!item.soundcloudEmbedUrl;
    if (hasVideo) badges.push("VID");
    else if (hasAudio) badges.push("AUD");
    if (item.fullText) badges.push("TXT");
  } else {
    // formato "lectura" — incluye Melee (tipo:"video", sin fullText → solo VID)
    if (item.tipo === "video") badges.push("VID");
    else if (item.tipo === "podcast") badges.push("AUD");
    if (item.fullText) badges.push("TXT");
  }
  return badges;
}

export function FormatoTag({ item }) {
  const badges = formatoBadges(item);
  if (!badges.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
      {badges.map(b => (
        <span key={b} style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 800,
          letterSpacing: "0.04em", color: "#fff", background: FORMATO_BADGE_COLORS[b],
          padding: "3px 8px", borderRadius: 4, boxShadow: "2px 2px 0 rgba(0,0,0,0.45)",
        }}>{b}</span>
      ))}
    </div>
  );
}

// ─── useAltoDe — alto actual de un elemento propio ──────────────────────────
// Para componentes que escalan a su contenedor (p. ej. el carrusel de Vitrina).
// El alto lo da el marco por CSS (flex); acá solo se lee con ResizeObserver, sin
// medir la pantalla. `deps`: re-engancha si el elemento se monta más tarde.
export function useAltoDe(ref, deps = []) {
  const [alto, setAlto] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setAlto(el.clientHeight);
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, ...deps]);
  return alto;
}

// ─── useDesborde — válvula y aviso (lineamiento 4.5) ────────────────────────
// Si el contenido de `ref` no cabe colapsado (`activo`), devuelve true y avisa en
// consola: quien lo use pone scroll en vez de recortar. Es un detector, no una
// solución: si se activa, el módulo hay que rediseñarlo. Una sola pieza para
// todos los módulos (norma N1/N4).
export function useDesborde(ref, nombre, activo = true) {
  const [desborda, setDesborda] = useState(false);
  const medirRef = useRef(null);
  useLayoutEffect(() => {
    medirRef.current = () => {
      const el = ref.current;
      const over = el && activo ? el.scrollHeight - el.clientHeight : 0;
      if (over > 1) console.warn(`[${nombre}] desborda colapsado: ${over}px — revisar alturas (R2)`);
      setDesborda(over > 1);
    };
    medirRef.current();
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => medirRef.current && medirRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return desborda;
}

// ─── useAltoLibre — OBSOLETO (norma N1): solo lo usa MarcoAngst, que solo usa Feed ─
// Alto que queda en pantalla bajo un elemento. Se elimina cuando Feed pase al marco.
// Descuenta el pie de Angst (.ftr, frase + logo) para que el pie se vea sin
// scrollear: el contenido de una vista llena la pantalla y el pie queda justo
// debajo. Se mide en vivo (el encabezado y el pie pueden cambiar de alto).
// `reserva`: px extra que la vista deja bajo el elemento (p. ej. un padding).
// `deps`: si algo que está encima del elemento cambia de alto, re-medir.
export function useAltoLibre(ref, minimo = 460, reserva = 0, deps = []) {
  const [alto, setAlto] = useState(null);
  useLayoutEffect(() => {
    function medir() {
      const el = ref.current;
      if (!el) return;
      const arriba = el.getBoundingClientRect().top + window.scrollY;
      const pie = document.querySelector(".ftr");
      const altoPie = pie ? pie.offsetHeight + 8 : 0; // + margin-top del pie
      const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      setAlto(Math.max(minimo, Math.round(vh - arriba - altoPie - reserva)));
    }
    medir();
    const t = setTimeout(medir, 350);
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, deps);
  return alto;
}

// ─── MarcoAngst — OBSOLETO (N1): contenedor de las vistas de Feed (Vitrina ya no lo usa) ──
// Antes cada vista era position:fixed + inset:0 y tapaba todo el marco de
// Angst (encabezado, pestañas, pie). Ahora vive dentro del marco, como los
// demás módulos: mismo ancho máximo (480) y la altura que queda entre las
// pestañas y el pie. Las vistas largas siguen scrolleando por dentro, con el
// mismo contenedor flex de antes.
export function MarcoAngst({ children, style }) {
  const ref = useRef(null);
  const alto = useAltoLibre(ref);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", height: alto || "70vh", overflow: "hidden", display: "flex", flexDirection: "column", boxSizing: "border-box", ...style }}>
      {children}
    </div>
  );
}

