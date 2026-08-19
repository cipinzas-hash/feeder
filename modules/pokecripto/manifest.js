export default {
  id: "pokecripto",
  version: "0.0",
  tabLabel: "Pokecripto",
  state: {
    pokeInventario: { default: [] },
    pokeCarpetas: { default: ["MLP", "Staples & Meta", "Dark Collection"] },
    pokeDarkCatalogo: { default: [] },
    pokePriceCache: { default: {} },
  },
  secrets: {
    pokeApiKey: { storageKey: "angst-secret-pokeApiKey" },
  },
};
