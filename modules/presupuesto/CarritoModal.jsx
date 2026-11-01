import { fmtCLP } from "../../core/format.js";
import { montoCompra } from "../../core/presupuesto-modelo.js";
import ListaCompras from "./ListaCompras.jsx";
const { useMemo } = React;

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

// 🛒 Carrito del menú superior: todas las compras pendientes de todos los días, en una sola lista (la misma ListaCompras
// de Semana y de ➕ Registrar). Se agrega aquí mismo (a la lista de hoy), se completan los detalles y se marca comprado:
// el gasto se descuenta del bolsillo que corresponde a la categoría (Alimentación; Aseo, el suyo).
//   api  {info(categoria), comprar(item), desmarcar(item), nuevaCategoria(label, destino)}
//   onItem(dateKey, itemId, campos)   onAdd(dateKey, item)   onDelete(dateKey, itemId)
export default function CarritoModal({ dayData, hoy, api, onItem, onAdd, onDelete, onClose }) {
  const grupos = useMemo(() => {
    const dias = Object.keys(dayData || {}).sort()
      .map(k => ({ key: k, titulo: etiquetaDia(k, hoy), vencido: k < hoy, items: ((dayData[k] && dayData[k].compras) || []).filter(i => !i.done) }))
      .filter(g => g.items.length > 0);
    const comprados = ((dayData && dayData[hoy] && dayData[hoy].compras) || []).filter(i => i.done);
    return comprados.length ? [...dias, { key: hoy, titulo: "Comprado hoy · toca la casilla para deshacer", items: comprados }] : dias;
  }, [dayData, hoy]);

  const pendientes = grupos.filter(g => !g.titulo.startsWith("Comprado")).reduce((s, g) => s + g.items.length, 0);
  const sinPrecio = grupos.filter(g => !g.titulo.startsWith("Comprado")).reduce((s, g) => s + g.items.filter(i => montoCompra(i) === 0).length, 0);
  // Lo estimado se compara contra el saldo del bolsillo de cada destino (Alimentación, Aseo…).
  const destinos = {};
  grupos.filter(g => !g.titulo.startsWith("Comprado")).forEach(g => g.items.forEach(i => {
    const inf = api.info(i.categoria);
    const d = destinos[inf.destId] || (destinos[inf.destId] = { label: inf.destLabel, emoji: inf.dest ? inf.dest.row.emoji : "", activo: inf.activo, saldo: inf.saldo, estimado: 0 });
    d.estimado += montoCompra(i);
  }));
  const estimado = Object.values(destinos).reduce((s, d) => s + d.estimado, 0);
  const porConfirmar = grupos.filter(g => !g.titulo.startsWith("Comprado")).reduce((s, g) => s + g.items.filter(i => i.estimado).length, 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "2px dashed #111", borderRadius: 12, width: "min(95vw,440px)", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#111", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", fontWeight: 700 }}>🛒 Carrito <span style={{ fontSize: 14, color: "#888" }}>{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span></div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          <ListaCompras grupos={grupos} agregarEn={hoy} api={api} onPatch={onItem} onAdd={onAdd} onDelete={onDelete} vacio="no hay compras pendientes"/>
        </div>
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 16px", fontFamily: F, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
          {pendientes > 0 && <div>Estimado pendiente: <b style={{ color: "#111" }}>{fmtCLP(estimado)}</b>{sinPrecio > 0 && <span style={{ color: "#aaa" }}> · {sinPrecio} sin precio</span>}{porConfirmar > 0 && <span style={{ color: "#aaa" }}> · {porConfirmar} por confirmar</span>}</div>}
          {Object.entries(destinos).map(([id, d]) => d.activo
            ? <div key={id} style={{ color: d.estimado > d.saldo ? "#c00" : "#666" }}>{d.emoji} {d.label}: saldo <b>{fmtCLP(d.saldo)}</b>{d.estimado > d.saldo ? " · el estimado no alcanza" : ""}</div>
            : <div key={id} style={{ color: "#aaa" }}>{d.label} aún no es cartera con sobres: sus compras no descuentan de ningún fondo.</div>)}
          {pendientes === 0 && <div style={{ color: "#aaa" }}>Agrega arriba lo que haga falta comprar.</div>}
        </div>
      </div>
    </div>
  );
}
