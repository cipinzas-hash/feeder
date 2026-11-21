import { idRegistro, ESTADOS_REGISTRO, normalizarEstado } from "./lib/claves.mjs";

// ─── Registro de juegos de Game enhanced (nov-2026, issue #43) ──────────────────────────────────
// Angst es la FUENTE de lo que Cristopher terminó, quiere jugar o tiene pendiente (no hay conexión con
// Stash). UNA clave, "angst-game-enhanced-registro-v1", declarada en LOCAL_KEY_FIELDS
// (core/persistence.js) → viaja en el export 💾 / 📤 a Angst-data y se rehidrata en restoreFromPayload
// (rehidratarRegistro). El pipeline (build-game-enhanced.mjs) lee de ahí los terminados para cruzarlos
// con decomps y estudios, y les busca portada y resumen en IGDB. Clave nueva: no migra ni toca
// "angst-game-enhanced-estado-v1" (guardados / ocultos).
//
// Forma: { v: 1, sembrado: marcaDeTiempo | null, juegos: { [id]: Juego }, borrados: { [id]: marcaDeTiempo } }
// `borrados` son «tumbas» (cuándo se quitó cada juego): sirven para fusionar con el archivo de Angst-data sin que lo quitado reaparezca
// (ver lib/fusion.mjs y sync.js).
//   Juego = { id, titulo, busqueda, estado: "terminado" | "jugando" | "inconcluso" | "quiero",
//             plataforma?, fecha? ("YYYY-MM-DD", cuándo lo terminó), empezado? ("YYYY-MM-DD", jugando/inconcluso), nota?,
//             igdbId?, portada? (image_id de IGDB), lanzamiento?, agregado, actualizado }
// El antiguo estado "pendiente" se lee como "inconcluso" (juegoValido lo migra al cargar).
// `sembrado` marca que la semilla única (los terminados que ya estaban en el repo) ya se cargó, para no
// volver a cargarla si Cristopher quita juegos.
const KEY = "angst-game-enhanced-registro-v1";

const VACIO = () => ({ v: 1, sembrado: null, juegos: {}, borrados: {} });
const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fechaOk = v => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

const imagenOk = v => (typeof v === "string" && /^[a-z0-9]{1,40}$/i.test(v) ? v : null);

function juegoValido(e0) {
  const e = e0 && typeof e0 === "object" ? { ...e0, estado: normalizarEstado(e0.estado) } : e0;
  if (!e || typeof e !== "object" || typeof e.titulo !== "string" || !e.titulo.trim() || !ESTADOS_REGISTRO.includes(e.estado)) return null;
  const id = idRegistro(e.titulo);
  if (!id) return null;
  const j = {
    id, titulo: e.titulo.trim().slice(0, 120), busqueda: texto(e.busqueda, 120) || e.titulo.trim().slice(0, 120), estado: e.estado,
    agregado: Number.isFinite(e.agregado) ? e.agregado : 0, actualizado: Number.isFinite(e.actualizado) ? e.actualizado : (Number.isFinite(e.agregado) ? e.agregado : 0),
  };
  const p = texto(e.plataforma, 60), n = texto(e.nota, 600), f = fechaOk(e.fecha), em = fechaOk(e.empezado);
  if (p) j.plataforma = p;
  if (n) j.nota = n;
  if (f) j.fecha = f;
  if (em) j.empezado = em;
  if (Number.isInteger(e.igdbId) && e.igdbId > 0) j.igdbId = e.igdbId;
  const pt = imagenOk(e.portada), lz = fechaOk(e.lanzamiento);
  if (pt) j.portada = pt;
  if (lz) j.lanzamiento = lz;
  return j;
}

function leer() {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const juegos = {};
      for (const e of Object.values(v.juegos && typeof v.juegos === "object" ? v.juegos : {})) { const j = juegoValido(e); if (j) juegos[j.id] = j; }
      const borrados = {};
      for (const [id, ts] of Object.entries(v.borrados && typeof v.borrados === "object" && !Array.isArray(v.borrados) ? v.borrados : {})) if (Number.isFinite(ts) && ts > 0) borrados[id] = ts;
      return { v: 1, sembrado: Number.isFinite(v.sembrado) ? v.sembrado : null, juegos, borrados };
    }
  } catch (e) { /* clave ausente o corrupta: registro vacío */ }
  return VACIO();
}

