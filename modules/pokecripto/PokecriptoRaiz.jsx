// Raíz de Pokécripto (multi-juego, 17-nov-2026): selector de juego arriba y, debajo, la pantalla de siempre (Pokémon, sin
// cambios) o la de otros juegos (PokecriptoJuego). Todo vive en el MISMO inventario (pokeInventario): cada fila lleva
// `juego` ("pokemon" si no lo trae). Pokémon recibe solo sus filas, y lo que guarda se fusiona de vuelta sin tocar las de
// los otros juegos; mientras no haya filas de otros juegos pasa el inventario tal cual (comportamiento idéntico al de antes).
import PokecriptoPage from "./PokecriptoPage.jsx";
import PokecriptoJuego from "./PokecriptoJuego.jsx";
import { JUEGOS, juegoDe } from "./lib/juegos.mjs";

const { useState, useMemo } = React;

export default function PokecriptoRaiz(props) {
  const [juego, setJuego] = useState("pokemon");
  const todas = props.inventario || [];
  const hayOtros = useMemo(() => todas.some(f => juegoDe(f) !== "pokemon"), [todas]);
  const soloPokemon = useMemo(() => (hayOtros ? todas.filter(f => juegoDe(f) === "pokemon") : todas), [todas, hayOtros]);
  const saveSoloPokemon = d => props.saveInventario(prev => {
    const full = Array.isArray(prev) ? prev : [];
    const otros = full.filter(f => juegoDe(f) !== "pokemon");
    if (!otros.length) return typeof d === "function" ? d(full) : d;
    const next = typeof d === "function" ? d(full.filter(f => juegoDe(f) === "pokemon")) : d;
    return [...next, ...otros];
  });
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
      <div style={{ flex: "none", display: "flex", gap: 6, justifyContent: "center", padding: "6px 12px 4px" }} role="tablist" aria-label="juego">
        {JUEGOS.map(j => (
          <button key={j.id} role="tab" aria-selected={j.id === juego} data-juego={j.id} onClick={() => setJuego(j.id)}
            style={{ border: j.id === juego ? "1px solid #3a3a3a" : "1px solid #1d1d1d", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "5px 11px", borderRadius: 14, background: j.id === juego ? "#2a2a2a" : "#121212", color: j.id === juego ? "#fff" : "#777" }}>
            {j.emoji} {j.nombre}
          </button>))}
      </div>
      {juego === "pokemon"
        ? <PokecriptoPage {...props} inventario={soloPokemon} saveInventario={hayOtros ? saveSoloPokemon : props.saveInventario} />
        : <PokecriptoJuego juego={juego} inventario={todas} saveInventario={props.saveInventario} />}
    </div>
  );
}
