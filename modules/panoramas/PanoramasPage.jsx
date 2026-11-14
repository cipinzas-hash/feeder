import { PANORAMAS_JSON_URL, fetchJsonSafe } from "../shared/constants.js";
import { useDesborde } from "../shared/ui.jsx";
import { FilaSeccion, F_HAND, F_SANS, T_CLARO as T, chip } from "../fadiman/fadimanUi.jsx";

const { useState, useEffect, useMemo, useRef } = React;

// ─── Módulo Panoramas (issue #17) ────────────────────────────────────────────
// Eventos culturales de Santiago para enterarse CON ANTICIPACIÓN. Los datos los arma
// build-panoramas.mjs (panoramas.json); aquí solo se leen y se filtran en memoria.
//
// Lineamiento (docs/angst-lineamiento-y-handoff.md, §4): sobre el marco `.app-fit` (N1),
// patrón base N2 = franja de estado arriba + filas-encabezado que se expanden inline y de a
// una (FilaSeccion, la misma de Salud/Fadiman), sin título propio (R6), Caveat + DM Sans (R7).
// N3: colapsado NO hay scroll vertical; el scroll nace solo dentro de la fila abierta.
// Sin estado persistente en esta versión: no agrega claves de localStorage (R8).

const ACENTO = "#e0a030";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ICONO = { hoy: "📅", manana: "🌅", semana: "🗓️", quincena: "⏳", luego: "🔭", curso: "🖼️" };

