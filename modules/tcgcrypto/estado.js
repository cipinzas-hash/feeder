// ─── Estado de tcgcrypto (nov-2026, issue #42) ──────────────────────────────────────────────────────────────────────
// UNA clave nueva, "angst-tcgcrypto-estado-v1", declarada en LOCAL_KEY_FIELDS (core/persistence.js): viaja en el export
// 💾 / Angst-data y se rehidrata en restoreFromPayload (rehidratarEstado). No toca ningún dato existente (R8).
//
// Forma: { tcg: "yugioh", vista: "edicion" | "az", cartas: { [tcg]: { [coleccion]: { [claveCarta]: marca } } } }
// marca = { c: 1 si la tenés, e: "productId|subtipo" de la versión elegida, q: cantidad, cu: costo en USD, nt: notas }
// Cada colección es INDIVIDUAL (misma regla que Pokécripto, issue #39): la misma carta en dos colecciones son dos marcas.
const KEY = "angst-tcgcrypto-estado-v1";

const obj = o => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
const VACIO = () => ({ tcg: "yugioh", vista: "edicion", cartas: {} });

function leer() {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) return { tcg: typeof v.tcg === "string" ? v.tcg : "yugioh", vista: v.vista === "az" ? "az" : "edicion", cartas: obj(v.cartas) };
  } catch (e) { /* clave ausente o corrupta: estado vacío */ }
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
export function rehidratarEstado() { cache = leer(); oyentes.forEach(fn => fn(cache)); }
export function leerEstado() { return cache; }

export function elegirTcg(tcg) { guardar({ ...cache, tcg }); }
export function elegirVista(vista) { guardar({ ...cache, vista: vista === "az" ? "az" : "edicion" }); }

export const marcaDe = (estado, tcg, colec, k) => obj(obj(obj(estado.cartas)[tcg])[colec])[k] || null;

const esVacia = m => !m.c && !m.e && !(m.q > 1) && !m.cu && !m.nt;

// Mezcla `parche` en la marca de una carta; si la marca queda sin nada, se borra (el archivo no acumula basura).
export function ponerMarca(tcg, colec, k, parche) {
  const porTcg = { ...obj(cache.cartas[tcg]) };
  const porColec = { ...obj(porTcg[colec]) };
  const m = { ...(porColec[k] || {}), ...parche };
  for (const campo of Object.keys(m)) if (m[campo] === undefined || m[campo] === null || m[campo] === "" || m[campo] === 0) delete m[campo];
  if (esVacia(m)) delete porColec[k]; else porColec[k] = m;
  porTcg[colec] = porColec;
  guardar({ ...cache, cartas: { ...cache.cartas, [tcg]: porTcg } });
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
