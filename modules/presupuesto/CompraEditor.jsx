import { fmtCLP } from "../../core/format.js";
import { montoCompra } from "../../core/presupuesto-modelo.js";
const { useState } = React;

const F = "'DM Sans',sans-serif";
export const campo = { width: "100%", boxSizing: "border-box", border: "1px dashed #bbb", borderRadius: 6, padding: "7px 8px", fontSize: 14, fontFamily: F, background: "#fff", outline: "none", color: "#111" };
export const rotulo = { fontFamily: F, fontSize: 9, color: "#999", letterSpacing: 2, textTransform: "uppercase", margin: "8px 0 3px" };

// Resumen de un ítem de compras: «2× $1.500 = $3.000 · Verdura».
export function ChipCompra({ item }) {
  const m = montoCompra(item);
  if (!m && !item.categoria) return null;
  const cant = Number(item.cantidad) > 0 ? Number(item.cantidad) : 1;
  const est = !!item.estimado;      // precio que viene de la memoria: referencia, aún sin confirmar
  const precio = m ? `${est ? "~" : ""}${cant !== 1 ? cant + "× " : ""}${fmtCLP(Number(item.precio))}${cant !== 1 ? " = " + fmtCLP(m) : ""}${est ? " · estimado" : ""}` : "";
  return <div style={{ fontFamily: F, fontSize: 10, color: "#999", marginTop: 1 }}>{precio}{precio && item.categoria ? " · " : ""}{item.categoria || ""}</div>;
}

// Texto de «de dónde se descuenta» según lo que sabe el presupuesto para la categoría elegida.
export function DescuentaDe({ info, total }) {
  const noAlcanza = info.activo && total > (info.saldo || 0);
  return (
    <div style={{ fontFamily: F, fontSize: 11, marginTop: 8, color: noAlcanza ? "#c00" : "#888", lineHeight: 1.4 }}>
      {info.activo
        ? (noAlcanza ? `No alcanza: en ${info.destLabel} hay ${fmtCLP(info.saldo)}. Registra con 💸 Gasto si necesitas multifinanciamiento.` : `Se descuenta de ${info.destLabel}: saldo ${fmtCLP(info.saldo)}.`)
        : `${info.destLabel} aún no es cartera con sobres activos: se guarda el precio, pero no se descuenta de ningún fondo.`}
    </div>
  );
}

