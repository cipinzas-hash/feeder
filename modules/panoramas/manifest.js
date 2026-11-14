export default {
  id: "panoramas",
  tabLabel: "Panoramas",
  // Sin estado persistente (v1): el módulo solo lee panoramas.json (lo arma build-panoramas.mjs)
  // y filtra en memoria. No agrega claves de localStorage, así que no toca core/persistence.js
  // ni tests/export-coverage.mjs.
  state: {},
};
