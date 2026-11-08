import { fmtCLP } from "../../core/format.js";
import { montoCompra, gastosDelDia, fechaISO, fechaDe } from "../../core/presupuesto-modelo.js";
import { Ventana, VentanaCabecera } from "../shared/ui.jsx";
import ListaCompras from "./ListaCompras.jsx";
const { useMemo, useState } = React;

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
function mover(iso, n) { const d = fechaDe(iso); d.setDate(d.getDate() + n); return fechaISO(d); }
function rotuloFecha(iso, hoy) {
  if (iso === hoy) return "Hoy";
  if (iso === mover(hoy, -1)) return "Ayer";
  const d = fechaDe(iso);
  return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
const flecha = { background: "transparent", border: "1px dashed #999", borderRadius: 8, width: 32, height: 30, fontSize: 18, lineHeight: 1, cursor: "pointer", color: "#111", fontFamily: F };

// 🛒 Carrito del menú superior: todas las compras pendientes de todos los días, en una sola lista (la misma ListaCompras
// de Semana y de ➕ Registrar). Se agrega aquí mismo (a la lista de hoy), se completan los detalles y se marca comprado:
// el gasto se descuenta del bolsillo que corresponde a la categoría (Alimentación; Aseo, el suyo).
// Arriba, lo gastado en el día (hoy por defecto) y el historial de gastos navegable por fecha: se actualiza solo al marcar comprado.
//   api  {info(categoria), comprar(item), desmarcar(item), nuevaCategoria(label, destino)}
//   onItem(dateKey, itemId, campos)   onAdd(dateKey, item)   onDelete(dateKey, itemId)   budgets: presupuesto (solo lectura)
export default function CarritoModal({ dayData, hoy, budgets, api, onItem, onAdd, onDelete, onClose }) {
  const [dia, setDia] = useState(hoy);
  const [verGastos, setVerGastos] = useState(false);
  const del = useMemo(() => gastosDelDia(budgets, dia), [budgets, dia]);

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

  const cuando = rotuloFecha(dia, hoy);
  return (
    <Ventana onClose={onClose} ancho={440}>
      <VentanaCabecera titulo="🛒 Carrito" sub={`${pendientes} pendiente${pendientes === 1 ? "" : "s"}`} onClose={onClose}/>
      <div style={{ flex: "none", padding: "8px 14px", borderBottom: "1px dashed #bbb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setDia(mover(dia, -1))} aria-label="Día anterior" style={flecha}>‹</button>
          <label style={{ position: "relative", flex: 1, textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>
            📅 {cuando}
            <input type="date" value={dia} max={hoy} onChange={e => { if (e.target.value) setDia(e.target.value); }} aria-label="Elegir fecha" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}/>
          </label>
          <button onClick={() => setDia(mover(dia, 1))} disabled={dia >= hoy} aria-label="Día siguiente" style={{ ...flecha, opacity: dia >= hoy ? 0.35 : 1 }}>›</button>
        </div>
        <button onClick={() => setVerGastos(v => !v)} aria-expanded={verGastos} style={{ width: "100%", marginTop: 6, background: "transparent", border: "none", padding: "4px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: F, fontSize: 13, color: "#111", cursor: "pointer" }}>
          <span>Gastado {cuando.toLowerCase()} <b style={{ fontSize: 16 }}>{fmtCLP(del.total)}</b></span>
          <span style={{ color: "#777", fontSize: 12 }}>{del.gastos.length} gasto{del.gastos.length === 1 ? "" : "s"} {verGastos ? "▴" : "▾"}</span>
        </button>
        {verGastos && (
          <div style={{ maxHeight: "28vh", overflowY: "auto" }}>
            {del.gastos.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "10px 0" }}>Sin gastos este día.</div>}
            {del.gastos.map(g => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "6px 0", borderTop: "1px dashed #ddd" }}>
                <span style={{ minWidth: 0 }}>{g.nota || "(sin nota)"}<div style={{ fontSize: 12, color: "#777" }}>{[g.cartera, g.sub, g.categoria].filter(Boolean).join(" · ")}{g.prestamo ? " · con préstamo" : ""}</div></span>
                <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fmtCLP(g.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        <ListaCompras grupos={grupos} agregarEn={hoy} api={api} onPatch={onItem} onAdd={onAdd} onDelete={onDelete} vacio="no hay compras pendientes"/>
      </div>
      <div style={{ flex: "none", borderTop: "1px dashed #bbb", padding: "10px 16px", fontFamily: F, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
        {pendientes > 0 && <div>Estimado pendiente: <b style={{ color: "#111" }}>{fmtCLP(estimado)}</b>{sinPrecio > 0 && <span style={{ color: "#aaa" }}> · {sinPrecio} sin precio</span>}{porConfirmar > 0 && <span style={{ color: "#aaa" }}> · {porConfirmar} por confirmar</span>}</div>}
        {Object.entries(destinos).map(([id, d]) => d.activo
          ? <div key={id} style={{ color: d.estimado > d.saldo ? "#c00" : "#666" }}>{d.emoji} {d.label}: saldo <b>{fmtCLP(d.saldo)}</b>{d.estimado > d.saldo ? " · el estimado no alcanza" : ""}</div>
          : <div key={id} style={{ color: "#aaa" }}>{d.label} aún no es cartera con sobres: sus compras no descuentan de ningún fondo.</div>)}
        {pendientes === 0 && <div style={{ color: "#aaa" }}>Agrega arriba lo que haga falta comprar.</div>}
      </div>
    </Ventana>
  );
}