// Selector de categoría de compras, con «+ nueva categoría…» y el destino que tendrá (de dónde descuenta).
//   info  lo que sabe el presupuesto: {categorias, puedeNuevaCategoria, destinos}
export function SelectorCategoria({ info, cat, setCat, nueva, setNueva, destNueva, setDestNueva, alCambiar }) {
  const cambia = fn => e => { fn(e.target.value); if (alCambiar) alCambiar(); };
  return (
    <>
      <div style={rotulo}>Categoría</div>
      <select value={cat} onChange={cambia(setCat)} style={campo}>
        <option value="">Sin categoría</option>
        {(info.categorias || []).map(c => <option key={c} value={c}>{c}</option>)}
        {info.puedeNuevaCategoria && <option value="__nueva">+ nueva categoría…</option>}
      </select>
      {cat === "__nueva" && <>
        <input value={nueva} onChange={cambia(setNueva)} placeholder="nombre de la categoría" style={{ ...campo, marginTop: 6 }}/>
        <div style={rotulo}>Descuenta de</div>
        <select value={destNueva} onChange={cambia(setDestNueva)} style={campo}>
          {(info.destinos || []).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </>}
    </>
  );
}

// Editor de un ítem de compras: cantidad, precio unitario, categoría y (si la cartera de destino las tiene) sub-partida.
//   acciones  {info(categoria, destinoForzado), guardar(campos), comprar(campos) → mensaje de error o null,
//              sinGasto(campos), nuevaCategoria(label, destino) → mensaje de error o null}
export function CompraEditor({ item, acciones, onClose }) {
  const [cant, setCant] = useState(String(Number(item.cantidad) > 0 ? item.cantidad : 1));
  const [precio, setPrecio] = useState(Number(item.precio) > 0 ? String(item.precio) : "");
  const [cat, setCat] = useState(item.categoria || "");
  const [nueva, setNueva] = useState("");
  const [destNueva, setDestNueva] = useState("ali");
  const [subSel, setSubSel] = useState(item.subId !== undefined && item.subId !== null ? String(item.subId) : "");
  const [err, setErr] = useState("");

  const catEf = (cat === "__nueva" ? nueva.trim() : cat) || undefined;
  const info = acciones.info(catEf, cat === "__nueva" ? destNueva : undefined);
  const bolsillos = info.bolsillos || [];
  const bolsillo = bolsillos.find(b => String(b.subId) === subSel) || bolsillos[0] || null;
  const cantNum = parseFloat(String(cant).replace(",", ".")) > 0 ? parseFloat(String(cant).replace(",", ".")) : 1;
  const precioNum = parseInt(String(precio).replace(/\D/g, "")) || 0;
  const total = Math.round(cantNum * precioNum);
  const saldo = bolsillo ? bolsillo.saldo : (info.saldo || 0);
  const noAlcanza = info.activo && total > saldo;
  const campos = () => ({ cantidad: cantNum, precio: precioNum, categoria: catEf, subId: bolsillo ? bolsillo.subId : null });
  const limpiar = () => setErr("");

  function prepararCategoria() {
    if (cat === "__nueva") {
      if (!nueva.trim()) { setErr("Escribe el nombre de la categoría."); return false; }
      const e = acciones.nuevaCategoria(nueva.trim(), destNueva);
      if (e) { setErr(e); return false; }
    }
    return true;
  }
  function guardar() { if (!prepararCategoria()) return; acciones.guardar(campos()); }
  function comprado() {
    if (info.activo && precioNum <= 0) { setErr("Pon el precio para descontarlo del fondo."); return; }
    if (info.activo && !catEf) { setErr("Elige la categoría: todo gasto lleva una."); return; }
    if (!prepararCategoria()) return;
    const e = acciones.comprar(campos());
    if (e) setErr(e);
  }
  function sinGasto() { if (!prepararCategoria()) return; acciones.sinGasto(campos()); }
  const boton = (primario) => ({ flex: 1, padding: "9px 6px", background: primario ? "#111" : "#fff", color: primario ? "#fff" : "#444", border: primario ? "none" : "1px dashed #bbb", borderRadius: 8, fontFamily: "'Caveat',cursive", fontSize: 17, fontWeight: 700, cursor: "pointer" });

  return (
    <div onClick={e => e.stopPropagation()} style={{ background: "#fafafa", border: "1px dashed #ccc", borderRadius: 8, padding: "6px 10px 10px", margin: "2px 0 8px" }}>
      {(item.estimado || (acciones.referencia && acciones.referencia(item.text))) && (() => {
        const ref = acciones.referencia ? acciones.referencia(item.text) : null, rg = ref && ref.rango;
        return (<div style={{ fontFamily: F, fontSize: 12, color: "#555", background: "#fff", border: "1px dashed #999", borderRadius: 6, padding: "6px 8px", margin: "6px 0 2px", lineHeight: 1.4 }}>
          {item.estimado && <b style={{ color: "#111" }}>Confirma el precio de hoy. </b>}
          {ref && ref.p > 0 ? `La última vez fue ${fmtCLP(ref.p)}` : "Aún no hay precio de referencia"}{rg && rg.n > 1 ? `; las últimas ${rg.n} veces, entre ${fmtCLP(rg.min)} y ${fmtCLP(rg.max)}.` : "."}
        </div>);
      })()}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ width: 64 }}>
          <div style={rotulo}>Cantidad</div>
          <input inputMode="decimal" value={cant} onChange={e => { setCant(e.target.value); limpiar(); }} style={{ ...campo, textAlign: "center" }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={rotulo}>Precio unitario</div>
          <input inputMode="numeric" value={precio ? fmtCLP(precioNum) : ""} onChange={e => { setPrecio(e.target.value); limpiar(); }} placeholder="$0" style={{ ...campo, textAlign: "right" }}/>
        </div>
        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: noAlcanza ? "#c00" : "#111", paddingBottom: 9, minWidth: 70, textAlign: "right" }}>{total ? fmtCLP(total) : "—"}</div>
      </div>

      <SelectorCategoria info={info} cat={cat} setCat={setCat} nueva={nueva} setNueva={setNueva} destNueva={destNueva} setDestNueva={setDestNueva} alCambiar={limpiar}/>

      {info.activo && bolsillos.length > 1 && <>
        <div style={rotulo}>Sub-partida</div>
        <select value={bolsillo ? String(bolsillo.subId) : ""} onChange={e => { setSubSel(e.target.value); limpiar(); }} style={campo}>
          {bolsillos.map(b => <option key={String(b.subId)} value={String(b.subId)}>{b.emoji} {b.label} · saldo {fmtCLP(b.saldo)}</option>)}
        </select>
      </>}

      <DescuentaDe info={{ ...info, saldo }} total={total}/>
      {err && <div style={{ fontFamily: F, fontSize: 12, color: "#c00", marginTop: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={comprado} disabled={noAlcanza} style={{ ...boton(true), background: noAlcanza ? "#ccc" : "#111", cursor: noAlcanza ? "default" : "pointer" }}>Comprado ✓</button>
        <button onClick={guardar} style={boton(false)}>Guardar</button>
        <button onClick={onClose} style={{ ...boton(false), flex: "0 0 auto", padding: "9px 12px" }}>×</button>
      </div>
      {info.activo && <button onClick={sinGasto} style={{ background: "transparent", border: "none", color: "#aaa", fontFamily: F, fontSize: 11, cursor: "pointer", marginTop: 6, padding: 0, textDecoration: "underline" }}>marcar comprado sin descontar</button>}
    </div>
  );
}
