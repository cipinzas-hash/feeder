// Raíz de Pokécripto (unificada, 22-nov-2026). UNA sola pantalla para todos los juegos: la de siempre (PokecriptoPage) con sus carpetas,
// estados, Price Watch, precio objetivo, ventas, historial, ficha y gráficos. El selector de juego solo cambia QUÉ FILAS ve (cada fila
// lleva `juego`, «pokemon» si falta) y de dónde vienen el catálogo y los precios: Pokémon usa su catálogo y su API; Yu-Gi-Oh! y Digimon
// aportan el explorador de colecciones y el buscador de su catálogo (tcgcsv). Todo vive en el MISMO inventario (pokeInventario).
//
// Carpetas por juego: se guardan en el mismo arreglo `pokeCarpetas` con prefijo («yugioh::Price Watch»); las de Pokémon no llevan
// prefijo, así que el formato del respaldo no cambia y los respaldos viejos siguen restaurando igual.
import PokecriptoPage, { CARPETAS_DEFAULT } from "./PokecriptoPage.jsx";
import PokecriptoJuego from "./PokecriptoJuego.jsx";
import BuscarCatalogo from "./BuscarCatalogo.jsx";
import { JUEGOS, juegoDe } from "./lib/juegos.mjs";

const { useState, useMemo } = React;
const SEP = "::";
const CARPETAS_OTROS = CARPETAS_DEFAULT.filter(c => c !== "Dark Collection");
const esDeJuego = (c, j) => (j === "pokemon" ? !String(c).includes(SEP) : String(c).startsWith(j + SEP));

export default function PokecriptoRaiz(props) {
  const [juego, setJuego] = useState("pokemon");
  const esPoke = juego === "pokemon";
  const todas = props.inventario || [];
  const hayOtros = useMemo(() => todas.some(f => juegoDe(f) !== "pokemon"), [todas]);
  const filas = useMemo(() => (esPoke && !hayOtros ? todas : todas.filter(f => juegoDe(f) === juego)), [todas, juego, esPoke, hayOtros]);
  const save = d => props.saveInventario(prev => {
    const full = Array.isArray(prev) ? prev : [];
    const resto = full.filter(f => juegoDe(f) !== juego);
    if (esPoke && !resto.length) return typeof d === "function" ? d(full) : d;      // sin otros juegos: idéntico a antes
    const next = typeof d === "function" ? d(full.filter(f => juegoDe(f) === juego)) : d;
    return esPoke ? [...next, ...resto] : [...resto, ...next];
  });

  const guardadas = props.carpetas || null;
  const carpetas = useMemo(() => {
    if (esPoke) return guardadas ? guardadas.filter(c => esDeJuego(c, "pokemon")) : null;
    const propias = (guardadas || []).filter(c => esDeJuego(c, juego)).map(c => c.slice(juego.length + SEP.length));
    return propias.length ? propias : [...CARPETAS_OTROS];
  }, [guardadas, juego, esPoke]);
  const saveCarpetas = lista => {
    const otras = (props.carpetas || []).filter(c => !esDeJuego(c, juego));
    props.saveCarpetas(esPoke ? [...lista, ...otras] : [...otras, ...lista.map(c => juego + SEP + c)]);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
      <div style={{ flex: "none", display: "flex", gap: 6, justifyContent: "center", padding: "6px 12px 4px" }} role="tablist" aria-label="juego">
        {JUEGOS.map(j => (
          <button key={j.id} role="tab" aria-selected={j.id === juego} data-juego={j.id} onClick={() => setJuego(j.id)}
            style={{ border: j.id === juego ? "1px solid #3a3a3a" : "1px solid #1d1d1d", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "5px 11px", borderRadius: 14, background: j.id === juego ? "#2a2a2a" : "#121212", color: j.id === juego ? "#fff" : "#777" }}>
            {j.emoji} {j.nombre}
          </button>))}
      </div>
      <PokecriptoPage key={juego} {...props} juego={juego} inventario={filas} saveInventario={esPoke && !hayOtros ? props.saveInventario : save}
        carpetas={carpetas} saveCarpetas={saveCarpetas}
        darkCatalogo={esPoke ? props.darkCatalogo : []} saveDarkCatalogo={esPoke ? props.saveDarkCatalogo : () => {}}
        explorador={esPoke ? null : p => <PokecriptoJuego juego={juego} inventario={filas} saveInventario={save} onSalir={p.volver} />}
        buscador={esPoke ? null : p => <BuscarCatalogo juego={juego} filas={filas} saveInventario={save} carpetas={p.carpetas} onVolver={p.volver} />} />
    </div>
  );
}
