// Variantes de Pokémon dentro de Pokécripto (variantes, 20-nov-2026): panel del detalle e insignias de las tarjetas, con el MISMO
// formato que Yu-Gi-Oh! y Digimon (lib/variantes-comunes.mjs). Datos: catálogo por set de tcgcsv (build-pokemon-variantes.mjs), un archivo
// por set que se carga solo al abrir o mostrar una carta de ese set (≤135 KB) y se guarda en memoria.
// Muestra qué variantes existen (holo, reverse, Poké Ball, logo de tipo, sellos de campeonato / evento / prerelease / liga) y cuánto
// cuesta cada una, y deja MARCAR cuál tienes: cada variante es su propio ejemplar (ver lib/variantes-filas.mjs).
import { pokemonVariantesUrl, fetchJsonSafe } from "../shared/constants.js";
import { grupoDeSet, variantesDeShard } from "./lib/variantes-pokemon.mjs";
import { multiploSobreBase } from "./lib/variantes-comunes.mjs";
import { filaDeVariante, baseSinVariante } from "./lib/variantes-filas.mjs";
import { filaTiene } from "./lib/juegos.mjs";

const { useState, useEffect } = React;
const fmtUSD = n => "$" + parseFloat(n || 0).toFixed(2);   // (copia local: PokecriptoPage importa este módulo)
const f = { fontFamily: "'DM Sans',sans-serif" }, cv = { fontFamily: "'Caveat',cursive" };

// Caché de módulo: índice, shards por grupo y suscriptores (para re-renderizar cuando llega un shard)
const cache = { indice: undefined, indiceP: null, shards: new Map(), promesas: new Map(), subs: new Set() };
const avisar = () => cache.subs.forEach(fn => fn());
function cargarIndice() {
  if (cache.indice !== undefined) return Promise.resolve(cache.indice);
  if (!cache.indiceP) cache.indiceP = fetchJsonSafe(pokemonVariantesUrl("index")).then(d => { cache.indice = d || null; avisar(); return cache.indice; });
  return cache.indiceP;
}
function cargarShard(id) {
  if (cache.shards.has(id)) return Promise.resolve(cache.shards.get(id));
  if (!cache.promesas.has(id)) cache.promesas.set(id, fetchJsonSafe(pokemonVariantesUrl(String(id))).then(d => { cache.shards.set(id, d || null); avisar(); return d; }));
  return cache.promesas.get(id);
}
// Lectura síncrona (para las tarjetas): undefined = aún no se sabe; [] = no tiene varias variantes
function leer(setNombre, numero, nombre) {
  if (cache.indice === undefined) return undefined;
  if (!cache.indice) return [];
  const g = grupoDeSet(cache.indice, setNombre);
  if (!g) return [];
  if (!cache.shards.has(g.id)) return undefined;
  const sh = cache.shards.get(g.id);
  return sh ? variantesDeShard(sh, cache.indice, numero, nombre) : [];
}
export function useVariantesPokemon(setNombre, numero, nombre) {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick(n => n + 1);
    cache.subs.add(fn);
    cargarIndice().then(idx => { if (!idx) return; const g = grupoDeSet(idx, setNombre); if (g) cargarShard(g.id); });
    return () => { cache.subs.delete(fn); };
  }, [setNombre]);
  return leer(setNombre, numero, nombre);
}

// Insignias pequeñas (tarjetas de las colecciones): solo si la carta tiene varias variantes. Hasta 3 + «+n».
export function InsigniasPokemon({ set, number, name, max = 3 }) {
  const vs = useVariantesPokemon(set, number, name);
  if (!vs || vs.length < 2) return null;
  return (
    <div data-t="insignias-poke" style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", marginTop: 2 }}>
      {vs.slice(0, max).map(v => <span key={v.key} title={`${v.etiqueta}${v.market != null ? " · " + fmtUSD(v.market) : ""}`} style={{ ...f, fontSize: 7, lineHeight: 1.15, padding: "0 3px", borderRadius: 5, color: v.color, border: `1px solid ${v.color}`, whiteSpace: "nowrap" }}>{v.icono} {v.corta}</span>)}
      {vs.length > max && <span style={{ ...f, fontSize: 7, color: "#777" }}>+{vs.length - max}</span>}
    </div>);
}

