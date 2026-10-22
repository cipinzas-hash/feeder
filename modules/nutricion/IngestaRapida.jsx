// Registro rápido de ingesta. Se abre desde ➕ Registrar (barra superior) y también al cargar un mazo en NutricionPage.
// Todo el cálculo (porciones, entradas, recientes, repetir) vive en ingesta.js — acá solo hay pantalla.
// Siempre AGREGA al registro del día (nunca pisa lo ya registrado). `fecha` por defecto es hoy.
import { MEALS, getDefaultMeal, fechaKey, buscarAlimentos, todosLosAlimentos, armarEntrada, armarEntradaEstimada, inferirComidaMazo, alimentosRecientes, ultimaComida } from "./ingesta.js";
import ControlesPorcion from "./ControlesPorcion.jsx";
import VentanaArriba, { Hechos } from "../../core/VentanaArriba.jsx";
const { useState, useMemo } = React;

const F = "'DM Sans',sans-serif";
const C = "'Caveat',cursive";
const rotulo = { fontFamily: F, fontSize: 10, color: "#aaa", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 };
const chip = (activo) => ({ fontFamily: F, fontSize: 12, padding: "6px 12px", borderRadius: 14, border: "1px dashed #ddd", background: activo ? "#111" : "transparent", color: activo ? "#fff" : "#555", cursor: "pointer" });
const btnPrincipal = { width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontFamily: C, fontSize: 18, cursor: "pointer", marginBottom: 10 };
const btnSecundario = { width: "100%", background: "transparent", color: "#999", border: "none", padding: "8px", fontFamily: F, fontSize: 12, cursor: "pointer" };
const campo = { width: "100%", border: "1px dashed #ccc", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box", color: "#111" };

// permanecer: desde ➕ Registrar la ventana queda abierta al guardar (se cierra tocando fuera). Al cargar un mazo desde Nutrición, cierra.
function IngestaRapida({ nutriLog, saveNutriLog, customFoods, foodOverrides, nutriDecks, fecha, mazoInicial, permanecer, onClose, onGuardado }) {
  const dk = fecha || fechaKey();
  const [paso, setPaso] = useState(mazoInicial ? "bandeja" : "inicio"); // inicio | porcion | bandeja | estimar
  const [meal, setMeal] = useState(mazoInicial ? (mazoInicial.meal || inferirComidaMazo(mazoInicial.items)) : getDefaultMeal());
  const [query, setQuery] = useState("");
  const [bandeja, setBandeja] = useState(() => mazoInicial ? (mazoInicial.items || []).map(e => ({ ...e })) : []);
  const [titulo, setTitulo] = useState(mazoInicial ? mazoInicial.name : "");
  const [aBandeja, setABandeja] = useState(!!mazoInicial); // true: lo que se elija se suma a la bandeja en vez de guardarse directo
  const [food, setFood] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [qty, setQty] = useState(1);
  const [fraction, setFraction] = useState(1);
  const [sizeKey, setSizeKey] = useState("M");
  const [est, setEst] = useState(null);
  const [hechos, setHechos] = useState([]);

  const comida = MEALS.find(m => m.id === meal) || MEALS[0];
  const todos = useMemo(() => todosLosAlimentos(foodOverrides, customFoods), [foodOverrides, customFoods]);
  const resultados = useMemo(() => buscarAlimentos(query, foodOverrides, customFoods, 6), [query, foodOverrides, customFoods]);
  const recientes = useMemo(() => alimentosRecientes(nutriLog, foodOverrides, customFoods, 8), [nutriLog, foodOverrides, customFoods]);
  const previa = ultimaComida(nutriLog, meal, dk);
  const baseDe = (e) => e.id ? todos.find(f => f.id === e.id) : null;
  const fechaCorta = (k) => { const [, m, d] = k.split("-"); return `${d}/${m}`; };
  const kcalBandeja = Math.round(bandeja.reduce((s, e) => s + (e.kcal || 0) * (e.qty || 0), 0));

  // `actual`: entrada que se está corrigiendo. En alimentos por cantidad (unidades o pasos de 50 g) el selector parte
  // desde lo que había; en fracción/calibre la entrada solo guarda la etiqueta, así que parten de los valores por defecto.
  function elegir(f, idx = null, actual = null) {
    setFood(f); setEditIdx(idx);
    const porCantidad = !f.portionType || f.portionType === "weight100";
    setQty(actual && porCantidad && actual.qty > 0 ? actual.qty : (f.portionType === "weight100" ? 2 : 1));
    setFraction(1); setSizeKey("M");
    setPaso("porcion");
  }
  function guardar(items, texto) {
    const nuevos = items.map(e => ({ ...e, meal, uid: Date.now() + Math.random() }));
    saveNutriLog({ ...nutriLog, [dk]: [...(nutriLog[dk] || []), ...nuevos] });
    if (onGuardado) onGuardado(`${texto} ✓`);
    if (permanecer) { setHechos(h => [...h, texto]); reiniciar(); } else onClose();
  }
  function reiniciar() {
    setPaso("inicio"); setQuery(""); setBandeja([]); setTitulo(""); setABandeja(false);
    setFood(null); setEditIdx(null); setEst(null);
  }
  function confirmarPorcion() {
    const entry = armarEntrada(food, qty, fraction, sizeKey, meal);
    if (aBandeja) {
      setBandeja(b => editIdx == null ? [...b, entry] : b.map((e, i) => i === editIdx ? entry : e));
      setEditIdx(null); setPaso("bandeja"); return;
    }
    guardar([entry], `${comida.label} · ${food.name}`);
  }
  function confirmarEstimada() {
    const e = armarEntradaEstimada(est, meal);
    if (!e) return;
    if (aBandeja) { setBandeja(b => [...b, e]); setEst(null); setPaso("bandeja"); return; }
    guardar([e], `${comida.label} · ${e.name}`);
  }
  function abrirBandeja(items, nombre, mealId) {
    setBandeja(items.map(e => ({ ...e })));
    setTitulo(nombre); if (mealId) setMeal(mealId);
    setABandeja(true); setPaso("bandeja");
  }
  function volverDePorcion() { setEditIdx(null); setPaso(aBandeja && bandeja.length ? "bandeja" : "inicio"); }

  const selectorComida = (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {MEALS.map(m => (
        <button key={m.id} onClick={() => setMeal(m.id)}
          style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "1.5px solid", borderColor: meal === m.id ? "#111" : "#eee", background: meal === m.id ? "#111" : "transparent", color: meal === m.id ? "#fff" : "#999", fontFamily: C, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {m.emoji} {m.label}
        </button>
      ))}
    </div>
  );

  let contenido = null;

  if (paso === "porcion" && food) {
    contenido = (
      <div>
        <div style={{ fontFamily: C, fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 2 }}>{food.emoji} {food.name}</div>
        <div style={{ fontFamily: F, fontSize: 12, color: "#aaa", marginBottom: 20 }}>{food.prep}</div>
        <ControlesPorcion food={food} qty={qty} setQty={setQty} fraction={fraction} setFraction={setFraction}
          sizeKey={sizeKey} setSizeKey={setSizeKey} meal={meal} setMeal={setMeal} />
        <button onClick={confirmarPorcion} style={btnPrincipal}>{aBandeja ? (editIdx == null ? "sumar a la comida" : "cambiar porción") : "registrar"}</button>
        <button onClick={volverDePorcion} style={btnSecundario}>volver</button>
      </div>
    );
  } else if (paso === "estimar" && est) {
    contenido = (
      <div>
        <div style={{ fontFamily: C, fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 14 }}>Registrar sin datos exactos</div>
        <input value={est.descripcion} onChange={e => setEst(s => ({ ...s, descripcion: e.target.value }))} autoFocus
          placeholder="ej: 3 completos italianos / picoteo de cumpleaños" style={{ ...campo, marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setEst(s => ({ ...s, certainty: "estimado" }))}
            style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: "1.5px solid", borderColor: est.certainty === "estimado" ? "#c9a227" : "#eee", background: est.certainty === "estimado" ? "#fffbe8" : "transparent", fontFamily: F, fontSize: 12, cursor: "pointer", color: "#555" }}>
            🟡 estimado
          </button>
          <button onClick={() => setEst(s => ({ ...s, certainty: "desconocido" }))}
            style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: "1.5px solid", borderColor: est.certainty === "desconocido" ? "#e53935" : "#eee", background: est.certainty === "desconocido" ? "#fff0f0" : "transparent", fontFamily: F, fontSize: 12, cursor: "pointer", color: "#555" }}>
            🔴 no sé / desconocido
          </button>
        </div>
        {est.certainty === "estimado" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[["kcalMin", "kcal mín"], ["kcalMax", "kcal máx"], ["protMin", "prot mín (g)"], ["protMax", "prot máx (g)"]].map(([k, l]) => (
              <input key={k} type="number" value={est[k]} placeholder={l} onChange={e => setEst(s => ({ ...s, [k]: e.target.value }))} style={campo} />
            ))}
          </div>
        )}
        <button onClick={confirmarEstimada} disabled={!est.descripcion.trim() || !est.certainty}
          style={{ ...btnPrincipal, opacity: (!est.descripcion.trim() || !est.certainty) ? 0.4 : 1 }}>{aBandeja ? "sumar a la comida" : "registrar"}</button>
        <button onClick={() => { setEst(null); setPaso(aBandeja && bandeja.length ? "bandeja" : "inicio"); }} style={btnSecundario}>volver</button>
      </div>
    );
  } else if (paso === "bandeja") {
    contenido = (
      <div>
        <div style={{ fontFamily: C, fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 2 }}>{titulo || "tu comida"}</div>
        <div style={{ fontFamily: F, fontSize: 11, color: "#aaa", marginBottom: 12 }}>revisa y ajusta antes de registrar · el mazo original no se toca</div>
        {selectorComida}
        {bandeja.length === 0 && <div style={{ fontFamily: F, fontSize: 12, color: "#aaa", padding: "10px 0" }}>no queda ningún alimento</div>}
        {bandeja.map((e, i) => {
          const base = baseDe(e);
          return (
            <div key={e.uid || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px dashed #eee" }}>
              <span style={{ fontSize: 18 }}>{e.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F, fontSize: 13, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div style={{ fontFamily: F, fontSize: 10, color: e.certainty ? "#c9a227" : "#aaa" }}>
                  {e.certainty ? (e.certainty === "desconocido" ? "sin datos nutricionales" : "estimado") : `${e.unit || ""} · ${Math.round((e.kcal || 0) * (e.qty || 0))} kcal`}
                </div>
              </div>
              {base && <button onClick={() => elegir(base, i, e)} title="cambiar porción" style={{ background: "transparent", border: "none", color: "#999", fontSize: 14, cursor: "pointer", padding: "4px 6px" }}>✎</button>}
              <button onClick={() => setBandeja(b => b.filter((_, j) => j !== i))} title="quitar" style={{ background: "transparent", border: "none", color: "#bbb", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 14px" }}>
          <button onClick={() => { setQuery(""); setPaso("inicio"); }} style={{ ...chip(false), fontSize: 13 }}>+ agregar alimento</button>
          <span style={{ fontFamily: F, fontSize: 13, color: "#111", fontWeight: 700 }}>{kcalBandeja} kcal</span>
        </div>
        <button onClick={() => guardar(bandeja, `${comida.label} · ${titulo || `${bandeja.length} alimento${bandeja.length === 1 ? "" : "s"}`}`)}
          disabled={!bandeja.length} style={{ ...btnPrincipal, opacity: bandeja.length ? 1 : 0.4 }}>registrar en {comida.label.toLowerCase()}</button>
        <button onClick={onClose} style={btnSecundario}>{permanecer ? "cerrar" : "cancelar"}</button>
      </div>
    );
  } else {
    // inicio: buscar, recientes, repetir, mazos
    contenido = (
      <div>
        <div style={{ fontFamily: C, fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 2 }}>
          {aBandeja ? `sumar a ${titulo || "tu comida"}` : "🍽️ registrar ingesta"}
        </div>
        {dk !== fechaKey() && <div style={{ fontFamily: F, fontSize: 11, color: "#c9a227", marginBottom: 6 }}>se registrará en el día {fechaCorta(dk)}</div>}
        <div style={{ height: 8 }} />
        {selectorComida}
        <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="buscar alimento…"
          style={{ width: "100%", border: "none", borderBottom: "2px solid #111", padding: "8px 4px", fontSize: 18, fontFamily: C, outline: "none", background: "transparent", color: "#111", boxSizing: "border-box", marginBottom: 12 }} />
        {query.trim() && resultados.map(f => (
          <button key={f.id} onClick={() => elegir(f)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px dashed #eee", padding: "10px 2px", cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{f.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F, fontSize: 13, color: "#222", fontWeight: 600 }}>{f.name}</div>
              <div style={{ fontFamily: F, fontSize: 10, color: "#bbb", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prep}</div>
            </span>
          </button>
        ))}
        {query.trim() && resultados.length === 0 && <div style={{ fontFamily: F, fontSize: 12, color: "#aaa", padding: "6px 0 10px" }}>sin resultados para “{query.trim()}”</div>}
        {!query.trim() && recientes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={rotulo}>recientes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {recientes.map(f => <button key={f.id} onClick={() => elegir(f)} style={chip(false)}>{f.emoji} {f.name}</button>)}
            </div>
          </div>
        )}
        {!query.trim() && !aBandeja && previa && (
          <button onClick={() => abrirBandeja(previa.items, `${comida.label} del ${fechaCorta(previa.fecha)}`)}
            style={{ width: "100%", textAlign: "left", background: "#fafafa", border: "1px dashed #ddd", borderRadius: 10, padding: "10px 12px", marginBottom: 10, cursor: "pointer" }}>
            <div style={{ fontFamily: C, fontSize: 17, color: "#111", fontWeight: 700 }}>🔁 repetir último {comida.label.toLowerCase()}</div>
            <div style={{ fontFamily: F, fontSize: 10, color: "#aaa" }}>{fechaCorta(previa.fecha)} · {previa.items.length} alimento{previa.items.length === 1 ? "" : "s"} · lo revisas antes de registrar</div>
          </button>
        )}
        {!query.trim() && !aBandeja && (nutriDecks || []).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={rotulo}>mazos</div>
            {(nutriDecks || []).map(d => {
              const mId = d.meal || inferirComidaMazo(d.items);
              return (
                <button key={d.id} onClick={() => abrirBandeja(d.items || [], d.name, mId)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "#fafafa", border: "1px dashed #e5e5e5", borderRadius: 10, padding: "9px 12px", marginBottom: 6, cursor: "pointer" }}>
                  <div style={{ fontFamily: C, fontSize: 17, color: "#111", fontWeight: 700 }}>{d.name}</div>
                  <div style={{ fontFamily: F, fontSize: 10, color: "#aaa" }}>{(MEALS.find(m => m.id === mId) || {}).emoji} {(d.items || []).length} alimento{(d.items || []).length === 1 ? "" : "s"} · lo revisas antes de registrar</div>
                </button>
              );
            })}
          </div>
        )}
        <button onClick={() => { setEst({ descripcion: query.trim(), certainty: null, kcalMin: "", kcalMax: "", protMin: "", protMax: "" }); setPaso("estimar"); }}
          style={{ ...btnSecundario, textAlign: "left", color: "#777", textDecoration: "underline", paddingLeft: 2 }}>✍️ registrar sin datos exactos</button>
        <button onClick={() => aBandeja && bandeja.length ? setPaso("bandeja") : onClose()} style={btnSecundario}>{aBandeja && bandeja.length ? "volver a la comida" : (permanecer ? "cerrar" : "cancelar")}</button>
      </div>
    );
  }

  return (
    <VentanaArriba onClose={onClose}>
      {permanecer && <Hechos hechos={hechos} />}
      {contenido}
    </VentanaArriba>
  );
}

export default IngestaRapida;
