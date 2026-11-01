// Piezas visuales compartidas del módulo Fadiman. Homogéneas con Salud:
// fila de sección (blanca/negra), emergente oscuro tipo hoja, Caveat + DM Sans.
export const F_HAND = "'Caveat',cursive";
export const F_SANS = "'DM Sans',sans-serif";

// Dentro de una sección expandida (fondo claro del marco) y dentro de una hoja (oscura).
export const T_CLARO = { txt: "#111", dim: "#666", faint: "#999", panel: "#fff", line: "#ddd", selBg: "#111", selTxt: "#fff", acc: "#5f7d12", warn: "#c62828" };
export const T_OSCURO = { txt: "#fff", dim: "#888", faint: "#666", panel: "#1a1a1a", line: "#333", selBg: "#fff", selTxt: "#111", acc: "#aac756", warn: "#e53935" };

export const lbl = (T) => ({ fontFamily: F_SANS, fontSize: 10, color: T.faint, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" });
export const inp = (T) => ({ fontFamily: F_SANS, fontSize: 14, background: T.panel, border: `1px dashed ${T.line}`, color: T.txt, borderRadius: 8, padding: "8px 10px", outline: "none", boxSizing: "border-box" });
export const chip = (T, on) => ({ fontFamily: F_SANS, fontSize: 12, padding: "6px 12px", borderRadius: 16, cursor: "pointer", whiteSpace: "nowrap", flex: "none", border: "1px solid " + (on ? T.selBg : T.line), background: on ? T.selBg : "transparent", color: on ? T.selTxt : T.dim });

export function Fila5({ T, valor, onPick }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (valor || 0) >= n;
        return (
          <button key={n} onClick={() => onPick(n === valor ? null : n)}
            style={{ flex: 1, background: on ? T.selBg : T.panel, border: `1px dashed ${on ? T.selBg : T.line}`, borderRadius: 6, padding: "8px 4px", cursor: "pointer", fontFamily: F_HAND, fontSize: 18, color: on ? T.selTxt : T.faint }}>{n}</button>
        );
      })}
    </div>
  );
}

// Mismo aspecto que la fila de sección de Salud.
export function FilaSeccion({ icon, label, summary, open, onToggle }) {
  return (
    <button onClick={onToggle} aria-expanded={open}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "6px 12px", marginBottom: 4, borderRadius: 10, cursor: "pointer", textAlign: "left",
        background: open ? "#111" : "#fff", color: open ? "#fff" : "#111", border: "1px dashed " + (open ? "#111" : "#ddd"), flex: "none", boxSizing: "border-box" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontFamily: F_HAND, fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: F_SANS, fontSize: 11, color: open ? "rgba(255,255,255,0.55)" : "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{summary}</span>
      <span style={{ fontSize: 12, color: open ? "rgba(255,255,255,0.6)" : "#bbb", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
    </button>
  );
}

// Emergente (formularios y confirmaciones): hoja oscura desde abajo, como en Salud.
export function Hoja({ titulo, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(96vw,480px)", background: "#0d0d0d", borderRadius: "16px 16px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", color: "#fff" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontFamily: F_HAND, fontSize: 20, fontWeight: 700 }}>{titulo}</div>
          <button onClick={onClose} aria-label="cerrar" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "14px 20px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}

// Gráfico completo (resumen).
export function Grafico({ T, pts }) {
  const W = 300, H = 110, X0 = 14, X1 = W - 6, Y0 = 8, Y1 = 90;
  const x = (i) => X0 + (pts.length === 1 ? 0 : (i * (X1 - X0)) / (pts.length - 1));
  const y = (v) => Y1 - ((v - 1) / 4) * (Y1 - Y0);
  const tramos = []; let cur = [];
  pts.forEach((p, i) => { if (p.v != null) cur.push([x(i), y(p.v)]); else if (cur.length) { tramos.push(cur); cur = []; } });
  if (cur.length) tramos.push(cur);
  const hay = pts.some((p) => p.v != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", background: "#111", borderRadius: 8 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="#1f1f1f" strokeWidth="1" />
          <text x={2} y={y(v) + 3} fontSize="8" fill="#555" fontFamily="DM Sans">{v}</text>
        </g>
      ))}
      {tramos.map((t, i) => <polyline key={i} points={t.map((p) => p.join(",")).join(" ")} fill="none" stroke="#aac756" strokeWidth="1.6" />)}
      {pts.map((p, i) => p.v != null && <circle key={i} cx={x(i)} cy={y(p.v)} r="2.4" fill="#aac756" />)}
      {pts.map((p, i) => p.tomo && <rect key={"t" + i} x={x(i) - 2} y={H - 14} width="4" height="4" fill="#fff" />)}
      {pts.map((p, i) => p.evento && <text key={"e" + i} x={x(i) - 3} y={H - 3} fontSize="8" fill="#f5a623">▲</text>)}
      {!hay && <text x={W / 2} y={H / 2} fontSize="10" fill="#777" textAnchor="middle" fontFamily="DM Sans">sin datos de esta escala</text>}
    </svg>
  );
}

// Tendencia que ocupa el alto sobrante del estado colapsado (R1/R10: se adapta al alto real).
export function Tendencia({ pts, titulo }) {
  const n = pts.length, W = 300, H = 100;
  const x = (i) => 6 + (n === 1 ? 0 : (i * (W - 12)) / (n - 1));
  const y = (v) => 90 - ((v - 1) / 4) * 80;
  const tramos = []; let cur = [];
  pts.forEach((p, i) => { if (p.v != null) cur.push([x(i), y(p.v)]); else if (cur.length) { tramos.push(cur); cur = []; } });
  if (cur.length) tramos.push(cur);
  const hay = pts.some((p) => p.v != null);
  const ns = { vectorEffect: "non-scaling-stroke" };
  return (
    <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", border: "1px dashed #ddd", borderRadius: 10, padding: "8px 10px", boxSizing: "border-box", marginTop: 2 }}>
      <div style={{ flex: "none", fontFamily: F_SANS, fontSize: 10, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{titulo}</div>
      {hay ? (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flex: "1 1 0", minHeight: 0, width: "100%", display: "block" }}>
          {[1, 3, 5].map((v) => <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="#eee" strokeWidth="1" {...ns} />)}
          {tramos.map((t, i) => <polyline key={i} points={t.map((p) => p.join(",")).join(" ")} fill="none" stroke="#5f7d12" strokeWidth="1.8" {...ns} />)}
          {pts.map((p, i) => p.v != null && <line key={i} x1={x(i)} x2={x(i) + 0.01} y1={y(p.v)} y2={y(p.v)} stroke="#5f7d12" strokeWidth="6" strokeLinecap="round" {...ns} />)}
          {pts.map((p, i) => p.tomo && <line key={"t" + i} x1={x(i)} x2={x(i) + 0.01} y1="98" y2="98" stroke="#111" strokeWidth="4" strokeLinecap="square" {...ns} />)}
        </svg>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_HAND, fontSize: 16, color: "#bbb", textAlign: "center" }}>sin registros todavía</div>
      )}
    </div>
  );
}
