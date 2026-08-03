export default {
  id: "nutricion",
  tabLabel: "Nutrición",
  state: {
    nutriLog: { default: {} },
    customFoods: { default: {} },
    foodOverrides: { default: {} },
    nutriDecks: { default: [] },
  },
};

// NOTA: recibe getStressScore como prop (callback), no como estado propio —
// es la integración con computeStressScore de Semana/core. Declarada acá,
// del lado del módulo que integra, como corresponde.