// Panel del detalle: todas las variantes de esa carta con precio, el múltiplo sobre la base para los sellos y, si se pasa `onMarcar`, qué
// variante tienes. `filas` = las filas de esa carta en esa carpeta (la base y sus variantes); `onMarcar(v, accion)` con accion
// "agregar" | "asignar" | "quitar".
export function PanelVariantesPokemon({ set, number, name, filas, onMarcar }) {
  const vs = useVariantesPokemon(set, number, name);
  if (vs === undefined) return <div data-t="variantes-poke" style={{ ...f, fontSize: 10, color: "#555", padding: "4px 0" }}>buscando variantes…</div>;
  if (!vs.length) return null;
  const precios = vs.map(v => v.market).filter(p => p != null);
  const hs = filas || [];
  const base = baseSinVariante(hs);
  const baseTenida = !!base && filaTiene(base);
  const btn = (act, bg, col) => ({ ...f, fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 8, border: act ? "none" : "1px dashed #444", background: bg, color: col, cursor: "pointer", whiteSpace: "nowrap" });
  return (
    <div data-t="variantes-poke" style={{ flex: "none", marginTop: 4 }}>
      <div style={{ ...f, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
        variantes · {vs.length}{precios.length > 1 && Math.min(...precios) !== Math.max(...precios) ? ` · ${fmtUSD(Math.min(...precios))} a ${fmtUSD(Math.max(...precios))}` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {vs.map(v => {
          const m = multiploSobreBase(v, vs);
          const fila = filaDeVariante(hs, v.key), tengo = !!fila && filaTiene(fila);
          return (
            <div key={v.key + (v.grupoSello || "")} data-t="variante-poke" data-tengo={tengo ? "1" : "0"} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 9, background: tengo ? "#12301f" : "#151515", border: `1px solid ${tengo ? "#2e7d52" : v.esSello ? v.color : "#1f1f1f"}` }}>
              <span style={{ ...f, fontSize: 12, color: v.color, fontWeight: 700, width: 16, textAlign: "center" }}>{v.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...f, fontSize: 11, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.etiqueta}{v.esSello && m != null && m >= 1.5 ? <span style={{ color: "#e6c229" }}> · ×{m} la base</span> : null}</div>
                {v.grupoSello && <div style={{ ...f, fontSize: 9, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.grupoSello}</div>}
              </div>
              <span style={{ ...cv, fontSize: 15, fontWeight: 700, color: v.market != null ? "#5c9cff" : "#555" }}>{v.market != null ? fmtUSD(v.market) : "—"}</span>
              {onMarcar && (
                <div style={{ display: "flex", gap: 4, flex: "none" }}>
                  {tengo
                    ? <button data-t="var-quitar" onClick={() => onMarcar(v, "quitar")} title="quitar esta variante" style={btn(true, "#2e7d52", "#fff")}>✓ la tengo</button>
                    : <>
                        {baseTenida && <button data-t="var-asignar" onClick={() => onMarcar(v, "asignar")} title="mi carta actual es esta variante" style={btn(false, "transparent", "#999")}>es mi carta</button>}
                        <button data-t="var-agregar" onClick={() => onMarcar(v, "agregar")} style={btn(false, "transparent", "#ccc")}>＋ la tengo</button>
                      </>}
                </div>)}
            </div>);
        })}
      </div>
      <div style={{ ...f, fontSize: 8, color: "#444", marginTop: 4 }}>
        {onMarcar ? "cada variante que marcas es su propio ejemplar, con costo, historial y gráfico propios · " : ""}precio inicial del catálogo semanal de tcgcsv; el bot lo actualiza cada día
      </div>
    </div>);
}
