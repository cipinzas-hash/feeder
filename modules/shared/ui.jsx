const { useState, useEffect, useRef } = React;


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

// ─── TabBar — Noticias / Vitrina, fijo abajo, siempre visible ──────────────
export function TabBar({ area, onChange, buzonCount, onOpenBuzon }) {
  const tabBtn = (active) => ({
    flex: 1, background: "transparent", border: "none", cursor: "pointer",
    padding: "10px 6px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700,
    color: active ? "#fff" : "#666", borderTop: active ? "2px solid #e91e8c" : "2px solid transparent",
  });
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: "var(--angst-podcast-h, 0px)", display: "flex", background: "#111", zIndex: 40, paddingBottom: "env(safe-area-inset-bottom)" }}>
      <button onClick={() => onChange("noticias")} style={tabBtn(area === "noticias")}>📰 Noticias</button>
      <button onClick={() => onChange("vitrina")} style={tabBtn(area === "vitrina")}>🎬 Vitrina</button>
      <button onClick={onOpenBuzon} style={tabBtn(false)}>📌 {buzonCount}</button>
    </div>
  );
}

