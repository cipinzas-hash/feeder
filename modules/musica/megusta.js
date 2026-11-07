// ─── Me gusta de Música (nov-2026) ──────────────────────────────────────────
// Dar ♥ a un lanzamiento lo GUARDA, y de lo guardado sale el directorio de artistas (se arma al vuelo
// con directorio(): no hay un segundo almacén que pueda quedar desincronizado). Un artista entra al
// directorio al dar ♥ a algo suyo y sale cuando ya no le queda ningún ♥.
//
// Persistencia: UNA clave, "angst-musica-megusta-v1", declarada en LOCAL_KEY_FIELDS (core/persistence.js)
// → viaja en el export 💾 / Angst-data y se rehidrata en restoreFromPayload (rehidratarMegusta). Es una
// clave nueva: no migra ni toca datos existentes. Cada entrada lleva una COPIA del lanzamiento (y del
// artista) porque musica.json solo guarda ~30 días de lanzamientos.
//
// Forma: { [lanzamientoId]: { lz, nombre, foto, tags, at } }
const KEY = "angst-musica-megusta-v1";

function leer() {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) { return {}; }
}

let cache = leer();
const oyentes = new Set();

function guardar(next) {
  cache = next;
  try { globalThis.localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
  oyentes.forEach(fn => fn(next));
}

// Tras restaurar un export: la clave cambió por debajo de la caché de módulo.
export function rehidratarMegusta() {
  cache = leer();
  oyentes.forEach(fn => fn(cache));
}

export function leerMegusta() { return cache; }

// lz: lanzamiento de musica.json; artista: su ficha (datos.artistas[slug]) o undefined.
export function alternarMegusta(lz, artista) {
  const next = { ...cache };
  if (next[lz.id]) delete next[lz.id];
  else {
    next[lz.id] = {
      lz: {
        id: lz.id, artista: lz.artista, artistaSlug: lz.artistaSlug, disco: lz.disco || null, tipo: lz.tipo || null,
        fecha: lz.fecha || null, arte: lz.arte || null, player: lz.player || null, fuentes: (lz.fuentes || []).slice(0, 3),
      },
      nombre: (artista && artista.nombre) || lz.artista,
      foto: (artista && (artista.foto || (artista.bandcamp && artista.bandcamp.foto))) || null,
      tags: ((artista && artista.mb && artista.mb.tags) || []).slice(0, 8),
      at: Date.now(),
    };
  }
  guardar(next);
}

export function useMegusta() {
  const [map, setMap] = React.useState(cache);
  React.useEffect(() => {
    oyentes.add(setMap);
    setMap(cache);   // por si cambió entre el render y el efecto
    return () => oyentes.delete(setMap);
  }, []);
  return map;
}

// Directorio: artistas con al menos un ♥, el más reciente primero. Los géneros son la unión de los que
// quedaron guardados con cada ♥ (el primero no vacío manda el orden).
export function directorio(map) {
  const por = {};
  for (const e of Object.values(map || {})) {
    if (!e || !e.lz || !e.lz.artistaSlug) continue;
    const slug = e.lz.artistaSlug;
    const a = por[slug] || (por[slug] = { slug, nombre: e.nombre || e.lz.artista, foto: null, tags: [], lanzamientos: [], at: 0 });
    a.lanzamientos.push(e.lz);
    if (!a.foto && e.foto) a.foto = e.foto;
    for (const t of e.tags || []) if (!a.tags.includes(t)) a.tags.push(t);
    if ((e.at || 0) > a.at) a.at = e.at || 0;
  }
  const out = Object.values(por);
  out.forEach(a => a.lanzamientos.sort((x, y) => String(y.fecha || "").localeCompare(String(x.fecha || ""))));
  return out.sort((x, y) => y.at - x.at || x.nombre.localeCompare(y.nombre));
}
