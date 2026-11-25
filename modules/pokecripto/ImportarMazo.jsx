// Importar un mazo de Yu-Gi-Oh! (.ydk de Dueling Book / YGOPRO / YGOPRODeck, o lista de texto «3 Nombre»): la app reconoce las cartas en el pool, el usuario
// elige UNA rareza para todo el mazo (cada carta cae en la variante más barata de esa rareza) y corrige carta por carta; al confirmar se crea una carpeta
// («Edison · Zombie») con cada carta como «solo la sigo» y las copias que pide el mazo (`copiasMazo`). El historial de precios llega solo (adjuntarHistorial).
import { fetchPoolIndice, fetchPoolLetra, fetchPoolCodigos } from "../shared/catalog.js";
import { MarcoPoke, fmtUSD } from "./PokecriptoPage.jsx";
import { aplicarMarca, filaTiene, juegoDe, pendientesDeCambio, claveVersion } from "./lib/juegos.mjs";
import { describirVariante } from "./lib/variantes-comunes.mjs";
import { parsearMazo, normNombre, elegirVersion, rarezasDe, letraDe } from "./lib/mazos.mjs";
import { precioVersion, urlImagen } from "../tcgcrypto/logica.js";
import { encolarPokecriptoPending } from "./alta.js";
import { adjuntarHistorial } from "./historialAlAgregar.js";

const { useState } = React;
const f = { fontFamily: "'DM Sans',sans-serif" }, cv = { fontFamily: "'Caveat',cursive" };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const SECCIONES = [["main", "Main"], ["extra", "Extra"], ["side", "Side"]];
const FORMATOS = ["Edison", "Goat", "Standard", "Otro"];

