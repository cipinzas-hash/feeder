import { fmtCLP } from "../../core/format.js";
import { montoCompra } from "../../core/presupuesto-modelo.js";
import { CompraEditor, ChipCompra } from "./CompraEditor.jsx";
const { useState, useMemo } = React;

const F = "'DM Sans',sans-serif";

function etiquetaDia(key, hoy) {
  if (key === hoy) return "Hoy";
  const m = new Date(hoy + "T12:00:00"); m.setDate(m.getDate() + 1);
  const man = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
  if (key === man) return "Mañana";
  const d = new Date(key + "T12:00:00");
  const dia = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()];
  return `${key < hoy ? "Atrasadas · " : ""}${dia} ${d.getDate()}/${d.getMonth() + 1}`;
}

// 🛒 Carrito del menú superior: todas las compras pendientes de todos los días, en una sola lista.
// Se revisa, se completan cantidad/precio/categoría y se marca comprado: el gasto se descuenta de Alimentación.
//   api  {info(), comprar(item), desmarcar(item), nuevaCategoria(label)}   onItem(dateKey, itemId, campos)
export default function CarritoModal({ dayData, hoy, api, onItem, onClose }) {
  const [editando, setEditando] = useState(null);   // `${dateKey}|${itemId}`
  const [msg, setMsg] = useState("");
  const info = api.info();

  const grupos = useMemo(() => Object.keys(dayData || {}).sort()
    .map(k => ({ key: k, items: ((dayData[k] && dayData[k].compras) || []).filter(i => !i.done) }))
    .filter(g => g.items.length > 0), [dayData]);
  const compradosHoy = ((dayData && dayData[hoy] && dayData[hoy].compras) || []).filter(i => i.done);
  const estimado = grupos.reduce((s, g) => s + g.items.reduce((t, i) => t + montoCompra(i), 0), 0);
  const sinPrecio = grupos.reduce((s, g) => s + g.items.filter(i => montoCompra(i) === 0).length, 0);
  const pendientes = grupos.reduce((s, g) => s + g.items.length, 0);

  function marcar(dateKey, item) {
    setMsg("");
    if (info.activo && montoCompra(item) === 0) { setEditando(`${dateKey}|${item.id}`); return; }
    const r = api.comprar(item);
    if (r.error) { setMsg(r.error); return; }
    onItem(dateKey, item.id, { done: true, ...(r.patch || {}) });
  }
  function desmarcar(dateKey, item) {
    setMsg("");
    const r = api.desmarcar(item);
    if (r.error) { setMsg(r.error); return; }
    onItem(dateKey, item.id, { done: false, ...(r.patch || {}) });
  }
  const accionesDe = (dateKey, item) => ({
    guardar: f => { onItem(dateKey, item.id, f); setEditando(null); },
    comprar: f => {
      const it = { ...item, ...f };
      const r = api.comprar(it);
      if (r.error) return r.error;
      onItem(dateKey, item.id, { ...f, done: true, ...(r.patch || {}) });
      setEditando(null);
      return null;
    },
    sinGasto: f => { onItem(dateKey, item.id, { ...f, done: true }); setEditando(null); },
    nuevaCategoria: api.nuevaCategoria,
  });
  const casilla = (hecho, onClick) => (
    <div onClick={onClick} style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px dashed ${hecho ? "#111" : "#bbb"}`, background: hecho ? "#111" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
      {hecho && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 12, width: "min(95vw,440px)", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#111", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>🛒 Carrito <span style={{ fontSize: 14, color: "#888" }}>{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span></div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
          {msg && <div style={{ fontFamily: F, fontSize: 12, color: "#c00", background: "#fff5f5", border: "1px dashed #e0b0b0", borderRadius: 6, padding: "8px 10px", margin: "4px 0 8px" }}>{msg}</div>}
          {grupos.length === 0 && <div style={{ color: "#ccc", fontFamily: F, fontSize: 13, textAlign: "center", padding: "24px 0" }}>no hay compras pendientes</div>}
          {grupos.map(g => (
            <div key={g.key} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: F, fontSize: 10, color: g.key < hoy ? "#a60" : "#999", letterSpacing: 2, textTransform: "uppercase", margin: "8px 0 2px" }}>{etiquetaDia(g.key, hoy)}</div>
              {g.items.map(item => {
                const k = `${g.key}|${item.id}`;
                return (
                  <div key={item.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                      {casilla(false, () => marcar(g.key, item))}
                      <div onClick={() => setEditando(editando === k ? null : k)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <div style={{ fontFamily: F, fontSize: 14, color: "#333" }}>{item.text}</div>
                        <ChipCompra item={item}/>
                      </div>
                    </div>
                    {editando === k && <CompraEditor item={item} info={info} acciones={accionesDe(g.key, item)} onClose={() => setEditando(null)}/>}
                  </div>
                );
              })}
            </div>
          ))}
          {compradosHoy.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: F, fontSize: 10, color: "#999", letterSpacing: 2, textTransform: "uppercase", margin: "8px 0 2px" }}>Comprado hoy · toca para deshacer</div>
              {compradosHoy.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                  {casilla(true, () => desmarcar(hoy, item))}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F, fontSize: 14, color: "#bbb", textDecoration: "line-through" }}>{item.text}</div>
                    <ChipCompra item={item}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 16px", fontFamily: F, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
          {pendientes > 0 && <div>Estimado pendiente: <b style={{ color: "#111" }}>{fmtCLP(estimado)}</b>{sinPrecio > 0 && <span style={{ color: "#aaa" }}> · {sinPrecio} sin precio</span>}</div>}
          {info.activo
            ? <div style={{ color: estimado > info.saldo ? "#c00" : "#666" }}>{info.dest.row.emoji} {info.dest.row.label}: saldo <b>{fmtCLP(info.saldo)}</b>{estimado > info.saldo ? " · el estimado no alcanza" : ""}</div>
            : <div style={{ color: "#aaa" }}>Alimentación aún no es cartera con sobres: las compras no descuentan de ningún fondo.</div>}
        </div>
      </div>
    </div>
  );
}
