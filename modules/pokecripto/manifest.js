// Manifest de Pokecripto.
// Antes: agregar un campo de estado nuevo requería tocar 4 lugares a mano
// (saveToStorage, buildExportPayload, REQUIRED_EXPORT_FIELDS, restoreFromPayload)
// dentro de AngstApp — causa confirmada de la pérdida silenciosa de nutriDecks.
// Ahora: el módulo declara sus campos una sola vez acá, y core/persistence.js
// los usa para inicializar/guardar/exportar/restaurar automáticamente.

export default {
  id: "pokecripto",
  tabLabel: "Pokecripto",

  // Campos que este módulo posee dentro del payload persistido/exportado.
  // Los nombres se mantienen iguales a los actuales (pokeInventario, etc.)
  // para que un backup .json viejo siga restaurando sin cambios.
  state: {
    pokeInventario:   { default: [] },
    pokeCarpetas:     { default: ["MLP", "Staples & Meta", "Dark Collection"] },
    pokeDarkCatalogo: { default: [] },
    pokePriceCache:   { default: {} },
  },

  // La API key vive fuera del payload de export a propósito: si Cristopher
  // comparte o sube un backup .json, la key nunca viaja adentro.
  secrets: {
    pokeApiKey: { storageKey: "angst-secret-pokeApiKey" },
  },
};
