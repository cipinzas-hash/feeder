export default {
  id: "nutricion",
  version: "0.0",
  tabLabel: "Nutrición",
  state: {
    nutriLog: { default: {} },
    customFoods: { default: {} },
    foodOverrides: { default: {} },
    nutriDecks: { default: [] },
  },
};

// Integration: receives getStressScore as a callback from the application shell.