const pad = n => String(n).padStart(2, "0");
const claveDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = k => new Date(k + "T12:00:00");
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
const corta = k => { const d = aFecha(k); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const cuando = dias => dias <= 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;

// Función pura: agrupa por cuánto falta. Un evento ya empezado (rango corto) cuenta desde hoy.
export function agrupar(eventos, hoy) {
  const grupos = [
    { id: "hoy", titulo: "Hoy", items: [] },
    { id: "manana", titulo: "Mañana", items: [] },
    { id: "semana", titulo: "Esta semana", items: [] },
    { id: "quincena", titulo: "Próximas dos semanas", items: [] },
    { id: "luego", titulo: "Más adelante", items: [] },
  ];
  for (const e of eventos) {
    const d = Math.max(0, diasEntre(hoy, e.inicio));
    const g = d === 0 ? 0 : d === 1 ? 1 : d <= 7 ? 2 : d <= 21 ? 3 : 4;
    grupos[g].items.push({ ...e, _dias: d });
  }
  const hora = e => (e.hora || "99:99").slice(0, 5);
  for (const g of grupos) g.items.sort((a, b) => a._dias - b._dias || hora(a).localeCompare(hora(b)) || a.titulo.localeCompare(b.titulo, "es"));
  return grupos.filter(g => g.items.length);
}

// El próximo: el primero que aún no pasó (hoy cuenta solo si su hora de inicio no pasó).
export function elProximo(grupos, ahora) {
  const hhmm = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
  const todos = grupos.flatMap(g => g.items);
  return todos.find(e => e._dias > 0 || !e.hora || e.hora.slice(0, 5) >= hhmm) || todos[0] || null;
}

function Etiqueta({ children, color, fuerte }) {
  return <span style={{ fontFamily: F_SANS, fontSize: 11, lineHeight: 1, padding: "4px 8px", borderRadius: 10, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", border: `1px solid ${color || "#ccc"}`, color: fuerte ? "#111" : (color || T.dim), background: fuerte ? color : "transparent" }}>{children}</span>;
}

function Etiquetas({ e, nuevo }) {
  const pide = e.inscripcion === true;
  const cupos = !pide && (e.ventaOnline || (e.cupos && e.cupos > 0));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
      {pide && <Etiqueta color={ACENTO} fuerte>🎟 Requiere inscripción</Etiqueta>}
      {cupos && <Etiqueta color={ACENTO}>🎟 {e.ventaOnline ? "Entrada online" : `Cupos ${e.cupos}`}</Etiqueta>}
      {e.gratis === true && <Etiqueta color="#2e7d32">Gratis</Etiqueta>}
      {e.gratis === false && <Etiqueta>{e.precio ? `$${e.precio.toLocaleString("es-CL")}` : "Con costo"}</Etiqueta>}
      {nuevo && <Etiqueta color="#1565c0">✨ Nuevo</Etiqueta>}
      {e.categoria && <Etiqueta>{e.categoria.length > 26 ? e.categoria.slice(0, 25) + "…" : e.categoria}</Etiqueta>}
      {e.fin !== e.inicio && !e.enCurso && <Etiqueta>hasta {corta(e.fin)}</Etiqueta>}
      {e.rancio && <Etiqueta color="#c77700">dato sin actualizar</Etiqueta>}
    </div>
  );
}

function Tarjeta({ e, hoy, nuevo }) {
  const d = aFecha(e.inicio);
  const empezado = e.inicio < hoy;
  const pide = e.inscripcion === true;
  const ref = empezado ? aFecha(e.fin) : d;
  return (
    <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, padding: "10px 12px", background: T.panel, border: `1px ${pide ? "solid" : "dashed"} ${pide ? ACENTO : T.line}`, borderRadius: 10, textDecoration: "none", color: T.txt, marginBottom: 6, flex: "none" }}>
      <div style={{ flex: "none", width: 42, textAlign: "center", fontFamily: F_SANS }}>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase" }}>{empezado ? "hasta" : DIAS[d.getDay()]}</div>
        <div style={{ fontFamily: F_HAND, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{ref.getDate()}</div>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase" }}>{MESES[ref.getMonth()]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F_SANS, fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{e.titulo}</div>
        <div style={{ fontFamily: F_SANS, fontSize: 12, color: T.dim, marginTop: 3 }}>{[e.hora, e.lugar, e.comuna].filter(Boolean).join(" · ")}</div>
        <Etiquetas e={e} nuevo={nuevo} />
        {pide && e.inscripcionUrl && <div style={{ marginTop: 6, fontFamily: F_SANS, fontSize: 12, color: "#8a5a00", wordBreak: "break-all" }}>Inscripción: {e.inscripcionUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}</div>}
      </div>
    </a>
  );
}

export default function PanoramasPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [soloGratis, setSoloGratis] = useState(false);
  const [soloCupos, setSoloCupos] = useState(false);
  const [soloNuevos, setSoloNuevos] = useState(false);
  const [comuna, setComuna] = useState("");
  const [abierta, setAbierta] = useState(null);
  const raiz = useRef(null);

  useEffect(() => {
    let vivo = true;
    fetchJsonSafe(PANORAMAS_JSON_URL).then(d => { if (!vivo) return; if (d && Array.isArray(d.eventos)) setDatos(d); else setError(true); }).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, []);

  const hoy = claveDe(new Date());
  const vm = useMemo(() => {
    if (!datos) return null;
    const todos = datos.eventos.filter(e => e.fin >= hoy);
    const primerLote = todos.reduce((m, e) => (e.visto && e.visto < m ? e.visto : m), "9999-12-31");
    const esNuevo = e => !!e.visto && e.visto > primerLote && diasEntre(e.visto, hoy) <= 3;
    const comunas = [...new Set(todos.map(e => e.comuna).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    const pasa = e => (!soloGratis || e.gratis === true) && (!soloCupos || e.inscripcion === true || e.ventaOnline || e.cupos > 0) && (!soloNuevos || esNuevo(e)) && (!comuna || e.comuna === comuna);
    const filtrados = todos.filter(pasa);
    const grupos = agrupar(filtrados.filter(e => !e.enCurso), hoy);
    const enCurso = filtrados.filter(e => e.enCurso).sort((a, b) => a.fin.localeCompare(b.fin));
    const filas = enCurso.length ? [...grupos, { id: "curso", titulo: "En curso", items: enCurso }] : grupos;
    const rancias = Object.entries(datos.fuentes || {}).filter(([, f]) => f.rancio).map(([k]) => k);
    return { filas, proximo: elProximo(grupos, new Date()), comunas, esNuevo, nNuevos: todos.filter(esNuevo).length, total: filtrados.length, rancias };
  }, [datos, hoy, soloGratis, soloCupos, soloNuevos, comuna]);

  const abiertaEf = vm && vm.filas.some(f => f.id === abierta) ? abierta : null;
  // Válvula (4.5): si colapsado no cabe, avisa en consola y deja scroll en vez de cortar.
  const desborda = useDesborde(raiz, "panoramas", abiertaEf === null);

  const actualizado = datos && datos.generatedAt ? (() => { const h = Math.floor((Date.now() - new Date(datos.generatedAt).getTime()) / 3600000); return h < 1 ? "hace menos de 1 h" : h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`; })() : "";
  const p = vm && vm.proximo;
  const mensaje = error ? "No se pudo leer panoramas.json. Falta correr el workflow “Actualizar panoramas”." : !datos ? "Cargando…" : vm.total === 0 ? "Nada con esos filtros." : null;

  return (
    <div ref={raiz} className="panoramas" style={{ padding: "6px 12px 4px", boxSizing: "border-box", overflowX: "hidden", overflowY: desborda ? "auto" : "hidden" }}>
      {/* Franja de estado (N2): en colapsado ocupa el espacio sobrante como ficha del próximo panorama; con una fila abierta pasa a una línea. */}
      <div style={abiertaEf ? { flex: "none", padding: "2px 2px 4px" } : { flex: "1 1 auto", minHeight: 100, maxHeight: 230, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 2px", overflow: "hidden" }}>
        {mensaje ? <div style={{ fontFamily: F_HAND, fontSize: 20, color: error ? "#c62828" : T.dim }}>{mensaje}</div>
          : abiertaEf ? <div style={{ fontFamily: F_SANS, fontSize: 12, color: T.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p ? <><b style={{ color: T.txt }}>Próximo:</b> {p.titulo} · {cuando(p._dias)}</> : "Sin panoramas próximos"}</div>
          : p ? (
            <>
              <div style={{ fontFamily: F_SANS, fontSize: 10, letterSpacing: 1.2, color: T.faint, textTransform: "uppercase" }}>Próximo panorama</div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: T.txt }}>
                <div style={{ fontFamily: F_HAND, fontSize: 26, fontWeight: 700, lineHeight: 1.05, margin: "2px 0 3px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.titulo}</div>
              </a>
              <div style={{ fontFamily: F_SANS, fontSize: 12, color: T.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cuando(p._dias)} · {corta(p._dias === 0 ? hoy : p.inicio)}{p.hora ? ` · ${p.hora}` : ""} · {[p.lugar, p.comuna].filter(Boolean)[0]}</div>
              <Etiquetas e={p} nuevo={vm.esNuevo(p)} />
            </>
          ) : <div style={{ fontFamily: F_HAND, fontSize: 20, color: T.dim }}>Sin panoramas próximos</div>}
      </div>

      <div style={{ flex: "none", display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 6px", WebkitOverflowScrolling: "touch" }}>
        <button onClick={() => setSoloGratis(v => !v)} style={{ ...chip(T, soloGratis), minHeight: 34 }}>Gratis</button>
        <button onClick={() => setSoloCupos(v => !v)} style={{ ...chip(T, soloCupos), minHeight: 34 }}>🎟 Cupos / inscripción</button>
        <button onClick={() => setSoloNuevos(v => !v)} style={{ ...chip(T, soloNuevos), minHeight: 34 }}>✨ Nuevos{vm && vm.nNuevos ? ` (${vm.nNuevos})` : ""}</button>
        {vm && vm.comunas.length > 1 && (
          <select value={comuna} onChange={e => setComuna(e.target.value)} style={{ ...chip(T, !!comuna), minHeight: 34 }}>
            <option value="">Todas las comunas</option>
            {vm.comunas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {!abiertaEf && vm && <div style={{ flex: "none", fontFamily: F_SANS, fontSize: 10, color: vm.rancias.length ? "#c77700" : T.faint, padding: "0 2px 6px" }}>
        {vm.rancias.length ? `⚠ ${vm.rancias.join(", ")}: la última actualización falló; se muestra lo anterior · ` : ""}{vm.total} panoramas{actualizado ? ` · actualizado ${actualizado}` : ""}
      </div>}

      {vm && vm.filas.map(f => {
        const open = f.id === abiertaEf;
        return (
          <div key={f.id} style={{ flex: open ? "1 1 0" : "none", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <FilaSeccion icon={ICONO[f.id]} label={f.titulo} summary={`${f.items.length} · ${f.items[0].titulo}`} open={open} onToggle={() => setAbierta(open ? null : f.id)} />
            {open && (
              <div style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 6 }}>
                {f.items.map(e => <Tarjeta key={e.id} e={e} hoy={hoy} nuevo={vm.esNuevo(e)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