let cache = leer();
const oyentes = new Set();
const oyentesLocales = new Set();   // solo cambios hechos por Cristopher (no la fusión con Angst-data): disparan la sincronización

function guardar(next, externo = false) {
  cache = next;
  try { globalThis.localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* sin cuota: queda en memoria */ }
  oyentes.forEach(fn => fn(next));
  if (!externo) oyentesLocales.forEach(fn => fn(next));
}

// Sin tumba para un id (la entrada es más nueva que cualquier borrado).
const sinTumba = (borrados, id) => { if (!(id in borrados)) return borrados; const b = { ...borrados }; delete b[id]; return b; };

// Para sync.js: avisa de cada cambio local y recibe el resultado de fusionar con Angst-data (sin volver a disparar la sincronización).
export function alCambiarLocal(fn) { oyentesLocales.add(fn); return () => oyentesLocales.delete(fn); }
export function aplicarFusion(f) {
  const juegos = {};
  for (const e of Object.values((f && f.juegos) || {})) { const j = juegoValido(e); if (j) juegos[j.id] = j; }
  guardar({ v: 1, sembrado: Number.isFinite(f && f.sembrado) ? f.sembrado : cache.sembrado, juegos, borrados: (f && f.borrados) || {} }, true);
}

// Tras restaurar un export: la clave cambió por debajo de la caché de módulo.
export function rehidratarRegistro() {
  cache = leer();
  oyentes.forEach(fn => fn(cache));
}

export function leerRegistro() { return cache; }

// Agrega un juego (o, si ya estaba por título, actualiza su estado). Devuelve { id, previo }: `previo` es
// lo que había antes (null si era nuevo), para poder deshacer sin perder datos.
export function agregarJuego({ titulo, estado: estado0, plataforma, fecha, empezado, nota, igdbId, portada, lanzamiento }) {
  const t = texto(titulo, 120);
  const id = idRegistro(t);
  const estado = normalizarEstado(estado0);
  if (!id || !ESTADOS_REGISTRO.includes(estado)) return null;
  const previo = cache.juegos[id] || null;
  const ahora = Date.now();
  const j = juegoValido({ ...(previo || {}), id, titulo: previo ? previo.titulo : t, busqueda: previo ? previo.busqueda : t, estado, plataforma: plataforma ?? (previo && previo.plataforma), fecha: fecha ?? (previo && previo.fecha), empezado: empezado ?? (previo && previo.empezado), nota: nota ?? (previo && previo.nota), igdbId: igdbId ?? (previo && previo.igdbId), portada: portada ?? (previo && previo.portada), lanzamiento: lanzamiento ?? (previo && previo.lanzamiento), agregado: previo ? previo.agregado : ahora, actualizado: ahora });
  guardar({ ...cache, juegos: { ...cache.juegos, [id]: j }, borrados: sinTumba(cache.borrados, id) });
  return { id, previo };
}

// Cambia estado / plataforma / fecha / nota. Un texto vacío borra el campo.
export function editarJuego(id, cambios) {
  const j = cache.juegos[id];
  if (!j) return;
  const n = juegoValido({ ...j, ...cambios, actualizado: Date.now() });
  if (!n) return;
  for (const k of ["plataforma", "fecha", "empezado", "nota"]) if (k in cambios && !cambios[k]) delete n[k];
  guardar({ ...cache, juegos: { ...cache.juegos, [id]: n } });
}

export function quitarJuego(id) {
  const j = cache.juegos[id];
  if (!j) return null;
  const juegos = { ...cache.juegos };
  delete juegos[id];
  guardar({ ...cache, juegos, borrados: { ...cache.borrados, [id]: Date.now() } });
  return j;
}

export function restaurarJuego(j) {
  const v = juegoValido(j);
  if (!v) return;
  v.actualizado = Math.max(Date.now(), v.actualizado);   // lo restaurado es lo más reciente que hiciste: gana a la tumba y a otros dispositivos
  guardar({ ...cache, juegos: { ...cache.juegos, [v.id]: v }, borrados: sinTumba(cache.borrados, v.id) });
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
  guardar({ v: 1, sembrado: ahora, juegos, borrados: cache.borrados });
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
