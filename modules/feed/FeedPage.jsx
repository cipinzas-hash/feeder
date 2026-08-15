    const { useState, useEffect, useRef } = React;

    // ─── Fuente de datos: los JSON que arman los GitHub Actions ─────────────────
    // Si tu rama por defecto no es "main", este es el único lugar que hay que tocar.
    const FEED_JSON_URL = "https://raw.githubusercontent.com/cipinzas-hash/feeder/main/modules/feed/data/feed.json";
    const CINE_JSON_URL = "https://raw.githubusercontent.com/cipinzas-hash/feeder/main/modules/feed/data/cine.json";

    // Destacados (vitrina audiovisual) — 3 categorías separadas, cada una su
    // propio carrusel. Ya no participan del swipe round-robin de "Noticias".
    const CINE_CATEGORIAS = ["Películas", "Series", "Animación"];
    // Microdocumentales vive en Vitrina también, pero NO es carrusel de posters
    // (es un feed vertical de video+comentario) — por eso es una categoría aparte
    // de CINE_CATEGORIAS aunque comparta la misma exclusión del round-robin.
    const VITRINA_CATEGORIAS = [...CINE_CATEGORIAS, "Microdocumentales", "Podcasts", "Melee", "Conciertos"];
    const VITRINA_ICONS = { "Películas": "🎬", "Series": "📺", "Animación": "⛩️", "Microdocumentales": "🎥", "Podcasts": "🎙️", "Melee": "🕹️", "Conciertos": "🎪" };
    const NOTICIAS_CATEGORIA = "Noticias"; // RSS cine/TV/anime — vive en el área "Noticias", no en Vitrina
    const MUSIC_CATEGORIA = "Dark scene / Música";

    // Colores por categoría — reusa acentos que ya existen en Angst (melee/pokemon/gym/fadiman)
    const CAT_COLORS = {
      "Melee": "#ff6600",
      "Pokémon TCG": "#ffcc00",
      "Gaming": "#5c9cff",
      "Noticias": "#e91e8c",
      "Películas": "#e91e8c",
      "Series": "#e91e8c",
      "Animación": "#e91e8c",
      "Microdocumentales": "#26a69a",
      "Podcasts": "#ffcc00",
      "Dark scene / Música": "#7b4fd4",
      "Ciencia / Conocimiento": "#2e7d52",
      "Tecnología": "#26a69a",
      "Poliamor": "#aac756",
    };

    // ─── STATUS_BADGE — traduce item.status (crudo de TMDb para pelis/series,
    // de Jikan para anime) a lo que Cristopher realmente quiere saber al ver
    // una tarjeta en Vitrina: ¿esto es un estreno, sigue en emisión, o es una
    // serie vieja ya terminada? "Released" (pelis) no se muestra — es el caso
    // normal y no aporta nada, solo ruido.
    const STATUS_BADGE = {
      "Returning Series": { label: "EN EMISIÓN", color: "#4caf7d" },
      "In Production": { label: "EN PRODUCCIÓN", color: "#5c9cff" },
      "Planned": { label: "PRÓXIMAMENTE", color: "#5c9cff" },
      "Pilot": { label: "PILOTO", color: "#5c9cff" },
      "Post Production": { label: "POST-PRODUCCIÓN", color: "#5c9cff" },
      "Ended": { label: "FINALIZADA", color: "#888" },
      "Canceled": { label: "CANCELADA", color: "#888" },
      "Currently Airing": { label: "EN EMISIÓN", color: "#4caf7d" },
      "Finished Airing": { label: "FINALIZADA", color: "#888" },
      "Not yet aired": { label: "PRÓXIMAMENTE", color: "#5c9cff" },
    };

    // Solo aplica a Series (item.numberOfSeasons viene de TMDb, ver
    // build-cine.mjs). En emisión: temporada actual en curso. Terminada/
    // cancelada: total de temporadas que tuvo.
    function seasonLabel(item) {
      if (item.categoria !== "Series" || !item.numberOfSeasons) return null;
      if (item.status === "Returning Series" && item.currentSeason) return `T${item.currentSeason} en curso`;
      return item.numberOfSeasons === 1 ? "1 temporada" : `${item.numberOfSeasons} temporadas`;
    }

    // ─── Discriminador "formato" → decide StoryCard/ExtendedView vs sus versiones
    // de cine (CineStoryCard/CineExtendedView) o música (MusicStoryCard/
    // MusicExtendedView). Deliberadamente distinto de "item.tipo" (que ya existe
    // y controla video/podcast/texto DENTRO del mismo StoryCard) — son dos ejes
    // distintos: "tipo" es la acción central de un item de lectura, "formato"
    // decide qué layout completo de tarjeta se usa.
    const FORMATO_BY_CATEGORIA = {
      "Películas": "cine",
      "Series": "cine",
      "Animación": "cine",
      [MUSIC_CATEGORIA]: "musica",
    };

    // Tabla de componentes por formato — referencia funciones declaradas más abajo
    // en el archivo (function declarations, hoisted, así que el orden no importa).
    // "cine" ya no tiene Story: Vitrina reemplazó el swipe de una tarjeta a la vez
    // por el carrusel (CineCoverFlow) + detalle (CineExtendedView).
    function cardsFor(formato) {
      if (formato === "cine") return { Story: null, Extended: CineExtendedView };
      if (formato === "musica") return { Story: MusicStoryCard, Extended: MusicExtendedView };
      return { Story: StoryCard, Extended: ExtendedView };
    }


    const REFRESH_THROTTLE_MS = 4 * 60 * 60 * 1000; // 4 horas
    const STORAGE_KEY = "angst-feed-proto-v1";

    // ─── Orden round-robin entre categorías (no cronológico puro) ──────────────
    // Se mantiene igual — el JSON ya viene agrupado por categoría, esto solo
    // decide el orden de aparición.
    function roundRobinMerge(byCategoryArrays) {
      const queues = byCategoryArrays.map(c => ({ cat: c.cat, items: [...c.items] }));
      const out = [];
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const q of queues) {
          if (q.items.length) { out.push(q.items.shift()); progressed = true; }
        }
      }
      return out;
    }

    // ─── Fetch de datos: dos JSON (feed de lectura + cine), fusionados por categoría ──
    // Ambos Actions ya hicieron el trabajo pesado del lado del servidor. Acá solo
    // se lee y se etiqueta con "formato" para que el render sepa qué layout de
    // tarjeta usar (no confundir con "item.tipo", que sigue intacto para video/
    // podcast/texto dentro del StoryCard normal). Si cine.json no existe todavía
    // o falla, el feed de lectura sigue funcionando igual — no es fuente obligatoria.
    async function fetchJsonSafe(url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
      } catch (e) { return null; }
    }

    async function fetchFeedData() {
      const [feedData, cineData] = await Promise.all([
        fetchJsonSafe(FEED_JSON_URL),
        fetchJsonSafe(CINE_JSON_URL),
      ]);
      if (!feedData && !cineData) throw new Error("no se pudo leer ni feed.json ni cine.json");

      const merged = {}; // cat -> items[]
      function ingest(data, formatoDefault) {
        if (!data) return;
        for (const c of (data.categories || [])) {
          const formato = FORMATO_BY_CATEGORIA[c.cat] || formatoDefault;
          const items = (c.items || []).map(it => ({ ...it, formato }));
          merged[c.cat] = [...(merged[c.cat] || []), ...items];
        }
      }
      ingest(feedData, "lectura");
      ingest(cineData, "cine");

      // Vitrina (Películas/Series/Animación/Microdocumentales) sale del round-robin
      // de Noticias — es un catálogo aparte, siempre completo.
      const vitrina = {};
      const feedCats = [];
      for (const [cat, items] of Object.entries(merged)) {
        if (VITRINA_CATEGORIAS.includes(cat)) vitrina[cat] = items;
        else feedCats.push({ cat, items });
      }

      const diag = feedCats.map(c => ({
        cat: c.cat,
        count: c.items.length,
        withText: c.items.filter(i => (i.tipo === "video" && i.videoId) || i.fullText).length,
      }));
      const generatedAt = feedData?.generatedAt || cineData?.generatedAt || null;
      return { queue: roundRobinMerge(feedCats), vitrina, diag, generatedAt };
    }

    // ─── Storage (clave propia — al integrarse a Angst, pasa a la regla vital) ──
    async function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    }
    function saveState(state) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
    // Solo para esta etapa de pruebas — borra el estado y recarga, para no
    // depender de la consola del navegador cada vez que el throttle de 4h molesta.
    function resetTestState() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      window.location.reload();
    }

    // Gestos removidos — la navegación es 100% por botones (ver StoryCard/ExtendedView).
    const btnGhost = { flex: 1, background: "transparent", border: "1px dashed #444", color: "#aaa", borderRadius: 10, padding: "10px 6px", fontFamily: "'DM Sans',sans-serif", fontSize: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 };

    // ─── Acción principal según tipo de contenido ──────────────────────────────
    // texto (default, sin campo "tipo" en el item) → leer · video → ver · podcast → escuchar.
    // Todo lo demás (navegación, botones, orden round-robin) queda idéntico —
    // esto solo decide el ícono/label del botón central y qué renderiza ExtendedView.
    function primaryAction(tipo) {
      if (tipo === "video") return { icon: "▶️", label: "ver" };
      if (tipo === "podcast") return { icon: "🎧", label: "escuchar" };
      return { icon: "⬆️", label: "leer" };
    }

    // ─── Compartir por WhatsApp ─────────────────────────────────────────────────
    // wa.me abre WhatsApp (app o web) con el mensaje precargado, el usuario elige
    // el contacto ahí mismo. Sin SDK, sin permisos — es solo un link.
    function shareToWhatsApp(item) {
      const text = encodeURIComponent(`${item.title}\n${item.link}`);
      window.open(`https://wa.me/?text=${text}`, "_blank");
    }

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

    async function exportCineShareImage(item, onError) {
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

    function FormatoTag({ item }) {
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

    // ─── StoryCard ───────────────────────────────────────────────────────────────
    // Navegación 100% por botones: ⬅️ cambiar categoría · ⬆️ leer completo ·
    // ➡️ leer siguiente · ⬇️ guardar · 🔀 shuffle (reordena lo que queda en cola,
    // no trae nada nuevo — no rompe la lógica de "scroll sano").
    function StoryCard({ item, onSkip, onExpand, onSave, onChangeCategory, onShuffle, onOpenBuzon, onOpenDiag, hasDiag, onRefresh, canRefresh, refreshing, buzonCount }) {
      const color = CAT_COLORS[item.categoria] || "#888";
      const [imgFailed, setImgFailed] = useState(false);
      useEffect(() => { setImgFailed(false); }, [item.guid]);
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", display: "flex", flexDirection: "column", userSelect: "none" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {item.image && !imgFailed
              ? <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} onError={() => setImgFailed(true)} />
              : <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg, ${color}33, #0a0a0a)` }} />
            }
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.55))" }} />
            <div style={{ position: "absolute", top: 16, left: 16, right: 58, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#111", background: color, borderRadius: 20, padding: "4px 12px", fontWeight: 700 }}>{item.categoria}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={onOpenBuzon} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>📌 {buzonCount}</button>
                <button onClick={onShuffle} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: "pointer" }}>🔀</button>
                <button onClick={onOpenDiag} disabled={!hasDiag} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: hasDiag ? "pointer" : "default", opacity: hasDiag ? 1 : 0.3 }}>🩺</button>
                <button onClick={onRefresh} disabled={!canRefresh || refreshing} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: (!canRefresh || refreshing) ? "default" : "pointer", opacity: (!canRefresh || refreshing) ? 0.35 : 1 }}>{refreshing ? "…" : "↻"}</button>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 20px 16px" }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{item.source}</div>
              <FormatoTag item={item} />
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 10 }}>{item.title}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{item.summary}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "10px 10px calc(10px + 50px + env(safe-area-inset-bottom))", background: "#111" }}>
            <button onClick={onChangeCategory} style={btnGhost}><span style={{ fontSize: 17 }}>⬅️</span>categoría</button>
            <button onClick={onSave} style={btnGhost}><span style={{ fontSize: 17 }}>⬇️</span>guardar</button>
            <button onClick={onExpand} style={{ ...btnGhost, background: color, color: "#111", borderColor: color }}><span style={{ fontSize: 17 }}>{primaryAction(item.tipo).icon}</span>{primaryAction(item.tipo).label}</button>
            <button onClick={onSkip} style={btnGhost}><span style={{ fontSize: 17 }}>➡️</span>siguiente</button>
          </div>
        </div>
      );
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

    // ─── CineExtendedView — formato "cine" del detalle ──────────────────────────
    // ─── Estado de Cine (interesa/descartada/vista) — decisión tomada en el
    // detalle, después de tráiler/sinopsis (nunca desde el póster del carrusel,
    // que es puramente de exhibición). Clave propia de localStorage, aislada
    // del blob principal (mismo patrón que PODCASTS_ESCUCHADOS_KEY), pero se
    // cose al export/import general (ver core/persistence.js) porque acá sí
    // aplica la regla de "toda la info entra al export".
    //   sin_marca  -> default, sin decisión tomada aún
    //   interesa   -> guarda copia completa del item (título/imagen/sinopsis/
    //                 trailer/rating) para sobrevivir a la poda de 30 días de
    //                 build-cine.mjs, que no sabe nada de este estado
    //   descartada -> no me interesa
    //   vista      -> rating obligatorio (4 categorías) + nota opcional
    const CINE_ESTADO_KEY = "angst-cine-estado-v1";
    const CINE_NUEVO_MS = 7 * 86400000; // 1 semana desde firstSeenAt
    const CINE_RATINGS = [
      { id: "unwatchable", emoji: "💀", label: "unwatchable" },
      { id: "forgettable", emoji: "😐", label: "forgettable" },
      { id: "remarkable", emoji: "✨", label: "remarkable" },
      { id: "outstanding", emoji: "🏆", label: "outstanding" },
    ];
    function loadCineEstado() {
      try {
        const raw = localStorage.getItem(CINE_ESTADO_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    }
    let cineEstadoCache = loadCineEstado();
    const cineEstadoListeners = new Set();
    function saveCineEstado(map) {
      cineEstadoCache = map;
      try { localStorage.setItem(CINE_ESTADO_KEY, JSON.stringify(map)); } catch (e) {}
      cineEstadoListeners.forEach(fn => fn(map));
    }
    // patch=null borra la entrada (vuelve a sin_marca)
    function setCineItemEstado(guid, patch) {
      const next = { ...cineEstadoCache };
      if (patch === null) delete next[guid];
      else next[guid] = { ...(next[guid] || {}), ...patch };
      saveCineEstado(next);
    }
    function useCineEstadoMap() {
      const [map, setMap] = useState(cineEstadoCache);
      useEffect(() => {
        cineEstadoListeners.add(setMap);
        return () => cineEstadoListeners.delete(setMap);
      }, []);
      return map;
    }
    function diasRestantesCartelera(item) {
      if (!item.firstSeenAt) return null;
      const RETENTION_MS = 30 * 86400000;
      const elapsed = Date.now() - new Date(item.firstSeenAt).getTime();
      return Math.max(0, Math.ceil((RETENTION_MS - elapsed) / 86400000));
    }
    function esNuevo(item) {
      if (!item.firstSeenAt) return false;
      return Date.now() - new Date(item.firstSeenAt).getTime() <= CINE_NUEVO_MS;
    }
    // Ciclo de vida real de la película, independiente de cuándo Angst la
    // descubrió (eso es "nuevo", basado en firstSeenAt). Estas tres van por
    // pubDate (= release_date real de TMDb) y por el flag trending que arma
    // build-cine.mjs -- no son excluyentes entre sí.
    function esEstreno(item) {
      // Recién en cine: se estrenó hace menos de 30 días, ya estrenada (no
      // futura). Una peli vieja que resurge en trending no cuenta como
      // estreno solo por eso -- esa es la etiqueta "trending", separada.
      if (!item.pubDate) return false;
      const t = new Date(item.pubDate).getTime();
      if (Date.now() < t) return false;
      return Date.now() - t <= 30 * 86400000;
    }
    function esEnProduccion(item) {
      if (!item.pubDate) return false;
      return new Date(item.pubDate).getTime() > Date.now();
    }
    function diasParaEstreno(item) {
      if (!item.pubDate) return null;
      const dias = Math.ceil((new Date(item.pubDate).getTime() - Date.now()) / 86400000);
      return dias >= 0 ? dias : null;
    }
    function esTrending(item) {
      return !!item.trending;
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

    function CineExtendedView({ item, onBack, onNext, onSave, onChangeCategory, hideActions, onExportImage }) {
      const cineEstado = useCineEstadoMap();
      const estadoItem = cineEstado[item.guid];
      const estado = estadoItem?.estado || "sin_marca";
      const [reviewOpen, setReviewOpen] = useState(false);
      function marcar(nuevoEstado) {
        if (nuevoEstado === "interesa") {
          // Copia completa: tiene que sobrevivir a la poda de 30 días de
          // build-cine.mjs, que no sabe que esto está marcado "interesa".
          setCineItemEstado(item.guid, { estado: "interesa", item });
        } else if (nuevoEstado === "sin_marca") {
          setCineItemEstado(item.guid, null);
        } else {
          setCineItemEstado(item.guid, { estado: nuevoEstado });
        }
      }
      function guardarReview(ratingId, nota) {
        setCineItemEstado(item.guid, { estado: "vista", rating: ratingId, nota: nota || "" });
        setReviewOpen(false);
      }
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
            {item.image && (
              <img src={item.image} alt="" style={{ width: 120, borderRadius: 10, float: "left", marginRight: 14, marginBottom: 10 }} onError={e => { e.target.style.display = "none"; }} />
            )}
            <FormatoTag item={item} />
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>{item.title}</div>
            <div style={{ marginBottom: 12 }}><RatingBadges rating={item.rating} size="lg" /></div>
            <div style={{ clear: "both" }} />

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

            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: 18 }}>
              {item.summary}
            </div>

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
              {/* Oculta si ya está vista -- interesa/no-interesa no tiene
                  sentido una vez vista, la reseña ya la reemplaza. También
                  oculta mientras se escribe la reseña: estaba justo encima
                  del formulario y un toque accidental acá perdía el
                  borrador. */}
              {!reviewOpen && estado !== "vista" && (
                <div style={{ display: "flex", gap: 6, padding: "10px 10px 4px", background: "#111" }}>
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
    function CineCoverFlow({ items, onOpen, generatedAt, categoria }) {
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
      // Las marcadas "interesa" llevan copia completa del item justamente para
      // sobrevivir a la poda de 30 días de build-cine.mjs (que no sabe nada de
      // este estado) — si build-cine ya la sacó de `items`, la reinyectamos acá
      // desde la copia local para que no desaparezca del carrusel. Filtra por
      // `categoria` explícito, no solo por ausencia en `items` -- si no,
      // cualquier "interesa" de Películas se colaba también en el carrusel de
      // Series/Animación (bug real: no estaba en `items` de esa categoría por
      // ser de otra, así que el chequeo de ausencia daba falso positivo).
      const exemptExtra = React.useMemo(() => Object.values(cineEstado)
        .filter(e => e.estado === "interesa" && e.item
          && (!categoria || e.item.categoria === categoria)
          && !items.some(it => it.guid === e.item.guid))
        .map(e => e.item), [cineEstado, items, categoria]);
      const fullItems = exemptExtra.length ? [...items, ...exemptExtra] : items;

      // Orden y filtro del carrusel: por defecto el orden del catálogo tal
      // cual llega; "próxima" prioriza lo que menos le queda en cartelera
      // (lo sin firstSeenAt queda al final); "rating" prioriza mejor
      // puntuado externo (IMDb/TMDb, lo sin rating al final). "ocultar
      // descartadas" saca del loop lo marcado "no me interesa" sin borrar
      // la marca -- es solo un filtro de vista.
      const [sortBy, setSortBy] = useState("default"); // default | proxima | rating
      // Ocultas por defecto -- el toggle las muestra si querés revisarlas.
      const [ocultarDescartadas, setOcultarDescartadas] = useState(true);
      // Etiquetas de ciclo de vida (estreno/producción/trending) -- no son
      // excluyentes entre sí, cada toggle "apaga" (oculta) independiente.
      // Solo tienen sentido en Películas -- Series/Animación no traen pubDate
      // ni trending del build todavía.
      const [ocultarEstreno, setOcultarEstreno] = useState(false);
      const [ocultarProduccion, setOcultarProduccion] = useState(false);
      const [ocultarTrending, setOcultarTrending] = useState(false);
      const esPelicula = categoria === "Películas";
      const sortedItems = React.useMemo(() => {
        let arr = fullItems;
        if (ocultarDescartadas) {
          arr = arr.filter(it => cineEstado[it.guid]?.estado !== "descartada");
        }
        if (esPelicula && ocultarEstreno) arr = arr.filter(it => !esEstreno(it));
        if (esPelicula && ocultarProduccion) arr = arr.filter(it => !esEnProduccion(it));
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
        } else if (sortBy === "rating") {
          // De mejor a peor puntuada, y recién después las sin puntuar
          // (las que quedaron en "me interesa" sin crítica externa todavía)
          // -- no mezcladas entre las puntuadas.
          const puntuadas = arr.filter(it => (it.rating?.imdb ?? it.rating?.tmdb) != null);
          const sinPuntuar = arr.filter(it => (it.rating?.imdb ?? it.rating?.tmdb) == null);
          puntuadas.sort((a, b) => (b.rating?.imdb ?? b.rating?.tmdb) - (a.rating?.imdb ?? a.rating?.tmdb));
          arr = [...puntuadas, ...sinPuntuar];
        }
        return arr;
      }, [fullItems, sortBy, ocultarDescartadas, ocultarEstreno, ocultarProduccion, ocultarTrending, esPelicula, cineEstado]);

      const total = sortedItems.length;
      // Al cambiar el catálogo filtrado/ordenado (o de categoría), volver al
      // principio -- el `pos` anterior podía corresponder a un índice sin
      // sentido en la lista nueva.
      useEffect(() => { setPosBoth(0); }, [sortedItems.length, sortBy, ocultarDescartadas, ocultarEstreno, ocultarProduccion, ocultarTrending, categoria]);

      const toolbarBtn = (active) => ({
        fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "5px 11px", borderRadius: 20,
        border: "1px solid", cursor: "pointer", whiteSpace: "nowrap",
        background: active ? "#fff" : "transparent", color: active ? "#111" : "#999",
        borderColor: active ? "#fff" : "#333",
      });
      const toolbar = (
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setSortBy(sortBy === "proxima" ? "default" : "proxima")} style={toolbarBtn(sortBy === "proxima")}>📅 próxima a salir</button>
          <button onClick={() => setSortBy(sortBy === "rating" ? "default" : "rating")} style={toolbarBtn(sortBy === "rating")}>⭐ rating</button>
          <button onClick={() => setOcultarDescartadas(v => !v)} style={toolbarBtn(ocultarDescartadas)}>🚫 ocultar no me interesa</button>
          {esPelicula && (
            <React.Fragment>
              <button onClick={() => setOcultarEstreno(v => !v)} style={toolbarBtn(ocultarEstreno)}>🎬 ocultar estreno</button>
              <button onClick={() => setOcultarProduccion(v => !v)} style={toolbarBtn(ocultarProduccion)}>🏗️ ocultar producción</button>
              <button onClick={() => setOcultarTrending(v => !v)} style={toolbarBtn(ocultarTrending)}>🔥 ocultar trending</button>
            </React.Fragment>
          )}
        </div>
      );

      if (!sortedItems.length) {
        return (
          <div>
            {toolbar}
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
              nada por acá todavía
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
              const itemEstado = estadoItem?.estado || "sin_marca";
              const descartada = itemEstado === "descartada";
              const vista = itemEstado === "vista";
              const interesa = itemEstado === "interesa";
              const nuevo = itemEstado === "sin_marca" && esNuevo(item);
              const restantes = diasRestantesCartelera(item);
              const enProduccion = esEnProduccion(item);
              const diasEstreno = enProduccion ? diasParaEstreno(item) : null;
              const ratingVista = vista ? CINE_RATINGS.find(r => r.id === estadoItem.rating) : null;
              const trending = esTrending(item);
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

    // ─── MusicStoryCard — formato "musica": el reproductor es lo primero que se ve,
    // no algo escondido dentro del detalle. Si el item trae tipo:"video" (YouTube
    // encontrado por el Action, ver build-feed.mjs), el cerrado muestra el thumbnail
    // con badge de play — tocar "escuchar" abre el embed real recién en el detalle
    // (mismo criterio de liviandad que CineStoryCard: nada de iframe hasta que se
    // pide). Si no hay video (post que no es de release, ej. entrevista/tour), cae
    // a un cerrado de texto simple — no todo en un blog de música es "para escuchar".
    function MusicStoryCard({ item, onSkip, onExpand, onSave, onChangeCategory, onShuffle, onOpenBuzon, onOpenDiag, hasDiag, onRefresh, canRefresh, refreshing, buzonCount }) {
      const color = CAT_COLORS[item.categoria] || "#7b4fd4";
      const hasVideo = item.tipo === "video" && item.videoId;
      const hasBandcamp = !!item.bandcampEmbedUrl;
      const hasSoundcloud = !!item.soundcloudEmbedUrl;
      const hasListen = hasVideo || hasBandcamp || hasSoundcloud;
      // Solo YouTube tiene una URL de thumbnail trivial; Bandcamp/SoundCloud no —
      // para esos se usa el mismo placeholder degradé que cine, con el badge de play.
      const thumb = hasVideo ? `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` : null;
      const [imgFailed, setImgFailed] = useState(false);
      useEffect(() => { setImgFailed(false); }, [item.guid]);
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", display: "flex", flexDirection: "column", userSelect: "none" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", top: 16, left: 16, right: 58, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, zIndex: 5 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#111", background: color, borderRadius: 20, padding: "4px 12px", fontWeight: 700 }}>{item.categoria}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={onOpenBuzon} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>📌 {buzonCount}</button>
                <button onClick={onShuffle} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: "pointer" }}>🔀</button>
                <button onClick={onOpenDiag} disabled={!hasDiag} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: hasDiag ? "pointer" : "default", opacity: hasDiag ? 1 : 0.3 }}>🩺</button>
                <button onClick={onRefresh} disabled={!canRefresh || refreshing} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 16, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: (!canRefresh || refreshing) ? "default" : "pointer", opacity: (!canRefresh || refreshing) ? 0.35 : 1 }}>{refreshing ? "…" : "↻"}</button>
              </div>
            </div>

            {hasListen ? (
              <div onClick={onExpand} style={{ width: "84%", maxWidth: 340, cursor: "pointer" }}>
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", boxShadow: `0 20px 50px -10px ${color}55` }}>
                  {thumb && !imgFailed
                    ? <img src={thumb} alt="" style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} onError={() => setImgFailed(true)} />
                    : <div style={{ width: "100%", aspectRatio: "16/9", background: `linear-gradient(160deg, ${color}44, #0a0a0a)` }} />
                  }
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>▶️</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "0 30px", textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.summary}</div>
              </div>
            )}

            <div style={{ marginTop: 18, textAlign: "center", padding: "0 24px" }}>
              <FormatoTag item={item} />
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{item.source}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "10px 10px calc(10px + 50px + env(safe-area-inset-bottom))", background: "#111" }}>
            <button onClick={onChangeCategory} style={btnGhost}><span style={{ fontSize: 17 }}>⬅️</span>categoría</button>
            <button onClick={onSave} style={btnGhost}><span style={{ fontSize: 17 }}>⬇️</span>guardar</button>
            <button onClick={onExpand} style={{ ...btnGhost, background: color, color: "#111", borderColor: color }}>
              <span style={{ fontSize: 17 }}>{hasListen ? "▶️" : "⬆️"}</span>{hasListen ? "escuchar" : "detalle"}
            </button>
            <button onClick={onSkip} style={btnGhost}><span style={{ fontSize: 17 }}>➡️</span>siguiente</button>
          </div>
        </div>
      );
    }

    // ─── MusicExtendedView — el embed va arriba de todo, el texto queda como
    // contexto secundario debajo (banda, sello, gira, lo que traiga el blog).
    function MusicExtendedView({ item, onBack, onNext, onSave, onChangeCategory, hideActions }) {
      const color = CAT_COLORS[item.categoria] || "#7b4fd4";
      const hasVideo = item.tipo === "video" && item.videoId;
      const hasBandcamp = !hasVideo && !!item.bandcampEmbedUrl;
      const hasSoundcloud = !hasVideo && !hasBandcamp && !!item.soundcloudEmbedUrl;
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0d0d0d", display: "flex", flexDirection: "column", zIndex: 50 }}>
          <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1a1a" }}>
            <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>←</button>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", flex: 1 }}>{item.source}</span>
            <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>fuente ↗</a>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 30px" }}>
            <FormatoTag item={item} />
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 14, lineHeight: 1.2 }}>{item.title}</div>

            {hasVideo && (
              <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", marginBottom: 16, background: "#000" }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
                  title={item.title}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            )}

            {hasBandcamp && (
              <div style={{ borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <iframe
                  src={item.bandcampEmbedUrl}
                  title={item.title}
                  style={{ width: "100%", height: 120, border: "none" }}
                  seamless
                />
              </div>
            )}

            {hasSoundcloud && (
              <div style={{ borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <iframe
                  src={item.soundcloudEmbedUrl}
                  title={item.title}
                  style={{ width: "100%", height: 166, border: "none" }}
                  allow="autoplay"
                />
              </div>
            )}

            {item.fullText ? (
              <div className="article-body" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: item.fullText }} />
            ) : (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{item.summary}</div>
            )}
          </div>
          {!hideActions && (
            <div style={{ display: "flex", gap: 6, padding: "10px 10px", background: "#111" }}>
              <button onClick={onChangeCategory} style={btnGhost}><span style={{ fontSize: 17 }}>⬅️</span>categoría</button>
              <button onClick={onSave} style={btnGhost}><span style={{ fontSize: 17 }}>⬇️</span>guardar</button>
              <button onClick={() => shareToWhatsApp(item)} style={btnGhost}><span style={{ fontSize: 17 }}>📤</span>compartir</button>
              <button onClick={onNext} style={{ ...btnGhost, background: color, color: "#111", borderColor: color }}><span style={{ fontSize: 17 }}>➡️</span>siguiente</button>
            </div>
          )}
        </div>
      );
    }

    // ─── ExtendedView ────────────────────────────────────────────────────────────
    // El texto completo ya viene resuelto en el item (lo extrajo el Action del
    // lado del servidor) — nada de fetch en vivo acá, por eso no hay estado de carga.
    function ExtendedView({ item, onBack, onNext, onSave, onChangeCategory, hideActions }) {
      const [scrollPct, setScrollPct] = useState(0);

      function onScroll(e) {
        const el = e.target;
        const max = el.scrollHeight - el.clientHeight;
        setScrollPct(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 100);
      }

      const color = CAT_COLORS[item.categoria] || "#fff";

      return (
        <div style={{ position: "fixed", inset: 0, background: "#0d0d0d", display: "flex", flexDirection: "column", zIndex: 50 }}>
          <div style={{ height: 3, background: "#1a1a1a" }}>
            <div style={{ height: "100%", width: `${scrollPct}%`, background: color, transition: "width 0.15s" }} />
          </div>
          <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1a1a" }}>
            <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>←</button>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", flex: 1 }}>{item.source}</span>
            <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>fuente ↗</a>
          </div>
          <div onScroll={onScroll} style={{ flex: 1, overflowY: "auto", padding: "18px 20px 30px" }}>
            <FormatoTag item={item} />
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 14, lineHeight: 1.2 }}>{item.title}</div>

            {item.tipo === "video" && item.videoId ? (
              // Video (ej. Rare Candy en YouTube): se embebe con iframe, nunca se sale de la app.
              // El feed de YouTube no trae texto real que extraer, por eso va el summary como bajada.
              <div>
                <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", marginBottom: 14, background: "#000" }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
                    title={item.title}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{item.summary}</div>
              </div>
            ) : item.tipo === "podcast" && item.audioUrl ? (
              // Podcast (ej. Meta Pod, Uncommon Energy): <audio> nativo con el enclosure del RSS.
              // Show notes ya vienen resueltas como fullText (o summary si el Action no las extrajo).
              <div>
                <audio controls src={item.audioUrl} style={{ width: "100%", marginBottom: 14, colorScheme: "dark" }} />
                {item.fullText ? (
                  <div className="article-body" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: item.fullText }} />
                ) : (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{item.summary}</div>
                )}
              </div>
            ) : item.fullText ? (
              <div className="article-body" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: item.fullText }} />
            ) : (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                el Action no pudo extraer el texto completo de esta en particular.{" "}
                <a href={item.link} target="_blank" rel="noopener" style={{ color }}>ver original ↗</a>
              </div>
            )}
          </div>
          {!hideActions && (
            <div style={{ display: "flex", gap: 6, padding: "10px 10px", background: "#111" }}>
              <button onClick={onChangeCategory} style={btnGhost}><span style={{ fontSize: 17 }}>⬅️</span>categoría</button>
              <button onClick={onSave} style={btnGhost}><span style={{ fontSize: 17 }}>⬇️</span>guardar</button>
              <button onClick={() => shareToWhatsApp(item)} style={btnGhost}><span style={{ fontSize: 17 }}>📤</span>compartir</button>
              <button onClick={onNext} style={{ ...btnGhost, background: color, color: "#111", borderColor: color }}><span style={{ fontSize: 17 }}>➡️</span>siguiente</button>
            </div>
          )}
        </div>
      );
    }

    // ─── EndScreen ───────────────────────────────────────────────────────────────
    function EndScreen({ onGoBuzon, onRefresh, canRefresh, refreshing, nextRefreshAt, refreshMsg, onReset, onOpenDiag, hasDiag }) {
      const [now, setNow] = useState(Date.now());
      useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(iv); }, []);
      const msLeft = nextRefreshAt ? Math.max(0, nextRefreshAt - now) : 0;
      const hLeft = Math.floor(msLeft / 3600000), mLeft = Math.floor((msLeft % 3600000) / 60000);
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 44, fontWeight: 700, color: "#fff" }}>estás al día ✓</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            {refreshMsg || (msLeft > 0 ? `próxima actualización en ${hLeft > 0 ? hLeft + "h " : ""}${mLeft}m` : "ya podés buscar novedades")}
          </div>
          {canRefresh && (
            <button onClick={onRefresh} disabled={refreshing} style={{ background: "#fff", border: "none", color: "#111", borderRadius: 20, padding: "10px 22px", fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: refreshing ? 0.5 : 1 }}>
              {refreshing ? "buscando…" : "↻ buscar novedades"}
            </button>
          )}
          <button onClick={onGoBuzon} style={{ background: "transparent", border: "1px dashed #333", color: "#aaa", borderRadius: 20, padding: "9px 20px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, cursor: "pointer" }}>
            📌 ver buzón
          </button>
          <button onClick={onOpenDiag} disabled={!hasDiag} style={{ background: "transparent", border: "1px dashed #333", color: hasDiag ? "#aaa" : "#333", borderRadius: 20, padding: "9px 20px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, cursor: hasDiag ? "pointer" : "default" }}>
            🩺 ver diagnóstico
          </button>
          <button onClick={onReset} style={{ background: "transparent", border: "none", color: "#333", fontSize: 10, textDecoration: "underline", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: 8 }}>
            🧪 resetear estado (solo para probar)
          </button>
        </div>
      );
    }

    // ─── BuzonView ───────────────────────────────────────────────────────────────
    function BuzonView({ buzon, onClose, onOpen, onRemove }) {
      const [filterCat, setFilterCat] = useState("todas");
      const cats = ["todas", ...Object.keys(CAT_COLORS)];
      const filtered = filterCat === "todas" ? buzon : buzon.filter(b => b.categoria === filterCat);
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", zIndex: 60, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>←</button>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: "#fff" }}>📌 buzón</span>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 18px 12px", overflowX: "auto" }}>
            {cats.map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "5px 12px", borderRadius: 20,
                border: "1px solid", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                background: filterCat === c ? (CAT_COLORS[c] || "#fff") : "transparent",
                color: filterCat === c ? "#111" : "#999",
                borderColor: filterCat === c ? (CAT_COLORS[c] || "#fff") : "#333",
              }}>{c}</button>
            ))}
          </div>
          {CINE_CATEGORIAS.includes(filterCat) && filtered.length > 0 ? (
            <CineCoverFlow items={filtered} onOpen={onOpen} categoria={filterCat} />
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 30px" }}>
              {filtered.length === 0 && <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "40px 0" }}>vacío por ahora</div>}
              {filtered.map(item => (
                <div key={item.guid} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a", alignItems: "center" }}>
                  {item.image && <img src={item.image} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />}
                  <div onClick={() => onOpen(item)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{item.source} · {item.categoria}</div>
                  </div>
                  <button onClick={() => onRemove(item.guid)} style={{ background: "transparent", border: "none", color: "#444", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ─── DiagPanel ───────────────────────────────────────────────────────────────
    // Diagnóstico del último refresh, accesible desde el botón 🩺 en cualquier
    // momento. Ahora es un solo fetch (el JSON del Action), así que el detalle
    // es por categoría — items totales y cuántos con texto completo — más el
    // "generatedAt" del JSON, que dice cuándo corrió el Action de verdad
    // (distinto de cuándo vos revisaste, que es lastRefresh).
    function DiagPanel({ diag, generatedAt, onClose }) {
      const total = diag.reduce((s, d) => s + d.count, 0);
      const totalText = diag.reduce((s, d) => s + d.withText, 0);
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", zIndex: 90, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 18px 8px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>←</button>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: "#fff" }}>🩺 diagnóstico del JSON</span>
          </div>
          <div style={{ padding: "0 18px 4px", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {diag.length > 0 ? `${total} items totales · ${totalText} con texto completo` : "todavía no se leyó el JSON en esta sesión"}
          </div>
          {generatedAt && (
            <div style={{ padding: "0 18px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              el Action generó este JSON: {new Date(generatedAt).toLocaleString("es-CL")}
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 30px" }}>
            {diag.map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #1a1a1a", fontFamily: "'DM Sans',sans-serif", fontSize: 11, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, color: d.count > 0 ? "#7cb890" : "#c77" }}>{d.count > 0 ? "✓" : "✗"}</span>
                <span style={{ flex: 1, color: "#999" }}>{d.cat}</span>
                <span style={{ color: "#666", maxWidth: 160, textAlign: "right" }}>{d.count} items · {d.withText} con texto</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ─── TabBar — Noticias / Vitrina, fijo abajo, siempre visible ──────────────
    function TabBar({ area, onChange, buzonCount, onOpenBuzon }) {
      const tabBtn = (active) => ({
        flex: 1, background: "transparent", border: "none", cursor: "pointer",
        padding: "10px 6px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700,
        color: active ? "#fff" : "#666", borderTop: active ? "2px solid #e91e8c" : "2px solid transparent",
      });
      return (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", background: "#111", zIndex: 40, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <button onClick={() => onChange("noticias")} style={tabBtn(area === "noticias")}>📰 Noticias</button>
          <button onClick={() => onChange("vitrina")} style={tabBtn(area === "vitrina")}>🎬 Vitrina</button>
          <button onClick={onOpenBuzon} style={tabBtn(false)}>📌 {buzonCount}</button>
        </div>
      );
    }

    // ─── MicrodocFeed — Microdocumentales dentro de Vitrina. NO es carrusel:
    // scroll vertical, cada ítem = título + comentario del autor (summary) +
    // video embebido, separados por un divisor suave y oscuro. Formato "lectura"
    // de base (viene de feed.json, no de cine.json), por eso no hay poster/rating.
    // Mismo patrón que PODCASTS_ESCUCHADOS_KEY: localStorage propio, aislado
    // del blob principal de la app.
    const MICRODOCS_VISTOS_KEY = "angst-feed-microdocs-vistos-v1";
    function loadMicrodocsVistos() {
      try {
        const raw = localStorage.getItem(MICRODOCS_VISTOS_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) { return new Set(); }
    }
    function saveMicrodocsVistos(set) {
      try { localStorage.setItem(MICRODOCS_VISTOS_KEY, JSON.stringify([...set])); } catch (e) {}
    }

    function MicrodocFeed({ items }) {
      const [vistos, setVistos] = useState(() => loadMicrodocsVistos());
      function toggleVisto(guid) {
        setVistos(prev => {
          const next = new Set(prev);
          if (next.has(guid)) next.delete(guid); else next.add(guid);
          saveMicrodocsVistos(next);
          return next;
        });
      }

      if (!items.length) {
        return (
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
            nada por acá todavía
          </div>
        );
      }
      return (
        <div style={{ padding: "6px 18px 30px" }}>
          {items.map((item, i) => {
            const visto = vistos.has(item.guid);
            return (
            <div key={item.guid} style={{
              padding: "22px 0",
              borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              opacity: visto ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{item.title}</div>
                <button onClick={() => toggleVisto(item.guid)} style={{
                  flexShrink: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
                  border: "1px solid " + (visto ? "#333" : "#26a69a"), borderRadius: 14, padding: "4px 10px",
                  background: "transparent", color: visto ? "#666" : "#26a69a", cursor: "pointer",
                }}>
                  {visto ? "✓ visto" : "marcar visto"}
                </button>
              </div>
              {item.summary && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 12 }}>
                  {item.summary}
                </div>
              )}
              {item.videoId ? (
                <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", background: "#000" }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
                    title={item.title}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#26a69a" }}>ver original ↗</a>
              )}
            </div>
            );
          })}
        </div>
      );
    }

    // ─── ConcertFeed — Conciertos (festivales: WackenTV, Hellfest, M'era Luna)
    // dentro de Vitrina. Mismo patrón exacto que MicrodocFeed (scroll vertical,
    // marca manual visto/pendiente), clave de localStorage propia y aislada.
    const CONCIERTOS_VISTOS_KEY = "angst-feed-conciertos-vistos-v1";
    function loadConciertosVistos() {
      try {
        const raw = localStorage.getItem(CONCIERTOS_VISTOS_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) { return new Set(); }
    }
    function saveConciertosVistos(set) {
      try { localStorage.setItem(CONCIERTOS_VISTOS_KEY, JSON.stringify([...set])); } catch (e) {}
    }

    function ConcertFeed({ items }) {
      const [vistos, setVistos] = useState(() => loadConciertosVistos());
      function toggleVisto(guid) {
        setVistos(prev => {
          const next = new Set(prev);
          if (next.has(guid)) next.delete(guid); else next.add(guid);
          saveConciertosVistos(next);
          return next;
        });
      }

      if (!items.length) {
        return (
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
            nada por acá todavía
          </div>
        );
      }
      return (
        <div style={{ padding: "6px 18px 30px" }}>
          {items.map((item, i) => {
            const visto = vistos.has(item.guid);
            return (
            <div key={item.guid} style={{
              padding: "22px 0",
              borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              opacity: visto ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{item.title}</div>
                <button onClick={() => toggleVisto(item.guid)} style={{
                  flexShrink: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
                  border: "1px solid " + (visto ? "#333" : "#26a69a"), borderRadius: 14, padding: "4px 10px",
                  background: "transparent", color: visto ? "#666" : "#26a69a", cursor: "pointer",
                }}>
                  {visto ? "✓ visto" : "marcar visto"}
                </button>
              </div>
              {item.source && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{item.source}</div>
              )}
              {item.summary && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 12 }}>
                  {item.summary}
                </div>
              )}
              {item.videoId ? (
                <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", background: "#000" }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
                    title={item.title}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#26a69a" }}>ver original ↗</a>
              )}
            </div>
            );
          })}
        </div>
      );
    }

    // ─── PodcastFeed — Podcasts dentro de Vitrina. Mismo patrón que MicrodocFeed
    // (scroll vertical, sin retención de 30 días — se acumulan indefinidamente,
    // ver build-feed.mjs), pero separados por chips de podcast (item.source) en
    // vez de mostrarse mezclados, y con marca manual de escuchado/pendiente.
    // El estado de escuchados vive en su propia clave de localStorage, aislada
    // del blob principal de la app (queue/buzon/etc.) para no tocar persist().
    const PODCASTS_ESCUCHADOS_KEY = "angst-feed-podcasts-escuchados-v1";
    function loadPodcastsEscuchados() {
      try {
        const raw = localStorage.getItem(PODCASTS_ESCUCHADOS_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) { return new Set(); }
    }
    function savePodcastsEscuchados(set) {
      try { localStorage.setItem(PODCASTS_ESCUCHADOS_KEY, JSON.stringify([...set])); } catch (e) {}
    }

    function PodcastFeed({ items }) {
      const [escuchados, setEscuchados] = useState(() => loadPodcastsEscuchados());
      // item.tema viene de feeds.json (source.tema). Si falta (fuentes viejas
      // sin ese campo todavía), cae en "Otros" en vez de desaparecer.
      const temas = [...new Set(items.map(i => i.tema || "Otros"))];
      const [activeTema, setActiveTema] = useState(null);
      const [activePodcast, setActivePodcast] = useState(null);

      useEffect(() => {
        if (!activeTema && temas.length) setActiveTema(temas[0]);
      }, [temas.join("|")]);

      const itemsDelTema = items.filter(i => (i.tema || "Otros") === activeTema);
      const podcastNames = [...new Set(itemsDelTema.map(i => i.source))];

      useEffect(() => {
        // Al cambiar de tema, el show activo se resetea al primero de ese tema
        // (el anterior probablemente no existe en el tema nuevo).
        if (podcastNames.length && !podcastNames.includes(activePodcast)) setActivePodcast(podcastNames[0]);
      }, [activeTema, podcastNames.join("|")]);

      function toggleEscuchado(guid) {
        setEscuchados(prev => {
          const next = new Set(prev);
          if (next.has(guid)) next.delete(guid); else next.add(guid);
          savePodcastsEscuchados(next);
          return next;
        });
      }

      if (!items.length) {
        return (
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: "#444", textAlign: "center", padding: "60px 20px" }}>
            nada por acá todavía
          </div>
        );
      }

      const shown = itemsDelTema.filter(i => i.source === activePodcast);
      const chipStyle = (active, color = "#ffcc00") => ({
        padding: "6px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700,
        border: "1px solid", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
        background: active ? color : "transparent",
        color: active ? "#111" : "#999",
        borderColor: active ? color : "#333",
      });

      return (
        <div style={{ paddingBottom: 30 }}>
          <div style={{ display: "flex", gap: 6, padding: "10px 18px 6px", overflowX: "auto" }}>
            {temas.map(tema => (
              <button key={tema} onClick={() => setActiveTema(tema)} style={chipStyle(tema === activeTema, "#fff")}>{tema}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, padding: "6px 18px 14px", overflowX: "auto" }}>
            {podcastNames.map(name => (
              <button key={name} onClick={() => setActivePodcast(name)} style={chipStyle(name === activePodcast)}>{name}</button>
            ))}
          </div>
          <div style={{ padding: "0 18px 30px" }}>
            {shown.map((item, i) => {
              const escuchado = escuchados.has(item.guid);
              return (
                <div key={item.guid} style={{
                  padding: "22px 0",
                  borderBottom: i < shown.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  opacity: escuchado ? 0.55 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{item.title}</div>
                    <button onClick={() => toggleEscuchado(item.guid)} style={{
                      flexShrink: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700,
                      border: "1px solid " + (escuchado ? "#333" : "#ffcc00"), borderRadius: 14, padding: "4px 10px",
                      background: "transparent", color: escuchado ? "#666" : "#ffcc00", cursor: "pointer",
                    }}>
                      {escuchado ? "✓ escuchado" : "marcar escuchado"}
                    </button>
                  </div>
                  {item.summary && (
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 12 }}>
                      {item.summary}
                    </div>
                  )}
                  {item.audioUrl ? (
                    <audio controls src={item.audioUrl} style={{ width: "100%", colorScheme: "dark" }} />
                  ) : (
                    <a href={item.link} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#ffcc00" }}>ver original ↗</a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ─── PlayerAvatar — foto de perfil de start.gg si existe, silueta genérica
    // si no (muchos jugadores nunca la subieron, sobre todo amateurs).
    function PlayerAvatar({ src, size = 40 }) {
      return src ? (
        <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "#222" }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%", flexShrink: 0,
          background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.55, color: "#555",
        }}>👤</div>
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
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PlayerAvatar src={g.foto} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {g.nombre} <span style={{ color: "#999", fontWeight: 400 }}>[{g.seed}]{g.pj ? ` · ${g.pj}` : ""}</span>
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#777", marginTop: 2 }}>
              venció a {p.nombre} [{p.seed}]{p.pj ? ` · ${p.pj}` : ""}
            </div>
          </div>
          <PlayerAvatar src={p.foto} size={30} />
        </div>
      );
    }

    // ─── MeleeFeed — Melee dentro de Vitrina, agrupado por torneo (carpeta
    // expandible) en vez de la lista plana que vivía en el swipe de Noticias.
    // Cada torneo puede tener: preview de Top 8 (esTop8Preview, solo mientras
    // sigue en curso), upsets sueltos, y el archivo final permanente
    // (esArchivo) una vez que termina — ese es el que se muestra primero
    // cuando está disponible, como resumen.
    function MeleeFeed({ items }) {
      const [openTournament, setOpenTournament] = useState(null);
      const [vodVistos, setVodVistos] = useState(() => loadMeleeVodVistos());
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
            const upsets = grupo.filter(i => !i.esArchivo && !i.esTop16Preview && !i.esTop8Preview && !i.esHype && !i.esProyeccion);
            const open = openTournament === nombre;
            const estado = archivo ? "finalizado" : top8 ? "en Top 8" : top16 ? "en Top 16" : (upsets.length ? "en curso" : "próximamente");
            // Hora Chile del Top 8 + link de stream: puede venir de hype (pre-torneo)
            // o de top16/top8 (torneo en curso) — el que esté disponible primero.
            const liveInfo = top8 || top16 || hype;
            return (
              <div key={nombre} style={{ marginBottom: 10, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                <button onClick={() => setOpenTournament(open ? null : nombre)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", background: "rgba(255,102,0,0.06)", border: "none", cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: "#fff" }}>{nombre}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: "#ff6600" }}>{estado.toUpperCase()} {open ? "▲" : "▼"}</div>
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
                                  <span style={{ color: "#ff6600", fontWeight: 700 }}>[{e.seed}]</span> {e.nombre}
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
                    {archivo && archivo.vodClips && archivo.vodClips.length > 0 && (
                      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 8 }}>VOD DEL TORNEO</div>
                        {archivo.vodClips.map((clip, i) => {
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
                                    {clip.ronda}{clip.esTop16 ? " · Top 16" : ""}{clip.esUpset ? " · upset" : ""}
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
                                    title={`${clip.ganador?.nombre} vs ${clip.perdedor?.nombre}`}
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
                    )}
                    {top16 && !archivo && (
                      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#ff6600", marginBottom: 8 }}>TOP 16</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {(top16.jugadores || []).map(j => (
                            <div key={j.nombre} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 60 }}>
                              <PlayerAvatar src={j.foto} size={44} />
                              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 4 }}>{j.nombre}</div>
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
                              <PlayerAvatar src={j.foto} size={44} />
                              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 4 }}>{j.nombre}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {upsets.length > 0 && (
                      <div>
                        {archivo || top16 || top8 ? (
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
                              {byDay[dayKey].map((it, i) => (
                                <div key={it.guid} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                  <MeleeMatchup item={it} />
                                  {it.videoId && (
                                    <a href={`https://youtube.com/watch?v=${it.videoId}${it.startSeconds ? `&t=${it.startSeconds}s` : ""}`} target="_blank" rel="noopener" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#ff6600", display: "inline-block", marginTop: 6 }}>
                                      ▶ ver clip
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    {!archivo && !top16 && !top8 && !hype && !proyeccion && upsets.length === 0 && (
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

    // ─── VitrinaView — carrusel de Destacados (Películas/Series/Animación) ─────
    // Segmented control fijo arriba, sin auto-alternancia: se queda en la
    // categoría elegida hasta que el usuario cambia manualmente. Muestra el
    // catálogo completo de 30 días, no solo lo cargado en la cola de Noticias.
    function VitrinaView({ vitrinaData, vitrinaCat, onChangeCat, onOpen, generatedAt }) {
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
            ? <MicrodocFeed items={items} />
            : vitrinaCat === "Podcasts"
            ? <PodcastFeed items={items} />
            : vitrinaCat === "Melee"
            ? <MeleeFeed items={items} />
            : vitrinaCat === "Conciertos"
            ? <ConcertFeed items={items} />
            : <CineCoverFlow items={items} onOpen={onOpen} generatedAt={generatedAt} categoria={vitrinaCat} />
          }
        </div>
      );
    }


    // ─── App ─────────────────────────────────────────────────────────────────────
    function FeedPage({ onExit }) {
      const ExitBtn = () => (
        <button onClick={onExit} title="Volver a Angst" style={{ position: "fixed", top: "calc(10px + env(safe-area-inset-top))", right: 12, zIndex: 999, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: 20, width: 34, height: 34, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      );
      const [loaded, setLoaded] = useState(false);
      const [queue, setQueue] = useState([]);
      const [seen, setSeen] = useState([]);
      const [buzon, setBuzon] = useState([]);
      const [lastRefresh, setLastRefresh] = useState(null);
      const [view, setView] = useState("story");
      const [refreshing, setRefreshing] = useState(false);
      const [refreshMsg, setRefreshMsg] = useState(null);
      const [refreshDiag, setRefreshDiag] = useState([]);
      const [feedGeneratedAt, setFeedGeneratedAt] = useState(null);
      const [toast, setToast] = useState(null);
      const [buzonOpenItem, setBuzonOpenItem] = useState(null);
      const [showDiagPanel, setShowDiagPanel] = useState(false);
      const [area, setArea] = useState("noticias"); // "noticias" | "vitrina"
      const [vitrinaCat, setVitrinaCat] = useState("Películas");
      const [vitrinaData, setVitrinaData] = useState({ "Películas": [], "Series": [], "Animación": [], "Microdocumentales": [], "Podcasts": [], "Melee": [], "Conciertos": [] });
      const [vitrinaOpenItem, setVitrinaOpenItem] = useState(null);
      const [exportError, setExportError] = useState(null);

      const queueRef = useRef([]); const seenRef = useRef([]); const buzonRef = useRef([]); const lastRefreshRef = useRef(null);
      useEffect(() => { queueRef.current = queue; }, [queue]);
      useEffect(() => { seenRef.current = seen; }, [seen]);
      useEffect(() => { buzonRef.current = buzon; }, [buzon]);
      useEffect(() => { lastRefreshRef.current = lastRefresh; }, [lastRefresh]);

      function persist(overrides = {}) {
        saveState({
          feedQueue: overrides.queue ?? queueRef.current,
          feedSeen: overrides.seen ?? seenRef.current,
          feedBuzon: overrides.buzon ?? buzonRef.current,
          feedLastRefresh: overrides.lastRefresh ?? lastRefreshRef.current,
        });
      }

      useEffect(() => {
        (async () => {
          const s = await loadState();
          if (s) {
            // Migración defensiva: colas guardadas antes de esta sesión pueden traer
            // ítems formato "cine" (CineStoryCard ya no existe, Vitrina los reemplazó).
            // Sin este filtro, React explota (error #130: componente null/undefined).
            const cleanQueue = (s.feedQueue || []).filter(it => it.formato !== "cine");
            setQueue(cleanQueue);
            setSeen(s.feedSeen || []);
            setBuzon(s.feedBuzon || []);
            setLastRefresh(s.feedLastRefresh || null);
            if (!cleanQueue.length) setView("end");
          } else {
            setView("end");
          }
          setLoaded(true);
        })();
      }, []);

      // Vitrina se carga aparte, sin el throttle de 4h del feed de lectura —
      // es un catálogo de consulta, no una cola que se consume. fetchFeedData
      // ya separa lo que es Vitrina (incluye Microdocumentales, que vive en
      // feed.json, no en cine.json) de lo que va al round-robin de Noticias.
      useEffect(() => {
        (async () => {
          try {
            const { vitrina } = await fetchFeedData();
            if (vitrina) setVitrinaData(v => ({ ...v, ...vitrina }));
          } catch (e) { /* silencioso — doRefresh ya maneja el error visible */ }
        })();
      }, []);


      useEffect(() => {
        const next = queue[1];
        if (next && next.image) { const img = new Image(); img.src = next.image; }
      }, [queue]);

      const canRefresh = !lastRefresh || (Date.now() - new Date(lastRefresh).getTime()) > REFRESH_THROTTLE_MS;
      const nextRefreshAt = lastRefresh ? new Date(lastRefresh).getTime() + REFRESH_THROTTLE_MS : null;

      async function doRefresh() {
        if (refreshing || !canRefresh) return;
        setRefreshing(true);
        setRefreshMsg("actualizando…");
        try {
          const { queue: fresh, vitrina, diag, generatedAt } = await fetchFeedData();
          setRefreshDiag(diag);
          setFeedGeneratedAt(generatedAt);
          if (vitrina) setVitrinaData(v => ({ ...v, ...vitrina }));
          const knownGuids = new Set([...seenRef.current, ...buzonRef.current.map(b => b.guid), ...queueRef.current.map(q => q.guid)]);
          const newOnes = fresh.filter(a => !knownGuids.has(a.guid));
          const nextQueue = [...queueRef.current, ...newOnes];
          setQueue(nextQueue);
          const ts = new Date().toISOString();
          setLastRefresh(ts);
          persist({ queue: nextQueue, lastRefresh: ts });
          if (nextQueue.length) setView("story");
          const totalItems = diag.reduce((s, d) => s + d.count, 0);
          setRefreshMsg(newOnes.length > 0 ? `✓ ${newOnes.length} nuevas` : `sin novedades — ${totalItems} items en el JSON`);
        } catch (e) {
          setRefreshMsg("error al leer el JSON — revisá la URL o si el repo/Action sigue bien");
        }
        setRefreshing(false);
        setTimeout(() => setRefreshMsg(null), 4000);
      }

      function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 1800); }

      function advance() {
        setQueue(q => {
          const [current, ...rest] = q;
          if (current) {
            // Cap generoso: antes eran 500 y se vaciaba en pocos días de uso normal,
            // haciendo que ítems ya descartados volvieran a aparecer como "nuevos"
            // en el próximo refresh (su guid ya no estaba en seen). 5000 guids en
            // localStorage es un costo trivial (~150-200KB) frente al problema que
            // resuelve.
            const nextSeen = [...seenRef.current, current.guid].slice(-5000);
            setSeen(nextSeen);
            persist({ queue: rest, seen: nextSeen });
          }
          if (!rest.length) setView("end");
          return rest;
        });
      }

      function handleSkip() { advance(); }

      function handleSave() {
        const current = queueRef.current[0];
        if (!current) return;
        const nextBuzon = [...buzonRef.current, current];
        setBuzon(nextBuzon);
        persist({ buzon: nextBuzon });
        showToast(`guardado en ${current.categoria}`);
        advance();
      }

      function handleExpand() { setView("extended"); }
      function handleBack() { setView("story"); }
      function handleAdvanceFromExtended() { setView("story"); advance(); }

      // ⬅️ Cambiar categoría: NO descarta nada — solo empuja toda la categoría
      // actual al final de la cola. Nada se pierde, nada se marca como visto,
      // es puro reordenamiento (igual espíritu que shuffle).
      function handleChangeCategory() {
        const cur = queueRef.current[0];
        if (!cur) return;
        const sameCategory = queueRef.current.filter(x => x.categoria === cur.categoria);
        const others = queueRef.current.filter(x => x.categoria !== cur.categoria);
        const reordered = [...others, ...sameCategory];
        setQueue(reordered);
        persist({ queue: reordered });
        setView(reordered.length ? "story" : "end");
      }

      // 🔀 Shuffle: solo reordena lo que ya está cargado, no trae nada nuevo —
      // no compite con el criterio de "scroll sano" (nada de contenido infinito/relleno).
      function handleShuffle() {
        setQueue(q => {
          const arr = [...q];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          persist({ queue: arr });
          return arr;
        });
      }

      function removeFromBuzon(guid) {
        const next = buzon.filter(b => b.guid !== guid);
        setBuzon(next);
        persist({ buzon: next });
      }

      // ─── Vitrina: guardar/siguiente/categoría operan sobre vitrinaData[vitrinaCat],
      // no sobre la cola de Noticias — son dos ejes de navegación independientes.
      function handleVitrinaSave(item) {
        const nextBuzon = [...buzonRef.current, item];
        setBuzon(nextBuzon);
        persist({ buzon: nextBuzon });
        showToast(`guardado en ${item.categoria}`);
      }

      function handleVitrinaNext(item) {
        const list = vitrinaData[vitrinaCat] || [];
        const idx = list.findIndex(i => i.guid === item.guid);
        if (idx === -1 || !list.length) { setVitrinaOpenItem(null); return; }
        setVitrinaOpenItem(list[(idx + 1) % list.length]);
      }

      // "⬅️ anterior" dentro del detalle de Cine: retrocede en la misma lista
      // de la subcategoría actual, espejo de "siguiente". El cambio de
      // subcategoría (Películas/Series/Animación) ya tiene su propio selector
      // en la cabecera de VitrinaView -- no hace falta duplicarlo acá.
      function handleVitrinaPrev(item) {
        const list = vitrinaData[vitrinaCat] || [];
        const idx = list.findIndex(i => i.guid === item.guid);
        if (idx === -1 || !list.length) { setVitrinaOpenItem(null); return; }
        setVitrinaOpenItem(list[(idx - 1 + list.length) % list.length]);
      }

      async function handleExportImage(item) {
        showToast("generando imagen…");
        const ok = await exportCineShareImage(item, msg => setExportError(msg));
        if (ok) showToast("✓ imagen descargada");
      }

      if (!loaded) return <><div style={{ position: "fixed", inset: 0, background: "#0a0a0a" }} /><ExitBtn/></>;

      if (buzonOpenItem) {
        const { Extended } = cardsFor(buzonOpenItem.formato);
        const isCine = buzonOpenItem.formato === "cine";
        return (
          <>
            <Extended item={buzonOpenItem} onBack={() => setBuzonOpenItem(null)} onNext={() => setBuzonOpenItem(null)} onSave={() => {}} hideActions
              {...(isCine ? { onExportImage: handleExportImage } : {})} />
            {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#111", padding: "8px 18px", borderRadius: 20, fontFamily: "'Caveat',cursive", fontSize: 15, fontWeight: 700, zIndex: 200 }}>{toast}</div>}
            {exportError && (
              <div style={{ position: "fixed", bottom: 90, left: 18, right: 18, background: "#3a1010", border: "1px solid #6b2020", color: "#f5b5b5", borderRadius: 10, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, zIndex: 200 }}>
                {exportError}
                <button onClick={() => setExportError(null)} style={{ float: "right", background: "transparent", border: "none", color: "#f5b5b5", cursor: "pointer" }}>×</button>
              </div>
            )}
            <ExitBtn/>
          </>
        );
      }

      if (vitrinaOpenItem) {
        return (
          <>
            <CineExtendedView item={vitrinaOpenItem} onBack={() => setVitrinaOpenItem(null)}
              onNext={() => handleVitrinaNext(vitrinaOpenItem)}
              onSave={() => handleVitrinaSave(vitrinaOpenItem)}
              onChangeCategory={() => handleVitrinaPrev(vitrinaOpenItem)} />
            <ExitBtn/>
          </>
        );
      }

      if (showDiagPanel) {
        return <><DiagPanel diag={refreshDiag} generatedAt={feedGeneratedAt} onClose={() => setShowDiagPanel(false)} /><ExitBtn/></>;
      }

      const current = queue[0];
      const { Story: CurrentStory, Extended: CurrentExtended } = current ? cardsFor(current.formato) : {};

      return (
        <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
          {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#111", padding: "8px 18px", borderRadius: 20, fontFamily: "'Caveat',cursive", fontSize: 15, fontWeight: 700, zIndex: 200 }}>{toast}</div>}

          {area === "vitrina" ? (
            <VitrinaView vitrinaData={vitrinaData} vitrinaCat={vitrinaCat} onChangeCat={setVitrinaCat} onOpen={item => setVitrinaOpenItem(item)} generatedAt={feedGeneratedAt} />
          ) : (
            <>
              {view === "story" && current && CurrentStory && (
                <CurrentStory item={current} onSkip={handleSkip} onExpand={handleExpand} onSave={handleSave}
                  onChangeCategory={handleChangeCategory} onShuffle={handleShuffle}
                  onOpenBuzon={() => setView("buzon")} onOpenDiag={() => setShowDiagPanel(true)} hasDiag={refreshDiag.length > 0}
                  onRefresh={doRefresh} canRefresh={canRefresh} refreshing={refreshing} buzonCount={buzon.length} />
              )}
              {view === "extended" && current && CurrentExtended && (
                <CurrentExtended item={current} onBack={handleBack} onNext={handleAdvanceFromExtended} onSave={handleSave} onChangeCategory={handleChangeCategory} />
              )}
              {view === "end" && (
                <EndScreen onGoBuzon={() => setView("buzon")} onRefresh={doRefresh} canRefresh={canRefresh} refreshing={refreshing} nextRefreshAt={nextRefreshAt} refreshMsg={refreshMsg} onReset={resetTestState} onOpenDiag={() => setShowDiagPanel(true)} hasDiag={refreshDiag.length > 0} />
              )}
              {view === "buzon" && (
                <BuzonView buzon={buzon} onClose={() => setView(queue.length ? "story" : "end")}
                  onOpen={item => setBuzonOpenItem(item)}
                  onRemove={removeFromBuzon} />
              )}
            </>
          )}

          <TabBar area={area} onChange={setArea} buzonCount={buzon.length} onOpenBuzon={() => { setArea("noticias"); setView("buzon"); }} />
          <ExitBtn/>
        </div>
      );
    }

export default FeedPage;
