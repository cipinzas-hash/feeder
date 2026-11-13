export default {
  id: "gameenhanced",
  tabLabel: "Game enhanced",
  // Sin estado en AngstApp: el módulo guarda en su propia clave de localStorage
  // ("angst-game-enhanced-estado-v1", ver estado.js), declarada en LOCAL_KEY_FIELDS
  // (core/persistence.js) → viaja en el export 💾 / Angst-data. Lee game-enhanced.json
  // (lo arma modules/feed/scripts/build-game-enhanced.mjs, workflow update-game-enhanced.yml).
  state: {},
};
