export default {
  id: "presupuesto",
  tabLabel: "Presupuesto",
  state: {
    budgets: { default: {} }, // keyed "YYYY-MM"
  },
};

// NOTA: NutriaPage (ya migrado) también recibe budgets/onSaveBudget como
// props — integración declarada del lado de Nutria, no acá.
