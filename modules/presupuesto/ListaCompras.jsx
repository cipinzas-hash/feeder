// Lista de compras ÚNICA: la usan 🛒 Carrito (menú superior), 🛒 Compras de cada día en Semana y ➕ Registrar › Compra.
// Mismo comportamiento en los tres: agregar con detalles (cantidad, precio, categoría), × en cada ítem, tocar un ítem para
// editarlo y casilla para marcarlo comprado (descuenta del bolsillo que le toca por categoría). No hay botón de limpiar:
// los ítems se quitan de a uno con su ×.
import { fmtCLP } from "../../core/format.js";
import { montoCompra } from "../../core/presupuesto-modelo.js";
import { CompraEditor, ChipCompra, DescuentaDe, SelectorCategoria, campo, rotulo } from "./CompraEditor.jsx";
const { useState, useRef } = React;

const F = "'DM Sans',sans-serif";
const enlace = { background: "transparent", border: "none", color: "#999", fontFamily: F, fontSize: 11, cursor: "pointer", padding: "6px 0 0", textDecoration: "underline" };
const nuevoId = () => Date.now().toString() + Math.random().toString(36).slice(2, 5);

// Agregar un ítem: el nombre basta; «+ detalles» suma cantidad, precio y categoría desde el primer momento.
function NuevaCompra({ api, onAdd, autoFocus }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [cant, setCant] = useState("1");
  const [precio, setPrecio] = useState("");
  const [cat, setCat] = useState("");
  const [nueva, setNueva] = useState("");
  const [destNueva, setDestNueva] = useState("ali");
  const [err, setErr] = useState("");

  const catEf = (cat === "__nueva" ? nueva.trim() : cat) || undefined;
  const info = api.info(catEf, cat === "__nueva" ? destNueva : undefined);
  const cantNum = parseFloat(String(cant).replace(",", ".")) > 0 ? parseFloat(String(cant).replace(",", ".")) : 1;
  const precioNum = parseInt(String(precio).replace(/\D/g, "")) || 0;

  function agregar() {
    const t = texto.trim();
    if (!t) return;
    if (cat === "__nueva") {
      if (!nueva.trim()) { setErr("Escribe el nombre de la categoría."); setAbierto(true); return; }
      const e = api.nuevaCategoria(nueva.trim(), destNueva);
      if (e) { setErr(e); setAbierto(true); return; }
    }
    const item = { id: nuevoId(), text: t, done: false };
    if (cantNum !== 1) item.cantidad = cantNum;
    if (precioNum > 0) item.precio = precioNum;
    if (catEf) item.categoria = catEf;
    onAdd(item);
    setTexto(""); setCant("1"); setPrecio(""); setErr("");
    if (cat === "__nueva") { setCat(nueva.trim()); setNueva(""); }        // la categoría queda elegida para seguir anotando
  }
  const total = Math.round(cantNum * precioNum);
  return (
    <div style={{ paddingBottom: 8, marginBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={texto} onChange={e => { setTexto(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} autoFocus={autoFocus}
          placeholder="agregar ítem..." style={{ ...campo, flex: 1, border: "1px dashed #ddd", borderRadius: 8, padding: "8px 10px" }}/>
        <button onClick={agregar} disabled={!texto.trim()} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16, opacity: texto.trim() ? 1 : 0.4 }}>+</button>
      </div>
      <button onClick={() => setAbierto(a => !a)} style={enlace}>{abierto ? "− ocultar detalles" : "+ detalles (cantidad, precio, categoría)"}{!abierto && (precioNum > 0 || catEf) ? " ·" + (catEf ? " " + catEf : "") + (total ? " " + fmtCLP(total) : "") : ""}</button>
      {abierto && (
        <div style={{ background: "#fafafa", border: "1px dashed #ccc", borderRadius: 8, padding: "2px 10px 10px", marginTop: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 64 }}>
              <div style={rotulo}>Cantidad</div>
              <input inputMode="decimal" value={cant} onChange={e => setCant(e.target.value)} style={{ ...campo, textAlign: "center" }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={rotulo}>Precio unitario</div>
              <input inputMode="numeric" value={precio ? fmtCLP(precioNum) : ""} onChange={e => setPrecio(e.target.value)} placeholder="$0" style={{ ...campo, textAlign: "right" }}/>
            </div>
          </div>
          <SelectorCategoria info={info} cat={cat} setCat={setCat} nueva={nueva} setNueva={setNueva} destNueva={destNueva} setDestNueva={setDestNueva} alCambiar={() => setErr("")}/>
          {(catEf || precioNum > 0) && <DescuentaDe info={info} total={total}/>}
        </div>
      )}
      {err && <div style={{ fontFamily: F, fontSize: 12, color: "#c00", marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// grupos         [{key, titulo?, vencido?, items}]  (key = día o lista; un grupo sin título es una lista simple)
// agregarEn      key del grupo donde se agrega un ítem nuevo
// api            {info(categoria, destino), comprar(item), desmarcar(item), nuevaCategoria(label, destino)}
// onPatch(key, id, campos)   onAdd(key, item)   onDelete(key, id)
// onReorder(key, items) y onMoveNext(key, item): solo la lista de un día (mantener pulsado para ordenar, deslizar → para pasar al día siguiente)
export default function ListaCompras({ grupos, agregarEn, api, onPatch, onAdd, onDelete, onReorder, onMoveNext, autoFocus, vacio = "lista vacía" }) {
  const [editId, setEditId] = useState(null);          // `${key}|${id}`
  const [msg, setMsg] = useState("");
  const [held, setHeld] = useState(null);              // `${key}|${idx}`
  const [dragTarget, setDragTarget] = useState(null);
  const holdTimer = useRef(null);
  const tx = useRef(0);
  const ty = useRef(0);
  const total = grupos.reduce((t, g) => t + g.items.length, 0);

  function alternar(g, it) {
    if (held !== null) return;
    setMsg("");
    if (it.done) {
      const r = api.desmarcar(it);
      if (r.error) { setMsg(r.error); return; }
      onPatch(g.key, it.id, { done: false, ...(r.patch || {}) });
      return;
    }
    if (api.info(it.categoria).activo && montoCompra(it) === 0) { setEditId(`${g.key}|${it.id}`); return; }
    const r = api.comprar(it);
    if (r.error) { setMsg(r.error); return; }
    onPatch(g.key, it.id, { done: true, ...(r.patch || {}) });
  }
  const accionesDe = (g, it) => ({
    info: api.info,
    guardar: f => { onPatch(g.key, it.id, f); setEditId(null); },
    comprar: f => {
      const r = api.comprar({ ...it, ...f });
      if (r.error) return r.error;
      onPatch(g.key, it.id, { ...f, done: true, ...(r.patch || {}) });
      setEditId(null);
      return null;
    },
    sinGasto: f => { onPatch(g.key, it.id, { ...f, done: true }); setEditId(null); },
    nuevaCategoria: api.nuevaCategoria,
  });
  const casilla = (hecho, onClick, oscuro) => (
    <div onClick={onClick} style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px dashed ${hecho ? "#111" : "#bbb"}`, background: hecho ? "#111" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, ...(oscuro ? { borderColor: "#888" } : {}) }}>
      {hecho && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
    </div>
  );

  const ordenable = !!onReorder;
  function toquesDe(g, idx, item) {
    if (!ordenable) return {};
    const id = `${g.key}|${idx}`;
    return {
      onTouchStart: e => { holdTimer.current = setTimeout(() => setHeld(id), 350); tx.current = e.touches[0].clientX; ty.current = e.touches[0].clientY; },
      onTouchMove: e => {
        const dx = e.touches[0].clientX - tx.current, dy = e.touches[0].clientY - ty.current;
        if (held === id && Math.abs(dy) > 10) {
          const els = [...e.currentTarget.parentNode.children];
          const my = e.touches[0].clientY;
          const ti = els.findIndex(el => { const r = el.getBoundingClientRect(); return my >= r.top && my <= r.bottom; });
          if (ti >= 0 && ti !== idx) setDragTarget(ti);
        } else if (dx > 5) clearTimeout(holdTimer.current);
      },
      onTouchEnd: e => {
        clearTimeout(holdTimer.current);
        const dx = e.changedTouches[0].clientX - tx.current;
        if (held === id) {
          if (dragTarget !== null && dragTarget !== idx) { const next = [...g.items]; const [m] = next.splice(idx, 1); next.splice(dragTarget, 0, m); onReorder(g.key, next); }
          else if (dx > 60 && onMoveNext) onMoveNext(g.key, item);
        }
        setHeld(null); setDragTarget(null);
      },
    };
  }

  return (
    <div>
      <NuevaCompra api={api} onAdd={item => onAdd(agregarEn, item)} autoFocus={autoFocus}/>
      {msg && <div style={{ fontFamily: F, fontSize: 12, color: "#c00", background: "#fff5f5", border: "1px dashed #e0b0b0", borderRadius: 6, padding: "8px 10px", margin: "2px 0 8px" }}>{msg}</div>}
      {total === 0 && <div style={{ color: "#ccc", fontFamily: F, fontSize: 13, textAlign: "center", padding: "20px 0" }}>{vacio}</div>}
      {grupos.filter(g => g.items.length > 0).map(g => (
        <div key={g.key + (g.titulo || "")} style={{ marginBottom: 6 }}>
          {g.titulo && <div style={{ fontFamily: F, fontSize: 10, color: g.vencido ? "#a60" : "#999", letterSpacing: 2, textTransform: "uppercase", margin: "8px 0 2px" }}>{g.titulo}</div>}
          {g.items.map((item, idx) => {
            const k = `${g.key}|${item.id}`;
            const sostenido = held === `${g.key}|${idx}`;
            const objetivo = dragTarget === idx && held !== null && held.startsWith(g.key + "|") && !sostenido;
            return (
              <div key={item.id}>
                {objetivo && <div style={{ height: 2, background: "#111", borderRadius: 1, margin: "2px 0" }}/>}
                <div {...toquesDe(g, idx, item)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${sostenido ? "#111" : "#f5f5f5"}`, background: sostenido ? "#111" : "transparent", borderRadius: sostenido ? 6 : 0, userSelect: "none", ...(ordenable ? { touchAction: "pan-x" } : {}) }}>
                  {ordenable && <span style={{ color: sostenido ? "#fff" : "#ccc", fontSize: 12, padding: "0 2px" }}>⠿</span>}
                  {casilla(!!item.done, () => alternar(g, item), sostenido)}
                  <div onClick={() => { if (!item.done) setEditId(editId === k ? null : k); }} style={{ flex: 1, minWidth: 0, cursor: item.done ? "default" : "pointer" }}>
                    <div style={{ fontFamily: F, fontSize: 14, color: item.done ? "#bbb" : "#333", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</div>
                    <ChipCompra item={item}/>
                  </div>
                  <button onClick={e => { e.stopPropagation(); if (held === null) onDelete(g.key, item.id); }} title="Quitar de la lista" aria-label={`Quitar ${item.text}`}
                    style={{ background: "transparent", border: "none", color: sostenido ? "#777" : "#bbb", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "4px 8px" }}>×</button>
                </div>
                {editId === k && !item.done && <CompraEditor item={item} acciones={accionesDe(g, item)} onClose={() => setEditId(null)}/>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
