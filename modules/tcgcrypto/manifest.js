export default {
  id: "tcgcrypto",
  tabLabel: "tcgcrypto",
  // Sin estado en AngstApp: el módulo guarda en su propia clave de localStorage
  // ("angst-tcgcrypto-estado-v1", ver estado.js), declarada en LOCAL_KEY_FIELDS
  // (core/persistence.js) → viaja en el export 💾 / Angst-data. Lee tcgcrypto-<juego>.json
  // (lo arma modules/feed/scripts/build-tcgcrypto.mjs, workflow update-tcgcrypto.yml).
  state: {},
};
