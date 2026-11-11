// ─── Estado de Game enhanced (nov-2026) ─────────────────────────────────────
// Lo único que se guarda: qué ítems marcó "me interesa" (guardados) y cuáles descartó con
// "no me interesa" (ocultos). UNA clave, "angst-game-enhanced-estado-v1", declarada en
// LOCAL_KEY_FIELDS (core/persistence.js) → viaja en el export 💾 / Angst-data y se rehidrata en
// restoreFromPayload (rehidratarEstado). Es una clave nueva: no migra ni toca datos existentes.
//
// Forma: { guardados: { [idItem]: marcaDeTiempo }, ocultos: { [idItem]: marcaDeTiempo } }
const KEY = "angst-game-enhanced-estado-v1";

const mapa = o => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

function leer() {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) return { guardados: mapa(v.guardados), ocultos: mapa(v.ocultos) };
  } catch (e) { /* clave ausente o corrupta: estado vacío */ }
  return { guardados: {}, ocultos: {} };
}

let cache = leer();
const oyentes = new Set();

function guardar(next) {
  cache = next;
  try { globalThis.localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* sin cuota: queda en memoria */ }
  oyentes.forEach(fn => fn(next));
}

// Tras restaurar un export: la clave cambió por debajo de la caché de módulo.
export function rehidratarEstado() {
  cache = leer();
  oyentes.forEach(fn => fn(cache));
}

export function leerEstado() { return cache; }

export function alternarGuardado(id) {
  const g = { ...cache.guardados };
  if (g[id]) delete g[id]; else g[id] = Date.now();
  guardar({ ...cache, guardados: g });
}

// "No me interesa": oculta el ítem y, si estaba guardado, le quita el guardado. Devuelve lo que
// había (para poder deshacer sin perder el guardado previo).
export function ocultar(id) {
  const previo = cache.guardados[id] || null;
  const g = { ...cache.guardados };
  delete g[id];
  guardar({ guardados: g, ocultos: { ...cache.ocultos, [id]: Date.now() } });
  return previo;
}

export function deshacerOcultar(id, guardadoPrevio) {
  const o = { ...cache.ocultos };
  delete o[id];
  const g = { ...cache.guardados };
  if (guardadoPrevio) g[id] = guardadoPrevio;
  guardar({ guardados: g, ocultos: o });
}

export function useEstado() {
  const [e, setE] = React.useState(cache);
  React.useEffect(() => {
    oyentes.add(setE);
    setE(cache);   // por si cambió entre el render y el efecto
    return () => oyentes.delete(setE);
  }, []);
  return e;
}
