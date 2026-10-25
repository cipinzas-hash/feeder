// Bandeja Familia → Angst (issue #26): eventos del calendario Familia de Google que todavía no pasaste a tarea.
// Solo presenta; la lógica vive en familiaInbox.js y las acciones (crear tarea, guardar decisión) en App.jsx.
// Estilo de ComprasModal (React es global: build con jsx "transform").

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function etiquetaFecha(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
}
function etiquetaHora(ev) {
  if (ev.allDay || !ev.start || String(ev.start).length < 16) return "todo el día";
  return String(ev.start).slice(11, 16);
}

const btn = (extra) => ({ fontFamily: "'DM Sans',sans-serif", fontSize: 12, borderRadius: 8, padding: "4px 10px", cursor: "pointer", ...extra });

function FamiliaInboxModal({ items, onImport, onIgnore, onImportAll, onIgnoreAll, onRefresh, onClose, cargando, mensaje, generadoEn }) {
  const grupos = [];
  for (const it of items) {
    const f = it.fechas[0];
    const g = grupos.length && grupos[grupos.length - 1].fecha === f ? grupos[grupos.length - 1] : (grupos.push({ fecha: f, items: [] }), grupos[grupos.length - 1]);
    g.items.push(it);
  }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 12, width: "min(95vw,420px)", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#111", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: "#fff", fontWeight: 700 }}>📥 Familia · {items.length} nuevo{items.length === 1 ? "" : "s"}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={onRefresh} disabled={cargando} style={btn({ background: "transparent", border: "1px dashed #555", color: "#aaa" })}>{cargando ? "…" : "↻"}</button>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {mensaje && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#c00", background: "#fff5f5", border: "1px dashed #e0b0b0", borderRadius: 6, padding: "8px 10px", margin: "2px 0 8px" }}>{mensaje}</div>}
          {items.length === 0 && <div style={{ color: "#bbb", fontFamily: "'DM Sans',sans-serif", fontSize: 13, textAlign: "center", padding: "20px 0" }}>nada pendiente</div>}
          {grupos.map(g => (
            <div key={g.fecha} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 17, fontWeight: 700, color: "#111", borderBottom: "1px dashed #ccc", marginBottom: 6 }}>{etiquetaFecha(g.fecha)}</div>
              {g.items.map(({ ev, fechas }) => (
                <div key={ev.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#111" }}>
                    {ev.summary || "(sin título)"}
                    <span style={{ color: "#888", fontSize: 12 }}> · {etiquetaHora(ev)}{fechas.length > 1 ? ` · ${fechas.length} días (hasta ${etiquetaFecha(fechas[fechas.length - 1])})` : ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => onImport(ev)} style={btn({ background: "#111", color: "#fff", border: "1px solid #111" })}>Pasar a tarea</button>
                    <button onClick={() => onIgnore(ev)} style={btn({ background: "transparent", color: "#666", border: "1px dashed #aaa" })}>Ignorar</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div style={{ padding: "10px 14px", borderTop: "1px dashed #ccc", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onImportAll} style={btn({ background: "#111", color: "#fff", border: "1px solid #111" })}>Pasar todos</button>
            <button onClick={onIgnoreAll} style={btn({ background: "transparent", color: "#666", border: "1px dashed #aaa" })}>Ignorar todos</button>
          </div>
        )}
        <div style={{ padding: "6px 14px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#999" }}>
          Pasar a tarea la crea en Angst; el evento original se borra de Google después de tu próximo 📤. Ignorar lo deja en Google.
          {generadoEn ? ` · bandeja de ${new Date(generadoEn).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}` : ""}
        </div>
      </div>
    </div>
  );
}

export { FamiliaInboxModal };
