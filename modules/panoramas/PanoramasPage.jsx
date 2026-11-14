import { PANORAMAS_JSON_URL, fetchJsonSafe } from "../shared/constants.js";

const { useState, useEffect, useMemo } = React;

// ─── Módulo Panoramas (nov-2026, issue #17) ──────────────────────────────────
// Eventos culturales de Santiago para enterarse CON ANTICIPACIÓN. Los datos los arma
// build-panoramas.mjs (panoramas.json): aquí solo se leen y se filtran en memoria.
// Lo que importa para llegar a tiempo: los eventos se agrupan por cuánto falta, lo que
// pide inscripción o tiene cupos se distingue, y lo recién detectado sale como "nuevo".
// Sin estado persistente (v1): no agrega claves de localStorage.

const ACENTO = "#e0a030";
const FUENTE = "'DM Sans',sans-serif";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const pad = n => String(n).padStart(2, "0");
const claveDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = k => new Date(k + "T12:00:00");
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
const corta = k => { const d = aFecha(k); return `${d.getDate()} ${MESES[d.getMonth()]}`; };

function cuando(dias) { return dias <= 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`; }

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
  for (const g of grupos) g.items.sort((a, b) => a._dias - b._dias || a.titulo.localeCompare(b.titulo, "es"));
  return grupos.filter(g => g.items.length);
}

function Chip({ children, color, fuerte, onClick, activo }) {
  const base = { fontFamily: FUENTE, fontSize: 11, lineHeight: 1, padding: "5px 8px", borderRadius: 10, whiteSpace: "nowrap", border: `1px solid ${color || "#444"}`, color: fuerte ? "#111" : (color || "#bbb"), background: fuerte ? color : "transparent", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" };
  if (onClick) return <button onClick={onClick} style={{ ...base, flex: "none", maxWidth: "none", overflow: "visible", minHeight: 34, padding: "0 12px", fontSize: 12, cursor: "pointer", background: activo ? ACENTO : "transparent", color: activo ? "#111" : "#ccc", borderColor: activo ? ACENTO : "#444" }}>{children}</button>;
  return <span style={base}>{children}</span>;
}

function Tarjeta({ e, hoy, nuevo }) {
  const d = aFecha(e.inicio);
  const empezado = e.inicio < hoy;
  const pideInscripcion = e.inscripcion === true;
  const conCupos = !pideInscripcion && (e.ventaOnline || (e.cupos && e.cupos > 0));
  return (
    <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, padding: "10px 12px", background: "#161616", border: `1px solid ${pideInscripcion ? ACENTO : "#262626"}`, borderRadius: 8, textDecoration: "none", color: "#eee", marginBottom: 8 }}>
      <div style={{ flex: "none", width: 44, textAlign: "center", fontFamily: FUENTE }}>
        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>{empezado ? "hasta" : DIAS[d.getDay()]}</div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{empezado ? aFecha(e.fin).getDate() : d.getDate()}</div>
        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>{MESES[(empezado ? aFecha(e.fin) : d).getMonth()]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FUENTE, fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{e.titulo}</div>
        <div style={{ fontFamily: FUENTE, fontSize: 12, color: "#999", marginTop: 3 }}>
          {[e.hora, e.lugar, e.comuna].filter(Boolean).join(" · ")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {pideInscripcion && <Chip color={ACENTO} fuerte>🎟 Requiere inscripción</Chip>}
          {conCupos && <Chip color={ACENTO}>🎟 {e.ventaOnline ? "Entrada online" : `Cupos ${e.cupos}`}</Chip>}
          {e.gratis === true && <Chip color="#4caf50">Gratis</Chip>}
          {e.gratis === false && <Chip color="#ccc">{e.precio ? `$${e.precio.toLocaleString("es-CL")}` : "Con costo"}</Chip>}
          {nuevo && <Chip color="#5c9cff">✨ Nuevo</Chip>}
          {e.categoria && <Chip>{e.categoria.length > 26 ? e.categoria.slice(0, 25) + "…" : e.categoria}</Chip>}
          {e.fin !== e.inicio && !e.enCurso && <Chip>hasta {corta(e.fin)}</Chip>}
          {e.rancio && <Chip color="#ff9800">dato sin actualizar</Chip>}
        </div>
        {pideInscripcion && e.inscripcionUrl && <div style={{ marginTop: 6, fontFamily: FUENTE, fontSize: 12, color: ACENTO }}>Inscripción: {e.inscripcionUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}</div>}
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
  const [verCartelera, setVerCartelera] = useState(false);

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
    const puntuales = filtrados.filter(e => !e.enCurso);
    const enCartelera = filtrados.filter(e => e.enCurso).sort((a, b) => a.fin.localeCompare(b.fin));
    const nNuevos = todos.filter(esNuevo).length;
    const rancias = Object.entries(datos.fuentes || {}).filter(([, f]) => f.rancio).map(([k]) => k);
    return { grupos: agrupar(puntuales, hoy), enCartelera, comunas, esNuevo, nNuevos, total: filtrados.length, rancias };
  }, [datos, hoy, soloGratis, soloCupos, soloNuevos, comuna]);

  const actualizado = datos && datos.generatedAt ? (() => { const h = Math.floor((Date.now() - new Date(datos.generatedAt).getTime()) / 3600000); return h < 1 ? "hace menos de 1 h" : h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`; })() : "";

  return (
    <div className="panoramas" style={{ color: "#eee", background: "#0d0d0d" }}>
      <div style={{ flex: "none", padding: "10px 12px 6px", fontFamily: FUENTE }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: ACENTO }}>Panoramas · Santiago</div>
          {actualizado && <div style={{ fontSize: 10, color: "#777" }}>actualizado {actualizado}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 0 2px", WebkitOverflowScrolling: "touch" }}>
          <Chip onClick={() => setSoloGratis(v => !v)} activo={soloGratis}>Gratis</Chip>
          <Chip onClick={() => setSoloCupos(v => !v)} activo={soloCupos}>🎟 Cupos / inscripción</Chip>
          <Chip onClick={() => setSoloNuevos(v => !v)} activo={soloNuevos}>✨ Nuevos{vm && vm.nNuevos ? ` (${vm.nNuevos})` : ""}</Chip>
          {vm && vm.comunas.length > 1 && (
            <select value={comuna} onChange={e => setComuna(e.target.value)} style={{ flex: "none", minHeight: 34, background: comuna ? ACENTO : "transparent", color: comuna ? "#111" : "#ccc", border: `1px solid ${comuna ? ACENTO : "#444"}`, borderRadius: 10, fontFamily: FUENTE, fontSize: 12, padding: "0 8px" }}>
              <option value="">Todas las comunas</option>
              {vm.comunas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        {vm && vm.rancias.length > 0 && <div style={{ fontSize: 11, color: "#ff9800", marginTop: 6 }}>⚠ {vm.rancias.join(", ")}: la última actualización falló; se muestra lo anterior.</div>}
      </div>

      <div className="panoramas-body" style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto", padding: "4px 12px 16px" }}>
        {error && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#c66", padding: 12 }}>No se pudo leer panoramas.json. Si es la primera vez, falta correr el workflow “Actualizar panoramas”.</div>}
        {!datos && !error && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#777", padding: 12 }}>Cargando…</div>}
        {vm && vm.total === 0 && <div style={{ fontFamily: FUENTE, fontSize: 13, color: "#777", padding: 12 }}>Nada con esos filtros.</div>}
        {vm && vm.grupos.map(g => (
          <div key={g.id}>
            <div style={{ fontFamily: FUENTE, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#888", margin: "12px 0 6px" }}>{g.titulo} · {g.items.length}</div>
            {g.items.map(e => <Tarjeta key={e.id} e={e} hoy={hoy} nuevo={vm.esNuevo(e)} />)}
          </div>
        ))}
        {vm && vm.enCartelera.length > 0 && (
          <div>
            <button onClick={() => setVerCartelera(v => !v)} style={{ width: "100%", minHeight: 40, margin: "14px 0 6px", background: "transparent", border: "1px dashed #444", color: "#aaa", borderRadius: 8, fontFamily: FUENTE, fontSize: 12, cursor: "pointer" }}>
              {verCartelera ? "▾" : "▸"} Exposiciones y programas en curso ({vm.enCartelera.length})
            </button>
            {verCartelera && vm.enCartelera.map(e => <Tarjeta key={e.id} e={e} hoy={hoy} nuevo={false} />)}
          </div>
        )}
      </div>
    </div>
  );
}