export default function ImportarMazo({ juego, filas, saveInventario, carpetas, crearCarpeta, onVolver, onListo }) {
  const [texto, setTexto] = useState(""), [paso, setPaso] = useState("entrada"), [cargando, setCargando] = useState(false), [error, setError] = useState(null);
  const [nombre, setNombre] = useState(""), [formato, setFormato] = useState("Edison");
  const [pool, setPool] = useState(null), [items, setItems] = useState([]), [faltan, setFaltan] = useState([]);
  const [rareza, setRareza] = useState(""), [abierta, setAbierta] = useState(null), [sinSec, setSinSec] = useState({});
  const [manual, setManual] = useState({});

  async function analizar() {
    setError(null); setCargando(true);
    try {
      const m = parsearMazo(texto);
      const total = m.main.length + m.extra.length + m.side.length;
      if (!total) throw new Error("No encontré cartas en el texto. Pega un .ydk o una lista tipo «3 Ash Blossom & Joyous Spring».");
      const idx = await fetchPoolIndice(juego);
      if (!idx || !Array.isArray(idx.n)) throw new Error("El catálogo completo todavía no está disponible (se genera los domingos). Inténtalo más tarde.");
      const porK = new Map(idx.n.map(e => [e[0], e])), porNorm = new Map(idx.n.map(e => [normNombre(e[1]), e]));
      const cod = m.main.concat(m.extra, m.side).some(x => x.id != null) ? await fetchPoolCodigos() : null;
      const por = new Map(), perdidas = [];
      for (const [sec] of SECCIONES) for (const x of m[sec]) {
        const k = x.id != null ? (cod && cod[x.id]) : (porNorm.get(normNombre(x.nombre)) || [])[0];
        const e = k && porK.get(k);
        if (!e) { perdidas.push(x.id != null ? `pasaporte ${x.id}` : x.nombre); continue; }
        const prev = por.get(e[0]); if (prev) prev.copias += x.copias; else por.set(e[0], { e, copias: x.copias, seccion: sec });
      }
      const letras = [...new Set([...por.values()].map(v => v.e[2]))];
      const shards = Object.fromEntries(await Promise.all(letras.map(async l => [l, await fetchPoolLetra(juego, l)])));
      const its = [];
      for (const v of por.values()) {
        const c = shards[v.e[2]] && shards[v.e[2]].cartas.find(x => x.k === v.e[0]);
        if (!c) { perdidas.push(v.e[1]); continue; }
        its.push({ k: c.k, carta: c, copias: v.copias, seccion: v.seccion });
      }
      setPool(idx); setItems(its); setFaltan(perdidas); setManual({}); setPaso("revision");
      const rs = rarezasDe(its.map(i => i.carta)); setRareza(rs[0] || "");
    } catch (e) { setError(e.message || "error"); } finally { setCargando(false); }
  }
  const versionDe = it => { const k = manual[it.k]; if (k) { const v = it.carta.v.find(x => claveVersion(x) === k); if (v) return { version: v, sinRareza: false, manual: true }; } return elegirVersion(it.carta.v, rareza); };
  const vivos = items.filter(i => !sinSec[i.seccion]);
  const costo = vivos.reduce((a, i) => { const v = versionDe(i); return a + (v && v.version ? (precioVersion(v.version) || 0) * i.copias : 0); }, 0);
  const tiene = k => (filas || []).filter(x => juegoDe(x) === juego && x.cardId === k && filaTiene(x)).reduce((a, x) => a + (x.cantidad || 1), 0);

  function confirmar() {
    const hoy = hoyISO(), carpeta = `${formato} · ${nombre.trim() || "Mazo"}`;
    if (!(carpetas || []).includes(carpeta) && crearCarpeta) crearCarpeta(carpeta);
    let next = filas;
    for (const it of vivos) {
      const v = versionDe(it); if (!v || !v.version) continue;
      const datos = { sets: pool.sets, setIds: pool.setIds, setFechas: pool.setFechas, imgTpl: pool.imgTpl, cartas: [it.carta] };
      next = aplicarMarca(next, { juego, datos, col: { id: "carpeta:" + carpeta, nombre: carpeta }, k: it.k, vkey: claveVersion(v.version), parche: {}, hoy, forzar: true, extra: { copiasMazo: it.copias, mazo: carpeta, seccionMazo: it.seccion } });
    }
    saveInventario(next);
    const nuevos = pendientesDeCambio(filas, next).filter(c => c._baja || !filas.some(x => x.id === c.id));
    if (nuevos.length) encolarPokecriptoPending(nuevos);
    adjuntarHistorial(next.filter(x => !filas.some(y => y.id === x.id)), saveInventario, juego, hoy);
    onListo();
  }
  const chip = (act, onClick, txt, k) => <button key={k} onClick={onClick} style={{ ...f, fontSize: 11, padding: "5px 11px", borderRadius: 14, border: "1px solid " + (act ? "#fff" : "#333"), background: act ? "#fff" : "transparent", color: act ? "#111" : "#999", cursor: "pointer" }}>{txt}</button>;
  const cab = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <button onClick={paso === "revision" ? () => setPaso("entrada") : onVolver} style={{ background: "transparent", border: "none", fontSize: 20, color: "#bbb", cursor: "pointer", padding: 0 }}>←</button>
      <div style={{ ...cv, fontSize: 22, fontWeight: 700, color: "#fff" }}>importar mazo</div>
    </div>);
  if (paso === "entrada") return (
    <MarcoPoke>{cab}
      <div style={{ ...f, fontSize: 11, color: "#888", marginBottom: 8 }}>Sube el archivo .ydk (Dueling Book, YGOPRO, YGOPRODeck) o pega la lista de texto.</div>
      <input data-t="mazo-archivo" type="file" accept=".ydk,.txt,text/plain" onChange={e => { const fl = e.target.files && e.target.files[0]; if (!fl) return; if (!nombre) setNombre(fl.name.replace(/\.[^.]+$/, "")); const r = new FileReader(); r.onload = () => setTexto(String(r.result || "")); r.readAsText(fl); }} style={{ ...f, fontSize: 12, color: "#aaa", marginBottom: 8, width: "100%" }} />
      <textarea data-t="mazo-texto" value={texto} onChange={e => setTexto(e.target.value)} placeholder={"3 Ash Blossom & Joyous Spring\n2 Pot of Desires\n…"} rows={10}
        style={{ width: "100%", boxSizing: "border-box", background: "#000", border: "1px solid #333", borderRadius: 10, padding: 10, color: "#fff", ...f, fontSize: 13, marginBottom: 10 }} />
      {error && <div style={{ ...f, fontSize: 12, color: "#e57373", marginBottom: 8 }}>{error}</div>}
      <button data-t="mazo-analizar" disabled={cargando || !texto.trim()} onClick={analizar} style={{ width: "100%", background: "#aac756", border: "none", borderRadius: 10, padding: 11, ...f, fontSize: 13, fontWeight: 700, color: "#111", cursor: "pointer", opacity: cargando || !texto.trim() ? 0.5 : 1 }}>{cargando ? "leyendo mazo…" : "leer mazo"}</button>
    </MarcoPoke>);
  const rs = rarezasDe(items.map(i => i.carta));
  return (
    <MarcoPoke>{cab}
      <input data-t="mazo-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="nombre del mazo (ej. Zombie)" style={{ width: "100%", boxSizing: "border-box", background: "#000", border: "1px solid #333", borderRadius: 10, padding: "9px 12px", color: "#fff", ...f, fontSize: 13, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{FORMATOS.map(x => chip(formato === x, () => setFormato(x), x, x))}</div>
      <div style={{ ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>rareza para todo el mazo</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{chip(rareza === "", () => { setRareza(""); setManual({}); }, "la más barata", "_")}{rs.slice(0, 8).map(r => chip(rareza === r, () => { setRareza(r); setManual({}); }, r, r))}</div>
      {faltan.length > 0 && <div data-t="mazo-faltan" style={{ ...f, fontSize: 10, color: "#c9a227", marginBottom: 8 }}>No encontré {faltan.length}: {faltan.slice(0, 6).join(", ")}{faltan.length > 6 ? "…" : ""}</div>}
      {SECCIONES.map(([sec, tit]) => { const its = items.filter(i => i.seccion === sec); if (!its.length) return null; return (
        <div key={sec} style={{ marginBottom: 8 }}>
          <div onClick={() => setSinSec(s => ({ ...s, [sec]: !s[sec] }))} style={{ display: "flex", alignItems: "center", gap: 8, ...f, fontSize: 11, color: sinSec[sec] ? "#555" : "#ccc", padding: "6px 0", cursor: "pointer" }}>
            <span>{sinSec[sec] ? "☐" : "☑"}</span><span>{tit} · {its.reduce((a, i) => a + i.copias, 0)} cartas</span>
          </div>
          {!sinSec[sec] && its.map(it => { const v = versionDe(it); const ver = v && v.version; const d = ver ? describirVariante({ juego, sub: ver[1], rareza: ver[4], grupo: pool.sets[ver[2]] || "" }) : null; const tn = tiene(it.k); return (
            <div key={it.k} data-t="mazo-carta" style={{ borderBottom: "1px solid #1a1a1a" }}>
              <div onClick={() => setAbierta(abierta === it.k ? null : it.k)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                {ver && <img src={urlImagen(pool.imgTpl, ver[0], 200)} alt="" referrerPolicy="no-referrer" style={{ width: 30, aspectRatio: "59/86", objectFit: "cover", borderRadius: 3, background: "#111" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...f, fontSize: 12, color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.copias}× {it.carta.n}{tn ? <span style={{ color: "#5cbf7a" }}> · tienes {tn}</span> : null}</div>
                  <div style={{ ...f, fontSize: 9, color: v && v.sinRareza ? "#c9a227" : "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d ? `${d.etiqueta} · ${pool.sets[ver[2]] || ""} ${ver[3] || ""}` : "sin versión"}{v && v.sinRareza ? " · sin esa rareza" : ""}</div>
                </div>
                <div style={{ ...cv, fontSize: 15, fontWeight: 700, color: "#5c9cff" }}>{ver && precioVersion(ver) != null ? fmtUSD(precioVersion(ver) * it.copias) : "—"}</div>
              </div>
              {abierta === it.k && <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingBottom: 8, maxHeight: 200, overflowY: "auto" }}>
                {[...it.carta.v].sort((a, b) => (precioVersion(b) ?? -1) - (precioVersion(a) ?? -1)).map(x => { const dd = describirVariante({ juego, sub: x[1], rareza: x[4], grupo: pool.sets[x[2]] || "" }); const act = ver && claveVersion(x) === claveVersion(ver); return (
                  <div key={claveVersion(x)} data-t="mazo-version" onClick={() => { setManual(m => ({ ...m, [it.k]: claveVersion(x) })); setAbierta(null); }} style={{ display: "flex", gap: 8, padding: "4px 8px", borderRadius: 8, background: act ? "#1d2a3a" : "#131313", border: "1px solid " + (act ? "#5c9cff" : "#1c1c1c"), cursor: "pointer", ...f, fontSize: 10, color: "#ccc" }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dd.etiqueta} · {pool.sets[x[2]]} {x[3]}</span><span>{precioVersion(x) != null ? fmtUSD(precioVersion(x)) : "—"}</span>
                  </div>); })}
              </div>}
            </div>); })}
        </div>); })}
      <div style={{ ...f, fontSize: 12, color: "#aaa", margin: "10px 0" }}>{vivos.reduce((a, i) => a + i.copias, 0)} cartas · costo para completar ≈ <span style={{ color: "#5c9cff", fontWeight: 700 }}>{fmtUSD(costo)}</span></div>
      <button data-t="mazo-confirmar" onClick={confirmar} style={{ width: "100%", background: "#aac756", border: "none", borderRadius: 10, padding: 11, ...f, fontSize: 13, fontWeight: 700, color: "#111", cursor: "pointer" }}>crear carpeta «{formato} · {nombre.trim() || "Mazo"}»</button>
      <div style={{ height: 40 }} />
    </MarcoPoke>);
}
