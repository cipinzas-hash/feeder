export default {
  id: "salud",
  version: "0.0",
  tabLabel: "Salud",
  state: {
    kidsHealth: { default: { episodes: [], family: [] } },
  },
};

// Family data is user-configured and must never be hardcoded in source.
