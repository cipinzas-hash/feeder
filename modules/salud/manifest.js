export default {
  id: "salud",
  tabLabel: "Salud",

  // kidsHealth ya existía como campo persistido; ahora también carga
  // `family` (antes: const FAMILY hardcodeada con nombres/fechas de
  // nacimiento reales, en texto plano, en el código fuente). Default vacío
  // a propósito — se completa una vez desde la UI (onboarding en
  // SaludPage), nunca queda comprometido en el repo.
  state: {
    kidsHealth: { default: { episodes: [], family: [] } },
  },
};
