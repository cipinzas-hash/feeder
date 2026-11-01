// Lista de compras ÚNICA: la usan 🛒 Carrito (menú superior), 🛒 Compras de cada día en Semana y ➕ Registrar › Compra.
// Mismo comportamiento en los tres: agregar con detalles (cantidad, precio, categoría), × en cada ítem, tocar un ítem para
// editarlo y casilla para marcarlo comprado (descuenta del bolsillo que le toca por categoría). No hay botón de limpiar:
// los ítems se quitan de a uno con su ×.
import { fmtCLP } from "../../core/format.js";
import { montoCompra } from "../../core/presupuesto-modelo.js";
import { claveNombre } from "../../core/comprasMemoria.js";
import { CompraEditor, ChipCompra, DescuentaDe, SelectorCategoria, campo, rotulo } from "./CompraEditor.jsx";
const { useState, useRef } = React;

const F = "'DM Sans',sans-serif";
const enlace = { background: "transparent", border: "none", color: "#999", fontFamily: F, fontSize: 11, cursor: "pointer", padding: "6px 0 0", textDecoration: "underline" };
const nuevoId = () => Date.now().toString() + Math.random().toString(36).slice(2, 5);

// Agregar un ítem: el nombre basta; «+ detalles» suma cantidad, precio y categoría desde el primer momento. Al escribir sugiere lo que ya se
// compró de verdad (memoria): así no nacen dos nombres para lo mismo. El precio recordado entra como ESTIMADO: se confirma al comprar.
function NuevaCompra({ api, onAdd, autoFocus, pendientes }) {
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

  const q = texto.trim();
  const sugs = q && api.sugerir ? api.sugerir(q) : [];
  const exacto = sugs.length && sugs[0].score >= 3 ? sugs[0].m : null;
  const dup = q ? (pendientes || []).find(x => !x.done && claveNombre(x.text) === claveNombre(q)) : null;
  const limpiar = () => { setTexto(""); setCant("1"); setPrecio(""); setErr(""); };

  function agregar() {
    if (!q || dup) return;
    if (cat === "__nueva") {
      if (!nueva.trim()) { setErr("Escribe el nombre de la categoría."); setAbierto(true); return; }
      const e = api.nuevaCategoria(nueva.trim(), destNueva);
      if (e) { setErr(e); setAbierto(true); return; }
    }
    const item = { id: nuevoId(), text: exacto ? exacto.n : q, done: false };
    if (cantNum !== 1) item.cantidad = cantNum;
    if (precioNum > 0) item.precio = precioNum;
    else if (exacto && exacto.p > 0) { item.precio = exacto.p; item.estimado = true; }
    const categoria = catEf || (exacto && exacto.cat) || undefined;
    if (categoria) item.categoria = categoria;
    onAdd(item);
    limpiar();
    if (cat === "__nueva") { setCat(nueva.trim()); setNueva(""); }        // la categoría queda elegida para seguir anotando
  }
  function usar(m) {
    if ((pendientes || []).some(x => !x.done && claveNombre(x.text) === claveNombre(m.n))) { setErr(`«${m.n}» ya está en la lista.`); return; }
    const item = { id: nuevoId(), text: m.n, done: false };
    if (m.cat) item.categoria = m.cat;
    if (m.p > 0) { item.precio = m.p; item.estimado = true; }
    onAdd(item);
    limpiar();
  }
  const total = Math.round(cantNum * precioNum);
  const fechaCorta = iso => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : ""; };
  return (
    <div style={{ paddingBottom: 8, marginBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={texto} onChange={e => { setTexto(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} autoFocus={autoFocus}
          placeholder="agregar ítem..." style={{ ...campo, flex: 1, border: "1px dashed #ddd", borderRadius: 8, padding: "8px 10px" }}/>
        <button onClick={agregar} disabled={!q || !!dup} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16, opacity: q && !dup ? 1 : 0.4 }}>+</button>
      </div>
      {q && (<div>
        {dup && <div style={{ fontFamily: F, fontSize: 12, border: "1px dashed #b71c1c", color: "#b71c1c", borderRadius: 6, padding: "6px 8px", marginTop: 6 }}>Ya está en tu lista como «{dup.text}». No hace falta agregarlo de nuevo.</div>}
        {!dup && exacto && claveNombre(exacto.n) === claveNombre(q) && exacto.n !== q && <div style={{ fontFamily: F, fontSize: 12, color: "#777", marginTop: 6 }}>«{q}» es lo mismo que «{exacto.n}»: se usa ese nombre.</div>}
        {!dup && !exacto && sugs.length > 0 && sugs[0].similar && <div style={{ fontFamily: F, fontSize: 12, color: "#777", marginTop: 6 }}>¿Quisiste decir «{sugs[0].m.n}»?</div>}
        {(sugs.length > 0 || !exacto) && (
          <div style={{ border: "1px dashed #111", borderRadius: 8, marginTop: 6, overflow: "hidden" }}>
            {sugs.map((x, i) => (
              <div key={x.k} role="button" tabIndex={0} onClick={() => usar(x.m)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); usar(x.m); } }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontFamily: F, fontSize: 13, cursor: "pointer", borderBottom: "1px dashed #ddd", background: i === 0 && !dup ? "#111" : "#fff", color: i === 0 && !dup ? "#fff" : "#111" }}>
                <span style={{ flex: 1, minWidth: 0 }}>{x.m.n}<div style={{ fontSize: 12, color: i === 0 && !dup ? "#bbb" : "#777" }}>{x.m.cat ? x.m.cat + " · " : ""}{x.m.p > 0 ? `última vez ${fmtCLP(x.m.p)}` : "sin precio aún"} · {x.m.veces} veces{x.m.ult ? ` · ${fechaCorta(x.m.ult)}` : ""}</div></span>
                <span style={{ fontSize: 12, color: i === 0 && !dup ? "#bbb" : "#777" }}>usar</span>
              </div>
            ))}
            {!exacto && !dup && (
              <div role="button" tabIndex={0} onClick={agregar} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); agregar(); } }} style={{ padding: "8px 10px", fontFamily: F, fontSize: 13, cursor: "pointer", background: "#fff", color: "#111" }}>
                ➕ Agregar «{q}» como nuevo<div style={{ fontSize: 12, color: "#777" }}>se recuerda cuando lo marques comprado</div>
              </div>
            )}
          </div>
        )}
      </div>)}
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
    // Sin precio, sin categoría o con un precio solo estimado (de la memoria) no se descuenta: se completa y confirma en el editor.
    if (api.info(it.categoria).activo && (montoCompra(it) === 0 || it.estimado || !(it.categoria && String(it.categoria).trim()))) { setEditId(`${g.key}|${it.id}`); return; }
    const r = api.comprar(it);
    if (r.error) { setMsg(r.error); return; }
    onPatch(g.key, it.id, { done: true, ...(r.patch || {}) });
    if (api.recordar) api.recordar(it);
  }
  const accionesDe = (g, it) => {
    const confirma = f => f.precio !== it.precio || !it.estimado;      // el precio cambió, o ya estaba confirmado
    return {
      info: api.info,
      referencia: api.referencia,
      guardar: f => { onPatch(g.key, it.id, { ...f, estimado: it.estimado ? !confirma(f) : false }); setEditId(null); },
      comprar: f => {
        const r = api.comprar({ ...it, ...f, estimado: false });
        if (r.error) return r.error;
        onPatch(g.key, it.id, { ...f, estimado: false, done: true, ...(r.patch || {}) });
        if (api.recordar) api.recordar({ ...it, ...f, estimado: false });
        setEditId(null);
        return null;
      },
      sinGasto: f => { const est = it.estimado ? !confirma(f) : false; onPatch(g.key, it.id, { ...f, estimado: est, done: true }); if (api.recordar) api.recordar({ ...it, ...f, estimado: est }); setEditId(null); },
      nuevaCategoria: api.nuevaCategoria,
    };
  };
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
      <NuevaCompra api={api} onAdd={item => onAdd(agregarEn, item)} autoFocus={autoFocus} pendientes={grupos.flatMap(g => g.items)}/>
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
