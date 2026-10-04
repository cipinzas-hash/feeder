export default {
  id: "salud",
  tabLabel: "Salud",

  // kidsHealth (schema v2): `events` es la única colección de eventos de
  // salud (enfermedades, registros de síntomas, medicación, tratamientos,
  // citas) — ver modules/salud/saludModel.js. `family` se completa una vez
  // desde la UI (onboarding en SaludPage), nunca queda en el repo. Los datos
  // v1 (episodes/dailyLog/citasRegulares) se migran al cargar y quedan en
  // `legacy` como respaldo.
  state: {
    kidsHealth: { default: { schemaVersion: 2, family: [], profiles: {}, events: [] } },
  },
};
