import { idRegistro, ESTADOS_REGISTRO } from "./lib/claves.mjs";

// ─── Registro de juegos de Game enhanced (nov-2026, issue #43) ──────────────────────────────────
// Angst es la FUENTE de lo que Cristopher terminó, quiere jugar o tiene pendiente (no hay conexión con
// Stash). UNA clave, "angst-game-enhanced-registro-v1", declarada en LOCAL_KEY_FIELDS
// (core/persistence.js) → viaja en el export 💾 / 📤 a Angst-data y se rehidrata en restoreFromPayload
// (rehidratarRegistro). El pipeline (build-game-enhanced.mjs) lee de ahí los terminados para cruzarlos
// con decomps y estudios, y les busca portada y resumen en IGDB. Clave nueva: no migra ni toca
// "angst-game-enhanced-estado-v1" (guardados / ocultos).
//
// Forma: { v: 1, sembrado: marcaDeTiempo | null, juegos: { [id]: Juego } }
//   Juego = { id, titulo, busqueda, estado: "terminado" | "quiero" | "pendiente",
//             plataforma?, fecha? ("YYYY-MM-DD", cuándo lo terminó), nota?, agregado, actualizado }
// `sembrado` marca que la semilla única (los terminados que ya estaban en el repo) ya se cargó, para no
// volver a cargarla si Cristopher quita juegos.
const KEY = "angst-game-enhanced-registro-v1";

const VACIO = () => ({ v: 1, sembrado: null, juegos: {} });
const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fechaOk = v => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function juegoValido(e) {
  if (!e || typeof e !== "object" || typeof e.titulo !== "string" || !e.titulo.trim() || !ESTADOS_REGISTRO.includes(e.estado)) return null;
  const id = idRegistro(e.titulo);
  if (!id) return null;
  const j = {
    id, titulo: e.titulo.trim().slice(0, 120), busqueda: texto(e.busqueda, 120) || e.titulo.trim().slice(0, 120), estado: e.estado,
    agregado: Number.isFinite(e.agregado) ? e.agregado : 0, actualizado: Number.isFinite(e.actualizado) ? e.actualizado : (Number.isFinite(e.agregado) ? e.agregado : 0),
  };
  const p = texto(e.plataforma, 60), n = texto(e.nota, 600), f = fechaOk(e.fecha);
  if (p) j.plataforma = p;
  if (n) j.nota = n;
  if (f) j.fecha = f;
  return j;
}

function leer() {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const juegos = {};
      for (const e of Object.values(v.juegos && typeof v.juegos === "object" ? v.juegos : {})) { const j = juegoValido(e); if (j) juegos[j.id] = j; }
      return { v: 1, sembrado: Number.isFinite(v.sembrado) ? v.sembrado : null, juegos };
    }
  } catch (e) { /* clave ausente o corrupta: registro vacío */ }
  return VACIO();
}

let cache = leer();
const oyentes = new Set();

function guardar(next) {
  cache = next;
  try { globalThis.localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* sin cuota: queda en memoria */ }
  oyentes.forEach(fn => fn(next));
}

// Tras restaurar un export: la clave cambió por debajo de la caché de módulo.
export function rehidratarRegistro() {
  cache = leer();
  oyentes.forEach(fn => fn(cache));
}

export function leerRegistro() { return cache; }

// Agrega un juego (o, si ya estaba por título, actualiza su estado). Devuelve { id, previo }: `previo` es
// lo que había antes (null si era nuevo), para poder deshacer sin perder datos.
export function agregarJuego({ titulo, estado, plataforma, fecha, nota }) {
  const t = texto(titulo, 120);
  const id = idRegistro(t);
  if (!id || !ESTADOS_REGISTRO.includes(estado)) return null;
  const previo = cache.juegos[id] || null;
  const ahora = Date.now();
  const j = juegoValido({ ...(previo || {}), id, titulo: previo ? previo.titulo : t, busqueda: previo ? previo.busqueda : t, estado, plataforma: plataforma ?? (previo && previo.plataforma), fecha: fecha ?? (previo && previo.fecha), nota: nota ?? (previo && previo.nota), agregado: previo ? previo.agregado : ahora, actualizado: ahora });
  guardar({ ...cache, juegos: { ...cache.juegos, [id]: j } });
  return { id, previo };
}

// Cambia estado / plataforma / fecha / nota. Un texto vacío borra el campo.
export function editarJuego(id, cambios) {
  const j = cache.juegos[id];
  if (!j) return;
  const n = juegoValido({ ...j, ...cambios, actualizado: Date.now() });
  if (!n) return;
  for (const k of ["plataforma", "fecha", "nota"]) if (k in cambios && !cambios[k]) delete n[k];
  guardar({ ...cache, juegos: { ...cache.juegos, [id]: n } });
}

export function quitarJuego(id) {
  const j = cache.juegos[id];
  if (!j) return null;
  const juegos = { ...cache.juegos };
  delete juegos[id];
  guardar({ ...cache, juegos });
  return j;
}

export function restaurarJuego(j) {
  const v = juegoValido(j);
  if (v) guardar({ ...cache, juegos: { ...cache.juegos, [v.id]: v } });
}

// Carga única de los terminados que ya estaban en el repo (terminados.json). Solo si aún no se sembró.
export function sembrar(lista) {
  if (cache.sembrado != null || !Array.isArray(lista) || !lista.length) return;
  const ahora = Date.now();
  const juegos = { ...cache.juegos };
  for (const t of lista) {
    const j = juegoValido({ titulo: t.titulo, busqueda: t.busqueda, estado: "terminado", agregado: ahora, actualizado: ahora });
    if (j && !juegos[j.id]) juegos[j.id] = j;
  }
  guardar({ v: 1, sembrado: ahora, juegos });
}

export function useRegistro() {
  const [r, setR] = React.useState(cache);
  React.useEffect(() => {
    oyentes.add(setR);
    setR(cache);   // por si cambió entre el render y el efecto
    return () => oyentes.delete(setR);
  }, []);
  return r;
}
