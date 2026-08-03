// NO es el shell real de Angst. Es un harness mínimo para validar que
// manifest -> módulo -> bundle -> HTML final funciona de punta a punta,
// mientras el shell real (AngstApp/Semana) sigue sin extraer.

import PokecriptoPage from "../modules/pokecripto/PokecriptoPage.jsx";
import pokecriptoManifest from "../modules/pokecripto/manifest.js";
import { buildDefaultState, getSecret, setSecret } from "../core/persistence.js";

const manifests = [pokecriptoManifest];
const defaultState = buildDefaultState(manifests);

function slice(key, setState) {
  return (fn) =>
    setState((s) => ({ ...s, [key]: typeof fn === "function" ? fn(s[key]) : fn }));
}

function Harness() {
  const [state, setState] = React.useState(defaultState);
  const [apiKey, setApiKey] = React.useState(() => getSecret(pokecriptoManifest, "pokeApiKey"));

  return React.createElement(PokecriptoPage, {
    inventario: state.pokeInventario,
    saveInventario: slice("pokeInventario", setState),
    carpetas: state.pokeCarpetas,
    saveCarpetas: slice("pokeCarpetas", setState),
    darkCatalogo: state.pokeDarkCatalogo,
    saveDarkCatalogo: slice("pokeDarkCatalogo", setState),
    priceCache: state.pokePriceCache,
    savePriceCache: slice("pokePriceCache", setState),
    apiKey: apiKey,
    saveApiKey: (val) => {
      setSecret(pokecriptoManifest, "pokeApiKey", val);
      setApiKey(val);
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Harness));
