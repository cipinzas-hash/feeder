// Texto del efecto de una carta de Yu-Gi-Oh! (y Digimon si el catálogo lo trae), legible, debajo de la imagen: las imágenes de tcgcsv son de baja
// resolución. Viene del archivo del pool de la letra de la carta (se baja al abrir la ficha y queda en caché), no de la fila: el inventario no engorda.
import { fetchPoolLetra } from "../shared/catalog.js";
import { letraDe, cartaEnLetra } from "./lib/mazos.mjs";
const { useState, useEffect } = React;
const f = { fontFamily: "'DM Sans',sans-serif" };

export function useEfectoCarta(juego, nombre) {
  const [d, setD] = useState(undefined);
  useEffect(() => {
    let vivo = true; setD(undefined);
    if (!nombre || juego === "pokemon") { setD(null); return; }
    fetchPoolLetra(juego, letraDe(nombre)).then(sh => { if (vivo) setD(cartaEnLetra(sh, nombre, juego)); }).catch(() => { if (vivo) setD(null); });
    return () => { vivo = false; };
  }, [juego, nombre]);
  return d;
}
export const lineaMeta = m => !m ? "" : [m.ct || m.t, m.a, m.lv != null && m.lv !== "" ? `nivel ${m.lv}` : "", m.atk != null && m.atk !== "" ? `ATK ${m.atk}${m.def != null && m.def !== "" ? ` / DEF ${m.def}` : ""}` : ""].filter(Boolean).join(" · ");

export default function EfectoCarta({ juego, nombre, carta, grande = false }) {
  const d0 = useEfectoCarta(juego, carta ? null : nombre);
  const d = carta || d0;
  if (!d || (!d.x && !d.m)) return null;
  const meta = lineaMeta(d.m);
  return (
    <div data-t="efecto" style={{ flex: "none", marginTop: 6, padding: "8px 10px", background: "#0e0e0e", border: "1px solid #1f1f1f", borderRadius: 10 }}>
      {meta && <div style={{ ...f, fontSize: grande ? 12 : 10, color: "#8aa6d8", marginBottom: d.x ? 4 : 0 }}>{meta}</div>}
      {d.x && <div style={{ ...f, fontSize: grande ? 15 : 13, lineHeight: 1.45, color: "#e4e4e4", whiteSpace: "pre-wrap" }}>{d.x}</div>}
    </div>);
}
